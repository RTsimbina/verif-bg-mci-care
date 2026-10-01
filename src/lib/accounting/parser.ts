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
}

export interface ParsedBrouillardData {
  entries: BrouillardEntry[];
  existingTransfers: ExistingTransfer[]; // écritures 580001 (comptes à comptes existants)
  accounts512: string[];                 // liste distincte des 512 présents
  totalDebit580: number;
  totalCredit580: number;
  sheetNames: string[];
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
      };
      continue;
    }
    if (!currentEntity) continue;

    // Lignes "Solde Appel de fonds" / "Solde Trésorerie" / "Vérification"
    if (c1 === "Solde Appel de fonds") {
      currentEntity.soldeAppelDeFonds = c4;
      continue;
    }
    if (c1 === "Solde Trésorerie") {
      currentEntity.soldeTresorerie = c4;
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
  };
}

function categorizeAccount(compte: string): VerifAccount["category"] {
  if (compte.startsWith("460") || compte.startsWith("461")) return "APPEL_DE_FONDS";
  if (compte.startsWith("462")) return "HONORAIRES";
  if (compte.startsWith("467")) return "PAIEMENT_PRESTATAIRE";
  if (compte.startsWith("512") || compte.startsWith("513")) return "TRESORERIE";
  return "AUTRE";
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
  let totalDebit580 = 0;
  let totalCredit580 = 0;

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
  };
}
