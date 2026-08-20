# Risk of Rain — HTML Edition

Ein Nachbau von *Risk of Rain 2* als eigenständige HTML-Anwendung.
**Start: Doppelklick auf `risk-of-rain.html`.** Keine Installation, kein
Build-Schritt, keine Internetverbindung, keine einzige Bild- oder Tondatei.

---

## Aktueller Stand

**Stufe 1 abgeschlossen** — Welt, Kamera, Bewegung.

| Stufe | Inhalt | Status |
|---|---|---|
| 1 | Gerüst, prozedurale Stage, Third-Person-Kamera, Bewegung, Fallschaden | ✅ fertig |
| 2 | Kampf: Werte, Schadenspipeline mit Proc-Coefficient, Commando mit vier Skills | offen |
| 3 | 14 Gegner, Combat Director mit Credit-System, Schwierigkeitskoeffizient | offen |
| 4 | ~65 Items mit Stapelverhalten, Kisten, Schreine, 3D-Drucker | offen |
| 5 | Teleporter-Event, fünf Bosse, fünf Stages, Loop | offen |
| 6 | Huntress, Engineer, MUL-T, Artificer, Mercenary | offen |
| 7 | Elite-Affixe, Ausrüstung, Drohnen, Bazaar, Mithrix | offen |
| 8 | Menüs, Freischaltungen, Logbuch, Spielstand | offen |
| 9 | Prozedurale Musik, Partikel, Trefferfeedback | offen |
| 10 | Touch-Steuerung fürs Handy | offen |

## Steuerung

Belegung wie im Original.

| Taste | Funktion | Taste | Funktion |
|---|---|---|---|
| `W A S D` | Bewegen | `E` | Interagieren |
| `Maus` | Umsehen | `Q` | Ausrüstung |
| `Leertaste` | Springen | `R` | Spezialfähigkeit |
| `Strg` | Sprinten (nur vorwärts) | `Shift` | Bewegungsfähigkeit |
| `Maus links` | Grundangriff | `Maus rechts` | Zweitangriff |
| `M` | Pause | `F3` | Technikanzeige |

`Esc` fängt der Browser für den Mauszeiger ab und kommt beim Spiel oft gar nicht
an — darum tut **`M`** dasselbe und funktioniert überall. Ohne Zeigerfang lässt
sich die Kamera auch mit gedrückter linker Maustaste ziehen; das ist der
Rückfallweg, wenn der Browser den Zeigerfang verweigert.

`?seed=12345` in der Adresszeile erzeugt reproduzierbar dieselbe Welt.

---

## Wichtigste technische Randbedingung: `file://`

Das Spiel muss per Doppelklick starten. Damit läuft es über das
`file://`-Protokoll, und das verbietet mehrere sonst übliche Techniken:

| Technik | Unter `file://` | Konsequenz für dieses Projekt |
|---|---|---|
| `<script type="module">` | ❌ von CORS blockiert | Nur klassische `<script src>`-Tags, globaler `ROR`-Namensraum |
| `fetch()` auf lokale JSON | ❌ blockiert | Alle Spieldaten liegen als `.js`-Objekte vor, nicht als `.json` |
| WebGL-Texturen aus lokalen Bildern | ❌ Security-Error | Rein prozedurale Geometrie, Vertex- und Materialfarben |
| `three.module.js` (ES-Modul) | ❌ | Three.js **r160** — die letzte Version mit UMD-Build |

> **r160 ist die letzte Three.js-Version mit `build/three.min.js`.** Ab r161
> gibt es nur noch ES-Module. Ein Versions-Upgrade würde den Doppelklick-Start
> zerstören.

Geprüft: kein `fetch`, kein `XMLHttpRequest`, kein `import`, kein Worker, keine
externen URLs und keine einzige Nicht-Textdatei im gesamten Projekt.

---

## Aufbau

```
risk-of-rain.html          Einstieg — HUD-Markup und die Skript-Reihenfolge
game/
  lib/three.min.js         Three.js r160 (UMD), lokal
  core/
    util.js                Aussäbarer Zufall, Perlin-/Gratrauschen, Mathematik
    input.js               Tastatur und Maus, auf *Aktionen* statt Tastencodes
    camera.js              Verfolgerkamera mit Sichtstrahl gegen Hindernisse
    engine.js              Renderer, Szene, Hauptschleife mit festem Takt
  data/
    stages.js              Stage-Themen: Gelände, Farben, Bewuchs (reine Daten)
  world/
    terrain.js             Höhenfunktion, Geometrie, Vertexfarben, Abfragen
    props.js               Felsen, Bäume, Monolithen, schwebende Plattformen
    stage.js               Aufbau, Licht, Himmel, alle Kollisionsabfragen
  entities/
    player.js              Figur, Bewegung, Laufanimation
  ui/
    style.css              Oberfläche
    hud.js                 Balken, Uhr, Technikanzeige
  main.js                  Verdrahtung und Reihenfolge der Aktualisierer
```

Die Ladereihenfolge in `risk-of-rain.html` **ist** die Abhängigkeitsreihenfolge.
Neue Dateien dort eintragen.

### Die vier Ideen, auf denen alles aufbaut

**Eine Höhenfunktion, eine Wahrheit.** Boden, Klippen und Küste kommen aus
derselben Funktion in `terrain.js`. Ob jemand irgendwo stehen darf, ist daraus
direkt ableitbar (`heightAt`, `slopeAt`) und wird nicht getrennt gepflegt.

**Tafelberge statt Buckel.** Zwei harte Schwellen (`mesaLow`, `mesaHigh`) auf
demselben Rauschfeld ergeben Stufen mit waagerechtem Deckel und steiler Flanke.
Eine gröbere Maske entscheidet, *wo* es Tafelberge gibt; weil sie den Betrag
skaliert, laufen die Plateaus an ihren Rändern von selbst als begehbare Rampe
aus. Gratrauschen allein gäbe nur Spitzen.

**Zwei Kollisionsformen, mehr nicht.** Neben dem Gelände gibt es nur stehende
Zylinder und Kästen. `stage.js` beantwortet damit alle Fragen — `supportAt`,
`ceilingAt`, `pushOut`, `clearance` — für Spieler, Gegner und Kamera
gleichermaßen.

**Fester Simulationstakt.** Die Simulation läuft mit 60 Hz, gezeichnet wird so
schnell der Bildschirm mag. Ohne das hingen Sprunghöhe, Abklingzeiten und später
die Credits des Directors an der Bildrate.

---

## Erweitern

**Neue Stage** — Eintrag in `game/data/stages.js`: Größe, Geländeparameter,
Farbpalette, Anzahl der Streuobjekte, Sonnenstand. Es ist kein Code nötig.

**Gelände abstimmen** — die Parameter unter `terrain` in demselben Eintrag.
`ridgeAmp` ist die Höhe der Tafelberge, `mesaEdge` die Breite ihrer Flanke
(klein = Klippe), `maskScale` bestimmt, wie groß die Plateauregionen ausfallen.

**Etwas Festes hinzufügen** — in `props.js` streuen und einen Eintrag
`{kind:'cyl', …}` oder `{kind:'box', …}` in `solids` legen. Um alles Weitere
kümmert sich `stage.js`.

---

## Auf eine Website legen

Der Ordner ist fertig zum Ablegen: keine absoluten Pfade, alle Verweise relativ,
kein Build. Ordner an eine beliebige Stelle der Website kopieren und auf
`risk-of-rain.html` verlinken. Zum Entfernen: Ordner löschen, Link löschen —
es bleibt nichts zurück. Spielstände laufen später unter dem Präfix `ror2:` in
`localStorage`, damit nichts mit anderen Spielen auf derselben Domain kollidiert.

Lokal mit Server testen:

```bash
python3 -m http.server 8792
```

---

## Rechtliches

Dieses Projekt enthält **keinerlei Material aus dem kommerziellen Spiel** —
keine Modelle, Texturen, Klänge oder Codeteile. Sämtliche Geometrie, Farben und
Effekte entstehen zur Laufzeit im Code. Die Namen von Stages, Survivors und
Items sind als Hommage übernommen; die dahinterliegenden Werte stammen aus dem
öffentlichen Wiki und sind neu implementiert.
