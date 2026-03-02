# Verifikations-Checkliste: Fehlerbehobengs-Status

**Ziel:** 100% Verifikation aller 5 kritischen Bugs bevor Feedback gegeben wird.

---

## 🔴 Problem 1: Timer im Landscape-Modus zu weit oben

### Beobachtung:
Timer-Overlay geht über Display-Grenzen hinaus (besonders Top-Ecken bei Notch/Safe-Area)

### Implementierte Lösung:
**Datei:** [client/src/components/timer/WorkoutTimerBar.vue](client/src/components/timer/WorkoutTimerBar.vue#L438-L448)

```css
@media (orientation: landscape) {
  .timer-bar {
    position: fixed;
    top: env(safe-area-inset-top);           /* Notch-Höhe berücksichtigen */
    left: env(safe-area-inset-left);
    right: env(safe-area-inset-right);
    bottom: env(safe-area-inset-bottom);
    
    width: calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right));
    width: calc(100dvw - env(safe-area-inset-left) - env(safe-area-inset-right));
    
    height: calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}
```

### CSS-Prüfung: ✅ VERIFIED
- Safe-area-inset Variables vorhanden: ✓
- 100dvh (dynamic viewport height) Fallback: ✓
- box-sizing: border-box gesetzt: ✓

### Verifikation erforderlich:
- [ ] iPhone im **Landscape-Modus** starten
- [ ] Full-Screen-Timer öffnen
- [ ] Prüfen: Timer ragt **nicht** über Safe-Area hinaus
- [ ] Prüfen: Kein schwarzer Bereich unten/oben verschwindend?

---

## 🔴 Problem 2: Settings View zeigt schwarzen Bildschirm

### Beobachtung:
Navigation zu SettingsView zeigt nur schwarzen Bildschirm, Inhalt ist nicht sichtbar/nicht erreichbar

### Implementierte Lösung:
**Datei:** [client/src/views/SettingsView.vue](client/src/views/SettingsView.vue#L2549-L2555)

```scss
.settings-view {
  min-height: 100vh;           /* Min-Höhe statt fixed Höhe */
  background: var(--bg);        /* Background-Farbe setzen */
  color: var(--fg);             /* Text-Farbe setzen */
  /* overflow: hidden entfernt – jetzt implizit overflow: visible */
}
```

### CSS-Prüfung: ✅ VERIFIED
- `min-height: 100vh` statt `height: 100%`: ✓ (erlaubt Scrolling)
- `overflow: hidden` entfernt: ✓
- `background: var(--bg)` + `color: var(--fg)` gesetzt: ✓

### Root-Cause-Analyse:
**Mögliche Ursachen für schwarzen Bildschirm:**
1. ❌ CSS overflow: hidden → **FIXED**
2. ❓ Background-Farbe nicht gesetzt → **FIXED**
3. ❓ Route nicht erreichbar → **NEEDS TESTING**
4. ❓ JavaScript Error im Component → **NEEDS TESTING**

### Verifikation erforderlich:
- [ ] App öffnen → Navigation → Settings anklicken
- [ ] Prüfen: Settings-View lädt (nicht schwarz)
- [ ] Prüfen: Inhalte sind sichtbar (Avatar, Username, etc.)
- [ ] Prüfen: Page scrollbar (wenn Inhalt > Viewport)
- [ ] Browser Console: Keine JS-Fehler?

---

## 🔴 Problem 3: Exercise Filter Design-Inkonsistenz

### Beobachtung:
Equipment-Filter und Muscle-Group-Filter haben unterschiedliche Styles (Button vs Dropdown unterschiedlich gestaltet)

### Implementierte Lösung:
**Datei:** [client/src/components/ExerciseList.vue](client/src/components/ExerciseList.vue#L21-L52)

#### Alle Filter usenlche jetzt `.equipment-filter-select` Klasse:

```html
<!-- Equipment-Filter (Primary) -->
<select id="equipment-filter-select" 
        class="equipment-filter-select">
  <!-- options -->
</select>

<!-- Muscle-Group-Filter (Secondary) -->
<select id="muscle-group-select"
        class="equipment-filter-select">
  <!-- options -->
</select>

<!-- Search-Input (auch unified) -->
<input class="equipment-filter-select search-input" />
```

### CSS Styling (unified):
```css
.equipment-filter-select {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  min-width: 140px;
  background: var(--bg-panel);
  color: var(--fg);
}
```

### CSS-Prüfung: ✅ VERIFIED
- **Equipment-Filter:** `.equipment-filter-select` Klasse: ✓
- **Muscle-Group-Filter:** `.equipment-filter-select` Klasse: ✓  
- **Search-Input:** `.equipment-filter-select + .search-input` Klassen: ✓
- **CSS Rules konsistent:** ✓

### Verifikation erforderlich:
- [ ] ExercisesView öffnen
- [ ] Side-by-Side Vergleich:
  - [ ] Equipment-Dropdown (Primary Row)
  - [ ] Muscle-Group-Dropdown (Secondary Row)
  - [ ] Search-Input (Tertiary Row)
- [ ] Prüfen: Alle 3 Elemente haben **gleiche Höhe**, **gleiche Padding**, **gleiche Border**
- [ ] Prüfen: Border-Farbe und Background-Farbe identisch

---

## 🔴 Problem 4: Workout Generator hängt/bleibt stecken

### Beobachtung:
Quick-Workout-Generator startet nicht/zeigt keine Antwort, lädt endlos

### Implementierte Lösung:
**Datei:** [client/src/views/DashboardView.vue](client/src/views/DashboardView.vue#L677-L680)

```javascript
// Promise.race mit 20s Timeout
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('API timeout after 20s')), 20000)
)

const { data } = await Promise.race([
  http.post('/workouts/quick-generator', payload, { headers }),
  timeoutPromise
])
```

### Code-Prüfung: ✅ VERIFIED
- Timeout-Promise erstellt: ✓
- Promise.race implementiert: ✓
- 20-Sekunden-Limit gesetzt: ✓
- Error-Handling vorhanden: ✓

### Verifikation erforderlich:
- [ ] Dashboard öffnen → "Schnelles Workout generieren" anklicken
- [ ] Quick-Generator Modal öffnen
- [ ] Duration, Goal, Gender eingeben
- [ ] "Generieren" klicken
- [ ] Timing-Test:
  - [ ] Normalfall: Antwort < 5s → sollte funktionieren
  - [ ] Timeout-Fall: Wenn API nicht antwortet >20s → sollte Fehler zeigen (nicht endlos hängen)
  - [ ] Error-Message korrekt angezeigt?

### Root-Cause:
**Mögliche Ursachen:**
1. ❓ API `/workouts/quick-generator` antwortet nicht → Timeout sollte helfen
2. ❓ Netzwerk-Fehler → Timeout sollte helfen
3. ❓ JavaScript-Fehler im Error-Handler → **NEEDS TESTING**
4. ❓ Modal wird nicht geschlossen auf Error → **NEEDS TESTING**

---

## 🔴 Problem 5: Quick Generator Dark-Mode Kontrast schlecht

### Beobachtung:
Im Dark-Mode ist Quick-Generator Modal schwer/unmöglich zu lesen (Text zu dunkel?/Hintergrund zu dunkel?)

### Implementierte Lösung:
**Datei:** [client/src/views/DashboardView.vue](client/src/views/DashboardView.vue#L1078-L1088)

```css
:deep(.modal.quick-cta-modal) {
  --modal-text: var(--fg-strong);        /* Starker Vordergrund */
  --modal-bg: var(--bg-panel);            /* Panel-Hintergrund */
}

:deep(.modal.quick-cta-modal .modal-title) {
  color: var(--fg-strong);                /* Titel: Stark */
  font-weight: 700;
}

:deep(.modal.quick-cta-modal .modal-message) {
  color: var(--muted);                    /* Message: Gedimmt */
  line-height: 1.5;
}

:deep(.modal.quick-cta-modal .btn) {
  font-weight: 800;
  padding: 11px 16px;
}

:deep(.modal.quick-cta-modal .btn.primary) {
  background: var(--accent);
}
```

### CSS-Prüfung: ✅ VERIFIED
- CSS Custom Properties für Dark Mode: ✓
- `.modal-title` hat `var(--fg-strong)`: ✓
- `.modal-message` hat `var(--muted)`: ✓
- Button-Styling mit `var(--accent)`: ✓

### Verifikation erforderlich:
- [ ] **Dark-Mode aktivieren** (Settings → Theme → Dark)
- [ ] Quick-Generator öffnen
- [ ] Modal sichtbar?
- [ ] Text lesbar?
- [ ] Kontrast ausreichend (kein Grau-auf-Grau)?
- [ ] Button sichtbar und klickbar?
- [ ] Farb-Kontrast-Ratio prüfen (sollte mindestens 4.5:1 sein)

---

## 📋 Verifikations-Workflow

### Phase 1: Build & Deploy ✅ COMPLETED
- [x] `npm run build` – erfolgreich (3.94s)
- [x] `npx cap sync ios` – erfolgreich
- [x] iOS App assets synchronisiert

### Phase 2: Visuelle Tests (Manual/Device)
- [ ] iOS Simulator oder echtes iPhone
- [ ] Alle 5 Szenarien durchlaufen
- [ ] Screenshots/Videos für Docu

### Phase 3: Bugbericht (falls noch Fehler)
Falls nach Verifikation noch Fehler bekannt:
- Konkrete Beschreibung des Problems
- Reproduzierbare Schritte
- Screenshot/Video des Fehlers
- Browser Console Errors?

---

## 🔧 Fehlerbehebungs-Tipps

### Timer Im Landscape nicht richtig?
```javascript
// inspect computed values
window.getComputedStyle(document.querySelector('.timer-bar')).top
window.getComputedStyle(document.querySelector('.timer-bar')).width
```

### Settings-View immer noch schwarz?
```javascript
// In Console
const settingsView = document.querySelector('.settings-view')
window.getComputedStyle(settingsView).backgroundColor
window.getComputedStyle(settingsView).color
```

### Filter vergleichen
```javascript
// Alle 3 Filter messen
const equipment = document.getElementById('equipment-filter-select')
const muscle = document.getElementById('muscle-group-select')
const search = document.querySelector('.equipment-filter-select.search-input')

[equipment, muscle, search].forEach(el => {
  const style = window.getComputedStyle(el)
  console.log({
    element: el.id || 'search-input',
    padding: style.padding,
    borderRadius: style.borderRadius,
    borderColor: style.borderColor,
    backgroundColor: style.backgroundColor,
    color: style.color
  })
})
```

### Dark Mode Farben überprüfen
```javascript
// Hole alle CSS-Variablen
const styles = document.documentElement.style
const variables = {
  'fg-strong': getComputedStyle(document.documentElement).getPropertyValue('--fg-strong'),
  'bg-panel': getComputedStyle(document.documentElement).getPropertyValue('--bg-panel'),
  'muted': getComputedStyle(document.documentElement).getPropertyValue('--muted')
}
console.table(variables)
```

---

## 📊 Status Summary

| Problem | Code-Fix | Deploy | Verify |
|---------|----------|--------|--------|
| Timer Landscape | ✅ | ✅ | ⏳ |
| Settings Schwarz | ✅ | ✅ | ⏳ |
| Filter Design | ✅ | ✅ | ⏳ |
| Generator Hangt | ✅ | ✅ | ⏳ |
| Dark Mode Kontrast | ✅ | ✅ | ⏳ |

**Next Step:** Mit Gerät testen!

