<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.planner.eyebrow }}</p>
        <h2>{{ t.planner.title }}</h2>
      </div>
      <p>{{ t.planner.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block">
        <p class="eyebrow">{{ t.planner.createLabel }}</p>
        <h3>{{ t.planner.createTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.planner.createItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <p class="eyebrow">{{ t.planner.categoryLabel }}</p>
        <h3>{{ t.planner.categoryTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.planner.categoryItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <p class="eyebrow">{{ t.planner.petReminderLabel }}</p>
        <h3>{{ t.planner.petReminderTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.planner.petReminderItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <p class="eyebrow">{{ t.planner.rewardLabel }}</p>
        <h3>{{ t.planner.rewardTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.planner.rewardItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block panel-block--full">
        <p class="eyebrow">{{ t.planner.unfinishedLabel }}</p>
        <h3>{{ t.planner.unfinishedTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.planner.unfinishedItems" :key="item">{{ item }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>
