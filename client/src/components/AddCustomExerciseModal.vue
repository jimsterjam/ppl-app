<template>
  <AppModal
    v-model="internalOpen"
    :title="isEditMode ? (t('exercises.editCustomTitle') || 'Übung bearbeiten') : (t('exercises.addCustomTitle') || 'Eigene Übung hinzufügen')"
    :show-cancel="true"
    :confirm-text="saving ? t('common.loading') : (isEditMode ? t('common.save') : t('common.add'))"
    :cancel-text="t('common.cancel')"
    type="info"
    :close-on-confirm="false"
    :persistent="saving"
    @confirm="onConfirm"
    @cancel="onCancel"
  >
    <div class="custom-exercise-form">
      <label class="field image-field">
        <span>{{ t('exercises.imageLabel') || 'Bild (optional)' }}</span>
        <label class="field image-field">
        <span>{{ t('exercises.imageLabel') || 'Bild (optional)' }}</span>
        <div class="image-picker" @click="pickImage">
          <img v-if="imagePreviewUrl" :src="imagePreviewUrl" class="image-preview" alt="" />
          <span v-else class="image-placeholder">+ {{ t('exercises.imageAdd') || 'Bild wählen' }}</span>
        </div>
        <small v-if="isEditMode && !canUploadImage" class="image-hint">
          {{ t('exercises.imageSyncHint') || 'Bild kann erst nach der ersten Synchronisierung hinzugefügt werden.' }}
        </small>
      </label>
        <small v-if="isEditMode && !canUploadImage" class="image-hint">
          {{ t('exercises.imageSyncHint') || 'Bild kann erst nach der ersten Synchronisierung hinzugefügt werden.' }}
        </small>
      </label>

      <label class="field">
        <span>{{ t('exercises.nameLabel') || 'Name der Übung' }}</span>
        <input
          v-model="name"
          type="text"
          maxlength="60"
          :placeholder="t('exercises.nameLabel') || 'z.B. Bulgarian Split Squat'"
          @keydown.enter.prevent="onConfirm"
        />
      </label>

      <label class="field">
        <span>{{ t('exercises.muscleGroupLabel') || 'Muskelgruppe' }}</span>
        <select v-model="muscleGroup">
          <option value="">{{ t('exercises.muscleGroupPlaceholder') || 'Bitte wählen' }}</option>
          <option value="chest">{{ t('muscleGroups.chest') || 'Brust' }}</option>
          <option value="back">{{ t('muscleGroups.back') || 'Rücken' }}</option>
          <option value="shoulders">{{ t('muscleGroups.shoulders') || 'Schultern' }}</option>
          <option value="biceps">{{ t('muscleGroups.biceps') || 'Bizeps' }}</option>
          <option value="triceps">{{ t('muscleGroups.triceps') || 'Trizeps' }}</option>
          <option value="legs">{{ t('muscleGroups.legs') || 'Beine' }}</option>
          <option value="glutes">{{ t('muscleGroups.glutes') || 'Gesäß' }}</option>
          <option value="abs">{{ t('muscleGroups.abs') || 'Bauch' }}</option>
          <option value="other">{{ t('muscleGroups.other') || 'Sonstiges' }}</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t('exercises.notesLabel') || 'Notiz (optional)' }}</span>
        <textarea
          v-model="notes"
          rows="2"
          maxlength="200"
          :placeholder="t('exercises.notesPlaceholder') || 'z.B. Ersatz für Nordic Curls, näher an meiner tatsächlichen Übung'"
        ></textarea>
      </label>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    </div>
  </AppModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/AppModal.vue'
import { createCustomExercise, updateCustomExercise, uploadCustomExerciseImage } from '@/api/customExercises'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { compressImageFile } from '@/utils/imageCompression'
import { logger } from '@/utils/logger'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  userId: { type: String, default: '' },
  // Falls gesetzt: Bearbeiten-Modus statt Neu-Anlegen. Erwartet { _id, name, muscleGroup, notes, imageUrl }
  exercise: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'created', 'updated'])
const { t } = useI18n()
const { getIdToken } = useFirebaseAuth()

const internalOpen = ref(props.modelValue)
const name = ref('')
const muscleGroup = ref('')
const notes = ref('')
const saving = ref(false)
const errorMsg = ref('')
const selectedImageFile = ref(null)
const imagePreviewUrl = ref('')

const isEditMode = computed(() => Boolean(props.exercise?._id))
// Bild-Upload braucht eine bereits synchronisierte Server-ID (kein custom_-Präfix)
const canUploadImage = computed(() => isEditMode.value && !String(props.exercise?._id || '').startsWith('custom_'))

watch(() => props.modelValue, (val) => {
  internalOpen.value = val
  if (val) {
    errorMsg.value = ''
    saving.value = false
    selectedImageFile.value = null
    if (isEditMode.value) {
      name.value = props.exercise?.name || ''
      muscleGroup.value = props.exercise?.muscleGroup || ''
      notes.value = props.exercise?.notes || ''
      imagePreviewUrl.value = props.exercise?.imageUrl || ''
    } else {
      name.value = ''
      muscleGroup.value = ''
      notes.value = ''
      imagePreviewUrl.value = ''
    }
  }
})

watch(internalOpen, (val) => {
  if (val !== props.modelValue) emit('update:modelValue', val)
})

async function pickImage() {
  errorMsg.value = ''
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      promptLabelHeader: t('exercises.imagePickTitle') || 'Bild auswählen',
      promptLabelPhoto: t('exercises.imagePickGallery') || 'Aus Galerie wählen',
      promptLabelPicture: t('exercises.imagePickCamera') || 'Foto aufnehmen'
    })

    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })

    const compressed = await compressImageFile(file, { maxEdge: 480, quality: 0.86 })
    selectedImageFile.value = compressed
    imagePreviewUrl.value = URL.createObjectURL(compressed)
  } catch (err) {
    if (err?.message === 'User cancelled photos app') return
    logger.warn('[AddCustomExerciseModal] Bildauswahl fehlgeschlagen', err?.message)
    errorMsg.value = t('exercises.imageError') || 'Bild konnte nicht verarbeitet werden.'
  }
}

async function onConfirm() {
  if (saving.value) return
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    errorMsg.value = t('exercises.nameRequired') || 'Bitte einen Namen eingeben.'
    return
  }
  if (!props.userId) {
    errorMsg.value = t('common.error') || 'Fehler: Kein User erkannt.'
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    const token = await getIdToken().catch(() => null)
    let result

    if (isEditMode.value) {
      result = await updateCustomExercise(props.exercise._id, {
        name: trimmedName,
        muscleGroup: muscleGroup.value || 'other',
        notes: notes.value.trim() || ''
      }, token)

      if (selectedImageFile.value && canUploadImage.value) {
        try {
          result = await uploadCustomExerciseImage(props.exercise._id, selectedImageFile.value, token)
        } catch (imgErr) {
          logger.warn('[AddCustomExerciseModal] Bild-Upload fehlgeschlagen', imgErr?.message)
          // Textänderungen sind bereits gespeichert — Bildfehler nicht als Gesamtfehler werten,
          // aber informieren.
          errorMsg.value = t('exercises.imageUploadFailed') || 'Übung gespeichert, Bild-Upload fehlgeschlagen.'
        }
      }

      emit('updated', result)
    } else {
      result = await createCustomExercise({
        userId: props.userId,
        name: trimmedName,
        muscleGroup: muscleGroup.value || 'other',
        notes: notes.value.trim() || ''
      }, token)

      if (selectedImageFile.value && result?._id && !String(result._id).startsWith('custom_')) {
        try {
          result = await uploadCustomExerciseImage(result._id, selectedImageFile.value, token)
        } catch (imgErr) {
          logger.warn('[AddCustomExerciseModal] Bild-Upload nach Anlegen fehlgeschlagen', imgErr?.message)
        }
      }

      emit('created', result)
    }

    if (!errorMsg.value) internalOpen.value = false
  } catch (err) {
    errorMsg.value = t('common.error') || 'Speichern fehlgeschlagen. Bitte erneut versuchen.'
  } finally {
    saving.value = false
  }
}

function onCancel() {
  internalOpen.value = false
}
</script>

<style scoped>
.custom-exercise-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
}

.field input,
.field select,
.field textarea {
  border-radius: 10px;
  border: 1px solid var(--card-border, rgba(255,255,255,0.15));
  background: color-mix(in srgb, var(--bg-panel, #12151b) 90%, transparent);
  color: var(--fg, #fff);
  padding: 10px 12px;
  font-size: 0.95rem;
  font-family: inherit;
}

.field textarea {
  resize: vertical;
}

.image-field {
  align-items: flex-start;
}

.hidden-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.image-picker {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  border: 1px dashed var(--card-border, rgba(255,255,255,0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-panel, #12151b) 90%, transparent);
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--fg, #fff) 55%, transparent);
  text-align: center;
  padding: 0 8px;
}

.image-hint {
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--fg, #fff) 55%, transparent);
}

.error-msg {
  color: #dc2626;
  font-size: 0.85rem;
  margin: 0;
}
</style>