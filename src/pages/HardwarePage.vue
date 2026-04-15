<script setup lang="ts">
import DeviceCard from '../components/DeviceCard.vue'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()

const accents = ['#7ed9b5', '#ffd37a', '#ff9bb5'] as const
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.hardwarePage.eyebrow }}</view>
        <view>{{ t.hardwarePage.title }}</view>
      </view>
      <view>{{ t.hardwarePage.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.hardwarePage.statusLabel }}</view>
        <view>{{ t.hardwarePage.statusTitle }}</view>
        <view class="device-list">
          <DeviceCard
            v-for="(device, index) in t.hardwarePage.devices"
            :key="device.name"
            :name="device.name"
            :status="device.status"
            :detail="device.detail"
            :accent="accents[index % accents.length]"
          />
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.hardwarePage.bindFlowLabel }}</view>
        <view>{{ t.hardwarePage.bindFlowTitle }}</view>
        <ol class="ordered-list">
          <view v-for="step in t.hardwarePage.bindSteps" :key="step">{{ step }}</view>
        </ol>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.hardwarePage.syncLabel }}</view>
        <view>{{ t.hardwarePage.syncTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.hardwarePage.syncStates" :key="item">{{ item }}</view>
        </view>
      </view>
    </view>
  </view>
</template>
