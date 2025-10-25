<template>
  <div class="empty-state">
    <div class="empty-content">
      <div class="icon">{{ icon }}</div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <button v-if="actionText" @click="$emit('action')" class="action-btn">
        {{ actionText }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: {
    type: String,
    default: '📋'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  actionText: {
    type: String,
    default: null
  }
});

defineEmits(['action']);
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 2rem;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

h3 { color: var(--fg); margin-bottom: 0.5rem; font-size: 1.25rem; }

p { color: var(--muted); line-height: 1.5; margin-bottom: 1.5rem; }

.action-btn { background: var(--accent); color: var(--accent-contrast); border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.2s ease; }
.action-btn:hover { transform: translateY(-2px); }
</style>