/**
 * Moteur de détection d'anomalies comptables.
 *
 * Détecte les 8 types d'anomalies (A à H) définis dans le cahier des charges :
 *
 *   A — Mauvais client            : écriture affectée à une mauvaise entité ou mauvais compte
 *   B — Mauvais compte 512        : le 512 utilisé ne correspond pas aux règles d'affectation
 *   C — Contrepartie hors périmètre : contrepartie ne correspond à aucune entité connue
 *   D — Compte oublié              : opération sans contrepartie attendue
 *   E — Écriture déséquilibrée     : Débit ≠ Crédit par pièce
 *   F — Journal déséquilibré       : Total D ≠ Total C par journal
 *   G — Compte déséquilibré Brouillard↔Balance
 *   H — Écriture déjà passée       : opération de régularisation existante déjà saisie
 *
 * Chaque anomalie a :
 *   - un score de confiance (CERTAINE / PROBABLE / MANUELLE)
 *   - une sévérité (CRITIQUE / MAJEURE / MINEURE / INFO)
 *   - une explication textuelle
 *   - des preuves (montant, pièce, journal, comptes)
 */
import {
  ParsedVerifData,
  ParsedBrouillardData,
  BrouillardPiece,
  BrouillardEntry,
} from "./parser";
import {
  SPECIFIC_512,
  SANLAM_HISTORY,
  GROUPED_ENTITIES,
  ENTITY_TO_JOURNAL_SUFFIX,
  getEntityGroup,
  getEntityJournalCodes,
  guessEntityFromJournal,
  shareSame512,
} from "./rules";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnomalyType =
  | "A_MAUVAIS_CLIENT"
  | "B_MAUVAIS_512"
  | "C_CONTREPARTIE_HORS_PERIMETRE"
  | "D_COMPTE_OUBLIE"
  | "E_ECRITURE_DESEQUILIBREE"
  | "F_JOURNAL_DESEQUILIBRE"
  | "G_COMPTE_DESEQUILIBRE_BROUILLARD_BALANCE"
  | "H_DEJA_PASSEE";

export type Confidence = "CERTAINE" | "PROBABLE" | "MANUELLE";
export type Severity = "CRITIQUE" | "MAJEURE" | "MINEURE" | "INFO";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  typeLabel: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  // Contexte
  entity?: string;
  journal?: string;
  numPiece?: string;
  date?: string | null;
  compte?: string;
  compteTiers?: string;
  montant?: number;
  ecart?: number;
  // Preuves
  evidence: string[];
  // Référence vers la pièce (si applicable)
  pieceKey?: string;
}

export interface AnomalySummary {
  type: AnomalyType;
  typeLabel: string;
  count: number;
  critiqueCount: number;
  majeureCount: number;
  mineureCount: number;
  infoCount: number;
  certaineCount: number;
  probableCount: number;
  manuelleCount: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  A_MAUVAIS_CLIENT: "A — Mauvais client",
  B_MAUVAIS_512: "B — Mauvais compte 512",
  C_CONTREPARTIE_HORS_PERIMETRE: "C — Contrepartie hors périmètre",
  D_COMPTE_OUBLIE: "D — Compte oublié",
  E_ECRITURE_DESEQUILIBREE: "E — Écriture déséquilibrée",
  F_JOURNAL_DESEQUILIBRE: "F — Journal déséquilibré",
  G_COMPTE_DESEQUILIBRE_BROUILLARD_BALANCE: "G — Compte déséquilibré Brouillard↔Balance",
  H_DEJA_PASSEE: "H — Écriture déjà passée",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITIQUE: "Critique",
  MAJEURE: "Majeure",
  MINEURE: "Mineure",
  INFO: "Info",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  CERTAINE: "Certaine",
  PROBABLE: "Probable",
  MANUELLE: "Manuelle",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

/**
 * Devine l'entité d'un compteTiers (ex: "FONHOLCIM" → "HOLCIM").
 * Les comptes tiers sont préfixés par "FON" en général.
 */
function guessEntityFromCompteTiers(compteTiers: string): string | null {
  if (!compteTiers) return null;
  const t = compteTiers.toUpperCase();
  // Retire les préfixes courants : FON, CLT, FONDS...
  const prefixes = ["FON", "CLT", "FONDS", "FOND"];
  for (const p of prefixes) {
    if (t.startsWith(p) && t.length > p.length) {
      const candidate = t.slice(p.length);
      // Vérifie si ce candidat est une entité connue
      for (const entity of Object.keys(ENTITY_TO_JOURNAL_SUFFIX)) {
        if (entity.toUpperCase().replace(/\s+/g, "") === candidate) {
          return entity;
        }
      }
    }
  }
  // Sinon, cherche une correspondance directe
  for (const entity of Object.keys(ENTITY_TO_JOURNAL_SUFFIX)) {
    if (entity.toUpperCase() === t) return entity;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Moteur principal
// ---------------------------------------------------------------------------

/**
 * Journaux à exclure du contrôle par pièce (anomalie E).
 * Ces journaux sont des journaux de centralisation où le numPiece ne
 * correspond pas à une pièce comptable unique mais à un simple numéro
 * séquentiel de regroupement.
 */
const EXCLUDED_JOURNALS_FOR_PIECE_CHECK = new Set([
  "RAN",    // Report À Nouveau (écritures de reprise de l'exercice précédent)
  "TIERS",  // Journal de centralisation tiers
]);

/**
 * Limites du nombre d'anomalies par type (pour éviter un JSON trop gros).
 * Les anomalies sont triées par sévérité puis par montant avant troncation.
 */
const ANOMALY_LIMITS: Record<AnomalyType, number> = {
  E_ECRITURE_DESEQUILIBREE: 200,
  A_MAUVAIS_CLIENT: 100,
  B_MAUVAIS_512: 100,
  C_CONTREPARTIE_HORS_PERIMETRE: 100,
  D_COMPTE_OUBLIE: 100,
  F_JOURNAL_DESEQUILIBRE: 0, // pas de limite (peu de journaux)
  G_COMPTE_DESEQUILIBRE_BROUILLARD_BALANCE: 0, // pas de limite (peu de comptes)
  H_DEJA_PASSEE: 0,
};

export function detectAnomalies(
  verif: ParsedVerifData,
  brouillard: ParsedBrouillardData
): { anomalies: Anomaly[]; summary: AnomalySummary[] } {
  // On regroupe les anomalies par type pour pouvoir les tronquer ensuite
  const anomaliesByType = new Map<AnomalyType, Anomaly[]>();
  let counter = 0;
  const nextId = () => `AN-${String(++counter).padStart(4, "0")}`;

  const addAnomaly = (a: Anomaly) => {
    a.id = nextId();
    if (!anomaliesByType.has(a.type)) anomaliesByType.set(a.type, []);
    anomaliesByType.get(a.type)!.push(a);
    // Pour le summary, on compte TOUTES les anomalies (même celles tronquées)
  };

  // --- Anomalie E : Écriture déséquilibrée (par pièce) ---
  // On exclut les journaux RAN et TIERS (centralisation).
  // On ignore les pièces à 1 seule ligne (ce ne sont pas de vraies pièces).
  for (const piece of brouillard.byPiece.values()) {
    if (EXCLUDED_JOURNALS_FOR_PIECE_CHECK.has(piece.codeJournal.toUpperCase())) continue;
    if (piece.lines.length < 2) continue; // une vraie pièce a au moins 2 lignes
    if (!piece.isBalanced && Math.abs(piece.ecart) >= 1) {
      const entity = guessEntityFromJournal(piece.codeJournal) || "—";
      addAnomaly({
        id: "",
        type: "E_ECRITURE_DESEQUILIBREE",
        typeLabel: ANOMALY_LABELS.E_ECRITURE_DESEQUILIBREE,
        severity: Math.abs(piece.ecart) > 1_000_000 ? "CRITIQUE" : "MAJEURE",
        confidence: "CERTAINE",
        title: `Pièce ${piece.codeJournal}|${piece.numPiece} déséquilibrée`,
        description: `La pièce comptable ${piece.codeJournal}/${piece.numPiece} a un déséquilibre Débit/Crédit de ${round(piece.ecart).toLocaleString("fr-FR")} MGA. Une pièce doit toujours avoir somme Débit = somme Crédit (principe de la partie double).`,
        entity,
        journal: piece.codeJournal,
        numPiece: piece.numPiece,
        date: isoDate(piece.date),
        montant: round(piece.totalDebit),
        ecart: round(piece.ecart),
        evidence: [
          `Débit total : ${round(piece.totalDebit).toLocaleString("fr-FR")} MGA`,
          `Crédit total : ${round(piece.totalCredit).toLocaleString("fr-FR")} MGA`,
          `Écart : ${round(piece.ecart).toLocaleString("fr-FR")} MGA`,
          `Nombre de lignes : ${piece.lines.length}`,
          `Comptes touchés : ${piece.comptes.join(", ")}`,
          `Libellé : ${piece.libelle}`,
        ],
        pieceKey: piece.key,
      });
    }
  }

  // --- Anomalie F : Journal déséquilibré ---
  for (const [journal, agg] of brouillard.byJournal.entries()) {
    const ecart = agg.debit - agg.credit;
    if (Math.abs(ecart) >= 1) {
      const entity = guessEntityFromJournal(journal);
      addAnomaly({
        id: "",
        type: "F_JOURNAL_DESEQUILIBRE",
        typeLabel: ANOMALY_LABELS.F_JOURNAL_DESEQUILIBRE,
        severity: Math.abs(ecart) > 10_000_000 ? "CRITIQUE" : "MAJEURE",
        confidence: "CERTAINE",
        title: `Journal ${journal} déséquilibré`,
        description: `Le code journal ${journal} présente un déséquilibre global de ${round(ecart).toLocaleString("fr-FR")} MGA. Le total des débits du journal doit être strictement égal au total des crédits.`,
        entity: entity || undefined,
        journal,
        ecart: round(ecart),
        montant: round(agg.debit),
        evidence: [
          `Débit total : ${round(agg.debit).toLocaleString("fr-FR")} MGA`,
          `Crédit total : ${round(agg.credit).toLocaleString("fr-FR")} MGA`,
          `Écart : ${round(ecart).toLocaleString("fr-FR")} MGA`,
          `Nombre d'écritures : ${agg.count}`,
        ],
      });
    }
  }

  // --- Anomalie G : Compte déséquilibré Brouillard ↔ Balance ---
  const balanceByCompte = new Map<string, { mvtDebit: number; mvtCredit: number }>();
  for (const acc of verif.balance.accounts) {
    balanceByCompte.set(acc.compte, {
      mvtDebit: acc.mvtDebit,
      mvtCredit: acc.mvtCredit,
    });
  }
  for (const [compte, brou] of brouillard.byCompte.entries()) {
    const bal = balanceByCompte.get(compte);
    if (!bal) continue; // compte absent de la balance : autre contrôle
    const brouSolde = brou.debit - brou.credit;
    const balSolde = bal.mvtDebit - bal.mvtCredit;
    const ecart = brouSolde - balSolde;
    if (Math.abs(ecart) >= 1) {
      addAnomaly({
        id: "",
        type: "G_COMPTE_DESEQUILIBRE_BROUILLARD_BALANCE",
        typeLabel: ANOMALY_LABELS.G_COMPTE_DESEQUILIBRE_BROUILLARD_BALANCE,
        severity: Math.abs(ecart) > 1_000_000 ? "MAJEURE" : "MINEURE",
        confidence: "CERTAINE",
        title: `Compte ${compte} déséquilibré entre Brouillard et Balance`,
        description: `Le solde du compte ${compte} diffère de ${round(ecart).toLocaleString("fr-FR")} MGA entre le Brouillard et la Balance. Cela peut indiquer une écriture saisie dans le brouillard mais non reprise dans la balance, ou inversement.`,
        compte,
        ecart: round(ecart),
        evidence: [
          `Brouillard — Débit : ${round(brou.debit).toLocaleString("fr-FR")} MGA, Crédit : ${round(brou.credit).toLocaleString("fr-FR")} MGA, solde : ${round(brouSolde).toLocaleString("fr-FR")}`,
          `Balance  — Débit : ${round(bal.mvtDebit).toLocaleString("fr-FR")} MGA, Crédit : ${round(bal.mvtCredit).toLocaleString("fr-FR")} MGA, solde : ${round(balSolde).toLocaleString("fr-FR")}`,
          `Écart de solde : ${round(ecart).toLocaleString("fr-FR")} MGA`,
          `Nombre d'écritures brouillard : ${brou.count}`,
        ],
      });
    }
  }

  // --- Anomalie A : Mauvais client ---
  // Détecte les pièces où le code journal ne correspond pas au compteTiers.
  // Exemple : journal BOAHOL (HOLCIM) avec compteTiers FONPAMF → incohérent.
  for (const piece of brouillard.byPiece.values()) {
    if (!piece.compteTiers) continue;
    const journalEntity = guessEntityFromJournal(piece.codeJournal);
    const tiersEntity = guessEntityFromCompteTiers(piece.compteTiers);
    if (journalEntity && tiersEntity && journalEntity !== tiersEntity) {
      // Vérifie si les 2 entités partagent un même 512 (auquel cas c'est normal)
      if (shareSame512(journalEntity, tiersEntity)) continue;
      addAnomaly({
        id: "",
        type: "A_MAUVAIS_CLIENT",
        typeLabel: ANOMALY_LABELS.A_MAUVAIS_CLIENT,
        severity: "MAJEURE",
        confidence: "PROBABLE",
        title: `Pièce ${piece.codeJournal}/${piece.numPiece} — client/tiers incohérent`,
        description: `Le code journal ${piece.codeJournal} correspond à l'entité "${journalEntity}" mais le compte tiers "${piece.compteTiers}" correspond à l'entité "${tiersEntity}". Cette incohérence suggère une mauvaise affectation d'écriture.`,
        entity: journalEntity,
        journal: piece.codeJournal,
        numPiece: piece.numPiece,
        date: isoDate(piece.date),
        compteTiers: piece.compteTiers,
        montant: round(piece.totalDebit),
        evidence: [
          `Journal ${piece.codeJournal} → entité attendue : ${journalEntity}`,
          `Compte tiers ${piece.compteTiers} → entité détectée : ${tiersEntity}`,
          `Les 2 entités ne partagent pas le même compte 512`,
          `Libellé : ${piece.libelle}`,
          `Date : ${isoDate(piece.date) || "—"}`,
        ],
        pieceKey: piece.key,
      });
    }
  }

  // --- Anomalie B : Mauvais compte 512 ---
  // Pour chaque pièce contenant un 512, vérifie que le 512 utilisé correspond
  // à l'entité attendue (selon SPECIFIC_512, SANLAM_HISTORY, ou regroupement).
  for (const piece of brouillard.byPiece.values()) {
    if (!piece.has512) continue;
    const entity = guessEntityFromJournal(piece.codeJournal);
    if (!entity) continue;
    // Trouve le compte 512 utilisé dans cette pièce
    const compte512 = piece.comptes.find((c) => c.startsWith("512"));
    if (!compte512) continue;
    // Détermine le 512 attendu
    const expected512 = SPECIFIC_512[entity] || SANLAM_HISTORY[entity] || null;
    if (expected512 && compte512 !== expected512) {
      // Vérifie si l'entité fait partie d'un groupe où le 512 peut varier
      const group = getEntityGroup(entity);
      if (group) {
        // Pour les groupes, le 512 peut être celui d'un autre membre
        // On accepte si le 512 utilisé est dans la liste des 512 du groupe
        // (on ne peut pas le savoir sans plus de contexte, donc on passe)
        continue;
      }
      addAnomaly({
        id: "",
        type: "B_MAUVAIS_512",
        typeLabel: ANOMALY_LABELS.B_MAUVAIS_512,
        severity: "MAJEURE",
        confidence: "CERTAINE",
        title: `Pièce ${piece.codeJournal}/${piece.numPiece} — mauvais compte 512`,
        description: `L'entité "${entity}" devrait utiliser le compte ${expected512} mais la pièce utilise le compte ${compte512}. Ceci viole la règle d'affectation spécifique des comptes 512.`,
        entity,
        journal: piece.codeJournal,
        numPiece: piece.numPiece,
        date: isoDate(piece.date),
        compte: compte512,
        montant: round(piece.totalDebit),
        evidence: [
          `Entité : ${entity}`,
          `Compte 512 attendu : ${expected512}`,
          `Compte 512 utilisé : ${compte512}`,
          `Libellé : ${piece.libelle}`,
        ],
        pieceKey: piece.key,
      });
    }
  }

  // --- Anomalie C : Contrepartie hors périmètre ---
  // Pour chaque pièce contenant un 512, vérifie que la contrepartie (46x)
  // correspond à une entité connue ou à un membre du même groupe 512.
  for (const piece of brouillard.byPiece.values()) {
    if (!piece.has512 || !piece.hasContrepartie) continue;
    const journalEntity = guessEntityFromJournal(piece.codeJournal);
    if (!journalEntity) continue;
    // Pour chaque ligne de contrepartie (46x), vérifie le compteTiers
    for (const line of piece.lines) {
      if (!line.compteGeneral.match(/^46[0127]/)) continue;
      if (!line.compteTiers) continue;
      const contrepartieEntity = guessEntityFromCompteTiers(line.compteTiers);
      if (!contrepartieEntity) {
        // CompteTiers inconnu — potentiellement hors périmètre
        addAnomaly({
          id: "",
          type: "C_CONTREPARTIE_HORS_PERIMETRE",
          typeLabel: ANOMALY_LABELS.C_CONTREPARTIE_HORS_PERIMETRE,
          severity: "MINEURE",
          confidence: "MANUELLE",
          title: `Pièce ${piece.codeJournal}/${piece.numPiece} — contrepartie non identifiée`,
          description: `La contrepartie "${line.compteTiers}" sur le compte ${line.compteGeneral} ne correspond à aucune entité connue. Vérifiez si ce tiers doit être ajouté au périmètre ou si l'écriture est mal affectée.`,
          entity: journalEntity,
          journal: piece.codeJournal,
          numPiece: piece.numPiece,
          date: isoDate(piece.date),
          compte: line.compteGeneral,
          compteTiers: line.compteTiers,
          montant: round(line.debit || line.credit),
          evidence: [
            `Journal : ${piece.codeJournal} (entité ${journalEntity})`,
            `Contrepartie : ${line.compteGeneral} — ${line.compteTiers}`,
            `Tiers non reconnu dans le mapping des entités`,
            `Libellé : ${line.libelle}`,
          ],
          pieceKey: piece.key,
        });
        continue;
      }
      // Si la contrepartie est identifiée mais ne partage pas le 512 avec le journal
      if (
        contrepartieEntity !== journalEntity &&
        !shareSame512(journalEntity, contrepartieEntity)
      ) {
        addAnomaly({
          id: "",
          type: "C_CONTREPARTIE_HORS_PERIMETRE",
          typeLabel: ANOMALY_LABELS.C_CONTREPARTIE_HORS_PERIMETRE,
          severity: "MAJEURE",
          confidence: "PROBABLE",
          title: `Pièce ${piece.codeJournal}/${piece.numPiece} — contrepartie hors périmètre`,
          description: `La pièce du journal ${piece.codeJournal} (entité ${journalEntity}) a une contrepartie affectée à "${contrepartieEntity}" qui ne partage pas le même compte 512. Cette opération devrait probablement faire l'objet d'un transfert 580001.`,
          entity: journalEntity,
          journal: piece.codeJournal,
          numPiece: piece.numPiece,
          date: isoDate(piece.date),
          compte: line.compteGeneral,
          compteTiers: line.compteTiers,
          montant: round(line.debit || line.credit),
          evidence: [
            `Journal : ${piece.codeJournal} (entité ${journalEntity})`,
            `Contrepartie : ${line.compteTiers} (entité ${contrepartieEntity})`,
            `${journalEntity} et ${contrepartieEntity} ne partagent pas le même 512`,
            `Un transfert 580001 est probablement nécessaire`,
          ],
          pieceKey: piece.key,
        });
      }
    }
  }

  // --- Anomalie D : Compte oublié ---
  // Détecte les pièces qui ont un 512 mais AUCUNE contrepartie 46x,
  // ou inversement (une contrepartie 46x sans 512).
  for (const piece of brouillard.byPiece.values()) {
    if (piece.has512 && !piece.hasContrepartie) {
      // Pièce avec 512 mais sans contrepartie d'appel de fonds / prestataire
      // Sauf si la pièce contient un 580 (transfert inter-compte) ou 401/411 (tiers classique)
      const hasOtherContrepartie = piece.comptes.some(
        (c) => c.startsWith("401") || c.startsWith("411") || c.startsWith("580") || c.startsWith("445")
      );
      if (!hasOtherContrepartie) {
        const entity = guessEntityFromJournal(piece.codeJournal) || "—";
        addAnomaly({
          id: "",
          type: "D_COMPTE_OUBLIE",
          typeLabel: ANOMALY_LABELS.D_COMPTE_OUBLIE,
          severity: "MINEURE",
          confidence: "PROBABLE",
          title: `Pièce ${piece.codeJournal}/${piece.numPiece} — contrepartie 46x manquante`,
          description: `La pièce contient un mouvement sur compte 512 mais aucune contrepartie sur compte 46x (appels de fonds / honoraires / prestataires). Une ligne de contrepartie a peut-être été oubliée.`,
          entity,
          journal: piece.codeJournal,
          numPiece: piece.numPiece,
          date: isoDate(piece.date),
          montant: round(piece.totalDebit),
          evidence: [
            `Comptes présents : ${piece.comptes.join(", ")}`,
            `Aucun compte 460/461/462/467 trouvé`,
            `Aucun compte 401/411/580/445 non plus`,
            `Libellé : ${piece.libelle}`,
          ],
          pieceKey: piece.key,
        });
      }
    }
  }

  // --- Anomalie H : Écriture déjà passée ---
  // Cette anomalie est déjà gérée au niveau du moteur de transferts 580001
  // (statut DEJA_PASSEE). On ne la duplique pas ici pour éviter le bruit.
  // Elle reste disponible dans l'onglet "Comptes à comptes".

  // Tri : par sévérité puis par montant absolu décroissant
  const severityOrder: Record<Severity, number> = {
    CRITIQUE: 0,
    MAJEURE: 1,
    MINEURE: 2,
    INFO: 3,
  };
  const sortFn = (a: Anomaly, b: Anomaly) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity];
    if (s !== 0) return s;
    return Math.abs(b.montant || 0) - Math.abs(a.montant || 0);
  };

  // Synthèse par type — compte TOUTES les anomalies détectées (avant troncation)
  const summaryMap = new Map<AnomalyType, AnomalySummary>();
  for (const type of Object.keys(ANOMALY_LABELS) as AnomalyType[]) {
    summaryMap.set(type, {
      type,
      typeLabel: ANOMALY_LABELS[type],
      count: 0,
      critiqueCount: 0,
      majeureCount: 0,
      mineureCount: 0,
      infoCount: 0,
      certaineCount: 0,
      probableCount: 0,
      manuelleCount: 0,
    });
  }
  for (const [, list] of anomaliesByType) {
    for (const a of list) {
      const s = summaryMap.get(a.type)!;
      s.count++;
      if (a.severity === "CRITIQUE") s.critiqueCount++;
      if (a.severity === "MAJEURE") s.majeureCount++;
      if (a.severity === "MINEURE") s.mineureCount++;
      if (a.severity === "INFO") s.infoCount++;
      if (a.confidence === "CERTAINE") s.certaineCount++;
      if (a.confidence === "PROBABLE") s.probableCount++;
      if (a.confidence === "MANUELLE") s.manuelleCount++;
    }
  }
  const summary = Array.from(summaryMap.values()).filter((s) => s.count > 0);

  // Troncation par type : on garde les N anomalies les plus critiques
  const anomalies: Anomaly[] = [];
  for (const [type, list] of anomaliesByType) {
    list.sort(sortFn);
    const limit = ANOMALY_LIMITS[type] || 0;
    if (limit > 0 && list.length > limit) {
      anomalies.push(...list.slice(0, limit));
    } else {
      anomalies.push(...list);
    }
  }
  // Tri global final
  anomalies.sort(sortFn);
  // Re-numérotation finale
  let finalCounter = 0;
  for (const a of anomalies) {
    a.id = `AN-${String(++finalCounter).padStart(4, "0")}`;
  }

  return { anomalies, summary };
}
