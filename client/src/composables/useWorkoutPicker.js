/**
 * useWorkoutPicker
 *
 * Reine 1:1-Extraktion der NumberPicker-Steuerlogik (Reps/Gewicht-Eingabe) aus
 * WorkoutDetailView.vue (Auslagerungsplan "Schritt 1: UI-Interaction-Composables").
 * Enthält auch den "Ghost-Click"-Schutz: NumberPicker.vue ist ein position:fixed
 * Vollbild-Overlay, das per v-if sofort aus dem DOM verschwindet, sobald der Nutzer auf
 * "OK" tippt. Auf iOS/WKWebView kann das Antippen eines Elements, das sich genau in diesem
 * Moment aus dem DOM entfernt, ein nachgelagertes synthetisches Ghost-Click-Event auf das
 * darunterliegende Element (z.B. "+ Satz hinzufügen") auslösen - armPickerGhostClickGuard()/
 * swallowPickerGhostClick() fangen das für ein kurzes Zeitfenster ab.
 *
 * Kein Bezug zu Save/Draft/Race-Themen, daher als erster (risikoärmster) Extraktionsschritt.
 *
 * @param {Object} options
 * @param {import('vue').Ref<boolean>} options.isMobile - Picker wird nur auf Mobile gezeigt.
 * @param {(row: object, field: string, value: number) => void} [options.onValueChanged] -
 *   Callback nach Bestätigung (WorkoutDetailView.vue ruft hier bisher triggerAutoSave() auf -
 *   bewusst per Dependency Injection statt harter Kopplung, damit dieses Composable nichts
 *   über Draft-/Autosave-Logik wissen muss).
 */
import { ref, reactive } from 'vue'
import { logDiagnostic } from '@/utils/diagnosticsLog'

const PICKER_GHOST_CLICK_GUARD_MS = 400

export function useWorkoutPicker({ isMobile, onValueChanged } = {}) {
  const pickerVisible = ref(false)
  const pickerValue = ref(0)
  const pickerConfig = reactive({
    min: 0,
    max: 1000,
    step: 1,
    splitDecimals: false,
    decimalOptions: [0, 0.25, 0.5, 0.75],
    title: '',
    confirmText: 'OK',
    cancelText: 'Abbrechen'
  })
  let pickerTarget = null // { row, field }

  let suppressNextPickerOpen = false
  let pickerGhostClickGuardUntil = 0
  let lastPickerCloseAt = 0

  // WorkoutDetailView.vue unterdrückt das Öffnen des Pickers bisher gezielt nach bestimmten
  // Ereignissen (z.B. direkt nach dem Laden eines Workouts), damit ein programmatischer
  // focus() nicht versehentlich den Picker aufreißt. 1:1 wie zuvor als extern aufrufbare
  // Funktion statt eines direkt gesetzten Flags.
  function suppressNextOpen(ms = 300) {
    suppressNextPickerOpen = true
    setTimeout(() => { suppressNextPickerOpen = false }, ms)
  }

  function armPickerGhostClickGuard() {
    pickerGhostClickGuardUntil = Date.now() + PICKER_GHOST_CLICK_GUARD_MS
    lastPickerCloseAt = Date.now()
  }

  function swallowPickerGhostClick(event) {
    if (Date.now() >= pickerGhostClickGuardUntil) return
    pickerGhostClickGuardUntil = 0
    try {
      event.preventDefault()
      event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    } catch {}
    logDiagnostic('ghost-click-swallowed', {
      target: event?.target?.tagName || null,
      className: event?.target?.className || null
    })
  }

  function getLastPickerCloseAt() {
    return lastPickerCloseAt
  }

  function openPicker(row, field, step = 1, min = 0, max = 1000, title = '') {
    logDiagnostic('picker-open', { field, currentValue: row?.[field], suppressed: suppressNextPickerOpen })
    if (suppressNextPickerOpen) {
      suppressNextPickerOpen = false
      return
    }
    // Only show the picker on mobile
    if (!isMobile?.value) return
    pickerTarget = { row, field }
    pickerConfig.step = step
    pickerConfig.min = min
    pickerConfig.max = max
    pickerConfig.splitDecimals = field === 'weight'
    pickerConfig.decimalOptions = pickerConfig.splitDecimals ? [0, 0.25, 0.5, 0.75] : [0]
    pickerConfig.title = title || (field === 'weight' ? 'Gewicht (kg)' : 'Wiederholungen')
    pickerValue.value = Number(row[field]) || 0
    pickerVisible.value = true
  }

  function onPickerConfirm(val) {
    armPickerGhostClickGuard()
    if (!pickerTarget) { pickerVisible.value = false; return }
    const { row, field } = pickerTarget
    row[field] = val
    try { onValueChanged?.(row, field, val) } catch {}
    pickerVisible.value = false
    pickerTarget = null
  }

  function onPickerCancel() {
    armPickerGhostClickGuard()
    pickerVisible.value = false
    pickerTarget = null
  }

  return {
    pickerVisible,
    pickerValue,
    pickerConfig,
    openPicker,
    onPickerConfirm,
    onPickerCancel,
    armPickerGhostClickGuard,
    swallowPickerGhostClick,
    suppressNextOpen,
    getLastPickerCloseAt
  }
}
