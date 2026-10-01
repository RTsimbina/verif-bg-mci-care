#!/usr/bin/env python3
"""Vérifie les anomalies détectées dans demo-result.json."""
import json

# On lit juste le début pour voir les stats (le fichier est gros)
with open("/home/z/my-project/public/demo-result.json") as f:
    data = json.load(f)

print("=" * 70)
print("STATS ANOMALIES")
print("=" * 70)
stats = data["anomalyStats"]
print(f"Total        : {stats['total']}")
print(f"  Critique   : {stats['critiqueCount']}")
print(f"  Majeure    : {stats['majeureCount']}")
print(f"  Mineure    : {stats['mineureCount']}")
print(f"  Info       : {stats['infoCount']}")
print(f"  Certaine   : {stats['certaineCount']}")
print(f"  Probable   : {stats['probableCount']}")
print(f"  Manuelle   : {stats['manuelleCount']}")

print()
print("=" * 70)
print("SYNTHÈSE PAR TYPE")
print("=" * 70)
for s in data["anomalySummary"]:
    print(f"  {s['typeLabel']:<50}  total={s['count']:>5}  (C:{s['critiqueCount']} M:{s['majeureCount']} m:{s['mineureCount']})  conf: {s['certaineCount']}/{s['probableCount']}/{s['manuelleCount']}")

print()
print("=" * 70)
print("CONTRÔLE PAR JOURNAL")
print("=" * 70)
print(f"{'Journal':<10} {'Entité':<25} {'Pièces':>8} {'Lignes':>8} {'Débit':>18} {'Crédit':>18} {'Écart':>15} {'Statut':<10}")
for j in data["journalControls"][:15]:
    print(f"{j['codeJournal']:<10} {(j['entity'] or '—'):<25} {j['piecesCount']:>8} {j['linesCount']:>8} {j['totalDebit']:>18,.0f} {j['totalCredit']:>18,.0f} {j['ecart']:>15,.0f} {j['severity']:<10}")
print(f"... et {len(data['journalControls']) - 15} autres journaux")

print()
print("=" * 70)
print("CONTRÔLE PAR PIÈCE")
print("=" * 70)
pc = data["pieceControls"]
print(f"Total pièces       : {pc['totalPieces']}")
print(f"Pièces équilibrées : {pc['balancedPieces']}")
print(f"Pièces déséquilibr.: {pc['unbalancedPieces']}")
print(f"Total Débit        : {pc['totalDebit']:,.0f}")
print(f"Total Crédit       : {pc['totalCredit']:,.0f}")
print(f"Écart global       : {pc['ecart']:,.0f}")

print()
print("=" * 70)
print("ÉQUILIBRE BROUILLARD")
print("=" * 70)
be = data["brouillardEquilibre"]
print(f"Total Débit  : {be['totalDebit']:,.0f}")
print(f"Total Crédit : {be['totalCredit']:,.0f}")
print(f"Écart        : {be['ecart']:,.0f}")
print(f"Équilibré    : {'OUI' if be['isBalanced'] else 'NON'}")

print()
print("=" * 70)
print("TOP 10 ANOMALIES")
print("=" * 70)
for a in data["anomalies"][:10]:
    print(f"\n{a['id']} [{a['type']}] {a['severity']}/{a['confidence']}")
    print(f"  Titre: {a['title']}")
    if a.get('entity'): print(f"  Entité: {a['entity']}")
    if a.get('journal'): print(f"  Journal: {a['journal']}")
    if a.get('numPiece'): print(f"  Pièce: {a['numPiece']}")
    if a.get('montant'): print(f"  Montant: {a['montant']:,.0f}")
    if a.get('ecart'): print(f"  Écart: {a['ecart']:,.0f}")
