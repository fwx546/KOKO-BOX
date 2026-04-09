<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.care.eyebrow }}</p>
        <h2>{{ t.care.title }}</h2>
      </div>
      <p>{{ t.care.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.care.dailyCareLabel }}</p>
            <h3>{{ t.care.dailyCareTitle }}</h3>
          </div>
        </div>
        <ul class="bullet-list">
          <li v-for="item in t.care.dailyCareItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.care.growthDressupLabel }}</p>
            <h3>{{ t.care.growthDressupTitle }}</h3>
          </div>
        </div>
        <ul class="bullet-list">
          <li v-for="item in t.care.growthDressupItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block panel-block--full">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.care.lifeArchiveLabel }}</p>
            <h3>{{ t.care.lifeArchiveTitle }}</h3>
          </div>
        </div>
        <div class="archive-grid">
          <article v-for="item in t.care.lifeArchiveItems" :key="item.title" class="archive-item">
            <h4>{{ item.title }}</h4>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
