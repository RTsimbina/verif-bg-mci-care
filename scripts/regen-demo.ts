/**
 * Régénère le fichier public/demo-result.json à partir des fichiers Excel réels.
 * À exécuter une fois pour mettre à jour la démo avec l'analyse de balance.
 */
import { parseVerifBG, parseBrouillard } from "../src/lib/accounting/parser";
import { analyze } from "../src/lib/accounting/engine";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const verifPath = "/home/z/my-project/upload/Verif BG 30092026 V2.xlsx";
  const brouPath = "/home/z/my-project/upload/Brouillard 2026 30092026.xlsx";

  console.log("Reading files...");
  const verifBuf = fs.readFileSync(verifPath).buffer as ArrayBuffer;
  const brouBuf = fs.readFileSync(brouPath).buffer as ArrayBuffer;

  console.log("Parsing Verif BG (including Balance sheet)...");
  const verif = parseVerifBG(verifBuf);
  console.log(`  → ${verif.entities.length} entities, ${verif.balance.accounts.length} balance accounts`);

  console.log("Parsing Brouillard...");
  const brouillard = parseBrouillard(brouBuf);
  console.log(`  → ${brouillard.entries.length} entries`);

  console.log("Analyzing...");
  const result = analyze(verif, brouillard);

  console.log("\n=== Balance Analysis ===");
  console.log(`Total accounts: ${result.balance.totalAccounts}`);
  console.log(`Total Débit (Sage) : ${result.balance.totalBalanceDebit.toLocaleString("fr-FR")}`);
  console.log(`Total Crédit (Sage): ${result.balance.totalBalanceCredit.toLocaleString("fr-FR")}`);
  console.log(`Écart total        : ${result.balance.ecartTotal.toLocaleString("fr-FR")}`);
  console.log(`Équilibrée         : ${result.balance.isBalanced ? "OUI" : "NON"}`);
  console.log(`Recalcul D-C       : ${result.balance.ecartComputed.toLocaleString("fr-FR")}`);
  console.log(`Coherence Sage     : ${result.balance.coherenceWithSage ? "OUI" : "NON"}`);
  console.log(`\nBy category:`);
  for (const c of result.balance.byCategory) {
    console.log(`  ${c.label}: ${c.count} comptes, D=${c.totalDebit.toLocaleString("fr-FR")}, C=${c.totalCredit.toLocaleString("fr-FR")}`);
  }
  console.log(`\nComparison balance vs brouillard:`);
  const ecartCount = result.balance.comparison.filter((c) => !c.isCoherent).length;
  console.log(`  Total comparés: ${result.balance.comparison.length}`);
  console.log(`  Cohérents     : ${result.balance.comparison.length - ecartCount}`);
  console.log(`  Avec écart    : ${ecartCount}`);
  console.log(`  Top 5 écarts :`);
  for (const c of result.balance.comparison.slice(0, 5)) {
    console.log(`    ${c.compte} ${c.intitule.substring(0, 30).padEnd(30)} écart=${c.ecartSolde.toLocaleString("fr-FR")}`);
  }

  console.log(`\nComptes 512/513: ${result.balance.accounts512.length}`);

  console.log("\nSaving demo-result.json...");
  const outPath = path.join(__dirname, "..", "public", "demo-result.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Saved to: ${outPath}`);
  console.log(`Size: ${fs.statSync(outPath).size.toLocaleString()} bytes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
