import { computed, ref } from 'vue'
import { copy, type Language } from '../i18n'

const readInitialLanguage = (): Language => {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return 'zh'
  }

  const stored = uni.getStorageSync('koko-language') as Language | undefined
  return stored === 'en' ? 'en' : 'zh'
}

const language = ref<Language>(readInitialLanguage())

const setLanguage = (nextLanguage: Language) => {
  language.value = nextLanguage

  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
    uni.setStorageSync('koko-language', nextLanguage)
  }
}

const t = computed(() => copy[language.value])

export const useLanguage = () => ({
  language,
  setLanguage,
  t,
})
