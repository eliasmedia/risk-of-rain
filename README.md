# Risk of Rain — HTML Edition

Ein Nachbau von *Risk of Rain 2* als eigenständige HTML-Anwendung.
**Start: Doppelklick auf `risk-of-rain.html`.** Keine Installation, kein
Build-Schritt, keine Internetverbindung, keine einzige Bild- oder Tondatei.

---

## Aktueller Stand

**Stufe 5 abgeschlossen** — ein Durchlauf ist spielbar: fünf Stages, Teleporter,
Bosse und Loop.

| Stufe | Inhalt | Status |
|---|---|---|
| 1 | Gerüst, prozedurale Stage, Third-Person-Kamera, Bewegung, Fallschaden | ✅ fertig |
| 2 | Kampf: Werte, Schadenspipeline mit Proc-Coefficient, Commando mit vier Skills | ✅ fertig |
| 3 | 14 Gegner, Combat Director mit Credit-System, Schwierigkeitskoeffizient | ✅ fertig |
| 4 | 71 Items mit Stapelverhalten, Kisten, Schreine, 3D-Drucker | ✅ fertig |
| 5 | Teleporter-Event, fünf Bosse, fünf Stages, Loop | ✅ fertig |
| 6a | Startbildschirm, Figurenauswahl, 14 Artefakte | ✅ fertig |
| 6b | Huntress, Engineer, MUL-T, Artificer, Mercenary | ✅ fertig |
| 6c | Charakterdesign aufwerten, Item-Modelle am Körper | ✅ fertig |
| 7 | Elite-Affixe, Ausrüstung, Drohnen, Bazaar, Mithrix | ✅ fertig |
| 8 | Menüs, Freischaltungen, Logbuch, Spielstand | offen |
| 9 | Prozedurale Musik, Partikel, Trefferfeedback | offen |
| 10 | Touch-Steuerung fürs Handy | offen |
| 11 | Grafik-Überarbeitung: alle Modelle, Gelände-Detail, Materialien | offen |

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

In der Adresszeile: `?seed=12345` erzeugt reproduzierbar dieselbe Welt,
`?schwer=drizzle|rainstorm|monsoon` wählt den Schwierigkeitsgrad, `?dummies=1`
stellt die drei Trainingspuppen auf.

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
    difficulty.js          Der Koeffizient, an dem alles hängt
    artifacts.js           Regeln, die man vor dem Start ein- und ausschaltet
    stats.js               Grundwerte + Stufe + Items + Buffs → Endwerte
    buffs.js               Zeitlich begrenzte Zustände, Schaden über Zeit
    body.js                Alles, was Schaden nehmen kann; Trefferkapsel, Strahlen
    damage.js              Schadenspipeline: Abfall, Krit, Rüstung, Proc-Kette
    director.js            Credits, Spawnkarten, Wellen, „zu billig"-Regel
    items.js               Inventar, Auslöser, Stapelkurven, Glück
    loot.js                Beutetabellen, Item-Kugeln, Aufsammeln
  data/
    stages.js              Fünf Stage-Themen: Gelände, Farben, Bewuchs (reine Daten)
    survivors.js           Sechs Figuren: Grundwerte, Aussehen, vier Fähigkeiten
    monsters.js            14 Gegner, 5 Bosse und Mithrix
    elites.js              Fünf Affixe: Werte, Kosten, Sonderregel
    items.js               71 Items als Hook-Sätze
    interactables.js       Kisten, Schreine, Drucker: Preise, Gewichte, Budget
    itemmodels.js          Wie ein Item am Körper aussieht und wo es hängt
  world/
    terrain.js             Höhenfunktion, Geometrie, Vertexfarben, Abfragen
    props.js               Felsen, Bäume, Monolithen, schwebende Plattformen
    stage.js               Aufbau, Licht, Himmel, alle Kollisionsabfragen
    teleporter.js          Das Ereignis: Laden, Bosswelle, Belohnung, Portal
  entities/
    projectile.js          Vorrat an Spuren, Funken und fliegenden Geschossen
    player.js              Figur, Bewegung, Zielen, Ablauf der Fähigkeiten
    monster.js             Sechs Modell-Bauarten und die Gegner-Zustandsmaschine
    interactable.js        Modelle, Bedienung, Scene Director
    survivormodel.js       Der Figurenbau: Silhouetten aus verjüngten Körpern
    attire.js              Items am Körper, Stapeln, Kisten-Enthüllung
    deployable.js          Türme, Minen, Schildkuppel, Wirkbereiche
    dummy.js               Trainingspuppen mit 0, 20 und 100 Rüstung
  ui/
    style.css              Oberfläche
    hud.js                 Balken, Fähigkeiten, Schadenszahlen, Technikanzeige
    menus.js               Startbildschirm, Figuren- und Artefaktauswahl
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

**Eine Zahl treibt die ganze Kurve.** Der Schwierigkeitskoeffizient wächst mit
der Zeit und springt bei jeder abgeschlossenen Stage. Aus ihm folgen Gegnerstufe,
die Credits des Directors, Erfahrung, Gold *und* die Preise der Kisten. Es gibt
keine Wellentabelle: dass aus einzelnen Käfern erst Rudel und dann Minibosse
werden, ist eine Folge davon, dass der Director mehr Credits bekommt und sie
möglichst vollständig ausgibt. Die „zu billig"-Regel — mehr als das Sechsfache
des gewählten Gegners auf dem Konto heißt neu würfeln — ist das Scharnier, an
dem er vom Sparen ins Klotzen kippt.

**Der Teleporter ist der Konflikt, nicht nur ein Ausgang.** Er lädt 90 Sekunden,
aber nur, solange man im Umkreis von 60 m bleibt — genau dort, wo gleichzeitig
ein Boss und der verstärkte Nachschub des Directors auf einen zulaufen. Ohne
diese Bedingung wäre er ein Knopf; mit ihr ist er die Stelle, an der ein
Durchlauf kippt.

**Bosse haben `attacks` statt eines Musters.** Die Zustandsmaschine sucht sich
die erste Fähigkeit, die bereit ist und deren Reichweite passt. Dadurch wirken
sie nicht wie ein Gegner mit mehr Leben, sondern haben einen erkennbaren
Rhythmus: der Stone Titan wechselt zwischen Faust, Augenlaser und Steinsalve,
der Clay Dunestrider pflanzt sich ein und saugt Leben, solange man stehen bleibt.

**Ein Item ist ein Dateneintrag, kein Sonderfall.** Kein Kampfcode kennt ein
einzelnes Item. Ein Item ist ein Satz Hooks — `stats`, `onHit`, `onKill`,
`onDamaged`, `onIncoming`, `onHealed`, `onInterval`, `damageMod` —, und
`sim/items.js` ruft sie auf. Damit das bei sechs Schuss je Sekunde und vierzig
Gegnern nicht teuer wird, sind die Hooks je Figur vorsortiert: wer kein
`onHit` besitzt, taucht in der onHit-Liste gar nicht erst auf.

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

**Neuen Gegner** — Eintrag in `game/data/monsters.js`: Werte, `cost` (die
Director-Credits, aus denen auch Erfahrung und Gold folgen), eine der sechs
`shape`-Bauarten und ein `ai`-Profil (`melee`, `ranged`, `charger`, `suicide`,
`turret`). Geometrie muss keine geschrieben werden. `stages` steuert, auf
welchen Stages er im Deck landen kann.

**Neues Item** — Eintrag in `game/data/items.js`. Nur die Hooks angeben, die
das Item braucht; Stufe, Stapelart und Beschreibung stehen daneben. Für Chancen
immer `ROR.Items.roll(body, chance × proc)` benutzen — das berücksichtigt den
Proc-Coefficient *und* das Glück aus dem 57 Leaf Clover.

**Neues Objekt auf der Stage** — Eintrag in `game/data/interactables.js` mit
`baseCost`, `directorCost` und `weight`, dazu ein Fall in `BUILDERS` und in
`use()` in `game/entities/interactable.js`.

**Neue Stage** — Eintrag in `game/data/stages.js` mit `order`. Kommen mehrere
Themen auf denselben Platz, wird beim Betreten eines davon gezogen. Das
„Meer" ist nur eine eingefärbte Ebene: in den Abyssal Depths ist es Lava, in
Sky Meadow sind es Wolken.

**Neuen Boss** — wie ein Gegner, aber mit `category: 'champion'`, `isBoss: true`
und einem `attacks`-Feld. Angriffsarten: `shot`, `slam`, `beam`, `summon`,
`drain`. `belowHealth` macht eine Fähigkeit zur letzten Karte, die erst unter
einem Lebensanteil gespielt wird.

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

### Auf eliasmedia.at

Das Spiel liegt dort als eigener Ordner `risk-of-rain/` neben `pokemon/` und
`minecraft/` und ist unter **eliasmedia.at/risk-of-rain** erreichbar. Der einzige
Unterschied zum Projektordner: der Einstieg heißt dort `index.html` statt
`risk-of-rain.html`, damit die Adresse ohne Dateinamen funktioniert.

Abgleich mit einem Befehl:

```bash
./deploy.sh --push
```

Das kopiert `game/` und den Einstieg ins Website-Repo, committet und lädt hoch.
Ohne `--push` wird nur kopiert. Liegt das Website-Repo woanders, hilft
`ROR_WEB=/pfad/zum/repo ./deploy.sh`.

---

## Was Stufe 7 gebracht hat

**Elite-Affixe.** Derselbe Gegner, nur mit einer zusätzlichen Regel und einer
Hülle, an der man ihn von weitem erkennt. Der Director entscheidet über den
Preis: Stufe 1 kostet das Sechsfache, Stufe 2 das Sechsunddreißigfache — er
kauft im Loop also nicht *mehr* Gegner, sondern *bessere*.

| Affix | Stufe | Leben · Schaden | Regel |
|---|---|---|---|
| Blazing | 1 | ×4 · ×2 | setzt in Brand, hinterlässt eine Feuerspur |
| Overloading | 1 | ×4 · ×2 | trägt Schild statt Leben, schlägt mit Blitzen |
| Glacial | 1 | ×4 · ×2 | verlangsamt, zerspringt beim Tod |
| Malachite | 2 | ×18 · ×6 | **blockiert Heilung**, speit Stachelkugeln |
| Celestine | 2 | ×18 · ×6 | heilt seine Gruppe, blinzelt aus dem Beschuss |

Damit sind auch die letzten beiden Artefakte spielbar: **Honor** (nur noch
Elites) und **Vengeance** (ein Doppelgänger mit deinen Items je Stage).

**Sechs weitere Ausrüstungen** (jetzt zwölf), **Drohnen** zum Kaufen, die
neben einem herfliegen und mitschießen oder heilen, und der **Bazaar Between
Time**: über den Newt-Altar erreichbar, Mondkapseln gegen Mondmünzen,
Reinigungsbecken zum Ablegen eines Lunar-Items.

**Mithrix auf Commencement** als Ende des Laufs — drei Abschnitte über
`belowHealth`: Hammer, dann Säulen und Kugeln, zuletzt der **Diebstahl**. Er
nimmt einem alle Items ab und wird selbst stärker; mit seinem Tod kommen sie
zurück. Nach Sky Meadow führt das Portal im ersten Durchgang dorthin, danach
in den Loop.

Zwei Fehler dabei gefunden:

* **`healMult = 0` wurde durch einen `|| 1`-Rückfall aufgehoben.** Malachites
  Heilblockade war damit wirkungslos — und dieselbe Zeile hätte auch jedes
  künftige Item mit Faktor 0 stillschweigend entschärft.
* **Der Bazaar behielt die Stage-Nummer seiner Herkunft.** Dadurch bekam er
  einen normalen Teleporter statt des Ausgangs.

Gemessen: Blazing Beetle 320 Leben und 24 Schaden (×4/×2), Malachite 1440
(×18); der Director wählt bei 4000 Credits Malachite und bei 400 noch gar
keinen Affix; Mithrix stiehlt sechs Items und gibt sie beim Tod zurück; der
Weg Stage 3 → Bazaar → Stage 4 und Sky Meadow → Commencement → Loop 1 stimmt.

## Was Stufe 6c gebracht hat

**Die Figuren sehen nicht mehr aus wie Minecraft Steve.** Das Mittel dazu sind
*verjüngte Körper* statt Quader — ein Prisma mit vier bis acht Seiten, oben und
unten verschieden breit. Das kostet nicht mehr als ein Kasten, ergibt aber
Schultern, Taillen und Helme statt Kisten. Jede Silhouette erzählt ihre
Spielweise:

| Figur | Woran man sie erkennt |
|---|---|
| Commando | Mantel mit Schößen, Mütze, Schal — der Soldat von der Stange |
| Huntress | Schmal, Kapuze ohne Gesicht, Umhang, Zopf, Glaive-Scheibe |
| Engineer | Breite Brustplatte, Helm mit Lampe, Werkzeuggurt, Rucksack |
| MUL-T | **Kein Kopf**, ein Sensorbalken auf einem Fahrgestell, zwei Drucktanks, Stelzen |
| Artificer | Bodenlanger Mantel, **keine sichtbaren Beine**, Schubdüsen, Stab mit Kern |
| Mercenary | Wespentaille, glatter Visierschädel, Energieklinge |

**Items hängen sichtbar am Körper und stapeln.** Drei Brechstangen sind drei
Brechstangen auf dem Rücken. 62 Items haben ein eigenes Modell mit
Befestigungspunkt (Rücken, Schulter, Brust, Gürtel, Kopf, kreisend); der Rest
bekommt eine Marke in der Farbe seiner Stufe, damit *jedes* Item sichtbar ist.
Gedeckelt bei fünf Stück je Item und 46 insgesamt — sonst verschwindet die
Figur im Loop unter hundert Brechstangen. Seltenes wird zuerst gezeigt.

**Die Kisten-Enthüllung.** Das Item steigt aus der Kiste auf, dreht sich einen
Moment in Augenhöhe — lange genug, dass man es erkennt — und springt dann im
Bogen auf die Figur. Gemessen: aufsteigen 0.45 s, schweben bis 1.1 s, Flug und
Aufnahme bei 1.25 s, und im selben Moment erscheint der Anbau am Körper.

Der Anbau wird nur neu gebaut, wenn sich das Inventar wirklich geändert hat —
bei sechzig Bildern je Sekunde wäre ein Neuaufbau je Bild sonst die teuerste
Stelle im Spiel.

## Was Stufe 6b gebracht hat

Alle sechs Figuren, jede mit eigener Spielweise statt anderer Zahlen:

| Figur | Werte | Was sie ausmacht | DPS im Prüfstand |
|---|---|---|---|
| Commando | 110 · 12 | Allrounder, alles auf Reichweite | 102 |
| Huntress | 90 · 12 | **Zielt nicht selbst** — trifft alles in 60 m, muss aber nah ran | 83 |
| Engineer | 130 · 14 | Stellt Türme, Minen und eine undurchdringliche Kuppel auf | 72 |
| MUL-T | 200 · 11 · 12 Rüstung | Trägt **zwei Primärwaffen** und schaltet um | 95 |
| Artificer | 110 · 12 | Aufladbare Bombe, Eiswand, dreisekündiger Flammenstrahl | 77 |
| Mercenary | 110 · 12 · 20 Rüstung | Nahkampf, zwei Sprünge, dreifacher Satz mit Rückgabe bei Treffer | 74 |

Dafür kamen vier neue Mechaniken dazu, die es vorher nicht gab: **Aufladen**
(halten und loslassen), **Waffenwechsel** auf demselben Platz, ein
verallgemeinerter **Sprintangriff** (Rolle, Ansturm und Sprung sind derselbe
Vorgang mit anderen Zahlen) und **Aufstellbares** — Türme erben Leben, Schaden
*und damit alle Items* ihres Erbauers, genau wie in der Vorlage.

Ein echter Fehler dabei gefunden: **der Nahkampf maß bis zum Mittelpunkt des
Gegners.** An einem Stone Titan stand man damit mitten in ihm drin und traf
nichts, weil sein Mittelpunkt weiter weg liegt als jede Klinge reicht. Jetzt
wird bis zur Hülle gemessen — die Mercenary ging dadurch von 16 auf 74 DPS.

## Was Stufe 6a gebracht hat

Ein Startbildschirm mit Figurenauswahl, Regenstärke, Seed-Feld und **14
Artefakten**. Ein Artefakt ist keine Verstärkung, sondern eine Änderung der
Spielregeln — und genau deshalb fragen die betroffenen Stellen gezielt nach
(`ROR.Artifacts.on('swarms')`) statt über ein allgemeines Hookregister zu
laufen: bei vierzehn Artefakten ist beim Lesen sofort klar, wer worauf reagiert.

Alle sind von Anfang an verfügbar; Freischaltungen kommen mit Stufe 8. *Honor*
und *Vengeance* stehen in der Liste, sind aber gesperrt — sie brauchen Elites
beziehungsweise den Doppelgänger aus Stufe 7.

| Artefakt geprüft | Wirkung | Ergebnis |
|---|---|---|
| Glass | ×5 Schaden, ×0.1 Leben | 60 Schaden, 11 Leben |
| Sacrifice | keine Kisten, Gegner lassen fallen | 0 Kisten, 5.3 % Fundrate aus 400 Kills |
| Swarms | doppelter Zufluss, halbes Gegnerleben | 2×, Beetle 40 statt 80 |
| Kin | eine Gegnerart je Stage | Deck auf eine Art reduziert |
| Dissonance | Gegner aller Stages | Imp und Brass Contraption auf Stage 1 |
| Frailty | Sturz doppelt und tödlich | tötet; ohne Artefakt bleibt 1 Leben |
| Chaos | Eigenbeschuss | eigene Explosion trifft |
| Command | Auswahl statt Zufall | drei Vorschläge, Spiel hält an |
| Rebirth + Enigma | Dio's und zufällige Ausrüstung | beides beim Start da |

Dazu drei Korrekturen aus der Rückmeldung:

* **Gold wird beim Stagewechsel zu Erfahrung.** Das hält die Wirtschaft in
  Bewegung — drüben fängt man wieder bei null an, statt mit einem Berg Gold
  anzukommen. Der Goldregen des Teleporters ist deshalb dazu da, *noch auf
  dieser Stage* ausgegeben zu werden.
* **Der Schild hat eine eigene Leiste über dem Lebensbalken.** Im Balken selbst
  war nicht zu erkennen, ob die blaue Fläche Schild oder fehlendes Leben ist.
* **Der Schild lädt sich überhaupt erst auf.** `maxShield` gab es, aber nichts
  füllte ihn je — jeder Schildpunkt war ein Einwegartikel. Jetzt lädt er nach
  sieben ungestörten Sekunden in zwei Sekunden voll.

> Die Artefaktwerte stammen aus vorhandener Kenntnis der Vorlage; der
> Wiki-Abruf war bei diesem Schritt nicht verfügbar. Sie sind beim nächsten
> Durchgang gegenzuprüfen.

## Was Stufe 5 gebracht hat

Ab hier ist es ein Durchlauf und keine Sandkiste mehr. Fünf Stages mit eigenem
Klima, das Teleporter-Ereignis, fünf Bosse und der Loop.

| Geprüft | Soll | Ist |
|---|---|---|
| Teleporter-Ladung außerhalb des Umkreises | 0 % | 0 % |
| … fünf Sekunden innerhalb | 5.6 % | 5.6 % |
| Stagesprung des Koeffizienten | ×1.15 | ×1.15 (sieben Wechsel in Folge) |
| Stage-Reihenfolge und Loop | 1→2→3→4→5→1, Loop +1 | wie erwartet |
| Objekte je Stage (Budget 220 / 320 / 400 / 520) | mehr pro Stage | 14–19 / 22–24 / 32 / 34 |
| Stone Titan auf Stufe 3 | 3360 Leben, 56 Schaden | 3360 / 56 |
| Alle fünf Bosse | Modell, Werte, Angriffe | gebaut, alle greifen an |
| Teleporter-Entfernung vom Start | weit genug für einen Weg | 79–118 m |

Ein simulierter Durchlauf: Titanic Plains in 93 Sekunden geräumt — Teleporter
gefunden, aktiviert, Beetle Queen besiegt, Portal genommen. Items, Stufe und
Gold gehen mit auf die nächste Stage, der Koeffizient springt auf 1.33.

Unterwegs korrigiert: der Lichtstrahl des Teleporters ist ein Wegweiser für die
Ferne — aus der Nähe stand man hinter einem neunzig Meter hohen Vorhang. Er
blendet sich jetzt unter zwölf Metern aus.

## Was Stufe 4 gebracht hat

71 Items über sechs Stufen, dazu Kisten, Schreine, Drucker und Scrapper. Alle
Wahrscheinlichkeiten und Stapelkurven sind gegen die Vorlage nachgemessen:

| Geprüft | Soll | Ist |
|---|---|---|
| Kiste | 79.2 / 19.8 / 0.99 % | 79.32 / 19.67 / 1.00 (200 000 Züge) |
| Große Kiste | 80 / 20 % | 80.14 / 19.86 |
| Schrein des Zufalls | 45 / 36 / 9 / 9 / 1 % | 44.86 / 36.11 / 9.04 / 8.97 / 1.02 |
| Soldier's Syringe ×5 | Angriffstempo 1.75 | 1.75 |
| Alien Head ×2 | 0.75² = 0.5625 | 0.5625 |
| Shaped Glass ×2 | Schaden ×4, Leben ×0.25 | 48 / 27.5 |
| Tougher Times ×1 / ×5 / ×20 | 13.0 / 42.9 / 75.0 % | 12.7 / 43.0 / 75.7 |
| Repulsion Armor Plate ×2 | 30 → 20, mindestens 1 | 20 / 1 |
| Crowbar bei vollem / halbem Leben | 21 / 12 | 21 / 12 |
| Proc-Coefficient 1 / 0.5 / 0.2 / 0 | 1600 / 800 / 320 / 0 | 1603 / 801 / 329 / 0 |
| 57 Leaf Clover auf 5 % | 9.75 % | 9.59 % |

**Der Proc-Coefficient zahlt sich hier aus.** Die Messreihe oben ist der Beleg:
Auslösungen skalieren exakt linear mit dem Faktor des Treffers. Ohne ihn wäre
jede Mehrfach-Waffe achtmal so stark wie eine einzelne.

Ein simulierter Durchlauf über vier Minuten (Seed 31337): 63 Kills, 13 Items,
Stufe 5, 16 von 18 Objekten benutzt, Kistenpreis von 25 auf 39 gestiegen. Genau
die Form, die die Vorlage in ihrer ersten Stage hat.

**Zwei bewusste Vereinfachungen.** Drucker und Scrapper haben kein
Auswahlfenster: der Drucker frisst zuerst Schrott und sonst das häufigste Item
seiner Stufe, der Scrapper zerlegt das häufigste billigste. Was passieren wird,
steht in der Aufforderung, bevor man drückt. Und die Itemleiste zeigt
Anfangsbuchstaben statt Symbolen — Symbole bräuchten entweder Bilddateien
(unter `file://` verboten) oder eigens gezeichnete Icons; das steht in Stufe 9.

## Was Stufe 3 gebracht hat

Die Kurve läuft. Der Director sammelt Credits, gibt sie aus, und aus dieser
einen Mechanik entsteht die ganze Eskalation — nachgemessen über dreißig
simulierte Minuten:

| Zeit / Stages | coeff | Gegnerstufe | Anzeige | Was gespawnt wurde |
|---|---|---|---|---|
| 1 min / 0 | 1.1 | 1 | Easy | nur Beetles |
| 10 min / 1 | 2.3 | 5 | Easy | Beetle, Lemurian, Bison, Blind Pest |
| 15 min / 2 | 3.3 | 8 | Normal | dazu Stone Golem |
| 25 min / 4 | 6.2 | 17 | Very Hard | dazu Beetle Guard (Miniboss) |
| 30 min / 5 | 8.1 | 23 | Very Hard | Rudel aus Beetles und Guards |

Weitere Messungen: der Koeffizient stimmt für alle drei Schwierigkeitsgrade und
für 1 bis 4 Spieler mit der Formel überein; Gegnerwerte auf Stufe 5 treffen
+30 % Leben und +20 % Schaden je Stufe exakt (Beetle 176 / 21.6); Erfahrung und
Gold folgen `coeff × wert × 0.2` bzw. dem Doppelten; Kisten kosten auf Stage 1
genau 25 und nach 15 Minuten und drei Stages 134. Ein simulierter Durchlauf über
90 Sekunden: 23 Kills, 180 erlittener Schaden, Tiefstand bei 24 von 143 Leben,
79 Gold — knapp, aber überlebbar.

Die Trainingspuppen aus Stufe 2 sind jetzt ein Prüfwerkzeug und stehen nur noch
auf Anforderung da: `risk-of-rain.html?dummies=1`. Ebenso lässt sich mit
`?schwer=monsoon` der Schwierigkeitsgrad wählen.

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
