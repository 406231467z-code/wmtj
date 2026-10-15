/**
 * 命盘库（localStorage）
 *
 * 只存「基本信息」，不存排盘结果：
 *   姓名 / 性别 / 历法 / 出生年月日时分 / 闰月 / 经度 / 时间基准
 * 点开某个命盘时，用这些信息现跑一次 paipan()。
 * 排盘结果随时可重算，存下来既占空间，又会随安星配置变更而过期。
 *
 * 两个键：
 *   wenmo_ziwei_charts  命盘列表（基本信息数组）
 *   wenmo_ziwei_draft   当前表单草稿 + 当前打开的命盘 id（刷新不丢）
 */

const LS_CHARTS = 'wenmo_ziwei_charts'
const LS_DRAFT = 'wenmo_ziwei_draft'

/** 命盘上限，防止无限堆积撑爆 localStorage */
const MAX_CHARTS = 200

/** 一条命盘记录里属于「基本信息」的字段（其余为 id / 时间戳等元信息） */
export const FORM_KEYS = [
  'name', 'sex', 'calendar',
  'year', 'month', 'day', 'hour', 'minute',
  'isLeap', 'jd', 'trueSolarTime'
]

/** 从任意来源（表单 / 命盘记录）里只挑出基本信息 */
export function pickForm(src) {
  const o = {}
  for (const k of FORM_KEYS) o[k] = src?.[k]
  return o
}

/* ---------------- 底层读写（localStorage 在隐私模式下不可用，全部兜底） ---------------- */

function safeGet(k) {
  try {
    return globalThis.localStorage?.getItem(k) ?? null
  } catch {
    return null
  }
}

function safeSet(k, v) {
  try {
    globalThis.localStorage?.setItem(k, v)
  } catch {
    /* 无痕模式 / 配额已满：内存态仍可用，只是刷新后不保留 */
  }
}

function newId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/* ---------------- 命盘列表 ---------------- */

export function loadCharts() {
  try {
    const raw = safeGet(LS_CHARTS)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((c) => c && typeof c === 'object' && c.id)
      .map((c) => ({ ...pickForm(c), id: c.id, createdAt: c.createdAt || 0, updatedAt: c.updatedAt || 0 }))
  } catch {
    return []
  }
}

function writeCharts(list) {
  safeSet(LS_CHARTS, JSON.stringify(list.slice(0, MAX_CHARTS)))
}

/** 新建，返回带 id 的完整记录 */
export function createChart(data) {
  const list = loadCharts()
  const now = Date.now()
  const c = { id: newId(), ...pickForm(data), createdAt: now, updatedAt: now }
  list.unshift(c)
  writeCharts(list)
  return c
}

/** 更新基本信息；id 不存在返回 null */
export function updateChart(id, data) {
  const list = loadCharts()
  const i = list.findIndex((c) => c.id === id)
  if (i < 0) return null
  list[i] = { ...list[i], ...pickForm(data), updatedAt: Date.now() }
  writeCharts(list)
  return list[i]
}

/** 删除，返回删除后的列表 */
export function deleteChart(id) {
  const list = loadCharts().filter((c) => c.id !== id)
  writeCharts(list)
  return list
}

/** 按更新时间倒序（最近用过的在前） */
export function sortCharts(list) {
  return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

/* ---------------- 当前草稿 ---------------- */

/**
 * 草稿 = 当前表单 + 当前打开的命盘 id。
 * 每次成功排盘 / 保存 / 打开命盘都会写一次，刷新后原样恢复。
 */
export function loadDraft() {
  try {
    const raw = safeGet(LS_DRAFT)
    if (!raw) return null
    const d = JSON.parse(raw)
    return d && typeof d === 'object' ? d : null
  } catch {
    return null
  }
}

export function saveDraft(form, activeId) {
  safeSet(LS_DRAFT, JSON.stringify({ form: pickForm(form), activeId: activeId || '' }))
}

export function clearDraft() {
  try {
    globalThis.localStorage?.removeItem(LS_DRAFT)
  } catch {
    /* 忽略 */
  }
}
