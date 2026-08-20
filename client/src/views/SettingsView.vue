<template>
  <div class="settings-view">
    <HeaderBar :title="$t('settings.title')" />
    
    <div class="settings-content">
      <h2 class="section-title">{{ $t('settings.app') }}</h2>

      <section class="card card--app">
        <h3>{{ $t('settings.theme') }}</h3>
        <p class="hint">{{ $t('settings.themeHint') }}</p>
        <div class="theme-options">
          <label class="opt">
            <input type="radio" name="theme" value="light" :checked="theme === 'light'" @change="set('light')" />
            <span>{{ $t('settings.light') }}</span>
          </label>
          <label class="opt">
            <input type="radio" name="theme" value="dark" :checked="theme === 'dark'" @change="set('dark')" />
            <span>{{ $t('settings.dark') }}</span>
          </label>
        </div>
      </section>

      <section class="card card--app">
        <h3>{{ $t('settings.colorMode') }}</h3>
        <p class="hint">{{ $t('settings.colorModeHint') }}</p>
        <div class="theme-options">
          <label v-for="mode in colorModeOptions" :key="mode.value" class="opt">
            <input
              type="radio"
              name="color-mode"
              :value="mode.value"
              :checked="colorMode === mode.value"
              @change="setColorMode(mode.value)"
            />
            <span>{{ mode.label }}</span>
          </label>
        </div>
      </section>

      <section class="card card--app">
        <h3>{{ $t('settings.weeklyGoal') }}</h3>
        <p class="hint">{{ $t('settings.weeklyGoalHint') }}</p>
        <div class="goal-row">
          <input
            type="range"
            min="1"
            max="14"
            :value="weeklyGoal"
            @input="onRange($event)"
          />
          <div class="goal-input">
            <button class="step" @click="dec">−</button>
            <input type="number" min="1" max="14" :value="weeklyGoal" @input="onInput($event)"/>
            <button class="step" @click="inc">+</button>
          </div>
          <span class="goal-badge">{{ weeklyGoal }} {{ $t('settings.perWeek') }}</span>
        </div>
      </section>

      <section class="card card--app">
        <h3>{{ $t('settings.language') }}</h3>
        <div class="theme-options">
          <label class="opt">
            <input type="radio" name="lang" value="de" :checked="lang === 'de'" @change="setLang('de')" />
            <span>{{ $t('settings.german') }}</span>
          </label>
          <label class="opt">
            <input type="radio" name="lang" value="en" :checked="lang === 'en'" @change="setLang('en')" />
            <span>{{ $t('settings.english') }}</span>
          </label>
        </div>
      </section>

      <h2 class="section-title">{{ $t('settings.profileSection') }}</h2>

      <section class="card card--profile">
        <h3>{{ $t('settings.profilePicture') }}</h3>
        <p class="hint">{{ $t('settings.profilePictureHint') }}</p>

        <div class="avatar-row">
          <div class="avatar-preview" :class="{ empty: !avatarPreviewUrl && !settingsAvatarData && !settingsAvatarUrl }">
            <img v-if="avatarPreviewUrl || settingsAvatarData || settingsAvatarUrl" :src="avatarPreviewUrl || settingsAvatarData || settingsAvatarUrl" alt="" />
            <span v-else>{{ $t('settings.profilePictureEmpty') }}</span>
          </div>

          <div class="avatar-actions">
            <button v-if="isNativePlatform" class="outline-btn" type="button" @click="pickAvatarFromPhotos">
              {{ $t('settings.profilePicturePick') }}
            </button>
            <input
              v-if="!isNativePlatform"
              ref="avatarFileInput"
              class="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              @change="onAvatarFileChange"
            />
            <button
              v-if="!isNativePlatform"
              class="save-btn"
              type="button"
              :disabled="avatarUploading || !avatarFile"
              @click="uploadAvatar"
            >
              {{ avatarUploading ? $t('common.saving') : $t('settings.profilePictureUpload') }}
            </button>
            <div v-else class="hint tiny" style="margin:0">
              {{ $t('settings.profilePictureNativeAutoUploadHint') }}
            </div>
            <p class="hint tiny" style="margin:0">
              {{ $t('settings.profilePictureRules') }}
            </p>
          </div>
        </div>
      </section>

      <section class="card card--profile">
        <h3>{{ $t('settings.username') }}</h3>
        <p class="hint">{{ $t('settings.usernameHint') }}</p>
        <div class="username-row">
          <input
            class="text-input"
            type="text"
            :placeholder="$t('settings.usernamePlaceholder')"
            v-model="usernameDraft"
            autocomplete="nickname"
            maxlength="24"
          />
          <button class="save-btn" :disabled="usernameSaving" @click="saveUsername">
            {{ usernameSaving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </section>

      <h2 class="section-title">{{ $t('settings.coachSection') }}</h2>

      <section class="card card--coach">
        <h3 class="coach-title">
          <span>{{ $t('settings.coachTitle') }}</span>
          <span v-if="incomingInvites.length" class="coach-badge" :aria-label="$t('settings.incomingInvitesCount', { count: incomingInvites.length })">
            {{ incomingInvites.length }}
          </span>
        </h3>
        <p class="hint">{{ $t('settings.coachHint') }}</p>

        <div class="hint" style="margin-top: 8px">
          <strong>{{ $t('settings.coachConsentTitle') }}:</strong>
          {{ $t('settings.coachConsentText') }}
        </div>

        <div class="hint" style="margin-top: 8px">
          {{ $t('settings.coachHowToAccept') }}
        </div>

        <div class="coach-add-row">
          <input
            class="text-input"
            type="email"
            :placeholder="$t('settings.coachEmailPlaceholder')"
            v-model="coachEmail"
            autocomplete="email"
          />
          <button class="save-btn" :disabled="inviteSending || !coachEmail || !coachConsentChecked" @click="sendCoachInvite">
            {{ inviteSending ? $t('common.saving') : $t('settings.sendInvite') }}
          </button>
        </div>

        <label class="opt" style="display:flex; gap:10px; align-items:flex-start; margin-top:10px">
          <input type="checkbox" v-model="coachConsentChecked" />
          <span class="hint" style="margin:0">{{ $t('settings.coachConsentCheckbox') }}</span>
        </label>

        <div class="coach-clients-row" style="display:flex; gap:10px; flex-wrap:wrap">
          <button class="outline-btn" :disabled="invitesLoading" @click="loadMyInvites">
            {{ invitesLoading ? $t('common.loading') : $t('settings.loadInvites') }}
          </button>
          <button class="outline-btn" :disabled="activeCoachesLoading" @click="loadActiveCoaches">
            {{ activeCoachesLoading ? $t('common.loading') : $t('settings.loadActiveCoaches') }}
          </button>
        </div>

        <p v-if="incomingInvitesLoadedOnce" class="hint" style="margin-top: 8px">
          {{ $t('settings.incomingInvitesCount', { count: incomingInvites.length }) }}
        </p>

        <div v-if="clientsError" class="error-text" style="margin-top: 10px">{{ clientsError }}</div>

        <div v-if="outgoingInvites.length" class="coach-clients" style="margin-top: 12px">
          <p class="hint"><strong>{{ $t('settings.outgoingInvitesTitle') }}:</strong></p>
          <div v-for="inv in outgoingInvites" :key="inv.inviteId" class="client-row">
            <div class="client-meta">
              <div class="client-name">{{ inv.coachEmailLower || inv.coachUid }}</div>
              <div class="client-uid">{{ $t('settings.inviteStatus') }}: {{ inv.status }}</div>
            </div>
            <button
              v-if="inv.status === 'pending'"
              class="outline-btn"
              :disabled="inviteCancelingId === inv.inviteId"
              @click="cancelInvite(inv.inviteId)"
            >
              {{ inviteCancelingId === inv.inviteId ? $t('common.saving') : $t('settings.cancelInvite') }}
            </button>
          </div>
        </div>

        <div v-if="activeCoaches.length" class="coach-clients" style="margin-top: 12px">
          <p class="hint"><strong>{{ $t('settings.activeCoachesTitle') }}:</strong></p>
          <div v-for="c in activeCoaches" :key="c.coachUid" class="client-row">
            <div class="client-meta">
              <div class="client-name">{{ c.coachEmailLower || c.coachUid }}</div>
              <div class="client-uid">{{ c.coachUid }}</div>
            </div>
            <button
              class="outline-btn"
              :disabled="coachRevokingUid === c.coachUid"
              @click="revokeCoach(c.coachUid)"
            >
              {{ coachRevokingUid === c.coachUid ? $t('common.saving') : $t('settings.removeCoach') }}
            </button>
          </div>
        </div>

        <div class="coach-clients-row" style="margin-top: 14px">
          <button class="outline-btn" :disabled="incomingLoading" @click="loadIncomingInvites">
            {{ incomingLoading ? $t('common.loading') : $t('settings.loadIncomingInvites') }}
          </button>
        </div>

        <div v-if="incomingInvites.length" class="coach-clients" style="margin-top: 12px">
          <p class="hint"><strong>{{ $t('settings.incomingInvitesTitle') }}:</strong></p>
          <div v-for="inv in incomingInvites" :key="inv.inviteId" class="client-row">
            <div class="client-meta">
              <div class="client-name">{{ inv.clientUsername || inv.clientUid }}</div>
              <div class="client-uid">{{ inv.clientUid }}</div>
            </div>
            <button
              class="outline-btn"
              :disabled="inviteAcceptingId === inv.inviteId"
              @click="acceptInvite(inv.inviteId)"
            >
              {{ inviteAcceptingId === inv.inviteId ? $t('common.saving') : $t('settings.acceptInvite') }}
            </button>
          </div>
        </div>

        <div class="coach-clients-row" style="margin-top: 14px">
          <button class="outline-btn" :disabled="clientsLoading" @click="loadMyClients">
            {{ clientsLoading ? $t('common.loading') : $t('settings.loadClients') }}
          </button>
        </div>

        <div v-if="coachClients.length" class="coach-clients">
          <p class="hint"><strong>{{ $t('settings.clientsTitle') }}:</strong></p>
          <div v-for="c in coachClients" :key="c.uid" class="client-row">
            <div class="client-meta">
              <div class="client-name">{{ c.username || c.uid }}</div>
              <div class="client-uid">{{ c.uid }}</div>
            </div>
            <button class="outline-btn" @click="openClientWorkouts(c)">
              {{ $t('settings.viewWorkouts') }}
            </button>
          </div>
        </div>

        <div v-if="isDevelopment" class="dev-token-row">
          <button class="outline-btn" @click="copyIdToken">
            {{ $t('settings.copyTokenDev') }}
          </button>
        </div>
      </section>

      <!-- Development Tools Section -->
      <section v-if="isDevelopment" class="card dev-tools">
        <h3>🧪 Developer Tools</h3>
        <p class="hint">Features testing and debugging tools</p>
        <button class="dev-btn" @click="goToFeatureTest">
          🚀 Open Features Test Dashboard
        </button>
        <button class="dev-btn" @click="clearDraftDebugLog">
          🧹 Draft-Debug-Log leeren (vor Reproduce antippen)
        </button>
        <button class="dev-btn" @click="copyDraftDebugLog">
          🩺 Draft-Debug-Log kopieren
        </button>
        <div class="dev-plan-toggle">
          <div class="plan-status">
            <div>
              <span>Current plan:</span>
              <strong>{{ subscription.plan }}</strong>
            </div>
            <span v-if="devPlanOverride" class="override-chip">Override: {{ devPlanOverride }}</span>
            <span v-else class="override-chip ghost">Override inactive</span>
          </div>
          <div class="dev-plan-buttons">
            <button
              v-for="plan in devPlanOptions"
              :key="plan"
              class="dev-plan-btn"
              :class="{ active: (devPlanOverride || subscription.plan) === plan }"
              @click="forcePlan(plan)"
            >
              {{ planLabels[plan] }}
            </button>
            <button
              class="dev-plan-btn ghost"
              :disabled="!devPlanOverride"
              @click="clearDevPlan"
            >
              Clear Override
            </button>
            <button
              class="dev-plan-btn ghost danger"
              @click="disableDevTools"
            >
              Hide Dev Tools
            </button>
          </div>
          <p class="hint tiny">Local-only override. Clear storage to reset.</p>
        </div>
      </section>
      <section v-else class="card dev-unlock">
        <h3>🔒 Developer Tools</h3>
        <p class="hint">Tap the badge below five times to unlock QA controls on this device.</p>
        <button class="dev-unlock-badge" @click="handleDevUnlockTap">
          <span v-if="devTapCount === 0">Tap 5x to unlock</span>
          <span v-else>{{ tapsRemaining }} more tap{{ tapsRemaining === 1 ? '' : 's' }}</span>
        </button>
        <p class="hint tiny">Unlock state lives in localStorage and never syncs to production users.</p>
      </section>

      <section class="card">
        <h3>{{ $t('settings.legalTitle') }}</h3>
        <p class="hint">{{ $t('settings.legalHint') }}</p>
        <button class="legal-btn" @click="$router.push('/legal')">
          <span>ℹ️</span>
          <span>{{ $t('settings.legalLink') }}</span>
        </button>
      </section>

      <section class="card danger-zone">
        <h3>{{ $t('settings.dangerZone') }}</h3>
        <p class="hint">{{ $t('settings.dangerZoneHint') }}</p>
        <button class="danger-btn" @click="showDeleteConfirm = true" :disabled="isDeleting">
          <span v-if="isDeleting" class="spinner" aria-hidden="true"></span>
          <span v-else>🗑️</span>
          {{ isDeleting ? $t('settings.deleting') : $t('settings.deleteAllData') }}
        </button>
      </section>

      <section class="card danger-zone account-danger">
        <h3>{{ $t('settings.dangerZone') }} - Account</h3>
        <p class="hint">{{ $t('settings.dangerZoneHint') }}</p>
        <button class="danger-btn account-delete-btn" @click="showDeleteAccountConfirm = true" :disabled="isDeletingAccount">
          <span v-if="isDeletingAccount">🔄</span>
          <span v-else>🗑️</span>
          {{ isDeletingAccount ? $t('settings.deletingAccount') : $t('settings.deleteAccount') }}
        </button>
      </section>
      
    </div>

    <Transition name="modal" appear>
      <div v-if="showClientModal" class="modal-overlay" @click.self="closeClientModal">
        <div class="modal-content modal-wide" @click.stop>
          <div class="modal-header">
            <h3>
              {{ $t('settings.clientWorkoutsTitle') }}
              <span v-if="selectedClient" style="opacity:0.75; font-weight:600"> — {{ selectedClient.username || selectedClient.uid }}</span>
            </h3>
            <button class="close-btn" @click="closeClientModal" aria-label="Schließen">×</button>
          </div>
          <div class="modal-body">
            <template v-if="!selectedWorkoutId">
              <div v-if="clientWorkoutsLoading" class="hint">{{ $t('common.loading') }}</div>
              <div v-else-if="!selectedClientWorkouts.length" class="hint">{{ $t('settings.noWorkoutsForClient') }}</div>
              <div v-else class="client-workouts">
                <button
                  v-for="w in selectedClientWorkouts"
                  :key="w._id"
                  class="client-workout-row"
                  type="button"
                  @click="openWorkoutDetail(w)"
                >
                  <div class="client-workout-main">
                    <div class="client-workout-title">{{ w.name || 'Workout' }}</div>
                    <div class="client-workout-sub">
                      {{ (w.type || '').toUpperCase() }} · {{ w.completed ? $t('common.confirm') : $t('common.unknown') }}
                    </div>
                  </div>
                  <div class="client-workout-date">
                    {{ formatWorkoutDate(w) }}
                  </div>
                </button>
              </div>
            </template>

            <template v-else>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom: 10px;">
                <button class="outline-btn" type="button" @click="backToClientWorkouts">{{ $t('common.back') }}</button>
                <div class="hint" style="margin:0">{{ $t('settings.coachWorkoutDetailTitle') }}</div>
              </div>

              <div v-if="workoutDetailLoading" class="hint">{{ $t('common.loading') }}</div>
              <div v-else-if="!selectedWorkoutDetail" class="hint">{{ $t('common.error') }}</div>
              <div v-else class="workout-detail">
                <div class="workout-detail-header">
                  <div class="workout-detail-title">{{ selectedWorkoutDetail.name || 'Workout' }}</div>
                  <div class="workout-detail-sub">
                    {{ (selectedWorkoutDetail.type || '').toUpperCase() }} · {{ formatWorkoutDate(selectedWorkoutDetail) }}
                  </div>
                </div>

                <div v-if="selectedWorkoutDetail.notes" class="workout-notes">
                  <div class="workout-section-title">{{ $t('settings.workoutNotesTitle') }}</div>
                  <div class="workout-notes-text">{{ selectedWorkoutDetail.notes }}</div>
                </div>

                <div class="workout-section-title" style="margin-top: 12px;">{{ $t('settings.workoutExercisesTitle') }}</div>
                <div v-if="!selectedWorkoutDetail.exercises || !selectedWorkoutDetail.exercises.length" class="hint">
                  {{ $t('settings.noExercisesInWorkout') }}
                </div>
                <div v-else class="workout-exercises">
                  <div v-for="(ex, idx) in selectedWorkoutDetail.exercises" :key="idx" class="workout-exercise">
                    <div class="workout-exercise-head">
                      <div class="workout-exercise-name">{{ ex.name || ex.exerciseId || 'Übung' }}</div>
                      <div class="workout-exercise-meta">
                        <span v-if="ex.sets">{{ ex.sets }} {{ $t('common.sets') }}</span>
                        <span v-if="ex.reps"> · {{ ex.reps }} {{ $t('common.reps') }}</span>
                        <span v-if="ex.weight"> · {{ ex.weight }} {{ $t('common.weight') }}</span>
                      </div>
                    </div>

                    <div v-if="ex.note" class="hint" style="margin:6px 0 0">{{ ex.note }}</div>

                    <div v-if="ex.setDetails && ex.setDetails.length" class="workout-sets">
                      <div v-for="(s, sidx) in ex.setDetails" :key="sidx" class="workout-set">
                        {{ formatSetLine(s, sidx) }}
                      </div>
                    </div>
                  </div>
                </div>

                <div class="workout-section-title" style="margin-top: 14px;">{{ $t('settings.coachChatTitle') }}</div>
                <div v-if="chatLoading" class="hint">{{ $t('common.loading') }}</div>
                <div v-else class="chat">
                  <div v-if="!chatMessages.length" class="hint">{{ $t('settings.coachChatEmpty') }}</div>
                  <div v-else class="chat-list">
                    <div v-for="m in chatMessages" :key="m.id || (m.createdAt + m.text)" class="chat-msg" :class="m.sender === 'coach' ? 'from-coach' : 'from-client'">
                      <div class="chat-meta">
                        <span class="chat-sender">{{ m.sender === 'coach' ? $t('settings.chatSenderCoach') : $t('settings.chatSenderClient') }}</span>
                        <span class="chat-time">{{ m.createdAt ? new Date(m.createdAt).toLocaleString() : '' }}</span>
                      </div>
                      <div class="chat-text">{{ m.text }}</div>
                    </div>
                  </div>

                  <div class="chat-compose">
                    <textarea
                      class="text-input"
                      rows="3"
                      v-model="chatDraft"
                      :placeholder="$t('settings.coachChatPlaceholder')"
                    />
                    <button class="save-btn" type="button" :disabled="chatSending || !chatDraft.trim()" @click="sendChatMessage">
                      {{ chatSending ? $t('common.saving') : $t('settings.sendMessage') }}
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Bestätigungs-Dialog -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="!isDeleting && (showDeleteConfirm = false)">
      <div class="modal-content danger-modal">
        <div class="modal-header">
          <h3>⚠️ {{ $t('settings.confirmDelete') }}</h3>
          <button v-if="!isDeleting" class="close-btn" @click="showDeleteConfirm = false">×</button>
        </div>
        
        <div class="modal-body">
          <p class="warning-text">{{ $t('settings.confirmDeleteMsg') }}</p>
          
          <div class="warning-list">
            <div class="warning-item">
              <span class="warning-icon">🗄️</span>
              <span>{{ $t('settings.deleteWarning1') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">📊</span>
              <span>{{ $t('settings.deleteWarning2') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">⚙️</span>
              <span>{{ $t('settings.deleteWarning3') }}</span>
            </div>
          </div>
          
          <div class="confirm-input">
            <label>{{ $t('settings.typeToConfirm') }}</label>
            <input 
              v-model="confirmText" 
              type="text" 
              :placeholder="$t('settings.deletePlaceholder')"
              :disabled="isDeleting"
              @keyup.enter="confirmDelete"
              autocomplete="off"
            />
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteConfirm = false" :disabled="isDeleting">
            {{ $t('common.cancel') }}
          </button>
          <button 
            class="confirm-danger-btn" 
            :disabled="confirmText.toLowerCase() !== $t('settings.deletePlaceholder').toLowerCase() || isDeleting"
            @click="confirmDelete"
          >
            <span v-if="isDeleting" class="spinner" aria-hidden="true"></span>
            <span v-else>🗑️</span>
            {{ isDeleting ? $t('settings.deleting') : $t('settings.deleteForever') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Account-Lösch-Dialog -->
    <div v-if="showDeleteAccountConfirm" class="modal-overlay" @click.self="!isDeletingAccount && (showDeleteAccountConfirm = false)">
      <div class="modal-content danger-modal">
        <div class="modal-header">
          <h3>⚠️ {{ $t('settings.confirmDeleteAccount') }}</h3>
          <button v-if="!isDeletingAccount" class="close-btn" @click="showDeleteAccountConfirm = false">×</button>
        </div>
        
        <div class="modal-body">
          <p class="warning-text">{{ $t('settings.confirmDeleteAccountMsg') }}</p>
          
          <div class="warning-list">
            <div class="warning-item">
              <span class="warning-icon">🗄️</span>
              <span>{{ $t('settings.deleteAccountWarning1') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">📊</span>
              <span>{{ $t('settings.deleteAccountWarning2') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">⚙️</span>
              <span>{{ $t('settings.deleteAccountWarning3') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">🚫</span>
              <span>{{ $t('settings.deleteAccountWarning4') }}</span>
            </div>
          </div>
          
          <div class="confirm-input">
            <label>{{ $t('settings.typeToConfirmAccount') }}</label>
            <input 
              v-model="confirmAccountText" 
              type="text" 
              :placeholder="$t('settings.deleteAccountPlaceholder')"
              :disabled="isDeletingAccount"
              @keyup.enter="confirmDeleteAccount"
              autocomplete="off"
            />
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteAccountConfirm = false" :disabled="isDeletingAccount">
            {{ $t('common.cancel') }}
          </button>
          <button 
            class="confirm-danger-btn" 
            :disabled="confirmAccountText.toLowerCase() !== $t('settings.deleteAccountPlaceholder').toLowerCase() || isDeletingAccount"
            @click="confirmDeleteAccount"
          >
            <span v-if="isDeletingAccount">🔄</span>
            <span v-else>🗑️</span>
            {{ isDeletingAccount ? $t('settings.deletingAccount') : $t('settings.deleteAccountForever') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Avatar Crop/Compress -->
    <Transition name="modal" appear>
      <div v-if="showAvatarCropModal" class="modal-overlay" @click.self="!cropProcessing && cancelAvatarCrop()">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ $t('settings.profilePictureCropTitle') }}</h3>
            <button class="close-btn" :disabled="cropProcessing" @click="cancelAvatarCrop" aria-label="Schließen">×</button>
          </div>
          <div class="modal-body">
            <p class="hint" style="margin-top:0">{{ $t('settings.profilePictureCropHint') }}</p>
            <div ref="cropBoxRef" class="avatar-crop-box" @pointerdown="onCropPointerDown">
              <img
                v-if="avatarCropUrl"
                class="avatar-crop-img"
                :src="avatarCropUrl"
                :style="cropImgStyle"
                alt=""
                draggable="false"
              />
            </div>

            <div class="avatar-crop-controls">
              <label class="crop-label">
                <span>{{ $t('settings.profilePictureCropZoom') }}</span>
                <input type="range" min="1" max="3" step="0.01" v-model.number="cropZoom" :disabled="cropProcessing" />
              </label>
            </div>

            <div class="modal-actions" style="margin-top: 16px;">
              <button class="cancel-btn" type="button" :disabled="cropProcessing" @click="cancelAvatarCrop">
                {{ $t('common.cancel') }}
              </button>
              <button class="save-btn" type="button" :disabled="cropProcessing" @click="applyAvatarCrop">
                {{ cropProcessing ? $t('common.loading') : $t('common.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import HeaderBar from '../components/HeaderBar.vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/themeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUserStore } from '@/stores/userStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'
import { computed, ref, onBeforeUnmount, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { initFirebaseAuth, useFirebaseAuth } from '@/utils/firebaseAuth'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { logger } from '@/utils/logger'
import { deleteAllWorkouts } from '@/api/workouts'
import { isOnline, db } from '@/utils/offlineStorage'
import {
  createCoachInvite,
  listOutgoingCoachInvites,
  listIncomingCoachInvites,
  acceptCoachInvite,
  cancelCoachInvite,
  revokeCoachAccess,
  listActiveCoaches,
  listCoachClients,
  fetchClientWorkouts,
  fetchClientWorkoutDetail,
  listCoachWorkoutChat,
  sendCoachWorkoutChatMessage,
  uploadProfileAvatar
} from '@/api/account'

const themeStore = useThemeStore()
const { theme, colorMode } = storeToRefs(themeStore)
const set = (t) => themeStore.setTheme(t)
const setColorMode = (mode) => themeStore.setColorMode(mode)
const colorModeOptions = computed(() => ([
  { value: 'lime', label: $t('settings.colorModeLime') },
  { value: 'ocean', label: $t('settings.colorModeOcean') },
  { value: 'violet', label: $t('settings.colorModeViolet') },
  { value: 'sunset', label: $t('settings.colorModeSunset') }
]))

// Wochenziel
const settings = useSettingsStore()
const { weeklyGoal } = storeToRefs(settings)
const usernameDraft = ref(settings.username || '')
const usernameSaving = ref(false)

// Avatar/Profile picture
const AVATAR_MAX_BYTES = 12 * 1024 * 1024
// Input kann auch HEIC/HEIF sein (iOS) – wir konvertieren clientseitig zu JPEG bevor wir hochladen.
const AVATAR_ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const avatarFileInput = ref(null)
const avatarFile = ref(null)
const avatarPreviewUrl = ref('')
const avatarUploading = ref(false)

const isNativePlatform = computed(() => {
  try {
    return typeof Capacitor?.isNativePlatform === 'function'
      ? Capacitor.isNativePlatform()
      : (Capacitor?.getPlatform?.() && Capacitor.getPlatform() !== 'web')
  } catch {
    return false
  }
})

// Crop/Compress modal state
const showAvatarCropModal = ref(false)
const avatarSourceFile = ref(null)
const avatarCropUrl = ref('')
const cropBoxRef = ref(null)
const cropZoom = ref(1)
const cropOffsetX = ref(0)
const cropOffsetY = ref(0)
const cropBaseScale = ref(1)
const cropImgW = ref(0)
const cropImgH = ref(0)
const cropProcessing = ref(false)
let cropBitmap = null
let cropDragging = false
let cropDragStart = null

let cropImageEl = null

const CROP_OUTPUT_SIZE = 512
const CROP_JPEG_QUALITY = 0.86

const settingsAvatarUrl = computed(() => settings.avatarUrl || '')
const settingsAvatarData = computed(() => settings.avatarData || '')

const cropImgStyle = computed(() => {
  const scale = (cropBaseScale.value || 1) * (Number(cropZoom.value) || 1)
  const tx = Number(cropOffsetX.value) || 0
  const ty = Number(cropOffsetY.value) || 0
  return {
    transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`
  }
})

function getCropBoxSize() {
  const el = cropBoxRef.value
  const size = el?.clientWidth || el?.clientHeight
  return Number.isFinite(size) && size > 0 ? size : 260
}

function revokeObjectUrl(urlRef) {
  try {
    const u = String(urlRef?.value || '')
    if (u) URL.revokeObjectURL(u)
  } catch {}
  if (urlRef) urlRef.value = ''
}

function cleanupCropResources() {
  revokeObjectUrl(avatarCropUrl)
  avatarSourceFile.value = null
  cropImgW.value = 0
  cropImgH.value = 0
  cropBaseScale.value = 1
  cropZoom.value = 1
  cropOffsetX.value = 0
  cropOffsetY.value = 0
  try {
    if (cropBitmap && typeof cropBitmap.close === 'function') cropBitmap.close()
  } catch {}
  cropBitmap = null
  cropImageEl = null
}

async function loadImageForCrop(url) {
  const u = String(url || '').trim()
  if (!u) throw new Error('Missing image url')

  const img = new Image()
  img.decoding = 'async'
  img.src = u

  // Prefer decode() when available, but still fallback to load events.
  if (typeof img.decode === 'function') {
    try {
      await img.decode()
    } catch {
      // ignore; onload/onerror will decide
    }
  }

  await new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) return resolve()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image load failed'))
  })

  return img
}

async function pickAvatarFromPhotos() {
  try {
    const permissionOk = await ensurePhotoPermission()
    if (!permissionOk) {
      toast.show($t('settings.profilePicturePickFailed'), { type: 'error', duration: 2400 })
      return
    }
    // CameraResultType.DataUrl: Capacitor konvertiert HEIC/HDR automatisch zu JPEG.
    // So ist das Bild Canvas-kompatibel und kann gecropped + gecacht werden.
    const photo = await Camera.getPhoto({
      source: CameraSource.Photos,
      resultType: CameraResultType.DataUrl,
      quality: 88,
      allowEditing: false
    })

    const dataUrl = String(photo?.dataUrl || '')
    if (!dataUrl.startsWith('data:')) throw new Error('No photo data')

    // DataURL → Blob → File für das Crop-Modal
    const resp = await fetch(dataUrl)
    const blob = await resp.blob()
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })

    // Crop-Modal öffnen – gleicher Pfad wie Desktop-Upload
    await openAvatarCrop(file)
    // applyAvatarCrop() löst den Upload aus (isNativePlatform-Guard)
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg && /cancel|canceled|cancelled/i.test(msg)) return
    toast.show($t('settings.profilePicturePickFailed'), { type: 'error', duration: 2400 })
  }
}

async function ensurePhotoPermission() {
  try {
    const status = await Camera.checkPermissions()
    const current = status?.photos || status?.camera
    if (current === 'granted' || current === 'limited') return true
    const requested = await Camera.requestPermissions({ permissions: ['photos'] })
    const next = requested?.photos || requested?.camera
    return next === 'granted' || next === 'limited'
  } catch (e) {
    logger.warn('[SettingsView] photo permission check failed:', e?.message || e)
    return false
  }
}

function clampCropOffsets() {
  const box = getCropBoxSize()
  const w = cropImgW.value
  const h = cropImgH.value
  const scale = (cropBaseScale.value || 1) * (Number(cropZoom.value) || 1)
  if (!w || !h || !box || !scale) return

  const drawW = w * scale
  const drawH = h * scale
  const maxX = Math.max(0, (drawW - box) / 2)
  const maxY = Math.max(0, (drawH - box) / 2)
  const x = Number(cropOffsetX.value) || 0
  const y = Number(cropOffsetY.value) || 0
  cropOffsetX.value = Math.max(-maxX, Math.min(maxX, x))
  cropOffsetY.value = Math.max(-maxY, Math.min(maxY, y))
}

watch(cropZoom, () => {
  clampCropOffsets()
})

async function openAvatarCrop(file) {
  cleanupCropResources()
  avatarSourceFile.value = file
  try {
    avatarCropUrl.value = URL.createObjectURL(file)
  } catch {
    avatarCropUrl.value = ''
  }
  showAvatarCropModal.value = true
  cropProcessing.value = true

  try {
    await nextTick()
    // Use <img> decoding for best HEIC/HEIF compatibility on iOS.
    const img = await loadImageForCrop(avatarCropUrl.value)
    cropImageEl = img
    cropImgW.value = img?.naturalWidth || img?.width || 0
    cropImgH.value = img?.naturalHeight || img?.height || 0

    const box = getCropBoxSize()
    if (cropImgW.value && cropImgH.value && box) {
      cropBaseScale.value = Math.max(box / cropImgW.value, box / cropImgH.value)
    } else {
      cropBaseScale.value = 1
    }
    cropZoom.value = 1
    cropOffsetX.value = 0
    cropOffsetY.value = 0
    clampCropOffsets()
  } catch (e) {
    logger.warn('[SettingsView] Avatar crop init failed:', e?.message || e)
    toast.show($t('settings.profilePictureDecodeFailed'), { type: 'error', duration: 3200 })
    cancelAvatarCrop()
  } finally {
    cropProcessing.value = false
  }
}

function cancelAvatarCrop() {
  showAvatarCropModal.value = false
  cleanupCropResources()
  avatarFile.value = null
  clearAvatarPreview()
  try {
    if (avatarFileInput.value) avatarFileInput.value.value = ''
  } catch {}
}

async function applyAvatarCrop() {
  if (cropProcessing.value) return
  if (!avatarSourceFile.value) return
  cropProcessing.value = true
  try {
    const box = getCropBoxSize()
    const out = CROP_OUTPUT_SIZE
    const scalePreview = (cropBaseScale.value || 1) * (Number(cropZoom.value) || 1)
    const scaleOut = scalePreview * (out / box)
    const offsetOutX = (Number(cropOffsetX.value) || 0) * (out / box)
    const offsetOutY = (Number(cropOffsetY.value) || 0) * (out / box)

    let img = cropImageEl
    if (!img) {
      img = await loadImageForCrop(avatarCropUrl.value)
    }

    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out, out)

    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const drawW = w * scaleOut
    const drawH = h * scaleOut
    const x = out / 2 - drawW / 2 + offsetOutX
    const y = out / 2 - drawH / 2 + offsetOutY
    ctx.drawImage(img, x, y, drawW, drawH)

    // DataURL direkt vom Canvas: Canvas-JPEG ist garantiert decodierbar + cachebar.
    const cropDataUrl = canvas.toDataURL('image/jpeg', CROP_JPEG_QUALITY)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        CROP_JPEG_QUALITY
      )
    })

    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    avatarFile.value = file

    // DataURL als persistenter Cache speichern (übersteht Navigation, funktioniert offline)
    settings.setAvatarData(cropDataUrl)

    // Preview direkt via DataURL setzen – kein Blob-URL nötig, kein ATS-Problem
    clearAvatarPreview()
    avatarPreviewUrl.value = cropDataUrl

    showAvatarCropModal.value = false
    cleanupCropResources()

    // Auf nativer Plattform: automatisch hochladen (kein manueller Upload-Button sichtbar)
    if (isNativePlatform.value) {
      void uploadAvatar()
    }
  } catch (e) {
    logger.warn('[SettingsView] applyAvatarCrop failed:', e?.message || e)
    toast.show(e?.message || $t('common.error'), { type: 'error', duration: 2200 })
  } finally {
    cropProcessing.value = false
  }
}

function onCropPointerDown(e) {
  if (!showAvatarCropModal.value) return
  if (cropProcessing.value) return
  cropDragging = true
  cropDragStart = {
    x: e.clientX,
    y: e.clientY,
    ox: Number(cropOffsetX.value) || 0,
    oy: Number(cropOffsetY.value) || 0
  }
  try { e.preventDefault() } catch {}
  window.addEventListener('pointermove', onCropPointerMove)
  window.addEventListener('pointerup', onCropPointerUp, { once: true })
}

function onCropPointerMove(e) {
  if (!cropDragging || !cropDragStart) return
  const dx = e.clientX - cropDragStart.x
  const dy = e.clientY - cropDragStart.y
  cropOffsetX.value = cropDragStart.ox + dx
  cropOffsetY.value = cropDragStart.oy + dy
  clampCropOffsets()
}

function onCropPointerUp() {
  cropDragging = false
  cropDragStart = null
  window.removeEventListener('pointermove', onCropPointerMove)
}

function clearAvatarPreview() {
  try {
    if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
  } catch {}
  avatarPreviewUrl.value = ''
}

function onAvatarFileChange(e) {
  const f = e?.target?.files?.[0]
  avatarFile.value = null
  clearAvatarPreview()
  if (!f) return

  if (!AVATAR_ALLOWED.has(String(f.type || '').toLowerCase())) {
    toast.show($t('settings.profilePictureInvalidType'), { type: 'info', duration: 2400 })
    try { e.target.value = '' } catch {}
    return
  }

  if (f.size > AVATAR_MAX_BYTES) {
    toast.show($t('settings.profilePictureTooLarge'), { type: 'info', duration: 2400 })
    try { e.target.value = '' } catch {}
    return
  }

  // Öffne Crop/Kompression vor dem Upload
  void openAvatarCrop(f)
}

onBeforeUnmount(() => {
  clearAvatarPreview()
  cleanupCropResources()
  window.removeEventListener('pointermove', onCropPointerMove)
})

async function uploadAvatar() {
  if (avatarUploading.value) return
  if (!avatarFile.value) return
  avatarUploading.value = true
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    const fileToCache = avatarFile.value
    const res = await uploadProfileAvatar(token, fileToCache)
    const url = String(res?.avatarUrl || '').trim()
    if (url) settings.setAvatarUrl(url)
    // DataURL-Cache für Persistenz
    if (fileToCache) {
      blobToThumbnailDataUrl(fileToCache).then((dataUrl) => {
        if (dataUrl) settings.setAvatarData(dataUrl)
      }).catch(() => {})
    }
    toast.show($t('common.updated'), { type: 'success', duration: 1400 })
    avatarFile.value = null
    try {
      if (avatarFileInput.value) avatarFileInput.value.value = ''
    } catch {}
    // Preview NICHT löschen – avatarPreviewUrl (DataURL) bleibt bis zur Navigation
    // sichtbar; settingsAvatarData ist bereits gecacht.
    // Keep username/coach list etc stable, but refresh profile in background
    void settings.loadProfile(token).catch(() => null)
  } catch (e) {
    toast.show(e?.message || $t('common.error'), { type: 'error', duration: 2200 })
  } finally {
    avatarUploading.value = false
  }
}
function setGoal(v) { settings.setWeeklyGoal(v) }
function onInput(e) { setGoal(e.target.value) }
function onRange(e) { setGoal(e.target.value) }
function inc() { setGoal((weeklyGoal.value || 4) + 1) }
function dec() { setGoal((weeklyGoal.value || 4) - 1) }

// Sprache
const { locale, t: $t } = useI18n()
const lang = computed(() => locale.value)
function setLang(l) {
  locale.value = l
  settings.setLanguage(l)
}

// Subscription testing helpers
const subscriptionStore = useSubscriptionStore()
const { subscription, devPlanOverride } = storeToRefs(subscriptionStore)
const devPlanOptions = ['free', 'pro', 'elite']
const planLabels = {
  free: 'Free',
  pro: 'Pro',
  elite: 'Elite'
}

const router = useRouter()
const toast = useToastStore()
const userStore = useUserStore()
const authStore = useAuthStore()
const { uid: authUid } = storeToRefs(authStore)

const readDevToolsFlag = () => {
  try {
    return localStorage.getItem('enableDevTools') === 'true'
  } catch {
    return false
  }
}

const devToolsUnlocked = ref(readDevToolsFlag())
const devTapCount = ref(0)
const DEV_UNLOCK_TAPS = 5
const tapsRemaining = computed(() => Math.max(0, DEV_UNLOCK_TAPS - devTapCount.value))
let devTapTimer = null

const persistDevFlag = (state) => {
  try {
    if (state) {
      localStorage.setItem('enableDevTools', 'true')
    } else {
      localStorage.removeItem('enableDevTools')
    }
  } catch {}
}

const enableDevTools = () => {
  if (devToolsUnlocked.value) return
  devToolsUnlocked.value = true
  persistDevFlag(true)
  devTapCount.value = 0
  toast.show('Developer tools unlocked for this device', { type: 'success', duration: 2500 })
}

const disableDevTools = () => {
  if (!devToolsUnlocked.value) return
  devToolsUnlocked.value = false
  persistDevFlag(false)
  devTapCount.value = 0
  toast.show('Developer tools hidden', { type: 'info', duration: 2000 })
}

const handleDevUnlockTap = () => {
  if (devToolsUnlocked.value || import.meta.env.DEV) return
  devTapCount.value += 1
  if (devTapTimer) {
    clearTimeout(devTapTimer)
  }
  devTapTimer = setTimeout(() => {
    devTapCount.value = 0
  }, 1500)
  if (devTapCount.value >= DEV_UNLOCK_TAPS) {
    devTapCount.value = 0
    enableDevTools()
  }
}

onBeforeUnmount(() => {
  if (devTapTimer) {
    clearTimeout(devTapTimer)
  }
})

const isDevelopment = computed(() => import.meta.env.DEV || devToolsUnlocked.value)

// Navigation to features test
const goToFeatureTest = () => {
  router.push('/features-test')
}

// Auth Helpers
async function getIdTokenSafe() {
  try {
    await initFirebaseAuth()
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken().catch(() => null)
  } catch (e) {
    logger.warn('[SettingsView] getIdTokenSafe failed:', e?.message || e)
    return null
  }
}
const showDeleteConfirm = ref(false)
const confirmText = ref('')
const isDeleting = ref(false)

// Coach feature UI state
const coachEmail = ref('')
const coachConsentChecked = ref(false)
const inviteSending = ref(false)
const invitesLoading = ref(false)
const outgoingInvites = ref([])
const inviteCancelingId = ref('')

const incomingLoading = ref(false)
const incomingInvites = ref([])
const incomingInvitesLoadedOnce = ref(false)
const inviteAcceptingId = ref('')

const activeCoachesLoading = ref(false)
const activeCoaches = ref([])
const coachRevokingUid = ref('')

const coachClients = ref([])
const clientsLoading = ref(false)
const clientsError = ref('')
const selectedClient = ref(null)
const selectedClientWorkouts = ref([])
const clientWorkoutsLoading = ref(false)
const showClientModal = ref(false)

const selectedWorkoutId = ref('')
const selectedWorkoutDetail = ref(null)
const workoutDetailLoading = ref(false)

const chatMessages = ref([])
const chatLoading = ref(false)
const chatSending = ref(false)
const chatDraft = ref('')

function formatWorkoutDate(workout) {
  try {
    const raw = workout?.date || workout?.createdAt || workout?.updatedAt
    if (!raw) return ''
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString()
  } catch {
    return ''
  }
}

const COACH_CONSENT_VERSION = '2026-01-28.v1'

async function sendCoachInvite() {
  if (inviteSending.value) return
  inviteSending.value = true
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    await createCoachInvite(token, {
      coachEmail: coachEmail.value,
      consentTextVersion: COACH_CONSENT_VERSION,
      consentLocale: lang.value
    })
    toast.show($t('settings.inviteSent'), { type: 'success', duration: 1800 })
    coachEmail.value = ''
    coachConsentChecked.value = false
    await loadMyInvites()
  } catch (e) {
    if (e?.statusCode === 404) {
      clientsError.value = $t('settings.coachInviteCoachNotFound')
      toast.show(clientsError.value, { type: 'info', duration: 2600 })
    } else {
      clientsError.value = e?.message || String(e)
      toast.show($t('common.error'), { type: 'error', duration: 2000 })
    }
  } finally {
    inviteSending.value = false
  }
}

async function loadMyInvites(options = {}) {
  if (invitesLoading.value) return
  invitesLoading.value = true
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      if (!options.silent) toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    outgoingInvites.value = await listOutgoingCoachInvites(token)
  } catch (e) {
    clientsError.value = e?.message || String(e)
    if (!options.silent) toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    invitesLoading.value = false
  }
}

async function cancelInvite(inviteId) {
  if (inviteCancelingId.value) return
  inviteCancelingId.value = inviteId
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    await cancelCoachInvite(token, inviteId)
    toast.show($t('settings.inviteCanceled'), { type: 'success', duration: 1600 })
    await loadMyInvites()
  } catch (e) {
    clientsError.value = e?.message || String(e)
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    inviteCancelingId.value = ''
  }
}

async function loadIncomingInvites(options = {}) {
  if (incomingLoading.value) return
  incomingLoading.value = true
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      if (!options.silent) toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    incomingInvites.value = await listIncomingCoachInvites(token)
    incomingInvitesLoadedOnce.value = true
    if (!incomingInvites.value.length && !options.silent) {
      toast.show($t('settings.noIncomingInvites'), { type: 'info', duration: 1800 })
    }
  } catch (e) {
    clientsError.value = e?.message || String(e)
    incomingInvitesLoadedOnce.value = true
    if (!options.silent) toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    incomingLoading.value = false
  }
}

async function acceptInvite(inviteId) {
  if (inviteAcceptingId.value) return
  inviteAcceptingId.value = inviteId
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    await acceptCoachInvite(token, inviteId)
    toast.show($t('settings.inviteAccepted'), { type: 'success', duration: 1600 })
    await loadIncomingInvites()
    await loadMyClients()
  } catch (e) {
    clientsError.value = e?.message || String(e)
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    inviteAcceptingId.value = ''
  }
}

async function loadActiveCoaches(options = {}) {
  if (activeCoachesLoading.value) return
  activeCoachesLoading.value = true
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      if (!options.silent) toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    activeCoaches.value = await listActiveCoaches(token)
    if (!activeCoaches.value.length && !options.silent) {
      toast.show($t('settings.noActiveCoaches'), { type: 'info', duration: 1800 })
    }
  } catch (e) {
    clientsError.value = e?.message || String(e)
    if (!options.silent) toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    activeCoachesLoading.value = false
  }
}

async function revokeCoach(coachUid) {
  if (coachRevokingUid.value) return
  coachRevokingUid.value = coachUid
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    await revokeCoachAccess(token, { coachUid })
    toast.show($t('settings.coachRemoved'), { type: 'success', duration: 1600 })
    await loadActiveCoaches()
  } catch (e) {
    clientsError.value = e?.message || String(e)
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    coachRevokingUid.value = ''
  }
}

async function loadMyClients() {
  if (clientsLoading.value) return
  clientsLoading.value = true
  clientsError.value = ''
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    coachClients.value = await listCoachClients(token)
    if (!coachClients.value.length) {
      toast.show($t('settings.noClients'), { type: 'info', duration: 1800 })
    }
  } catch (e) {
    clientsError.value = e?.message || String(e)
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    clientsLoading.value = false
  }
}

async function openClientWorkouts(client) {
  selectedClient.value = client
  selectedClientWorkouts.value = []
  selectedWorkoutId.value = ''
  selectedWorkoutDetail.value = null
  chatMessages.value = []
  chatDraft.value = ''
  showClientModal.value = true
  clientWorkoutsLoading.value = true
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    selectedClientWorkouts.value = await fetchClientWorkouts(token, client.uid)
  } catch (e) {
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    clientWorkoutsLoading.value = false
  }
}

function backToClientWorkouts() {
  selectedWorkoutId.value = ''
  selectedWorkoutDetail.value = null
  workoutDetailLoading.value = false
  chatMessages.value = []
  chatDraft.value = ''
  chatLoading.value = false
  chatSending.value = false
}

function formatSetLine(set, idx) {
  const reps = set?.reps
  const weight = set?.weight
  const note = set?.notes
  const left = `#${idx + 1}`
  const mid = [
    Number.isFinite(reps) ? `${reps} ${$t('common.reps')}` : null,
    Number.isFinite(weight) ? `${weight} ${$t('common.weight')}` : null
  ].filter(Boolean).join(' · ')
  const suffix = note ? ` — ${note}` : ''
  return `${left}: ${mid || ''}${suffix}`.trim()
}

async function openWorkoutDetail(workout) {
  if (!selectedClient.value) return
  const workoutId = workout?._id || workout?.id
  if (!workoutId) return

  selectedWorkoutId.value = String(workoutId)
  selectedWorkoutDetail.value = null
  workoutDetailLoading.value = true
  chatMessages.value = []
  chatDraft.value = ''
  chatLoading.value = true
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }

    const [detail, msgs] = await Promise.all([
      fetchClientWorkoutDetail(token, selectedClient.value.uid, workoutId),
      listCoachWorkoutChat(token, selectedClient.value.uid, workoutId, 200)
    ])

    selectedWorkoutDetail.value = detail
    chatMessages.value = Array.isArray(msgs) ? msgs : []
  } catch (e) {
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    workoutDetailLoading.value = false
    chatLoading.value = false
  }
}

async function sendChatMessage() {
  if (chatSending.value) return
  if (!selectedClient.value || !selectedWorkoutId.value) return
  const text = String(chatDraft.value || '').trim()
  if (!text) return

  chatSending.value = true
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    const msg = await sendCoachWorkoutChatMessage(token, selectedClient.value.uid, selectedWorkoutId.value, text)
    chatDraft.value = ''
    chatMessages.value = [...(chatMessages.value || []), msg]
  } catch (e) {
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    chatSending.value = false
  }
}

function closeClientModal() {
  showClientModal.value = false
  selectedClient.value = null
  selectedClientWorkouts.value = []
  backToClientWorkouts()
}

function resetCoachState() {
  coachEmail.value = ''
  coachConsentChecked.value = false
  inviteSending.value = false
  invitesLoading.value = false
  outgoingInvites.value = []
  inviteCancelingId.value = ''

  incomingLoading.value = false
  incomingInvites.value = []
  incomingInvitesLoadedOnce.value = false
  inviteAcceptingId.value = ''

  activeCoachesLoading.value = false
  activeCoaches.value = []
  coachRevokingUid.value = ''

  coachClients.value = []
  clientsLoading.value = false
  clientsError.value = ''
  closeClientModal()
}

// Diagnose für den "Daten werden bei App-Resume zurückgesetzt"-Bug: sammelt den
// laufenden Lifecycle-Log aus WorkoutDetailView.vue (logDiagnostic(), Key
// bro_split_load_diagnostics_v1 - letzte 40 Events: load-start, autosave, lifecycle-
// persist, app-state-change, active-draft-id-migrated, ...) zusammen mit dem aktuellen
// Active-Draft und dem Route-Resume-Snapshot, damit man nach einem Reproduce sofort
// sieht, WAS beim Zurückkehren tatsächlich passiert ist (Remount? Cold Start? Draft-
// Lookup verfehlt?), statt weiter zu raten.
async function copyDraftDebugLog() {
  try {
    const diagnostics = JSON.parse(localStorage.getItem('bro_split_load_diagnostics_v1') || '[]')
    const resumeSnapshot = JSON.parse(localStorage.getItem('app_resume_state_v1') || 'null')
    const activeDraftKeys = Object.keys(localStorage).filter((k) => k.startsWith('active_workout_'))
    const activeDrafts = Object.fromEntries(
      activeDraftKeys.map((k) => {
        try { return [k, JSON.parse(localStorage.getItem(k))] } catch { return [k, null] }
      })
    )
    const payload = {
      generatedAt: new Date().toISOString(),
      diagnostics,
      resumeSnapshot,
      activeDrafts
    }
    const text = JSON.stringify(payload, null, 2)
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      toast.show(`Debug-Log kopiert (${diagnostics.length} Events)`, { type: 'success', duration: 1800 })
    } else {
      logger.debug('[SettingsView] Draft-Debug-Log:', text)
      toast.show('Clipboard nicht verfügbar, siehe Konsole', { type: 'info', duration: 1800 })
    }
  } catch (e) {
    toast.show('Debug-Log konnte nicht erstellt werden', { type: 'error', duration: 1600 })
  }
}

// Leert den rollierenden Diagnose-Puffer VOR einem gezielten Reproduktionsversuch, damit das
// danach kopierte Log garantiert nur den einen aktuellen Testlauf enthält, statt bis zu 100
// Events aus mehreren, teils Stunden auseinanderliegenden Sessions zu vermischen (das hat
// beim letzten Mal zu einer Fehlanalyse anhand veralteter Log-Einträge geführt).
function clearDraftDebugLog() {
  try {
    localStorage.removeItem('bro_split_load_diagnostics_v1')
    toast.show('Debug-Log geleert', { type: 'success', duration: 1400 })
  } catch (e) {
    toast.show('Log konnte nicht geleert werden', { type: 'error', duration: 1600 })
  }
}

async function copyIdToken() {
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show('Kein Token (nicht eingeloggt)', { type: 'info', duration: 1600 })
      return
    }
    if (!navigator?.clipboard?.writeText) {
      toast.show('Clipboard nicht verfügbar', { type: 'info', duration: 1600 })
      return
    }
    await navigator.clipboard.writeText(token)
    toast.show('Token kopiert', { type: 'success', duration: 1400 })
  } catch (e) {
    toast.show('Kopieren fehlgeschlagen', { type: 'error', duration: 1600 })
  }
}

async function loadProfileIntoForm() {
  try {
    const token = await getIdTokenSafe()
    if (!token) return
    await settings.loadProfile(token)
    usernameDraft.value = settings.username || ''
  } catch (e) {
    logger.warn('[SettingsView] loadProfileIntoForm failed:', e?.message || e)
  }
}

async function saveUsername() {
  if (usernameSaving.value) return
  usernameSaving.value = true
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    await settings.saveUsername(token, usernameDraft.value)
    usernameDraft.value = settings.username || ''
    toast.show($t('common.updated'), { type: 'success', duration: 1500 })
  } catch (e) {
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    usernameSaving.value = false
  }
}

onMounted(() => {
  // best-effort: Profile laden (damit Username mit dem User verknüpft ist)
  void loadProfileIntoForm()

  // best-effort: Coach/Invite Status vorladen (ohne Toast-Spam)
  void loadMyInvites({ silent: true })
  void loadActiveCoaches({ silent: true })
  void loadIncomingInvites({ silent: true })

  // Background refresh: eingehende Einladungen periodisch prüfen (Badge aktualisieren)
  incomingInvitesPollId = window.setInterval(() => {
    void loadIncomingInvites({ silent: true })
  }, 30000)

  onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void loadIncomingInvites({ silent: true })
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
})

// Wichtig: Wenn User im selben App-Run wechselt, keine Coach-Daten „leaken“.
watch(
  () => authUid.value,
  (next, prev) => {
    if (next === prev) return
    resetCoachState()
    if (next) {
      void loadMyInvites({ silent: true })
      void loadActiveCoaches({ silent: true })
      void loadIncomingInvites({ silent: true })
    }
  }
)

let incomingInvitesPollId = null
let onVisibilityChange = null

onBeforeUnmount(() => {
  if (incomingInvitesPollId) {
    window.clearInterval(incomingInvitesPollId)
    incomingInvitesPollId = null
  }
  if (onVisibilityChange) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    onVisibilityChange = null
  }
})

watch(
  () => settings.username,
  (val) => {
    // Wenn Username anderweitig geladen wurde, UI syncen
    if (!usernameSaving.value) {
      usernameDraft.value = val || ''
    }
  }
)

const forcePlan = (plan) => {
  subscriptionStore.setDevPlanOverride(plan)
  toast.show(`Local plan set to ${planLabels[plan]}`, { type: 'success', duration: 2000 })
}

const clearDevPlan = () => {
  subscriptionStore.clearDevPlanOverride()
  toast.show('Cleared local plan override', { type: 'info', duration: 2000 })
}

const showDeleteAccountConfirm = ref(false)
const confirmAccountText = ref('')
const isDeletingAccount = ref(false)

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms)
    })
  ])
}

async function confirmDelete() {
  logger.debug('🔴 confirmDelete aufgerufen!')
  logger.debug('Eingabe:', confirmText.value)
  logger.debug('Erwartet:', $t('settings.deletePlaceholder'))
  logger.debug('Vergleich:', confirmText.value.toLowerCase(), '===', $t('settings.deletePlaceholder').toLowerCase())

  if (confirmText.value.toLowerCase() !== $t('settings.deletePlaceholder').toLowerCase()) {
    logger.debug('❌ Validierung fehlgeschlagen - Funktion beendet')
    return
  }

  logger.debug('✅ Validierung erfolgreich - starte Löschung')

  if (isDeleting.value) {
    logger.debug('❌ Bereits am Löschen - Funktion beendet')
    return
  }
  isDeleting.value = true

  try {
    logger.debug('🔄 Starte Löschvorgang...')

    // 1. MongoDB: Alle Workouts des Users löschen (nur online)
    if (isOnline()) {
      try {
        logger.debug('🔑 Hole Auth-Token...')
        const token = await getIdTokenSafe()
        logger.debug('🔑 Token erhalten:', !!token, token ? `${token.substring(0,20)}...` : 'null')

        if (token) {
          logger.debug('🗑️ Lösche alle Workouts aus MongoDB...')
          const result = await withTimeout(deleteAllWorkouts(token), 6000, 'deleteAllWorkouts')
          logger.debug('✅ MongoDB-Workouts gelöscht:', result)
        } else {
          logger.warn('⚠️ Kein Auth-Token - MongoDB-Löschung übersprungen')
        }
      } catch (error) {
        // Fortfahren mit lokaler Löschung – Fehler hier ist unkritisch
        try {
          const msg = error?.message || JSON.stringify(error) || String(error)
          logger.warn('⚠️ MongoDB-Löschung nicht durchgeführt (fahre fort):', msg)
        } catch {
          logger.warn('⚠️ MongoDB-Löschung nicht durchgeführt (fahre fort)')
        }
      }
    } else {
      logger.warn('⚠️ Offline: MongoDB-Löschung übersprungen')
    }

    logger.debug('🧹 Lösche lokale Daten (gezielt, ohne Logout)...')

    // 2. Frontend Store: Alle Workouts aus dem Store löschen
    logger.debug('Store vor Löschung:', userStore.workouts.length, 'Workouts')
    userStore.$patch({ workouts: [], stats: null, workoutsLoaded: false, workoutsLoadedAt: 0 })
    logger.debug('Store nach Löschung:', userStore.workouts.length, 'Workouts')
    logger.debug('Store nach Löschung:', userStore.workouts.length, 'Workouts')
    
    // 3. LocalStorage: nur app-spezifische Daten löschen (ohne Auth/OAuth)
    try {
      logger.debug('🧹 Entferne App-Caches aus LocalStorage')
      const keys = Object.keys(localStorage)
      keys.forEach((key) => {
        if (
          key.startsWith('bro_split_') ||
          key.startsWith('wb_') ||
          key === 'exercise_media_cache_index_v2' ||
          key === 'app-lang' ||
          key === 'enableDevTools'
        ) {
          localStorage.removeItem(key)
        }
      })
    } catch {}

    // 4. SessionStorage: gezielt Drafts/temporäres löschen
    try {
      logger.debug('🧹 Entferne Drafts aus SessionStorage')
      const keys = Object.keys(sessionStorage)
      keys.forEach(k => { if (k.includes('workout_detail_draft')) sessionStorage.removeItem(k) })
    } catch {}

    // 5. IndexedDB: lokale Workouts und Caches leeren
    try {
      await db.workouts.clear()
      await db.exercises.clear()
      await db.syncQueue.clear()
      await db.metadata.clear()
      logger.debug('🧹 IndexedDB Workouts geleert')
    } catch (e) {
      logger.warn('⚠️ Konnte IndexedDB Workouts nicht leeren:', e?.message || e)
    }

    // 6. Filesystem Cache: Exercise Media Cache löschen
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await Filesystem.rmdir({ path: 'exercise-media-v2', directory: Directory.Cache, recursive: true })
      logger.debug('🧹 Exercise Media Cache gelöscht')
    } catch (e) {
      logger.warn('⚠️ Konnte Exercise Media Cache nicht löschen:', e?.message || e)
    }

    logger.debug('✅ Löschvorgang abgeschlossen')

    // 5. Dialog schließen
    showDeleteConfirm.value = false
    confirmText.value = ''

    // 6. Feedback geben
    toast.show($t('settings.deleteSuccess'), { type: 'success', duration: 3000 })

    // 7. Auf aktueller Route bleiben (kein Logout/Redirect)
    logger.debug('🏠 Bleibe auf Settings-View, kein Logout')

    // 8. Optional: Store refresh für sofortiges UI-Update
    logger.debug('🔄 Force refresh der Workout-Daten...')
    try {
      const token = await getIdTokenSafe()
      logger.debug('[Delete] token len', token?.length, token?.slice(0,20));
      await withTimeout(userStore.loadWorkouts(token, { force: true }), 6000, 'loadWorkouts')
      logger.debug('✅ Workouts neu geladen')
    } catch (e) {
      // Bei Fehler: Store bleibt leer – UI ist bereits bereinigt
      logger.warn('⚠️ Neu-Laden fehlgeschlagen, Store bleibt leer')
    }
  } catch (error) {
    logger.error('❌ Fehler beim Löschen der Daten:', error)
    logger.error('Fehler Details:', error.message, error.stack)
    toast.show($t('settings.deleteError'), { type: 'error' })

    // Trotzdem Dialog schließen
    showDeleteConfirm.value = false
    confirmText.value = ''
  } finally {
    isDeleting.value = false
    logger.debug('🏁 Löschvorgang beendet (finally)')
  }
}

async function confirmDeleteAccount() {
  if (confirmAccountText.value.toLowerCase() !== $t('settings.deleteAccountPlaceholder').toLowerCase()) {
    return
  }

  if (isDeletingAccount.value) return
  isDeletingAccount.value = true

  try {
    // 1. Firebase Auth initialisieren
    await initFirebaseAuth()
    const { deleteCurrentAccount, getIdToken } = useFirebaseAuth()

    // Hole wirklich das Token (nicht die Funktions-Referenz) und logge Länge + Prefix
    const token = await getIdToken().catch(() => null)
    logger.debug('[Debug] ID token len', token?.length, token?.slice(0, 20))

    // Debug: aktuelles ID Token anzeigen
    const debugToken = await getIdToken().catch(() => null)
    logger.debug('[SettingsView] Delete account token:', debugToken)

    // 2. Backend-Daten-Purge vor Account-Löschung
    try {
      const token = await getIdToken()
      if (token) {
        const purgeRes = await fetch('/api/account/purge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        const purgeJson = await purgeRes.json().catch(() => ({}))
        logger.debug('🧹 Account Purge:', purgeRes.status, purgeJson)
      } else {
        logger.warn('⚠️ Kein Token verfügbar – Purge übersprungen')
      }
    } catch (e) {
      logger.warn('⚠️ Account Purge fehlgeschlagen, fahre fort')
    }

    // 3. Firebase-Account löschen
    await deleteCurrentAccount(confirmAccountText.value)

    // 4. Frontend Cleanup
    localStorage.clear()
    sessionStorage.clear()
    toast.show($t('settings.deleteAccountSuccess'), { type: 'success', duration: 3000 })

    // 5. Nach Löschen zur Welcome-Seite navigieren
    setTimeout(() => {
      router.push({ name: 'welcome' })
    }, 100)

  } catch (error) {
    logger.error('Account deletion failed:', error)
    toast.show($t('settings.deleteAccountError'), { type: 'error' })
  } finally {
    isDeletingAccount.value = false
    showDeleteAccountConfirm.value = false
    confirmAccountText.value = ''
  }
}


// Toast-Settings entfernt – Toaster ist fest oben
</script>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.settings-content {
  padding: 20px;
  padding-bottom: 90px; /* Platz für BottomNav */
  max-width: 920px;
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.section-title {
  margin: 14px 2px 0;
  font-size: 0.85rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--fg) 86%, var(--muted));
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px;
}

.spinner {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--fg) 20%, transparent);
  border-top-color: var(--fg-strong);
  display: inline-block;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.card--app {
  border-color: color-mix(in srgb, var(--powder) 22%, var(--card-border));
}

.card--profile {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--card-border));
}

.card--coach {
  border-color: color-mix(in srgb, var(--mauve) 24%, var(--card-border));
}

.avatar-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 14px;
  align-items: center;
}

.avatar-preview {
  width: 92px;
  height: 92px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview.empty {
  color: var(--muted);
  font-size: 0.78rem;
  text-align: center;
  padding: 10px;
}

.avatar-actions {
  display: grid;
  gap: 10px;
  align-items: start;
}

.avatar-input {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--card-border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  color: var(--fg);
}

.avatar-crop-box {
  width: min(320px, 100%);
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  overflow: hidden;
  position: relative;
  margin: 10px auto 14px;
  touch-action: none;
}

.avatar-crop-img {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
  max-width: none;
  max-height: none;
}

.avatar-crop-controls {
  display: grid;
  gap: 10px;
}

.crop-label {
  display: flex;
  align-items: center;
  gap: 12px;
}

.crop-label span {
  color: var(--muted);
  font-weight: 700;
  font-size: 0.9rem;
  white-space: nowrap;
}

.crop-label input[type="range"] {
  flex: 1;
}

.hint { color: var(--muted); margin: 4px 0 12px; }

.username-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.save-btn {
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 14px;
  font-weight: 700;
  cursor: pointer;
  min-width: 110px;
}

.save-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.text-input {
  width: 100%;
  padding: 12px 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font-size: 1rem;
  font-weight: 600;
}

.text-input::placeholder {
  color: color-mix(in srgb, var(--muted) 80%, transparent);
  font-weight: 600;
}

.text-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-color) 45%, var(--card-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 18%, transparent);
}

.coach-add-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.coach-clients-row {
  margin-top: 10px;
}

.outline-btn {
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-weight: 700;
  cursor: pointer;
}

.outline-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-text {
  margin-top: 10px;
  color: color-mix(in srgb, var(--error-color) 85%, #fff);
  font-weight: 650;
}

.coach-clients {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.client-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}

.client-meta {
  min-width: 0;
}

.client-name {
  font-weight: 800;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.client-uid {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dev-token-row {
  margin-top: 10px;
}

.client-workouts {
  display: grid;
  gap: 10px;
}

.client-workout-main {
  min-width: 0;
}

.client-workout-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.client-workout-row:hover {
  background: color-mix(in srgb, var(--surface) 85%, transparent);
}

.client-workout-title {
  font-weight: 800;
}

.client-workout-sub {
  font-size: 0.85rem;
  color: var(--muted);
}

.client-workout-date {
  font-size: 0.85rem;
  color: var(--muted);
  white-space: nowrap;
}

.workout-detail {
  max-width: 100%;
  overflow-x: hidden;
}

.workout-detail-header {
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  border-radius: 12px;
  padding: 10px 12px;
}

.workout-detail-title {
  font-weight: 900;
}

.workout-detail-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 2px;
}

.workout-section-title {
  font-weight: 850;
  margin: 10px 0 6px;
}

.workout-notes {
  margin-top: 10px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 65%, transparent);
  border-radius: 12px;
  padding: 10px 12px;
}

.workout-notes-text {
  color: var(--fg);
  white-space: pre-wrap;
}

.workout-exercises {
  display: grid;
  gap: 10px;
}

.workout-exercise {
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  border-radius: 12px;
  padding: 10px 12px;
}

.workout-exercise-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.workout-exercise-name {
  font-weight: 850;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.workout-exercise-meta {
  font-size: 0.85rem;
  color: var(--muted);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.workout-sets {
  margin-top: 8px;
  display: grid;
  gap: 4px;
}

.workout-set {
  font-size: 0.9rem;
  color: var(--fg);
  white-space: pre-wrap;
}

.chat {
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--surface) 65%, transparent);
  border-radius: 12px;
  padding: 10px 12px;
}

.chat-list {
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  padding-right: 4px;
}

.chat-msg {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--card-bg) 70%, transparent);
}

.chat-msg.from-coach {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--card-border));
}

.chat-msg.from-client {
  border-color: color-mix(in srgb, var(--muted) 30%, var(--card-border));
}

.chat-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.78rem;
  color: var(--muted);
  margin-bottom: 4px;
}

.chat-text {
  white-space: pre-wrap;
  color: var(--fg);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.chat-compose {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.chat-compose textarea.text-input {
  width: 100%;
  resize: vertical;
}

.theme-options { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.opt { display: inline-flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 10px; }
.toggle { margin-left: auto; background: var(--accent); color: #fff; border: none; border-radius: 10px; padding: 10px 12px; }

.goal-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; }
.goal-input { display: inline-flex; align-items: center; border: 1px solid var(--card-border); border-radius: 10px; overflow: hidden; }
.goal-input input { width: 72px; text-align: center; border: none; padding: 10px; background: var(--surface); color: var(--fg); }
.goal-input .step { background: var(--surface); color: var(--fg); border: none; padding: 10px 12px; cursor: pointer; }
.goal-badge { background: var(--surface); border: 1px solid var(--card-border); padding: 6px 10px; border-radius: 999px; color: var(--muted); font-size: 0.9rem; }

/* Danger Zone */
.danger-zone {
  border: 1px solid color-mix(in srgb, var(--error-color) 30%, transparent);
  background: color-mix(in srgb, var(--error-color) 5%, var(--card-bg));
}

.danger-zone h3 {
  color: var(--error-color);
  margin-bottom: 8px;
}

.account-danger {
  margin-top: 20px;
}

.account-delete-btn {
  background: linear-gradient(135deg, var(--error-color) 0%, color-mix(in srgb, var(--error-color) 80%, black) 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s ease;
  width: 100%;
}

.account-delete-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.account-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.danger-btn {
  width: 100%;
  background: transparent;
  border: 2px solid var(--error-color);
  color: var(--error-color);
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: color-mix(in srgb, var(--error-color) 10%, transparent);
  transform: translateY(-1px);
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.danger-btn:disabled:hover {
  transform: none;
  background: transparent;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}

.modal-content.modal-wide {
  max-width: 920px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;
  margin-bottom: 16px;
}

.modal-header h3 {
  color: var(--fg);
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.modal-content.danger-modal .modal-header h3 {
  color: var(--error-color);
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--surface);
  color: var(--fg);
}

.modal-body {
  padding: 0 24px 24px;
  overflow: auto;
}

.warning-text {
  color: var(--muted);
  margin-bottom: 20px;
  line-height: 1.5;
  font-size: 0.95rem;
}

.warning-list {
  margin-bottom: 24px;
  border: 1px solid color-mix(in srgb, var(--error-color) 30%, transparent);
  border-radius: 8px;
  padding: 16px;
  background: color-mix(in srgb, var(--error-color) 5%, transparent);
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--fg);
}

.warning-item:last-child {
  margin-bottom: 0;
}

.warning-icon {
  font-size: 1.1rem;
  width: 20px;
  text-align: center;
}

.confirm-input {
  margin-bottom: 24px;
}

.confirm-input label {
  display: block;
  color: var(--fg);
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.confirm-input input {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--fg);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.confirm-input input:focus {
  outline: none;
  border-color: var(--error-color);
}

.confirm-input input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-btn {
  background: var(--surface);
  border: 1px solid var(--card-border);
  color: var(--fg);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: color-mix(in srgb, var(--fg) 10%, var(--surface));
}

.confirm-danger-btn {
  background: var(--error-color);
  border: none;
  color: white;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-danger-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error-color) 85%, black);
  transform: translateY(-1px);
}

.confirm-danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Developer Tools */
.dev-tools {
  border: 2px solid #22c55e;
  background: color-mix(in srgb, #22c55e 5%, transparent);
}

.dev-tools h3 {
  color: #22c55e;
}

.dev-btn {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dev-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(34, 197, 94, 0.3);
}

.dev-plan-toggle {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, #22c55e 35%, transparent);
}

.plan-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.95rem;
}

.override-chip {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #15803d;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
}

.override-chip.ghost {
  opacity: 0.6;
  border-style: dashed;
}

.dev-plan-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.dev-plan-btn {
  flex: 1 1 90px;
  min-width: 90px;
  background: rgba(34, 197, 94, 0.08);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.5);
  border-radius: 10px;
  padding: 10px 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dev-plan-btn.active {
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(21, 128, 61, 0.3);
}

.dev-plan-btn.ghost {
  border: 1px dashed rgba(34, 197, 94, 0.7);
  background: transparent;
  color: rgba(34, 197, 94, 0.9);
  flex: 1 1 140px;
}

.dev-plan-btn.ghost.danger {
  border-color: rgba(248, 113, 113, 0.6);
  color: #b91c1c;
}

.dev-plan-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hint.tiny {
  margin-top: 8px;
  font-size: 0.75rem;
}

.dev-unlock {
  border: 2px dashed #93c5fd;
  background: color-mix(in srgb, #93c5fd 12%, transparent);
}

.dev-unlock-badge {
  width: 100%;
  margin-top: 12px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 999px;
  padding: 12px 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dev-unlock-badge:active {
  transform: scale(0.98);
}

/* Toast Einstellungen entfernt */
</style>

<style scoped>
.coach-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.coach-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  color: var(--text);
  background: rgba(255, 165, 0, 0.18);
  border: 1px solid rgba(255, 165, 0, 0.35);
}
</style>
