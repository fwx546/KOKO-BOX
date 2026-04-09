<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t, language, setLanguage } = useLanguage()
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.settings.eyebrow }}</p>
        <h2>{{ t.settings.title }}</h2>
      </div>
      <p>{{ t.settings.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block">
        <p class="eyebrow">{{ t.settings.preferenceLabel }}</p>
        <h3>{{ t.settings.preferenceTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.settings.preferenceItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <p class="eyebrow">{{ t.settings.privacyLabel }}</p>
        <h3>{{ t.settings.privacyTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.settings.privacyItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block panel-block--full">
        <p class="eyebrow">{{ t.settings.languageLabel }}</p>
        <h3>{{ t.settings.languageTitle }}</h3>
        <div class="language-switch" role="group" :aria-label="t.settings.languageLabel">
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'zh' }"
            type="button"
            @click="setLanguage('zh')"
          >
            {{ t.app.langChinese }}
          </button>
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'en' }"
            type="button"
            @click="setLanguage('en')"
          >
            {{ t.app.langEnglish }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
