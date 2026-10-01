/**
 * Moteur d'analyse comptable.
 *
 * Étapes :
 *  1. Calcule l'écart de chaque entité Verif (solde Appel de fonds - solde Trésorerie).
 *  2. Détecte le type d'opérations dans le brouillard (appels de fonds / prestataires / honoraires).
 *  3. Identifie les écritures de transfert 580001 déjà existantes dans le brouillard.
 *  4. Génère les écritures de transfert 580001 manquantes pour soldre les écarts,
 *     en respectant les regroupements de comptes 512.
 *  5. Marque chaque opération proposée : "à créer", "déjà passée", "à traiter manuellement".
 */
import {
  VerifEntity,
  ParsedVerifData,
  ParsedBrouillardData,
  BrouillardEntry,
  ExistingTransfer,
} from "./parser";
import {
  GROUPED_ENTITIES,
  SPECIFIC_512,
  SANLAM_HISTORY,
  ENTITY_TO_JOURNAL_SUFFIX,
  detectOperationType,
  OPERATION_LABELS,
  OperationType,
  getEntityGroup,
  shareSame512,
} from "./rules";

// ---------------------------------------------------------------------------
// Types de résultats
// ---------------------------------------------------------------------------

export interface EntityAnalysis {
  name: string;
  soldeAppelDeFonds: number;
  soldeTresorerie: number;
  ecart: number;
  ecartAbsolu: number;
  isSolded: boolean;
  group512: string[];             // entités du même groupe 512
  resolved512: string | null;     // 512 dédié (si SPECIFIC ou SANLAM)
  hasEcart: boolean;
  severity: "OK" | "MINEUR" | "MAJEUR";
}

export interface OperationSummary {
  type: OperationType;
  label: string;
  count: number;
  totalDebit: number;
  totalCredit: number;
  solde: number;
}

export interface ProposedTransfer {
  id: string;
  dateSuggestion: string;       // ISO date suggestion (date du jour)
  entityFrom: string;           // entité qui "envoie" (son 512 est crédité)
  entityTo: string;             // entité qui "reçoit" (son 512 est débité)
  compteFrom: string;           // 512xxx à créditer
  compteTo: string;             // 512xxx à débiter
  montant: number;
  libelle: string;
  status: "A_CREER" | "DEJA_PASSEE" | "MANUEL";
  matchedExisting?: ExistingTransfer;
  ecartFromBefore: number;
  ecartToBefore: number;
}

export interface AnalysisResult {
  generatedAt: string;
  verif: {
    sheetNames: string[];
    entityCount: number;
    entities: EntityAnalysis[];
    soldedCount: number;
    ecartsCount: number;
    totalEcartAbsolu: number;
  };
  brouillard: {
    sheetNames: string[];
    totalEntries: number;
    accounts512: string[];
    totalDebit580: number;
    totalCredit580: number;
    existingTransfersCount: number;
    operationsByType: OperationSummary[];
  };
  transfers: ProposedTransfer[];
  transferStats: {
    total: number;
    aCreer: number;
    dejaPassee: number;
    manuel: number;
    montantTotal: number;
  };
  unmatchedEcarts: EntityAnalysis[]; // écarts qu'on n'a pas pu apparier
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function approxEqual(a: number, b: number, tolerance = 1): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Devine le compte 512 principal d'une entité en cherchant dans le brouillard
 * le journal BNI<suffix> ou BOA<suffix> correspondant, puis en regardant
 * les comptes 512 mouvementés par ce journal.
 */
function guessEntity512FromBrouillard(
  entity: string,
  brouillard: ParsedBrouillardData
): string | null {
  // 1. Affectation spécifique
  if (SPECIFIC_512[entity]) return SPECIFIC_512[entity];
  // 2. Cas SANLAM
  if (SANLAM_HISTORY[entity]) return SANLAM_HISTORY[entity];
  // 3. Devine via journal
  const suffix = ENTITY_TO_JOURNAL_SUFFIX[entity.toUpperCase()] || "";
  if (!suffix) return null;
  // Cherche les journaux qui contiennent le suffixe (ex: "BNISAN" pour SANKO)
  const journalCandidates = new Set<string>();
  for (const e of brouillard.entries) {
    if (
      e.codeJournal &&
      e.codeJournal.toUpperCase().includes(suffix.toUpperCase()) &&
      e.compteGeneral.startsWith("512")
    ) {
      journalCandidates.add(e.codeJournal);
    }
  }
  // Pour chaque journal candidat, trouve le 512 le plus fréquent
  const compteCounter: Record<string, number> = {};
  for (const e of brouillard.entries) {
    if (
      journalCandidates.has(e.codeJournal) &&
      e.compteGeneral.startsWith("512")
    ) {
      compteCounter[e.compteGeneral] = (compteCounter[e.compteGeneral] || 0) + 1;
    }
  }
  const sorted = Object.entries(compteCounter).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

// ---------------------------------------------------------------------------
// Analyse principale
// ---------------------------------------------------------------------------

export function analyze(
  verif: ParsedVerifData,
  brouillard: ParsedBrouillardData
): AnalysisResult {
  // 1. Analyse des entités Verif
  const entities: EntityAnalysis[] = verif.entities.map((e) => {
    const ecart = round(e.ecart);
    const ecartAbsolu = Math.abs(ecart);
    const isSolded = ecartAbsolu < 1;
    const resolved512 = SPECIFIC_512[e.name] || SANLAM_HISTORY[e.name] || null;
    const group512 = getEntityGroup(e.name) || [];
    let severity: "OK" | "MINEUR" | "MAJEUR" = "OK";
    if (!isSolded) {
      severity = ecartAbsolu > 1_000_000 ? "MAJEUR" : "MINEUR";
    }
    return {
      name: e.name,
      soldeAppelDeFonds: round(e.soldeAppelDeFonds),
      soldeTresorerie: round(e.soldeTresorerie),
      ecart,
      ecartAbsolu,
      isSolded,
      group512,
      resolved512,
      hasEcart: !isSolded,
      severity,
    };
  });

  const soldedCount = entities.filter((e) => e.isSolded).length;
  const ecartsEntities = entities.filter((e) => !e.isSolded);
  const totalEcartAbsolu = round(
    ecartsEntities.reduce((s, e) => s + e.ecartAbsolu, 0)
  );

  // 2. Résumé des opérations par type (à partir du brouillard)
  const opStats: Record<OperationType, OperationSummary> = {
    APPEL_DE_FONDS: { type: "APPEL_DE_FONDS", label: OPERATION_LABELS.APPEL_DE_FONDS, count: 0, totalDebit: 0, totalCredit: 0, solde: 0 },
    PAIEMENT_PRESTATAIRE: { type: "PAIEMENT_PRESTATAIRE", label: OPERATION_LABELS.PAIEMENT_PRESTATAIRE, count: 0, totalDebit: 0, totalCredit: 0, solde: 0 },
    HONORAIRES: { type: "HONORAIRES", label: OPERATION_LABELS.HONORAIRES, count: 0, totalDebit: 0, totalCredit: 0, solde: 0 },
    AUTRE: { type: "AUTRE", label: OPERATION_LABELS.AUTRE, count: 0, totalDebit: 0, totalCredit: 0, solde: 0 },
  };
  for (const e of brouillard.entries) {
    const type = detectOperationType(e.compteGeneral);
    opStats[type].count++;
    opStats[type].totalDebit += e.debit;
    opStats[type].totalCredit += e.credit;
  }
  for (const k of Object.keys(opStats) as OperationType[]) {
    opStats[k].totalDebit = round(opStats[k].totalDebit);
    opStats[k].totalCredit = round(opStats[k].totalCredit);
    opStats[k].solde = round(opStats[k].totalDebit - opStats[k].totalCredit);
  }

  // 3. Génération des écritures de transfert 580001
  const transfers: ProposedTransfer[] = [];
  const unmatched: EntityAnalysis[] = [];

  // Stratégie d'appariement :
  //  Pour chaque entité en écart, on cherche une entité "partenaire"
  //  (même groupe 512, ou 512 dédié identique) avec l'écart opposé.
  //  Si on trouve un partenaire dont l'écart est de signe opposé et
  //  de montant proche (au seuil de tolérance), on génère un transfert.
  //
  //  Si le montant ne correspond pas exactement, on apparie partiellement
  //  (montant min(|écart1|, |écart2|)) et on garde le reste pour un
  //  prochain partenaire ou pour traitement manuel.
  //
  //  On marque "DEJA_PASSEE" si on trouve une écriture 580001 existante
  //  dont le montant correspond (à 1 MGA près) et dont le libellé mentionne
  //  les 2 entités ou leurs codes journaux.

  // Pour le matching avec les transferts existants, on indexe par montant
  const existingByAmount = new Map<number, ExistingTransfer[]>();
  for (const t of brouillard.existingTransfers) {
    const key = Math.round(t.montant);
    if (!existingByAmount.has(key)) existingByAmount.set(key, []);
    existingByAmount.get(key)!.push(t);
  }

  // On travaille sur une copie mutable des écarts
  const ecarts = ecartsEntities.map((e) => ({ ...e, remaining: e.ecart }));

  // Appariement intra-groupe
  for (const group of GROUPED_ENTITIES) {
    const membersInEcart = ecarts.filter(
      (e) =>
        e.remaining !== 0 &&
        group.some((g) => g.toUpperCase() === e.name.toUpperCase())
    );
    // Apparie les positifs avec les négatifs
    const positives = membersInEcart.filter((e) => e.remaining > 0);
    const negatives = membersInEcart.filter((e) => e.remaining < 0);
    for (const pos of positives) {
      for (const neg of negatives) {
        if (pos.remaining <= 0) break;
        if (neg.remaining >= 0) continue;
        const montant = Math.min(pos.remaining, -neg.remaining);
        if (montant < 1) continue;
        const compteFrom = guessEntity512FromBrouillard(neg.name, brouillard) || neg.resolved512 || "512000";
        const compteTo = guessEntity512FromBrouillard(pos.name, brouillard) || pos.resolved512 || "512000";
        // Vérifie si déjà passé
        const match = findExistingTransfer(
          existingByAmount,
          montant,
          pos.name,
          neg.name
        );
        transfers.push({
          id: `TR-${transfers.length + 1}`,
          dateSuggestion: new Date().toISOString().slice(0, 10),
          entityFrom: neg.name,
          entityTo: pos.name,
          compteFrom,
          compteTo,
          montant: round(montant),
          libelle: `COMPTE A COMPTE ${neg.name.toUpperCase()} / ${pos.name.toUpperCase()} - REGULARISATION ECART VERIF BG`,
          status: match ? "DEJA_PASSEE" : "A_CREER",
          matchedExisting: match || undefined,
          ecartFromBefore: round(neg.ecart),
          ecartToBefore: round(pos.ecart),
        });
        pos.remaining = round(pos.remaining - montant);
        neg.remaining = round(neg.remaining + montant);
        if (match) {
          // Retire le match de l'index pour ne pas le re-matcher
          const arr = existingByAmount.get(Math.round(match.montant));
          if (arr) {
            const idx = arr.indexOf(match);
            if (idx >= 0) arr.splice(idx, 1);
          }
        }
      }
    }
  }

  // Appariement inter-groupes (entités sans groupe mais avec 512 dédié identique)
  // ou entités restantes
  const remaining = ecarts.filter((e) => Math.abs(e.remaining) >= 1);
  // Pour les écarts restants, on essaie d'apparier par 512 dédié identique
  for (const a of remaining) {
    if (Math.abs(a.remaining) < 1) continue;
    for (const b of remaining) {
      if (a.name === b.name) continue;
      if (Math.abs(b.remaining) < 1) continue;
      if ((a.remaining > 0 && b.remaining > 0) || (a.remaining < 0 && b.remaining < 0)) continue;
      // Vérifie partage de 512
      if (!shareSame512(a.name, b.name) && a.resolved512 !== b.resolved512) continue;
      const montant = Math.min(Math.abs(a.remaining), Math.abs(b.remaining));
      if (montant < 1) continue;
      const sender = a.remaining < 0 ? a : b;
      const receiver = a.remaining < 0 ? b : a;
      const compteFrom = guessEntity512FromBrouillard(sender.name, brouillard) || sender.resolved512 || "512000";
      const compteTo = guessEntity512FromBrouillard(receiver.name, brouillard) || receiver.resolved512 || "512000";
      const match = findExistingTransfer(existingByAmount, montant, receiver.name, sender.name);
      transfers.push({
        id: `TR-${transfers.length + 1}`,
        dateSuggestion: new Date().toISOString().slice(0, 10),
        entityFrom: sender.name,
        entityTo: receiver.name,
        compteFrom,
        compteTo,
        montant: round(montant),
        libelle: `COMPTE A COMPTE ${sender.name.toUpperCase()} / ${receiver.name.toUpperCase()} - REGULARISATION`,
        status: match ? "DEJA_PASSEE" : "A_CREER",
        matchedExisting: match || undefined,
        ecartFromBefore: round(sender.ecart),
        ecartToBefore: round(receiver.ecart),
      });
      sender.remaining = round(sender.remaining + montant);
      receiver.remaining = round(receiver.remaining - montant);
      if (match) {
        const arr = existingByAmount.get(Math.round(match.montant));
        if (arr) {
          const idx = arr.indexOf(match);
          if (idx >= 0) arr.splice(idx, 1);
        }
      }
    }
  }

  // Entités restantes non appariées -> manuel
  for (const e of ecarts) {
    if (Math.abs(e.remaining) >= 1) {
      unmatched.push({
        ...e,
        ecart: e.remaining,
        ecartAbsolu: Math.abs(e.remaining),
        severity: Math.abs(e.remaining) > 1_000_000 ? "MAJEUR" : "MINEUR",
      });
    }
  }

  // Si aucune entité en écart n'a pu être appariée mais qu'il reste des
  // transferts existants non matchés, on les affiche quand même pour info.
  // (optionnel : on les ignore pour l'instant)

  const transferStats = {
    total: transfers.length,
    aCreer: transfers.filter((t) => t.status === "A_CREER").length,
    dejaPassee: transfers.filter((t) => t.status === "DEJA_PASSEE").length,
    manuel: transfers.filter((t) => t.status === "MANUEL").length,
    montantTotal: round(
      transfers.filter((t) => t.status === "A_CREER").reduce((s, t) => s + t.montant, 0)
    ),
  };

  return {
    generatedAt: new Date().toISOString(),
    verif: {
      sheetNames: verif.sheetNames,
      entityCount: entities.length,
      entities,
      soldedCount,
      ecartsCount: ecartsEntities.length,
      totalEcartAbsolu,
    },
    brouillard: {
      sheetNames: brouillard.sheetNames,
      totalEntries: brouillard.entries.length,
      accounts512: brouillard.accounts512,
      totalDebit580: round(brouillard.totalDebit580),
      totalCredit580: round(brouillard.totalCredit580),
      existingTransfersCount: brouillard.existingTransfers.length,
      operationsByType: Object.values(opStats),
    },
    transfers,
    transferStats,
    unmatchedEcarts: unmatched,
  };
}

function findExistingTransfer(
  byAmount: Map<number, ExistingTransfer[]>,
  montant: number,
  entityA: string,
  entityB: string
): ExistingTransfer | undefined {
  const key = Math.round(montant);
  const arr = byAmount.get(key);
  if (!arr || arr.length === 0) return undefined;
  // Cherche un transfert dont le libellé mentionne les 2 entités (ou leurs codes journaux)
  for (const t of arr) {
    const lib = t.libelle.toUpperCase();
    const a = entityA.toUpperCase();
    const b = entityB.toUpperCase();
    // Cherche aussi les abréviations courantes
    const aAlt = a.replace(/\s+/g, "");
    const bAlt = b.replace(/\s+/g, "");
    if (
      (lib.includes(a) || lib.includes(aAlt)) &&
      (lib.includes(b) || lib.includes(bAlt))
    ) {
      return t;
    }
  }
  // Si pas de match par libellé, retourne le 1er du montant
  return arr[0];
}
