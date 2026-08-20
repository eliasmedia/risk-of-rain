#!/bin/sh
# deploy.sh — legt das Spiel im Website-Repo ab.
#
# Auf der Website heißt der Einstieg `index.html` statt `risk-of-rain.html`,
# damit eliasmedia.at/risk-of-rain direkt funktioniert. Sonst ist es
# derselbe Ordner: keine Pfade werden umgeschrieben, keine Datei verändert.
#
#   ./deploy.sh              nur kopieren
#   ./deploy.sh --push       kopieren, committen und hochladen
set -e

QUELLE="$(cd "$(dirname "$0")" && pwd)"
WEB="${ROR_WEB:-$QUELLE/../eliasmedia-website}"
ZIEL="$WEB/risk-of-rain"

[ -d "$WEB/.git" ] || { echo "Website-Repo nicht gefunden: $WEB" >&2; exit 1; }

mkdir -p "$ZIEL"
# --delete, damit entfernte Dateien auch drüben verschwinden.
rsync -a --delete "$QUELLE/game/" "$ZIEL/game/"
cp "$QUELLE/risk-of-rain.html" "$ZIEL/index.html"
cp "$QUELLE/README.md" "$ZIEL/README.md"

echo "kopiert nach $ZIEL"
echo "  $(find "$ZIEL" -type f | wc -l | tr -d ' ') Dateien, $(du -sh "$ZIEL" | cut -f1)"

if [ "$1" = "--push" ]; then
  BOTSCHAFT="${2:-risk-of-rain: Stand aus dem Spielrepo uebernommen}"
  cd "$WEB"
  git add risk-of-rain
  if git diff --cached --quiet; then
    echo "nichts zu committen"
  else
    git -c user.name="Elias Lechner" -c user.email="eliaslechner0@gmail.com" \
        commit -q -m "$BOTSCHAFT"
    # Am Website-Repo arbeiten auch andere Sitzungen. Erst nachziehen, sonst
    # weist der Server den Push ab. `autoStash` rettet dabei nicht
    # eingecheckte Arbeit an der Seite selbst.
    git -c rebase.autoStash=true pull --rebase -q origin "$(git branch --show-current)"
    git push -q origin HEAD
    echo "auf die Website gepusht"
  fi
fi
