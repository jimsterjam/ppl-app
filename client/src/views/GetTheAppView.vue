<template>
  <div class="funnel">
    <div class="content">
      <h1>Lade die App herunter</h1>
      <p>Diese App ist nur als mobile Anwendung verfügbar.</p>
      <div class="stores">
        <a class="store-btn ios" :href="appStoreUrl" target="_blank" rel="noopener">Zum App Store</a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GetTheAppView',
  computed: {
    appStoreUrl() {
      return import.meta.env.VITE_APPSTORE_URL || 'https://apps.apple.com';
    }
  }
}
</script>

<style scoped>
.funnel { display:flex; min-height:100vh; align-items:center; justify-content:center; background:#0b0d12; color:#fff; }
.content { text-align:center; padding:2rem; max-width:480px; }
h1 { font-size:1.8rem; margin:0.5rem 0 0.75rem; }
p { opacity:0.85; margin-bottom:1.5rem; }
.stores { display:flex; gap:1rem; justify-content:center; }
.store-btn { padding:0.75rem 1rem; border-radius:8px; text-decoration:none; font-weight:600; }
.ios { background:#0a84ff; color:#fff; }
</style>
