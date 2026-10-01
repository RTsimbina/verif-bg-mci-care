#!/usr/bin/env python3
"""
Inspect en détail :
 1. La structure des blocs d'entités dans la feuille '2026' de Verif BG.xlsx
    - Quelle ligne est "Solde Appel de fonds", "Solde Trésorerie", "Vérification"
    - Quelles cellules contiennent les totaux (debit, credit) par entité
 2. Les codes journaux du brouillard et leur mapping avec les entités
 3. Pour quelques entités (HOLCIM, DHL EXPRESS), comparer les soldes de la
    feuille 2026 avec ceux de la balance et ceux du brouillard.
"""
from openpyxl import load_workbook
from collections import defaultdict

VERIF = "/home/z/my-project/upload/Verif BG 30092026 V2.xlsx"
BROU = "/home/z/my-project/upload/Brouillard 2026 30092026.xlsx"

print("=" * 90)
print("VERIF BG — feuille '2026' — analyse complète des 3 premières entités")
print("=" * 90)
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["2026"]

# Print rows 1 to 130 with all non-empty columns
for i, row in enumerate(ws.iter_rows(max_row=130, values_only=True)):
    cells = []
    for j, c in enumerate(row):
        if c is not None and str(c).strip():
            s = str(c)
            if len(s) > 30:
                s = s[:27] + "..."
            cells.append(f"c{j}={s}")
    if cells:
        print(f"R{i+1:>3}: " + " | ".join(cells))
wb.close()

print("\n\n")
print("=" * 90)
print("BROUILLARD — codes journaux et leur mapping avec comptes 512 et 467")
print("=" * 90)
wb = load_workbook(BROU, data_only=True, read_only=True)
ws = wb["Feuil1"]

# Pour chaque code journal, calculer les totaux par compte (467xxx, 460xxx, 512xxx)
journal_data = defaultdict(lambda: {"count": 0, "comptes": defaultdict(lambda: {"D": 0, "C": 0})})

for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0:
        continue
    if row is None:
        continue
    journal = str(row[0] or "")
    compte_g = str(row[5] or "")
    debit = float(row[10]) if row[10] is not None else 0
    credit = float(row[11]) if row[11] is not None else 0
    if not journal:
        continue
    journal_data[journal]["count"] += 1
    if compte_g:
        journal_data[journal]["comptes"][compte_g]["D"] += debit
        journal_data[journal]["comptes"][compte_g]["C"] += credit

# Print top 10 journaux
print(f"\nTotal journaux: {len(journal_data)}")
print(f"\nTop 12 journaux par nombre d'écritures:")
for j, data in sorted(journal_data.items(), key=lambda x: -x[1]["count"])[:12]:
    print(f"  {j}: {data['count']:,} écritures")
    # Print top 5 comptes pour ce journal
    sorted_comptes = sorted(data["comptes"].items(), key=lambda x: -(x[1]["D"] + x[1]["C"]))[:5]
    for c, v in sorted_comptes:
        print(f"    {c}: D={v['D']:>15,.2f}  C={v['C']:>15,.2f}  solde={v['D']-v['C']:>15,.2f}")

wb.close()

# Maintenant, pour HOLCIM, comparer les 3 sources
print("\n\n")
print("=" * 90)
print("CROISEMENT HOLCIM : feuille 2026 vs Balance vs Brouillard")
print("=" * 90)

# 1. Feuille 2026 — bloc HOLCIM
print("\n[1] FEUILLE '2026' — bloc HOLCIM :")
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["2026"]
in_holcim = False
for i, row in enumerate(ws.iter_rows(max_row=15, values_only=True)):
    c0 = str(row[0] or "")
    c1 = str(row[1] or "")
    if c0 == "HOLCIM":
        in_holcim = True
    if in_holcim:
        cells = [f"{str(c)[:25] if c is not None else ''}" for c in row[:6]]
        print(f"  R{i+1}: {cells}")
wb.close()

# 2. Balance — comptes HOLCIM (467110, 460110, 461110, 462110, 512110)
print("\n[2] BALANCE — comptes HOLCIM (467110, 460110, 461110, 462110, 512110) :")
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["Balance des comptes"]
target = {"467110", "460110", "461110", "462110", "512110"}
for i, row in enumerate(ws.iter_rows(values_only=True)):
    c0 = str(row[0] or "")
    if c0 in target:
        intitule = str(row[2] or "")[:40]
        mvt_d = float(row[9]) if row[9] is not None else 0
        mvt_c = float(row[12]) if row[12] is not None else 0
        solde_d = float(row[14]) if row[14] is not None else 0
        solde_c = float(row[17]) if row[17] is not None else 0
        print(f"  {c0} {intitule:<40} MvtD={mvt_d:>15,.2f}  MvtC={mvt_c:>15,.2f}  SoldeD={solde_d:>15,.2f}  SoldeC={solde_c:>15,.2f}")
wb.close()

# 3. Brouillard — journal BNISAN (HOLCIM) et comptes associés
print("\n[3] BROUILLARD — journal MVOHOL / BOAHOL / BNISAN (HOLCIM) :")
wb = load_workbook(BROU, data_only=True, read_only=True)
ws = wb["Feuil1"]
journal_holcim = {"MVOHOL", "BOAHOL"}
for j in journal_holcim:
    print(f"\n  Journal {j} :")
    comptes = defaultdict(lambda: {"D": 0, "C": 0, "count": 0})
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        if str(row[0] or "") != j:
            continue
        compte = str(row[5] or "")
        debit = float(row[10]) if row[10] is not None else 0
        credit = float(row[11]) if row[11] is not None else 0
        comptes[compte]["D"] += debit
        comptes[compte]["C"] += credit
        comptes[compte]["count"] += 1
    for c, v in sorted(comptes.items()):
        if v["D"] + v["C"] > 0:
            print(f"    {c}: count={v['count']:>4}  D={v['D']:>15,.2f}  C={v['C']:>15,.2f}  solde={v['D']-v['C']:>15,.2f}")
wb.close()
