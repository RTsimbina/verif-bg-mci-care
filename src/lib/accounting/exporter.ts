/**
 * Génération du fichier Excel d'export :
 *  - Feuille 1 : "Analyse" — résumé des écarts par entité
 *  - Feuille 2 : "Transferts 580001" — écritures de transfert proposées
 *  - Feuille 3 : "Opérations détectées" — résumé des 3 types d'opérations
 *  - Feuille 4 : "Comptes 512" — liste des comptes 512 présents dans le brouillard
 */
import * as XLSX from "xlsx";
import { AnalysisResult } from "./engine";

export function buildExportWorkbook(result: AnalysisResult): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // --- Feuille 1 : Analyse des écarts ---
  const analyseRows: any[][] = [
    ["ANALYSE DES ÉCARTS — Vérification BG"],
    [`Généré le : ${new Date(result.generatedAt).toLocaleString("fr-FR")}`],
    [],
    [
      "Entité",
      "Solde Appel de fonds (D)",
      "Solde Trésorerie (D)",
      "Écart",
      "Écart absolu",
      "Soldé ?",
      "Sévérité",
      "Compte 512 dédié",
      "Groupe 512",
    ],
  ];
  for (const e of result.verif.entities) {
    analyseRows.push([
      e.name,
      e.soldeAppelDeFonds,
      e.soldeTresorerie,
      e.ecart,
      e.ecartAbsolu,
      e.isSolded ? "OUI" : "NON",
      e.severity,
      e.resolved512 || "—",
      e.group512.length > 0 ? e.group512.join(", ") : "—",
    ]);
  }
  analyseRows.push([]);
  analyseRows.push([
    "TOTAUX",
    "",
    "",
    "",
    result.verif.totalEcartAbsolu,
    `${result.verif.soldedCount}/${result.verif.entityCount}`,
    "",
    "",
    "",
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet(analyseRows);
  ws1["!cols"] = [
    { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Analyse");

  // --- Feuille 2 : Transferts 580001 ---
  const transferRows: any[][] = [
    ["ÉCRITURES DE TRANSFERT — Compte 580001 (Comptes à comptes)"],
    [],
    [
      "Date",
      "N° pièce",
      "N° compte",
      "N° compte tiers",
      "Libellé écriture",
      "Débit",
      "Crédit",
      "Sens",
      "Entité émettrice",
      "Entité réceptrice",
      "Statut",
      "Écart émetteur (avant)",
      "Écart récepteur (avant)",
      "Transfert existant (réf.)",
    ],
  ];
  let idx = 1;
  for (const t of result.transfers) {
    const numPiece = `TR-${String(idx).padStart(4, "0")}`;
    // Ligne 1 : Débit 580001 / Crédit 512xxx (compteFrom)
    transferRows.push([
      t.dateSuggestion,
      numPiece,
      "580001",
      "",
      t.libelle,
      t.montant,
      "",
      "DEBIT 580001",
      t.entityFrom,
      t.entityTo,
      t.status,
      t.ecartFromBefore,
      t.ecartToBefore,
      t.matchedExisting ? `${t.matchedExisting.journal} ${t.matchedExisting.numPiece} ${t.matchedExisting.date ? new Date(t.matchedExisting.date).toLocaleDateString("fr-FR") : ""}` : "",
    ]);
    transferRows.push([
      t.dateSuggestion,
      numPiece,
      t.compteFrom,
      "",
      t.libelle,
      "",
      t.montant,
      "CREDIT " + t.compteFrom,
      t.entityFrom,
      t.entityTo,
      t.status,
      "",
      "",
      "",
    ]);
    // Ligne 3 : Débit 512xxx (compteTo) / Crédit 580001
    transferRows.push([
      t.dateSuggestion,
      numPiece,
      t.compteTo,
      "",
      t.libelle,
      t.montant,
      "",
      "DEBIT " + t.compteTo,
      t.entityFrom,
      t.entityTo,
      t.status,
      "",
      "",
      "",
    ]);
    transferRows.push([
      t.dateSuggestion,
      numPiece,
      "580001",
      "",
      t.libelle,
      "",
      t.montant,
      "CREDIT 580001",
      t.entityFrom,
      t.entityTo,
      t.status,
      "",
      "",
      "",
    ]);
    transferRows.push([]); // ligne vide entre transferts
    idx++;
  }
  // Totaux
  transferRows.push([]);
  transferRows.push([
    "RÉCAPITULATIF",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    `À créer : ${result.transferStats.aCreer}`,
    `Déjà passées : ${result.transferStats.dejaPassee}`,
    `Manuel : ${result.transferStats.manuel}`,
    `Montant total à créer : ${result.transferStats.montantTotal}`,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet(transferRows);
  ws2["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 60 },
    { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Transferts 580001");

  // --- Feuille 3 : Opérations détectées ---
  const opRows: any[][] = [
    ["OPÉRATIONS DÉTECTÉES DANS LE BROUILLARD"],
    [],
    [
      "Type d'opération",
      "Nombre d'écritures",
      "Total Débit",
      "Total Crédit",
      "Solde (D-C)",
    ],
  ];
  for (const op of result.brouillard.operationsByType) {
    opRows.push([op.label, op.count, op.totalDebit, op.totalCredit, op.solde]);
  }
  opRows.push([]);
  opRows.push([
    "TOTAUX",
    result.brouillard.operationsByType.reduce((s, o) => s + o.count, 0),
    result.brouillard.operationsByType.reduce((s, o) => s + o.totalDebit, 0),
    result.brouillard.operationsByType.reduce((s, o) => s + o.totalCredit, 0),
    result.brouillard.operationsByType.reduce((s, o) => s + o.solde, 0),
  ]);
  opRows.push([]);
  opRows.push([
    "Compte 580001 (compte à compte) — existant dans le brouillard :",
    "",
    result.brouillard.totalDebit580,
    result.brouillard.totalCredit580,
    Math.round((result.brouillard.totalDebit580 - result.brouillard.totalCredit580) * 100) / 100,
  ]);
  opRows.push(["Nombre d'écritures 580001 existantes :", result.brouillard.existingTransfersCount, "", "", ""]);
  const ws3 = XLSX.utils.aoa_to_sheet(opRows);
  ws3["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Opérations détectées");

  // --- Feuille 4 : Comptes 512 ---
  const c512Rows: any[][] = [
    ["COMPTES 512 PRÉSENTS DANS LE BROUILLARD"],
    [],
    ["N° compte 512"],
  ];
  for (const c of result.brouillard.accounts512) {
    c512Rows.push([c]);
  }
  const ws4 = XLSX.utils.aoa_to_sheet(c512Rows);
  ws4["!cols"] = [{ wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Comptes 512");

  // --- Feuille 5 : Écarts non appariés (manuel) ---
  if (result.unmatchedEcarts.length > 0) {
    const manuelRows: any[][] = [
      ["ÉCARTS NON APPARIÉS — À TRAITER MANUELLEMENT"],
      [],
      ["Entité", "Écart restant", "Écart absolu", "Sévérité", "Compte 512 dédié", "Groupe 512"],
    ];
    for (const e of result.unmatchedEcarts) {
      manuelRows.push([
        e.name,
        e.ecart,
        e.ecartAbsolu,
        e.severity,
        e.resolved512 || "—",
        e.group512.length > 0 ? e.group512.join(", ") : "—",
      ]);
    }
    const ws5 = XLSX.utils.aoa_to_sheet(manuelRows);
    ws5["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws5, "Écarts manuels");
  }

  // --- Feuille 6 : Balance des comptes (équilibre + comparaison) ---
  if (result.balance) {
    const bal = result.balance;
    const balRows: any[][] = [
      ["BALANCE DES COMPTES — Équilibre et comparaison avec le brouillard"],
      [`Période : ${bal.periodeDu || "?"} → ${bal.periodeAu || "?"}`],
      [`Nombre de comptes : ${bal.totalAccounts}`],
      [],
      ["ÉQUILIBRE OFFICIEL (totaux Sage)"],
      ["", "Total Débit", "Total Crédit", "Écart", "Statut"],
      [
        "Comptes de bilan (classes 1-5)",
        bal.totalBilanDebit,
        bal.totalBilanCredit,
        Math.round((bal.totalBilanDebit - bal.totalBilanCredit) * 100) / 100,
        Math.abs(bal.totalBilanDebit - bal.totalBilanCredit) < 1 ? "Équilibré" : "DÉSÉQUILIBRE",
      ],
      [
        "Comptes de gestion (classes 6-7)",
        bal.totalGestionDebit,
        bal.totalGestionCredit,
        Math.round((bal.totalGestionDebit - bal.totalGestionCredit) * 100) / 100,
        Math.abs(bal.totalGestionDebit - bal.totalGestionCredit) < 1 ? "Équilibré" : "DÉSÉQUILIBRE",
      ],
      [
        "TOTAUX DE LA BALANCE",
        bal.totalBalanceDebit,
        bal.totalBalanceCredit,
        bal.ecartTotal,
        bal.isBalanced ? "ÉQUILIBRÉE" : "DÉSÉQUILIBRÉE",
      ],
      [],
      ["RECALCUL (somme des comptes)"],
      [
        "Total mouvements",
        bal.computedDebit,
        bal.computedCredit,
        bal.ecartComputed,
        Math.abs(bal.ecartComputed) < 1 ? "OK" : "ÉCART",
      ],
      [
        "Total soldes",
        bal.computedSoldeDebit,
        bal.computedSoldeCredit,
        bal.ecartSoldes,
        Math.abs(bal.ecartSoldes) < 1 ? "OK" : "ÉCART",
      ],
      [
        "Cohérence recalcul vs Sage",
        "",
        "",
        "",
        bal.coherenceWithSage ? "COHÉRENT" : "ÉCART",
      ],
      [],
      ["SYNTHÈSE PAR CATÉGORIE"],
      ["Catégorie", "Nombre de comptes", "Total Débit", "Total Crédit", "Solde Débiteur", "Solde Créditeur"],
    ];
    for (const c of bal.byCategory) {
      balRows.push([c.label, c.count, c.totalDebit, c.totalCredit, c.soldeDebit, c.soldeCredit]);
    }
    balRows.push([]);
    balRows.push(["COMPARAISON BALANCE VS BROUILLARD (triée par écart absolu décroissant)"]);
    balRows.push([
      "N° compte",
      "Intitulé",
      "Balance Débit",
      "Balance Crédit",
      "Brouillard Débit",
      "Brouillard Crédit",
      "Écart Solde",
      "Cohérent ?",
    ]);
    // Top 100 écarts (pour limiter la taille du fichier)
    const top100 = bal.comparison.slice(0, 100);
    for (const c of top100) {
      balRows.push([
        c.compte,
        c.intitule,
        c.balanceDebit,
        c.balanceCredit,
        c.brouillardDebit,
        c.brouillardCredit,
        c.ecartSolde,
        c.isCoherent ? "OUI" : "NON",
      ]);
    }
    if (bal.comparison.length > 100) {
      balRows.push([`... et ${bal.comparison.length - 100} autres comptes (voir l'interface pour la liste complète)`]);
    }
    const ws6 = XLSX.utils.aoa_to_sheet(balRows);
    ws6["!cols"] = [
      { wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws6, "Balance");
  }

  // Write to buffer
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return arr;
}
