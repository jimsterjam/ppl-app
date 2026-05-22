# Mobile Optimization — PPL App (Capacitor/iOS)

**Letzte Aktualisierung:** Aktuell

---

## Status-Übersicht

| Phase | Fokus | Status |
|-------|-------|--------|
| Phase 1 | Quick Wins (Logging, Validation, DB-Indexing) | ✅ Fertig |
| Phase 2 | Stability (Error Handling, Code Dedup) | ✅ Fertig |
| Phase 3 | Offline Support | ✅ Fertig |
| Phase 4 | Mobile Performance | 🔄 Teilweise |
| Phase 5 | Mobile UX | 🔄 Teilweise |
| Phase 6 | Native Features | 🔄 Teilweise |

---

## ✅ Phase 3: Offline Support — FERTIG

Alle Kernkomponenten sind implementiert:

- `client/src/utils/offlineStorage.js` — Dexie.js-basierte IndexedDB (`db.workouts`, `db.exercises`)
- `client/src/utils/syncManager.js` — Sync Queue, Auto-Sync bei Reconnect
- `client/src/utils/assetCache.js` — Asset-Caching
- `client/src/components/OfflineIndicator.vue` — Online/Offline/Syncing-Badge
- Draft-System (`_isDraft`, `isDraft`, Tombstones) — In `userStore.js` + `workoutMerge.js`

---

## 🔄 Phase 4: Mobile Performance — Offen

- [ ] Route-basiertes Code Splitting vollständig (Router-Lazy-Loading prüfen)
- [ ] Bundle-Analyse: `cd client && npm run build && npx vite-bundle-visualizer`
- [ ] Virtual Scrolling für Exercise-Listen bei 100+ Einträgen (`vue-virtual-scroller`)
- [x] Image Lazy Loading via assetCache.js

---

## 🔄 Phase 5: Mobile UX — Offen

- [ ] Touch Targets überall ≥ 44x44px (Safari Inspector prüfen)
- [ ] Pull-to-Refresh auf Dashboard / Exercise-Liste
- [ ] Bottom Sheets statt Modals auf kleinen Screens
- [x] Safe-Area-Insets gesetzt (`viewport-fit=cover`, `env(safe-area-inset-*)`)

---

## 🔄 Phase 6: Native Features — Teilweise

- [x] Camera: `@capacitor/camera` in `SettingsView.vue` (Avatar/Cover-Upload)
- [ ] Push Notifications: Workout-Reminder (`@capacitor/push-notifications` + FCM)
- [ ] Biometric Auth: Face ID / Touch ID Login (`@capacitor/biometric-auth`)
- [ ] Haptic Feedback bei destruktiven Aktionen (`@capacitor/haptics`)

---

## Nächste Prioritäten

1. **Push Notifications** — hoher User-Engagement-Effekt
2. **Virtual Scrolling** — bei wachsender Exercise-Liste relevant
3. **Pull-to-Refresh** — Standard Mobile-Pattern, noch nicht umgesetzt
