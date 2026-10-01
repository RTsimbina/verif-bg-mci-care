# Vérification BG — MCI CARE MADAGASCAR

> 🌐 **Application en ligne** : https://rtsimbina.github.io/verif-bg-mci-care/
>
> 📦 **Code source** : https://github.com/RTsimbina/verif-bg-mci-care

Application web de **vérification automatique des écritures comptables** et de **génération des écritures de transfert 580001** (comptes à comptes) pour MCI CARE MADAGASCAR.

L'outil analyse le fichier **Verif BG.xlsx** (lignes de vérification par entité) et le **Brouillard 2026.xlsx** (écritures comptables détaillées) pour :

- 📊 Détecter les écritures incorrectes (lignes de vérification non soldées)
- 🔍 Identifier automatiquement les 3 types d'opérations : appels de fonds, paiements prestataires, honoraires
- 🔄 Proposer les écritures de transfert **580001** permettant de solder tous les écarts
- 📤 Exporter un fichier Excel avec les écritures prêtes à intégrer dans Sage

---

## ✨ Fonctionnalités

### Moteur d'analyse Excel
- Import et parsing des 2 fichiers sources (Verif BG ~200 Ko, Brouillard ~11 Mo / 160 000 lignes)
- Détection des écarts : mauvais client, contrepartie hors périmètre, comptes oubliés
- Identification des entités (63 entités traitées sur le dataset de test)

### Détection des opérations
| Type | Comptes | Description |
|---|---|---|
| Appels de fonds | `460xxx`, `461xxx` | Appels de fonds reçus des entités |
| Paiements prestataires | `467xxx` | Paiements de factures fournisseurs |
| Honoraires | `462xxx` | Honoraires professionnels |

### Générateur d'écritures 580001
- Appariement automatique intra-groupe des écarts (positifs ↔ négatifs)
- Détection des transferts **déjà passés** dans le brouillard (matching par montant + libellé)
- 3 statuts : **À créer**, **Déjà passée**, **À traiter manuellement**
- Génération des écritures en paires :
  - Débit `580001` / Crédit `512xxx` (côté émetteur)
  - Débit `512xxx` / Crédit `580001` (côté récepteur)

### Règles de gestion des comptes 512

#### 1. Regroupements par compte 512 partagé
Entités lettrées sur le même compte 512 (règle des 3 derniers chiffres) :

| Groupe | Entités |
|---|---|
| 1 | PAMF ↔ EASYTECH |
| 2 | INGEDATA + CAMUSAT ↔ EVIOSYS ou SONOCO |
| 3 | STELARIX ↔ AITS |
| 4 | WELIGHT + MADAGASCO + ATSS ↔ ASS |
| 5 | AXIAN UNIVERSITY + FONDATION AXIAN ↔ TOM |
| 6 | SANKO ↔ FIRSTIMMO |
| 7 | FOUNDEVER ↔ SMARTONE |
| 8 | KIDS ACADEMY ↔ NACRE SOLUTIONS |
| 9 | TANJAKA FOOD ↔ OMNIVEST |
| 10 | SANLAM + SANLAMALLIANZ AUTOFI + SANLAMALLIANZ COMPAGNIE |

#### 2. Affectations spécifiques

| Entité | Compte 512 |
|---|---|
| JBU / JBS / BOOST | `512300` |
| TAMBOHO / STMB / TALYS | `512201` |
| SOCOTA / LECO | `512330` |
| NACRE DIR | `512800` |
| EVASAN | `512140` |
| DHL EXPRESS | `512120` |

#### 3. Règle d'évolution historique (SANLAMALLIANZ)
- **Par le passé** : SANLAMALLIANZ AUTOFI et SANLAMALLIANZ COMPAGNIE étaient tous deux sur `512100`
- **Actuellement** : AUTOFI migré vers `512501`, COMPAGNIE reste sur `512100`

---

## 🛠 Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui |
| Parsing Excel | SheetJS (`xlsx`) |
| Runtime | Node.js (mode server) |

---

## 🚀 Installation

### Pré-requis
- Node.js 18+ ou [Bun](https://bun.sh) (recommandé)
- Les 2 fichiers Excel source : `Verif BG.xlsx` et `Brouillard 2026.xlsx`

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/RTsimbina/verif-bg-mci-care.git
cd verif-bg-mci-care

# 2. Installer les dépendances
bun install

# 3. Lancer le serveur de développement
bun run dev
```

L'application est accessible sur **http://localhost:3000**

---

## 📖 Utilisation

### 1. Charger les fichiers
Sur la page d'accueil :
- Glissez-déposez (ou cliquez pour parcourir) le fichier **Verif BG.xlsx** (zone verte)
- Glissez-déposez le fichier **Brouillard 2026.xlsx** (zone orange)
- Cliquez **« Lancer l'analyse »**
- ⏱ L'analyse prend ~10-15 secondes (parsing des 160 000 lignes du brouillard)

> 💡 Un bouton **« Charger la démo »** permet de visualiser l'interface avec un résultat pré-calculé sans avoir à uploader les fichiers.

### 2. Tableau de bord
- KPIs : entités vérifiées, écarts totaux, transferts à créer / déjà passés
- Résumé des opérations détectées par type
- Liste détaillée des 63 entités avec leurs écarts et statuts (Soldé / Mineur / Majeur)
- Écarts non appariés à traiter manuellement

### 3. Onglet « Comptes à comptes »
- Tableau des écritures de transfert 580001 proposées
- Filtres : statut, recherche texte, tri (montant / entité / statut)
- Pour chaque transfert :
  - Entité émettrice → récepteur
  - Compte 512 à créditer → compte 512 à débiter
  - Montant en MGA
  - Statut (À créer / Déjà passée / Manuel)
  - Référence du transfert existant (si déjà passé)

### 4. Export Excel
- Bouton **« Exporter Excel »** en haut à droite
- Génère un fichier `Export_Verif_BG_YYYY-MM-JJ.xlsx` avec 5 feuilles :
  1. **Analyse** — écarts par entité
  2. **Transferts 580001** — écritures de transfert (4 lignes par transfert)
  3. **Opérations détectées** — résumé par type
  4. **Comptes 512** — liste des comptes 512 présents dans le brouillard
  5. **Écarts manuels** — écarts non appariés à traiter manuellement

---

## 🌐 Déploiement GitHub Pages

L'application est déployée automatiquement sur GitHub Pages à chaque push sur `main`.

**URL** : https://rtsimbina.github.io/verif-bg-mci-care/

### Architecture
- **100% statique** : parsing Excel et analyse effectués côté client (SheetJS dans le navigateur)
- **Aucun serveur Node.js requis** — fonctionne sur GitHub Pages (hébergement gratuit)
- **Workflow GitHub Actions** : `.github/workflows/deploy.yml`
  1. `bun install` — installe les dépendances
  2. `bunx next build` — génère l'export statique dans `out/`
  3. Upload l'artifact
  4. Déploie sur GitHub Pages

### Configuration
- `next.config.ts` configure `output: "export"` + `basePath` adapté au nom du repo
- Les variables `GITHUB_ACTIONS=true` et `GITHUB_REPOSITORY` sont injectées par GitHub Actions
- `NEXT_PUBLIC_BASE_PATH` est utilisé pour les fetch côté client (ex: démo)

### Activer GitHub Pages (1ère fois)
1. Allez sur **Settings → Pages** du dépôt
2. Section **Build and deployment → Source** : sélectionnez **GitHub Actions**
3. Le workflow se déclenchera automatiquement au prochain push sur `main`

### Déploiement manuel
- Onglet **Actions** → **Deploy to GitHub Pages** → **Run workflow**

---

## 📂 Structure du projet

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml                # Workflow GitHub Actions (build + déploy)
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Page principale (4 onglets)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── accounting/
│   │   │   ├── file-uploader.tsx     # Drag & drop + analyse côté client
│   │   │   ├── dashboard-tab.tsx     # Onglet tableau de bord
│   │   │   ├── comptes-a-comptes-tab.tsx  # Onglet transferts 580001
│   │   │   └── rules-tab.tsx         # Onglet règles de gestion
│   │   └── ui/                       # Composants shadcn/ui
│   └── lib/
│       └── accounting/
│           ├── rules.ts              # Règles de gestion 512 (codées en dur)
│           ├── parser.ts             # Parsing Excel (côté client, SheetJS)
│           ├── engine.ts             # Moteur d'analyse + appariement
│           └── exporter.ts           # Génération Excel d'export (côté client)
├── public/
│   └── demo-result.json              # Résultat pré-calculé (mode démo)
├── next.config.ts                    # Config export statique + basePath
├── prisma/
├── package.json
└── .env                              # NON commité (variables locales)
```

---

## 🔧 Personnalisation des règles

Les règles de gestion sont centralisées dans **`src/lib/accounting/rules.ts`** :

```typescript
// Ajouter un nouveau regroupement
export const GROUPED_ENTITIES: string[][] = [
  // ...
  ["NOUVELLE_ENTITE_A", "NOUVELLE_ENTITE_B"],
];

// Ajouter une affectation spécifique
export const SPECIFIC_512: Record<string, string> = {
  // ...
  "NOUVELLE ENTITE": "512XXX",
};
```

Après modification, relancez `bun run dev` et rechargez la page.

---

## 📊 Résultats sur le dataset de test (30/09/2026)

| Indicateur | Valeur |
|---|---|
| Entités analysées | 63 |
| Entités soldées | 40 (63 %) |
| Entités avec écart | 23 |
| Écarts absolus totaux | 890 658 243 MGA |
| Transferts 580001 proposés | 20 |
| Transferts à créer | 19 (276 430 667 MGA) |
| Transferts déjà passés | 1 |
| Écarts non appariés | 3 (à traiter manuellement) |
| Écritures 580001 existantes dans le brouillard | 716 |
| Temps d'analyse | ~11 s |

---

## 🔒 Sécurité & confidentialité

- Les fichiers Excel source (**Verif BG.xlsx** et **Brouillard 2026.xlsx**) contiennent des **données comptables réelles** et ne sont **jamais commités** dans le dépôt (voir `.gitignore`).
- L'analyse se fait entièrement côté serveur (API Node.js), les fichiers ne quittent pas la machine.
- Aucune donnée n'est persistée en base — l'analyse est stateless.
- Le fichier `.env` (contenant les tokens éventuels) est également ignoré par git.

---

## 🤝 Contribution

1. Fork le projet
2. Créer une branche : `git checkout -b feature/ma-fonctionnalite`
3. Commit : `git commit -m "feat: ma fonctionnalité"`
4. Push : `git push origin feature/ma-fonctionnalite`
5. Ouvrir une Pull Request

---

## 📝 License

Projet interne — MCI CARE MADAGASCAR. Tous droits réservés.

---

## 👥 Contact

- **Dépôt GitHub** : [RTsimbina/verif-bg-mci-care](https://github.com/RTsimbina/verif-bg-mci-care)
- **Compte** : [@RTsimbina](https://github.com/RTsimbina)
