<template>
  <div class="admin-setup-page">
    <div class="container">
      <h1>🔧 Admin: Datenbank-Setup</h1>
      <p class="info">Dies ist nur für Entwickler/Admin gedacht</p>

      <section class="setup-section">
        <h2>Schritt 1: Übungen aus KI generieren</h2>
        <p>Die KI generiert 45 Push-, 45 Pull- und 45 Leg-Übungen und befüllt die Datenbank.</p>
        
        <button 
          class="btn btn-primary"
          @click="populateWithAI"
          :disabled="loading"
        >
          {{ loading ? 'Generiere Übungen...' : '🤖 Mit KI befüllen (135 Übungen)' }}
        </button>

        <div v-if="aiResult" class="result-box success">
          <h3>✅ Erfolgreich!</h3>
          <p>{{ aiResult.message }}</p>
          <ul>
            <li>Gesamt: {{ aiResult.totalExercises }} Übungen</li>
            <li>Push: {{ aiResult.byCategory.push }}</li>
            <li>Pull: {{ aiResult.byCategory.pull }}</li>
            <li>Legs: {{ aiResult.byCategory.legs }}</li>
          </ul>
        </div>

        <div v-if="error" class="result-box error">
          <h3>❌ Fehler</h3>
          <p>{{ error }}</p>
        </div>

        <p v-if="loading" class="status">⏳ Bitte warten, dies kann 60 Sekunden dauern...</p>
      </section>

      <section class="setup-section">
        <h2>Schritt 2: Datenbank zurücksetzen (ohne KI)</h2>
        <p>Setzt die Datenbank mit statischen Übungen zurück (falls KI nicht verfügbar)</p>
        
        <button 
          class="btn btn-secondary"
          @click="resetDatabase"
          :disabled="loading"
        >
          🔄 Zurücksetzen mit statischen Übungen
        </button>

        <div v-if="resetResult" class="result-box success">
          <h3>✅ Zurückgesetzt!</h3>
          <p>{{ resetResult.message }}</p>
          <ul>
            <li>Gelöscht: {{ resetResult.deletedCount }}</li>
            <li>Hinzugefügt: {{ resetResult.addedCount }}</li>
          </ul>
        </div>
      </section>

      <section class="setup-section">
        <h2>Schritt 3: Test - Hole Übungen</h2>
        <button 
          class="btn btn-info"
          @click="testGetExercises"
        >
          📋 Teste GET /api/exercises
        </button>

        <div v-if="exercisesTest" class="result-box info">
          <h3>✅ Übungen geladen</h3>
          <p>Insgesamt: {{ exercisesTest.count }} Übungen</p>
          <div v-if="exercisesTest.byCategory">
            <p>Nach Kategorie:</p>
            <ul>
              <li v-for="(count, cat) in exercisesTest.byCategory" :key="cat">
                {{ cat }}: {{ count }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="setup-section">
        <h2>Schritt 4: AI-Suggestion testen</h2>
        <button 
          class="btn btn-info"
          @click="testAISuggestion"
        >
          🎯 Teste AI-Suggestion (Push Workout)
        </button>

        <div v-if="suggestionTest" class="result-box info">
          <h3>✅ Suggestion generiert</h3>
          <p><strong>Name:</strong> {{ suggestionTest.workoutName }}</p>
          <p><strong>Übungen:</strong> {{ suggestionTest.exercises?.length || 0 }}</p>
          <ul v-if="suggestionTest.exercises">
            <li v-for="(ex, idx) in suggestionTest.exercises.slice(0, 5)" :key="idx">
              {{ ex.name }} ({{ ex.sets }}x{{ ex.reps }})
            </li>
          </ul>
        </div>
      </section>

      <section class="info-section">
        <h2>ℹ️ Infos</h2>
        <ul>
          <li>Schritt 1 nutzt OpenAI GPT-4 mini und kann bis zu 60 Sekunden dauern</li>
          <li>Schritt 2 ist schnell und offline (statische Übungen)</li>
          <li>Nach Schritt 1 oder 2 sollte der AI Coach funktionieren</li>
          <li>Die Übungen werden mit <code>_id</code> gespeichert für einfache Verknüpfung</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const loading = ref(false)
const error = ref('')
const aiResult = ref(null)
const resetResult = ref(null)
const exercisesTest = ref(null)
const suggestionTest = ref(null)

async function populateWithAI() {
  loading.value = true
  error.value = ''
  aiResult.value = null
  
  try {
    console.log('🤖 Starte KI-Befüllung...')
    const response = await axios.post('/api/workouts/admin/populate-db-with-ai', {}, {
      timeout: 120000 // 2 Minuten Timeout
    })
    aiResult.value = response.data
    console.log('✅ KI-Befüllung erfolgreich:', response.data)
  } catch (err) {
    error.value = `Fehler: ${err.response?.data?.error || err.message}`
    console.error('❌ KI-Befüllung Fehler:', err)
  } finally {
    loading.value = false
  }
}

async function resetDatabase() {
  loading.value = true
  error.value = ''
  resetResult.value = null
  
  try {
    console.log('🔄 Setze Datenbank zurück...')
    const response = await axios.post('/api/exercises/admin/reset-all', {})
    resetResult.value = response.data
    console.log('✅ Zurücksetzen erfolgreich:', response.data)
  } catch (err) {
    error.value = `Fehler: ${err.response?.data?.error || err.message}`
    console.error('❌ Reset Fehler:', err)
  } finally {
    loading.value = false
  }
}

async function testGetExercises() {
  try {
    console.log('📋 Hole Übungen...')
    const response = await axios.get('/api/exercises')
    const exercises = response.data || []
    
    const byCategory = {}
    exercises.forEach(ex => {
      byCategory[ex.category] = (byCategory[ex.category] || 0) + 1
    })
    
    exercisesTest.value = {
      count: exercises.length,
      byCategory
    }
    console.log('✅ Übungen geladen:', exercisesTest.value)
  } catch (err) {
    error.value = `Fehler beim Laden: ${err.message}`
  }
}

async function testAISuggestion() {
  try {
    console.log('🎯 Teste AI-Suggestion...')
    const response = await axios.post('/api/workouts/ai-suggestion', {
      focus: 'push',
      timeAvailable: 45,
      experienceLevel: 'intermediate'
    })
    suggestionTest.value = response.data
    console.log('✅ Suggestion generiert:', response.data)
  } catch (err) {
    error.value = `Fehler bei Suggestion: ${err.message}`
  }
}
</script>

<style scoped>
.admin-setup-page {
  padding: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

h1 {
  color: #333;
  margin-bottom: 10px;
}

.info {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 30px;
}

.setup-section, .info-section {
  margin: 30px 0;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.setup-section h2 {
  margin-top: 0;
  color: #333;
  font-size: 1.2rem;
}

.setup-section p {
  color: #666;
  margin-bottom: 15px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 10px;
}

.btn-primary {
  background: #0074d9;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0060b5;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background: #138496;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-top: 15px;
  color: #ff9800;
  font-weight: 600;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.result-box {
  margin-top: 15px;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid;
}

.result-box h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.result-box ul {
  margin: 10px 0;
  padding-left: 20px;
}

.result-box li {
  margin: 5px 0;
}

.success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.info {
  background: #d1ecf1;
  border-color: #17a2b8;
  color: #0c5460;
}

.info-section {
  background: #e7f3ff;
  border-color: #0074d9;
}

.info-section ul {
  padding-left: 20px;
  color: #333;
}

code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
}
</style>
