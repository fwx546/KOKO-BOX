<script setup lang="ts">
import DeviceCard from '../components/DeviceCard.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { devices, syncEvents, runDemoScenario } = useKokoState()

const accents = ['#5fc7a8', '#f8cb64', '#ff9bb5'] as const
const deviceTypeLabel = {
  miniapp: '小程序',
  desktop: '桌宠',
  m5: '硬件',
}
const bindSteps = [
  '小程序建立宠物主状态。',
  '桌宠和 M5 作为展示终端读取同步日志。',
  '离线时保留缓存，恢复后补同步。',
  '演示场景可通过这里一键触发。',
]
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
            :name="deviceTypeLabel[device.deviceType]"
            :status="device.online ? '在线' : '离线'"
            :detail="`${device.terminalRole} · 电量 ${device.battery}% · ${device.lastSyncAt.slice(11, 16)}`"
            :accent="accents[index % accents.length]"
          />
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.hardwarePage.flowLabel }}</view>
        <view>{{ t.hardwarePage.flowTitle }}</view>
        <view class="ordered-list">
          <view v-for="step in bindSteps" :key="step">{{ step }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.hardwarePage.scenarioLabel }}</view>
        <view>{{ t.hardwarePage.scenarioTitle }}</view>
        <view class="action-stack">
          <button class="quick-action-button" @click="runDemoScenario('reminder')">触发到点提醒</button>
          <button class="quick-action-button" @click="runDemoScenario('taskComplete')">完成一项任务</button>
          <button class="quick-action-button" @click="runDemoScenario('comfort')">触发陪伴聊天</button>
          <button class="quick-action-button" @click="runDemoScenario('offline')">模拟硬件离线</button>
          <button class="quick-action-button" @click="runDemoScenario('reconnect')">模拟恢复连接</button>
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
