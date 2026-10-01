/**
 * Parseur Excel pour les 2 fichiers sources :
 *  - Verif BG.xlsx : 4 feuilles ("Balance des comptes", "2026", "Feuil1", "Feuil2")
 *  - Brouillard 2026.xlsx : 1 feuille avec toutes les écritures
 *
 * Utilise la librairie `xlsx` (SheetJS) qui fonctionne côté serveur.
 */
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types de données
// ---------------------------------------------------------------------------

export interface VerifEntity {
  name: string;              // ex: "HOLCIM"
  accounts: VerifAccount[];  // comptes 460/461/462/467/512/513
  soldeAppelDeFonds: number; // "Solde Appel de fonds" (total 460+461+462+467)
  soldeTresorerie: number;   // "Solde Trésorerie" (total 512+513)
  ecart: number;             // ligne "Vérification" (doit être 0 si soldé)
  rowIndex: number;          // ligne de la ligne "Vérification" dans la feuille
  // Totaux de la ligne "Solde Appel de fonds" et "Solde Trésorerie"
  totalDebitAppel: number;   // débit total des comptes d'appel de fonds
  totalCreditAppel: number;  // crédit total des comptes d'appel de fonds
  totalDebitTresorerie: number;   // débit total des comptes de trésorerie
  totalCreditTresorerie: number;  // crédit total des comptes de trésorerie
}

export interface VerifAccount {
  compte: string;   // ex: "467110"
  debit: number;
  credit: number;
  solde: number;    // débit - crédit
  category: "APPEL_DE_FONDS" | "HONORAIRES" | "PAIEMENT_PRESTATAIRE" | "TRESORERIE" | "AUTRE";
}

export interface BrouillardEntry {
  codeJournal: string;
  date: Date | null;
  numPiece: string;
  numFacture: string;
  reference: string;
  compteGeneral: string;       // ex: "512110", "580001", "467110"
  compteTiers: string;         // ex: "FONHOLCIM", "TELMA"
  libelle: string;
  dateEcheance: Date | null;
  lettrage: string;
  debit: number;
  credit: number;
}

export interface ExistingTransfer {
  date: Date | null;
  journal: string;
  numPiece: string;
  libelle: string;
  compteTiers: string;
  debit: number;
  credit: number;
  montant: number;     // max(debit, credit)
  sens: "DEBIT" | "CREDIT";
}

export interface ParsedVerifData {
  entities: VerifEntity[];
  rawRows: any[][];       // toutes les lignes brutes de la feuille "2026"
  sheetNames: string[];
  balance: ParsedBalance; // feuille "Balance des comptes"
}

// ---------------------------------------------------------------------------
// Balance des comptes (feuille "Balance des comptes" de Verif BG.xlsx)
// ---------------------------------------------------------------------------

export interface BalanceAccount {
  compte: string;       // ex: "512110"
  intitule: string;     // ex: "Banque BNI HOLCIM"
  mvtDebit: number;     // mouvements débit
  mvtCredit: number;    // mouvements crédit
  soldeDebit: number;   // solde débiteur
  soldeCredit: number;  // solde créditeur
  category: BalanceCategory;
}

export type BalanceCategory =
  | "CAPITAUX"        // classe 1
  | "IMMOBILISATIONS" // classe 2
  | "STOCKS"          // classe 3
  | "TIERS"           // classe 4
  | "FINANCIER"       // classe 5 (dont 512, 513, 580)
  | "PRODUITS"        // classe 7
  | "CHARGES"         // classe 6
  | "AUTRE";

export interface ParsedBalance {
  accounts: BalanceAccount[];
  // Totaux officiels (extraits des lignes "Totaux ...")
  totalBilanDebit: number;
  totalBilanCredit: number;
  totalGestionDebit: number;
  totalGestionCredit: number;
  totalBalanceDebit: number;
  totalBalanceCredit: number;
  // Totaux recalculés (somme des comptes)
  computedDebit: number;
  computedCredit: number;
  computedSoldeDebit: number;
  computedSoldeCredit: number;
  isBalanced: boolean; // totalBalanceDebit ≈ totalBalanceCredit
  periodeDu: string | null;
  periodeAu: string | null;
}

export interface ParsedBrouillardData {
  entries: BrouillardEntry[];
  existingTransfers: ExistingTransfer[]; // écritures 580001 (comptes à comptes existants)
  accounts512: string[];                 // liste distincte des 512 présents
  totalDebit580: number;
  totalCredit580: number;
  sheetNames: string[];
  // Agrégats par compte et par journal (pour la validation croisée)
  byCompte: Map<string, { debit: number; credit: number; count: number }>;
  byJournal: Map<string, { debit: number; credit: number; count: number }>;
  byCompteAndJournal: Map<string, { debit: number; credit: number; count: number }>;
  journalCodes: string[];                // liste distincte des codes journaux
  totalDebit: number;                    // total débit du brouillard
  totalCredit: number;                   // total crédit du brouillard
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function str(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Excel serial number
  if (typeof v === "number") {
    // Excel epoch : 1899-12-30
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Parser Verif BG
// ---------------------------------------------------------------------------

export function parseVerifBG(buffer: ArrayBuffer): ParsedVerifData {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("2026") ? "2026" : wb.SheetNames[1] || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  }) as any[][];

  // Parse aussi la balance des comptes
  const balance = parseBalance(buffer);

  const entities: VerifEntity[] = [];
  let currentEntity: VerifEntity | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c0 = str(row[0]); // nom entité ou ""
    const c1 = str(row[1]); // numéro de compte ou "Solde Appel de fonds" / "Solde Trésorerie" / "Vérification"
    const c2 = num(row[2]); // débit
    const c3 = num(row[3]); // crédit
    const c4 = num(row[4]); // solde

    // Nouveau bloc entité : c0 non vide et c1 vide (en-tête "ENTITÉ | DEBIT | CREDIT | SOLDE")
    if (c0 && (!c1 || c1 === "DEBIT")) {
      if (currentEntity && currentEntity.accounts.length > 0) {
        entities.push(currentEntity);
      }
      currentEntity = {
        name: c0,
        accounts: [],
        soldeAppelDeFonds: 0,
        soldeTresorerie: 0,
        ecart: 0,
        rowIndex: i,
        totalDebitAppel: 0,
        totalCreditAppel: 0,
        totalDebitTresorerie: 0,
        totalCreditTresorerie: 0,
      };
      continue;
    }
    if (!currentEntity) continue;

    // Lignes "Solde Appel de fonds" / "Solde Trésorerie" / "Vérification"
    if (c1 === "Solde Appel de fonds") {
      currentEntity.soldeAppelDeFonds = c4;
      currentEntity.totalDebitAppel = c2;
      currentEntity.totalCreditAppel = c3;
      continue;
    }
    if (c1 === "Solde Trésorerie") {
      currentEntity.soldeTresorerie = c4;
      currentEntity.totalDebitTresorerie = c2;
      currentEntity.totalCreditTresorerie = c3;
      continue;
    }
    if (c1 === "Vérification") {
      currentEntity.ecart = c4;
      currentEntity.rowIndex = i;
      entities.push(currentEntity);
      currentEntity = null;
      continue;
    }
    // Ligne de compte normale (467xxx, 460xxx, 461xxx, 462xxx, 512xxx, 513xxx)
    if (c1 && /^\d{6}$/.test(c1)) {
      const category = categorizeAccount(c1);
      currentEntity.accounts.push({
        compte: c1,
        debit: c2,
        credit: c3,
        solde: c4,
        category,
      });
    }
  }
  // Dernier bloc éventuel
  if (currentEntity && currentEntity.accounts.length > 0 && !entities.includes(currentEntity)) {
    // Si on n'a pas vu de ligne "Vérification", on calcule l'écart
    if (currentEntity.ecart === 0 && (currentEntity.soldeAppelDeFonds !== 0 || currentEntity.soldeTresorerie !== 0)) {
      currentEntity.ecart = currentEntity.soldeAppelDeFonds - currentEntity.soldeTresorerie;
    }
    entities.push(currentEntity);
  }

  return {
    entities,
    rawRows: rows,
    sheetNames: wb.SheetNames,
    balance,
  };
}

function categorizeAccount(compte: string): VerifAccount["category"] {
  if (compte.startsWith("460") || compte.startsWith("461")) return "APPEL_DE_FONDS";
  if (compte.startsWith("462")) return "HONORAIRES";
  if (compte.startsWith("467")) return "PAIEMENT_PRESTATAIRE";
  if (compte.startsWith("512") || compte.startsWith("513")) return "TRESORERIE";
  return "AUTRE";
}

function categorizeBalanceAccount(compte: string): BalanceCategory {
  if (!compte) return "AUTRE";
  const first = compte[0];
  if (first === "1") return "CAPITAUX";
  if (first === "2") return "IMMOBILISATIONS";
  if (first === "3") return "STOCKS";
  if (first === "4") return "TIERS";
  if (first === "5") return "FINANCIER";
  if (first === "6") return "CHARGES";
  if (first === "7") return "PRODUITS";
  return "AUTRE";
}

// ---------------------------------------------------------------------------
// Parser de la Balance des comptes
// ---------------------------------------------------------------------------

/**
 * Parse la feuille "Balance des comptes" de Verif BG.xlsx.
 *
 * Structure observée (Sage 100cloud) :
 *  - Header sur les 11 premières lignes (titre, période, headers colonnes)
 *  - À partir de la ligne 13 : une ligne par compte avec :
 *      col 0 : N° compte (ex: "512110")
 *      col 4 : Intitulé du compte
 *      col 9 : Mouvements Débit
 *      col 11 : Mouvements Crédit
 *      col 14 : Soldes Débit
 *      col 16 : Soldes Crédit
 *  - Lignes "Totaux comptes de bilan", "Totaux comptes de gestion",
 *    "Totaux de la balance" à la fin (intitulé en col 6)
 */
export function parseBalance(buffer: ArrayBuffer): ParsedBalance {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("Balance des comptes")
    ? "Balance des comptes"
    : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  }) as any[][];

  const accounts: BalanceAccount[] = [];
  let periodeDu: string | null = null;
  let periodeAu: string | null = null;
  let totalBilanDebit = 0;
  let totalBilanCredit = 0;
  let totalGestionDebit = 0;
  let totalGestionCredit = 0;
  let totalBalanceDebit = 0;
  let totalBalanceCredit = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c0 = str(row[0]);
    const c2 = str(row[2]);
    const c4 = str(row[4]);
    const c6 = str(row[6]);
    // Colonnes réelles (observées sur le fichier Sage 100cloud) :
    //   col 9  : Mvt Débit
    //   col 12 : Mvt Crédit
    //   col 14 : Solde Débit
    //   col 17 : Solde Crédit
    const c9 = num(row[9]);
    const c12 = num(row[12]);
    const c14 = num(row[14]);
    const c17 = num(row[17]);

    // Période (lignes 2-3, libellé en col 14, valeur en col 15)
    if (c4 === "Période du" || c4.startsWith("Période")) {
      periodeDu = str(row[15]) || str(row[14]);
    }
    if (c4 === "au") {
      periodeAu = str(row[15]) || str(row[14]);
    }

    // Ligne de compte (col 0 = numéro à 6 chiffres)
    if (/^\d{6}$/.test(c0)) {
      accounts.push({
        compte: c0,
        intitule: c2 || c4, // intitulé en col 2 (Sage) ou col 4 (fallback)
        mvtDebit: c9,
        mvtCredit: c12,
        soldeDebit: c14,
        soldeCredit: c17,
        category: categorizeBalanceAccount(c0),
      });
      continue;
    }

    // Lignes de totaux (intitulé en col 6)
    const totalLabel = c6.toLowerCase();
    if (totalLabel.includes("totaux comptes de bilan")) {
      totalBilanDebit = c9;
      totalBilanCredit = c12;
    } else if (totalLabel.includes("totaux comptes de gestion")) {
      totalGestionDebit = c9;
      totalGestionCredit = c12;
    } else if (totalLabel.includes("totaux de la balance")) {
      totalBalanceDebit = c9;
      totalBalanceCredit = c12;
    }
  }

  // Totaux recalculés (somme de tous les comptes)
  const computedDebit = accounts.reduce((s, a) => s + a.mvtDebit, 0);
  const computedCredit = accounts.reduce((s, a) => s + a.mvtCredit, 0);
  const computedSoldeDebit = accounts.reduce((s, a) => s + a.soldeDebit, 0);
  const computedSoldeCredit = accounts.reduce((s, a) => s + a.soldeCredit, 0);

  const isBalanced = Math.abs(totalBalanceDebit - totalBalanceCredit) < 1;

  return {
    accounts,
    totalBilanDebit,
    totalBilanCredit,
    totalGestionDebit,
    totalGestionCredit,
    totalBalanceDebit,
    totalBalanceCredit,
    computedDebit,
    computedCredit,
    computedSoldeDebit,
    computedSoldeCredit,
    isBalanced,
    periodeDu,
    periodeAu,
  };
}

// ---------------------------------------------------------------------------
// Parser Brouillard
// ---------------------------------------------------------------------------

export function parseBrouillard(buffer: ArrayBuffer): ParsedBrouillardData {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  }) as any[][];

  // Header attendu : Code journal | Date | N° pièce | N° facture | Référence |
  //                  N° compte général | N° compte tiers | Libellé écriture |
  //                  Date échéance | Lettrage montant | Débit | Crédit
  const entries: BrouillardEntry[] = [];
  const existingTransfers: ExistingTransfer[] = [];
  const accounts512Set = new Set<string>();
  const journalSet = new Set<string>();
  let totalDebit580 = 0;
  let totalCredit580 = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  // Agrégats : par compte, par journal, par (compte+journal)
  const byCompte = new Map<string, { debit: number; credit: number; count: number }>();
  const byJournal = new Map<string, { debit: number; credit: number; count: number }>();
  const byCompteAndJournal = new Map<string, { debit: number; credit: number; count: number }>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const codeJournal = str(row[0]);
    const date = parseDate(row[1]);
    const numPiece = str(row[2]);
    const numFacture = str(row[3]);
    const reference = str(row[4]);
    const compteGeneral = str(row[5]);
    const compteTiers = str(row[6]);
    const libelle = str(row[7]);
    const dateEcheance = parseDate(row[8]);
    const lettrage = str(row[9]);
    const debit = num(row[10]);
    const credit = num(row[11]);

    if (!codeJournal && !compteGeneral && !libelle) continue;

    const entry: BrouillardEntry = {
      codeJournal,
      date,
      numPiece,
      numFacture,
      reference,
      compteGeneral,
      compteTiers,
      libelle,
      dateEcheance,
      lettrage,
      debit,
      credit,
    };
    entries.push(entry);

    // Agrégats
    totalDebit += debit;
    totalCredit += credit;
    if (compteGeneral) {
      const cur = byCompte.get(compteGeneral) || { debit: 0, credit: 0, count: 0 };
      cur.debit += debit;
      cur.credit += credit;
      cur.count += 1;
      byCompte.set(compteGeneral, cur);
    }
    if (codeJournal) {
      journalSet.add(codeJournal);
      const cur = byJournal.get(codeJournal) || { debit: 0, credit: 0, count: 0 };
      cur.debit += debit;
      cur.credit += credit;
      cur.count += 1;
      byJournal.set(codeJournal, cur);
    }
    if (compteGeneral && codeJournal) {
      const key = `${compteGeneral}|${codeJournal}`;
      const cur = byCompteAndJournal.get(key) || { debit: 0, credit: 0, count: 0 };
      cur.debit += debit;
      cur.credit += credit;
      cur.count += 1;
      byCompteAndJournal.set(key, cur);
    }

    if (compteGeneral.startsWith("512")) {
      accounts512Set.add(compteGeneral);
    }
    if (compteGeneral.startsWith("580")) {
      totalDebit580 += debit;
      totalCredit580 += credit;
      const montant = Math.max(debit, credit);
      if (montant > 0) {
        existingTransfers.push({
          date,
          journal: codeJournal,
          numPiece,
          libelle,
          compteTiers,
          debit,
          credit,
          montant,
          sens: debit > 0 ? "DEBIT" : "CREDIT",
        });
      }
    }
  }

  return {
    entries,
    existingTransfers,
    accounts512: Array.from(accounts512Set).sort(),
    totalDebit580,
    totalCredit580,
    sheetNames: wb.SheetNames,
    byCompte,
    byJournal,
    byCompteAndJournal,
    journalCodes: Array.from(journalSet).sort(),
    totalDebit,
    totalCredit,
  };
}
