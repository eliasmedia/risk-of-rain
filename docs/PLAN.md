# Risk of Rain 2 — HTML-Nachbau · Bauplan

## Kontext

Risk of Rain 2 als eigenständige HTML-App nachbauen — ein 3D-Roguelike, in dem
man mit einem von sechs Survivors durch Stages läuft, Gegner tötet, Gold sammelt,
an Kisten stapelbare Items zieht und dabei zusieht, wie die globale Schwierigkeit
mit jeder Minute und jeder Stage weiterläuft. Der Reiz liegt nicht im Level-Design,
sondern in der **Kurve**: bleib länger, hol mehr Items, aber die Gegner wachsen
schneller als du.

Die App soll wie `pokemon-html` und `minecraft-html` funktionieren: **ein Ordner,
per Doppelklick startbar, jederzeit auf die Website legbar und rückstandsfrei
wieder entfernbar.** Keine Build-Tools, keine externen Assets, kein Netzwerk.

Entschieden: **3D mit Three.js**, Umfang **Kern-Erlebnis** (6 Survivors, ~65 Items,
14 Gegner + 5 Bosse, 5 Stages + Loop), **mit Touch-Steuerung**.

---

## Recherche-Ergebnis: die Zahlen, die das Spiel ausmachen

Das ist der Kern — alles andere ist Ausschmückung. Diese Formeln landen 1:1 im Code.

**Schwierigkeitskoeffizient** (`sim/difficulty.js`) — die eine globale Zahl:

```
coeff       = (playerFactor + minuten × timeFactor) × 1.15 ^ stagesCompleted
playerFactor= 1                                    (Einzelspieler)
timeFactor  = 0.0506 × difficultyValue             (Drizzle 1 / Rainstorm 2 / Monsoon 3)
gegnerLevel = 1 + (coeff − playerFactor) / 0.33
```

Pro Level: **+30 % Basis-HP, +20 % Basis-Schaden** (linear auf den Basiswert, nicht
kompoundierend). Die Anzeigenamen laufen von *Easy* über *Insane*, *I SEE YOU* bis
*HAHAHAHA*.

**Combat Director** (`sim/director.js`) — warum es sich immer angespannt anfühlt:

```
credits/sek = creditMultiplier × (1 + 0.4 × coeff)   (Fast/Slow Director: 0.75)
```

Der Director sammelt Credits, wählt eine Monster-Kategorie nach Gewicht, dann eine
Karte darin, und gibt möglichst alles auf einmal aus. Elite-Stufen kosten das
**6-fache** (Tier 1: Blazing/Overloading/Glacial) bzw. **36-fache** (Tier 2:
Malachite/Celestine). Ist ein Monster „zu billig" (Credits > 6× Elite-Wert), wird
neu gewürfelt — daher die Eskalation von einzelnen Käfern zu Elite-Rudeln.
Pro Welle bis zu 5 Monster mit identischem Elite-Affix.

**Belohnung / Preise:**

```
xp    = coeff × monsterValue × rewardMultiplier      (Director: 0.2)
gold  = 2 × xp
preis = basispreis × coeff ^ 1.25                    (Kiste 25, große 50, Legendary 400)
```

Der Exponent 1.25 ist der Grund, warum Kisten im Loop unbezahlbar werden.

**Rüstung** — nichtlinear, deshalb sind +5 Armor früh riesig:

```
armor ≥ 0 : schaden × (1 − armor / (armor + 100))
armor < 0 : schaden × (2 − 100 / (100 − armor))
```

**Item-Stacking** — drei Kurven, alle Items fallen in eine davon:

| Typ | Formel | Beispiel |
|---|---|---|
| Linear | `n × wert` | Soldier's Syringe: +15 % Angriffstempo je Stapel |
| Hyperbolisch | `1 − 1/(1 + n×x)` | Tougher Times: 15 % Blockchance, nähert sich 100 % an |
| Exponentiell | `1 − (1−x)^n` | Old War Stealthkit |

**Proc-Coefficient** — jeder Treffer trägt einen Faktor (Nahkampf 1.0, Dauerfeuer
0.2, AoE 0.0). On-Hit-Items würfeln mit `chance × procCoefficient`. Ohne das
funktionieren Ukulele/AtG/Gasoline-Ketten nicht richtig — deshalb ist es von
Anfang an eingebaut, nicht nachgerüstet.

**Stage-Reihenfolge** (`data/stages.js`): Titanic Plains → Abandoned Aqueduct →
Rallypoint Delta → Abyssal Depths → Sky Meadow → *Loop zurück auf 1*, plus
Commencement (Mithrix) und Bazaar Between Time als Sonderrealms.

Quellen: [Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty) ·
[Directors](https://riskofrain2.wiki.gg/wiki/Directors) ·
[Items](https://riskofrain2.wiki.gg/wiki/Items) ·
[Environments](https://riskofrain2.wiki.gg/wiki/Environments) ·
[Interactables](https://riskofrain2.wiki.gg/wiki/Interactables)

---

## Technische Randbedingungen (aus `monsterhunter-html` übernommen)

Der Doppelklick-Start bedeutet `file://`, und das verbietet einiges. Diese
Beschränkungen sind in `monsterhunter-html/README.md` bereits dokumentiert und
gelten hier unverändert:

| Technik | Unter `file://` | Konsequenz |
|---|---|---|
| `<script type="module">` | ❌ CORS | Nur klassische `<script src>`, globaler `ROR`-Namespace |
| `fetch()` auf lokale JSON | ❌ | Alle Spieldaten als `.js`-Objekte |
| Texturen aus Bilddateien | ❌ Security-Error | Rein prozedurale Geometrie + Vertex-/Materialfarben |
| Three.js ab r161 | ❌ nur ES-Module | **Three.js r160** (letzter UMD-Build), lokal in `game/lib/` |

Die Skript-Reihenfolge in `risk-of-rain.html` **ist** die Abhängigkeitsreihenfolge.

**Rechtliches:** wie bei `pokemon-html` — kein Material aus dem kommerziellen
Spiel. Alle Geometrie, Effekte und Musik entstehen zur Laufzeit im Code. Namen von
Items/Survivors bleiben als Hommage erhalten (wie bei `minecraft-html` und
`monsterhunter-html`); wenn du lieber eigene Namen willst, ist das ein reiner
Datei-Tausch in `data/`.

---

## Ordnerstruktur

```
risk-of-rain.html            Einstiegspunkt (doppelklicken) — HUD-Markup + Skriptliste
game/
  lib/three.min.js           Three.js r160 (UMD), lokal
  core/
    util.js                  PRNG (seeded), Noise/FBM, Vektor-/Winkelmathematik
    input.js                 Tastatur, Maus (Pointer Lock + Drag-Fallback), Gamepad
    camera.js                Third-Person über der Schulter, Ray gegen Hindernisse
    engine.js                Renderer, Szene, Uhr, Hauptschleife, Objekt-Pooling
  sim/
    difficulty.js            coeff, Gegnerlevel, Zeit-HUD
    stats.js                 Basiswerte + Level + Item-Modifikatoren → Endwerte
    damage.js                Schadenspipeline: Crit, Armor, Proc-Kette, Schadenszahlen
    buffs.js                 Buffs/Debuffs mit Dauer (Bleed, Burn, Slow, Elite-Affixe)
    director.js              Combat-/Interactable-Director, Credits, Spawnkarten
    loot.js                  Tier-Würfe, Kisten-Inhalte, 3D-Printer, Scrapper
  data/
    survivors.js             6 Survivors: Basiswerte + 4 Skills
    items.js                 ~65 Items: Tier, Effekt-Hooks, Stacking-Typ
    monsters.js              14 Gegner + 5 Bosse: Werte, Director-Kosten, KI-Profil
    elites.js                Elite-Affixe: Multiplikatoren, Farbe, Fähigkeit
    stages.js                5 Stages + Commencement + Bazaar: Thema, Spawn-Budgets
    interactables.js         Kisten, Shrines, Printer, Multishop: Preise, Gewichte
  world/
    terrain.js               Prozedurales Heightfield pro Stage-Thema
    props.js                 Felsen, Ruinen, Vegetation, Plattformen (instanziert)
    stage.js                 Aufbau/Abbau einer Stage, Spawnpunkte, Navigations-Gitter
    teleporter.js            Teleporter-Event: Ladezone, Bosswelle, Portale
  entities/
    player.js                Bewegung, Skills, Sprint, Sprünge, i-Frames
    monster.js               Gegner-KI-Zustände: Wandern, Verfolgen, Angriff, Rückzug
    projectile.js            Projektile, Hitscan, AoE, Homing-Raketen
    drone.js                 Kaufbare Verbündete
    pickup.js                Item-Drops, Heilkugeln, Gold
  fx/
    particles.js             GPU-Partikel (Points), Explosionen, Trails
    audio.js                 WebAudio: prozedurale Musik + Effekte, keine Dateien
  ui/
    style.css                HUD, Menüs, Item-Leiste
    hud.js                   HP-Balken, Skill-Icons, Gold, Timer, Schwierigkeitsbalken
    menus.js                 Titel, Survivor-Auswahl, Pause, Logbuch, Ergebnisbildschirm
    mobile.js                Touch-Overlay (Joystick + Skill-Knöpfe)
  save.js                    localStorage: Freischaltungen, Statistiken, Logbuch
  main.js                    Zustandsmaschine, Verdrahtung
```

---

## Bauabschnitte

Jede Stufe ist für sich spielbar und wird einzeln abgenommen, bevor die nächste
beginnt — genauso wie in `monsterhunter-html/README.md`.

### Stufe 1 — Gerüst, Welt, Bewegung
`engine.js`, `input.js`, `camera.js`, `util.js`, `terrain.js`, `props.js`, `player.js`

Three.js r160 lokal, Hauptschleife mit festem Simulationstakt, Third-Person-Kamera
mit Sichtstrahl. Prozedurale Insel im Stil von *Titanic Plains*: Heightfield mit
Plateaus, Klippen und schwebenden Felsen, damit die vertikale Bewegung von Anfang
an Sinn ergibt. Spieler mit RoR2-Werten (7 m/s, Sprint, Doppelsprung-fähig),
Fallschaden, Kollision gegen das Heightfield.
**Abnahme:** man kann über eine Insel laufen, springen, klettern, die Kamera fühlt sich richtig an.

### Stufe 2 — Kampf-Grundlage
`stats.js`, `damage.js`, `buffs.js`, `projectile.js`, `hud.js`, `data/survivors.js` (nur Commando)

Werteberechnung (Basis + Level + Items), Schadenspipeline mit Crit, der
Rüstungsformel und **Proc-Coefficient von Anfang an**. Commando komplett: Double
Tap, Phase Round, Tactical Dive, Suppressive Fire — mit Cooldowns, Ladungen und
Schadensprozenten. Schadenszahlen, HP-Balken, Skill-Icons. Trainingspuppe zum Testen.
**Abnahme:** Commando spielt sich wie im Original, Zahlen stimmen gegen die Wiki-Werte.

### Stufe 3 — Gegner, Director, Schwierigkeitskurve
`monster.js`, `director.js`, `difficulty.js`, `data/monsters.js`, `pickup.js`

14 Gegner (Lemurian, Beetle, Beetle Guard, Lesser/Greater Wisp, Jellyfish, Imp,
Stone Golem, Blind Pest, Brass Contraption, Bighorn Bison, Clay Templar, Elder
Lemurian, Mini Mushrum) mit KI-Zuständen und je eigenem Angriffsmuster. Der
Combat Director mit Credit-System und Spawnkarten. Der Schwierigkeitsbalken mit
den echten Namen. Gold- und XP-Belohnung, Level-Ups.
**Abnahme:** Der Druck steigt spürbar über die Zeit; ohne Items stirbt man nach ~10 Minuten.

### Stufe 4 — Items und Loot — *das Herzstück*
`data/items.js`, `loot.js`, `data/interactables.js`, Item-HUD

~65 Items über alle Stufen (White/Green/Red/Boss/Lunar/Equipment) mit korrektem
Stacking-Typ. Technisch ist ein Item ein Satz **Hooks**: `onHit`, `onKill`,
`onDamaged`, `statModifier`, `onInterval`, `onStageStart`. Damit ist ein neues
Item ein Dateneintrag, kein Sonderfall im Kampfcode.

Interactables mit Preisformel `basis × coeff^1.25`: Kiste, große Kiste, Legendary
Chest, Kategorie-Kisten, Multishop-Terminal, Equipment-Barrel, Shrine of Chance,
Shrine of Blood, Shrine of Combat, Shrine of the Mountain, 3D-Printer, Scrapper.
Der Interactable-Director verteilt sie zu Stage-Beginn nach Budget.
**Abnahme:** Ein Run mit 30 gestapelten Items fühlt sich absurd stark an — genau das ist der Punkt.

### Stufe 5 — Teleporter, Bosse, Stage-Loop
`teleporter.js`, `stage.js`, `data/stages.js`, Bossleiste

Teleporter-Event: finden, aktivieren, Ladezone halten, Bosswelle, Shrine-of-the-
Mountain-Multiplikator, Boss-Item, Gold-Regen, Portal. Fünf Stages mit eigenen
Themen (Ebene, Aquädukt, Militärbasis, Höhle, Himmelswiese) und Stage-Loop mit
`1.15^stagesCompleted`. Fünf Bosse: Stone Titan, Beetle Queen, Wandering Vagrant,
Magma Worm, Clay Dunestrider.
**Abnahme:** Ein vollständiger Run über 5 Stages in den Loop ist durchspielbar.

### Stufe 6 — Die restlichen fünf Survivors
`data/survivors.js`

Huntress (Zielsuche, Blink, Arrow Rain), Engineer (Türme, Minen, Schild),
MUL-T (Waffenwechsel, Retool, Ansturm), Artificer (Feuer/Eis/Blitz, Flug),
Mercenary (Dash-Ketten, i-Frames, Blitz of Elusive). Jeder braucht eigene
Skill-Logik — deshalb eine eigene Stufe.
**Abnahme:** Alle sechs spielen sich merklich unterschiedlich.

### Stufe 7 — Elites, Equipment, Bazaar, Mithrix
`data/elites.js`, `drone.js`, Bazaar-Realm, Endboss

Elite-Affixe (Blazing, Overloading, Glacial, Malachite, Celestine) mit
Director-Kostenmultiplikatoren und sichtbaren Auren. ~12 Equipments mit
aktivierbarem Cooldown. Kaufbare Drohnen. Bazaar Between Time über den blauen
Portal, Lunar Coins, Lunar-Items mit Nachteil. **Mithrix auf Commencement** in
drei Phasen als echtes Run-Ende.
**Abnahme:** Ein Run hat ein Ende und einen Ergebnisbildschirm.

### Stufe 8 — Meta: Menüs, Speichern, Logbuch
`menus.js`, `save.js`

Titelbildschirm, Survivor-Auswahl mit Freischaltbedingungen, Schwierigkeitswahl
(Drizzle/Rainstorm/Monsoon), Pausenmenü, Ergebnisbildschirm mit Run-Statistik,
Logbuch für gefundene Items und getötete Gegner, Freischaltungen und Statistiken
in `localStorage`.
**Abnahme:** Fortschritt bleibt über Sitzungen erhalten.

### Stufe 9 — Klang und Politur
`audio.js`, `particles.js`, Screenshake, Trefferfeedback

Prozedurale Musik in WebAudio, die mit dem Schwierigkeitskoeffizienten an Tempo
und Schichten zunimmt — akustisch dasselbe Signal wie der Balken. Treffer-
Feedback, Partikel, Bildschirmerschütterung, Übergänge.
**Abnahme:** Es fühlt sich nach einem Spiel an, nicht nach einem Prototyp.

### Stufe 10 — Touch-Steuerung
`mobile.js`

Overlay nach dem Muster von `minecraft-html/Minecraft_files/js/mobile.js`:
Erkennung über `pointer: coarse` **und** Berührungspunkte (nicht über User-Agent),
Joystick links, Skill-Knöpfe rechts, Blick per Wischen, Interaktions-Knopf der
sich am Ziel orientiert. Nur Querformat.
**Abnahme:** Ein Run ist am Handy spielbar.

---

## Website-Einbindung

Der Ordner ist von Anfang an fertig zum Ablegen: kein Build, keine absoluten
Pfade, alle Verweise relativ. Auf der Website wird `risk-of-rain-html/` an eine
beliebige Stelle kopiert und mit einem Link auf `risk-of-rain.html` verknüpft —
so wie `pokemon/` in `eliasmedia-website`. Zum Entfernen: Ordner löschen, Link
löschen. Nichts greift außerhalb des Ordners; `localStorage` läuft unter einem
eigenen Präfix (`ror2:`), damit nichts mit anderen Spielen auf der Domain kollidiert.

Zusätzlich entsteht `.claude/launch.json` mit einem lokalen Testserver
(`python3 -m http.server 8792`) — gleiches Muster wie in den anderen Projekten.

---

## Verifikation

Nach jeder Stufe:

1. **Doppelklick-Test** — `risk-of-rain.html` direkt aus dem Finder öffnen.
   Bricht das, ist eine `file://`-Regel verletzt. Das ist die harte Grenze.
2. **Server-Test** — `python3 -m http.server 8792` und im Browser prüfen
   (via `preview_start`, Konsole auf Fehler durchsehen).
3. **Sauberkeitsprüfung** — `grep -rnE "fetch\(|XMLHttpRequest|import |https?://" game/`
   muss leer bleiben (außer Kommentaren). Ebenso keine Datei-Assets.
4. **Zahlenprüfung** — ein Debug-Overlay (`F3`, wie in `minecraft-html`) zeigt
   coeff, Gegnerlevel, Director-Credits, DPS und Item-Effekte live. Damit lassen
   sich die Formeln gegen die Wiki-Werte gegenprüfen statt nach Gefühl zu tunen.
5. **Spieltest** — ein vollständiger Run bis zur aktuellen Ausbaustufe.

Zum Abschluss ein `README.md` im Projektstil: Ordnerstruktur, Steuerung,
Ausbaustufen-Tabelle, `file://`-Randbedingungen, rechtlicher Hinweis.

---

## Was ich bewusst weglasse

Damit der Umfang ehrlich ist — das folgende ist **nicht** in „Kern-Erlebnis" drin
und jederzeit über die Datendateien nachrüstbar:

- Mehrspieler (die Formeln haben den `playerCount` aber schon drin)
- Void-Items, Void Fields, Gilded Coast, Bulwark's Ambry, Artifacts
- Die restlichen ~13 Survivors und ~45 Items
- Der Void-Ending-Pfad (Planetarium / Voidling)

Wenn eine dieser Sachen dir wichtig ist, sag es jetzt — dann ziehe ich sie in
eine Stufe rein, statt sie später anzuflanschen.
