<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.care.eyebrow }}</view>
        <view>{{ t.care.title }}</view>
      </view>
      <view>{{ t.care.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.care.dailyCareLabel }}</view>
            <view>{{ t.care.dailyCareTitle }}</view>
          </view>
        </view>
        <view class="bullet-list">
          <view v-for="item in t.care.dailyCareItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.care.growthDressupLabel }}</view>
            <view>{{ t.care.growthDressupTitle }}</view>
          </view>
        </view>
        <view class="bullet-list">
          <view v-for="item in t.care.growthDressupItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.care.lifeArchiveLabel }}</view>
            <view>{{ t.care.lifeArchiveTitle }}</view>
          </view>
        </view>
        <view class="archive-grid">
          <view v-for="item in t.care.lifeArchiveItems" :key="item.title" class="archive-item">
            <h4>{{ item.title }}</h4>
            <view>{{ item.description }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
