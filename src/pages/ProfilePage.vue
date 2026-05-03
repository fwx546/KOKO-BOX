<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

type ProfileSheet = 'rename' | 'petAttributes' | 'about' | 'privacy' | 'avatar'
type PrivacySettingKey = 'hideChats' | 'allowChatClear' | 'allowCrossDeviceSummary' | 'lowDisturbanceMode' | 'demoMode'
type AvatarChooseEvent = { detail?: { avatarUrl?: string; errMsg?: string } }
type UniPickerError = { errMsg?: string }
type UniChooseMedia = (options: {
  count: number
  mediaType: string[]
  sourceType: string[]
  sizeType: string[]
  success: (result: { tempFiles?: Array<{ tempFilePath?: string; path?: string }> }) => void
  fail: (error: UniPickerError) => void
}) => void

const { user, pet: authPet, authMode, isGuestSession, loading, error: authError, importWechatProfile, login, syncUserProfile } = useAuth()
const {
  pet,
  archive,
  metrics,
  settings,
  weeklyCompletionRate,
  syncPetFromAuth,
  syncCourseScheduleFromCloud,
  syncTasksFromCloud,
  syncEconomyFromCloud,
  persistEconomyToCloud,
  updateSettings,
} = useKokoState()
const { t } = useLanguage()

const avatarLoadFailed = ref(false)
const activeSheet = ref<ProfileSheet | null>(null)
const renameInput = ref(pet.value.name)
const renameSaving = ref(false)
const avatarSaving = ref(false)
const displayName = computed(() => user.value?.nickName || (isGuestSession.value ? t.value.profile.guest : t.value.profile.kokoFriend))
const accountModeLabel = computed(() => (isGuestSession.value ? t.value.profile.guestMode : t.value.profile.wechatAccount))
const profileInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'K')
const accountHint = computed(() => (isGuestSession.value ? t.value.profile.guestHint : t.value.profile.accountHint))
const petStageLabel = computed(() => t.value.profile.stages[pet.value.stage] ?? pet.value.stage)
const shouldShowAvatarImage = computed(() => Boolean(user.value?.avatarUrl && !avatarLoadFailed.value))
const isZh = computed(() => settings.value.language === 'zh')

const profileCopy = computed(() => ({
  petManagement: t.value.profile.petManagement,
  renamePet: t.value.profile.renamePet,
  renamePetHint: t.value.profile.renamePetHint,
  viewAttributes: t.value.profile.viewAttributes,
  viewAttributesHint: t.value.profile.viewAttributesHint,
  growthRecords: t.value.profile.growthRecords,
  achievements: t.value.profile.achievements,
  achievementsHint: t.value.profile.achievementsHint.replace('{count}', String(archive.value.milestones.length)),
  stats: t.value.profile.stats,
  statsHint: t.value.profile.statsHint
    .replace('{interactions}', String(metrics.value.interactions))
    .replace('{completed}', String(metrics.value.completedTasks)),
  preferences: t.value.profile.preferences,
  settings: t.value.profile.basicSettings,
  settingsHint: t.value.profile.basicSettingsHint,
  privacy: t.value.profile.privacy,
  privacyHint: t.value.profile.privacyHint,
  about: t.value.profile.about,
  aboutHint: t.value.profile.aboutHint,
  feedback: t.value.profile.feedbackTitle,
  renameTitle: t.value.profile.renameTitle,
  renamePlaceholder: t.value.profile.renamePlaceholder,
  renameHint: t.value.profile.renameHint,
  save: t.value.profile.save,
  saving: t.value.profile.saving,
  avatarTitle: t.value.profile.avatarTitle,
  avatarWechat: t.value.profile.avatarWechat,
  avatarAlbum: t.value.profile.avatarAlbum,
  avatarCancel: t.value.profile.avatarCancel,
  avatarSyncHint: t.value.profile.avatarSyncHint,
  petAttributeTitle: t.value.profile.petAttributeTitle,
  aboutTitle: t.value.profile.aboutTitle,
  aboutBody: t.value.profile.aboutBody,
  privacyTitle: t.value.profile.privacyTitle,
  close: t.value.profile.close,
}))

const privacyOptions = computed<Array<{ key: PrivacySettingKey; title: string; hint: string; value: boolean }>>(() => [
  {
    key: 'hideChats',
    title: t.value.profile.privacyOptions.hideChats.title,
    hint: t.value.profile.privacyOptions.hideChats.hint,
    value: settings.value.hideChats,
  },
  {
    key: 'allowChatClear',
    title: t.value.profile.privacyOptions.allowChatClear.title,
    hint: t.value.profile.privacyOptions.allowChatClear.hint,
    value: settings.value.allowChatClear,
  },
  {
    key: 'allowCrossDeviceSummary',
    title: t.value.profile.privacyOptions.allowCrossDeviceSummary.title,
    hint: t.value.profile.privacyOptions.allowCrossDeviceSummary.hint,
    value: settings.value.allowCrossDeviceSummary,
  },
  {
    key: 'lowDisturbanceMode',
    title: t.value.profile.privacyOptions.lowDisturbanceMode.title,
    hint: t.value.profile.privacyOptions.lowDisturbanceMode.hint,
    value: settings.value.lowDisturbanceMode,
  },
  {
    key: 'demoMode',
    title: t.value.profile.privacyOptions.demoMode.title,
    hint: t.value.profile.privacyOptions.demoMode.hint,
    value: settings.value.demoMode,
  },
])

const petAttributes = computed(() => [
  { label: t.value.profile.attributes.mood, value: pet.value.mood, tone: 'mood' },
  { label: t.value.profile.attributes.bond, value: pet.value.intimacy, tone: 'bond' },
  { label: t.value.profile.attributes.health, value: pet.value.health, tone: 'health' },
  { label: t.value.profile.attributes.hunger, value: pet.value.hunger, tone: 'hunger' },
  { label: t.value.profile.attributes.energy, value: pet.value.energy, tone: 'energy' },
  { label: t.value.profile.attributes.clean, value: pet.value.clean, tone: 'clean' },
])

const openSettings = () => {
  activeSheet.value = null
  uni.navigateTo({
    url: '/pages/settings/index',
  })
}

const openFeedback = () => {
  uni.navigateTo({
    url: '/pages/feedback/index',
  })
}

const openArchive = () => {
  uni.navigateTo({
    url: '/pages/archive/index',
  })
}

const openStats = () => {
  uni.navigateTo({
    url: '/pages/stats/index',
  })
}

const openSheet = (sheet: ProfileSheet) => {
  activeSheet.value = sheet
}

const openRenameSheet = () => {
  renameInput.value = pet.value.name
  openSheet('rename')
}

const openAvatarSheet = () => {
  openSheet('avatar')
}

const closeSheet = () => {
  activeSheet.value = null
}

const openPrivacySettings = () => {
  activeSheet.value = 'privacy'
}

const togglePrivacySetting = (key: PrivacySettingKey) => {
  updateSettings({
    [key]: !settings.value[key],
  })
}

const renamePet = async () => {
  const nextName = renameInput.value.trim()
  if (!nextName) {
    uni.showToast({ title: t.value.settings.emptyPetName, icon: 'none' })
    return
  }
  if (nextName.length > 12) {
    uni.showToast({ title: t.value.settings.petNameTooLong, icon: 'none' })
    return
  }
  if (nextName === pet.value.name && nextName === authPet.value?.name) {
    uni.showToast({ title: t.value.settings.nameUnchanged, icon: 'none' })
    return
  }

  renameSaving.value = true
  try {
    if (isGuestSession.value) {
      await syncUserProfile({ petName: nextName })
      syncPetFromAuth({
        ...(authPet.value ?? {}),
        name: nextName,
      })
    } else {
      await syncUserProfile({ petName: nextName })
      syncPetFromAuth({
        ...(authPet.value ?? {}),
        name: nextName,
      })
      await persistEconomyToCloud()
    }
    renameInput.value = nextName
    uni.showToast({ title: t.value.settings.nameUpdated, icon: 'success' })
    closeSheet()
  } finally {
    renameSaving.value = false
  }
}

const profileGroups = computed(() => [
  {
    title: profileCopy.value.petManagement,
    items: [
      { key: 'rename', icon: '✎', title: profileCopy.value.renamePet, hint: profileCopy.value.renamePetHint, action: openRenameSheet },
      { key: 'attributes', icon: '◈', title: profileCopy.value.viewAttributes, hint: profileCopy.value.viewAttributesHint, action: () => openSheet('petAttributes') },
    ],
  },
  {
    title: profileCopy.value.growthRecords,
    items: [
      { key: 'achievements', icon: '★', title: profileCopy.value.achievements, hint: profileCopy.value.achievementsHint, action: openArchive },
      { key: 'stats', icon: '▥', title: profileCopy.value.stats, hint: profileCopy.value.statsHint, action: openStats },
    ],
  },
  {
    title: profileCopy.value.preferences,
    items: [
      { key: 'settings', icon: '⚙', title: profileCopy.value.settings, hint: profileCopy.value.settingsHint, action: openSettings },
      { key: 'privacy', icon: '🔒', title: profileCopy.value.privacy, hint: profileCopy.value.privacyHint, action: openPrivacySettings },
      { key: 'about', icon: 'ⓘ', title: profileCopy.value.about, hint: profileCopy.value.aboutHint, action: () => openSheet('about') },
      { key: 'feedback', icon: '✉', title: profileCopy.value.feedback, hint: t.value.profile.feedbackHint, action: openFeedback },
    ],
  },
])

const getPickerErrorText = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg
    return typeof errMsg === 'string' ? errMsg : ''
  }

  return ''
}

const isAvatarCancelError = (error: unknown) => {
  const message = getPickerErrorText(error).toLowerCase()
  return message.includes('cancel') || message.includes('canceled') || message.includes('用户取消')
}

const buildAvatarFailureMessage = (error: unknown) => {
  const rawMessage = getPickerErrorText(error).trim()

  if (!rawMessage) {
    return isZh.value ? '没有收到头像文件，请重新选择一次。' : 'No avatar file was returned. Please choose again.'
  }

  const lowerMessage = rawMessage.toLowerCase()

  if (lowerMessage.includes('auth deny') || lowerMessage.includes('permission') || lowerMessage.includes('authorize') || rawMessage.includes('权限')) {
    return isZh.value
      ? `没有获得相册或头像权限，请在微信权限设置里允许后再试。原因：${rawMessage}`
      : `Koko Box does not have album or avatar permission yet. Please allow it in WeChat settings and try again. Reason: ${rawMessage}`
  }

  if (lowerMessage.includes('cloud upload') || lowerMessage.includes('uploadfile') || lowerMessage.includes('upload file')) {
    return isZh.value
      ? `头像文件上传到云端失败，请检查网络和微信云开发配置。原因：${rawMessage}`
      : `The avatar file could not be uploaded to cloud storage. Please check the network and WeChat cloud setup. Reason: ${rawMessage}`
  }

  if (lowerMessage.includes('chooseavatar') || lowerMessage.includes('avatar') || rawMessage.includes('头像')) {
    return isZh.value
      ? `微信头像没有返回可用文件，请重新点一次“使用微信头像”。原因：${rawMessage}`
      : `WeChat did not return a usable avatar file. Please tap "Use WeChat avatar" again. Reason: ${rawMessage}`
  }

  return isZh.value ? `头像保存失败。原因：${rawMessage}` : `Avatar save failed. Reason: ${rawMessage}`
}

const showAvatarFailure = (error: unknown) => {
  if (isAvatarCancelError(error)) {
    return
  }

  uni.showModal({
    title: t.value.profile.avatarFailed,
    content: buildAvatarFailureMessage(error),
    showCancel: false,
    confirmText: isZh.value ? '知道了' : 'OK',
  })
}

const chooseAvatarWithChooseImage = () =>
  new Promise<string>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (result) => {
        const avatarFilePath = result.tempFilePaths?.[0]
        if (avatarFilePath) {
          resolve(avatarFilePath)
          return
        }

        reject(new Error('chooseImage returned no tempFilePaths.'))
      },
      fail: reject,
    })
  })

const chooseAvatarWithChooseMedia = () =>
  new Promise<string>((resolve, reject) => {
    const chooseMedia = (uni as unknown as { chooseMedia?: UniChooseMedia }).chooseMedia

    if (!chooseMedia) {
      reject(new Error('chooseMedia is not available.'))
      return
    }

    chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (result) => {
        const avatarFilePath = result.tempFiles?.[0]?.tempFilePath || result.tempFiles?.[0]?.path
        if (avatarFilePath) {
          resolve(avatarFilePath)
          return
        }

        reject(new Error('chooseMedia returned no tempFiles.'))
      },
      fail: reject,
    })
  })
const chooseAlbumAvatarPath = async () => {
  const chooseMedia = (uni as unknown as { chooseMedia?: UniChooseMedia }).chooseMedia

  if (!chooseMedia) {
    return chooseAvatarWithChooseImage()
  }

  try {
    return await chooseAvatarWithChooseMedia()
  } catch (error) {
    const message = getPickerErrorText(error).toLowerCase()

    if (isAvatarCancelError(error)) {
      throw error
    }

    if (message.includes('not available') || message.includes('not support') || message.includes('undefined')) {
      return chooseAvatarWithChooseImage()
    }

    throw error
  }
}

const saveAvatarFromPath = async (avatarFilePath: string) => {
  if (avatarSaving.value) {
    return
  }

  if (!avatarFilePath.trim()) {
    showAvatarFailure(new Error('Avatar file path is empty.'))
    return
  }

  avatarSaving.value = true

  try {
    await importWechatProfile({
      nickName: user.value?.nickName,
      avatarFilePath,
    })
    avatarLoadFailed.value = false
    closeSheet()

    if (authError.value) {
      uni.showModal({
        title: isZh.value ? '头像已暂存' : 'Avatar saved locally',
        content: isZh.value
          ? `头像已先显示在本机，但云端同步返回提示：${authError.value}`
          : `The avatar is shown on this device, but cloud sync returned: ${authError.value}`,
        showCancel: false,
        confirmText: isZh.value ? '知道了' : 'OK',
      })
      return
    }

    uni.showToast({
      title: isZh.value ? '头像已保存' : 'Avatar saved',
      icon: 'success',
    })
  } catch (error) {
    showAvatarFailure(error)
  } finally {
    avatarSaving.value = false
  }
}

const chooseCustomAvatar = async () => {
  try {
    const avatarFilePath = await chooseAlbumAvatarPath()
    await saveAvatarFromPath(avatarFilePath)
  } catch (error) {
    showAvatarFailure(error)
  }
}

const handleChooseAvatar = async (event: AvatarChooseEvent) => {
  const avatarFilePath = event.detail?.avatarUrl

  if (!avatarFilePath) {
    showAvatarFailure(new Error(event.detail?.errMsg || 'chooseAvatar returned no avatarUrl.'))
    return
  }

  await saveAvatarFromPath(avatarFilePath)
}

const handleAvatarError = (event: { detail?: { errMsg?: string } }) => {
  avatarLoadFailed.value = true
  console.warn('[ProfilePage] avatar image load failed:', event?.detail?.errMsg ?? user.value?.avatarUrl)
}

watch(
  () => user.value?.avatarUrl,
  () => {
    avatarLoadFailed.value = false
  },
)

watch(
  () => authPet.value,
  (value) => {
    syncPetFromAuth(value ?? undefined)
  },
  { immediate: true },
)

onMounted(async () => {
  const result = await login(authMode.value ?? 'wechat')
  syncPetFromAuth(result.pet)
  if (authMode.value !== 'guest') {
    await syncTasksFromCloud()
    await syncEconomyFromCloud()
    await syncCourseScheduleFromCloud()
  }
})
</script>

<template>
  <view class="profile-page">
    <view class="profile-hero">
      <view class="profile-hero__top">
        <button
          v-if="shouldShowAvatarImage"
          class="profile-avatar profile-avatar--button"
          @click="openAvatarSheet"
        >
          <image
            class="profile-avatar__image"
            :src="user?.avatarUrl"
            mode="aspectFill"
            @error="handleAvatarError"
          />
        </button>
        <button
          v-else
          class="profile-avatar profile-avatar--button profile-avatar--empty"
          @click="openAvatarSheet"
        >
          <view class="profile-avatar__fallback">
            <view class="profile-avatar__sync-icon">+</view>
            <view class="profile-avatar__sync-text">{{ profileCopy.avatarSyncHint }}</view>
          </view>
        </button>
        <view class="profile-hero__main">
          <view class="profile-hero__eyebrow">{{ t.profile.eyebrow }}</view>
          <view class="profile-hero__name">{{ displayName }}</view>
          <view class="profile-hero__meta">{{ accountModeLabel }}</view>
        </view>

        <view class="profile-mode-pill">{{ isGuestSession ? t.profile.guestBadge : t.profile.wechatBadge }}</view>
      </view>

      <view class="profile-pet-pill">{{ t.profile.pet }}: {{ pet.name }} · {{ petStageLabel }}</view>
      <view class="profile-hero__hint">{{ accountHint }}</view>
    </view>

    <view class="profile-stats">
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">{{ t.profile.mood }}</view>
        <view class="profile-stat-item__value">{{ pet.mood }}</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--mood" :style="{ width: `${pet.mood}%` }" /></view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">{{ t.profile.intimacy }}</view>
        <view class="profile-stat-item__value">{{ pet.intimacy }}</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--bond" :style="{ width: `${pet.intimacy}%` }" /></view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">{{ t.profile.weeklyCompletion }}</view>
        <view class="profile-stat-item__value">{{ weeklyCompletionRate }}%</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--done" :style="{ width: `${weeklyCompletionRate}%` }" /></view>
      </view>
    </view>

    <view class="profile-summary">
      <view class="profile-summary__title">{{ pet.name }} {{ t.profile.currentStatus }}</view>
      <view class="profile-summary__copy">{{ t.profile.stageCopy.replace('{stage}', petStageLabel) }}</view>
    </view>

    <view class="profile-menu">
      <view v-for="group in profileGroups" :key="group.title" class="profile-menu-group">
        <view class="profile-menu-group__title">{{ group.title }}</view>
        <button
          v-for="item in group.items"
          :key="item.key"
          class="profile-menu-item"
          hover-class="profile-menu-item--pressed"
          :disabled="loading && item.key === 'settings'"
          @click="item.action"
        >
          <view class="profile-menu-item__icon">{{ item.icon }}</view>
          <view class="profile-menu-item__main">
            <view class="profile-menu-item__title">{{ item.title }}</view>
            <view class="profile-menu-item__hint">{{ item.hint }}</view>
          </view>
          <view class="profile-menu-item__arrow">›</view>
        </button>
      </view>
    </view>

    <view v-if="activeSheet" class="profile-sheet-layer" @click="closeSheet">
      <view class="profile-sheet" @click.stop>
        <button class="profile-sheet__close" @click="closeSheet">×</button>

        <template v-if="activeSheet === 'rename'">
          <view class="profile-sheet__title">{{ profileCopy.renameTitle }}</view>
          <input
            v-model="renameInput"
            class="profile-sheet__input"
            maxlength="12"
            :placeholder="profileCopy.renamePlaceholder"
            adjust-position
            :cursor-spacing="120"
          />
          <view class="profile-sheet__body">{{ profileCopy.renameHint }}</view>
          <button class="profile-sheet__primary" :disabled="renameSaving" @click="renamePet">
            {{ renameSaving ? profileCopy.saving : profileCopy.save }}
          </button>
        </template>

        <template v-else-if="activeSheet === 'avatar'">
          <view class="profile-sheet__title">{{ profileCopy.avatarTitle }}</view>
          <button class="profile-sheet__primary" open-type="chooseAvatar" :disabled="avatarSaving" @chooseavatar="handleChooseAvatar">
            {{ avatarSaving ? profileCopy.saving : profileCopy.avatarWechat }}
          </button>
          <button class="profile-sheet__ghost" :disabled="avatarSaving" @click="chooseCustomAvatar">
            {{ avatarSaving ? profileCopy.saving : profileCopy.avatarAlbum }}
          </button>
          <button class="profile-sheet__text" @click="closeSheet">
            {{ profileCopy.avatarCancel }}
          </button>
        </template>

        <template v-else-if="activeSheet === 'petAttributes'">
          <view class="profile-sheet__title">{{ profileCopy.petAttributeTitle }}</view>
          <view class="profile-attribute-grid">
            <view v-for="item in petAttributes" :key="item.label" class="profile-attribute-card">
              <view class="profile-attribute-card__label">{{ item.label }}</view>
              <view class="profile-attribute-card__value">{{ item.value }}</view>
              <view class="profile-attribute-card__track">
                <view class="profile-attribute-card__fill" :class="`profile-attribute-card__fill--${item.tone}`" :style="{ width: `${item.value}%` }" />
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="activeSheet === 'about'">
          <view class="profile-sheet__title">{{ profileCopy.aboutTitle }}</view>
          <view class="profile-sheet__body">{{ profileCopy.aboutBody }}</view>
        </template>

        <template v-else>
          <view class="profile-sheet__title">{{ profileCopy.privacyTitle }}</view>
          <view class="profile-privacy-list">
            <button
              v-for="item in privacyOptions"
              :key="item.key"
              class="profile-privacy-item"
              :class="{ 'profile-privacy-item--on': item.value }"
              @click="togglePrivacySetting(item.key)"
            >
              <view>
                <view class="profile-privacy-item__title">{{ item.title }}</view>
                <view class="profile-privacy-item__hint">{{ item.hint }}</view>
              </view>
              <view class="profile-privacy-item__switch"><view /></view>
            </button>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<style scoped>
.profile-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-height: 100%;
  padding: 24rpx;
}

.profile-hero {
  background:
    linear-gradient(155deg, rgba(255, 255, 255, 0.96), rgba(255, 248, 236, 0.94)),
    #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 30rpx;
  box-shadow: 0 16rpx 34rpx rgba(167, 124, 72, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 22rpx;
}

.profile-hero__top {
  align-items: center;
  display: flex;
  gap: 16rpx;
}

.profile-avatar {
  background: linear-gradient(160deg, #ffe39a, #ffc9b6);
  border-radius: 24rpx;
  height: 108rpx;
  overflow: hidden;
  position: relative;
  width: 108rpx;
}

.profile-avatar--button {
  margin: 0;
  padding: 0;
}

.profile-avatar--button::after {
  border: 0;
}

.profile-avatar--empty {
  background: linear-gradient(160deg, #fff0ca, #e8f7ef);
}

.profile-avatar__image,
.profile-avatar__fallback {
  height: 100%;
  width: 100%;
}

.profile-avatar__fallback {
  align-items: center;
  color: #6d5542;
  display: flex;
  flex-direction: column;
  font-size: 42rpx;
  font-weight: 800;
  justify-content: center;
}

.profile-avatar__sync-icon {
  align-items: center;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  color: #365f56;
  display: flex;
  font-size: 38rpx;
  height: 48rpx;
  justify-content: center;
  line-height: 1;
  width: 48rpx;
}

.profile-avatar__sync-text {
  color: #5f8c78;
  font-size: 16rpx;
  font-weight: 800;
  line-height: 1.12;
  margin-top: 6rpx;
  max-width: 92rpx;
  text-align: center;
}

.profile-hero__main {
  flex: 1;
  min-width: 0;
}

.profile-mode-pill {
  background: #e8f7ef;
  border-radius: 999rpx;
  color: #365f56;
  font-size: 20rpx;
  font-weight: 700;
  padding: 8rpx 16rpx;
}

.profile-hero__eyebrow {
  color: #8a7a68;
  font-size: 22rpx;
  font-weight: 700;
}

.profile-hero__name {
  color: #253047;
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1.16;
}

.profile-hero__meta {
  color: #5f8c78;
  font-size: 30rpx;
  font-weight: 600;
}

.profile-pet-pill {
  align-self: flex-start;
  background: #fff0ca;
  border-radius: 999rpx;
  color: #7d644f;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
}

.profile-hero__hint {
  color: #8a7a68;
  font-size: 23rpx;
}

.profile-stats {
  display: grid;
  gap: 10rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-stat-item,
.profile-summary,
.profile-settings-entry {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 22rpx;
  box-shadow: 0 12rpx 26rpx rgba(167, 124, 72, 0.08);
}

.profile-stat-item {
  padding: 16rpx;
}

.profile-stat-item__label,
.profile-summary__copy,
.profile-settings-entry__hint {
  color: #8a7a68;
}

.profile-stat-item__label {
  font-size: 22rpx;
}

.profile-stat-item__value {
  color: #253047;
  font-size: 34rpx;
  font-weight: 700;
  margin-top: 8rpx;
}

.profile-stat-item__bar {
  background: rgba(228, 213, 194, 0.64);
  border-radius: 999rpx;
  height: 10rpx;
  margin-top: 10rpx;
  overflow: hidden;
}

.profile-stat-item__fill {
  border-radius: inherit;
  height: 100%;
}

.profile-stat-item__fill--mood {
  background: linear-gradient(90deg, #f8cb64, #f0b94a);
}

.profile-stat-item__fill--bond {
  background: linear-gradient(90deg, #8adfb0, #5fc7a8);
}

.profile-stat-item__fill--done {
  background: linear-gradient(90deg, #8ad8ff, #6ebfea);
}

.profile-summary {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 18rpx;
}

.profile-summary__title {
  color: #253047;
  font-size: 30rpx;
  font-weight: 700;
}

.profile-summary__copy {
  font-size: 24rpx;
  line-height: 1.5;
}

.profile-menu {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.profile-menu-group {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.16);
  border-radius: 24rpx;
  box-shadow: 0 12rpx 26rpx rgba(167, 124, 72, 0.08);
  overflow: hidden;
}

.profile-menu-group__title {
  color: #8a7a68;
  font-size: 23rpx;
  font-weight: 800;
  padding: 20rpx 22rpx 10rpx;
}

.profile-menu-item {
  align-items: center;
  background: transparent;
  border-radius: 0;
  color: #253047;
  display: flex;
  gap: 18rpx;
  margin: 0;
  padding: 20rpx 22rpx;
  text-align: left;
  width: 100%;
}

.profile-menu-item + .profile-menu-item {
  border-top: 2rpx solid rgba(176, 143, 102, 0.1);
}

.profile-menu-item::after,
.profile-sheet__close::after,
.profile-sheet__primary::after,
.profile-privacy-item::after {
  border: 0;
}

.profile-menu-item--pressed {
  background: rgba(232, 247, 239, 0.74);
}

.profile-menu-item__icon {
  align-items: center;
  background: linear-gradient(145deg, #e8f7ef, #fff0ca);
  border-radius: 18rpx;
  color: #365f56;
  display: flex;
  flex: 0 0 auto;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI Symbol', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  height: 68rpx;
  justify-content: center;
  line-height: 1;
  width: 68rpx;
}

.profile-menu-item__main {
  flex: 1;
  min-width: 0;
}

.profile-menu-item__title {
  color: #253047;
  font-size: 29rpx;
  font-weight: 800;
}

.profile-menu-item__hint {
  color: #8a7a68;
  font-size: 23rpx;
  line-height: 1.4;
  margin-top: 6rpx;
}

.profile-menu-item__arrow {
  color: #b4a58f;
  flex: 0 0 auto;
  font-size: 42rpx;
}

.profile-sheet-layer {
  align-items: center;
  background: rgba(39, 57, 48, 0.34);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  padding: 34rpx;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 60;
}

.profile-sheet {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.16);
  border-radius: 28rpx;
  box-shadow: 0 24rpx 48rpx rgba(47, 67, 58, 0.22);
  box-sizing: border-box;
  padding: 76rpx 26rpx 28rpx;
  position: relative;
  width: 100%;
}

.profile-sheet__close {
  align-items: center;
  background: rgba(255, 240, 202, 0.86);
  border-radius: 50%;
  color: #7d644f;
  display: flex;
  font-size: 40rpx;
  font-weight: 900;
  height: 56rpx;
  justify-content: center;
  left: 20rpx;
  line-height: 56rpx;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 20rpx;
  width: 56rpx;
}

.profile-sheet__title {
  color: #253047;
  font-size: 36rpx;
  font-weight: 900;
}

.profile-sheet__body {
  color: #6d7890;
  font-size: 27rpx;
  line-height: 1.6;
  margin-top: 18rpx;
}

.profile-sheet__input {
  background: #ffffff;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 18rpx;
  box-sizing: border-box;
  color: #253047;
  font-size: 30rpx;
  height: 82rpx;
  line-height: 82rpx;
  margin-top: 22rpx;
  min-height: 82rpx;
  padding: 0 20rpx;
}

.profile-sheet__primary {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  border-radius: 999rpx;
  color: #173f38;
  font-size: 28rpx;
  font-weight: 900;
  height: 82rpx;
  line-height: 82rpx;
  margin: 26rpx 0 0;
}

.profile-sheet__primary::after,
.profile-sheet__ghost::after,
.profile-sheet__text::after {
  border: 0;
}

.profile-sheet__ghost {
  background: rgba(255, 255, 255, 0.78);
  border: 2rpx solid rgba(107, 138, 120, 0.2);
  border-radius: 999rpx;
  color: #315c50;
  font-size: 26rpx;
  font-weight: 800;
  height: 78rpx;
  line-height: 78rpx;
  margin: 16rpx 0 0;
}

.profile-sheet__primary[disabled],
.profile-sheet__ghost[disabled] {
  opacity: 0.58;
}

.profile-sheet__text {
  background: transparent;
  color: #8a7a68;
  font-size: 24rpx;
  font-weight: 700;
  height: 60rpx;
  line-height: 60rpx;
  margin: 12rpx 0 0;
}

.profile-privacy-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 20rpx;
}

.profile-privacy-item {
  align-items: center;
  background: rgba(245, 250, 238, 0.82);
  border-radius: 18rpx;
  color: #253047;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  margin: 0;
  padding: 18rpx;
  text-align: left;
}

.profile-privacy-item:active {
  transform: scale(0.99);
}

.profile-privacy-item__title {
  color: #253047;
  font-size: 27rpx;
  font-weight: 800;
}

.profile-privacy-item__hint {
  color: #8a7a68;
  font-size: 22rpx;
  line-height: 1.42;
  margin-top: 6rpx;
}

.profile-privacy-item__switch {
  background: rgba(138, 122, 104, 0.24);
  border-radius: 999rpx;
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 42rpx;
  padding: 4rpx;
  width: 76rpx;
}

.profile-privacy-item__switch view {
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 4rpx 10rpx rgba(92, 74, 54, 0.18);
  height: 34rpx;
  transition: transform 0.18s ease;
  width: 34rpx;
}

.profile-privacy-item--on .profile-privacy-item__switch {
  background: #8adfb0;
}

.profile-privacy-item--on .profile-privacy-item__switch view {
  transform: translateX(34rpx);
}

.profile-attribute-grid {
  display: grid;
  gap: 14rpx;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20rpx;
}

.profile-attribute-card {
  background: rgba(245, 250, 238, 0.82);
  border-radius: 18rpx;
  padding: 18rpx;
}

.profile-attribute-card__label {
  color: #8a7a68;
  font-size: 23rpx;
}

.profile-attribute-card__value {
  color: #253047;
  font-size: 36rpx;
  font-weight: 900;
  margin-top: 6rpx;
}

.profile-attribute-card__track {
  background: rgba(228, 213, 194, 0.64);
  border-radius: 999rpx;
  height: 10rpx;
  margin-top: 12rpx;
  overflow: hidden;
}

.profile-attribute-card__fill {
  border-radius: inherit;
  height: 100%;
}

.profile-attribute-card__fill--mood,
.profile-attribute-card__fill--hunger {
  background: linear-gradient(90deg, #f8cb64, #f0b94a);
}

.profile-attribute-card__fill--bond,
.profile-attribute-card__fill--health {
  background: linear-gradient(90deg, #8adfb0, #5fc7a8);
}

.profile-attribute-card__fill--energy,
.profile-attribute-card__fill--clean {
  background: linear-gradient(90deg, #8ad8ff, #6ebfea);
}

.profile-settings-entry {
  align-items: flex-start;
  box-sizing: border-box;
  color: #253047;
  display: flex;
  flex-direction: column;
  font-size: 32rpx;
  font-weight: 700;
  gap: 6rpx;
  line-height: 1.2;
  margin: 2rpx 0 0;
  padding: 22rpx;
  text-align: left;
  width: 100%;
}

.profile-settings-entry::after {
  border: 0;
}

.profile-settings-entry__hint {
  font-size: 24rpx;
  font-weight: 500;
}
</style>
