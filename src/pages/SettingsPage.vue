<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
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
        <view>English only for now</view>
        <view class="bullet-list">
          <view>Full language switching will be added in a later iteration.</view>
        </view>
      </view>
    </view>
  </view>
</template>
