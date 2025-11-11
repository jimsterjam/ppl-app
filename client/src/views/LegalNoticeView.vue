<template>
  <div class="legal-page">
    <h1>{{ $t('legal.title') }}</h1>
    <p><strong>{{ $t('legal.section1Title') }}</strong></p>
    <p v-html="$t('legal.section1Address').replace(/\n/g, '<br>')"></p>
    <p>{{ $t('legal.section1Mail') }}</p>
    <p><strong>{{ $t('legal.section1ResponsibleTitle') }}</strong><br />
      <span v-html="$t('legal.section1Responsible').replace(/\n/g, '<br>')"></span>
    </p>

    <h2>{{ $t('legal.copyrightTitle') }}</h2>
    <p>{{ $t('legal.copyrightNotice') }}</p>
    <p>{{ $t('legal.copyrightLaw') }}</p>

    <h2>{{ $t('legal.disclaimerTitle') }}</h2>
    <p>{{ $t('legal.disclaimer1') }}</p>
    <p>{{ $t('legal.disclaimer2') }}</p>

    <h2>{{ $t('legal.userHintsTitle') }}</h2>
    <ul>
      <li>{{ $t('legal.userHint1') }}</li>
      <li>{{ $t('legal.userHint2') }}</li>
      <li>{{ $t('legal.userHint3') }}</li>
      <li>{{ $t('legal.userHint4') }}</li>
    </ul>

    <h2>{{ $t('legal.privacyTitle') }}</h2>
    <p><strong>{{ $t('legal.privacy1') }}</strong></p>
    <p v-html="$t('legal.privacy1Text').replace(/\n/g, '<br>')"></p>
    <p><strong>{{ $t('legal.privacy2') }}</strong></p>
    <p>{{ $t('legal.privacy2Text') }}</p>
    <p><strong>{{ $t('legal.privacy3') }}</strong></p>
    <p>{{ $t('legal.privacy3Text') }}</p>
    <p><strong>{{ $t('legal.privacy4') }}</strong></p>
    <p>{{ $t('legal.privacy4Text') }}</p>
    <p><strong>{{ $t('legal.privacy5') }}</strong></p>
    <p>{{ $t('legal.privacy5Text') }}</p>

    <p style="margin-top:2em;font-size:0.9em;color:var(--muted);">
      {{ $t('legal.lastUpdate') }}
    </p>
  </div>
</template>

<script setup>
// keine Logik erforderlich
</script>

<style scoped>
.legal-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 16px;
  background: var(--card-bg);
  border-radius: 16px;
  color: var(--fg);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}
.legal-page h1 {
  font-size: 2rem;
  margin-bottom: 0.5em;
}
.legal-page h2 {
  font-size: 1.2rem;
  margin-top: 2em;
  margin-bottom: 0.5em;
}
.legal-page ul {
  margin: 0 0 1em 1.2em;
}
.legal-page li {
  margin-bottom: 0.5em;
}
</style>
