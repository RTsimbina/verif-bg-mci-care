#!/usr/bin/env python3
"""Vérifie les 4 contrôles en lisant le demo-result.json régénéré."""
import json

with open("/home/z/my-project/public/demo-result.json") as f:
    data = json.load(f)

v = data["verif"]
print("=" * 70)
print("VÉRIFICATION DES 4 CONTRÔLES")
print("=" * 70)
print(f"Total entités : {v['entityCount']}")
print(f"Soldées       : {v['soldedCount']}")
print(f"Avec écart    : {v['ecartsCount']}")
print()
print("Contrôles par catégorie :")
print(f"  1. Équilibre D=C       : {v['equilibreDcOkCount']}/{v['entityCount']}")
print(f"  2. Cohérence Balance   : {v['balanceOkCount']}/{v['entityCount']}")
print(f"  3. Cohérence Brouillard: {v['brouillardOkCount']}/{v['entityCount']}")
print(f"  4. Code journal valide : {v['journalOkCount']}/{v['entityCount']}")
print()
print("Statut global :")
print(f"  OK (4/4)   : {v['globalOkCount']}")
print(f"  WARN (2-3) : {v['globalWarnCount']}")
print(f"  ERROR (0-1): {v['globalErrorCount']}")

print()
print("=" * 70)
print("DÉTAIL DES 10 PREMIÈRES ENTITÉS")
print("=" * 70)
for e in v["entities"][:10]:
    print(f"\n{e['name']:<25} global={e['globalStatus']:<5} checks={e['checksPassed']}/4")
    print(f"  1. D=C       : {'OK' if e['equilibreDcOk'] else 'ECART ' + str(e['equilibreDcEcart'])}")
    print(f"     Total D={e['totalDebit']:,.0f}  C={e['totalCredit']:,.0f}")
    print(f"  2. Balance   : {e['balanceCoherentCount']}/{e['balanceByAccount']['length'] if isinstance(e['balanceByAccount'], dict) else len(e['balanceByAccount'])} cohérents"
          + (f"  (max écart={e['balanceMaxEcart']:,.0f})" if e['balanceMaxEcart'] > 0 else ""))
    print(f"  3. Brouillard: {e['brouillardCoherentCount']}/{len(e['brouillardByAccount'])} cohérents"
          + (f"  (max écart={e['brouillardMaxEcart']:,.0f})" if e['brouillardMaxEcart'] > 0 else ""))
    print(f"  4. Journal   : attendus={e['journalExpected']}  présents={e['journalCodes']}")
    if e.get("journalMissing"):
        print(f"     manquants={e['journalMissing']}")

# Print first entity's account detail
print()
print("=" * 70)
print("DÉTAIL PAR COMPTE — HOLCIM")
print("=" * 70)
holcim = next((e for e in v["entities"] if e["name"] == "HOLCIM"), None)
if holcim:
    print(f"{'Compte':<10} {'Verif':>15} {'Balance':>15} {'Écart Bal':>15} {'Brouillard':>15} {'Écart Brou':>15}  Statut")
    for ac in holcim["balanceByAccount"]:
        print(f"{ac['compte']:<10} {ac['verifSolde']:>15,.2f} {ac['balanceSolde']:>15,.2f} {ac['ecartBalance']:>15,.2f} {ac['brouillardSolde']:>15,.2f} {ac['ecartBrouillard']:>15,.2f}  {'OK' if ac['isBalanceCoherent'] and ac['isBrouillardCoherent'] else 'ECART'}")
