<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t, language, setLanguage } = useLanguage()
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
        <view class="eyebrow">{{ t.settings.preferenceLabel }}</view>
        <view>{{ t.settings.preferenceTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.settings.preferenceItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.settings.privacyLabel }}</view>
        <view>{{ t.settings.privacyTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.settings.privacyItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.settings.languageLabel }}</view>
        <view>{{ t.settings.languageTitle }}</view>
        <view class="language-switch">
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'zh' }"
            @click="setLanguage('zh')"
          >
            {{ t.app.langChinese }}
          </button>
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'en' }"
            @click="setLanguage('en')"
          >
            {{ t.app.langEnglish }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>
