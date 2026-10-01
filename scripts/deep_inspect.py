#!/usr/bin/env python3
"""Deep dive into Verif BG '2026' sheet (the verification lines) and explore
512 accounts and entities in the brouillard."""
import openpyxl
from openpyxl import load_workbook
from collections import defaultdict, Counter
import os

VERIF = "/home/z/my-project/upload/Verif BG 30092026 V2.xlsx"
BROU = "/home/z/my-project/upload/Brouillard 2026 30092026.xlsx"

# 1) Explore "2026" sheet in detail
print("=" * 80)
print("VERIF BG - Sheet '2026' (the verification lines to balance)")
print("=" * 80)
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["2026"]
print(f"Dimensions: {ws.max_row} rows x {ws.max_column} cols\n")

# Print first 80 rows to understand structure
for i, row in enumerate(ws.iter_rows(max_row=120, values_only=True)):
    trimmed = []
    for c in row:
        s = str(c) if c is not None else ""
        if len(s) > 35:
            s = s[:32] + "..."
        trimmed.append(s)
    # only print non-empty rows
    if any(t for t in trimmed):
        print(f"R{i+1:>3}: {trimmed}")
wb.close()

print("\n\n")
print("=" * 80)
print("VERIF BG - Sheet 'Feuil1' (detailed verification transactions)")
print("=" * 80)
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["Feuil1"]
print(f"Dimensions: {ws.max_row} rows x {ws.max_column} cols\n")
# Print first 30 rows
for i, row in enumerate(ws.iter_rows(max_row=20, values_only=True)):
    trimmed = []
    for c in row:
        s = str(c) if c is not None else ""
        if len(s) > 40:
            s = s[:37] + "..."
        trimmed.append(s)
    print(f"R{i+1:>3}: {trimmed}")
wb.close()

# 2) Explore brouillard: unique values of N° compte général, N° compte tiers
print("\n\n")
print("=" * 80)
print("BROUILLARD - unique accounts and entities")
print("=" * 80)
wb = load_workbook(BROU, data_only=True, read_only=True)
ws = wb["Feuil1"]

compte_general_counter = Counter()
compte_tiers_counter = Counter()
journal_counter = Counter()
compte_512_lines = []  # rows where N° compte général starts with 512
sample_580 = []
sample_512 = []
total_debit_512 = defaultdict(float)
total_credit_512 = defaultdict(float)
total_debit_580 = 0.0
total_credit_580 = 0.0

# column indices from header (1-based)
# 1: Code journal, 2: Date, 3: N° pièce, 4: N° facture, 5: Référence,
# 6: N° compte général, 7: N° compte tiers, 8: Libellé écriture,
# 9: Date échéance, 10: Lettrage montant, 11: Débit, 12: Crédit
header_seen = False
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if not header_seen:
        header_seen = True
        continue
    if row is None:
        continue
    code_journal = row[0]
    compte_g = str(row[5]) if row[5] is not None else ""
    compte_t = str(row[6]) if row[6] is not None else ""
    debit = float(row[10]) if row[10] is not None else 0.0
    credit = float(row[11]) if row[11] is not None else 0.0

    journal_counter[code_journal] += 1
    compte_general_counter[compte_g] += 1
    if compte_t:
        compte_tiers_counter[compte_t] += 1

    if compte_g.startswith("512"):
        total_debit_512[compte_g] += debit
        total_credit_512[compte_g] += credit
        if len(sample_512) < 10:
            sample_512.append(row)
    if compte_g.startswith("580"):
        total_debit_580 += debit
        total_credit_580 += credit
        if len(sample_580) < 10:
            sample_580.append(row)

print(f"Total rows: {sum(journal_counter.values()):,}")
print(f"\nJournal codes ({len(journal_counter)}):")
for k, v in journal_counter.most_common():
    print(f"  {k}: {v:,}")

print(f"\nNumber of unique 'N° compte général': {len(compte_general_counter)}")
print("\n512 accounts present (compte général):")
for k in sorted(total_debit_512.keys()):
    d = total_debit_512[k]
    c = total_credit_512[k]
    print(f"  {k}: debit={d:,.2f}, credit={c:,.2f}, solde={d-c:,.2f}")

print(f"\n580 accounts totals: debit={total_debit_580:,.2f}, credit={total_credit_580:,.2f}")

print(f"\nSample 512 rows from brouillard:")
for r in sample_512[:8]:
    trimmed = []
    for c in r:
        s = str(c) if c is not None else ""
        if len(s) > 40:
            s = s[:37] + "..."
        trimmed.append(s)
    print(f"  {trimmed}")

print(f"\nSample 580 rows from brouillard:")
for r in sample_580[:8]:
    trimmed = []
    for c in r:
        s = str(c) if c is not None else ""
        if len(s) > 40:
            s = s[:37] + "..."
        trimmed.append(s)
    print(f"  {trimmed}")

# Print top 30 most common 'compte tiers' that look like entity names
print(f"\nTop 50 'N° compte tiers' (entities):")
for k, v in compte_tiers_counter.most_common(50):
    print(f"  {k}: {v}")

wb.close()
