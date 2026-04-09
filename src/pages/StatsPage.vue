<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.statsPage.eyebrow }}</p>
        <h2>{{ t.statsPage.title }}</h2>
      </div>
      <p>{{ t.statsPage.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block" v-for="card in t.statsPage.overviewCards" :key="card.title">
        <p class="eyebrow">{{ card.label }}</p>
        <h3>{{ card.title }}</h3>
        <p>{{ card.value }}</p>
        <small>{{ card.hint }}</small>
      </section>

      <section class="panel-block panel-block--full">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.statsPage.trendLabel }}</p>
            <h3>{{ t.statsPage.trendTitle }}</h3>
          </div>
          <div class="pill-row">
            <button class="quick-action-button" v-for="range in t.statsPage.ranges" :key="range">{{ range }}</button>
          </div>
        </div>
        <div class="chart-placeholder">
          <span>{{ t.statsPage.chartPlaceholder }}</span>
        </div>
      </section>
    </div>
  </div>
</template>
