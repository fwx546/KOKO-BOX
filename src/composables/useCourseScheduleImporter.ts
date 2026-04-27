import { ref } from 'vue'
import { useKokoState } from './useKokoState'
import { useLanguage } from './useLanguage'
import { recognizeScheduleFromImage } from '../services/petDialogue'
import type { CourseSchedule } from '../types/koko'

interface WechatCloudApi {
  uploadFile?: (options: {
    cloudPath: string
    filePath: string
  }) => Promise<{ fileID: string }>
}

const getWechatCloudApi = () =>
  (globalThis as { wx?: { cloud?: WechatCloudApi } }).wx?.cloud

const chooseScheduleImage = () =>
  new Promise<string>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album'],
      success: (result) => {
        const filePath = result.tempFilePaths?.[0]
        if (filePath) {
          resolve(filePath)
          return
        }

        reject(new Error('NO_SCHEDULE_IMAGE_SELECTED'))
      },
      fail: reject,
    })
  })

const uploadScheduleImage = async (filePath: string) => {
  const wxCloud = getWechatCloudApi()
  if (!wxCloud?.uploadFile) {
    throw new Error('WECHAT_CLOUD_UPLOAD_UNAVAILABLE')
  }

  const extension = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).split('?')[0] : '.png'
  const safeExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension.toLowerCase()) ? extension : '.png'
  const { fileID } = await wxCloud.uploadFile({
    cloudPath: `schedules/${Date.now()}${safeExtension}`,
    filePath,
  })

  return fileID
}

const getScheduleImportErrorMessage = (error: unknown, language: 'zh' | 'en') => {
  const message = error instanceof Error ? error.message : String(error || '')

  if (message.includes('NO_SCHEDULE_IMAGE_SELECTED')) {
    return language === 'zh' ? '未选择课表截图' : 'No timetable screenshot selected.'
  }

  if (message.includes('WECHAT_CLOUD_UPLOAD_UNAVAILABLE')) {
    return language === 'zh' ? '微信云上传不可用' : 'WeChat cloud upload is unavailable.'
  }

  if (message.includes('FUNCTIONS_TIME_LIMIT_EXCEEDED') || message.includes('timed out')) {
    return language === 'zh'
      ? 'AI 识别超时，请确认 pet-dialogue 云函数超时时间为 60 秒后再试。'
      : 'AI recognition timed out. Confirm the pet-dialogue cloud function timeout is 60 seconds and try again.'
  }

  if (message.includes('QWEN_API_KEY')) {
    return language === 'zh'
      ? 'AI 密钥未配置，请检查 pet-dialogue 云函数环境变量。'
      : 'AI key is not configured. Check the pet-dialogue cloud function environment variables.'
  }

  return message || (language === 'zh' ? '识别失败，请查看云函数日志。' : 'Recognition failed. Check cloud function logs.')
}

export const useCourseScheduleImporter = (options?: { onImported?: () => void }) => {
  const { setCourseSchedule } = useKokoState()
  const { language } = useLanguage()
  const showScheduleImporter = ref(false)
  const importingSchedule = ref(false)
  const scheduleImportError = ref('')

  const openScheduleImporter = () => {
    scheduleImportError.value = ''
    showScheduleImporter.value = true
  }

  const closeScheduleImporter = () => {
    if (importingSchedule.value) return
    showScheduleImporter.value = false
  }

  const importScheduleFromScreenshot = async () => {
    if (importingSchedule.value) return

    importingSchedule.value = true
    scheduleImportError.value = ''

    try {
      const filePath = await chooseScheduleImage()
      const fileID = await uploadScheduleImage(filePath)
      const courses = await recognizeScheduleFromImage(fileID)
      const nextSchedule: CourseSchedule = {
        id: `schedule-${Date.now()}`,
        courses,
        importedAt: new Date().toISOString(),
        sourceFileID: fileID,
      }

      await setCourseSchedule(nextSchedule)
      showScheduleImporter.value = false
      uni.showToast({ title: language.value === 'zh' ? '课表已导入' : 'Schedule imported', icon: 'success' })
      options?.onImported?.()
    } catch (error) {
      scheduleImportError.value = getScheduleImportErrorMessage(error, language.value)
    } finally {
      importingSchedule.value = false
    }
  }

  return {
    showScheduleImporter,
    importingSchedule,
    scheduleImportError,
    openScheduleImporter,
    closeScheduleImporter,
    importScheduleFromScreenshot,
  }
}
