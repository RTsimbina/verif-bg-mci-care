/**
 * Règles de gestion des comptes 512 (banques) pour MCI CARE MADAGASCAR.
 *
 * Logique centrale :
 *  - Certaines entités PARTAGENT le même compte 512 (regroupements).
 *  - Certaines entités ont un compte 512 dédié (affectations spécifiques).
 *  - Cas historique SANLAMALLIANZ : AUTOFI a migré de 512100 vers 512501,
 *    COMPAGNIE est resté sur 512100.
 *
 * La règle d'or pour le compte 512 se base sur les 3 DERNIERS CHIFFRES
 * du numéro de compte (xxx).
 */

// ---------------------------------------------------------------------------
// 1. Regroupements par compte 512 partagé (entités lettrées sur le même 512)
//    Chaque sous-tableau = un groupe d'entités qui partagent le même 512.
//    Cas particulier : la famille SANLAM (SANLAM + AUTOFI + COMPAGNIE)
//    bien qu'elles soient sur des 512 différents aujourd'hui, elles sont
//    lettrées historiquement entre elles.
// ---------------------------------------------------------------------------
export const GROUPED_ENTITIES: string[][] = [
  ["PAMF", "EASYTECH"],
  ["INGEDATA", "CAMUSAT", "EVIOSYS", "SONOCO"],
  ["STELARIX", "AITS"],
  ["WELIGHT", "MADAGASCO", "ATSS", "ASS"],
  ["AXIAN UNIVERSITY", "FONDATION AXIAN", "TOM"],
  ["SANKO", "FIRSTIMMO"],
  ["FOUNDEVER", "SMARTONE"],
  ["KIDS ACADEMY", "NACRE SOLUTIONS"],
  ["TANJAKA FOOD", "OMNIVEST"],
  // Famille SANLAM : bien que sur des 512 différents aujourd'hui, ces entités
  // sont lettrées historiquement entre elles. L'appariement intra-famille
  // permet de régulariser les écarts entre 512100 et 512501.
  ["SANLAM", "SANLAMALLIANZ AUTOFI", "SANLAMALLIANZ COMPAGNIE"],
];

// ---------------------------------------------------------------------------
// 2. Affectations spécifiques de comptes 512 (entité -> compte 512 dédié)
// ---------------------------------------------------------------------------
export const SPECIFIC_512: Record<string, string> = {
  JBU: "512300",
  JBS: "512300",
  BOOST: "512300",
  TAMBOHO: "512201",
  STMB: "512201",
  TALYS: "512201",
  "SOCOTA": "512330",
  "LECO": "512330",
  "SOCOTA/LECO": "512330",
  "NACRE DIR": "512800",
  EVASAN: "512140",
  "DHL EXPRESS": "512120",
};

// ---------------------------------------------------------------------------
// 3. Règle d'évolution historique : SANLAMALLIANZ
//    - Avant : AUTOFI + COMPAGNIE sur 512100
//    - Après : AUTOFI sur 512501, COMPAGNIE reste sur 512100
//    On représente cette temporalité par une fonction qui retourne le 512
//    en fonction de l'entité.
// ---------------------------------------------------------------------------
export const SANLAM_HISTORY: Record<string, string> = {
  "SANLAMALLIANZ AUTOFI": "512501",
  "SANLAMALLIANZ COMPAGNIE": "512100",
};

// ---------------------------------------------------------------------------
// 4. Mapping entité -> code journal BNI/BOA/MVO du brouillard
//    (pour identifier la source des écritures dans le brouillard)
//    Construit à partir des observations : journal = BNI<CODE> ou BOA<CODE>
//    où <CODE> est l'abréviation de l'entité.
// ---------------------------------------------------------------------------
export const ENTITY_TO_JOURNAL_SUFFIX: Record<string, string> = {
  HOLCIM: "HOL",
  "DHL INTERNATIONAL": "DHL",
  "DHL EXPRESS": "DHL",
  "DHL GLOBAL FORWARDING": "DGL",
  "DHL PRONET": "DHL",
  MGS: "MGS",
  FSS: "FSS",
  "TELMA SA": "TSA",
  "TELMA MONEY": "TMO",
  EVASAN: "ESA",
  JOVENA: "JOV",
  PAMF: "PAM",
  EASYTECH: "EAS",
  INGEDATA: "ING",
  CAMUSAT: "CAM",
  EVIOSYS: "EVS",
  SONOCO: "SON",
  STELARIX: "STE",
  AITS: "AIT",
  WELIGHT: "WEL",
  MADAGASCO: "MAD",
  ATSS: "ATS",
  ASS: "ASS",
  "AXIAN UNIVERSITY": "AXU",
  "FONDATION AXIAN": "FAX",
  TOM: "TOM",
  SANKO: "SAN",
  FIRSTIMMO: "FIM",
  FOUNDEVER: "FOU",
  SMARTONE: "SMO",
  "KIDS ACADEMY": "KID",
  "NACRE SOLUTIONS": "NAC",
  "TANJAKA FOOD": "TAN",
  OMNIVEST: "OMN",
  JBU: "JBU",
  JBS: "JBS",
  BOOST: "BST",
  TAMBOHO: "TAM",
  STMB: "STM",
  TALYS: "TAL",
  SOCOTA: "SOC",
  LECO: "LEC",
  "NACRE DIR": "NAD",
  "SANLAMALLIANZ AUTOFI": "SLA",
  "SANLAMALLIANZ COMPAGNIE": "SLC",
  EDM: "EDM",
  STAR: "STA",
  "MCI": "MCI",
  "ALLIANZ": "ALL",
  "OIM": "OIM",
  "OIM EXPORT": "OIM",
  CONNECTEO: "CON",
  "MCB": "MCB",
  "SOCOLAIT": "SOL",
  "TEMP": "TEM",
  "MAD COM": "MAD",
  "MADCOM": "MAD",
  "ORANGE MADAGASCAR": "ORA",
  "ORANGE MONEY MADAGASCAR": "OMM",
  "NACRE": "NAC",
  "EASY TECH": "EAS",
  "EASYTECH": "EAS",
  "LECOFRUIT": "LEC",
  "LECO": "LEC",
  "TELMA MONEY": "TMO",
  "TALOUMIS": "TAL",
  "TALYS": "TAL",
  "SANLAM": "SAN",
  "SANLAMALLIANZ AUTOFI": "SLA",
  "SANLAMALLIANZ COMPAGNIE": "SLC",
  "STAR": "STA",
  "BOOST": "BST",
};

/**
 * Résout le compte 512 principal d'une entité.
 * Ordre de priorité :
 *   1. Affectation spécifique (SPECIFIC_512)
 *   2. Cas historique SANLAM (SANLAM_HISTORY)
 *   3. Regroupement (cherche le 512 partagé dans le groupe)
 *   4. Sinon : on ne sait pas -> retourne null (à traiter manuellement)
 *
 * Le paramètre `existingAccounts` (ensemble des 512 réellement présents
 * dans le brouillard) permet de résoudre les regroupements vers un 512
 * qui existe réellement.
 */
export function resolveEntity512(
  entity: string,
  existingAccounts: Set<string>
): string | null {
  // 1. Affectation spécifique
  if (SPECIFIC_512[entity]) {
    return SPECIFIC_512[entity];
  }
  // 2. Cas SANLAM
  if (SANLAM_HISTORY[entity]) {
    return SANLAM_HISTORY[entity];
  }
  // 3. Regroupement
  for (const group of GROUPED_ENTITIES) {
    if (group.some((e) => e.toUpperCase() === entity.toUpperCase())) {
      // Tous les membres du groupe partagent le même 512.
      // On cherche le 512 dans existingAccounts qui matche le suffixe
      // typique de l'entité. Si non trouvé, on retourne le premier
      // 512 du groupe trouvé dans existingAccounts.
      // Pour simplifier : on retourne le 1er 512 de existingAccounts
      // dont les 3 derniers chiffres correspondent à un membre du groupe.
      // En pratique, le regroupement signifie : les membres du groupe
      // sont lettrés entre eux ; le 512 exact est déterminé par le
      // suffixe du journal/code de l'entité dans le brouillard.
      // Ici on retourne null pour signaler qu'on doit déterminer le 512
      // dynamiquement (à partir des journaux BNIxxx du brouillard).
      return null;
    }
  }
  // 4. Non déterminé
  return null;
}

/**
 * Retourne le groupe de regroupement d'une entité (ou null si pas de groupe).
 */
export function getEntityGroup(entity: string): string[] | null {
  const upper = entity.toUpperCase();
  for (const group of GROUPED_ENTITIES) {
    if (group.some((e) => e.toUpperCase() === upper)) {
      return group;
    }
  }
  return null;
}

/**
 * Détermine si deux entités partagent le même compte 512.
 */
export function shareSame512(a: string, b: string): boolean {
  if (a.toUpperCase() === b.toUpperCase()) return true;
  const g = getEntityGroup(a);
  if (g && g.some((e) => e.toUpperCase() === b.toUpperCase())) return true;
  // Cas spécifique : même 512 dédié
  if (SPECIFIC_512[a] && SPECIFIC_512[a] === SPECIFIC_512[b]) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 5. Types d'opérations à détecter
//    - APPEL_DE_FONDS : comptes 460xxx
//    - PAIEMENT_PRESTATAIRE : comptes 467xxx (paiement facture fournisseur)
//    - HONORAIRES : comptes 462xxx
// ---------------------------------------------------------------------------
export type OperationType =
  | "APPEL_DE_FONDS"
  | "PAIEMENT_PRESTATAIRE"
  | "HONORAIRES"
  | "AUTRE";

export function detectOperationType(compte: string): OperationType {
  const c = (compte || "").trim();
  if (c.startsWith("460")) return "APPEL_DE_FONDS";
  if (c.startsWith("461")) return "APPEL_DE_FONDS";
  if (c.startsWith("462")) return "HONORAIRES";
  if (c.startsWith("467")) return "PAIEMENT_PRESTATAIRE";
  return "AUTRE";
}

export const OPERATION_LABELS: Record<OperationType, string> = {
  APPEL_DE_FONDS: "Appel de fonds",
  PAIEMENT_PRESTATAIRE: "Paiement prestataire",
  HONORAIRES: "Honoraires",
  AUTRE: "Autre",
};

// ---------------------------------------------------------------------------
// 6. Mapping entité -> codes journaux du brouillard
//    Les journaux du brouillard suivent la convention :
//      BNI<suffix>  : journal Banque BNI
//      BOA<suffix>  : journal Banque BOA
//      MVO<suffix>  : journal Mobile Money (Mvola)
//      MVO<MCI>      : journal MCI central
//    Pour une entité donnée, on retourne la liste de tous les codes journaux
//    susceptibles de contenir ses écritures (préfixe = suffix d'entité).
// ---------------------------------------------------------------------------

const JOURNAL_PREFIXES = ["BNI", "BOA", "MVO"];

/**
 * Retourne tous les codes journaux possibles pour une entité.
 * Exemples pour "HOLCIM" : ["BNIHOL", "BOAHOL", "MVOHOL", "BNISAN" (via mapping)]
 *
 * Pour les entités avec un suffixe à 3 lettres, on génère simplement les
 * 3 préfixes BNI/BOA/MVO + suffixe. Pour les entités dont le suffixe est
 * plus long ou différent, on fait un match case-insensitive.
 */
export function getEntityJournalCodes(
  entity: string,
  availableJournals: string[] = []
): string[] {
  const suffix = ENTITY_TO_JOURNAL_SUFFIX[entity.toUpperCase()];
  if (!suffix) return [];
  const upper = suffix.toUpperCase();
  const candidates = JOURNAL_PREFIXES.map((p) => p + upper);
  if (availableJournals.length === 0) {
    return candidates;
  }
  // Filtrer pour ne garder que les journaux réellement présents
  const available = new Set(availableJournals.map((j) => j.toUpperCase()));
  return candidates.filter((c) => available.has(c.toUpperCase()));
}

/**
 * Détermine si un code journal appartient à une entité donnée.
 * Exemple : journalBelongsToEntity("BOAHOL", "HOLCIM") -> true
 */
export function journalBelongsToEntity(
  journal: string,
  entity: string
): boolean {
  if (!journal || !entity) return false;
  const suffix = ENTITY_TO_JOURNAL_SUFFIX[entity.toUpperCase()];
  if (!suffix) return false;
  const j = journal.toUpperCase();
  const s = suffix.toUpperCase();
  // Convention : BNI<suffix>, BOA<suffix>, MVO<suffix>
  return (
    j === "BNI" + s ||
    j === "BOA" + s ||
    j === "MVO" + s ||
    j.endsWith(s) // fallback : suffix en fin de journal
  );
}

/**
 * Devine l'entité associée à un code journal du brouillard.
 * Retourne la première entité dont le suffixe matche, ou null.
 */
export function guessEntityFromJournal(journal: string): string | null {
  if (!journal) return null;
  const j = journal.toUpperCase();
  for (const [entity, suffix] of Object.entries(ENTITY_TO_JOURNAL_SUFFIX)) {
    const s = suffix.toUpperCase();
    if (j === "BNI" + s || j === "BOA" + s || j === "MVO" + s || j.endsWith(s)) {
      return entity;
    }
  }
  return null;
}
