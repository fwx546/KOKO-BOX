<script setup lang="ts">
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { language, setLanguage } = useLanguage()
const { settings, updateSettings, runDemoScenario } = useKokoState()

const toggle = (key: 'hideChats' | 'allowChatClear' | 'allowCrossDeviceSummary' | 'lowDisturbanceMode' | 'demoMode') => {
  updateSettings({ [key]: !settings.value[key] })
}

const changeLanguage = (next: 'zh' | 'en') => {
  setLanguage(next)
  updateSettings({ language: next })
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.settings.eyebrow }}</view>
        <view>{{ t.settings.title }}</view>
      </view>
      <view>{{ t.settings.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">{{ t.settings.languageLabel }}</view>
        <view>{{ t.settings.languageTitle }}</view>
        <view class="language-switch">
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'zh' }"
            @click="changeLanguage('zh')"
          >
            {{ t.app.langChinese }}
          </button>
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'en' }"
            @click="changeLanguage('en')"
          >
            {{ t.app.langEnglish }}
          </button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.settings.modeLabel }}</view>
        <view>{{ t.settings.modeTitle }}</view>
        <view class="toggle-list">
          <button class="toggle-row" @click="toggle('lowDisturbanceMode')">
            <view>低打扰模式</view>
            <view>{{ settings.lowDisturbanceMode ? '开启' : '关闭' }}</view>
          </button>
          <button class="toggle-row" @click="toggle('demoMode')">
            <view>Demo 模式</view>
            <view>{{ settings.demoMode ? '开启' : '关闭' }}</view>
          </button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.settings.privacyLabel }}</view>
        <view>{{ t.settings.privacyTitle }}</view>
        <view class="toggle-list">
          <button class="toggle-row" @click="toggle('hideChats')">
            <view>隐藏聊天</view>
            <view>{{ settings.hideChats ? '开启' : '关闭' }}</view>
          </button>
          <button class="toggle-row" @click="toggle('allowChatClear')">
            <view>允许清空会话</view>
            <view>{{ settings.allowChatClear ? '开启' : '关闭' }}</view>
          </button>
          <button class="toggle-row" @click="toggle('allowCrossDeviceSummary')">
            <view>显示跨端摘要</view>
            <view>{{ settings.allowCrossDeviceSummary ? '开启' : '关闭' }}</view>
          </button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.settings.demoLabel }}</view>
        <view>{{ t.settings.demoTitle }}</view>
        <view class="action-stack">
          <button class="quick-action-button" @click="runDemoScenario('reminder')">触发提醒</button>
          <button class="quick-action-button" @click="runDemoScenario('comfort')">触发陪伴</button>
          <button class="quick-action-button" @click="runDemoScenario('offline')">模拟离线</button>
          <button class="quick-action-button" @click="runDemoScenario('reconnect')">恢复连接</button>
          <button class="quick-action-button quick-action-button--ghost" @click="runDemoScenario('reset')">重置 Demo 数据</button>
        </view>
      </view>
    </view>
  </view>
</template>
