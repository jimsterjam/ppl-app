#!/usr/bin/env bash
# Alle Prüfungen der "Definition of Done" (CLAUDE.md) mit einem Befehl, mit eindeutigem Ergebnis
# pro Prüfung: OK / FEHLER / NICHT GELAUFEN. Ändert nichts am Repository.
#
#   bash scripts/check-all.sh           # Server-Tests, Client-Tests, i18n-Check, Lint
#   bash scripts/check-all.sh --build   # zusätzlich Client-Build (vite build)
#
# Exit-Code 0 nur, wenn alle gelaufenen Prüfungen OK sind UND keine ausgelassen wurde.
set -uo pipefail
cd "$(dirname "$0")/.."

RUN_BUILD=0
[ "${1:-}" = "--build" ] && RUN_BUILD=1

LOG_DIR="$(mktemp -d)"
declare -a NAMES=()
declare -a RESULTS=()
FAILED=0

run_check() {
  local name="$1" dir="$2" deps="$3"; shift 3
  NAMES+=("$name")
  if [ ! -d "$deps/node_modules" ]; then
    RESULTS+=("NICHT GELAUFEN (keine Abhängigkeiten in $deps – bash scripts/cloud-setup.sh)")
    FAILED=1
    return
  fi
  local log="$LOG_DIR/${name// /_}.log"
  if (cd "$dir" && "$@") >"$log" 2>&1; then
    RESULTS+=("OK")
  else
    RESULTS+=("FEHLER (Log: $log)")
    FAILED=1
  fi
}

run_check "Server-Tests" server server npm test
run_check "Client-Tests" client client npm test
run_check "i18n-Check" client client npm run i18n:check
run_check "Lint" . . npm run lint
[ "$RUN_BUILD" = 1 ] && run_check "Client-Build" client client npm run build

# Kennzahlen, die nur sinken sollen (siehe docs/BACKLOG.md)
LINT_WARNINGS="?"
if [ -f "$LOG_DIR/Lint.log" ]; then
  LINT_WARNINGS="$(grep -oE '[0-9]+ warnings?' "$LOG_DIR/Lint.log" | tail -1 | grep -oE '[0-9]+' || echo 0)"
fi
SERVER_TESTS="$(grep -E '^# (pass|fail) ' "$LOG_DIR/Server-Tests.log" 2>/dev/null | tr '\n' ' ')"
CLIENT_TESTS="$(grep -E '^\s+Tests\s' "$LOG_DIR/Client-Tests.log" 2>/dev/null | sed 's/^ *//')"

echo "== Ergebnis =="
for i in "${!NAMES[@]}"; do
  printf '%-14s %s\n' "${NAMES[$i]}:" "${RESULTS[$i]}"
done
echo "-- Kennzahlen --"
echo "Server-Tests:  ${SERVER_TESTS:-?}"
echo "Client-Tests:  ${CLIENT_TESTS:-?}"
echo "Lint-Warnungen: $LINT_WARNINGS"
[ "$RUN_BUILD" = 0 ] && echo "Client-Build:  nicht geprüft (mit --build ausführen)"

exit "$FAILED"
