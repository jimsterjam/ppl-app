
<style scoped>
/* Set-Row: moderne, klare Darstellung */
.set-row {
	display: grid;
	grid-template-columns: 36px 1fr 1fr 32px;
	gap: 12px;
	align-items: center;
	background: var(--surface, #f8fafc);
	border-radius: 8px;
	padding: 8px 0 8px 8px;
	margin-bottom: 6px;
	box-shadow: 0 1px 4px rgba(0,0,0,0.03);
}
.set-label {
	color: var(--muted);
	font-size: 0.85rem;
	text-align: center;
	font-weight: 600;
}
.set-field {
	display: flex;
	align-items: center;
	gap: 6px;
	background: transparent;
	border-radius: 6px;
	padding: 0 4px;
}
.set-field input {
	width: 60px;
	padding: 7px 6px;
	border-radius: 6px;
	border: 1px solid var(--card-border);
	background: #fff;
	color: var(--fg);
	font-size: 1rem;
	text-align: right;
}
.remove-set {
	background: transparent;
	border: none;
	color: var(--danger-color);
	font-size: 20px;
	cursor: pointer;
	border-radius: 50%;
	width: 28px;
	height: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.15s;
}
.remove-set:hover {
	background: #fee2e2;
}
@media (max-width: 600px) {
	.set-row {
		grid-template-columns: 28px 1fr 1fr 28px;
		gap: 6px;
		padding: 6px 0 6px 4px;
	}
	.set-field input {
		width: 44px;
		font-size: 0.98rem;
	}
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
</style>

<script setup>
import ExercisePicker from '@/components/ExercisePicker.vue'

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/userStore';
import { useFirebaseAuth } from '@/utils/firebaseAuth';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useToastStore } from '@/stores/toastStore';
import AppModal from '@/components/AppModal.vue';
import StepIndicator from '@/components/StepIndicator.vue';
import BottomNav from '@/components/BottomNav.vue';
import UpgradeModal from '@/components/UpgradeModal.vue';
import { getAllExercisesOffline } from '@/utils/offlineStorage';
import { getMergedSortedExercises } from '@/utils/exerciseList';
import { saveWorkoutOffline, getWorkoutOffline } from '@/utils/offlineStorage';
import { logger } from '@/utils/logger'


// --- State & Stores ---

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const { auth, getCurrentUser, onAuthStateChanged, getIdToken } = useFirebaseAuth()
const firebaseUser = ref(null)
onAuthStateChanged((user) => {
	logger.debug('WorkoutBuilder onAuthStateChanged:', user)
  firebaseUser.value = user
  userStore.user = user ? { id: user.uid, email: user.email, displayName: user.displayName } : null
  if (user) {
    loadDraft()
    loadExercises()
  }
})
const subscriptionStore = useSubscriptionStore()
const toast = useToastStore()
const { t, locale } = useI18n()
const isLoaded = computed(() => !userStore.loading)
const isSignedIn = computed(() => !!firebaseUser.value)
const loadingUser = computed(() => userStore.loading)
const userId = computed(() => firebaseUser.value?.uid || 'guest')

const selectedType = ref('push')
const selectedExercises = ref([])
const exercises = ref([])
const loading = ref(false)
const initialReady = ref(false)
const search = ref('')
const creating = ref(false)
const errorMsg = ref('')
const showUpgradeModal = ref(false)
const upgradeLimitType = ref('exercises')
const showBelief = ref(true)
const beliefText = ref('')
const showTypePicker = ref(false)
const showMobilePicker = ref(false)
const draggingIndex = ref(null)
const planRef = ref(null)
// Equipment-Filter (dynamisch)
import allExercisesData from '@/data/default-exercises.json'
const showEquipmentFilter = ref(false)
const selectedEquipment = ref('')
// Alle Equipment-Typen aus den Exercises extrahieren
const allEquipmentTypes = computed(() => {
	const set = new Set()
	allExercisesData.forEach(e => {
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
		'Band': 'band',
		'Kettlebell': 'kettlebell',
		'Medicineball': 'medicineball',
		'Sandbag': 'sandbag',
	}
	const key = keyMap[equip] || equip.toLowerCase()
	// Fallback: Zeige deutschen Namen, falls keine Übersetzung vorhanden
	const translated = t(`exercises.equipment.${key}`)
	if (translated && !translated.startsWith('exercises.equipment.')) return translated
	// Fallback: Zeige englischen Namen aus default-exercises.json, falls vorhanden
	const found = allExercisesData.find(e => e.equipment === equip)
	if (found && found.equipment_en) return found.equipment_en
	return equip
}
function setEquipment(equip) {
	selectedEquipment.value = equip
	loadExercises()
}

// --- Draft-Logik ---
async function saveDraft() {
	const draft = {
		_id: 'draft',
		type: selectedType.value,
		exercises: selectedExercises.value,
		isDraft: true,
		updatedAt: Date.now(),
		name: (selectedType.value ? `${selectedType.value.charAt(0).toUpperCase() + selectedType.value.slice(1)} Day` : 'Workout Draft')
	}
	await saveWorkoutOffline(draft)
}
async function loadDraft() {
	const draft = await getWorkoutOffline('draft')
	if (draft) {
		if (draft.type) selectedType.value = draft.type
		if (Array.isArray(draft.exercises)) selectedExercises.value = draft.exercises
		return true
	}
	return false
}
function clearDraft() {
	// Optional: delete from IndexedDB
}

// --- Workout Types ---
const workoutTypes = [
	{ value: 'push', label: t('builder.pushDay') && t('builder.pushDay') !== 'builder.pushDay' ? t('builder.pushDay') : 'Push Day' },
	{ value: 'pull', label: t('builder.pullDay') && t('builder.pullDay') !== 'builder.pullDay' ? t('builder.pullDay') : 'Pull Day' },
	{ value: 'legs', label: t('builder.legsDay') && t('builder.legsDay') !== 'builder.legsDay' ? t('builder.legsDay') : 'Leg Day' }
]
const currentTypeLabel = computed(() => {
	const type = workoutTypes.find(t => t.value === selectedType.value)
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

// --- Belief/Affirmation ---
const BELIEF_KEY = 'wb_belief_last_shown'
function todayKey() {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function continuePlan() {
	showBelief.value = false
	try { localStorage.setItem(BELIEF_KEY, todayKey()) } catch {}
}
onMounted(async () => {
	// Übernehme Typ aus Query, falls vorhanden
	const qType = String(route.query?.type || '').toLowerCase()
	if (qType && ['push','pull','legs'].includes(qType)) {
		selectedType.value = qType
	}
	// Affirmation
	const beliefsDe = [
		'Jede Wiederholung bringt dich deinem Ziel näher.',
		'Konstanz schlägt Intensität – heute zählt’s.',
		'Kleiner Schritt, große Wirkung: jetzt starten.',
		'Du bist stärker als deine Ausreden.',
		'Fortschritt, nicht Perfektion.'
	]
	const beliefsEn = [
		'Each rep gets you closer to your goal.',
		'Consistency beats intensity — today counts.',
		'Small step, big impact: start now.',
		'You’re stronger than your excuses.',
		'Progress, not perfection.'
	]
	const beliefs = String(locale.value).startsWith('de') ? beliefsDe : beliefsEn
	beliefText.value = beliefs[Math.floor(Math.random() * beliefs.length)]
	try {
		const last = localStorage.getItem(BELIEF_KEY)
		showBelief.value = last !== todayKey()
	} catch { showBelief.value = true }

	// Prüfe Auth-Status sofort
	const currentUser = getCurrentUser()
	logger.debug('WorkoutBuilder onMounted getCurrentUser:', currentUser)
	if (currentUser) {
		firebaseUser.value = currentUser
		loadDraft()
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
		if (!isSignedIn.value) {
			exercises.value = []
			return
		}
		const categoryMap = { push: 'Push', pull: 'Pull', legs: 'Legs' }
		const list = await getMergedSortedExercises({ category: categoryMap[selectedType.value], equipment: selectedEquipment.value, locale: String(locale.value) })
		exercises.value = list
	} catch {
		exercises.value = []
	} finally {
		loading.value = false
	}
}
const filteredExercises = computed(() => {
	const term = search.value.trim().toLowerCase()
	const base = !term ? exercises.value : exercises.value.filter(e =>
		(e.displayName || e.name || '').toLowerCase().includes(term) ||
		(e.muscleGroup || '').toLowerCase().includes(term) ||
		(e.equipment || '').toLowerCase().includes(term)
	)
	// preserve base ordering (already sorted by displayName in util)
	return base
})

function toggleExercise(exercise) {
	const idx = selectedExercises.value.findIndex(e => e._id === exercise._id)
	if (idx > -1) selectedExercises.value.splice(idx, 1)
	else selectedExercises.value.push({ ...exercise, setDetails: [{ reps: 10, weight: 0 }] })
	saveDraft()
}
function isSelected(exercise) {
	return selectedExercises.value.some(e => e._id === exercise._id)
}
function removeExercise(idx) {
	selectedExercises.value.splice(idx, 1)
	saveDraft()
}
function onDragStart(idx) { draggingIndex.value = idx }
function onDrop(idx) {
	const from = draggingIndex.value
	if (from === null || from === idx) return
	const list = selectedExercises.value
	const [moved] = list.splice(from, 1)
	list.splice(idx, 0, moved)
	draggingIndex.value = null
	saveDraft()
}

function updateSet(exIdx, setIdx, field, val) {
	const ex = selectedExercises.value[exIdx]
	if (!ex?.setDetails?.[setIdx]) return
	const num = Number(val)
	if (field === 'reps') ex.setDetails[setIdx].reps = isFinite(num) ? num : ex.setDetails[setIdx].reps
	if (field === 'weight') ex.setDetails[setIdx].weight = isFinite(num) ? num : ex.setDetails[setIdx].weight
	saveDraft()
}
function removeSet(exIdx, setIdx) {
	const ex = selectedExercises.value[exIdx]
	if (!ex?.setDetails) return
	ex.setDetails.splice(setIdx, 1)
	saveDraft()
}

// --- Create Workout ---
async function createWorkout() {
	errorMsg.value = ''
	if (!isSignedIn.value) {
		errorMsg.value = t('builder.signInFirst')
		return
	}
	if (!subscriptionStore.canCreateWorkout) {
		upgradeLimitType.value = 'workouts'
		showUpgradeModal.value = true
		return
	}
	creating.value = true
	try {
		const workoutData = {
			name: `${currentTypeLabel.value} - ${new Date().toLocaleDateString(String(locale.value).startsWith('de') ? 'de-DE' : 'en-US')}`,
			type: selectedType.value,
			exercises: selectedExercises.value.map(ex => ({
				name: ex.name,
				sets: ex.setDetails?.length || 3,
				reps: ex.setDetails?.[0]?.reps || 10,
				weight: ex.setDetails?.[0]?.weight || 0,
				category: ex.category,
				note: typeof ex.note === 'string' ? ex.note : '',
				setDetails: ex.setDetails || []
			})),
			date: new Date().toISOString(),
			completed: false
		}
		let token = await getIdToken()
		if (!token) {
			// kurze Wartezeit, falls Auth-State noch nachzieht (WKWebView)
			await new Promise(r => setTimeout(r, 400))
			token = await getIdToken()
		}
		if (!token) {
			errorMsg.value = t('builder.authLoading')
			return
		}
		const created = await userStore.createWorkout(workoutData, token)
		clearDraft()
		await router.push({ name: 'workout-detail', params: { id: created?._id } })
		toast.success(t('builder.created'))
	} catch (e) {
		errorMsg.value = t('builder.createFailed')
	} finally {
		creating.value = false
	}
}

// --- UI/UX ---
function goDashboard() { router.push({ name: 'dashboard' }) }
function pickType(val) {
	if (!val || val === selectedType.value) { showTypePicker.value = false; return }
	selectedType.value = val
	selectedExercises.value = []
	showTypePicker.value = false
	loadExercises()
	saveDraft()
}
watch(selectedType, loadExercises)
watch(selectedExercises, saveDraft, { deep: true })
</script>

<template>
	<div class="workout-builder">
		<AppModal v-model="showBelief" :title="t('builder.impulseTitle')" :message="beliefText" :confirm-text="t('builder.continue')" :show-cancel="false" :persistent="true" type="info" @confirm="continuePlan" />
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
		<div v-else-if="initialReady" class="type-select">
			<label for="wb-type" class="type-label">{{ t('builder.stepType') }}</label>
			<div v-if="isMobile" class="mobile-ex-picker">
				<button class="open-picker-btn" @click="showTypePicker = true">
					{{ currentTypeLabel ? `${t('builder.stepType')}: ${currentTypeLabel}` : t('builder.selectType') }}
				</button>
			</div>
			<select v-else id="wb-type" v-model="selectedType" class="type-dropdown" @change="loadExercises">
				<option v-for="type in workoutTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
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
						<button v-for="t in workoutTypes" :key="t.value" class="type-item" :aria-pressed="selectedType === t.value" @click="pickType(t.value)">{{ t.label }}</button>
					</div>
				</div>
				<div class="picker-actions">
					<button class="done-btn" @click="showTypePicker = false">{{ t('builder.done') }}</button>
				</div>
			</div>
		</div>
		<div v-if="isSignedIn" class="exercises-section">
			<h3>{{ t('builder.availableExercises', { type: currentTypeLabel }) }}</h3>
			<div class="sticky-cta">
				<button class="create-btn" :disabled="creating || selectedExercises.length === 0" @click="createWorkout">
					{{ creating ? t('builder.creating') : `${t('builder.create')} (${selectedExercises.length})` }}
				</button>
			</div>
			<div v-if="isMobile" class="mobile-ex-picker">
				<button class="open-picker-btn" @click="showMobilePicker = true">{{ t('builder.pickExercises') }}</button>
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
				<div v-else class="exercises-grid">
					<div v-for="exercise in filteredExercises" :key="exercise._id" :class="{ selected: isSelected(exercise) }" class="exercise-item" @click="toggleExercise(exercise)">
						<div class="ex-row">
							<span class="title">{{ exercise.displayName || exercise.name }}</span>
							<span class="sub">{{ exercise.muscleGroup }}</span>
							<span class="sub small">{{ exercise.equipment || t('exercises.bodyweight') }}</span>
						</div>
					</div>
				</div>
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
											 <option v-for="equip in allEquipmentTypes" :key="equip" :value="equip">{{ equipmentTranslation(equip) }}</option>
										 </select>
									 </div>
					   <div class="search-row in-sheet">
						   <input v-model="search" class="search-input" type="search" :placeholder="t('builder.searchPlaceholder')" />
					   </div>
			   		   <div class="picker-list" :aria-busy="loading">
						   <div v-if="loading" class="exercises-grid">
							   <div v-for="n in 6" :key="n" class="exercise-item sk"></div>
						   </div>
			   		   <div v-else class="exercises-grid">
			   		   	<div v-for="exercise in filteredExercises" :key="exercise._id" :class="{ selected: isSelected(exercise) }" class="exercise-item" @click="toggleExercise(exercise)">
			   		   		<div class="ex-row">
			   		   			<span class="title">{{ exercise.displayName || exercise.name }}</span>
			   		   			<span class="sub">{{ exercise.muscleGroup }}</span>
			   		   			<span class="sub small">{{ exercise.equipment || t('exercises.bodyweight') }}</span>
			   		   		</div>
			   		   	</div>
			   		   </div>
					   </div>
					   <div class="picker-actions">
						   <button class="done-btn" @click="showMobilePicker = false">{{ t('builder.done') }}</button>
					   </div>
				   </div>
			   </div>
			<div v-if="selectedExercises.length > 0" id="workout-plan" ref="planRef" class="selected-exercises">
				<h3>{{ t('builder.planTitle', { count: selectedExercises.length }) }}</h3>
				<div v-for="(exercise, index) in selectedExercises" :key="exercise._id" class="selected-exercise" draggable="true" @dragstart="onDragStart(index)" @dragover.prevent
="onDrop(index)">
					<div class="sel-row">
						<span class="ex-name">{{ exercise.displayName || exercise.name }}</span>
						<input type="text" v-model="exercise.note" :placeholder="t('builder.notePlaceholder')" maxlength="150" />
					</div>
					<div class="sets-editor">
						<div class="set-list">
							<div v-for="(set, sIdx) in exercise.setDetails" :key="sIdx" class="set-row">
								<span class="set-label">#{{ sIdx + 1 }}</span>
								<label class="set-field">
									<span>{{ t('common.reps') }}</span>
									<input type="number" min="1" max="50" :value="set.reps || 10" @input="updateSet(index, sIdx, 'reps', $event.target.value)" />
								</label>
								<label class="set-field">
									<span>kg</span>
									<input type="number" min="0" max="999" step="0.5" :value="set.weight || 0" @input="updateSet(index, sIdx, 'weight', $event.target.value)" />
								</label>
								<button class="remove-set" @click="removeSet(index, sIdx)">×</button>
							</div>
						</div>
					</div>
					<div class="row-actions">
						<button class="remove-btn" @click="removeExercise(index)">×</button>
					</div>
				</div>
				<p v-if="errorMsg" class="error-hint">{{ errorMsg }}</p>
			</div>
		</div>
		<BottomNav />
		<UpgradeModal v-model:show="showUpgradeModal" :limit-type="upgradeLimitType" @close="showUpgradeModal = false" @continue-free="showUpgradeModal = false" />
	</div>
</template>

<style scoped>

/* --- ExercisesView-ähnliches Layout für WorkoutBuilder --- */
.workout-builder {
	min-height: 100vh;
	background: var(--bg);
	color: var(--fg);
	/* Safe-Area oben berücksichtigen (iPhone Notch) */
	padding: calc(20px + var(--safe-top, 0px)) 20px 80px 20px;
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
	background: #374151;
	color: white;
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
	background: var(--card-bg, #fff);
	border-radius: 12px;
	padding: 16px;
	border: 1px solid var(--card-border, #e5e7eb);
	box-shadow: 0 2px 8px rgba(0,0,0,0.04);
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
	background: var(--card-bg, #fff);
	color: var(--fg, #222);
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
	background: #2563EB;
	color: #fff;
	border: none;
	border-radius: 8px;
	padding: 7px 18px;
	font-size: 1rem;
	cursor: pointer;
	font-weight: 600;
	transition: background 0.15s;
}
.close-btn:hover { background: #1D4ED8; }

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
.open-picker-btn { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font-weight: 600; }
.picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-start; z-index: 50; }
.picker-sheet { background: var(--bg); border-radius: 0 0 12px 12px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; border: 1px solid var(--card-border); }
.picker-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
.picker-header h4 { margin: 0; }
.close-picker { background: transparent; border: none; color: var(--fg); font-size: 1.1rem; cursor: pointer; }
.picker-list { padding: 12px 16px; overflow: auto; }
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
	background: #DC2626;
	color: #fff;
	box-shadow: 0 2px 8px rgba(0,0,0,0.08);
	cursor: pointer;
	transition: background 0.18s, transform 0.12s;
	display: block;
	margin: 0 auto;
}
.create-btn:disabled {
	background: #fca5a5;
	color: #fff;
	cursor: not-allowed;
	opacity: 0.7;
}
.create-btn:hover:not(:disabled) {
	background: #B91C1C;
	transform: translateY(-1px) scale(1.03);
}
@media (min-width: 481px) { .mobile-ex-picker, .picker-overlay { display: none; } }
.auth-gate { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.auth-gate-text { color: #fbbf24; margin: 0 0 12px 0; }
.error-hint { margin-top: 8px; color: var(--danger-color); font-size: 0.95rem; }
</style>

