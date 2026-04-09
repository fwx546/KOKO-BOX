import { computed, ref } from 'vue'
import { copy, type Language } from '../i18n'

const language = ref<Language>('zh')

const setLanguage = (nextLanguage: Language) => {
  language.value = nextLanguage
}

const t = computed(() => copy[language.value])

export const useLanguage = () => ({
  language,
  setLanguage,
  t,
})
