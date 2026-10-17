# Glossar und Entscheidungen

Stand: aus den Absprachen im Chat zusammengetragen (Daten ungefähr; bei Widerspruch gilt die jüngere Absprache, siehe CLAUDE.md).
Neue Entscheidungen hier ergänzen (Datum, Entscheidung, Grund in einem Satz).

## Begriffe (so heißen Dinge in der App)
| Begriff | Bedeutung / Verwendung |
|---|---|
| **Satz** | Ein Durchgang einer Übung (Arbeitssatz). Knopf „+ Satz“, Start „Satz {n} starten“. |
| **Aufwärmsatz** | Leichter Satz vor den Arbeitssätzen; zählt nie für Gewichtsvorschlag/Prüfung. „+ Aufwärmsatz“. |
| **Warm-up** | Optionaler Block oben (Cardio, Gelenke, leichter Satz); Timer starten den Gesamttimer. |
| **Notiz** | Freitext zur Übung für den KI-Coach (früher „Dein Feedback“). Knopf „Notiz“. |
| **Abhaken** | Satz als gemacht markieren: Leiste „Abhaken“ in der Übersicht, „Satz geschafft“ in der Großansicht. |
| **Fokus-Modus / Großansicht** | Satz-für-Satz-Ansicht mit großen Zahlen; verlassen über „Übersicht“. |
| **Übersicht** | Die ganze Workout-Liste. |
| **Pause** | Timer nach dem Abhaken; groß, minimiert als Leiste. Kürzel in Knöpfen: „−15 Sek. / +15 Sek.“. |
| **Gesamttimer / Gym-Zeit** | Zeit des ganzen Trainings. |
| **Messart** | „Gewicht und Wiederholungen“ · „Zeit halten (Sekunden)“ · „Wiederholungen in fester Zeit“. |
| **Ziel** | Muskelaufbau (meist 8–12 Wdh.) oder Kraft (meist 1–6 Wdh.); je Workout gewählt. |
| **Favorit** | Gespeicherte Workout-Vorlage (merkt Übungen, Reihenfolge, Zielwerte, Ziel). |
| **KI-Coach / KI-Feedback** | Auswertung nach dem Speichern; Text in der App-Sprache. |
Übungsnamen sind immer englisch. Navigation bleibt „Home · Stats · Übungen · FAQs · Einst.“.

## Entscheidungen
- **Git/Cloud:** Nie auf `main`; Branch `claude/<kurz>` + PR; Paul mergt. Keine Produktionszugriffe.
- **Texte:** Alles DE+EN über `t()`; neue Features/UI/Texte erst als Vorschlag.
- **Gilt überall gleich:** Workout-Funktionen in selbst erstellten, generierten und Favoriten-Workouts identisch.
- **Abhaken:** Leiste unter dem aktuellen Satz („Variante B“), kein extra Block; Pause im Pausentimer.
- **Fokus-Modus:** Start-Knopf „Satz {n} starten“ (sobald kein Warm-up-Timer läuft); Pause groß, danach automatisch weiter;
  Pausenbild erlaubt Anpassen des nächsten Satzes; „Übersicht“ beendet nichts.
- **Zeitübungen:** Timer startet nach regulär abgelaufener Pause automatisch (nicht nach „Überspringen“); Ton bei 10 s und 3-2-1;
  „Zeit halten“ wird am Ende automatisch abgehakt.
- **Timer:** Gesamttimer startet mit dem Warm-up, sonst mit dem ersten Satz; Abbrechen und Speichern beenden Gesamttimer, Pause, Fokus, Warm-up.
- **Farben:** Hell – Ocean/Violet/Sunset mit dunklerem Akzent und weißer Schrift; Lime behält dunkle Schrift. Lesbarkeit zuerst.
- **Layout Workout-Ansicht:** Bild + Name + ⋮ in einer Zeile; Aktionsreihe „+ Satz / + Aufwärmsatz / Notiz“; Sätze ohne eigenen Kasten; aktuelle Zeile leicht hinterlegt.
- **Einstellungen:** Bereiche klappen per Tipp auf den Titel auf. **Verifier-Protokoll** bleibt vorerst.
- **KI-Texte (Erstnutzung):** Zahlen genannt (8 Workouts/4 Wochen, 60 KI-Auswertungen/Monat), KI-Dienst OpenAI genannt, Einführung 7 Seiten.
  Offen: Datenschutzerklärung (Impressum-Seite) muss dazu passen (rechtlich prüfen).
- **KI-Feedback:** Coach statt Protokoll, höchstens 3 Übungen mit Besonderheit; Zahlen müssen aus den Trainingsdaten stammen (Verifier aktiv).
