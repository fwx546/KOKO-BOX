<script setup lang="ts">
import DeviceCard from '../components/DeviceCard.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { devices, syncEvents, runDemoScenario } = useKokoState()

const accents = ['#5fc7a8', '#f8cb64', '#ff9bb5'] as const
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
        <view class="eyebrow">{{ t.hardwarePage.deviceLabel }}</view>
        <view>{{ t.hardwarePage.deviceTitle }}</view>
        <view class="device-list">
          <DeviceCard
            v-for="(device, index) in devices"
            :key="device.deviceId"
            :name="t.hardwarePage.deviceTypes[device.deviceType]"
            :status="device.online ? t.hardwarePage.online : t.hardwarePage.offline"
            :detail="`${device.terminalRole} · ${t.hardwarePage.battery} ${device.battery}% · ${device.lastSyncAt.slice(11, 16)}`"
            :accent="accents[index % accents.length]"
          />
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.hardwarePage.flowLabel }}</view>
        <view>{{ t.hardwarePage.flowTitle }}</view>
        <view class="ordered-list">
          <view v-for="step in t.hardwarePage.steps" :key="step">{{ step }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.hardwarePage.scenarioLabel }}</view>
        <view>{{ t.hardwarePage.scenarioTitle }}</view>
        <view class="action-stack">
          <button class="quick-action-button" @click="runDemoScenario('reminder')">{{ t.hardwarePage.reminder }}</button>
          <button class="quick-action-button" @click="runDemoScenario('taskComplete')">{{ t.hardwarePage.taskComplete }}</button>
          <button class="quick-action-button" @click="runDemoScenario('comfort')">{{ t.hardwarePage.comfort }}</button>
          <button class="quick-action-button" @click="runDemoScenario('offline')">{{ t.hardwarePage.offlineAction }}</button>
          <button class="quick-action-button" @click="runDemoScenario('reconnect')">{{ t.hardwarePage.reconnect }}</button>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.hardwarePage.syncLabel }}</view>
        <view>{{ t.hardwarePage.syncTitle }}</view>
        <view class="log-list">
          <view v-for="event in syncEvents.slice(0, 6)" :key="event.id" class="log-item">
            <view>{{ event.actionType }}</view>
            <view>{{ event.summary }}</view>
            <view>{{ event.status }} · {{ event.timestamp.replace('T', ' ').slice(0, 16) }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
