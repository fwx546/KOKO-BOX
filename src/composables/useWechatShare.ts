import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'

type ShareOptions = {
  path: string
  title?: string
  imageUrl?: string
  query?: Record<string, string | number | boolean | undefined>
}

const DEFAULT_TITLE = 'Koko Box - A gentle companion mini program'
const DEFAULT_IMAGE = '/static/tab/tab-rest-active.png'

const buildQueryString = (query?: ShareOptions['query']) => {
  if (!query) {
    return ''
  }

  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)

  return params.length > 0 ? `?${params.join('&')}` : ''
}

export const useWechatShare = (options: ShareOptions) => {
  const sharePath = `${options.path}${buildQueryString(options.query)}`
  const title = options.title || DEFAULT_TITLE
  const imageUrl = options.imageUrl || DEFAULT_IMAGE

  onLoad(() => {
    // #ifdef MP-WEIXIN
    uni.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
    // #endif
  })

  onShow(() => {
    // #ifdef MP-WEIXIN
    uni.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
    // #endif
  })

  onShareAppMessage(() => ({
    title,
    path: sharePath,
    imageUrl,
  }))

  onShareTimeline(() => ({
    title,
    query: sharePath.split('?')[1] || '',
    imageUrl,
  }))
}
