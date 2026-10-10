#!/usr/bin/env bash
# Each world in book-universe/ is its own LOCAL git repo: fully versioned, never pushed.
#
#   tools/world-repo.sh init   <World>            create the repo (or re-apply the guards)
#   tools/world-repo.sh commit <World> "<msg>"    commit all changes in that world (no-op if clean)
#   tools/world-repo.sh status [<World>]          short status of one or all worlds
#   tools/world-repo.sh check                     verify every world is a guarded, unpushable repo
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="$ROOT/book-universe"
HOOKS="$ROOT/tools/hooks/world"

worlds() { for d in "$VAULT"/*/; do [ -f "$d/World.md" ] && basename "$d"; done; return 0; }
dir_of() { local d="$VAULT/$1"; [ -f "$d/World.md" ] || { echo "No world '$1' (expected $d/World.md)" >&2; exit 1; }; echo "$d"; }

guard() { # make pushing impossible, even with --no-verify or after adding a remote
  git -C "$1" config url."worlds-are-never-pushed://blocked/".pushInsteadOf ""
  git -C "$1" config push.default nothing
  git -C "$1" config core.hooksPath "$HOOKS"
}

case "${1:-}" in
  init)
    d="$(dir_of "${2:?world name}")"
    if [ ! -d "$d/.git" ]; then
      git -C "$d" init -q -b main
      cat > "$d/.gitignore" <<'IGN'
.DS_Store
.obsidian/workspace*.json
IGN
      guard "$d"
      git -C "$d" add -A
      git -C "$d" -c commit.gpgsign=false commit -qm "World created: $2" && echo "✓ $2: new local repo (never pushed)"
    else
      guard "$d"; echo "✓ $2: guards re-applied"
    fi ;;
  commit)
    d="$(dir_of "${2:?world name}")"; msg="${3:?commit message}"
    [ -d "$d/.git" ] || "$0" init "$2" >/dev/null
    guard "$d"
    git -C "$d" add -A
    if git -C "$d" diff --cached --quiet; then echo "· $2: nothing to commit"; else git -C "$d" -c commit.gpgsign=false commit -qm "$msg" && echo "✓ $2: $msg"; fi ;;
  status)
    if [ -n "${2:-}" ]; then list=("$2"); else mapfile -t list < <(worlds); fi
    for w in "${list[@]}"; do d="$(dir_of "$w")"
      if [ -d "$d/.git" ]; then echo "== $w ($(git -C "$d" rev-list --count HEAD 2>/dev/null || echo 0) commits)"; git -C "$d" status --short | head -20
      else echo "== $w (not versioned yet: tools/world-repo.sh init \"$w\")"; fi
    done ;;
  check)
    bad=0
    mapfile -t list < <(worlds)
    [ ${#list[@]} -eq 0 ] && { echo "No worlds yet."; exit 0; }
    for w in "${list[@]}"; do d="$VAULT/$w"
      if [ ! -d "$d/.git" ]; then echo "✗ $w: not a repo"; bad=1; continue; fi
      [ "$(git -C "$d" config --get url.worlds-are-never-pushed://blocked/.pushInsteadOf || echo missing)" = "" ] || { echo "✗ $w: push guard missing"; bad=1; }
      [ -n "$(git -C "$d" remote)" ] && echo "! $w: has a remote ($(git -C "$d" remote | tr '\n' ' ')); pushes are still blocked"
    done
    [ $bad = 0 ] && echo "✓ all worlds are local, versioned and unpushable" || { echo "Run: tools/world-repo.sh init <World>"; exit 1; } ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
