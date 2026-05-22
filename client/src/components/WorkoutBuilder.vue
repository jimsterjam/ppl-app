<script setup>
import ExerciseList from '@/components/ExerciseList.vue'

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore'
import { useFirebaseAuth } from '@/utils/firebaseAuth';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useToastStore } from '@/stores/toastStore';
import AppModal from '@/components/AppModal.vue';
import StepIndicator from '@/components/StepIndicator.vue';
import BottomNav from '@/components/BottomNav.vue';
import { getAllExercisesOffline, saveWorkoutOffline, deleteWorkoutOffline, getWorkoutOffline } from '@/utils/offlineStorage';
import { deleteWorkout as deleteServerWorkout } from '@/api/workouts';
import { getMergedSortedExercises } from '@/utils/exerciseList';
import { searchAndRankExercises } from '@/utils/exerciseSearch'
import { consumeWorkoutBuilderPrefill, normalizeBuilderWorkoutType, readWorkoutBuilderRouteState } from '@/utils/workoutBuilderFlow'
import { logger } from '@/utils/logger'


// --- State & Stores ---

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const authStore = useAuthStore()
const { auth, getCurrentUser, onAuthStateChanged, getIdToken } = useFirebaseAuth()
const firebaseUser = ref(null)
onAuthStateChanged((user) => {
	logger.debug('WorkoutBuilder onAuthStateChanged:', user)
  firebaseUser.value = user
  userStore.user = user ? { id: user.uid, email: user.email, displayName: user.displayName } : null
  if (user) {
    loadExercises()
  }
})
const subscriptionStore = useSubscriptionStore()
const toast = useToastStore()
const { t, locale } = useI18n()
const effectiveAuthUser = computed(() => firebaseUser.value || authStore.user || getCurrentUser?.() || null)
const isLoaded = computed(() => authStore.initialized !== false)
const isSignedIn = computed(() => !!effectiveAuthUser.value)
const loadingUser = computed(() => authStore.initialized === false)
const userIdComputed = computed(() => effectiveAuthUser.value?.uid || effectiveAuthUser.value?.id || 'guest')
const canRenderBuilder = computed(() => initialReady.value || loadingUser.value || isSignedIn.value)

const selectedType = ref('push')
const selectedExercises = ref([])
const exercises = ref([])
const loading = ref(false)
const initialReady = ref(false)
const search = ref('')
const creating = ref(false)
const errorMsg = ref('')
const showTypePicker = ref(false)
const showMobilePicker = ref(false)
const draggingIndex = ref(null)
const planRef = ref(null)
// Equipment-Filter (dynamisch)
import { loadDefaultExercises } from '@/utils/defaultExercisesLoader'
const showEquipmentFilter = ref(false)
const selectedEquipment = ref('')
const favoriteAutostartTriggered = ref(false)
const favoriteContext = ref(null)
// Alle Equipment-Typen aus den Exercises extrahieren
const normalizedExercises = ref([])
const allEquipmentTypes = computed(() => {
	const set = new Set()
	normalizedExercises.value.forEach(e => {
		if (e.equipment) set.add(e.equipment)
	})
	return Array.from(set)
})
// Mapping für Übersetzungen
const equipmentTranslation = (equip) => {
	// Standardisierte Keys für i18n
	const keyMap = {
		'Körpergewicht': 'bodyweight',
		'Langhantel': 'barbell',
		'Hanteln': 'dumbbell',
		'Maschine': 'machine',
		'Kabelzug': 'cable',
		'Band': 'band',
		'Kettlebell': 'kettlebell',
		'Medizinball': 'medicineball',
		'Sandbag': 'sandbag',
		'Eigengewicht': 'bodyweight',
		'Bodyweight': 'bodyweight',
		'Barbell': 'barbell',
		'Dumbbells': 'dumbbell',
		'Dumbbell': 'dumbbell',
		'Cable': 'cable',
		'Machine': 'machine',
		'Medicineball': 'medicineball',
	}
	const key = keyMap[equip] || equip.toLowerCase()
	// Fallback: Zeige deutschen Namen, falls keine Übersetzung vorhanden
	const translated = t(`exercises.equipment.${key}`)
	if (translated && !translated.startsWith('exercises.equipment.')) return translated
	// Fallback: Zeige englischen Namen aus default-exercises.json, falls vorhanden
	const found = normalizedExercises.value.find(e => e.equipment === equip)
	if (found && found.equipment_en) return found.equipment_en
	return equip
}
function setEquipment(equip) {
	selectedEquipment.value = equip
	loadExercises()
}

function consumeQuickPrefill() {
	const routeState = readWorkoutBuilderRouteState(route.query)
	if (!routeState.quick) return
	const parsed = consumeWorkoutBuilderPrefill()
	const favoriteId = String(parsed?.favoriteId || '').trim()
	if (parsed?.favoriteSource && favoriteId) {
		favoriteContext.value = {
			favoriteId,
			favoriteName: String(parsed?.favoriteName || '').trim(),
			favoriteType: normalizeBuilderWorkoutType(parsed?.favoriteType || parsed?.type || selectedType.value)
		}
	} else {
		favoriteContext.value = null
	}
	const list = Array.isArray(parsed?.exercises) ? parsed.exercises : []
	if (!list.length) return
	selectedExercises.value = list.map((exercise, index) => ({
		...exercise,
		_id: exercise._id || `quick_${index}`,
		exerciseId: exercise.exerciseId || exercise._id || null,
		setDetails: Array.isArray(exercise.setDetails) && exercise.setDetails.length > 0
			? exercise.setDetails
			: []
	}))
}

function buildFavoriteDetailQuery(base = {}) {
	const query = { ...base }
	const ctx = favoriteContext.value
	if (!ctx?.favoriteId) return query
	query.favoriteSource = '1'
	query.favoriteId = String(ctx.favoriteId)
	if (ctx.favoriteName) query.favoriteName = String(ctx.favoriteName)
	if (ctx.favoriteType) query.favoriteType = String(ctx.favoriteType)
	if (String(route.query?.favoriteStart || '') === '1') query.favoriteStart = '1'
	if (String(route.query?.favoriteAdjust || '') === '1') query.favoriteAdjust = '1'
	return query
}

function syncTypeFromRoute() {
	const routeState = readWorkoutBuilderRouteState(route.query)
	const nextType = normalizeBuilderWorkoutType(routeState.type)
	if (selectedType.value !== nextType) {
		selectedType.value = nextType
	}
	if (nextType === 'fullbody' && selectedEquipment.value) {
		selectedEquipment.value = ''
	}
}

function maybeAutoStartFavorite() {
	const routeState = readWorkoutBuilderRouteState(route.query)
	if (!routeState.favoriteStart || favoriteAutostartTriggered.value) return
	favoriteAutostartTriggered.value = true
	setTimeout(() => {
		if (selectedExercises.value.length > 0 && !creating.value) {
			createWorkout()
		}
	}, 0)
}

// --- Draft-Logik ---
function getDraftId() {
	const currentUserId = userIdComputed.value || 'guest';
	const type = String(selectedType.value || 'push')
	const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
	return `draft-${currentUserId}-${type}-${nonce}`;
}

// --- Workout Types ---
const workoutTypes = computed(() => [
  {
    value: 'push',
    label: t('builder.pushDay') !== 'builder.pushDay'
      ? t('builder.pushDay')
      : 'Push Day'
  },
  {
    value: 'pull',
    label: t('builder.pullDay') !== 'builder.pullDay'
      ? t('builder.pullDay')
      : 'Pull Day'
  },
  {
    value: 'legs',
    label: t('builder.legsDay') !== 'builder.legsDay'
      ? t('builder.legsDay')
      : 'Leg Day'
	},
	{
		value: 'fullbody',
		label: t('builder.fullBodyDay') !== 'builder.fullBodyDay'
			? t('builder.fullBodyDay')
			: 'Ganzkörper'
  }
])
const currentTypeLabel = computed(() => {
  const type = workoutTypes.value.find(typeItem => typeItem.value === selectedType.value)
  return type ? type.label : ''
})

// --- Responsive ---
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isMobile = computed(() => viewportWidth.value <= 480)
const onResize = () => { viewportWidth.value = window.innerWidth }
onMounted(() => {
	window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))

onMounted(async () => {
	try {
		normalizedExercises.value = await loadDefaultExercises()
	} catch {}
	syncTypeFromRoute()
	consumeQuickPrefill()
	maybeAutoStartFavorite()
	await loadExercises()

	// Prüfe Auth-Status sofort
	const currentUser = getCurrentUser()
	logger.debug('WorkoutBuilder onMounted getCurrentUser:', currentUser)
	if (currentUser) {
		firebaseUser.value = currentUser
		await loadExercises()
	} else if (authStore.user) {
		firebaseUser.value = authStore.user
		await loadExercises()
	}
	// Falls noch nicht eingeloggt, markieren wir die View als bereit,
	// damit der Nutzer nicht eine leere Sektion sieht
	initialReady.value = true
})

// --- Exercises ---
async function loadExercises() {
	loading.value = true
	try {
		const categoryMap = { push: 'Push', pull: 'Pull', legs: 'Legs', fullbody: null }
		const params = { equipment: selectedEquipment.value, locale: String(locale.value) }
		const categoryKey = categoryMap[selectedType.value]
		if (categoryKey) params.category = categoryKey
		logger.debug('[Builder] loadExercises start — type:', selectedType.value, 'category:', categoryKey, 'equipment:', selectedEquipment.value)
		let list = await getMergedSortedExercises({ ...params, includeRemote: false })
		logger.debug('[Builder] getMergedSortedExercises returned:', list?.length || 0)
		// Fallback: wenn merge leer, lade Defaults direkt
		if (!list || list.length === 0) {
			logger.debug('[Builder] Merged list empty, trying defaults fallback...')
			try {
				const defaults = normalizedExercises.value?.length
					? normalizedExercises.value
					: await loadDefaultExercises()
				logger.debug('[Builder] Defaults fallback count:', defaults?.length || 0)
				list = categoryKey
					? (defaults || []).filter(ex => (ex.category || '') === categoryKey)
					: (defaults || [])
			} catch (err) {
				logger.warn('[Builder] Defaults fallback failed:', err?.message || err)
			}
		}
		exercises.value = Array.isArray(list) ? list : []
		logger.debug('[Builder] exercises.value set to:', exercises.value.length)
	} catch {
		// Letzter Fallback: normalizedExercises (schon in onMounted geladen)
		const categoryMap = { push: 'Push', pull: 'Pull', legs: 'Legs', fullbody: null }
		const categoryKey = categoryMap[selectedType.value]
		const defaults = normalizedExercises.value || []
		exercises.value = categoryKey
			? defaults.filter(ex => (ex.category || '') === categoryKey)
			: defaults
	} finally {
		loading.value = false
	}
}
const filteredExercises = computed(() => {
	const term = search.value.trim().toLowerCase()
	const list = Array.isArray(exercises.value) ? exercises.value : []
	const normalizeKey = (value) => String(value || '').trim().toLowerCase()
	const deduped = []
	const seen = new Set()

	for (const exercise of list) {
		if (!exercise) continue
		const canonicalName = normalizeKey(exercise.displayName || exercise.name || exercise.name_en)
		if (!canonicalName) continue
		if (seen.has(canonicalName)) continue
		seen.add(canonicalName)
		deduped.push(exercise)
	}

	return searchAndRankExercises(deduped, term, {
		getPrimaryText: (exercise) => exercise?.displayName || exercise?.name || '',
		getSecondaryTexts: (exercise) => [
			exercise?.name_en || '',
			exercise?.muscleGroup || '',
			exercise?.equipment || '',
			exercise?.category || ''
		]
	})
})
const selectedExerciseIds = computed(() => selectedExercises.value.map(e => e._id || e.exerciseId || e.id).filter(Boolean))

function toggleExercise(exercise) {
	const idx = selectedExercises.value.findIndex(e => e._id === exercise._id)
	if (idx > -1) {
		selectedExercises.value.splice(idx, 1)
	} else {
		const sanitized = {
			...exercise,
			exerciseId: exercise.exerciseId || exercise._id || exercise.id || null,
			setDetails: Array.isArray(exercise.setDetails) && exercise.setDetails.length > 0
				? exercise.setDetails
				: [{ reps: 10, weight: 0 }]
		}
		selectedExercises.value.push(sanitized)
	}
}
function removeExercise(idx) {
	selectedExercises.value.splice(idx, 1)
}
function onDragStart(idx) { draggingIndex.value = idx }
function onDrop(idx) {
	const from = draggingIndex.value
	if (from === null || from === idx) return
	const list = selectedExercises.value
	const [moved] = list.splice(from, 1)
	list.splice(idx, 0, moved)
	draggingIndex.value = null
}

// --- Create Workout ---
async function createWorkout() {
  errorMsg.value = '';
	if (!isSignedIn.value) {
		errorMsg.value = t('builder.signInFirst');
		return;
	}
  if (!subscriptionStore.canCreateWorkout) {
    errorMsg.value = t('builder.createFailed');
    return;
  }
  creating.value = true;
	try {
		const workoutData = {
			name: `${currentTypeLabel.value} - ${new Date().toLocaleDateString(String(locale.value).startsWith('de') ? 'de-DE' : 'en-US')}`,
			type: selectedType.value,
			userId: userIdComputed.value,
			exercises: selectedExercises.value.map(ex => ({
				exerciseId: ex.exerciseId || ex._id || ex.id || null,
				name: ex.name,
				sets: (ex.setDetails || []).filter(s => !s.isWarmup).length || ex.setDetails?.length || 3,
				reps: (ex.setDetails || []).find(s => !s.isWarmup)?.reps ?? ex.reps ?? 10,
				weight: (ex.setDetails || []).find(s => !s.isWarmup)?.weight ?? ex.weight ?? 0,
				category: ex.category,
				note: typeof ex.note === 'string' ? ex.note : '',
				setDetails: ex.setDetails || []
			})),
			date: new Date().toISOString(),
			completed: false
		};
		const tempId = getDraftId();
		const tempWorkout = {
			...workoutData,
			_id: tempId,
			userId: userIdComputed.value,
			_isDraft: true,
			isDraft: true,
			completed: false,
			updatedAt: Date.now()
		};
		await saveWorkoutOffline(tempWorkout);
		try {
			sessionStorage.setItem('workout_detail_draft', JSON.stringify({
				...tempWorkout,
				timestamp: Date.now()
			}))
		} catch {}
		const existingIdx = userStore.workouts.findIndex(w => String(w?._id || '') === String(tempId))
		if (existingIdx !== -1) {
			userStore.workouts[existingIdx] = { ...userStore.workouts[existingIdx], ...tempWorkout }
		} else {
			userStore.workouts.unshift(tempWorkout)
		}
		logger.debug('[WorkoutBuilder] immediate temp draft prepared', { tempId })
		await router.push({ name: 'workout-detail', params: { id: tempId }, query: buildFavoriteDetailQuery() });
		logger.debug('[WorkoutBuilder] navigated to temp workout detail', { tempId })

		let token = await getIdToken();
		if (!token) {
			errorMsg.value = t('builder.authLoading');
			toast.success(t('builder.created'))
			return;
		}
		logger.debug('[WorkoutBuilder] createWorkout start', {
			tempId,
			type: workoutData.type,
			exercises: workoutData.exercises?.length || 0
		})
		toast.success(t('builder.created'));
		// Backend-Speichern im Hintergrund
		userStore.createWorkout(workoutData, token).then(async created => {
			if (created?._id) {
				// Wenn der User bereits weg navigiert ist, Server-Workout löschen statt Ghost-Draft anlegen
				const currentRouteId = String(router.currentRoute.value?.params?.id || '')
				const currentRouteName = String(router.currentRoute.value?.name || '')
				if (currentRouteId !== tempId && currentRouteName !== 'workout-builder') {
					logger.debug('[WorkoutBuilder] User hat Workout-Flow verlassen vor Create-Response – lösche Orphan:', created._id)
					try {
						// Aus Store entfernen (wurde in userStore.createWorkout als _isDraft:true eingetragen)
						const orphanIdx = userStore.workouts.findIndex(w => String(w?._id || '') === String(created._id))
						if (orphanIdx !== -1) userStore.workouts.splice(orphanIdx, 1)
					} catch {}
					try {
						const tk = await getIdToken().catch(() => null)
						if (tk) await deleteServerWorkout(created._id, tk).catch(() => null)
						else await deleteWorkoutOffline(created._id).catch(() => null)
					} catch {}
					return
				}
				logger.debug('[WorkoutBuilder] backend create resolved', {
					tempId,
					realId: created._id
				})
				try { sessionStorage.setItem(`workout_map_${tempId}`, String(created._id)) } catch {}
				logger.debug('[WorkoutBuilder] temp->real mapping stored', { tempId, realId: created._id })
				// Workout bleibt bis zum Abschluss als Draft markiert.
				// WICHTIG: Kein blindes Überschreiben von IndexedDB/sessionStorage mit dem
				// Template-Stand (cleanWorkout). Der User könnte in WorkoutDetail bereits Werte
				// geändert haben. Nur speichern wenn noch kein neuerer Eintrag existiert.
				const cleanWorkout = {
					...workoutData,
					_id: created._id,
					userId: created.userId || workoutData.userId || userIdComputed.value,
					_isDraft: true,
					isDraft: true
				};
				const existingOffline = await getWorkoutOffline(created._id).catch(() => null)
				if (!existingOffline) {
					// Noch kein Eintrag unter dieser ID → erster Schreiber, sicher
					await saveWorkoutOffline(cleanWorkout);
					try {
						sessionStorage.setItem('workout_detail_draft', JSON.stringify({
							...cleanWorkout,
							completed: false,
							timestamp: Date.now()
						}))
					} catch {}
					logger.debug('[WorkoutBuilder] real workout cached offline (initial)', { realId: created._id })
				} else {
					// WorkoutDetail hat die ID bereits übernommen und speichert aktuellere Daten –
					// Template-Stand nicht zurückschreiben, damit User-Änderungen erhalten bleiben.
					logger.debug('[WorkoutBuilder] real workout already in IndexedDB, skip overwrite', { realId: created._id })
				}

				try {
					const idx = userStore.workouts.findIndex(w => String(w?._id || '') === String(created._id))
					if (idx !== -1) {
						userStore.workouts[idx] = { ...userStore.workouts[idx], _isDraft: true, isDraft: true, completed: false }
					} else {
						userStore.workouts.unshift({ ...created, _isDraft: true, isDraft: true, completed: false })
					}
				} catch {}

				// Sofort auf echtes Workout umschalten (auch wenn Route noch nicht auf tempId aktualisiert wurde)
				// currentRouteId/currentRouteName wurden bereits oben für den Abort-Check gesetzt
				logger.debug('[WorkoutBuilder] route state before replace', { currentRouteName, currentRouteId, tempId })
				if (currentRouteId === tempId || currentRouteName === 'workout-builder') {
					await router.replace({
						name: 'workout-detail',
						params: { id: created._id },
						query: buildFavoriteDetailQuery({ created: '1', realId: created._id })
					})
					logger.debug('[WorkoutBuilder] replaced to real workout detail', { realId: created._id })
				}

				// Temp-Draft erst löschen, wenn es nicht mehr aktiv angezeigt wird
				setTimeout(async () => {
					try {
						const activeId = String(router.currentRoute.value?.params?.id || '')
						if (activeId !== tempId) {
							await deleteWorkoutOffline(tempId)
							logger.debug('[WorkoutBuilder] temp workout deleted after handover', { tempId, activeId })
						} else {
							logger.warn('[WorkoutBuilder] temp workout not deleted because it is still active', { tempId, activeId })
						}
					} catch {}
				}, 1500)
			}
		}).catch((err) => {
			logger.error('[WorkoutBuilder] backend create failed', { tempId, message: err?.message })
			toast.error(t('builder.createFailed') + (err?.message ? ': ' + err.message : ''));
		});
	} catch (e) {
		let hint = '';
		if (e && typeof e.message === 'string' && /Cannot access 'te' before initialization/.test(e.message)) {
			hint = '\nHinweis: Im Template wird vermutlich eine Variable (z.B. v-for="t in ...") verwendet, die die Übersetzungsfunktion t() überschattet. Bitte prüfe die v-for-Schleifen und benenne die Variable um.';
		}
		errorMsg.value = t('builder.createFailed') + (e?.message ? ': ' + e.message : (e?.toString() ? ': ' + e.toString() : '')) + hint;
	} finally {
		creating.value = false;
	}
}

// --- UI/UX ---
function goDashboard() { router.push({ name: 'dashboard' }) }
function pickType(val) {
	if (!val || val === selectedType.value) { showTypePicker.value = false; return }
	selectedType.value = val
	if (val === 'fullbody') selectedEquipment.value = ''
	selectedExercises.value = []
	showTypePicker.value = false
}
watch(selectedType, (next) => {
	if (next === 'fullbody' && selectedEquipment.value) {
		selectedEquipment.value = ''
	}
	loadExercises()
})
watch(() => route.query.type, () => {
	syncTypeFromRoute()
})
watch(() => `${route.query.quick || ''}:${route.query.favoriteStart || ''}`, () => {
	consumeQuickPrefill()
	maybeAutoStartFavorite()
})
// Draft wird nicht mehr automatisch gespeichert
</script>

<template>
	<div class="workout-builder">
		<div class="builder-topbar">
			<button class="back-top-btn" :title="t('builder.backToDashboardTitle')" @click="goDashboard">{{ t('builder.backToDashboard') }}</button>
			<h2>{{ t('builder.createTitle') }}</h2>
		</div>
		<StepIndicator :active="selectedExercises.length === 0 ? 2 : 3" />
		<div v-if="!isLoaded || loadingUser" class="auth-gate">
			<p class="auth-gate-text">{{ t('builder.authLoading') }}</p>
		</div>
		<div v-else-if="!isSignedIn" class="auth-gate">
			<p class="auth-gate-text">{{ t('builder.authGate') }}</p>
		</div>
		<div v-if="canRenderBuilder" class="type-select">
			<label for="wb-type" class="type-label">{{ t('builder.stepType') }}</label>
			<div v-if="isMobile" class="mobile-type-actions">
				<button class="open-picker-btn" @click="showTypePicker = true">
					{{ currentTypeLabel ? `${t('builder.stepType')}: ${currentTypeLabel}` : t('builder.selectType') }}
				</button>
				<div class="mobile-secondary-actions">
					<button class="open-picker-btn" @click="showMobilePicker = true">{{ t('builder.pickExercises') }}</button>
					<button class="create-btn" :disabled="creating || selectedExercises.length === 0 || !isSignedIn" @click="createWorkout">
						{{ creating ? t('builder.creating') : `${t('builder.create')} (${selectedExercises.length})` }}
					</button>
				</div>
			</div>
			<select v-else id="wb-type" v-model="selectedType" class="type-dropdown" @change="loadExercises">
				<option v-for="typeItem in workoutTypes" :key="typeItem.value" :value="typeItem.value">{{ typeItem.label }}</option>
			</select>

		</div>

		<div v-if="isMobile && showTypePicker" class="picker-overlay" @click.self="showTypePicker = false">
			<div class="picker-sheet">
				<div class="picker-header">
					<h4>{{ t('builder.pickWorkoutType') }}</h4>
					<button class="close-picker" @click="showTypePicker = false">✕</button>
				</div>
				<div class="picker-list">
					<div class="type-list">
						<button v-for="typeItem in workoutTypes" :key="typeItem.value" class="type-item" :aria-pressed="selectedType === typeItem.value" @click="pickType(typeItem.value)">{{ typeItem.label }}</button>
					</div>
				</div>
				<div class="picker-actions">
					<button class="done-btn" @click="showTypePicker = false">{{ t('builder.done') }}</button>
				</div>
			</div>
		</div>
		<div v-if="canRenderBuilder" class="exercises-section">
			<div v-if="!isMobile" class="sticky-cta">
				<button class="create-btn" :disabled="creating || selectedExercises.length === 0 || !isSignedIn" @click="createWorkout">
					{{ creating ? t('builder.creating') : `${t('builder.create')} (${selectedExercises.length})` }}
				</button>
			</div>
			<div v-if="!isSignedIn" class="auth-gate compact">
				<p class="auth-gate-text">{{ t('builder.authGate') }}</p>
			</div>
			<template v-if="!isMobile">
				<div class="search-row">
					<input v-model="search" class="search-input" type="search" :placeholder="t('builder.searchPlaceholder')" />
				</div>
				<div v-if="loading && initialReady" class="exercises-grid">
					<div v-for="n in 6" :key="n" class="exercise-item sk"></div>
				</div>
				<div v-else-if="!loading && filteredExercises.length === 0 && initialReady" class="empty-state">
					<p>😅 Keine Übungen für diese Kategorie verfügbar</p>
				</div>
				<ExerciseList
					v-else
					:show-title="false"
					:show-controls="false"
					:items="filteredExercises"
					:selectable="true"
					:selected-ids="selectedExerciseIds"
					@toggle="toggleExercise"
				/>
			</template>
			<div v-if="isMobile && showMobilePicker" class="picker-overlay" @click.self="showMobilePicker = false">
				<div class="picker-sheet">
					<div class="picker-header">
						<h4>{{ t('builder.selectExercises') }}</h4>
						<button class="close-picker" @click="showMobilePicker = false">✕</button>
					</div>
					<!-- Equipment-Filter als zentriertes Dropdown im Overlay -->
					<div style="margin-bottom: 10px; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px;">
						<label for="equipment-filter-select" style="font-weight:600;">
							{{ t('builder.filterEquipment') !== 'builder.filterEquipment' ? t('builder.filterEquipment') : 'Equipment filtern' }}
						</label>
						<select id="equipment-filter-select" v-model="selectedEquipment" @change="setEquipment($event.target.value)" style="padding:7px 12px; border-radius:8px; border:1px solid #e5e7eb; min-width:140px;">
							<option :value="''">{{ t('exercises.filters.all') || 'Alle' }}</option>
							<option v-for="equipmentOption in allEquipmentTypes" :key="equipmentOption" :value="equipmentOption">{{ equipmentTranslation(equipmentOption) }}</option>
						 </select>
					 </div>
					<div class="search-row in-sheet">
						<input v-model="search" class="search-input" type="search" :placeholder="t('builder.searchPlaceholder')" />
					</div>
					<div class="picker-list" :aria-busy="loading">
						<div v-if="loading" class="exercises-grid">
							<div v-for="n in 6" :key="n" class="exercise-item sk"></div>
						</div>
						<ExerciseList
							v-else
							:show-title="false"
							:show-controls="false"
							:items="filteredExercises"
							:selectable="true"
							:selected-ids="selectedExerciseIds"
							@toggle="toggleExercise"
						/>
					</div>
					<div class="picker-actions">
						<button class="done-btn" @click="showMobilePicker = false">{{ t('builder.done') }}</button>
					</div>
				</div>
			</div>
			<div v-if="selectedExercises.length > 0" id="workout-plan" ref="planRef" class="selected-exercises">
				<h3>{{ t('builder.planTitle', { count: selectedExercises.length }) }}</h3>
				<ul class="selected-exercise-list">
					<li v-for="(exercise, index) in selectedExercises" :key="exercise._id" class="selected-exercise-item" draggable="true" @dragstart="onDragStart(index)" @dragover.prevent="onDrop(index)">
						<span class="exercise-name">{{ exercise.displayName || exercise.name }}</span>
						<button class="remove-btn" @click="removeExercise(index)" aria-label="remove exercise">×</button>
					</li>
				</ul>
				<p v-if="errorMsg" class="error-hint">{{ errorMsg }}</p>
			</div>
		</div>
		<BottomNav />
	</div>
</template>

<style scoped>

/* Auswahl-Liste für Übungen */
.selected-exercises {
	background: var(--card-bg, #fff);
	border-radius: 16px;
	box-shadow: 0 2px 12px rgba(0,0,0,0.06);
	padding: 20px 18px;
	border: 1px solid var(--card-border, #e5e7eb);
}
.selected-exercise-list {
	list-style: none;
	padding: 0;
	margin: 14px 0 0 0;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.selected-exercise-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-radius: 12px;
	border: 1px solid var(--card-border, #e5e7eb);
	background: var(--surface, #f8fafc);
	cursor: grab;
}
.selected-exercise-item:active { cursor: grabbing; }
.exercise-name {
	font-weight: 600;
	color: var(--fg);
}
.remove-btn {
	border: 1px solid color-mix(in srgb, var(--danger-color) 65%, black 35%);
	background: var(--danger-color, #dc2626);
	color: #fff;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	font-size: 1.1rem;
	line-height: 1;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: opacity 0.15s ease, transform 0.12s ease;
}
.remove-btn:hover {
	opacity: 0.92;
}
.remove-btn:active {
	transform: scale(0.97);
}

/* Section für Übungen optisch hervorheben */
.exercises-section {
	background: var(--card-bg, #fff);
	border-radius: 16px;
	box-shadow: 0 2px 12px rgba(0,0,0,0.06);
	padding: 24px 18px 18px 18px;
	margin: 0 auto 28px auto;
	max-width: 700px;
	border: 1px solid var(--card-border, #e5e7eb);
	display: flex;
	flex-direction: column;
	gap: 18px;
}
@media (max-width: 600px) {
	.exercises-section {
		padding: 14px 4vw 12px 4vw;
		max-width: 98vw;
	}
}

/* --- ExercisesView-ähnliches Layout für WorkoutBuilder --- */
.workout-builder {
	min-height: 100vh;
	background: var(--bg);
	color: var(--fg);
	/* Safe-Area oben berücksichtigen (iPhone Notch) */
	padding: calc(20px + var(--safe-top, 0px)) clamp(14px, 3.5vw, 24px) 80px clamp(14px, 3.5vw, 24px);
	padding-bottom: 80px;
}
.builder-topbar {
	position: sticky;
	/* Unterhalb der Safe-Area einrasten */
	top: var(--safe-top, 0px);
	z-index: 10;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 0 16px 0;
	background: var(--bg);
}
.back-top-btn {
	padding: 8px 12px;
	border-radius: 10px;
	border: 2px solid var(--accent-color);
	background: transparent;
	color: var(--fg);
	cursor: pointer;
	font-weight: 600;
	transition: background 0.15s;
}
.back-top-btn:hover { background: var(--accent-soft); }

/* Typ- und Filter-Buttons wie in ExercisesView */
.quick-buttons, .type-list {
	display: flex;
	gap: 12px;
	flex-wrap: wrap;
	margin-bottom: 20px;
}
.quick-buttons button, .type-item {
	flex: 1;
	padding: 12px 20px;
	border-radius: 12px;
	border: none;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;
	min-height: 44px;
	background: var(--bg-panel);
	color: var(--fg-strong);
}
.push-btn, .type-item.push { background: #DC2626; }
.pull-btn, .type-item.pull { background: #2563EB; }
.leg-btn, .type-item.legs { background: #16A34A; }
.all-btn { background: #374151; }
.quick-buttons button.active, .type-item[aria-pressed="true"] {
	box-shadow: 0 2px 8px rgba(0,0,0,0.08);
	outline: 2px solid var(--accent-color);
	background: var(--accent-color);
	color: var(--accent-contrast, #fff);
}

/* Grid/Karten für Übungen */
.exercises-grid, .exercises-list {
	display: grid;
	gap: 16px;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	margin-bottom: 24px;
}
.exercise-item, .exercise-card {
	background: var(--card-bg);
	border-radius: 12px;
	padding: 16px;
	border: 1px solid var(--card-border);
	box-shadow: var(--shadow-soft);
	cursor: pointer;
	transition: all 0.2s;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.exercise-item.selected {
	border-color: var(--accent-color);
	background: var(--accent-soft);
}
.exercise-item .title, .exercise-card .title {
	font-weight: bold;
	color: var(--accent-color);
	font-size: 1.1rem;
}
.exercise-item .sub, .exercise-card .sub {
	color: var(--muted);
	font-size: 0.9rem;
}
.exercise-item .equip, .exercise-card .equip {
	color: var(--muted);
	font-size: 0.85rem;
}
.exercise-item.sk { height: 84px; background: var(--surface); border: 1px solid var(--card-border); }

/* Info-Overlay-Design */
.info-overlay {
	position: fixed;
	top: 0; left: 0; right: 0; bottom: 0;
	background: rgba(0,0,0,0.35);
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}
.info-content {
	background: var(--card-bg);
	color: var(--fg);
	border-radius: 14px;
	box-shadow: 0 4px 24px rgba(0,0,0,0.18);
	padding: 28px 22px 18px 22px;
	max-width: 340px;
	width: 90vw;
	text-align: center;
	position: relative;
}
.info-content h3 {
	margin-top: 0;
	margin-bottom: 10px;
	font-size: 1.15rem;
}
.info-content p {
	font-size: 1rem;
	margin-bottom: 18px;
}
.close-btn {
	background: var(--accent);
	color: var(--accent-contrast);
	border: none;
	border-radius: 8px;
	padding: 7px 18px;
	font-size: 1rem;
	cursor: pointer;
	font-weight: 600;
	transition: background 0.15s;
}
.close-btn:hover { filter: brightness(1.03); }

/* Sonstiges */
.search-row { margin: 8px 0 16px; }
.search-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.sticky-cta {
	position: sticky;
	bottom: 0; left: 0; right: 0;
	background: var(--surface);
	backdrop-filter: blur(6px);
	padding: 12px 0 8px;
	display: flex;
	justify-content: center;
	align-items: center;
}
.mobile-ex-picker { margin: 8px 0 12px; }
.mobile-type-actions {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.mobile-secondary-actions {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.mobile-secondary-actions .create-btn {
	width: 100%;
}
.open-picker-btn { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font-weight: 600; }
.picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-start; z-index: 50; }
.picker-sheet { background: var(--bg); border-radius: 0 0 12px 12px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; border: 1px solid var(--card-border); overflow: hidden; }
.picker-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
.picker-header h4 { margin: 0; }
.close-picker { background: transparent; border: none; color: var(--fg); font-size: 1.1rem; cursor: pointer; }
.picker-list { padding: 12px 16px; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
.picker-list :deep(.exercise-list-root),
.picker-list :deep(.vue-recycle-scroller),
.picker-list :deep(.vue-recycle-scroller__item-wrapper) { overflow: visible !important; }
.ex-row {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Name links, rest rechts */
  gap: 8px;
}
.ex-row .sub.small {
  margin-left: auto;
}
.search-row.in-sheet { margin: 12px 16px; }
.picker-actions { padding: 12px 16px 16px; border-top: 1px solid var(--card-border); }
.done-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }

/* Create-Button wie Push-Button */
.create-btn {
	min-width: 180px;
	padding: 14px 28px;
	border-radius: 12px;
	border: none;
	font-weight: 700;
	font-size: 1.1rem;
	background: var(--accent);
	color: var(--accent-contrast);
	box-shadow: var(--shadow-soft);
	cursor: pointer;
	transition: background 0.18s, transform 0.12s;
	display: block;
	margin: 0 auto;
}
.create-btn:disabled {
	background: color-mix(in srgb, var(--accent) 40%, var(--bg-panel));
	color: var(--muted);
	cursor: not-allowed;
	opacity: 0.7;
}
.create-btn:hover:not(:disabled) {
	background: color-mix(in srgb, var(--accent) 82%, black 18%);
	transform: translateY(-1px) scale(1.03);
}

.remove-btn:hover { opacity: 0.85; }
@media (max-width: 600px) {
	.selected-exercise-item {
		padding: 10px 12px;
	}
}
@media (min-width: 481px) { .mobile-ex-picker, .picker-overlay { display: none; } }
.auth-gate { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.auth-gate.compact { margin-bottom: 0; }
.auth-gate-text { color: var(--warning-color); margin: 0 0 12px 0; }
.error-hint { margin-top: 8px; color: var(--danger-color); font-size: 0.95rem; }
</style>
