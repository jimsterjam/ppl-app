/**
 * useWorkoutExerciseOrdering
 *
 * Reine 1:1-Extraktion der Drag&Drop-/Reorder-Interaktionslogik aus WorkoutDetailView.vue
 * (Auslagerungsplan "Schritt 1: UI-Interaction-Composables", niedrigstes Risiko - kein Bezug
 * zu Save/Draft/Race-Themen). Verhalten wurde bewusst NICHT verändert, nur verschoben:
 * - Desktop-Drag via native HTML5 Drag&Drop Events (dragstart/dragover/dragleave/drop/dragend)
 * - Mobile via Pointer Events (bevorzugt) mit Touch-Event-Fallback (falls Pointer Events auf
 *   dem Gerät/Browser nicht zuverlässig feuern)
 * - findExerciseIndexAtPoint() nutzt document.elementFromPoint() + [data-ex-index], damit
 *   während des Ziehens erkannt wird, über welchem Exercise-Item sich der Finger befindet.
 *
 * Bewusst als Composable (nicht Modul-Singleton): jede WorkoutDetailView-Instanz bekommt
 * ihren eigenen, isolierten Drag-State - falls die View jemals mehrfach gleichzeitig
 * existieren sollte (z.B. durch <keep-alive>), teilen sich die Instanzen sonst denselben
 * Drag-Zustand, was zu Geister-Drags in der falschen Instanz führen könnte.
 *
 * @param {import('vue').Ref} workoutRef - Ref auf das aktuell bearbeitete Workout-Objekt
 *   (workout.value.exercises wird direkt mutiert, exakt wie zuvor in WorkoutDetailView.vue).
 */
import { ref } from 'vue'

export function useWorkoutExerciseOrdering(workoutRef) {
  const isReordering = ref(false)
  const draggingIndex = ref(null)
  const dropTargetIndex = ref(null)
  const exListRef = ref(null)

  const activeTouchPointerId = ref(null)
  let pointerMoveListener = null
  let pointerUpListener = null
  let pointerCancelListener = null
  const touchPointerTypes = new Set(['touch', 'pen'])

  const activeFallbackTouchId = ref(null)
  let fallbackTouchMoveListener = null
  let fallbackTouchEndListener = null
  let fallbackTouchCancelListener = null

  function toggleReorder() {
    isReordering.value = !isReordering.value
  }

  function onDragStart(index) {
    if (!isReordering.value) return
    draggingIndex.value = index
  }

  function onDragOver(index) {
    if (!isReordering.value) return
    dropTargetIndex.value = index
  }

  function onDragLeave(index) {
    if (!isReordering.value) return
    if (dropTargetIndex.value === index) dropTargetIndex.value = null
  }

  function onDrop(index) {
    if (!isReordering.value) return
    const from = draggingIndex.value
    const to = index
    if (from === null || to === null || from === to) return
    const list = workoutRef.value?.exercises
    if (!Array.isArray(list)) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    stopDrag()
  }

  function onPointerDown(event, index) {
    if (!isReordering.value || !touchPointerTypes.has(event.pointerType)) return
    if (activeFallbackTouchId.value !== null) return
    event.preventDefault()
    draggingIndex.value = index
    dropTargetIndex.value = index
    activeTouchPointerId.value = event.pointerId
    attachPointerDragListeners()
  }

  function attachPointerDragListeners() {
    if (typeof window === 'undefined' || pointerMoveListener) return
    pointerMoveListener = handlePointerMove
    pointerUpListener = handlePointerUp
    pointerCancelListener = handlePointerCancel
    window.addEventListener('pointermove', pointerMoveListener, { passive: false })
    window.addEventListener('pointerup', pointerUpListener)
    window.addEventListener('pointercancel', pointerCancelListener)
  }

  function cleanupPointerDragListeners() {
    if (typeof window === 'undefined') return
    if (pointerMoveListener) {
      window.removeEventListener('pointermove', pointerMoveListener)
      pointerMoveListener = null
    }
    if (pointerUpListener) {
      window.removeEventListener('pointerup', pointerUpListener)
      pointerUpListener = null
    }
    if (pointerCancelListener) {
      window.removeEventListener('pointercancel', pointerCancelListener)
      pointerCancelListener = null
    }
    activeTouchPointerId.value = null
  }

  function handlePointerMove(event) {
    if (event.pointerId !== activeTouchPointerId.value) return
    event.preventDefault()
    const nextIndex = findExerciseIndexAtPoint(event.clientX, event.clientY)
    if (nextIndex !== null) {
      dropTargetIndex.value = nextIndex
    }
  }

  function handlePointerUp(event) {
    if (event.pointerId !== activeTouchPointerId.value) return
    const targetIndex = dropTargetIndex.value ?? draggingIndex.value
    if (targetIndex !== null) {
      onDrop(targetIndex)
    }
    stopDrag()
  }

  function handlePointerCancel(event) {
    if (event.pointerId !== activeTouchPointerId.value) return
    stopDrag()
  }

  function onTouchStart(event, index) {
    if (!isReordering.value) return
    if (activeTouchPointerId.value !== null || activeFallbackTouchId.value !== null) return
    const touch = event.touches && event.touches[0]
    if (!touch) return
    draggingIndex.value = index
    dropTargetIndex.value = index
    activeFallbackTouchId.value = touch.identifier
    attachTouchDragListeners()
  }

  function attachTouchDragListeners() {
    if (typeof window === 'undefined' || fallbackTouchMoveListener) return
    fallbackTouchMoveListener = handleTouchMove
    fallbackTouchEndListener = handleTouchEnd
    fallbackTouchCancelListener = handleTouchCancel
    window.addEventListener('touchmove', fallbackTouchMoveListener, { passive: false })
    window.addEventListener('touchend', fallbackTouchEndListener)
    window.addEventListener('touchcancel', fallbackTouchCancelListener)
  }

  function cleanupTouchDragListeners() {
    if (typeof window === 'undefined') return
    if (fallbackTouchMoveListener) {
      window.removeEventListener('touchmove', fallbackTouchMoveListener)
      fallbackTouchMoveListener = null
    }
    if (fallbackTouchEndListener) {
      window.removeEventListener('touchend', fallbackTouchEndListener)
      fallbackTouchEndListener = null
    }
    if (fallbackTouchCancelListener) {
      window.removeEventListener('touchcancel', fallbackTouchCancelListener)
      fallbackTouchCancelListener = null
    }
    activeFallbackTouchId.value = null
  }

  function handleTouchMove(event) {
    if (!activeFallbackTouchId.value) return
    const touches = event.touches || []
    let touch = null
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === activeFallbackTouchId.value) {
        touch = touches[i]
        break
      }
    }
    if (!touch) return
    event.preventDefault()
    const nextIndex = findExerciseIndexAtPoint(touch.clientX, touch.clientY)
    if (nextIndex !== null) {
      dropTargetIndex.value = nextIndex
    }
  }

  function handleTouchEnd(event) {
    if (!activeFallbackTouchId.value) return
    const changed = event.changedTouches || []
    let touch = null
    for (let i = 0; i < changed.length; i++) {
      if (changed[i].identifier === activeFallbackTouchId.value) {
        touch = changed[i]
        break
      }
    }
    if (!touch) return
    const targetIndex = dropTargetIndex.value ?? draggingIndex.value
    if (targetIndex !== null) {
      onDrop(targetIndex)
    }
    stopDrag()
  }

  function handleTouchCancel(event) {
    if (!activeFallbackTouchId.value) return
    const changed = event.changedTouches || []
    let touch = null
    for (let i = 0; i < changed.length; i++) {
      if (changed[i].identifier === activeFallbackTouchId.value) {
        touch = changed[i]
        break
      }
    }
    if (!touch) return
    stopDrag()
  }

  function stopDrag() {
    draggingIndex.value = null
    dropTargetIndex.value = null
    cleanupPointerDragListeners()
    cleanupTouchDragListeners()
  }

  function findExerciseIndexAtPoint(x, y) {
    if (typeof document === 'undefined') return null
    const element = document.elementFromPoint(x, y)
    if (!element || typeof element.closest !== 'function') return null
    const target = element.closest('[data-ex-index]')
    if (!target || !exListRef.value || !exListRef.value.contains(target)) return null
    const raw = target.dataset?.exIndex
    if (!raw) return null
    const idx = Number(raw)
    return Number.isNaN(idx) ? null : idx
  }

  return {
    // state
    isReordering,
    draggingIndex,
    dropTargetIndex,
    exListRef,
    // actions
    toggleReorder,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onPointerDown,
    onTouchStart,
    stopDrag,
    // cleanup (WorkoutDetailView.vue ruft dies bisher explizit in onBeforeUnmount auf -
    // 1:1 beibehalten statt "korrigiert", da reine Extraktion ohne Verhaltensänderung)
    cleanupPointerDragListeners
  }
}
