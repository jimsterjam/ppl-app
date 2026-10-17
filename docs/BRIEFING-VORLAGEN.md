# Vorlagen: Aufgabe und Fehlermeldung

## Aufgaben-Briefing (kopieren, ausfüllen)
```
Ziel:            Was soll der Nutzer danach können / was stört heute? (1–2 Sätze)
Betroffen:       Bereich/Ansicht, Workout-Arten (selbst / generiert / Favorit), Messarten
Abnahme:         3–6 nachprüfbare Punkte (z. B. „Name 3 Zeilen, nichts ragt raus, DE und EN, 360 px“)
Nicht ändern:    Was ausdrücklich bleibt (Verhalten, Texte, Daten, Server)
Vorgehen:        [ ] erst Vorschlag/Mockup   [ ] direkt umsetzen (klarer Bugfix)
Prüfen:          docs/UI-CHECKLISTE.md + check-all.sh --build; Browser-Screenshot ja/nein
Offene Fragen:   Entscheidungen, die vor dem Start geklärt sein müssen
```
**Regeln:** Neue Features, UI und Texte erst als Vorschlag (CLAUDE.md). Klar umrissene Bugfixes direkt, mit Regressionstest wo möglich.
Entscheidungen danach in `docs/GLOSSAR-UND-ENTSCHEIDUNGEN.md` eintragen.

## Fehlermeldung
```
Was passiert:    …
Erwartet:        …
Schritte:        1. … 2. … 3. …
Gerät/iOS:       z. B. iPhone 15, iOS 18
Sprache/Modus:   Deutsch/Englisch, hell/dunkel, Akzentfarbe
Workout-Art:     selbst erstellt / generiert / Favorit; Messart
Screenshot:      ja/nein (bitte anhängen)
Build:           Stand der App (nach welchem Merge gebaut?)
```
Tipp: Ein Satz plus Screenshot genügt, wenn Sprache, Modus und Workout-Art dabeistehen. „Nicht vorhanden“ bitte mit dem
Build-Stand angeben – so lässt sich „alter Build“ von „echter Fehler“ trennen.
