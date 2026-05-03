import { copy, type Language } from '../i18n'

const tabBarPages = ['pages/home/index', 'pages/planner/index', 'pages/town/index', 'pages/profile/index'] as const

const pageTitleKeyByRoute: Record<string, keyof (typeof copy)['en']['nav']> = {
  'pages/home/index': 'home',
  'pages/chat/index': 'chat',
  'pages/stats/index': 'stats',
  'pages/coin-log/index': 'coinLog',
  'pages/profile/index': 'profile',
  'pages/archive/index': 'archive',
  'pages/town/index': 'town',
  'pages/planner/index': 'planner',
  'pages/schedule/index': 'schedule',
  'pages/planner-create/index': 'plannerCreate',
  'pages/planner-task/index': 'plannerTask',
  'pages/planner-list/index': 'plannerList',
  'pages/pet-game-catch/index': 'petGameCatch',
  'pages/pet-game-bubble/index': 'petGameBubble',
  'pages/hardware/index': 'hardware',
  'pages/settings/index': 'settings',
  'pages/feedback/index': 'feedback',
  'pages/voice-call/index': 'voiceCall',
}

let syncedTabBarLanguage: Language | '' = ''
let syncedTitleKey = ''
let syncedTitleLanguage: Language | '' = ''

const currentRoute = () => {
  if (typeof getCurrentPages !== 'function') return ''
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as { route?: string } | undefined
  return current?.route ?? ''
}

export const syncNativeLanguageUi = (language: Language, route = currentRoute()) => {
  if (typeof uni === 'undefined') return

  const nav = copy[language].nav

  if (syncedTabBarLanguage !== language && typeof uni.setTabBarItem === 'function') {
    const tabLabels = [nav.home, nav.planner, nav.town, nav.profile]
    tabBarPages.forEach((_, index) => {
      uni.setTabBarItem({
        index,
        text: tabLabels[index],
        fail: () => undefined,
      })
    })
    syncedTabBarLanguage = language
  }

  const titleKey = pageTitleKeyByRoute[route]
  if (titleKey && (syncedTitleKey !== titleKey || syncedTitleLanguage !== language) && typeof uni.setNavigationBarTitle === 'function') {
    uni.setNavigationBarTitle({
      title: nav[titleKey],
      fail: () => undefined,
    })
    syncedTitleKey = titleKey
    syncedTitleLanguage = language
  }
}
