#!/usr/bin/env python3
"""Inspect the 'Balance des comptes' sheet structure of Verif BG.xlsx in detail."""
from openpyxl import load_workbook

VERIF = "/home/z/my-project/upload/Verif BG 30092026 V2.xlsx"
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["Balance des comptes"]
print(f"Dimensions: {ws.max_row} rows x {ws.max_column} cols\n")

# Print first 30 rows
for i, row in enumerate(ws.iter_rows(max_row=30, values_only=True)):
    trimmed = []
    for c in row:
        s = str(c) if c is not None else ""
        if len(s) > 35:
            s = s[:32] + "..."
        trimmed.append(s)
    # Only print if any cell is non-empty
    if any(t for t in trimmed):
        print(f"R{i+1:>3}: {trimmed}")

# Find totals row (look for 'TOTAUX' or similar)
print("\n--- Looking for totals row ---")
for i, row in enumerate(ws.iter_rows(values_only=True)):
    s = str(row[0] or "") + " " + str(row[1] or "") + " " + str(row[2] or "")
    if "TOTAL" in s.upper() or "TOTAUX" in s.upper():
        print(f"R{i+1}: {[str(c)[:40] if c is not None else '' for c in row]}")
        if i > 10:
            break

wb.close()

# Also inspect the '2026' sheet for 513 accounts (often used as 'compte de transition')
print("\n\n--- Verif BG '2026' sheet — looking for 513 accounts ---")
wb = load_workbook(VERIF, data_only=True, read_only=True)
ws = wb["2026"]
for i, row in enumerate(ws.iter_rows(max_row=600, values_only=True)):
    c1 = str(row[1] or "")
    if c1.startswith("513") or c1.startswith("514") or c1.startswith("519"):
        print(f"R{i+1}: {[str(c)[:35] if c is not None else '' for c in row[:6]]}")
wb.close()
