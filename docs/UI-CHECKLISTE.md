# UI-Checkliste (vor jedem PR mit sichtbaren Änderungen)

Entstanden aus wiederkehrenden Fehlern im Verlauf (Lesbarkeit, Überlauf auf Deutsch, vergessene Zustände). Jeder Punkt wird
im PR unter „Verifiziert“ bzw. „Nur per Code-Lektüre geprüft“ benannt.

## 1. Ansicht
- [ ] **Dunkel und Hell**, jeweils alle vier Akzentfarben (Lime, Ocean, Violet, Sunset).
- [ ] **Deutsch und Englisch** (Deutsch ist meist länger – dort zuerst prüfen).
- [ ] Breiten **340, 360, 390 px**; kein horizontaler Überlauf, nichts ragt aus Rahmen/Karte.
- [ ] **Lesbarkeit:** Textkontrast ≥ 4,5:1, Schrift nie kleiner als vorher, Tippflächen ≥ 44 px.
- [ ] Auf Akzentflächen: Lime = dunkle Schrift; Ocean/Violet/Sunset (hell) = weiße Schrift/Icons.
- [ ] Lange Namen (Übung, Workout, Favorit) und leere Zustände (Erstnutzung, keine Daten).

## 2. Verhalten
- [ ] Gilt in **allen Workout-Arten gleich**: selbst erstellt, generiert, Favorit (und Favorit anpassen).
- [ ] **Alle Messarten:** Gewicht + Wiederholungen, Zeit halten, Wiederholungen in fester Zeit.
- [ ] **Laufende Timer** (Gesamttimer, Pause, Satz-Timer, Warm-up): enden beim Abbrechen und beim Speichern; kein Rest beim nächsten Start.
- [ ] Minimieren/Schließen eines Fensters beendet keinen laufenden Zustand (Modal-Muster, `useScrollLock`).
- [ ] Nichts wird vom Bottom-Nav oder von Leisten verdeckt (Abbrechen/Speichern bleiben erreichbar).
- [ ] Offline/Sync-Verhalten nicht verändert, sonst eigene Freigabe.

## 3. Texte
- [ ] Jeder sichtbare Text über `t()`/`$t()` in DE **und** EN (auch `aria-label`, `title`, `placeholder`, Toasts).
- [ ] Begriffe laut `docs/GLOSSAR-UND-ENTSCHEIDUNGEN.md`; Einheiten dabei („−15 Sek.“).
- [ ] Fachbegriffe kurz erklärt; Übungsnamen bleiben englisch.
- [ ] Umlaute korrekt (kein „loeschen“), „FAQs“ statt „FAQ's“.

## 4. Automatisch prüfen
```bash
# Workout-Ansicht: Matrix aus Modus × Akzent × Sprache × Breite (Überlauf, Kontrast, Screenshots)
PLAYWRIGHT_MODULE=/pfad/zu/playwright/index.mjs node scripts/ui-check/ui-check.mjs          # volle Matrix (~2 Min.)
PLAYWRIGHT_MODULE=/pfad/zu/playwright/index.mjs node scripts/ui-check/ui-check.mjs --quick  # dunkel/hell × Lime × DE/EN × 390 px
```
Exit-Code 1 bei Funden. Screenshots liegen in `$UI_CHECK_OUT` (Standard: Temp-Ordner). Das Skript legt keine
Abhängigkeit an und räumt seine temporären Dateien wieder auf. **Grenzen:** prüft nur die Workout-Ansicht mit festen Testdaten;
Verlauf-Hintergründe (z. B. Start-Knopf) werden nicht gemessen; ersetzt keinen Blick auf einem echten iPhone.

Zusätzlich wie bisher: `bash scripts/check-all.sh --build`.
