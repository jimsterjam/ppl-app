# Duplikate in der Übungsliste – Löschvorschlag (nur Vorschlag, nichts gelöscht)

Quelle: `client/src/data/default-exercises.json` (identisch zu `client/public/data/default-exercises.json`, 1247 Einträge).

**Wichtig:** Gespeicherte Workouts, Favoriten und Verlauf speichern `exerciseId` **und** Namen (`server/models/Workout.js`). Löschen würde Verweise verwaisen lassen. Vorschlag: Einträge nicht hart entfernen, sondern per Alias-Tabelle (alte ID → behaltene ID) ausblenden bzw. zusammenführen. Entscheidung durch Paul nötig.

## A) Mit Eintrag ohne Zusatz vorhanden (33) – sicherer Kandidat

| Entfernen (ID) | Name | Behalten (ID) | Name | Grund |
|---|---|---|---|---|
| 0077 | barbell rear lunge v. 2 | 0078 | barbell rear lunge | Zweite/dritte Videoversion |
| 0079 | barbell reverse wrist curl v. 2 | 0082 | barbell reverse wrist curl | Zweite/dritte Videoversion |
| 0097 | barbell side split squat v. 2 | 0098 | barbell side split squat | Zweite/dritte Videoversion |
| 2800 | barbell sitted alternate leg raise (female) | 2799 | barbell sitted alternate leg raise | Nur Kamerawinkel/Geschlecht |
| 0119 | barbell upright row v. 2 | 0120 | barbell upright row | Zweite/dritte Videoversion |
| 0121 | barbell upright row v. 3 | 0120 | barbell upright row | Zweite/dritte Videoversion |
| 0125 | barbell wrist curl v. 2 | 0126 | barbell wrist curl | Zweite/dritte Videoversion |
| 0287 | dumbbell arnold press v. 2 | 2137 | dumbbell arnold press | Zweite/dritte Videoversion |
| 1657 | dumbbell cross body hammer curl v. 2 | 0298 | dumbbell cross body hammer curl | Zweite/dritte Videoversion |
| 2136 | dumbbell cuban press v. 2 | 0299 | dumbbell cuban press | Zweite/dritte Videoversion |
| 0304 | dumbbell decline shrug v. 2 | 0305 | dumbbell decline shrug | Zweite/dritte Videoversion |
| 0309 | dumbbell front raise v. 2 | 0310 | dumbbell front raise | Zweite/dritte Videoversion |
| 0312 | dumbbell hammer curl v. 2 | 0313 | dumbbell hammer curl | Zweite/dritte Videoversion |
| 0317 | dumbbell incline curl v. 2 | 0318 | dumbbell incline curl | Zweite/dritte Videoversion |
| 0342 | dumbbell lying one arm press v. 2 | 0343 | dumbbell lying one arm press | Zweite/dritte Videoversion |
| 0360 | dumbbell one arm shoulder press v. 2 | 0361 | dumbbell one arm shoulder press | Zweite/dritte Videoversion |
| 0395 | dumbbell seated lateral raise v. 2 | 0396 | dumbbell seated lateral raise | Zweite/dritte Videoversion |
| 1765 | dumbbell upright row (back pov) | 0437 | dumbbell upright row | Nur Kamerawinkel/Geschlecht |
| 0497 | inverted row v. 2 | 0499 | inverted row | Zweite/dritte Videoversion |
| 0513 | jump squat v. 2 | 0514 | jump squat | Zweite/dritte Videoversion |
| 1439 | lever gripless shrug v. 2 | 0580 | lever gripless shrug | Zweite/dritte Videoversion |
| 1479 | lever incline chest press v. 2 | 1299 | lever incline chest press | Zweite/dritte Videoversion |
| 1614 | lever preacher curl v. 2 | 0592 | lever preacher curl | Zweite/dritte Videoversion |
| 3760 | lever seated crunch v. 2 | 1452 | lever seated crunch | Zweite/dritte Videoversion |
| 0869 | lever shoulder press v. 2 | 0603 | lever shoulder press | Zweite/dritte Videoversion |
| 2318 | lever shoulder press v. 3 | 0603 | lever shoulder press | Zweite/dritte Videoversion |
| 0658 | push-up (wall) v. 2 | 0659 | push-up (wall) | Zweite/dritte Videoversion |
| 1464 | sled 45° leg press (back pov) | 0739 | sled 45° leg press | Nur Kamerawinkel/Geschlecht |
| 1463 | sled 45° leg press (side pov) | 0739 | sled 45° leg press | Nur Kamerawinkel/Geschlecht |
| 2801 | twisted leg raise (female) | 2802 | twisted leg raise | Nur Kamerawinkel/Geschlecht |
| 2371 | weighted russian twist v. 2 | 0846 | weighted russian twist | Zweite/dritte Videoversion |
| 3195 | leg curl lying | 0586 | lever lying leg curl | Nur anderer Name |
| 2315 | calf press lever | 2289 | lever calf press | Nur anderer Name |

## B) Ohne Basis-Eintrag (35) – kein echtes Duplikat

Hier gibt es keinen Eintrag ohne Zusatz; die Übung existiert nur einmal (bzw. als v. 2/v. 3 ohne v. 1). Vorschlag: nichts löschen, nur den Zusatz im Namen (`(male)`, `v. 2`) entfernen bzw. prüfen, ob v. 2 und v. 3 untereinander dasselbe sind.

| ID | Name | Grund |
|---|---|---|
| 3214 | arms apart circular toe touch (male) | Nur Kamerawinkel/Geschlecht |
| 3204 | arms overhead full sit-up (male) | Nur Kamerawinkel/Geschlecht |
| 3220 | astride jumps (male) | Nur Kamerawinkel/Geschlecht |
| 1369 | band two legs calf raise - (band under both legs) v. 2 | Zweite/dritte Videoversion |
| 3562 | barbell glute bridge two legs on bench (male) | Nur Kamerawinkel/Geschlecht |
| 0096 | barbell side bent v. 2 | Zweite/dritte Videoversion |
| 2810 | barbell split squat v. 2 | Zweite/dritte Videoversion |
| 3697 | cable kneeling rear delt row (with rope) (male) | Nur Kamerawinkel/Geschlecht |
| 0186 | cable lying triceps extension v. 2 | Zweite/dritte Videoversion |
| 0199 | cable pushdown (straight arm) v. 2 | Zweite/dritte Videoversion |
| 3216 | chest tap push-up (male) | Nur Kamerawinkel/Geschlecht |
| 2327 | dumbbell reverse grip row (female) | Nur Kamerawinkel/Geschlecht |
| 2321 | dumbbell standing inner biceps curl v. 2 | Zweite/dritte Videoversion |
| 3470 | forward lunge (male) | Nur Kamerawinkel/Geschlecht |
| 3523 | glute bridge two legs on bench (male) | Nur Kamerawinkel/Geschlecht |
| 3221 | half knee bends (male) | Nur Kamerawinkel/Geschlecht |
| 3202 | half sit-up (male) | Nur Kamerawinkel/Geschlecht |
| 3224 | jack jump (male) | Nur Kamerawinkel/Geschlecht |
| 3239 | kneeling plank tap shoulder (male) | Nur Kamerawinkel/Geschlecht |
| 3211 | kneeling push-up (male) | Nur Kamerawinkel/Geschlecht |
| 2286 | lever hip extension v. 2 | Zweite/dritte Videoversion |
| 3217 | modified hindu push-up (male) | Nur Kamerawinkel/Geschlecht |
| 1495 | oblique crunch v. 2 | Zweite/dritte Videoversion |
| 3203 | prisoner half sit-up (male) | Nur Kamerawinkel/Geschlecht |
| 3552 | quick feet v. 2 | Zweite/dritte Videoversion |
| 3236 | resistance band hip thrusts on knees (female) | Nur Kamerawinkel/Geschlecht |
| 3219 | scissor jumps (male) | Nur Kamerawinkel/Geschlecht |
| 3222 | semi squat jump (male) | Nur Kamerawinkel/Geschlecht |
| 0705 | side bridge v. 2 | Zweite/dritte Videoversion |
| 3667 | side lying hip adduction (male) | Nur Kamerawinkel/Geschlecht |
| 0735 | sit-up v. 2 | Zweite/dritte Videoversion |
| 3223 | star jump (male) | Nur Kamerawinkel/Geschlecht |
| 2138 | stationary bike run v. 3 | Zweite/dritte Videoversion |
| 3433 | swimmer kicks v. 2 (male) | Zweite/dritte Videoversion |
| 3643 | weighted cossack squats (male) | Nur Kamerawinkel/Geschlecht |

## C) Bewusst NICHT als Duplikat gewertet
Varianten mit anderem Zubehör/Ausführung (z. B. `cable pushdown` mit Seil, `crunch` auf Stabilitätsball, `push-up (wall)`, `weighted russian twist (legs up)`, `donkey calf raise` ohne Gerät).
