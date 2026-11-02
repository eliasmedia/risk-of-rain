# Spielercharaktere — Abnahmekriterien und Stand

Dieses Dokument ist der Maßstab, an dem eine Figur als **fertig** gilt. Es
ersetzt „sieht schon ganz gut aus" durch eine Liste, die man Punkt für Punkt
durchgehen kann.

Quelle für alle Werte und Beschreibungen ist das Wiki:
<https://riskofrain2.wiki.gg/wiki/Survivors> und die Einzelseiten je Figur.
Der Fandom-Spiegel (`riskofrain2.fandom.com`) liefert nur noch HTTP 402 und ist
als Quelle unbrauchbar — deshalb `wiki.gg`.

---

## Die Kriterien

Fünf Gruppen, 31 Punkte. Eine Figur ist fertig, wenn **alle** erfüllt sind.
Kürzel wie `S3` oder `M4` werden unten in der Standtabelle verwendet.

### S — Optik (Silhouette und Farbe)

| # | Kriterium | Warum |
|---|---|---|
| S1 | Die Figur ist **allein am schwarzen Umriss** auf 20 m Entfernung erkennbar | Aus der Verfolgerkamera sieht man selten mehr als den Umriss |
| S2 | **Drei-Ton-Regel**: eine Grundfarbe, ein Dunkelton, genau ein leuchtender Akzent | Mehr Farben lösen die Silhouette auf, weniger wirkt tot |
| S3 | Leitfarbe und Erkennungsmerkmal **wie im Wiki** (Huntress: roter Schal, MUL-T: gelb mit verbeultem Kopf) | Wiedererkennbarkeit gegenüber der Vorlage |
| S4 | Ein lesbares **„Gesicht"** — Visier, Augen oder Sensor mit Eigenleuchten | Ohne Blickpunkt wirkt jede Figur wie ein Möbelstück |
| S5 | Die **Waffe ist als Gegenstand erkennbar**, nicht als Balken oder Leuchtröhre | Sie ist das zweitgrößte Teil der Silhouette |
| S6 | Kein sichtbares Bauteil dünner als **0,02 m** | Dünneres flimmert oder verschwindet im Bild |
| S7 | Alle sieben **Anhängepunkte** vorhanden (`chest`, `back`, `head`, `hip`, `shoulderL`, `shoulderR`, `orbit`) | Sonst hängen Items im Nichts |
| S8 | Die Figur hat einen **Akzentwert im Datensatz** (`colors.accent`), der in Modell, Fähigkeitsfarben und Auswahlkarte derselbe ist | Ein Charakter ist eine Farbe |

### A — Animation

| # | Kriterium | Warum |
|---|---|---|
| A1 | Eigenes **Gangbild** je Figur (Schrittweite, Wippen, Neigung, Armschwung) über einen `gait`-Datensatz | Sechs Figuren mit demselben Laufzyklus sind eine Figur in sechs Farben |
| A2 | **Sprint sieht anders aus** als Gehen — nicht nur schneller | Sprint ist im Original ein eigener Zustand |
| A3 | Sprung hat **vier Phasen**: Absprung, Steigen, Fallen, Landung mit Stauchung | Ohne Landestauchung wirkt jede Landung wie ein Teleport |
| A4 | Oberkörper und Kopf folgen dem **Zielwinkel, auch nach oben und unten** | Sonst schießt die Figur sichtbar an ihrer eigenen Haltung vorbei |
| A5 | **Leerlauf lebt**: Atmen, Waffenwiegen, Kopfbewegung — nie ein Standbild | Der häufigste Zustand im Spiel |
| A6 | **Jede der vier Fähigkeiten** hat eine eigene sichtbare Haltung (Ausholen, Halten, Nachschwingen) | Man muss am Körper sehen, was gedrückt wurde |
| A7 | Alle Übergänge sind **gedämpft** (`damp`/`smoothstep`), kein Springen zwischen Posen | Harte Wechsel lesen sich als Fehler |
| A8 | **Treffer und Landung erzeugen eine Reaktion** am Körper (Zucken, Stauchung) | Rückmeldung ohne HUD |

### E — Waffen- und Fähigkeiteneffekte

| # | Kriterium | Warum |
|---|---|---|
| E1 | Jede Fähigkeit hat **eine Farbe**, die in Icon, Geschoss, Spur und Einschlag identisch ist | Man ordnet einen Effekt im Getümmel nur über die Farbe zu |
| E2 | **Mündungsblitz bzw. Anlaufeffekt** sitzt an der Waffe und wandert mit ihr | Ein Blitz am Unterarm verrät den Trick |
| E3 | Fliegende Geschosse haben eine **Spur** und eine zur Fähigkeit passende **Form** | Man muss sehen, was da fliegt, und woher |
| E4 | Einschlag erzeugt **Funken plus Ring**, Größe nach Wucht | Ein Punkt reicht als Trefferrückmeldung nicht |
| E5 | **Kamera-Erschütterung** proportional zur Wucht, gedeckelt | Wucht ohne Erschütterung fühlt sich leer an |
| E6 | Eigener **Ton** je Fähigkeit | |
| E7 | **Aufladen ist sichtbar** — die Waffe leuchtet oder wächst mit der Ladung | Sonst rät man, wann losgelassen werden muss |

### M — Fortbewegung

| # | Kriterium | Warum |
|---|---|---|
| M1 | Jede Figur hat **mindestens eine bewegungsverändernde Fähigkeit oder ein Passiv** | Das ist der Kern des Spielgefühls |
| M2 | Der Bewegungsskill hat **Anlauf, Kern und Ausklang** mit eigener Pose | Ein Teleport ohne Anlauf liest sich als Ruckler |
| M3 | **Unverwundbarkeit und Rüstung sind sichtbar** (Aura, Farbwechsel, Nachbilder) | Sonst weiß man nicht, ob man gerade sicher ist |
| M4 | Schnelle Bewegung erzeugt **Nachbilder** in der Akzentfarbe | Tempo braucht eine Spur |
| M5 | **`agile`-Fähigkeiten brechen den Sprint nicht ab**, wo das Original das so hält | Betrifft Huntress und Mercenary unmittelbar |
| M6 | Bewegungsskills funktionieren **in der Luft**, wo das Original das erlaubt | |

### W — Regeltreue gegenüber dem Wiki

| # | Kriterium |
|---|---|
| W1 | Grundwerte (HP, Regen, Schaden, Rüstung, Tempo, Sprungzahl) stimmen |
| W2 | Schadensprozente, Abklingzeiten, Ladungen und Proc-Coefficient stimmen |
| W3 | Das **Passiv** ist umgesetzt und im HUD sichtbar |
| W4 | Namen und Beschreibungstexte entsprechen dem Wiki |
| W5 | Tags (`Agile`, `Stunning`) wirken tatsächlich |

---

## Stand vor dieser Ausbaustufe

Geprüft am 24.08.2026 gegen `wiki.gg`.

| Figur | erfüllt | offen (Auswahl) |
|---|---|---|
| Commando | S1 S5 S6 S7, A1(teilw.) A7, E1 E2 E6, M1 M5, W1 W2 W4 | S2 S3 S4 S8, A2–A6 A8, E3 E4 E5 E7, M2 M3 M4, W3 |
| Huntress | S1 S5 S6 S7, A7, E1 E3 E6, M1 M5, W1 W2 W4 | **S3 (roter Schal fehlt)**, S2 S4 S8, A1–A6 A8, E4 E5 E7, **M2 (Blink ist ein Dash, kein Teleport)**, M3 M4, W3 |
| Engineer | S1 S5 S6 S7, A7, E1 E6 E7, W1 W2 W4 | S2 S4 S8, A1–A6 A8, E3 E4 E5, M2–M4, W3 |
| MUL-T | S1 S5 S6 S7, A7, E1 E6, M1, W1 W2 W4 | **S3 (rot statt gelb, kein verbeulter Kopf)**, S2 S4 S8, A1–A6 A8, E3 E4 E5 E7, M2 M3 M4, W3 |
| Artificer | S1 S5 S6 S7, A7, E1 E6 E7, W1 W2 W4 | S2 S4 S8, A1–A6 A8, E3 E4 E5, **M1/W3 (ENV-Suit-Schweben fehlt komplett)**, M2–M4 |
| Mercenary | S1 S5 S6 S7, A6(teilw.) A7, E1 E6, M1 M5 M6, W1 W2 W4 | S2 S4 S8, A1–A5 A8, E3 E4 E5 E7, M2 M3 M4, **W3** |

Die vier schwersten Befunde waren:

1. **Jede Figur hatte eine leere Fläche im Gesicht.** Visier, Augen und
   Sensorbalken saßen bei z ≈ −0.15, der Schädel reichte aber bis −0.28: das
   ganze Gesicht steckte *im* Kopf. Sechs Figuren, sechs Mal derselbe Fehler,
   und beim Lesen des Codes nicht zu sehen.
2. **Bei Engineer und MUL-T steckten beide Arme samt Waffe im Rumpf.** Der
   Standard-Schulterabstand war 0.36 mal Breite, der Rumpf 0.66 bzw. 0.78.
   Man hielt die Figuren für „kompakt gebaut".
3. **Artificer hatte kein Passiv.** Der ENV-Suit ist im Original ihre einzige
   Fortbewegung — sie hat weder Dash noch Doppelsprung.
4. **Huntress' Blink war ein Dash.** Das Wiki sagt „Disappear and teleport
   forward"; über 0.28 s gerutscht fühlte sich das an wie Commandos Rolle.

---

## Was in dieser Ausbaustufe passiert ist

**Optik** — Alle sechs Köpfe neu gebaut, Gesichter jetzt vor dem Schädel.
Rumpfbreiten und Schulterabstände abgeglichen, Arme sichtbar. Alle Paletten
deutlich aufgehellt (unter ACES-Tonwertkurve rendern die alten Werte als
Schwarz). Neue Akzentfarbe je Figur: Huntress bekommt ihren **roten Schal**
vorn *und* als Umhang, MUL-T wird **gelb mit verbeultem Kopf** und roten
Warnstreifen, Commando einen Schal mit losem Ende, Engineer einen blauen
Signalstreifen, Artificer Goldsaum, Mercenary rote Leuchtrippen. Hals
eingezogen — der Kopf schwebte vorher über der Robe.

**Animation** — Neues Torso-Gelenk zwischen Hüfte und Oberkörper: die Hüfte
trägt das Wippen, der Torso die Neigung zum Ziel. Damit ist **Zielen nach oben
und unten** überhaupt erst darstellbar (ein Drittel Torso, zwei Drittel Kopf).
Jede Figur hat ein **`gait`** — Schrittweite, Takt, Wippen, Vorlage,
Armschwung: MUL-T stampft, der Engineer schleppt, die Huntress federt,
Artificer schwebt ohne Schrittzyklus. Dazu Landestauchung, Kurvenneigung,
Atmen im Leerlauf, Umsehen des Kopfes, eigene Posen für Rolle, Sprungangriff
und Ansturm, Stützhand bei einhändigen Waffen, sichtbare **Ladehaltung**.

**Effekte** — Neue Datei `game/fx/charfx.js`: **Nachbilder**, die die echte
Haltung des Augenblicks kopieren (Dash, Blink, Doppelsprung), Bodenringe und
Staub. Mündungsblitz ist jetzt Kegel + Stern + Kern statt eines Leuchtklumpens.
Fliegende Geschosse haben eine **Spur**. Explosionen bekommen einen Ring in
ihrer echten Reichweite. Kamera-Erschütterung hängt am Rückstoß — eine Stelle
für alle Fähigkeiten.

**Fortbewegung** — Artificers **ENV Suit** umgesetzt (Sprungtaste halten
begrenzt die Fallgeschwindigkeit auf 1.4 m/s und gibt 25 % mehr Luftkontrolle).
Huntress' **Blink** ist ein echter Teleport: unsichtbar, unverwundbar, feste
Strecke, senkrechter Schwung zurückgesetzt, sichtbar als Nachbildkette.
Arrow Rain hebt sie in die Luft. Zweiter Sprung ist flacher als der erste.
Passivfähigkeiten stehen im Datenmodell und im HUD.

### Danach noch offen

| Punkt | Figur | Was fehlt |
|---|---|---|
| M1 | Engineer | Er hat im Original **keine** Fortbewegungsfähigkeit — weder Bubble Shield noch Thermal Harpoons bewegen ihn. Das ist eine wiki-bedingte Ausnahme und kein Mangel; sie bleibt so. |
| E6 | alle | Der Klang ist noch derselbe `schuss` für fast alles; eigene Töne je Fähigkeit fehlen. |
| A8 | alle | Treffer erzeugen bisher nur ein HUD-Blinken, kein Zucken am Körper. |
| W2 | Huntress, MUL-T | Die alternativen Fähigkeiten (Flurry, Ballista, Scrap Launcher, Power-Saw, Power Mode) sind nicht gebaut — bewusst, das Projekt bildet je Platz eine Fassung ab. |

---

## Die nächsten drei Survivors

Ausgewählt danach, dass jeder **eine Mechanik mitbringt, die es im Projekt
noch nicht gibt** — nicht danach, wer am beliebtesten ist. Reihenfolge ist die
Empfehlung.

### 1. Loader — *„slow but powerful bruiser"*

| | |
|---|---|
| Werte | 160 HP (+48), 2.5 Regen (+0.5), 12 Schaden (+2.4), 20 Rüstung, 7 m/s |
| Passiv | **Scrap Barrier** — kein Sturzschaden, und jeder Gauntlet-Treffer gibt Barriere in Höhe von 5 % der maximalen HP |
| M1 | Knuckleboom — 320 % Nahkampf mit Ausfallschritt |
| M2 | **Grapple Fist** — Enterhaken bis 80 m, zieht die Figur zum Ziel |
| Shift | Charged Gauntlet — 2,5 s laden, 600–2700 %, **+30 % je 1 m/s Eigengeschwindigkeit** |
| R | M551 Pylon — schwebender Mast, zappt bis zu 6 Gegner, ist selbst enterbar |

**Warum zuerst:** Der Enterhaken ist die einzige wirklich *neue*
Fortbewegungsart, die dem Projekt noch fehlt — alles Bisherige ist Dash,
Sprung oder Teleport. Er zwingt uns außerdem zu einem Seil-Renderer und zu
einer Geschwindigkeitsabfrage im Schadensmodell (`+30 % je m/s`), und beides
zahlt direkt auf Kriterium M4 und E5 ein. Dazu kommt die Barriere-Mechanik,
die es im Projekt bereits gibt (`body.shield`), also wenig Neubau.

**Neu zu bauen:** Enterhaken-Zustand im Spieler (Zug statt Beschleunigung),
Seilgeometrie, `Scrap Barrier` als Passiv-Hook, Ladepose mit sichtbarem
Aufladen (E7).

### 2. Bandit — *„high-skill combo character"*

| | |
|---|---|
| Werte | 110 HP (+33), 1 Regen, 12 Schaden, 0 Rüstung, 7 m/s |
| Passiv | **Backstab** — Treffer von hinten sind garantierte Krits mit 1,5-fachem Kritschaden |
| M1 | Burst / Blast — Schrotflinte oder Schnellfeuer |
| M2 | Serrated Dagger — Nahkampf mit Blutung |
| Shift | **Smokebomb** — Rauchwolke, kurze Unsichtbarkeit, Nahkampfschaden beim Verschwinden |
| R | **Lights Out** — Revolverschuss; ein Kill setzt *alle* Abklingzeiten zurück |

**Warum als zweites:** Bringt zwei Systeme, die dem Projekt fehlen und die
allen späteren Figuren nützen: **Unsichtbarkeit** (Materialdurchlässigkeit +
Gegner verlieren das Ziel) und **Richtungsabhängigkeit von Treffern**
(Rückenwinkel gegen `body.facing`). Der Cooldown-Reset auf Kill ist außerdem
das befriedigendste Spielgefühl im ganzen Rooster.

**Neu zu bauen:** `invisible`-Buff mit Sichtbarkeitsregel in `monster.js`,
Winkelprüfung in `damage.js`, Rauchpartikel, Revolver-Modell.

### 3. Acrid — *„melee-range hybrid"*

| | |
|---|---|
| Werte | 160 HP (+48), 2.5 Regen (+0.5), 15 Schaden (+3), 20 Rüstung, 7 m/s |
| Passiv | **Poison** — Vergiftung, die Gegner auf 1 HP herunterbringt, aber nicht tötet |
| M1 | Vicious Wounds — dreiteilige Bisskombination, heilt bei Treffer |
| M2 | Neurotoxin — Giftspucke |
| Shift | **Caustic Leap** — Sprung mit Giftpfütze am Aufschlagpunkt |
| R | Epidemic — Seuche, die **von Gegner zu Gegner springt** |

**Warum als drittes:** Acrid ist der erste **Vierbeiner** — ein völlig anderer
Körperbau, der `survivormodel.js` vom „Mensch mit Waffe"-Schema löst und den
Formenbaukasten für spätere Figuren erweitert. Die Gift- und Seuchenmechanik
sitzt auf dem bereits vorhandenen DoT-System (`Buffs.applyDot`) auf, die
Ansteckungskette ist neu und ist der visuell dankbarste Effekt im Spiel.

**Neu zu bauen:** Vierbeiner-Bauart und -Laufzyklus, `poison`-DoT mit
1-HP-Deckel, Ansteckungslogik für Epidemic, Pfützen-Deployable (das
`zone`-Deployable reicht fast).

### Bewusst zurückgestellt

| Figur | Grund |
|---|---|
| REX | HP-Kosten je Fähigkeit sind interessant, aber mechanisch nah an vorhandenem; das Pflanzen-Roboter-Modell ist teuer |
| Captain | Orbitalschläge brauchen eine eigene Zielmarkierungs-Oberfläche |
| Railgunner | Zielfernrohr braucht einen zweiten Kameramodus, plus Schwachpunkt-Trefferzonen an jedem Gegner |
| Void Fiend | Braucht das ganze Void-Thema, das laut Bauplan ausgeklammert ist |
