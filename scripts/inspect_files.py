#!/usr/bin/env python3
"""Inspect the 2 Excel files structure to understand the data."""
import openpyxl
from openpyxl import load_workbook
import os

UPLOAD_DIR = "/home/z/my-project/upload"
FILES = [
    "Verif BG 30092026 V2.xlsx",
    "Brouillard 2026 30092026.xlsx",
]

for fname in FILES:
    fpath = os.path.join(UPLOAD_DIR, fname)
    print("=" * 80)
    print(f"FILE: {fname}")
    print(f"Size: {os.path.getsize(fpath):,} bytes")
    print("=" * 80)
    try:
        wb = load_workbook(fpath, data_only=True, read_only=True)
        print(f"Sheet names ({len(wb.sheetnames)}): {wb.sheetnames}")
        for sname in wb.sheetnames:
            ws = wb[sname]
            print(f"\n--- Sheet: {sname} ---")
            print(f"  Dimensions: {ws.max_row} rows x {ws.max_column} cols")
            # Print first 5 rows
            for i, row in enumerate(ws.iter_rows(max_row=8, values_only=True)):
                # Truncate long cells
                trimmed = []
                for c in row:
                    s = str(c) if c is not None else ""
                    if len(s) > 50:
                        s = s[:47] + "..."
                    trimmed.append(s)
                print(f"  Row {i+1}: {trimmed}")
            # Print a sample row near the middle
            try:
                mid = min(50, ws.max_row)
                if mid > 8:
                    print(f"  ... showing row {mid} sample:")
                    for row in ws.iter_rows(min_row=mid, max_row=mid, values_only=True):
                        trimmed = []
                        for c in row:
                            s = str(c) if c is not None else ""
                            if len(s) > 50:
                                s = s[:47] + "..."
                            trimmed.append(s)
                        print(f"  Row {mid}: {trimmed}")
            except Exception as e:
                print(f"  (sample row error: {e})")
        wb.close()
    except Exception as e:
        print(f"ERROR loading {fname}: {e}")
    print()
