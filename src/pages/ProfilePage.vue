<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.profile.eyebrow }}</p>
        <h2>{{ t.profile.title }}</h2>
      </div>
      <p>{{ t.profile.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block" v-for="item in t.profile.archiveCards" :key="item.title">
        <p class="eyebrow">{{ item.label }}</p>
        <h3>{{ item.title }}</h3>
        <p>{{ item.description }}</p>
      </section>

      <section class="panel-block panel-block--full">
        <p class="eyebrow">{{ t.profile.milestoneLabel }}</p>
        <h3>{{ t.profile.milestoneTitle }}</h3>
        <div class="archive-grid">
          <article class="archive-item" v-for="entry in t.profile.milestones" :key="entry.title">
            <h4>{{ entry.title }}</h4>
            <p>{{ entry.description }}</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
