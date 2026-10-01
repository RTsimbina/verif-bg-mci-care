import type { NextConfig } from "next";

/**
 * Configuration Next.js pour déploiement statique sur GitHub Pages.
 *
 * - `output: "export"` produit un site statique dans `out/` (aucun serveur Node requis).
 * - `basePath` + `assetPrefix` adaptent les URLs pour GitHub Pages
 *   (https://<user>.github.io/<repo>/).
 * - `trailingSlash: true` est nécessaire pour que les routes profondes
 *   fonctionnent sur GitHub Pages.
 * - `images.unoptimized: true` car GitHub Pages ne supporte pas l'optimisation d'images.
 *
 * Les variables d'environnement `GITHUB_ACTIONS` et `GITHUB_REPOSITORY` sont
 * automatiquement définies par GitHub Actions lors du build de déploiement.
 */
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGitHubActions ? `/${repo}` : "",
  assetPrefix: isGitHubActions ? `/${repo}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
