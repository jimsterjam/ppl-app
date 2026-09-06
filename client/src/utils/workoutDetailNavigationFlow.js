export function goDashboard({
  isFavoriteAdjustMode,
  isDirty,
  showLeaveModal,
  router,
  discardDraftAndLeave
}) {
  if (isFavoriteAdjustMode) {
    if (isDirty) {
      showLeaveModal.value = true
      return
    }
    router.push('/dashboard')
    return
  }

  if (isDirty) {
    showLeaveModal.value = true
    return
  }

  discardDraftAndLeave()
}

export function confirmLeave({
  isFavoriteAdjustMode,
  suppressDraftPersistence,
  router,
  discardDraftAndLeave
}) {
  if (isFavoriteAdjustMode) {
    suppressDraftPersistence.value = true
    router.push('/dashboard')
    return
  }

  discardDraftAndLeave()
}

export async function applyPendingTimerAction({
  pendingTimerAction,
  performSaveWorkout,
  discardDraftAndLeave,
  bypassTimerLeaveGuard,
  router
}) {
  const action = pendingTimerAction.value
  pendingTimerAction.value = null
  if (!action) return

  if (action.kind === 'save') {
    await performSaveWorkout(action.updateFavorite, { deferAiFeedback: !!action.deferAiFeedback })
    return
  }

  if (action.kind === 'dashboard') {
    await discardDraftAndLeave()
    return
  }

  if (action.kind === 'route-leave' && action.targetPath) {
    bypassTimerLeaveGuard.value = true
    router.push(action.targetPath)
  }
}

export async function onTimerDecision({
  mode,
  pendingTimerAction,
  showTimerActionModal,
  timerStore,
  applyPendingTimerAction
}) {
  if (mode === 'continue') {
    pendingTimerAction.value = null
    showTimerActionModal.value = false
    return
  }

  if (mode === 'pause' && timerStore.isRunning) {
    timerStore.pause()
  } else if (mode === 'stop') {
    timerStore.reset()
  }

  showTimerActionModal.value = false
  await applyPendingTimerAction()
}
