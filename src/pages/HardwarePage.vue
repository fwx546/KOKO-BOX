<script setup lang="ts">
import DeviceCard from '../components/DeviceCard.vue'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()

const accents = ['#7ed9b5', '#ffd37a', '#ff9bb5'] as const
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.hardwarePage.eyebrow }}</p>
        <h2>{{ t.hardwarePage.title }}</h2>
      </div>
      <p>{{ t.hardwarePage.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block panel-block--full">
        <p class="eyebrow">{{ t.hardwarePage.statusLabel }}</p>
        <h3>{{ t.hardwarePage.statusTitle }}</h3>
        <div class="device-list">
          <DeviceCard
            v-for="(device, index) in t.hardwarePage.devices"
            :key="device.name"
            :name="device.name"
            :status="device.status"
            :detail="device.detail"
            :accent="accents[index % accents.length]"
          />
        </div>
      </section>

      <section class="panel-block">
        <p class="eyebrow">{{ t.hardwarePage.bindFlowLabel }}</p>
        <h3>{{ t.hardwarePage.bindFlowTitle }}</h3>
        <ol class="ordered-list">
          <li v-for="step in t.hardwarePage.bindSteps" :key="step">{{ step }}</li>
        </ol>
      </section>

      <section class="panel-block">
        <p class="eyebrow">{{ t.hardwarePage.syncLabel }}</p>
        <h3>{{ t.hardwarePage.syncTitle }}</h3>
        <ul class="bullet-list">
          <li v-for="item in t.hardwarePage.syncStates" :key="item">{{ item }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>
