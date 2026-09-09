<template>
  <div class="admin-feedback">
    <main class="content">
      <section class="glass admin-card">
        <h1 class="admin-title">App-Feedback (Admin)</h1>
        <p class="muted">
          Interne Übersicht über gemeldetes Feedback (Bug/Idee/Unklar). Geschützt per Admin-Schlüssel,
          nicht Teil der normalen App-Navigation.
        </p>
        <AdminFeedbackPanel />
      </section>
    </main>
  </div>
</template>

<script setup>
import AdminFeedbackPanel from '@/components/AdminFeedbackPanel.vue'

// Eigenständige Seite unter /admin/feedback - für den Zugriff aus einem normalen Web-Browser
// ohne App-Login (z.B. vom Laptop aus). Der Panel-Inhalt selbst steckt in
// AdminFeedbackPanel.vue, das zusätzlich (nur für den Admin-Account sichtbar) direkt in
// SettingsView.vue eingebettet ist.
</script>

<style scoped>
.admin-feedback {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 40px;
}

.content {
  padding: 24px clamp(16px, 4vw, 48px);
  display: flex;
  justify-content: center;
}

.admin-card {
  width: 100%;
  max-width: 860px;
  padding: clamp(18px, 3vw, 26px);
}

.admin-title {
  margin: 0 0 6px;
  font-size: 1.3rem;
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
