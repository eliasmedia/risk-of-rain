# Risk of Rain — HTML Edition

Ein Nachbau von *Risk of Rain 2* als eigenständige HTML-Anwendung.
**Start: Doppelklick auf `risk-of-rain.html`.** Keine Installation, kein
Build-Schritt, keine Internetverbindung, keine einzige Bild- oder Tondatei.

---

## Aktueller Stand

**Stufe 2 abgeschlossen** — Welt, Kamera, Bewegung, Kampf.

| Stufe | Inhalt | Status |
|---|---|---|
| 1 | Gerüst, prozedurale Stage, Third-Person-Kamera, Bewegung, Fallschaden | ✅ fertig |
| 2 | Kampf: Werte, Schadenspipeline mit Proc-Coefficient, Commando mit vier Skills | ✅ fertig |
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
| `W A S D` | Bewegen | | |
| `Maus` | Zielen | `E` | Interagieren (ab Stufe 4) |
| `Leertaste` | Springen | | |
| `Strg` | Sprinten (nur vorwärts) | `Q` | Ausrüstung (ab Stufe 7) |
| `Maus links` | Double Tap | `Maus rechts` | Phase Round |
| `Shift` | Tactical Dive | `R` | Suppressive Fire |
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
  sim/
    stats.js               Grundwerte + Stufe + Items + Buffs → Endwerte
    buffs.js               Zeitlich begrenzte Zustände, Schaden über Zeit
    body.js                Alles, was Schaden nehmen kann; Trefferkapsel, Strahlen
    damage.js              Schadenspipeline: Abfall, Krit, Rüstung, Proc-Kette
  data/
    stages.js              Stage-Themen: Gelände, Farben, Bewuchs (reine Daten)
    survivors.js           Figuren: Grundwerte, Aussehen, vier Fähigkeiten
  world/
    terrain.js             Höhenfunktion, Geometrie, Vertexfarben, Abfragen
    props.js               Felsen, Bäume, Monolithen, schwebende Plattformen
    stage.js               Aufbau, Licht, Himmel, alle Kollisionsabfragen
  entities/
    projectile.js          Vorrat an Spuren, Funken und fliegenden Geschossen
    player.js              Figur, Bewegung, Zielen, Ablauf der Fähigkeiten
    dummy.js               Trainingspuppen mit 0, 20 und 100 Rüstung
  ui/
    style.css              Oberfläche
    hud.js                 Balken, Fähigkeiten, Schadenszahlen, Technikanzeige
  main.js                  Verdrahtung und Reihenfolge der Aktualisierer
```

Die Ladereihenfolge in `risk-of-rain.html` **ist** die Abhängigkeitsreihenfolge.
Neue Dateien dort eintragen.

### Die Ideen, auf denen alles aufbaut

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
die Credits des Directors an der Bildrate. Der Feuertakt *verrechnet* seinen
Rest, statt ihn zurückzusetzen — sonst kämen aus doppeltem Angriffstempo nur
neun statt zwölf Schuss je Sekunde, und jedes Angriffstempo-Item wäre
stillschweigend schwächer als angeschrieben.

**Der Proc-Coefficient von Anfang an.** Jeder Treffer trägt einen Faktor mit:
Nahkampf 1.0, Dauerfeuer 0.2, Flächenschaden 0.0. On-Hit-Items würfeln mit
`chance × proc` statt mit `chance`. Ohne das würde eine Schrotladung aus acht
Kugeln achtmal so oft auslösen wie ein einzelner Schuss — und Ukulele, AtG und
Gasoline wären in Stufe 4 nicht mehr auszubalancieren. Nachrüsten ginge nicht,
ohne jede Fähigkeit noch einmal anzufassen.

**Fadenkreuz und Einschlag sind dieselbe Richtung.** Die Kamera bekommt ihre
Ausrichtung direkt aus Gier und Nick, nicht über `lookAt` auf die Figur. Sonst
laufen beide auseinander: die Kamera steht seitlich versetzt, und der Schuss
ginge sichtbar am Fadenkreuz vorbei. Gezielt wird zweistufig — der Strahl geht
von der Kamera durch die Bildmitte und sucht den Zielpunkt, geschossen wird von
der Mündung *dorthin*.

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

**Neue Figur oder Fähigkeit** — Eintrag in `game/data/survivors.js`. Eine
Fähigkeit ist ein Objekt mit `mode` (`auto`, `press` oder `stance`) und einer
`fire`-Funktion; wann sie gerufen wird, entscheidet der Ablaufteil in
`player.js`. Schadensprozente kommen als `coefficient` in den Aufruf von
`ROR.Projectiles`, nicht als absolute Zahl — dadurch skaliert alles von selbst
mit Stufe und Items.

**Neuen Buff** — Eintrag in `DEFS` in `game/sim/buffs.js`. `modify(body, out)`
verändert Werte, `dot` teilt regelmäßig Schaden aus. Dass Buffs überhaupt auf
Werte wirken, weiß `stats.js` nicht — `buffs.js` meldet sich über
`ROR.Stats.addModifier` an. Items gehen in Stufe 4 denselben Weg.

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

## Was Stufe 2 gebracht hat

Die Kampfschicht steht und ist gegen die Werte der Vorlage gemessen, nicht
geschätzt. Am Startpunkt stehen drei Trainingspuppen mit 0, 20 und 100 Rüstung:
dieselbe Kugel muss darauf 100 %, 83 % und 50 % anzeigen. Damit ist die
Rüstungsformel im Spiel ablesbar statt nur im Quelltext behauptet.

| Gemessen | Soll | Ist |
|---|---|---|
| Commando Stufe 1 | 110 Leben, 12 Schaden | 110 / 12 |
| Commando Stufe 5 | 242 Leben, 21.6 Schaden | 242 / 21.6 |
| Double Tap | 6 Schuss/s, 100 % | 18 Schuss in 3 s, 12.0 je Treffer |
| … bei Angriffstempo 2 / 3 | 12 / 18 Schuss/s | 36 / 54 in 3 s |
| Entfernungsabfall | 100 % bis 25 m, 50 % ab 60 m | 40 m → 9.61, 60 m → 6.18, 80 m → 6.00 |
| Rüstung 0 / 20 / 100 | 12 / 10 / 6 | 12 / 10 / 6 |
| Phase Round, drei Ziele | 36 / 50.4 / 64.8 vor Rüstung | 36 / 42 / 32.4 nach Rüstung |
| Suppressive Fire | 6 Kugeln in 1 s, betäubt | 6, Tempo des Ziels auf 0 |
| Fadenkreuz gegen Schussrichtung | 0° | 0° |
| 90 s Zufallsspiel | keine Fehler, kein NaN | 0 / 0 |

## Rechtliches

Dieses Projekt enthält **keinerlei Material aus dem kommerziellen Spiel** —
keine Modelle, Texturen, Klänge oder Codeteile. Sämtliche Geometrie, Farben und
Effekte entstehen zur Laufzeit im Code. Die Namen von Stages, Survivors und
Items sind als Hommage übernommen; die dahinterliegenden Werte stammen aus dem
öffentlichen Wiki und sind neu implementiert.
