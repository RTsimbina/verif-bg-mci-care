#!/usr/bin/env python3
"""
Crée un nouveau dépôt GitHub sur le compte RTsimbina et pousse le projet.

Pré-requis : le fichier /home/z/my-project/.env doit contenir :
    GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Le token doit avoir les scopes :
  - classic : `repo` (pour public + private) ou `public_repo` (pour public seulement)
  - fine-grained : `Administration: Write` + `Contents: Write` sur le compte RTsimbina

Étapes :
  1. Lit GITHUB_TOKEN depuis .env
  2. Valide le token via GET /user
  3. Crée le dépôt via POST /user/repos (public)
  4. Ajoute le remote origin
  5. Pousse la branche main
"""
import os
import sys
import re
import time
import subprocess
import urllib.request
import urllib.error
import json

PROJECT_DIR = "/home/z/my-project"
ENV_FILE = os.path.join(PROJECT_DIR, ".env")
REPO_NAME = "verif-bg-mci-care"
REPO_DESC = "Vérification automatique des écritures comptables BG — MCI CARE MADAGASCAR. Détecte les écritures incorrectes et génère les transferts 580001."
VISIBILITY = "public"  # ou "private"
GITHUB_OWNER = "RTsimbina"


def read_token():
    if not os.path.exists(ENV_FILE):
        return None
    with open(ENV_FILE, "r") as f:
        for line in f:
            line = line.strip()
            m = re.match(r"^GITHUB_TOKEN\s*=\s*(\S+)", line)
            if m:
                return m.group(1)
    return None


def gh_api(method, path, token, body=None):
    url = f"https://api.github.com{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "verif-bg-pusher",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except Exception:
            body = {"raw": raw}
        return e.code, body
    except Exception as e:
        return 0, {"error": str(e)}


def run(cmd, cwd=PROJECT_DIR, check=True, capture=False):
    print(f"  $ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    result = subprocess.run(
        cmd,
        cwd=cwd,
        shell=isinstance(cmd, str),
        capture_output=capture,
        text=True,
    )
    if check and result.returncode != 0:
        print(f"  STDERR: {result.stderr}", file=sys.stderr)
        raise SystemExit(f"Command failed (exit {result.returncode}): {cmd}")
    return result


def main():
    print("=" * 70)
    print(f"Push vers GitHub : {GITHUB_OWNER}/{REPO_NAME} ({VISIBILITY})")
    print("=" * 70)

    # 1. Lire le token
    token = read_token()
    if not token:
        print("\n[!] GITHUB_TOKEN introuvable dans .env")
        print(f"    Ajoutez la ligne : GITHUB_TOKEN=ghp_xxx dans {ENV_FILE}")
        sys.exit(1)
    print(f"\n[1/5] Token lu depuis .env (longueur : {len(token)}, prefix : {token[:4]}...)")

    # 2. Valider le token + récupérer l'utilisateur
    print("\n[2/5] Validation du token via GET /user ...")
    status, body = gh_api("GET", "/user", token)
    if status != 200:
        print(f"    ERREUR HTTP {status}: {body}")
        sys.exit(1)
    login = body.get("login", "?")
    print(f"    Token valide. Compte GitHub : @{login}")
    if login.lower() != GITHUB_OWNER.lower():
        print(f"    /!\\ Le compte @{login} ne correspond pas à @{GITHUB_OWNER} — on continue quand même.")

    # 3. Vérifier si le dépôt existe déjà
    print(f"\n[3/5] Vérification de l'existence du dépôt {GITHUB_OWNER}/{REPO_NAME} ...")
    status, body = gh_api("GET", f"/repos/{GITHUB_OWNER}/{REPO_NAME}", token)
    if status == 200:
        print(f"    Le dépôt existe déjà : {body.get('html_url')}")
        print("    On l'utilise tel quel (le push écrasera l'historique distant s'il diffère).")
        repo_url = body.get("html_url")
        clone_url = body.get("clone_url")
    elif status == 404:
        print(f"    Dépôt inexistant — création en cours (visibilité : {VISIBILITY}) ...")
        status, body = gh_api(
            "POST",
            "/user/repos",
            token,
            {
                "name": REPO_NAME,
                "description": REPO_DESC,
                "private": VISIBILITY == "private",
                "has_issues": True,
                "has_wiki": False,
                "has_projects": False,
                "auto_init": False,  # pas de README initial pour éviter conflit
            },
        )
        if status not in (200, 201):
            print(f"    ERREUR création HTTP {status}: {body}")
            sys.exit(1)
        repo_url = body.get("html_url")
        clone_url = body.get("clone_url")
        print(f"    Dépôt créé : {repo_url}")
    else:
        print(f"    ERREUR HTTP {status}: {body}")
        sys.exit(1)

    # 4. Configurer le remote
    print(f"\n[4/5] Configuration du remote 'origin' ...")
    # Token embedded in URL for push auth (will be removed after push)
    auth_url = clone_url.replace(
        "https://",
        f"https://{GITHUB_OWNER}:{token}@",
    )
    # Remove existing origin if any
    run(["git", "remote", "remove", "origin"], check=False)
    run(["git", "remote", "add", "origin", auth_url])
    print(f"    Remote 'origin' ajouté (URL authentifiée, token masqué dans les logs)")
    # Mask the token in `git remote -v` output
    run(["git", "remote", "set-url", "origin", clone_url])  # visible URL without token
    # But for the push, we need the auth URL — set it just for the push
    run(["git", "remote", "set-url", "--push", "origin", auth_url])

    # 5. Push
    print(f"\n[5/5] Push de la branche main vers origin ...")
    print("    (cela peut prendre 30-60 s selon la connexion)")
    # Use the auth URL directly to avoid any credential helper issues
    result = subprocess.run(
        ["git", "push", "-u", auth_url, "main:main"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=180,
    )
    # Replace token in any output before printing
    safe_out = result.stdout.replace(token, "***TOKEN***")
    safe_err = result.stderr.replace(token, "***TOKEN***")
    print(f"    exit code: {result.returncode}")
    if safe_out:
        print(f"    stdout: {safe_out}")
    if safe_err:
        print(f"    stderr: {safe_err}")
    if result.returncode != 0:
        sys.exit(1)

    # Reset the push URL to the clean clone URL (no token)
    run(["git", "remote", "set-url", "--push", "origin", clone_url])

    print("\n" + "=" * 70)
    print(f"✅ Push terminé avec succès !")
    print(f"   Dépôt : {repo_url}")
    print(f"   Branche : main")
    print(f"   Fichiers : 105 (données sensibles exclues)")
    print("=" * 70)
    print(f"\nPour cloner : git clone {clone_url}")


if __name__ == "__main__":
    main()
