export const supportedLanguages = ['zh', 'en'] as const

export type Language = (typeof supportedLanguages)[number]

export type SceneId = 'calm' | 'reset' | 'hug'
export type StatKey = 'health' | 'mood' | 'hunger' | 'energy' | 'intimacy' | 'cleanliness'

export const copy = {
  en: {
    meta: {
      appName: 'Koko Box prototype',
      headerTitle: 'Gentle care, calm presence, and a pet that feels alive.',
      localBadge: 'Local UI only',
      languageLabel: 'Language',
      langChinese: '中文',
      langEnglish: 'English',
    },
    scenes: {
      calm: {
        title: 'Soft Morning',
        subtitle: 'The pet looks steady and ready for a gentle day.',
        moodLine: 'Everything is calm. A few kind interactions keep the day light.',
      },
      reset: {
        title: 'Tiny Reset',
        subtitle: 'A short pause, a sip of water, and a warm check-in.',
        moodLine: 'A short reset helps the pet recover energy and mood.',
      },
      hug: {
        title: 'Need a Hug',
        subtitle: 'The pet wants more warmth, companionship, and care.',
        moodLine: 'A gentle reminder and one soft message can make a difference.',
      },
    },
    hero: {
      eyebrow: "Today's mood",
      actionHello: 'Say hello',
      actionReminder: 'Open reminder',
    },
    summary: {
      eyebrow: 'Quick status',
      growthTitle: 'Growth progress',
      growthHint: 'Steady care keeps the pet moving forward.',
      syncLabel: 'Cross-device sync',
      syncValue: 'Simulated',
      reminderLabel: 'Reminder system',
      reminderValue: 'Ready for UI',
      aiLabel: 'AI chat',
      aiValue: 'Preview only',
    },
    petAttributes: {
      eyebrow: 'Pet attributes',
      title: 'Simple status cards for the core care loop.',
      note: 'Health, mood, hunger, energy, intimacy, cleanliness',
    },
    growth: {
      eyebrow: 'Growth & care system',
      title: 'Small actions feed into a soft progress arc.',
      description:
        'The UI can show how care, rest, reminders, and companionship gradually shape the pet\'s mood.',
      progress: 'Prototype progress',
    },
    reminders: {
      eyebrow: 'Gentle reminders',
      title: 'Soft nudges that do not feel intrusive.',
      items: [
        {
          title: 'Water break',
          subtitle: 'A soft nudge after 2 hours of screen time.',
          badge: 'Gentle',
        },
        {
          title: 'Stretch together',
          subtitle: 'Use a small routine to reduce tension and refill energy.',
          badge: '5 min',
        },
        {
          title: 'Night check-in',
          subtitle: 'Wrap the day with a calm message and pet status sync.',
          badge: 'Today',
        },
      ],
    },
    hardware: {
      eyebrow: 'Hardware display',
      title: 'Small-screen preview for the device tile.',
      devices: [
        {
          name: 'Mobile App',
          status: 'Online',
          detail: 'Last sync 2 min ago',
        },
        {
          name: 'Desktop Pet',
          status: 'Ready',
          detail: 'Mood card mirrored locally',
        },
        {
          name: 'Hardware Display',
          status: 'Mock state',
          detail: '48 x 48 cozy tile preview',
        },
      ],
    },
    chat: {
      eyebrow: 'Lightweight AI chat',
      title: 'Placeholder for a warm, supportive assistant.',
      assistantName: 'Koko',
      assistantText: 'Try one short check-in: "How are you feeling right now?"',
      userName: 'You',
      userText: 'Sometimes I feel tense after a long day.',
      inputPlaceholder: 'Write a kind message...',
      send: 'Send',
    },
    stats: {
      health: { label: 'Health', hint: 'Stable and responsive' },
      mood: { label: 'Mood', hint: 'Friendly, slightly playful' },
      hunger: { label: 'Hunger', hint: 'Time for a small snack' },
      energy: { label: 'Energy', hint: 'Enough for light interaction' },
      intimacy: { label: 'Intimacy', hint: 'Warm and familiar' },
      cleanliness: { label: 'Cleanliness', hint: 'Still looks tidy' },
    },
  },
  zh: {
    meta: {
      appName: 'Koko Box 原型',
      headerTitle: '温柔陪伴、安心存在、让宠物更有生命力。',
      localBadge: '仅本地 UI',
      languageLabel: '语言',
      langChinese: '中文',
      langEnglish: 'English',
    },
    scenes: {
      calm: {
        title: '柔和清晨',
        subtitle: '宠物状态稳定，准备好开始轻松的一天。',
        moodLine: '一切都很平稳，几次温柔互动就能让一天更轻盈。',
      },
      reset: {
        title: '小小重置',
        subtitle: '短暂停一停，喝口水，再来一次温暖签到。',
        moodLine: '一次短暂重置，能帮助宠物恢复精力和心情。',
      },
      hug: {
        title: '想要抱抱',
        subtitle: '宠物需要更多关心、陪伴和照料。',
        moodLine: '一条温柔提醒和一句关心的话，就会有明显变化。',
      },
    },
    hero: {
      eyebrow: '今日心情',
      actionHello: '打个招呼',
      actionReminder: '打开提醒',
    },
    summary: {
      eyebrow: '快速状态',
      growthTitle: '成长进度',
      growthHint: '持续照料会让宠物稳步成长。',
      syncLabel: '跨端同步',
      syncValue: '模拟中',
      reminderLabel: '提醒系统',
      reminderValue: 'UI 已就绪',
      aiLabel: 'AI 聊天',
      aiValue: '仅预览',
    },
    petAttributes: {
      eyebrow: '宠物属性',
      title: '用于核心照料循环的简洁状态卡片。',
      note: '健康、心情、饥饿、精力、亲密度、清洁度',
    },
    growth: {
      eyebrow: '成长与照护系统',
      title: '小行动会汇聚成柔和的成长曲线。',
      description: '界面可展示照料、休息、提醒与陪伴如何逐步影响宠物心情。',
      progress: '原型进度',
    },
    reminders: {
      eyebrow: '温柔提醒',
      title: '不打扰、但及时的轻提示。',
      items: [
        {
          title: '喝水提醒',
          subtitle: '连续屏幕使用 2 小时后，轻轻提醒一下。',
          badge: '温和',
        },
        {
          title: '一起拉伸',
          subtitle: '用一组小动作缓解紧张并补充精力。',
          badge: '5 分钟',
        },
        {
          title: '夜间签到',
          subtitle: '用一句平静问候结束今天并同步宠物状态。',
          badge: '今天',
        },
      ],
    },
    hardware: {
      eyebrow: '硬件显示',
      title: '设备小卡片的小屏预览。',
      devices: [
        {
          name: '移动端 App',
          status: '在线',
          detail: '2 分钟前同步',
        },
        {
          name: '桌面宠物',
          status: '就绪',
          detail: '心情卡片已本地镜像',
        },
        {
          name: '硬件显示器',
          status: '模拟状态',
          detail: '48 x 48 温馨方块预览',
        },
      ],
    },
    chat: {
      eyebrow: '轻量 AI 聊天',
      title: '用于温暖支持助手的占位区域。',
      assistantName: 'Koko',
      assistantText: '试试一句简短签到：“你现在感觉怎么样？”',
      userName: '你',
      userText: '有时候忙了一整天，我会觉得很紧绷。',
      inputPlaceholder: '写一句温柔的话...',
      send: '发送',
    },
    stats: {
      health: { label: '健康', hint: '稳定且反应良好' },
      mood: { label: '心情', hint: '友好，略带活力' },
      hunger: { label: '饥饿', hint: '可以补一点小零食' },
      energy: { label: '精力', hint: '足够进行轻度互动' },
      intimacy: { label: '亲密度', hint: '温暖且熟悉' },
      cleanliness: { label: '清洁度', hint: '整体依然整洁' },
    },
  },
} as const
