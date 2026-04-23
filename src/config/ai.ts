export const QWEN_API_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const QWEN_MODEL = 'qwen-plus'

// Fill this in when you are ready to enable real dialogue.
export const QWEN_API_KEY = ''

export const isQwenConfigured = () => QWEN_API_KEY.trim().length > 0
