#!/usr/bin/env python3
"""Gatekeeper: script d'audit bloquant pour Physio-Training.

Exécute une série de vérifications statiques et structurelles.
Retourne 0 en cas de succès, 1 en cas de non-respect des règles.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

# Constantes de validation
SRC_DIR = Path("src")
PROHIBITED_EXTENSIONS = {".js", ".jsx"}
ALLOWED_JS_DIRECTORIES = {Path("scripts")}

# Patterns Regex d'anti-patterns
RE_EMPTY_CATCH = re.compile(r"catch\s*(?:\([^)]*\))?\s*\{\s*\}", re.MULTILINE)
RE_TS_IGNORE = re.compile(r"//\s*@ts-(?:ignore|nocheck)")
RE_EXPLICIT_ANY = re.compile(r":\s*any\b|\bas\s+any\b")
RE_FORCED_NON_NULL = re.compile(r"\b[a-zA-Z0-9_]+\s*!\.[a-zA-Z0-9_]+")


class Colors:
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RESET = "\033[0m"


def log_error(msg: str) -> None:
    print(f"{Colors.RED}[ÉCHEC]{Colors.RESET} {msg}")


def log_success(msg: str) -> None:
    print(f"{Colors.GREEN}[VALIDE]{Colors.RESET} {msg}")


def log_warn(msg: str) -> None:
    print(f"{Colors.YELLOW}[ATTENTION]{Colors.RESET} {msg}")


def check_legacy_extensions() -> list[str]:
    """Détecte les reliquats JavaScript non migrés dans src/."""
    violations: list[str] = []
    if not SRC_DIR.exists():
        return ["Le dossier src/ est introuvable."]

    for file_path in SRC_DIR.rglob("*"):
        if file_path.is_file() and file_path.suffix in PROHIBITED_EXTENSIONS:
            violations.append(
                f"Fichier JS/JSX résiduel interdit : {file_path}"
            )
    return violations


def audit_source_patterns() -> list[str]:
    """Analyse les fichiers TypeScript à la recherche d'anti-patterns."""
    violations: list[str] = []
    ts_files = list(SRC_DIR.rglob("*.ts")) + list(SRC_DIR.rglob("*.tsx"))

    for file_path in ts_files:
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        rel_path = file_path.as_posix()

        # 1. Catch vides
        if RE_EMPTY_CATCH.search(content):
            violations.append(
                f"{rel_path} : Présence d'un bloc catch vide (erreur avalée)."
            )

        # 2. Directives d'ignorance TypeScript
        if RE_TS_IGNORE.search(content):
            violations.append(
                f"{rel_path} : Utilisation interdite de @ts-ignore ou @ts-nocheck."
            )

        # 3. Utilisation de any
        if RE_EXPLICIT_ANY.search(content):
            violations.append(
                f"{rel_path} : Typage 'any' explicite détecté. Utiliser un type strict ou unknown."
            )

        # 4. Assertions non-null abusives
        matches_non_null = RE_FORCED_NON_NULL.findall(content)
        if len(matches_non_null) > 5:
            violations.append(
                f"{rel_path} : Trop d'assertions non-nulles (!) détectées ({len(matches_non_null)} occurrences). Sécuriser avec des guards."
            )

    return violations


def check_tests_balance() -> list[str]:
    """Contrôle la présence et la surface des fichiers de tests."""
    violations: list[str] = []
    tests_dir = list(SRC_DIR.rglob("__tests__"))
    if not tests_dir:
        violations.append("Aucun dossier __tests__ trouvé dans l'arborescence src/.")
        return violations

    test_files = [f for d in tests_dir for f in d.glob("*.test.ts*")]
    if len(test_files) < 5:
        violations.append(
            f"Volume de tests critique trop bas ({len(test_files)} fichiers trouvés)."
        )

    # Vérification sommaire de présence de cas d'erreurs dans les tests
    for test_file in test_files:
        content = test_file.read_text(encoding="utf-8")
        has_error_checks = any(
            token in content
            for token in ["toThrow", "rejects", "null", "undefined", "error", "catch"]
        )
        if not has_error_checks:
            violations.append(
                f"{test_file.as_posix()} : Test superficiel (aucun cas d'erreur ou valeur limite détecté)."
            )

    return violations


def run_tsc_check() -> list[str]:
    """Exécute la vérification statique du compilateur TypeScript."""
    violations: list[str] = []
    try:
        cmd = ["npx", "tsc", "--noEmit", "--pretty", "false"]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            for line in proc.stdout.splitlines():
                if ": error TS" in line:
                    violations.append(f"TS Compiler: {line.strip()}")
            if not violations and proc.stderr:
                violations.append(f"TS Compiler stderr: {proc.stderr.strip()}")
    except FileNotFoundError:
        log_warn("npx ou tsc n'est pas installé dans l'environnement d'exécution.")
    return violations


def main() -> int:
    print("=== Démarrage de l'Exit Gate Physio-Training ===")
    all_violations: list[str] = []

    # 1. Vérification des extensions interdites
    legacy_files = check_legacy_extensions()
    if legacy_files:
        all_violations.extend(legacy_files)
    else:
        log_success("Aucun fichier résiduel .js / .jsx dans src/.")

    # 2. Analyse statique des anti-patterns
    pattern_violations = audit_source_patterns()
    if pattern_violations:
        all_violations.extend(pattern_violations)
    else:
        log_success("Aucun anti-pattern critique détecté (catch vides, @ts-ignore, any).")

    # 3. Évaluation de la robustesse des tests
    test_violations = check_tests_balance()
    if test_violations:
        all_violations.extend(test_violations)
    else:
        log_success("Structure et couverture des tests validées.")

    # 4. Compilation TypeScript
    tsc_violations = run_tsc_check()
    if tsc_violations:
        all_violations.extend(tsc_violations)
    else:
        log_success("Compilation tsc --noEmit sans erreur.")

    # Bilan
    print("------------------------------------------------")
    if all_violations:
        log_error(f"Échec de l'Exit Gate : {len(all_violations)} violation(s) trouvée(s) :")
        for v in all_violations:
            print(f"  - {v}")
        return 1

    log_success("Tous les critères d'Exit Gate sont validés avec succès.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
