<template>
  <div class="avatar-editor">
    <button
      class="avatar-editor__trigger"
      type="button"
      :aria-label="$t('settings.profilePicture')"
      @click="onTriggerClick"
    >
      <img
        v-if="avatarSrc && !avatarLoadError"
        class="avatar-editor__img"
        :src="avatarSrc"
        alt=""
        @error="onAvatarImgError"
      />
      <span v-else class="avatar-editor__fallback">{{ initials }}</span>
    </button>

    <input
      v-if="!isNativePlatform"
      ref="avatarFileInput"
      class="avatar-editor__file-input"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      @change="onAvatarFileChange"
    />

    <!-- Auswahl-Modal (User-Report): Klick auf den Avatar sprang bisher IMMER direkt in die
         Fotogalerie. Besser: bei bereits vorhandenem Profilfoto erst fragen, ob das aktuelle
         Foto nochmal bearbeitet oder komplett ausgetauscht werden soll - die Galerie öffnet sich
         dann erst, wenn der User "Austauschen" wählt. Ohne vorhandenes Foto (nur Initialen)
         bleibt der Klick weiterhin direkt der Foto-Picker, eine Auswahl wäre dort sinnlos. -->
    <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="showChoiceModal" class="modal-overlay" @click.self="closeChoiceModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ $t('settings.profilePictureChoiceTitle') }}</h3>
            <button class="close-btn" @click="closeChoiceModal" aria-label="Schließen">×</button>
          </div>
          <div class="modal-body">
            <div class="avatar-choice-actions">
              <button class="choice-btn" type="button" @click="onChooseEditCurrent">
                {{ $t('settings.profilePictureChoiceEdit') }}
              </button>
              <button class="choice-btn" type="button" @click="onChooseReplace">
                {{ $t('settings.profilePictureChoiceReplace') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>

    <!-- Avatar Crop/Compress -->
    <!-- Teleport auf document.body: .header-bar (Elternkomponente HeaderBar) hat
         backdrop-filter gesetzt, das erzeugt einen neuen Containing Block für
         position:fixed-Nachfahren. Ohne Teleport würde dieses Modal relativ zur
         kleinen Header-Box statt zum Viewport positioniert (zu weit oben, abgeschnitten). -->
    <Teleport to="body">
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
    </Teleport>
  </div>
</template>

<script setup>
// Wiederverwendbare Avatar-Bearbeitungskomponente: Klick auf den Avatar öffnet direkt den
// Foto-Picker (nativ) bzw. den Datei-Dialog (Web) und danach das Crop-Modal - kein Umweg mehr
// über eine separate Settings-Seite (User-Feedback: Profilfoto/-name sollen direkt im Dashboard
// ansteuerbar sein). Komplette Logik 1:1 aus SettingsView.vue übernommen (Crop/Kompression,
// nativer Capacitor-Picker, Web-Fallback per <input type="file">, Upload), nur die Darstellung
// des Auslösers (früher: eigene Card mit Button, jetzt: der Avatar selbst) wurde angepasst.
import { ref, computed, onBeforeUnmount, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { initFirebaseAuth, useFirebaseAuth } from '@/utils/firebaseAuth'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { logger } from '@/utils/logger'
import { uploadProfileAvatar } from '@/api/account'
import { useScrollLock } from '@/composables/useScrollLock'

const { t: $t } = useI18n()
const settings = useSettingsStore()
const toast = useToastStore()

const avatarLoadError = ref(false)
// avatarData (DataURL-Cache, localStorage) hat Vorrang vor der Server-URL,
// da letztere auf iOS via img-Tag durch ATS blockiert werden kann.
const avatarSrc = computed(() => {
  const data = String(settings.avatarData || '').trim()
  if (data) return data
  return String(settings.avatarUrl || '').trim()
})
const avatarFallbackSrc = computed(() => String(settings.avatarUrl || '').trim())

const props = defineProps({
  // Initialen für den Fallback, falls kein Bild vorhanden ist - vom Aufrufer übergeben, da diese
  // Komponente selbst nichts über den angezeigten Namen weiß.
  initials: {
    type: String,
    default: 'U'
  }
})
const initials = computed(() => props.initials || 'U')

function onAvatarImgError() {
  const fallback = avatarFallbackSrc.value
  if (fallback && settings.avatarData) {
    // DataURL kaputt/veraltet - auf Server-URL zurückfallen
    settings.setAvatarData('')
    return
  }
  avatarLoadError.value = true
}

// Auth Helper (identisch zu SettingsView.vue getIdTokenSafe())
async function getIdTokenSafe() {
  try {
    await initFirebaseAuth()
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken().catch(() => null)
  } catch (e) {
    logger.warn('[AvatarEditor] getIdTokenSafe failed:', e?.message || e)
    return null
  }
}

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
// Auswahl-Modal "Bearbeiten/Austauschen" (siehe onTriggerClick weiter unten) - hier bereits
// deklariert, damit der Scroll-Lock-Watch direkt darunter darauf zugreifen kann.
const showChoiceModal = ref(false)

// Hintergrund-Scroll sperren, solange eines der beiden Modals offen ist
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = useScrollLock()
watch(showAvatarCropModal, (open) => (open ? lockBodyScroll() : unlockBodyScroll()))
watch(showChoiceModal, (open) => (open ? lockBodyScroll() : unlockBodyScroll()))
onBeforeUnmount(unlockBodyScroll)
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

async function ensurePhotoPermission() {
  try {
    const status = await Camera.checkPermissions()
    const current = status?.photos || status?.camera
    if (current === 'granted' || current === 'limited') return true
    const requested = await Camera.requestPermissions({ permissions: ['photos'] })
    const next = requested?.photos || requested?.camera
    return next === 'granted' || next === 'limited'
  } catch (e) {
    logger.warn('[AvatarEditor] photo permission check failed:', e?.message || e)
    return false
  }
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

// User-Report: Klick auf den Avatar öffnete bisher immer sofort die Fotogalerie, auch wenn der
// User eigentlich nur den bestehenden Ausschnitt/Zoom des aktuellen Fotos nachjustieren wollte.
// Jetzt: bei vorhandenem Foto erst die Wahl zwischen "Bearbeiten" und "Austauschen" anbieten.
// (showChoiceModal selbst ist weiter oben deklariert, siehe Scroll-Lock-Watch.)
function onTriggerClick() {
  const hasExistingAvatar = Boolean(avatarSrc.value && !avatarLoadError.value)
  if (hasExistingAvatar) {
    showChoiceModal.value = true
  } else {
    openReplacePicker()
  }
}

function closeChoiceModal() {
  showChoiceModal.value = false
}

function openReplacePicker() {
  if (isNativePlatform.value) {
    void pickAvatarFromPhotos()
  } else {
    avatarFileInput.value?.click()
  }
}

function onChooseReplace() {
  showChoiceModal.value = false
  openReplacePicker()
}

// Einfache Variante (siehe Absprache): wir speichern nur die bereits auf 512x512 zugeschnittene
// Version, nicht das Originalfoto vor dem ersten Zuschnitt. "Bearbeiten" justiert also Ausschnitt/
// Zoom auf Basis dieser gespeicherten Version neu, nicht verlustfrei auf dem Originalbild.
async function onChooseEditCurrent() {
  showChoiceModal.value = false
  const src = avatarSrc.value
  if (!src) return
  try {
    const resp = await fetch(src)
    const blob = await resp.blob()
    const file = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
    await openAvatarCrop(file)
  } catch (e) {
    logger.warn('[AvatarEditor] onChooseEditCurrent failed:', e?.message || e)
    toast.show($t('settings.profilePictureEditLoadFailed'), { type: 'error', duration: 2400 })
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
    logger.warn('[AvatarEditor] Avatar crop init failed:', e?.message || e)
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

    // Automatisch hochladen (kein manueller Upload-Button mehr, siehe Kommentar am Component-Kopf)
    void uploadAvatar()
  } catch (e) {
    logger.warn('[AvatarEditor] applyAvatarCrop failed:', e?.message || e)
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
    // DataURL-Cache für Persistenz wurde bereits in applyAvatarCrop() via
    // settings.setAvatarData(cropDataUrl) gesetzt.
    toast.show($t('common.updated'), { type: 'success', duration: 1400 })
    avatarFile.value = null
    try {
      if (avatarFileInput.value) avatarFileInput.value.value = ''
    } catch {}
    // Preview NICHT löschen – avatarPreviewUrl (DataURL) bleibt bis zur Navigation
    // sichtbar; settingsAvatarData ist bereits gecacht.
    // Keep username etc stable, but refresh profile in background
    void settings.loadProfile(token).catch(() => null)
  } catch (e) {
    toast.show(e?.message || $t('common.error'), { type: 'error', duration: 2200 })
  } finally {
    avatarUploading.value = false
  }
}
</script>

<style scoped>
.avatar-editor {
  display: inline-block;
}

/* Optik 1:1 aus der bisherigen .dashboard-avatar-Klasse in DashboardView.vue übernommen, damit
   sich am Erscheinungsbild durch die Extraktion nichts ändert. */
.avatar-editor__trigger {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  background: var(--card-bg);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.avatar-editor__trigger:hover {
  transform: translateY(-1px);
  border-color: var(--line-strong);
  background: var(--bg-panel);
}

.avatar-editor__trigger:active {
  transform: translateY(0);
}

.avatar-editor__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-editor__fallback {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--fg);
  background: var(--card-bg);
}

.avatar-editor__file-input {
  display: none;
}

/* Modal - identisch zum bisherigen Settings-Modal-Stil */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in oklab, #000000 40%, transparent);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0 20px;
  margin-bottom: 12px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.modal-body {
  padding: 0 20px 20px 20px;
}

.hint {
  color: var(--muted);
  font-size: 0.85rem;
}

.avatar-choice-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.choice-btn {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font-weight: 600;
  font-size: 0.95rem;
  text-align: left;
  cursor: pointer;
}

.choice-btn:hover {
  background: var(--bg-panel);
}

/* 1:1 aus der bisherigen Crop-Modal-Optik in SettingsView.vue übernommen. */
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
  cursor: grab;
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
  margin-top: 16px;
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

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.cancel-btn,
.save-btn {
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  cursor: pointer;
  font-weight: 600;
}

.cancel-btn {
  background: transparent;
  color: var(--fg);
}

.save-btn {
  background: var(--accent-color);
  color: #fff;
  border-color: transparent;
}

.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
