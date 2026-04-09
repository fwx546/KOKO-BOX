<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <div class="page-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ t.chatPage.eyebrow }}</p>
        <h2>{{ t.chatPage.title }}</h2>
      </div>
      <p>{{ t.chatPage.subtitle }}</p>
    </header>

    <div class="page-grid-2">
      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.chatPage.modeLabel }}</p>
            <h3>{{ t.chatPage.modeTitle }}</h3>
          </div>
        </div>
        <div class="pill-row">
          <button class="quick-action-button" v-for="mode in t.chatPage.modes" :key="mode">{{ mode }}</button>
        </div>
      </section>

      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.chatPage.emotionLabel }}</p>
            <h3>{{ t.chatPage.emotionTitle }}</h3>
          </div>
        </div>
        <ul class="bullet-list">
          <li v-for="item in t.chatPage.emotionItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.chatPage.memoryLabel }}</p>
            <h3>{{ t.chatPage.memoryTitle }}</h3>
          </div>
        </div>
        <ul class="bullet-list">
          <li v-for="item in t.chatPage.memoryItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="panel-block">
        <div class="section-head section-head--compact">
          <div>
            <p class="eyebrow">{{ t.chatPage.privacyLabel }}</p>
            <h3>{{ t.chatPage.privacyTitle }}</h3>
          </div>
        </div>
        <ul class="bullet-list">
          <li v-for="item in t.chatPage.privacyItems" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="chat-panel panel-block--full">
        <div class="chat-panel__bubble chat-panel__bubble--assistant">
          <strong>{{ t.chatPage.assistantName }}</strong>
          <p>{{ t.chatPage.assistantLine }}</p>
        </div>
        <div class="chat-panel__bubble chat-panel__bubble--user">
          <strong>{{ t.chatPage.userName }}</strong>
          <p>{{ t.chatPage.userLine }}</p>
        </div>
        <div class="chat-panel__input">
          <span>{{ t.chatPage.inputPlaceholder }}</span>
          <button>{{ t.chatPage.send }}</button>
        </div>
      </section>
    </div>
  </div>
</template>
