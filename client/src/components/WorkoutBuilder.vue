<script setup>


// --- State & Stores ---

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const subscriptionStore = useSubscriptionStore()
const toast = useToast()
const { t, locale } = useI18n()
const isLoaded = computed(() => userStore.isLoaded)
const isSignedIn = computed(() => userStore.isSignedIn)
const loadingUser = computed(() => userStore.loading)
const userId = computed(() => userStore.user?.id || userStore.user?._id || 'guest')

const selectedType = ref('push')
const selectedExercises = ref([])
const exercises = ref([])
const loading = ref(false)
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

// --- Draft-Logik ---
function getDraftStorageKey() {
	return `workout_builder_draft_${userId.value}`
}
async function saveDraft() {
	const key = getDraftStorageKey()
	const draft = {
		type: selectedType.value,
		exercises: selectedExercises.value
	}
	sessionStorage.setItem(key, JSON.stringify(draft))
}
async function loadDraft() {
	const key = getDraftStorageKey()
	const raw = sessionStorage.getItem(key)
	if (raw) {
		try {
			const draft = JSON.parse(raw)
			if (draft?.type) selectedType.value = draft.type
			if (Array.isArray(draft?.exercises)) selectedExercises.value = draft.exercises
			return true
		} catch {}
	}
	return false
}
function clearDraft() {
	sessionStorage.removeItem(getDraftStorageKey())
}
async function clearOtherUserDrafts() {
	const myKey = getDraftStorageKey()
	for (let i = 0; i < sessionStorage.length; i++) {
		const key = sessionStorage.key(i)
		if (key && key.startsWith('workout_builder_draft_') && key !== myKey) {
			sessionStorage.removeItem(key)
		}
	}
}

// --- Workout Types ---
const workoutTypes = [
	{ value: 'push', label: t('builder.pushDay') || 'Push Day' },
	{ value: 'pull', label: t('builder.pullDay') || 'Pull Day' },
	{ value: 'legs', label: t('builder.legsDay') || 'Leg Day' }
]
const currentTypeLabel = computed(() => {
	const type = workoutTypes.find(t => t.value === selectedType.value)
	return type ? type.label : ''
})

// --- Responsive ---
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isMobile = computed(() => viewportWidth.value <= 480)
onMounted(() => {
	window.addEventListener('resize', () => { viewportWidth.value = window.innerWidth })
})

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
onMounted(() => {
	clearOtherUserDrafts()
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
	loadDraft()
	loadExercises()
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
		const all = await getAllExercisesOffline({ category: categoryMap[selectedType.value] })
		exercises.value = all
	} catch {
		exercises.value = []
	} finally {
		loading.value = false
	}
}
const filteredExercises = computed(() => {
	const term = search.value.trim().toLowerCase()
	if (!term) return exercises.value
	return exercises.value.filter(e =>
		e.name?.toLowerCase().includes(term) ||
		e.muscleGroup?.toLowerCase().includes(term) ||
		e.equipment?.toLowerCase().includes(term)
	)
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
		const created = await userStore.createWorkout(workoutData)
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
		<div v-else class="type-select">
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
				<div v-if="loading" class="exercises-grid">
					<div v-for="n in 6" :key="n" class="exercise-item sk"></div>
				</div>
				<div v-else-if="!loading && filteredExercises.length === 0" class="empty-state">
					<p>😅 Keine Übungen für diese Kategorie verfügbar</p>
				</div>
				<div v-else class="exercises-grid">
					<div v-for="exercise in filteredExercises" :key="exercise._id" :class="{ selected: isSelected(exercise) }" class="exercise-item" @click="toggleExercise(exercise)">
						<div class="ex-row">
							<span class="title">{{ exercise.name }}</span>
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
									<span class="title">{{ exercise.name }}</span>
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
				<div v-for="(exercise, index) in selectedExercises" :key="exercise._id" class="selected-exercise" draggable="true" @dragstart="onDragStart(index)" @drop.prevent="onDrop(index)">
					<div class="sel-row">
						<span class="ex-name">{{ exercise.name }}</span>
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
.workout-builder { padding: 20px; padding-bottom: 80px; color: var(--fg); background: var(--bg); }
.builder-topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 12px 0 16px 0; background: var(--bg); }
.back-top-btn { padding: 8px 12px; border-radius: 10px; border: 2px solid var(--accent-color); background: transparent; color: var(--fg); cursor: pointer; }
.back-top-btn:hover { background: var(--accent-soft); }
.type-select { display: grid; grid-template-columns: 60px 1fr; align-items: center; gap: 12px; margin-bottom: 16px; }
.type-label { color: var(--muted); font-size: 0.9rem; }
.type-dropdown { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.type-list { display: grid; gap: 8px; }
.type-item { width: 100%; text-align: left; padding: 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); cursor: pointer; }
.type-item[aria-pressed="true"] { border-color: var(--accent-color); background: var(--accent-soft); }
.exercises-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
.search-row { margin: 8px 0 16px; }
.search-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.exercise-item { padding: 16px; background: var(--card-bg); border-radius: 12px; border: 2px solid transparent; cursor: pointer; transition: all 0.2s ease; }
.exercise-item.sk { height: 84px; background: var(--surface); border: 1px solid var(--card-border); }
.exercise-item.selected { border-color: var(--accent-color); background: var(--accent-soft); }
.exercise-item .title { font-weight: bold; }
.exercise-item .sub { color: var(--muted); font-size: 0.85rem; }
.selected-exercises { background: var(--card-bg); border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid var(--card-border); }
.selected-exercise { display: grid; grid-template-columns: 1fr 1fr 36px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--card-border); }
.selected-exercise:last-child { border-bottom: none; }
.row-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.remove-btn { background: var(--danger-color); color: #fff; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: bold; }
.sets-editor { grid-column: 1 / span 2; margin-top: 8px; }
.set-list { display: grid; gap: 6px; }
.set-row { display: grid; grid-template-columns: 36px 1fr 1fr 28px; gap: 8px; align-items: center; }
.set-label { color: var(--muted); font-size: 0.85rem; text-align: center; }
.set-field { display: flex; align-items: center; gap: 6px; }
.set-field span { color: var(--muted); font-size: 0.85rem; }
.set-field input { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); }
.remove-set { background: transparent; border: none; color: var(--danger-color); font-size: 18px; cursor: pointer; }
.sel-row { display: flex; align-items: center; gap: 12px; }
.ex-name { color: var(--fg); font-weight: bold; }
.sticky-cta { position: sticky; bottom: 0; left: 0; right: 0; background: var(--surface); backdrop-filter: blur(6px); padding: 12px 0 8px; }
.mobile-ex-picker { margin: 8px 0 12px; }
.open-picker-btn { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font-weight: 600; }
.picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-start; z-index: 50; }
.picker-sheet { background: var(--bg); border-radius: 0 0 12px 12px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; border: 1px solid var(--card-border); }
.picker-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
.picker-header h4 { margin: 0; }
.close-picker { background: transparent; border: none; color: var(--fg); font-size: 1.1rem; cursor: pointer; }
.picker-list { padding: 12px 16px; overflow: auto; }
.search-row.in-sheet { margin: 12px 16px; }
.picker-actions { padding: 12px 16px 16px; border-top: 1px solid var(--card-border); }
.done-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
@media (min-width: 481px) { .mobile-ex-picker, .picker-overlay { display: none; } }
.auth-gate { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.auth-gate-text { color: #fbbf24; margin: 0 0 12px 0; }
.error-hint { margin-top: 8px; color: var(--danger-color); font-size: 0.95rem; }
</style>
