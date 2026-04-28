const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command
const feedbackRecords = db.collection('feedback_records')

// Add production administrator openids here, or set FEEDBACK_ADMIN_OPENIDS in the cloud function environment.
const STATIC_ADMIN_OPENIDS = []
const ENV_ADMIN_OPENIDS = (process.env.FEEDBACK_ADMIN_OPENIDS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const ADMIN_OPENIDS = Array.from(new Set([...STATIC_ADMIN_OPENIDS, ...ENV_ADMIN_OPENIDS]))

const feedbackTypes = ['complaint', 'suggestion']
const feedbackStatuses = ['submitted', 'reviewing', 'resolved', 'rejected']
const now = () => new Date().toISOString()

const normalizeText = (value, maxLength) => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

const normalizeEnum = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

const isAdminOpenid = (openid) => ADMIN_OPENIDS.includes(openid)

const publicRecord = (record, includeOwner = false) => ({
  _id: record._id,
  ownerOpenid: includeOwner ? record.ownerOpenid || record._openid || '' : undefined,
  type: normalizeEnum(record.type, feedbackTypes, 'suggestion'),
  content: normalizeText(record.content, 1000),
  status: normalizeEnum(record.status, feedbackStatuses, 'submitted'),
  adminReply: normalizeText(record.adminReply, 1000),
  createdAt: normalizeText(record.createdAt, 40),
  updatedAt: normalizeText(record.updatedAt, 40),
  repliedAt: normalizeText(record.repliedAt, 40),
})

const listMine = async (openid, isAdmin) => {
  const result = await feedbackRecords
    .where(
      _.or([
        { _openid: openid },
        { ownerOpenid: openid },
      ]),
    )
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  return {
    records: (result.data || []).map((item) => publicRecord(item, false)),
    isAdmin,
  }
}

const listAdmin = async (event, isAdmin) => {
  if (!isAdmin) {
    throw new Error('Only administrators can view all feedback records.')
  }

  const status = event.status === 'all' ? '' : normalizeEnum(event.status, feedbackStatuses, '')
  const query = status ? feedbackRecords.where({ status }) : feedbackRecords
  const result = await query.orderBy('createdAt', 'desc').limit(200).get()

  return {
    records: (result.data || []).map((item) => publicRecord(item, true)),
    isAdmin,
  }
}

const submit = async (event, openid, isAdmin) => {
  const type = normalizeEnum(event.type, feedbackTypes, 'suggestion')
  const content = normalizeText(event.content, 1000)

  if (content.length < 10) {
    throw new Error('Feedback content must be at least 10 characters.')
  }

  const timestamp = now()
  const payload = {
    _openid: openid,
    ownerOpenid: openid,
    type,
    content,
    status: 'submitted',
    adminReply: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    repliedAt: '',
  }

  const created = await feedbackRecords.add({
    data: payload,
  })

  return {
    record: publicRecord(
      {
        _id: created._id,
        ...payload,
      },
      false,
    ),
    isAdmin,
  }
}

const updateAdmin = async (event, isAdmin) => {
  if (!isAdmin) {
    throw new Error('Only administrators can update feedback records.')
  }

  const id = normalizeText(event.id, 80)
  if (!id) {
    throw new Error('Missing feedback record id.')
  }

  const existing = await feedbackRecords.doc(id).get()
  const record = existing.data
  if (!record?._id) {
    throw new Error('Feedback record was not found.')
  }

  const status = normalizeEnum(event.status, feedbackStatuses, record.status || 'submitted')
  const adminReply = normalizeText(event.adminReply, 1000)
  const timestamp = now()
  const data = {
    status,
    adminReply,
    updatedAt: timestamp,
    repliedAt: adminReply ? timestamp : normalizeText(record.repliedAt, 40),
  }

  await feedbackRecords.doc(id).update({
    data,
  })

  return {
    record: publicRecord(
      {
        ...record,
        ...data,
      },
      true,
    ),
    isAdmin,
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    throw new Error('Unable to identify the current WeChat user.')
  }

  const isAdmin = isAdminOpenid(OPENID)
  const action = ['submit', 'listMine', 'listAdmin', 'updateAdmin'].includes(event.action)
    ? event.action
    : 'listMine'

  if (action === 'submit') {
    return submit(event, OPENID, isAdmin)
  }

  if (action === 'listAdmin') {
    return listAdmin(event, isAdmin)
  }

  if (action === 'updateAdmin') {
    return updateAdmin(event, isAdmin)
  }

  return listMine(OPENID, isAdmin)
}
