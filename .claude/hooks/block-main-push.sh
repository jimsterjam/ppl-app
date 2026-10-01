#!/usr/bin/env bash
# PreToolUse-Hook: verhindert, dass Claude auf `main` pusht oder dort Dateien ändert.
# Absprache mit Paul: Änderungen laufen immer über einen eigenen Branch + PR,
# Merge auf `main` macht nur Paul selbst (siehe CLAUDE.md, Abschnitt "Cloud-Sessions").
#
# Geprüft werden:
#   - Bash: jedes `git push`, das `main` als Ziel hat (explizit, z.B. `origin main`,
#     `HEAD:main`, `refs/heads/main`), `--all`/`--mirror`, oder ein `git push` ohne
#     Ziel-Branch, während der aktuelle Branch `main` ist.
#   - GitHub-MCP-Tools, die direkt in einen Branch schreiben (push_files,
#     create_or_update_file, delete_file), wenn branch = main.
# Exit-Code 2 blockiert den Tool-Aufruf; die Meldung auf stderr bekommt Claude zu sehen.
set -uo pipefail

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"

block() {
  echo "Blockiert: $1 Änderungen nur über eigenen Branch + Pull Request; Merge auf main macht Paul selbst." >&2
  exit 2
}

case "$tool" in
  Bash)
    cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
    # In Einzelbefehle zerlegen (&&, ||, ;, |, Zeilenumbruch). Nur Teile, die mit `git` beginnen,
    # zählen - sonst würde z.B. eine Commit-Nachricht, die "git push auf main" erwähnt, blockiert.
    segments="$(printf '%s\n' "$cmd" | sed -E 's/(&&|\|\||;|\|)/\n/g')"
    while IFS= read -r seg; do
      printf '%s' "$seg" | grep -Eq '^[[:space:]]*(sudo[[:space:]]+)?git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push([[:space:]]|$)' || continue

      if printf '%s' "$seg" | grep -Eq '[[:space:]]--(all|mirror)([[:space:]]|$)'; then
        block "git push --all/--mirror."
      fi
      # Ziel main: "main", "HEAD:main", "+main", "refs/heads/main" als eigenes Argument bzw. nach ":"/"+".
      if printf '%s' "$seg" | grep -Eq '(^|[[:space:]:+])(refs/heads/)?main([[:space:]]|$)'; then
        block "git push auf main."
      fi
      # Ohne Ziel-Branch (z.B. "git push" oder "git push -u origin") gilt der aktuelle Branch.
      args="$(printf '%s' "$seg" | sed -E 's/.*[[:space:]]push([[:space:]]|$)//')"
      positional=0
      for a in $args; do
        case "$a" in -*) ;; *) positional=$((positional + 1)) ;; esac
      done
      if [ "$positional" -le 1 ]; then
        current="$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null || true)"
        if [ "$current" = "main" ]; then
          block "git push ohne Ziel-Branch, während main ausgecheckt ist."
        fi
      fi
    done <<< "$segments"
    ;;
  mcp__github__push_files | mcp__github__create_or_update_file | mcp__github__delete_file)
    branch="$(printf '%s' "$input" | jq -r '.tool_input.branch // empty')"
    if [ "$branch" = "main" ]; then
      block "$tool direkt auf main."
    fi
    ;;
esac

exit 0
