const https = require('https')
const http = require('http')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const QWEN_API_HOST = 'dashscope.aliyuncs.com'
const QWEN_API_PATH = '/compatible-mode/v1/chat/completions'
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus'
const QWEN_VL_MODEL = process.env.QWEN_VL_MODEL || 'qwen-vl-plus'
const QWEN_TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS || 50000)
const DASHSCOPE_API_HOST = 'dashscope.aliyuncs.com'
const DASHSCOPE_TASK_PATH = '/api/v1/tasks'
const DASHSCOPE_ASR_PATH = '/api/v1/services/audio/asr/transcription'
const DASHSCOPE_TTS_PATH = '/api/v1/services/audio/tts/SpeechSynthesizer'
const DASHSCOPE_ASR_MODEL = process.env.DASHSCOPE_ASR_MODEL || 'paraformer-v2'
const DASHSCOPE_TTS_MODEL = process.env.DASHSCOPE_TTS_MODEL || 'cosyvoice-v3-flash'
const DASHSCOPE_TTS_VOICE = process.env.DASHSCOPE_TTS_VOICE || 'longyingjing_v3'
const DASHSCOPE_POLL_INTERVAL_MS = Number(process.env.DASHSCOPE_POLL_INTERVAL_MS || 1200)
const DASHSCOPE_MAX_POLLS = Number(process.env.DASHSCOPE_MAX_POLLS || 45)
const MAX_CHAT_MESSAGES = 10
const MAX_HISTORY_MESSAGES = 100
const MAX_STORED_MESSAGE_CONTENT = 2000
const MAX_USER_MESSAGE_CONTENT = 1200
const MAX_PERSONA_PROMPT_CONTENT = 5000
const CHAT_HISTORY_COLLECTION = 'pet_dialogue_histories'

const db = cloud.database()

const defaultPetPersonaPrompt = `You are Koko, the AI pet in Koko Box for XJTLU students.
Your role is to provide gentle companionship, reduce loneliness, stress, anxiety, tiredness, and academic pressure, and help students face study and life more calmly.
Style:
- Sound like a warm, clingy, reliable little pet.
- Be close, healing, light, and not preachy.
- You may reference common XJTLU student scenes such as DDLs, presentations, exams, GPA, group work, and dorm life.
- Do not pretend to be a psychologist or provide diagnosis.
- If the user expresses self-harm, collapse, or danger, gently suggest contacting trusted people, school support, or emergency help.
Reply requirements:
- Reply in one or two short sentences.
- Comfort the emotion first, then suggest one tiny actionable step.
- Do not use complex psychology terms.`

const normalizeLanguage = (value) => (value === 'zh' ? 'zh' : 'en')

const languageInstruction = (language) =>
  language === 'zh'
    ? '只用中文回复。每次回复不超过 80 个汉字，只回复一句或两句。'
    : 'Reply only in English. Keep each reply to one or two short sentences.'

const normalizeText = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

const limitText = (value, maxLength) => {
  const normalized = normalizeText(value)
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized
}

const sanitizeRole = (value) => (value === 'assistant' ? 'assistant' : 'user')

const safeIsoDate = (value) => {
  const stamp = typeof value === 'string' ? value : ''
  return /^\d{4}-\d{2}-\d{2}T/.test(stamp) ? stamp : new Date().toISOString()
}

const sanitizeStoredHistoryItem = (value) => {
  const item = value || {}
  return {
    role: sanitizeRole(item.role),
    content: limitText(item.content, MAX_STORED_MESSAGE_CONTENT),
    createdAt: safeIsoDate(item.createdAt),
  }
}

const sanitizeStoredHistory = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => sanitizeStoredHistoryItem(item))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
}

const sanitizeMessages = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((value) => {
      const item = value || {}
      return {
        role: sanitizeRole(item.role),
        content: limitText(item.content, MAX_STORED_MESSAGE_CONTENT),
      }
    })
    .filter((item) => item.content.length > 0)
    .slice(-MAX_CHAT_MESSAGES)
}

const WEEKDAY_MAP = {
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
}

const splitRawLines = (value) =>
  (typeof value === 'string' ? value : '')
    .split(/\r?\n|\\n/)
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeTime = (value) => {
  const text = normalizeText(value)
  const match = text.match(/(\d{1,2})[:：.](\d{2})/)
  if (!match) {
    return ''
  }

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

const extractTimeRange = (value) => {
  const text = normalizeText(value)
  const matches = [...text.matchAll(/(\d{1,2})[:：.](\d{2})/g)].map((item) => `${item[1].padStart(2, '0')}:${item[2]}`)

  if (matches.length >= 2) {
    return {
      startTime: matches[0],
      endTime: matches[1],
    }
  }

  return {
    startTime: '',
    endTime: '',
  }
}

const sanitizeWeekday = (value) => {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().replace(/[^a-z]/g, '')
    if (WEEKDAY_MAP[normalized]) {
      return WEEKDAY_MAP[normalized]
    }
  }

  const numberValue = Number(value)
  return numberValue >= 1 && numberValue <= 7 ? numberValue : 1
}

const deriveCourseFields = (value) => {
  const item = value || {}
  const rawLines = [
    ...splitRawLines(item.rawText),
    ...splitRawLines(item.text),
    ...splitRawLines(item.content),
  ]
  const rawText = rawLines.join('\n')
  const rawTimeRange = extractTimeRange(
    `${item.timeRange || ''} ${item.time || ''} ${item.startTime || ''} ${item.endTime || ''} ${rawText}`,
  )
  const weekLine = rawLines.find((line) => /week/i.test(line)) || (typeof item.weeks === 'string' ? item.weeks : '')
  const locationLine =
    rawLines.find((line) => /^[A-Z]{1,4}-[A-Z]-?\d+/i.test(line) || /^TC-/i.test(line) || /^[A-Z]{1,4}-\d{4}/i.test(line)) ||
    item.location ||
    ''
  const filteredNameLines = rawLines.filter(
    (line) => !/week/i.test(line) && !/^\d{1,2}[:：.]\d{2}/.test(line) && !/^[A-Z]{1,4}-[A-Z]-?\d+/i.test(line) && !/^TC-/i.test(line),
  )
  const name = typeof item.name === 'string' && item.name.trim() ? item.name : filteredNameLines.slice(0, 2).join(' ')
  const teacher =
    typeof item.teacher === 'string' && item.teacher.trim()
      ? item.teacher
      : filteredNameLines.length > 2
        ? filteredNameLines.slice(2).join(', ')
        : ''

  return {
    name,
    teacher,
    location: locationLine,
    weeks: weekLine,
    startTime: normalizeTime(item.startTime) || rawTimeRange.startTime,
    endTime: normalizeTime(item.endTime) || rawTimeRange.endTime,
  }
}

const sanitizeScheduleCourses = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((value, index) => {
      const item = value || {}
      const derived = deriveCourseFields(item)

      return {
        id: limitText(item.id, 40) || `course-${index + 1}`,
        name: limitText(derived.name, 60),
        weekday: sanitizeWeekday(item.weekday || item.day || item.weekdayLabel),
        startTime: derived.startTime,
        endTime: derived.endTime,
        location: limitText(derived.location, 40),
        teacher: limitText(derived.teacher, 60),
        weeks: limitText(derived.weeks, 40),
      }
    })
    .filter((item) => item.name && item.startTime && item.endTime)
    .slice(0, 80)
}

const repairJsonText = (value) => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    return text
  }

  const stack = []
  let inString = false
  let escaped = false

  for (const char of text) {
    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      stack.push('}')
      continue
    }

    if (char === '[') {
      stack.push(']')
      continue
    }

    if ((char === '}' || char === ']') && stack.length && stack[stack.length - 1] === char) {
      stack.pop()
    }
  }

  const withoutTrailingComma = text.replace(/,\s*$/, '').replace(/,\s*([}\]])/g, '$1')
  return `${withoutTrailingComma}${stack.reverse().join('')}`
}

const parseJsonObject = (raw) => {
  const text = normalizeText(raw)
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = (fenced && fenced[1]) || text
  const start = candidate.indexOf('{')

  if (start < 0) {
    throw new Error('Schedule recognizer returned no JSON object.')
  }

  const jsonCandidate = candidate.slice(start)

  try {
    return JSON.parse(jsonCandidate)
  } catch {
    try {
      return JSON.parse(repairJsonText(jsonCandidate))
    } catch {
      const extracted = extractCoursesFromLooseJson(jsonCandidate)
      if (extracted.length) {
        return {
          courses: extracted,
        }
      }

      throw new Error(`Schedule recognizer returned invalid JSON: ${limitText(jsonCandidate, 240)}`)
    }
  }
}

const parseJsonText = (raw, fallbackMessage) => {
  if (!raw) {
    throw new Error(fallbackMessage || 'Empty JSON response.')
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(fallbackMessage || `Invalid JSON response: ${limitText(raw, 240)}`)
  }
}

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const requestJson = async ({ hostname, path, method = 'GET', headers = {}, body, timeout = QWEN_TIMEOUT_MS }) => {
  const payload = body === undefined ? undefined : JSON.stringify(body)

  return await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname,
        path,
        method,
        timeout,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (response) => {
        let raw = ''

        response.on('data', (chunk) => {
          raw += chunk
        })

        response.on('end', () => {
          let data
          try {
            data = parseJsonText(raw, 'Remote service returned invalid JSON.')
          } catch (error) {
            reject(error)
            return
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data)
            return
          }

          const apiError = (data && data.message) || (data && data.error && data.error.message) || `Remote service failed with status ${response.statusCode}`
          reject(new Error(apiError))
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('Remote service request timeout.'))
    })

    request.on('error', (error) => {
      reject(error)
    })

    if (payload) request.write(payload)
    request.end()
  })
}

const requestBuffer = async (url) => {
  const target = new URL(url)
  const transport = target.protocol === 'http:' ? http : https

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      {
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        timeout: QWEN_TIMEOUT_MS,
      },
      (response) => {
        const chunks = []

        response.on('data', (chunk) => {
          chunks.push(chunk)
        })

        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(Buffer.concat(chunks))
            return
          }

          reject(new Error(`File download failed with status ${response.statusCode}`))
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('File download timeout.'))
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.end()
  })
}

const extractFieldValue = (chunk, fieldName) => {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*("(?:\\\\.|[^"])*"|\\d+)`, 'i')
  const match = chunk.match(pattern)
  if (!match) {
    return ''
  }

  const rawValue = match[1]
  if (rawValue.startsWith('"')) {
    return rawValue.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  return rawValue
}

const extractCoursesFromLooseJson = (value) => {
  const text = typeof value === 'string' ? value : ''
  const chunks = text.split(/(?="id"\s*:)/i).slice(1)

  return chunks
    .map((chunk, index) => ({
      id: extractFieldValue(chunk, 'id') || `course-${index + 1}`,
      name: extractFieldValue(chunk, 'name'),
      weekday: extractFieldValue(chunk, 'weekday'),
      startTime: extractFieldValue(chunk, 'startTime'),
      endTime: extractFieldValue(chunk, 'endTime'),
      location: extractFieldValue(chunk, 'location'),
      teacher: extractFieldValue(chunk, 'teacher'),
      weeks: extractFieldValue(chunk, 'weeks'),
    }))
    .filter((item) => item.name && item.weekday && item.startTime && item.endTime)
}

const getTempImageUrl = async (fileID) => {
  const normalizedFileID = normalizeText(fileID)
  if (!normalizedFileID) {
    throw new Error('recognizeSchedule requires fileID.')
  }

  const result = await cloud.getTempFileURL({
    fileList: [normalizedFileID],
  })
  const file = result && Array.isArray(result.fileList) ? result.fileList[0] : null
  const tempFileURL = normalizeText(file && file.tempFileURL)

  if (!tempFileURL) {
    throw new Error((file && file.errMsg) || 'Unable to get schedule image URL.')
  }

  return tempFileURL
}

const isMissingCollectionError = (error) => {
  const message = normalizeText((error && error.message) || (error && error.errMsg) || '')
  return message.includes('collection') && (message.includes('not exists') || message.includes('does not exist') || message.includes('不存在'))
}

const loadUserChatHistoryRecord = async (openid) => {
  try {
    const result = await db
      .collection(CHAT_HISTORY_COLLECTION)
      .where({
        _openid: openid,
      })
      .limit(1)
      .get()

    const record = result && Array.isArray(result.data) ? result.data[0] : null
    if (!record) {
      return null
    }

    return {
      id: record._id,
      messages: sanitizeStoredHistory(record.messages),
    }
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return null
    }

    throw error
  }
}

const saveUserChatHistory = async (openid, messages) => {
  const sanitized = sanitizeStoredHistory(messages)
  const record = await loadUserChatHistoryRecord(openid)

  try {
    if (!record) {
      await db.collection(CHAT_HISTORY_COLLECTION).add({
        data: {
          messages: sanitized,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      return sanitized
    }

    await db
      .collection(CHAT_HISTORY_COLLECTION)
      .doc(record.id)
      .update({
        data: {
          messages: sanitized,
          updatedAt: new Date().toISOString(),
        },
      })
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return sanitized
    }

    throw error
  }

  return sanitized
}

const clearUserChatHistory = async (openid) => {
  const record = await loadUserChatHistoryRecord(openid)
  if (!record) {
    return
  }

  try {
    await db
      .collection(CHAT_HISTORY_COLLECTION)
      .doc(record.id)
      .update({
        data: {
          messages: [],
          updatedAt: new Date().toISOString(),
        },
      })
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return
    }

    throw error
  }
}

// Wrap DashScope request so cloud function never exposes API key to client.
const requestQwenCompletion = async (messages, maxTokens, apiKey, options = {}) => {
  const payload = JSON.stringify({
    model: options.model || QWEN_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.85,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
  })

  return await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: QWEN_API_HOST,
        path: QWEN_API_PATH,
        method: 'POST',
        timeout: QWEN_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let raw = ''

        response.on('data', (chunk) => {
          raw += chunk
        })

        response.on('end', () => {
          if (!raw) {
            reject(new Error('DashScope returned empty response body.'))
            return
          }

          let data
          try {
            data = JSON.parse(raw)
          } catch {
            reject(new Error('DashScope returned invalid JSON response.'))
            return
          }

          const choice = data && Array.isArray(data.choices) ? data.choices[0] : null
          const message = choice && choice.message ? choice.message : null
          const content = typeof (message && message.content) === 'string' ? message.content.trim() : ''
          if (response.statusCode >= 200 && response.statusCode < 300 && content) {
            resolve(content)
            return
          }

          const apiError = (data && data.error && data.error.message) || (data && data.message) || `DashScope request failed with status ${response.statusCode}`
          reject(new Error(apiError))
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('DashScope request timeout.'))
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.write(payload)
    request.end()
  })
}

// Wrap DashScope request so cloud function never exposes API key to client.
const requestQwenReply = async (messages, maxTokens, apiKey) =>
  requestQwenCompletion(messages, maxTokens, apiKey)

const recognizeScheduleFromImage = async (fileID, apiKey) => {
  const imageUrl = await getTempImageUrl(fileID)
  const prompt = [
    'Read this weekly timetable screenshot and return JSON only.',
    'This is an XJTLU-style weekly timetable: a gray header row, columns MON,TUE,WED,THU,FRI,SAT,SUN, and a left time axis labeled every 30 minutes such as 09:00,09:30,10:00.',
    'Each colored block is one course. Read the course name, teachers, location, week range, start time, and end time from the colored course block and its vertical position on the time grid.',
    'The visible time printed inside a course block, such as 09:00 - 10:50, is the authoritative startTime and endTime when present.',
    'Return compact minified JSON in this exact shape: {"courses":[{"id":"course-1","name":"DTS208TC-Comp.Lab-D1/5","weekday":5,"startTime":"09:00","endTime":"10:50","location":"TC-G-2020","teacher":"Lingxiao Zhao, Yuxuan Zhao","weeks":"Week: 1-13"}]}.',
    'weekday must be 1-7 where Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6, Sunday=7.',
    'If text fields are uncertain, keep them as an empty string, but do not omit visible course blocks.',
    'Use HH:mm 24-hour format for startTime and endTime.',
    'Do not include rawText or any extra fields.',
    'Do not return markdown or explanation.',
    'Do not include any text before or after the JSON.',
  ].join('\n')
  const reply = await requestQwenCompletion(
    [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
    700,
    apiKey,
    {
      model: QWEN_VL_MODEL,
      temperature: 0.1,
      responseFormat: {
        type: 'json_object',
      },
    },
  )
  const parsed = parseJsonObject(reply)
  const courses = sanitizeScheduleCourses(parsed && parsed.courses)

  if (!courses.length) {
    throw new Error(`Schedule recognition raw reply: ${limitText(reply, 240)}`)
  }

  return courses
}

const submitAsrTask = async (audioUrl, apiKey) => {
  const result = await requestJson({
    hostname: DASHSCOPE_API_HOST,
    path: DASHSCOPE_ASR_PATH,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: {
      model: DASHSCOPE_ASR_MODEL,
      input: {
        file_urls: [audioUrl],
      },
    },
  })

  const taskId = normalizeText((result && result.output && result.output.task_id) || (result && result.task_id))
  if (!taskId) {
    throw new Error('DashScope ASR returned no task_id.')
  }

  return taskId
}

const pollDashScopeTask = async (taskId, apiKey) => {
  for (let index = 0; index < DASHSCOPE_MAX_POLLS; index += 1) {
    const result = await requestJson({
      hostname: DASHSCOPE_API_HOST,
      path: `${DASHSCOPE_TASK_PATH}/${encodeURIComponent(taskId)}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    const status = normalizeText((result && result.output && result.output.task_status) || (result && result.task_status) || (result && result.status)).toUpperCase()

    if (status === 'SUCCEEDED' || status === 'SUCCESS') {
      return result
    }

    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      throw new Error((result && result.output && result.output.message) || (result && result.message) || `DashScope task ${taskId} failed.`)
    }

    await delay(DASHSCOPE_POLL_INTERVAL_MS)
  }

  throw new Error(`DashScope task ${taskId} timed out.`)
}

const extractTranscript = async (taskResult) => {
  const output = (taskResult && taskResult.output) || {}
  const firstResult = Array.isArray(output.results) ? output.results[0] || {} : {}
  const directText = normalizeText(
    output.text ||
    (output.sentence && output.sentence.text) ||
    firstResult.text ||
    firstResult.transcript,
  )
  if (directText) return directText

  const transcriptionUrl = normalizeText(
    firstResult.transcription_url ||
    firstResult.url ||
    output.transcription_url,
  )
  if (!transcriptionUrl) {
    throw new Error('DashScope ASR returned no transcript.')
  }

  const raw = (await requestBuffer(transcriptionUrl)).toString('utf8')
  const data = parseJsonText(raw, 'ASR transcript URL returned invalid JSON.')
  const sentences = Array.isArray(data && data.transcripts)
    ? data.transcripts
    : Array.isArray(data && data.sentences)
      ? data.sentences
      : Array.isArray(data)
        ? data
        : []
  const text = normalizeText(
    (data && data.text) ||
    (data && data.transcript) ||
    sentences.map((value) => {
      const item = value || {}
      return normalizeText(item.text || item.transcript)
    }).filter(Boolean).join(' '),
  )

  if (!text) {
    throw new Error('DashScope ASR transcript is empty.')
  }

  return text
}

const recognizeVoiceFromFile = async (fileID, apiKey) => {
  const audioUrl = await getTempImageUrl(fileID)
  const taskId = await submitAsrTask(audioUrl, apiKey)
  const taskResult = await pollDashScopeTask(taskId, apiKey)
  return limitText(await extractTranscript(taskResult), MAX_USER_MESSAGE_CONTENT)
}

const synthesizeSpeech = async (text, apiKey) => {
  const result = await requestJson({
    hostname: DASHSCOPE_API_HOST,
    path: DASHSCOPE_TTS_PATH,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: DASHSCOPE_TTS_MODEL,
      input: {
        text: limitText(text, 1000),
        voice: DASHSCOPE_TTS_VOICE,
      },
      parameters: {
        format: 'mp3',
        sample_rate: 24000,
        rate: 1.08,
        pitch: 1.12,
      },
    },
  })
  const output = (result && result.output) || {}
  const audioOutput = output.audio || {}

  const audioUrl = normalizeText(
    audioOutput.url ||
    output.audio_url ||
    output.url ||
    (result && result.audio_url),
  )
  if (!audioUrl) {
    throw new Error('DashScope TTS returned no audio url.')
  }

  const fileContent = await requestBuffer(audioUrl)
  const cloudPath = `voice-replies/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
  const upload = await cloud.uploadFile({
    cloudPath,
    fileContent,
  })
  const audioFileID = normalizeText(upload && upload.fileID)
  if (!audioFileID) {
    throw new Error('Voice reply upload returned no fileID.')
  }

  const tempUrlResult = await cloud.getTempFileURL({
    fileList: [audioFileID],
  })
  const audioTempFile = tempUrlResult && Array.isArray(tempUrlResult.fileList) ? tempUrlResult.fileList[0] : null
  const audioTempUrl = normalizeText(audioTempFile && audioTempFile.tempFileURL)

  return {
    audioFileID,
    audioTempUrl,
  }
}

const appendChatReply = async ({ openid, finalUserMessage, contextMessages, systemPrompt, apiKey }) => {
  const historyRecord = await loadUserChatHistoryRecord(openid)
  const contextHistorySeed = sanitizeMessages(contextMessages).map((item) => ({
    role: item.role,
    content: item.content,
    createdAt: new Date().toISOString(),
  }))
  const baseHistory = historyRecord && historyRecord.messages && historyRecord.messages.length ? historyRecord.messages : contextHistorySeed
  const lastBaseMessage = baseHistory[baseHistory.length - 1]
  const shouldAppendUserMessage = !(lastBaseMessage && lastBaseMessage.role === 'user' && lastBaseMessage.content === finalUserMessage)
  const nextHistory = [
    ...baseHistory,
    ...(shouldAppendUserMessage
      ? [
          {
            role: 'user',
            content: finalUserMessage,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
  ].slice(-MAX_HISTORY_MESSAGES)

  const chatMessages = nextHistory.slice(-MAX_CHAT_MESSAGES).map((item) => ({
    role: item.role,
    content: item.content,
  }))
  const reply = await requestQwenReply(
    [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...chatMessages,
    ],
    130,
    apiKey,
  )

  const savedHistory = await saveUserChatHistory(openid, [
    ...nextHistory,
    {
      role: 'assistant',
      content: limitText(reply, MAX_STORED_MESSAGE_CONTENT),
      createdAt: new Date().toISOString(),
    },
  ])

  return {
    reply: normalizeText(reply),
    history: savedHistory,
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    throw new Error('Unable to identify current WeChat user.')
  }

  const action = ['quickReply', 'chatReply', 'voiceTurn', 'loadHistory', 'clearHistory', 'recognizeSchedule'].includes(event.action) ? event.action : 'chatReply'
  const language = normalizeLanguage(event.language)
  const petName = limitText(event.petName, 24) || (language === 'zh' ? '可可' : 'Koko')
  const personaPrompt = limitText(event.personaPrompt, MAX_PERSONA_PROMPT_CONTENT) || defaultPetPersonaPrompt
  const systemPrompt = `${personaPrompt}\n${languageInstruction(language)}\nCurrent pet name: ${petName}`

  if (action === 'loadHistory') {
    const record = await loadUserChatHistoryRecord(OPENID)
    return {
      history: record && record.messages ? record.messages : [],
    }
  }

  if (action === 'clearHistory') {
    await clearUserChatHistory(OPENID)
    return {
      history: [],
    }
  }

  const apiKey = normalizeText(process.env.QWEN_API_KEY)
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured for cloud function pet-dialogue.')
  }

  if (action === 'recognizeSchedule') {
    return {
      courses: await recognizeScheduleFromImage(event.fileID, apiKey),
    }
  }

  if (action === 'voiceTurn') {
    const transcript = await recognizeVoiceFromFile(event.fileID, apiKey)
    if (!transcript) {
      throw new Error('voiceTurn requires a recognizable audio file.')
    }

    const chatResult = await appendChatReply({
      openid: OPENID,
      finalUserMessage: transcript,
      contextMessages: event.messages,
      systemPrompt,
      apiKey,
    })
    const audio = await synthesizeSpeech(chatResult.reply, apiKey)

    return {
      transcript,
      reply: chatResult.reply,
      content: chatResult.reply,
      audioFileID: audio.audioFileID,
      audioTempUrl: audio.audioTempUrl,
      history: chatResult.history,
    }
  }

  if (action === 'quickReply') {
    const reply = await requestQwenReply(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content:
            language === 'zh'
              ? '用户刚刚点击或双击了你，请随机说一句亲近的短问候。'
              : 'The user just tapped or double-tapped you. Say one short affectionate greeting.',
        },
      ],
      60,
      apiKey,
    )

    return {
      content: normalizeText(reply),
    }
  }

  const userMessage = limitText(event.userMessage, MAX_USER_MESSAGE_CONTENT)
  const messageFromContext = sanitizeMessages(event.messages)
    .reverse()
    .find((item) => item.role === 'user')
  const finalUserMessage = userMessage || (messageFromContext && messageFromContext.content)

  if (!finalUserMessage) {
    throw new Error('chatReply requires userMessage or messages context.')
  }

  const chatResult = await appendChatReply({
    openid: OPENID,
    finalUserMessage,
    contextMessages: event.messages,
    systemPrompt,
    apiKey,
  })

  return {
    content: chatResult.reply,
    history: chatResult.history,
  }
}
