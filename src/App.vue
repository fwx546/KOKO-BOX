<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusCard from './components/StatusCard.vue'
import ReminderCard from './components/ReminderCard.vue'
import DeviceCard from './components/DeviceCard.vue'

const scenes = [
  {
    id: 'calm',
    title: 'Soft Morning',
    subtitle: 'The pet looks steady and ready for a gentle day.',
    accent: '#7ed9b5',
    glow: 'rgba(126, 217, 181, 0.28)',
    moodLine: 'Everything is calm. A few kind interactions keep the day light.',
  },
  {
    id: 'reset',
    title: 'Tiny Reset',
    subtitle: 'A short pause, a sip of water, and a warm check-in.',
    accent: '#ffd37a',
    glow: 'rgba(255, 211, 122, 0.28)',
    moodLine: 'A short reset helps the pet recover energy and mood.',
  },
  {
    id: 'hug',
    title: 'Need a Hug',
    subtitle: 'The pet wants more warmth, companionship, and care.',
    accent: '#ff9bb5',
    glow: 'rgba(255, 155, 181, 0.28)',
    moodLine: 'A gentle reminder and one soft message can make a difference.',
  },
] as const

const activeScene = ref<(typeof scenes)[number]['id']>('calm')

const baseStats = {
  health: 86,
  mood: 78,
  hunger: 64,
  energy: 72,
  intimacy: 81,
  cleanliness: 90,
}

type StatKey = keyof typeof baseStats

type StatItem = {
  key: StatKey
  label: string
  hint: string
  color: string
  value: number
}

const sceneAdjustments: Record<(typeof activeScene.value), Record<StatKey, number>> = {
  calm: { health: 2, mood: 4, hunger: -1, energy: 3, intimacy: 2, cleanliness: 1 },
  reset: { health: 0, mood: 2, hunger: -6, energy: -4, intimacy: 1, cleanliness: -1 },
  hug: { health: -2, mood: -8, hunger: -3, energy: -7, intimacy: 4, cleanliness: -2 },
}

const reminders = [
  {
    title: 'Water break',
    subtitle: 'A soft nudge after 2 hours of screen time.',
    tone: 'sun',
    badge: 'Gentle',
  },
  {
    title: 'Stretch together',
    subtitle: 'Use a small routine to reduce tension and refill energy.',
    tone: 'mint',
    badge: '5 min',
  },
  {
    title: 'Night check-in',
    subtitle: 'Wrap the day with a calm message and pet status sync.',
    tone: 'peach',
    badge: 'Today',
  },
] as const

const devices = [
  {
    name: 'Mobile App',
    status: 'Online',
    detail: 'Last sync 2 min ago',
    accent: '#7ed9b5',
  },
  {
    name: 'Desktop Pet',
    status: 'Ready',
    detail: 'Mood card mirrored locally',
    accent: '#ffd37a',
  },
  {
    name: 'Hardware Display',
    status: 'Mock state',
    detail: '48 x 48 cozy tile preview',
    accent: '#ff9bb5',
  },
] as const

const statLabels = {
  health: 'Health',
  mood: 'Mood',
  hunger: 'Hunger',
  energy: 'Energy',
  intimacy: 'Intimacy',
  cleanliness: 'Cleanliness',
} as const

const statHints = {
  health: 'Stable and responsive',
  mood: 'Friendly, slightly playful',
  hunger: 'Time for a small snack',
  energy: 'Enough for light interaction',
  intimacy: 'Warm and familiar',
  cleanliness: 'Still looks tidy',
} as const

const statColors = {
  health: 'var(--mint)',
  mood: 'var(--sun)',
  hunger: 'var(--peach)',
  energy: 'var(--sky)',
  intimacy: 'var(--rose)',
  cleanliness: 'var(--lime)',
} as const

const stats = computed<StatItem[]>(() => {
  const adjustment = sceneAdjustments[activeScene.value]
  return Object.entries(baseStats).map(([key, value]) => {
    const statKey = key as StatKey
    const nextValue = Math.min(100, Math.max(0, value + adjustment[statKey]))
    return {
      key: statKey,
      label: statLabels[statKey],
      hint: statHints[statKey],
      color: statColors[statKey],
      value: nextValue,
    }
  })
})

const currentScene = computed(() => scenes.find((scene) => scene.id === activeScene.value) ?? scenes[0])

const growthProgress = computed(() => {
  const moodValue = stats.value.find((item: StatItem) => item.key === 'mood')?.value ?? 0
  const intimacyValue = stats.value.find((item: StatItem) => item.key === 'intimacy')?.value ?? 0
  return Math.round((moodValue + intimacyValue + 70) / 3)
})
</script>

<template>
  <div class="page-shell">
    <span class="page-glow page-glow--left"></span>
    <span class="page-glow page-glow--right"></span>

    <main class="app-card">
      <header class="topbar">
        <div>
          <p class="eyebrow">Koko Box prototype</p>
          <h1>Gentle care, calm presence, and a pet that feels alive.</h1>
        </div>
        <div class="topbar__badge">Local UI only</div>
      </header>

      <section class="scene-strip">
        <button
          v-for="scene in scenes"
          :key="scene.id"
          class="scene-pill"
          :class="{ 'scene-pill--active': scene.id === activeScene }"
          @click="activeScene = scene.id"
        >
          <span class="scene-pill__dot" :style="{ background: scene.accent, boxShadow: `0 0 0 10px ${scene.glow}` }"></span>
          <span>
            <strong>{{ scene.title }}</strong>
            <small>{{ scene.subtitle }}</small>
          </span>
        </button>
      </section>

      <section class="hero-grid">
        <article class="hero-card" :style="{ '--hero-accent': currentScene.accent, '--hero-glow': currentScene.glow }">
          <div class="hero-card__orb hero-card__orb--one"></div>
          <div class="hero-card__orb hero-card__orb--two"></div>
          <div class="pet-figure">
            <div class="pet-figure__ear pet-figure__ear--left"></div>
            <div class="pet-figure__ear pet-figure__ear--right"></div>
            <div class="pet-figure__face">
              <span class="pet-figure__eye"></span>
              <span class="pet-figure__eye"></span>
              <span class="pet-figure__mouth"></span>
            </div>
          </div>
          <div class="hero-copy">
            <p class="eyebrow">Today’s mood</p>
            <h2>{{ currentScene.title }}</h2>
            <p>{{ currentScene.moodLine }}</p>
          </div>
          <div class="hero-actions">
            <button class="primary-action">Say hello</button>
            <button class="secondary-action">Open reminder</button>
          </div>
        </article>

        <aside class="summary-card">
          <p class="eyebrow">Quick status</p>
          <div class="summary-card__metric">
            <span>{{ growthProgress }}%</span>
            <strong>Growth progress</strong>
            <small>Steady care keeps the pet moving forward.</small>
          </div>
          <div class="summary-card__list">
            <div>
              <span>Cross-device sync</span>
              <strong>Simulated</strong>
            </div>
            <div>
              <span>Reminder system</span>
              <strong>Ready for UI</strong>
            </div>
            <div>
              <span>AI chat</span>
              <strong>Preview only</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="content-grid">
        <div class="content-grid__left">
          <div class="section-head">
            <div>
              <p class="eyebrow">Pet attributes</p>
              <h3>Simple status cards for the core care loop.</h3>
            </div>
            <span class="section-head__note">Health, mood, hunger, energy, intimacy, cleanliness</span>
          </div>

          <div class="stats-grid">
            <StatusCard
              v-for="item in stats"
              :key="item.key"
              :label="item.label"
              :value="item.value"
              :hint="item.hint"
              :color="item.color"
            />
          </div>

          <article class="growth-panel">
            <div>
              <p class="eyebrow">Growth & care system</p>
              <h3>Small actions feed into a soft progress arc.</h3>
              <p>
                The UI can show how care, rest, reminders, and companionship gradually shape the pet’s mood.
              </p>
            </div>
            <div class="growth-panel__meter">
              <div class="growth-panel__ring" :style="{ '--ring-progress': growthProgress }">
                <span>{{ growthProgress }}%</span>
              </div>
              <small>Prototype progress</small>
            </div>
          </article>
        </div>

        <div class="content-grid__right">
          <div class="panel-block">
            <div class="section-head section-head--compact">
              <div>
                <p class="eyebrow">Gentle reminders</p>
                <h3>Soft nudges that do not feel intrusive.</h3>
              </div>
            </div>
            <div class="reminder-list">
              <ReminderCard
                v-for="item in reminders"
                :key="item.title"
                :title="item.title"
                :subtitle="item.subtitle"
                :tone="item.tone"
                :badge="item.badge"
              />
            </div>
          </div>

          <div class="panel-block">
            <div class="section-head section-head--compact">
              <div>
                <p class="eyebrow">Hardware display</p>
                <h3>Small-screen preview for the device tile.</h3>
              </div>
            </div>
            <div class="device-list">
              <DeviceCard
                v-for="device in devices"
                :key="device.name"
                :name="device.name"
                :status="device.status"
                :detail="device.detail"
                :accent="device.accent"
              />
            </div>
          </div>

          <article class="chat-panel">
            <div class="section-head section-head--compact">
              <div>
                <p class="eyebrow">Lightweight AI chat</p>
                <h3>Placeholder for a warm, supportive assistant.</h3>
              </div>
            </div>
            <div class="chat-panel__bubble chat-panel__bubble--assistant">
              <strong>Koko</strong>
              <p>Try one short check-in: “How are you feeling right now?”</p>
            </div>
            <div class="chat-panel__bubble chat-panel__bubble--user">
              <strong>You</strong>
              <p>Sometimes I feel tense after a long day.</p>
            </div>
            <div class="chat-panel__input">
              <span>Write a kind message...</span>
              <button>Send</button>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>
