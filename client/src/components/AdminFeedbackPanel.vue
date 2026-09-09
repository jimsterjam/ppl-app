<template>
  <div class="admin-feedback-panel">
    <div class="key-row">
      <input
        v-model="adminKey"
        type="password"
        class="key-input"
        placeholder="Admin-Schlüssel"
        autocomplete="off"
        @keyup.enter="load"
      />
      <button class="primary-btn" :disabled="!adminKey || loading" @click="load">
        {{ loading ? 'Lädt…' : 'Laden' }}
      </button>
    </div>

    <div v-if="loaded" class="filter-row">
      <select v-model="categoryFilter" class="filter-select" @change="load">
        <option value="">Alle Kategorien</option>
        <option value="bug">Bug</option>
        <option value="idea">Idee</option>
        <option value="unclear">Unklar</option>
      </select>
      <select v-model="statusFilter" class="filter-select" @change="load">
        <option value="">Alle Status</option>
        <option value="new">Neu</option>
        <option value="reviewed">Gesehen</option>
        <option value="resolved">Erledigt</option>
      </select>
      <button class="outline-btn" :disabled="loading" @click="load">Aktualisieren</button>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="loaded && !loading && !entries.length" class="muted">Keine Einträge gefunden.</p>

    <div v-if="entries.length" class="entry-list">
      <article v-for="entry in entries" :key="entry.id" class="entry">
        <div class="entry-top">
          <span class="badge" :class="`badge-${entry.category}`">{{ categoryLabel(entry.category) }}</span>
          <span class="badge badge-status">{{ statusLabel(entry.status) }}</span>
          <span class="entry-time">{{ formatDateTime(entry.createdAt) }}</span>
        </div>

        <p v-if="entry.text" class="entry-text">{{ entry.text }}</p>
        <p v-else class="entry-text muted">(kein Text)</p>

        <div v-if="entry.context" class="entry-context">
          <span v-if="entry.context.appVersion">App {{ entry.context.appVersion }}</span>
          <span v-if="entry.context.platform"> · {{ entry.context.platform }}</span>
          <span v-if="entry.context.osVersion"> · OS {{ entry.context.osVersion }}</span>
          <span v-if="entry.context.deviceModel"> · {{ entry.context.deviceModel }}</span>
          <span v-if="entry.context.screenContext"> · {{ entry.context.screenContext }}</span>
        </div>

        <div class="entry-user">userId: {{ entry.userId }}</div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { listAppFeedback } from '@/api/feedback'

// Wiederverwendbares Panel für die AppFeedback-Admin-Übersicht (siehe server/routes/feedback.js
// GET / und middleware/adminAuth.js). Eingebettet in SettingsView.vue (nur sichtbar für den
// Account mit der Admin-E-Mail, siehe dort) UND als eigenständige Seite unter /admin/feedback
// (AdminFeedbackView.vue) für den Zugriff aus einem normalen Browser ohne App-Login. Der
// Admin-Schlüssel selbst ist NICHT an den Firebase-Login gekoppelt - Schutz läuft serverseitig
// per statischem Header-Schlüssel, unabhängig davon, wo das Panel angezeigt wird.
const STORAGE_KEY = 'admin_feedback_key'

const adminKey = ref(localStorage.getItem(STORAGE_KEY) || '')
const categoryFilter = ref('')
const statusFilter = ref('')
const entries = ref([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')

function categoryLabel(cat) {
  return { bug: 'Bug', idea: 'Idee', unclear: 'Unklar' }[cat] || cat
}

function statusLabel(status) {
  return { new: 'Neu', reviewed: 'Gesehen', resolved: 'Erledigt' }[status] || status
}

function formatDateTime(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString('de-DE')
  } catch {
    return ''
  }
}

async function load() {
  if (!adminKey.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    localStorage.setItem(STORAGE_KEY, adminKey.value)
    entries.value = await listAppFeedback(adminKey.value, {
      category: categoryFilter.value,
      status: statusFilter.value,
      limit: 100
    })
    loaded.value = true
  } catch (e) {
    error.value = e?.message || 'Laden fehlgeschlagen.'
  } finally {
    loading.value = false
  }
}

if (adminKey.value) {
  load()
}
</script>

<style scoped>
.key-row {
  display: flex;
  gap: 10px;
  margin: 12px 0 16px;
}

.key-input {
  flex: 1;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
}

.primary-btn {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.filter-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-select {
  min-height: 40px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
}

.outline-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}

.error-text {
  color: color-mix(in srgb, var(--danger) 70%, var(--fg));
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
}

.entry-list {
  display: grid;
  gap: 12px;
}

.entry {
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.entry-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-elevated));
  color: var(--fg);
}

.badge-status {
  background: color-mix(in srgb, var(--muted) 20%, var(--bg-elevated));
}

.entry-time {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--muted);
}

.entry-text {
  margin: 0 0 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.entry-context {
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 6px;
}

.entry-user {
  font-size: 0.75rem;
  color: var(--muted);
  word-break: break-all;
}
</style>
