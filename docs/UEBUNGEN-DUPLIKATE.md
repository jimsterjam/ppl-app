# Duplikate in der Übungsliste – Löschvorschlag (nur Vorschlag, nichts gelöscht)

Quelle: `client/src/data/default-exercises.json` (identisch zu `client/public/data/default-exercises.json`, 1247 Einträge).

**Wichtig:** Gespeicherte Workouts, Favoriten und Verlauf speichern `exerciseId` **und** Namen (`server/models/Workout.js`). Löschen würde Verweise verwaisen lassen. Vorschlag: Einträge nicht hart entfernen, sondern per Alias-Tabelle (alte ID → behaltene ID) ausblenden bzw. zusammenführen. Entscheidung durch Paul nötig.

## A) Mit Eintrag ohne Zusatz vorhanden – sicherer Kandidat

| Entfernen (ID) | Name | Behalten (ID) | Name | Grund |
|---|---|---|---|---|
| 2800 | barbell sitted alternate leg raise (female) | 2799 | barbell sitted alternate leg raise | Nur Kamerawinkel/Geschlecht |
| 1765 | dumbbell upright row (back pov) | 0437 | dumbbell upright row | Nur Kamerawinkel/Geschlecht |
| 1464 | sled 45° leg press (back pov) | 0739 | sled 45° leg press | Nur Kamerawinkel/Geschlecht |
| 1463 | sled 45° leg press (side pov) | 0739 | sled 45° leg press | Nur Kamerawinkel/Geschlecht |
| 2801 | twisted leg raise (female) | 2802 | twisted leg raise | Nur Kamerawinkel/Geschlecht |
| 3195 | leg curl lying | 0586 | lever lying leg curl | Nur anderer Name |
| 2315 | calf press lever | 2289 | lever calf press | Nur anderer Name |

## B) Ohne Basis-Eintrag – kein echtes Duplikat

Hier gibt es keinen Eintrag ohne Zusatz; die Übung existiert nur einmal. Vorschlag: nichts löschen, nur den Zusatz `(male)`/`(female)` im Namen prüfen.

| ID | Name | Grund |
|---|---|---|
| 3214 | arms apart circular toe touch (male) | Nur Kamerawinkel/Geschlecht |
| 3204 | arms overhead full sit-up (male) | Nur Kamerawinkel/Geschlecht |
| 3220 | astride jumps (male) | Nur Kamerawinkel/Geschlecht |
| 3562 | barbell glute bridge two legs on bench (male) | Nur Kamerawinkel/Geschlecht |
| 3697 | cable kneeling rear delt row (with rope) (male) | Nur Kamerawinkel/Geschlecht |
| 3216 | chest tap push-up (male) | Nur Kamerawinkel/Geschlecht |
| 2327 | dumbbell reverse grip row (female) | Nur Kamerawinkel/Geschlecht |
| 3470 | forward lunge (male) | Nur Kamerawinkel/Geschlecht |
| 3523 | glute bridge two legs on bench (male) | Nur Kamerawinkel/Geschlecht |
| 3221 | half knee bends (male) | Nur Kamerawinkel/Geschlecht |
| 3202 | half sit-up (male) | Nur Kamerawinkel/Geschlecht |
| 3224 | jack jump (male) | Nur Kamerawinkel/Geschlecht |
| 3239 | kneeling plank tap shoulder (male) | Nur Kamerawinkel/Geschlecht |
| 3211 | kneeling push-up (male) | Nur Kamerawinkel/Geschlecht |
| 3217 | modified hindu push-up (male) | Nur Kamerawinkel/Geschlecht |
| 3203 | prisoner half sit-up (male) | Nur Kamerawinkel/Geschlecht |
| 3236 | resistance band hip thrusts on knees (female) | Nur Kamerawinkel/Geschlecht |
| 3219 | scissor jumps (male) | Nur Kamerawinkel/Geschlecht |
| 3222 | semi squat jump (male) | Nur Kamerawinkel/Geschlecht |
| 3667 | side lying hip adduction (male) | Nur Kamerawinkel/Geschlecht |
| 3223 | star jump (male) | Nur Kamerawinkel/Geschlecht |
| 3643 | weighted cossack squats (male) | Nur Kamerawinkel/Geschlecht |

## C) Bewusst NICHT als Duplikat gewertet
**`v. 2` / `v. 3` sind Varianten (Absprache Paul), keine Duplikate – alle diese Einträge bleiben.** Ebenso: Varianten mit anderem Zubehör/Ausführung (z. B. `cable pushdown` mit Seil, `crunch` auf Stabilitätsball, `push-up (wall)`, `weighted russian twist (legs up)`, `donkey calf raise` ohne Gerät).

