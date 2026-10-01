#!/usr/bin/env python3
"""Test the /api/analyze endpoint with the real Excel files."""
import requests
import json
import os
import time

UPLOAD_DIR = "/home/z/my-project/upload"
VERIF = os.path.join(UPLOAD_DIR, "Verif BG 30092026 V2.xlsx")
BROU = os.path.join(UPLOAD_DIR, "Brouillard 2026 30092026.xlsx")

assert os.path.exists(VERIF), f"missing {VERIF}"
assert os.path.exists(BROU), f"missing {BROU}"

print(f"Verif size : {os.path.getsize(VERIF):,} bytes")
print(f"Brouillard size : {os.path.getsize(BROU):,} bytes")
print()

with open(VERIF, "rb") as f1, open(BROU, "rb") as f2:
    files = {
        "verif": ("Verif BG.xlsx", f1, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "brouillard": ("Brouillard 2026.xlsx", f2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    print("POST /api/analyze ...")
    t0 = time.time()
    r = requests.post("http://localhost:3000/api/analyze", files=files, timeout=300)
    t1 = time.time()

print(f"Status: {r.status_code}  ({t1-t0:.1f}s)")
if r.status_code != 200:
    print(r.text[:2000])
    raise SystemExit(1)

data = r.json()
# Save full JSON for inspection
out = "/home/z/my-project/scripts/analyze_result.json"
with open(out, "w") as f:
    json.dump(data, f, indent=2, default=str)
print(f"Saved full JSON to {out}  ({len(json.dumps(data)):,} chars)")

# Print summary
print()
print("=" * 70)
print("ANALYSIS SUMMARY")
print("=" * 70)
print(f"Generated: {data['generatedAt']}")
print()
print("--- VERIF ---")
v = data["verif"]
print(f"  Sheet names: {v['sheetNames']}")
print(f"  Entities: {v['entityCount']}  (solded: {v['soldedCount']}, ecarts: {v['ecartsCount']})")
print(f"  Total |ecart|: {v['totalEcartAbsolu']:,.2f} MGA")
print()
print("--- BROUILLARD ---")
b = data["brouillard"]
print(f"  Sheet names: {b['sheetNames']}")
print(f"  Total entries: {b['totalEntries']:,}")
print(f"  Accounts 512: {b['accounts512']}")
print(f"  580 debit: {b['totalDebit580']:,.2f}, credit: {b['totalCredit580']:,.2f}")
print(f"  Existing 580 transfers: {b['existingTransfersCount']}")
print()
print("--- Operations detected ---")
for op in b["operationsByType"]:
    print(f"  {op['label']:25s} count={op['count']:>6,}  D={op['totalDebit']:>15,.2f}  C={op['totalCredit']:>15,.2f}  solde={op['solde']:>15,.2f}")
print()
print("--- TRANSFERS ---")
ts = data["transferStats"]
print(f"  Total: {ts['total']}")
print(f"  A creer: {ts['aCreer']}  (montant: {ts['montantTotal']:,.2f} MGA)")
print(f"  Deja passées: {ts['dejaPassee']}")
print(f"  Manuel: {ts['manuel']}")
print()
print("--- First 10 transfers ---")
for t in data["transfers"][:10]:
    print(f"  {t['id']:6s}  {t['entityFrom']:25s} -> {t['entityTo']:25s}  {t['compteFrom']:7s} -> {t['compteTo']:7s}  {t['montant']:>15,.2f}  [{t['status']}]")
print()
print(f"--- Unmatched ecarts ({len(data['unmatchedEcarts'])}) ---")
for e in data["unmatchedEcarts"][:20]:
    print(f"  {e['name']:30s}  ecart={e['ecart']:>15,.2f}  sev={e['severity']}")

print()
print("--- Top 15 entities by |ecart| ---")
sorted_entities = sorted(data["verif"]["entities"], key=lambda x: -x["ecartAbsolu"])
for e in sorted_entities[:15]:
    print(f"  {e['name']:30s}  ecart={e['ecart']:>15,.2f}  soldeAppels={e['soldeAppelDeFonds']:>15,.2f}  soldeTres={e['soldeTresorerie']:>15,.2f}  512={e.get('resolved512') or '—'}")
