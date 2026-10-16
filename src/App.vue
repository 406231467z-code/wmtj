<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { paipan } from './ziwei/paipan.js'
import {
  buildXianPan,
  xianGongName,
  xianYao,
  xianSiHuaOf
} from './ziwei/xianpan.js'
import { CFG_AFFECT_PAN, makeCfg, loadCfg, saveCfg } from './ziwei/config.js'
import { buildMarkdown } from './ziwei/export.js'
import { lunar2solar, solarMonthDays } from './ziwei/lunar.js'
import {
  loadCharts, createChart, updateChart, deleteChart, sortCharts,
  loadDraft, saveDraft, pickForm, FORM_KEYS
} from './ziwei/store.js'
import * as D from './ziwei/data.js'
import buildLocalBaziResult from './bazi/utils/baziLunarLocal.js'
import { buildBaziMarkdown } from './bazi/export.js'
import ZiweiPan from './components/ZiweiPan.vue'
import BaziPan from './components/BaziPan.vue'
import XianBar from './components/XianBar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ChartLibrary from './components/ChartLibrary.vue'

const DEFAULTS = {
  name: '',
  sex: 1,
  calendar: 'solar',
  year: 1990,
  month: 6,
  day: 15,
  hour: 12,
  minute: 0,
  isLeap: false,
  jd: 120,
  trueSolarTime: true
}

const form = reactive({ ...DEFAULTS })
const quick = ref('')
const quickInfo = ref('')
const error = ref('')
const pan = ref(null)
const panRef = ref(null)
const sel = ref(0)

/* ---------------- 术数模式：紫微 / 八字（同一份出生资料，选择后记忆） ---------------- */

const MODES = [
  { k: 'ziwei', t: '紫微斗数' },
  { k: 'bazi', t: '八字' }
]
const MODE_KEY = 'tianjige_mode'

function readMode() {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v && MODES.some((m) => m.k === v)) return v
  } catch (e) {
    /* 读不到就用默认模式 */
  }
  return 'ziwei'
}

const mode = ref(readMode())
watch(
  mode,
  (v) => {
    try {
      localStorage.setItem(MODE_KEY, v)
    } catch (e) {
      /* 写不进去只影响下次打开 */
    }
    syncMbInk()
  },
  { immediate: true }
)

/** 术数切换器的滑块定位：按当前选中按钮的实测几何写 --mb-x / --mb-w */
const modeSwitchRef = ref(null)
const mbOffset = ref(0)
const mbWidth = ref(0)

function syncMbInk() {
  const el = modeSwitchRef.value
  if (!el) return
  const btns = el.querySelectorAll('.mb')
  const i = MODES.findIndex((m) => m.k === mode.value)
  const btn = btns[i]
  if (!btn) return
  mbOffset.value = btn.offsetLeft - el.clientLeft - 3
  mbWidth.value = btn.offsetWidth
}

const mbStyle = computed(() => ({
  '--mb-x': mbOffset.value + 'px',
  '--mb-w': mbWidth.value ? mbWidth.value + 'px' : 'calc((100% - 8px) / 2)'
}))

/** 八字盘：与紫微共用 form，切到八字时现算 */
const baziRaw = ref(null)
const baziError = ref('')

/** 八字当前选择层级：0 本命 / 1 大运 / 2 流年 / 3 流月 */
const bzSel = reactive({ depth: 0, dyIndex: 0, lnIndex: 0, lyIndex: 0 })

/** 把紫微表单折算成八字引擎参数（引擎与紫微各自独立算，互不影响） */
function baziParams() {
  const p = readForm()
  return {
    date: `${p.year}-${p2(p.month)}-${p2(p.day)}`,
    time: `${p2(p.hour)}:${p2(p.minute)}:00`,
    zone: 8,
    ad: 1,
    lon: p.jd,
    lat: 30,
    gender: p.sex === 2 ? 0 : 1,
    // 八字不认 checkbox，只认 timeAlg 档：真太阳时开 → 0（经度差 + 均时差）
    timeAlg: p.trueSolarTime ? 0 : 3,
    after23NewDay: 1,
    // 点选流年后展开该年流月（引擎默认只展开「当前公历年所在大运」）
    forceMonths: bzSel.depth >= 2 ? { dyIndex: bzSel.dyIndex, lnIndex: bzSel.lnIndex } : null
  }
}

/** 只重算八字盘，不动当前选择（点选流年后需要展开该年流月时用） */
function refreshBazi() {
  try {
    baziRaw.value = buildLocalBaziResult(baziParams())
    baziError.value = ''
  } catch (e) {
    baziError.value = e.message
    baziRaw.value = null
  }
}

/** 大运 / 流年 / 流月点选：层级联动（选大运清流年流月，选流年清流月） */
function pickDayun(i) {
  if (bzSel.depth === 1 && bzSel.dyIndex === i) {
    bzSel.depth = 0
    return
  }
  bzSel.depth = 1
  bzSel.dyIndex = i
  bzSel.lnIndex = 0
  bzSel.lyIndex = 0
}

function pickLiunian(i) {
  if (bzSel.depth === 2 && bzSel.lnIndex === i) {
    bzSel.depth = 1
    bzSel.lyIndex = 0
    return
  }
  bzSel.depth = 2
  bzSel.lnIndex = i
  bzSel.lyIndex = 0
  // 该年流月此前可能是 null（引擎只对当前公历年所在大运预计算），补算一次
  refreshBazi()
}

function pickLiuyue(i) {
  if (bzSel.depth === 3 && bzSel.lyIndex === i) {
    bzSel.depth = 2
    return
  }
  bzSel.depth = 3
  bzSel.lyIndex = i
}

/* ---------------- 界面风格（4 套皮肤，选择后记忆） ---------------- */

/** 皮肤只换 CSS 变量集，同一份 DOM 不重渲染 */
const SKINS = [
  { k: 'xuanzhi', zi: '宣纸', nm: '水墨', label: '宣纸 · 水墨' },
  { k: 'qingyu', zi: '青玉', nm: '錾刻', label: '青玉 · 錾刻' },
  { k: 'cyber', zi: '赛博', nm: '玻璃', label: '赛博 · 玻璃' },
  { k: 'night', zi: '深夜', nm: '护眼', label: '深夜 · 护眼' }
]
const SKIN_KEY = 'tianjige_skin'

/** localStorage 在隐私模式下可能抛错，读写都兜一下 */
function readSkin() {
  try {
    const v = localStorage.getItem(SKIN_KEY)
    if (v && SKINS.some((s) => s.k === v)) return v
  } catch (e) {
    /* 读不到就用默认皮肤 */
  }
  return 'xuanzhi'
}

const skin = ref(readSkin())
const skinMeta = computed(() => SKINS.find((s) => s.k === skin.value) || SKINS[0])
const skinZi = computed(() => skinMeta.value.zi)
const skinNm = computed(() => skinMeta.value.nm)

watch(
  skin,
  (v) => {
    document.documentElement.dataset.skin = v
    try {
      localStorage.setItem(SKIN_KEY, v)
    } catch (e) {
      /* 写不进去只影响下次打开，本次显示不受影响 */
    }
  },
  { immediate: true }
)

/* ---------------- 命盘库（localStorage，只存基本信息） ---------------- */

/** 已保存的命盘列表 */
const charts = ref(loadCharts())
/** 当前打开的命盘 id；'' = 临时盘（尚未保存） */
const activeId = ref('')

const activeChart = computed(() => charts.value.find((c) => c.id === activeId.value) || null)

/**
 * 表单内容是否已偏离当前命盘（未保存修改）。
 * 用「比对字段」而不是监听改动事件，打开 / 保存后自动归位，不会误报。
 */
const dirty = computed(() => {
  if (!pan.value) return false
  const cur = pickForm(readForm())
  if (!activeChart.value) return true
  return FORM_KEYS.some((k) => String(activeChart.value[k]) !== String(cur[k]))
})

/** 保存成功后的短提示 */
const savedFlash = ref('')
function flash(msg) {
  savedFlash.value = msg
  setTimeout(() => {
    if (savedFlash.value === msg) savedFlash.value = ''
  }, 2500)
}

/** 安星 / 显示配置（源码 cfg_*） */
const cfg = ref(loadCfg())
/** 星曜分类显示。杂曜（神煞）跟随 cfg_shensha，其余为本地视图状态 */
const showGroups = reactive({
  zhu: true,
  fu: true,
  sha: true,
  xiao: loadCfg().cfg_shensha !== false
})

/** 限盘：盘面类型 + 大限 / 流年 / 流月 / 流日 / 流时序号 */
const view = ref('benming')
const dxIndex = ref(1)
const lnIndex = ref(1)
const lyIndex = ref(1)
const lrIndex = ref(1)
const lsIndex = ref(1)

/**
 * 布局：grid = 传统 4×4 盘面；list = 宫位卡片列表（手机友好，每宫完整可读）
 * 窄屏首次访问默认列表；用户选择记入 localStorage。
 */
const LAYOUT_KEY = 'wenmo_ziwei_layout'
/**
 * 默认一律用盘面（4×4，手机上同样铺满一屏、内容不省略）。
 * 列表模式仍可在工具条手动切换，但不再按屏宽自动切过去。
 */
const layout = ref(localStorage.getItem(LAYOUT_KEY) || 'grid')

function setLayout(v) {
  layout.value = v
  try {
    localStorage.setItem(LAYOUT_KEY, v)
  } catch {
    /* 隐私模式下 localStorage 不可写，忽略 */
  }
}

/** 限级深度：与源码 vars.WenMoTianJiK3B6341B90C21400385FA75F73F5DEB84K 对应 */
const XIAN_DEPTH = {
  benming: 0, daxian: 1, liunian: 2, liuyue: 3, liuri: 4, liushi: 5, xiaoxian: 0
}

/**
 * 底栏限流速查表点击 —— 层级联动照搬源码
 *   （dxBtnClickHandler:1093-1152 / lnBtnClickHandler:1195-1241 /
 *     lyBtnClickHandler:1291-1364 / lrBtnClickHandler / lsBtnClickHandler）
 *   1. 选某一级 → 该级写入序号，并清空其下所有级
 *   2. 已选中的格子再点一次 → 退回上一级（由 XianBar 判断后发出上一级）
 *   3. 「起限前(童限)」→ 回本命盘（dxIndex=0）
 */
function onXianPick(e) {
  const lv = e.level
  if (lv === 'benming') {
    view.value = 'benming'
    dxIndex.value = 0
  } else if (lv === 'daxian') {
    view.value = 'daxian'
    if (e.dx !== undefined) dxIndex.value = e.dx
  } else if (lv === 'liunian') {
    view.value = 'liunian'
    if (e.ln !== undefined) lnIndex.value = e.ln
  } else if (lv === 'liuyue') {
    view.value = 'liuyue'
    if (e.ly !== undefined) lyIndex.value = e.ly
  } else if (lv === 'liuri') {
    view.value = 'liuri'
    if (e.lr !== undefined) lrIndex.value = e.lr
  } else if (lv === 'liushi') {
    view.value = 'liushi'
    if (e.ls !== undefined) lsIndex.value = e.ls
  }

  const depth = XIAN_DEPTH[view.value] || 0
  if (depth < 2) lnIndex.value = 0
  if (depth < 3) lyIndex.value = 0
  if (depth < 4) lrIndex.value = 0
  if (depth < 5) lsIndex.value = 0

  sel.value = 0
  panRef.value?.clear()
}

/**
 * 工具条直接切盘级 —— 省得从「流日盘」回「大限盘」要先点起限前、再点一次大限。
 * 上级序号缺失时补默认值，避免出现「流月盘却没选流年」这种半配置状态。
 */
function gotoView(k) {
  const depth = XIAN_DEPTH[k] || 0
  if (depth >= 1 && dxIndex.value < 1) dxIndex.value = 1
  if (depth >= 2 && lnIndex.value < 1) lnIndex.value = 1
  if (depth >= 3 && lyIndex.value < 1) lyIndex.value = 1
  if (depth >= 4 && lrIndex.value < 1) lrIndex.value = 1
  if (depth >= 5 && lsIndex.value < 1) lsIndex.value = 1
  view.value = k
  // 与 onXianPick 一致：比当前盘级深的序号一律清空，别让上一层的残留序号影响 xianPan
  if (depth < 2) lnIndex.value = 0
  if (depth < 3) lyIndex.value = 0
  if (depth < 4) lrIndex.value = 0
  if (depth < 5) lsIndex.value = 0
  sel.value = 0
  panRef.value?.clear()
}

/** 当前盘级在 VIEWS 里的下标，工具条高亮用 */
const viewIdx = computed(() => VIEWS.findIndex((v) => v.k === view.value))

/** 限盘数据（本命盘时也计算，供下拉列表使用） */
const xianPan = computed(() => {
  if (!pan.value) return null
  return buildXianPan(
    pan.value, view.value, dxIndex.value, lnIndex.value,
    lyIndex.value, lrIndex.value, lsIndex.value
  )
})

/** 选中宫在限盘下的信息（大限/流年/流月宫名、岁前星、将前星、运流曜） */
const xianGong = computed(() =>
  sel.value && xianPan.value ? xianPan.value.gongs[sel.value - 1] : null
)

const xianSiHua = computed(() => (xianPan.value ? xianSiHuaOf(xianPan.value, view.value) : []))
const xianYaoList = computed(() => xianYao(xianGong.value, view.value))

const XIAN_LABEL = {
  daxian: '大限', liunian: '流年', liuyue: '流月',
  liuri: '流日', liushi: '流时', xiaoxian: '小限'
}

/** 盘级 → 文件名用词（导出命名用，避免拼音/中文混排） */
const XIAN_LABEL_EN = {
  benming: '本命', daxian: '大限', liunian: '流年', liuyue: '流月',
  liuri: '流日', liushi: '流时', xiaoxian: '小限'
}

/**
 * 盘面类型清单 —— 模板里 view 切换按钮、导出标题、URL 参数校验共用。
 * k = key（写入 URL 的 ?view=），t = 中文标题，d = 可选描述
 */
const VIEWS = [
  { k: 'benming', t: '本命盘', d: '静态先天盘' },
  { k: 'daxian', t: '大限盘', d: '十年一运' },
  { k: 'liunian', t: '流年盘', d: '逐年太岁' },
  { k: 'liuyue', t: '流月盘', d: '逐月' },
  { k: 'liuri', t: '流日盘', d: '逐日' },
  { k: 'liushi', t: '流时盘', d: '逐时辰' },
  { k: 'xiaoxian', t: '小限盘', d: '逐年小限' }
]
const xianGanText = computed(() => {
  if (!xianPan.value || view.value === 'benming') return ''
  const x = xianPan.value
  if (view.value === 'daxian') return `大限落 ${x.dx.gongName}宫（${x.dx.gz}）`
  if (view.value === 'liunian') return `流年 ${x.ln.year} ${x.ln.gz}`
  if (view.value === 'liuyue') return `流月 ${x.lyIndex}月`
  if (view.value === 'liuri') return `流日 ${x.lrIndex}日 ${x.lrGanZhi}`
  if (view.value === 'liushi') return `流时 ${D.ZHI[x.lsZhi - 1]}时 ${x.lsGanZhi}`
  if (view.value === 'xiaoxian') {
    return `小限 ${D.ZHI[x.xxMingGong - 1]}宫（${x.xxMingGong ? pan.value.gongs[x.xxMingGong - 1].ganName + pan.value.gongs[x.xxMingGong - 1].zhiName : '—'}）`
  }
  return ''
})

/** 地支名（模板里选时辰用） */
const D_ZHI = D.ZHI

const p2 = (n) => String(n).padStart(2, '0')

/**
 * 表单数字字段解析：空串 / 非数字一律返回 NaN，交给 validate 报错。
 *
 * 旧实现是 `parseInt(v) || 默认值`，会把「清空」和「打错字」都静悄悄变成默认值：
 *   经度填 0 → 120（`parseFloat('0') || 120`，0 是假值）
 *   年份清空 → 1990；月份清空 → 1；小时清空 → 0
 * 用户看不到任何提示，拿到的是一盘错的命盘。现在明确区分「没填」和「填错」。
 */
const num = (v) => {
  const s = String(v ?? '').trim()
  if (s === '') return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** 读取表单并做类型转换（输入框用 text，避免浏览器原生校验拦截提交） */
function readForm() {
  const jd = num(form.jd)
  return {
    name: String(form.name || '').trim(),
    sex: +form.sex,
    calendar: form.calendar,
    year: num(form.year),
    month: num(form.month),
    day: num(form.day),
    hour: num(form.hour),
    minute: num(form.minute),
    isLeap: !!form.isLeap,
    // 经度留空 = 用默认 120；填了就必须是 0-180 的数字
    jd: Number.isFinite(jd) ? jd : String(form.jd ?? '').trim() === '' ? 120 : NaN,
    trueSolarTime: !!form.trueSolarTime,
    cfg: cfg.value
  }
}

/**
 * 自行校验，非法时给出明确提示（不再依赖浏览器原生校验）。
 * 除了范围，还校验「这个日期真的存在」——公历看当月天数，农历查闰月与月长。
 * 空字段 / 非数字也逐项报错，不再静默默认。
 */
function validate(p) {
  const name = String(p.name || '').trim()
  if (!name) return '请填写姓名（命盘库靠姓名区分，保存前必须填写）'
  if (name.length > 20) return '姓名请控制在 20 个字以内'

  if (!Number.isFinite(p.year)) return '请填写出生年份'
  if (!Number.isInteger(p.year) || p.year < 1900 || p.year > 2100) return '年份需在 1900 - 2100 之间'
  if (!Number.isFinite(p.month)) return '请填写出生月份'
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) return '月份需在 1 - 12 之间'
  if (!Number.isFinite(p.hour)) return '请填写出生小时（0 - 23，不确定可填 0）'
  if (!Number.isInteger(p.hour) || p.hour < 0 || p.hour > 23) return '小时需在 0 - 23 之间'
  if (!Number.isFinite(p.minute)) return '请填写出生分钟（0 - 59，不确定可填 0）'
  if (!Number.isInteger(p.minute) || p.minute < 0 || p.minute > 59) return '分钟需在 0 - 59 之间'
  if (!Number.isFinite(p.jd)) return '经度需填数字（留空则用默认 120）'
  if (p.jd < 0 || p.jd > 180) return '经度需在 0 - 180 之间'

  if (p.calendar === 'lunar') {
    // 农历：不存在该闰月 / 日超出当月天数时，lunar2solar 返回 -1
    if (lunar2solar(p.year, p.month, p.day, p.isLeap) === -1) {
      return p.isLeap
        ? `${p.year} 年没有闰${p.month}月，请取消「闰月」或改月份`
        : `农历 ${p.year} 年 ${p.month} 月没有 ${p.day} 日，请检查月 / 日`
    }
  } else {
    const md = solarMonthDays(p.year, p.month)
    if (!Number.isInteger(p.day) || p.day < 1 || p.day > md) {
      return `${p.year} 年 ${p.month} 月只有 ${md} 天，日期需在 1 - ${md} 之间`
    }
    // 整体支持范围（与 paipan 内的 solar2lunar 一致）
    if (p.year === 1900 && (p.month < 1 || (p.month === 1 && p.day < 31))) return '支持范围最早为 1900-01-31'
    if (p.year === 2100 && (p.month > 12 || (p.month === 12 && p.day > 1))) return '支持范围最晚为 2100-12-01'
  }
  return ''
}

/**
 * 排盘主入口：点击「开始排盘」或回车触发。只算不存，存盘要点「保存命盘」
 *
 * 紫微与八字共用同一份出生资料：这里两盘一起算，
 * 顶部切换术数时立即出盘，不用重算也不用重新点排盘。
 */
function doPaipan() {
  const p = readForm()
  const msg = validate(p)
  if (msg) {
    error.value = msg
    return
  }
  try {
    pan.value = paipan(p)
    error.value = ''
    // 排盘后回到「起限前(童限) = 本命盘」，各级序号清空，与源码一致
    // （源码在返回本命盘时把 _dxIndex / _lnIndex / _lyIndex / _lrIndex / _lsIndex 全部置 0）
    dxIndex.value = 0
    lnIndex.value = 0
    lyIndex.value = 0
    lrIndex.value = 0
    lsIndex.value = 0
    panRef.value?.clear()
    // 刷新后原样恢复（只存基本信息）
    saveDraft(p, activeId.value)
  } catch (e) {
    error.value = e.message
    pan.value = null
  }
  // 八字独立算：紫微失败也不影响八字出盘（反之亦然）
  try {
    baziRaw.value = buildLocalBaziResult(baziParams())
    baziError.value = ''
    bzSel.depth = 0
    bzSel.dyIndex = 0
    bzSel.lnIndex = 0
    bzSel.lyIndex = 0
  } catch (e) {
    baziError.value = e.message
    baziRaw.value = null
  }
}

/* ---------------- 命盘库操作 ---------------- */

/** 保存：有当前命盘就更新它，没有就新建 */
function saveChart() {
  const p = readForm()
  const msg = validate(p)
  if (msg) {
    error.value = msg
    return
  }
  const data = pickForm(p)
  const c = activeId.value ? updateChart(activeId.value, data) : createChart(data)
  if (!c) {
    // 命盘可能已在别处被删掉，按新建处理
    const n = createChart(data)
    activeId.value = n.id
    flash(`已新建命盘「${n.name}」`)
  } else {
    activeId.value = c.id
    flash(`已保存「${c.name}」`)
  }
  charts.value = loadCharts()
  saveDraft(data, activeId.value)
  if (!pan.value) doPaipan()
}

/** 另存为新盘：当前资料不动，额外存成一条新记录 */
function saveAsNew() {
  const p = readForm()
  const msg = validate(p)
  if (msg) {
    error.value = msg
    return
  }
  const data = pickForm(p)
  const c = createChart(data)
  activeId.value = c.id
  charts.value = loadCharts()
  saveDraft(data, c.id)
  flash(`已另存为新命盘「${c.name}」`)
}

/** 打开命盘：把基本信息填回表单并立即排盘 */
function openChart(id) {
  const c = charts.value.find((x) => x.id === id)
  if (!c) return
  Object.assign(form, pickForm(c))
  activeId.value = c.id
  error.value = ''
  quickInfo.value = ''
  doPaipan()
}

/** 删除命盘 */
function removeChart(id) {
  charts.value = deleteChart(id)
  if (activeId.value === id) {
    // 删掉的正好是当前打开的：断开关联，表单原样留着当临时盘
    activeId.value = ''
    saveDraft(readForm(), '')
  }
  flash('已删除')
}

/** 新建：清空表单，脱离当前命盘，进入未保存的临时状态 */
function newChart() {
  activeId.value = ''
  Object.assign(form, DEFAULTS)
  quick.value = ''
  quickInfo.value = ''
  error.value = ''
  pan.value = null
  baziRaw.value = null
  baziError.value = ''
  sel.value = 0
  bzSel.depth = 0
  bzSel.dyIndex = 0
  bzSel.lnIndex = 0
  bzSel.lyIndex = 0
  saveDraft(readForm(), '')
}

/** 重置 = 清空重填（等价于新建草稿） */
function reset() {
  newChart()
}

/** 配置变更：影响排盘的自动重排，仅影响显示的只存盘 */
function onCfgChange(key) {
  saveCfg(cfg.value)
  // 神煞开关联动「杂曜」显示
  if (key === 'cfg_shensha') showGroups.xiao = cfg.value.cfg_shensha !== false
  if (CFG_AFFECT_PAN.includes(key) && pan.value) {
    doPaipan()
  }
}

function resetCfg() {
  cfg.value = makeCfg()
  saveCfg(cfg.value)
  // 旧实现漏了这行：恢复默认后若神煞是开着的，杂曜仍会因为 showGroups.xiao 停在 false 而不显示
  showGroups.xiao = cfg.value.cfg_shensha !== false
  doPaipan()
}


function onSelect(i) {
  sel.value = i
  // 大限盘下点某宫 = 切到该宫所在的大限
  if (i && pan.value && view.value === 'daxian') {
    dxIndex.value = pan.value.gongs[i - 1].daXianIndex
  }
}

const selGong = computed(() => (sel.value && pan.value ? pan.value.gongs[sel.value - 1] : null))

const gongAt = (i) => (pan.value ? pan.value.gongs[i - 1] : null)
const starsIn = (g, a, b) => (g ? g.stars.filter((s) => s.id >= a && s.id <= b) : [])
const sihuaText = (arr) => arr.map((s) => `${s.star}${s.type}`).join(' ') || '—'

/**
 * 自化文案：两条都要列，不能只列一条
 *   向心 ↑ = 对宫宫干四化化到本宫这颗星（源码 ziHua_XiangXin，GONG:4029-4034）
 *   离心 ↓ = 本宫宫干四化化到本宫这颗星（源码 ziHua_LiXin，  GONG:4017-4022）
 * 源码盘面文本导出（盘面文本:5071-5082）也是 ↑/↓ 两路分开输出。
 */
const zihuaText = (g) => {
  if (!g) return '—'
  const zs = []
  for (const z of g.ziHuaXiangXin || []) zs.push(`${z.star}化${z.type}↑向心`)
  for (const z of g.ziHua || []) zs.push(`${z.star}化${z.type}↓离心`)
  return zs.join('、') || '—'
}

/** 选中宫的四化飞星：本宫天干四化 → 星曜 → 落入何宫 */
const feiXing = computed(() => {
  if (!selGong.value) return []
  return selGong.value.ganSiHua.map((s) => ({
    ...s,
    toGong: s.gong ? `${gongAt(s.gong).nameM.trim()}（${gongAt(s.gong).zhiName}宫）` : '—'
  }))
})

/** 盘面上需要标注的飞星落宫 */
const feiXingMarks = computed(() =>
  selGong.value ? selGong.value.ganSiHua.map((s) => s.gong).filter((g) => g > 0) : []
)

/* ---------------- 复制内容（给 AI） ---------------- */

/**
 * 八字 AI 文本：本命四柱恒定给出，再按当前选择追加 大运 / 流年 / 流月 详情。
 * 选到大运就带「原来 + 大运信息」，选到流年再叠流年，选到流月再叠流月。
 */
const baziAiText = computed(() => {
  if (!baziRaw.value) return ''
  try {
    return buildBaziMarkdown({
      pan: baziRaw.value,
      form: { ...form },
      sel: { ...bzSel }
    })
  } catch (e) {
    return `（导出失败：${e.message}）`
  }
})

/** 盘头 + 十二宫总览 + 逐宫点选（12 × 12），随当前限盘自动重算 */
const ziweiAiText = computed(() => {
  if (!pan.value) return ''
  try {
    return buildMarkdown({
      pan: pan.value,
      xian: xianPan.value,
      view: view.value,
      cfg: cfg.value,
      showGroups,
      form: { ...form }
    })
  } catch (e) {
    return `（导出失败：${e.message}）`
  }
})

/** 当前术数模式下的导出文本 */
const aiText = computed(() => (mode.value === 'bazi' ? baziAiText.value : ziweiAiText.value))

const aiChars = computed(() => aiText.value.length)
const copied = ref(false)
/** 复制失败提示（旧实现两条路都失败时仍显示「已复制 ✓」） */
const copyFail = ref(false)

/**
 * 统一剪贴板写入：先走 async clipboard，失败（http / 旧浏览器 / 无权限）回退 execCommand。
 * @returns {boolean} 是否真的写进去了
 */
async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    /* 回退 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = t
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

async function copyAiText() {
  const t = aiText.value
  if (!t) return
  const ok = await copyText(t)
  copied.value = ok
  copyFail.value = !ok
  setTimeout(() => {
    copied.value = false
    copyFail.value = false
  }, 2500)
}

/* ---------------- 大限十年 TXT 下载 ----------------
 * 只在「已选中某个大限」时出现（大限盘 / 流年盘都算选中了大限）。
 * 文档里逐年给出该大限 10 年的完整文本，每年与在页面上点选该流年后
 * 点「复制全部」拿到的内容一字不差（同一套 buildXianPan + buildMarkdown 参数）。
 * 其余盘级（本命 / 流月 / 流日 / 流时 / 小限）不受影响，仍只复制当前这一盘。
 */

/** 是否已选中大限：有 dxIndex 且盘面在大限或流年级 */
const dxDocReady = computed(
  () =>
    !!pan.value &&
    !!xianPan.value &&
    dxIndex.value >= 1 &&
    (view.value === 'daxian' || view.value === 'liunian')
)

/** 该大限内的流年清单（10 年） */
const dxDocYears = computed(() => (dxDocReady.value ? xianPan.value.lnList || [] : []))

/** 整份文档预估字数：单年字数 × 年数（各年长度基本相同） */
const dxDocChars = computed(() => aiChars.value * dxDocYears.value.length)

const dxDocBusy = ref(false)
const dxDocInfo = ref('')

/** 文件名：张三_第3大限26-35岁_十年流年2015-2024.txt */
function dxDocName() {
  const x = xianPan.value
  const nm = String(form.name || '').trim().replace(/[\\/:*?"<>|]/g, '') || '命盘'
  const dx = x?.dx
  const ys = dxDocYears.value
  const range = ys.length ? `${ys[0].year}-${ys[ys.length - 1].year}` : ''
  const seg = dx ? `第${dx.index}大限${dx.startAge}-${dx.endAge}岁` : '大限'
  return `${nm}_${seg}_十年流年${range}.txt`
}

/**
 * 单年正文 —— 与页面上点选该流年后「复制内容（给 AI）」完全一致：
 * view 固定 'liunian'，流月 / 流日 / 流时序号为 0（点选流年时页面就是这么清空的）
 */
function buildYearText(lnIdx) {
  return buildMarkdown({
    pan: pan.value,
    xian: buildXianPan(pan.value, 'liunian', dxIndex.value, lnIdx, 0, 0, 0),
    view: 'liunian',
    cfg: cfg.value,
    showGroups,
    form: { ...form }
  })
}

/** 整份十年文档文本 */
function buildDaXianDoc() {
  const p = pan.value
  const x = xianPan.value
  const dx = x.dx
  const ys = dxDocYears.value
  const SEP = '='.repeat(64)
  const sc = p.solarClock || {}
  const L = []

  L.push('# 紫微斗数 · 十年流年 AI 辅助文本')
  L.push('')
  L.push(`- 姓名：${String(form.name || '').trim() || '—'}`)
  L.push(`- 性别：${+form.sex === 2 ? '女' : '男'}`)
  L.push(
    `- 出生（公历）：${sc.y}-${p2(sc.m)}-${p2(sc.d)} ${p2(sc.h)}:${p2(sc.min)}` +
      (form.trueSolarTime ? '（真太阳时）' : '')
  )
  L.push(`- 四柱：${p.bzText.year} ${p.bzText.month} ${p.bzText.day} ${p.bzText.hour}`)
  L.push(
    `- 五行局：${p.wuXingJuName}　命宫：${(p.mingGongName || '').trim()}　身宫：${(p.shenGongName || '').trim()}`
  )
  L.push('')
  L.push('## 本次导出范围')
  L.push(
    `- 大限：第 ${dx.index} 大限　${dx.startAge}-${dx.endAge} 岁（${dx.startYear}-${dx.endYear} 年）　` +
      `落${dx.gongName}宫（${dx.gz}）`
  )
  L.push(
    `- 涵盖流年：共 ${ys.length} 年（${ys[0].year} ${ys[0].gz} … ${ys[ys.length - 1].year} ${ys[ys.length - 1].gz}）`
  )
  L.push('')
  L.push('## 说明')
  L.push(
    '以下每一年的内容，与在页面中「选中该大限 → 点选该流年」后点「复制全部」得到的文本完全一致：'
  )
  L.push('盘头（含该年流年选择）+ 十二宫总览 + 逐宫点选详情（12 × 12）。')
  L.push('逐年之间用分隔线隔开，可整份投喂给 AI，也可按年份切分后单独提问。')
  L.push('')
  L.push('## 目录')
  ys.forEach((y, i) => L.push(`${i + 1}. ${y.year} ${y.gz}（${y.age} 岁）`))
  L.push('')

  for (let i = 0; i < ys.length; i++) {
    const y = ys[i]
    L.push(SEP)
    L.push(`# 第 ${i + 1} 年 · ${y.year} ${y.gz}（${y.age} 岁）`)
    L.push(SEP)
    L.push('')
    L.push(buildYearText(y.index))
    L.push('')
  }
  return L.join('\n')
}

async function downloadDaXianDoc() {
  if (!dxDocReady.value || dxDocBusy.value) return
  const n = dxDocYears.value.length
  dxDocBusy.value = true
  dxDocInfo.value = '正在生成…'
  try {
    // 先让「正在生成…」渲染出来，再做重活（10 年 × 12×12，约 0.2 秒）
    await new Promise((r) => setTimeout(r, 30))
    const text = buildDaXianDoc()
    // 加 BOM，Windows 记事本打开不乱码
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dxDocName()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    dxDocInfo.value = `已下载「${a.download}」　${text.length} 字 / ${n} 年`
    setTimeout(() => {
      if (dxDocInfo.value.startsWith('已下载')) dxDocInfo.value = ''
    }, 6000)
  } catch (e) {
    dxDocInfo.value = `生成失败：${e.message}`
  } finally {
    dxDocBusy.value = false
  }
}

/* ---------------- 导出下载：当前层级 TXT ---------------- */

const aiDocInfo = ref('')
const aiDocBusy = ref(false)

/**
 * 文件名：张三_八字_第4大运丙戌_2029己酉_清明丁卯.txt
 * 分层拼接，选到哪一层就带哪一层，用户一眼看出这份文本覆盖到哪。
 */
function aiDocName() {
  const nm = String(form.name || '').trim().replace(/[\\/:*?"<>|]/g, '') || '命盘'
  if (mode.value !== 'bazi') {
    return `${nm}_紫微斗数_${XIAN_LABEL_EN[view.value] || view.value}.txt`
  }
  const b = baziRaw.value?.bazi
  if (!b) return `${nm}_八字.txt`
  const seg = ['八字']
  const dy = (b.direction || [])[bzSel.dyIndex]
  if (bzSel.depth >= 1 && dy) {
    seg.push(`第${bzSel.dyIndex + 1}大运${dy.mainDirect?.ganzi || ''}`)
  }
  const ln = dy?.subDirect?.[bzSel.lnIndex]
  if (bzSel.depth >= 2 && ln) {
    seg.push(`${ln.year}${ln.ganzi || ''}`)
  }
  const ly = ln?.flowMonths?.[bzSel.lyIndex]
  if (bzSel.depth >= 3 && ly) {
    seg.push(`${ly.term || ''}${ly.ganzi || ''}`)
  }
  return `${nm}_${seg.join('_')}.txt`
}

/** 下载当前层级的 AI 文本（紫微 / 八字同一入口） */
async function downloadAiDoc() {
  const text = aiText.value
  if (!text || aiDocBusy.value) return
  aiDocBusy.value = true
  aiDocInfo.value = '正在生成…'
  try {
    await new Promise((r) => setTimeout(r, 30))
    // 加 BOM，Windows 记事本打开不乱码
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = aiDocName()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    aiDocInfo.value = `已下载「${a.download}」　${text.length} 字`
    setTimeout(() => {
      if (aiDocInfo.value.startsWith('已下载')) aiDocInfo.value = ''
    }, 6000)
  } catch (e) {
    aiDocInfo.value = `生成失败：${e.message}`
  } finally {
    aiDocBusy.value = false
  }
}

/** 快捷输入：支持 8/10/12 位（年月日 / 年月日时 / 年月日时分） */
function applyQuick() {
  const v = (quick.value || '').replace(/\D/g, '')
  if (!v) {
    quickInfo.value = ''
    return
  }
  if (![8, 10, 12].includes(v.length)) {
    error.value = '快捷输入应为 8 / 10 / 12 位数字：年月日 / 年月日时 / 年月日时分，例如 20180618、2018061804、201806180408'
    return
  }
  form.year = +v.slice(0, 4)
  form.month = +v.slice(4, 6)
  form.day = +v.slice(6, 8)
  form.hour = v.length >= 10 ? +v.slice(8, 10) : 0
  form.minute = v.length >= 12 ? +v.slice(10, 12) : 0
  quickInfo.value = `已填入 ${form.year}-${p2(form.month)}-${p2(form.day)} ${p2(form.hour)}:${p2(form.minute)}`
  error.value = ''
  doPaipan()
}

/* ---------------- 快捷输入 ⇄ 年月日时分 双向同步 ---------------- */

/** 表单里那五个字段拼出来的 12 位串；任一字段为空则为空串 */
const quickText = computed(() => {
  const v = [form.year, form.month, form.day, form.hour, form.minute]
  if (v.some((x) => String(x ?? '').trim() === '')) return ''
  return `${form.year}${p2(+form.month)}${p2(+form.day)}${p2(+form.hour)}${p2(+form.minute)}`
})

/** 正在手动编辑快捷输入框：此时不要被表单回写覆盖 */
const quickEditing = ref(false)

function onQuickFocus() {
  quickEditing.value = true
}

function onQuickBlur() {
  quickEditing.value = false
  quick.value = quickText.value
  quickInfo.value = ''
}

// 表单里改了日期 → 快捷输入同步显示（除非焦点正在快捷输入框里）
watch(quickText, (v) => {
  if (!quickEditing.value) quick.value = v
})

/**
 * 首屏恢复：优先用上次留下的草稿，其次打开最近更新过的命盘，都没有就留空等填写。
 * 只恢复基本信息，排盘在恢复之后现算。
 */
function init() {
  const d = loadDraft()
  if (d && d.form) {
    // 老草稿可能缺字段或存了 null，逐项回落到 DEFAULTS，别把 null 塞进表单
    for (const k of Object.keys(DEFAULTS)) {
      const v = d.form[k]
      form[k] = v === undefined || v === null ? DEFAULTS[k] : v
    }
    activeId.value = d.activeId || ''
  } else if (charts.value.length) {
    const latest = sortCharts(charts.value)[0]
    Object.assign(form, pickForm(latest))
    activeId.value = latest.id
  }
  // 快捷输入框与表单对齐（watch 不会在初始化时触发）
  quick.value = quickText.value
  // 姓名为空说明是全新开始，等用户填完再排，不预排一盘没主人的命盘
  if (String(form.name || '').trim()) doPaipan()
}

/**
 * URL 参数（便于分享 / 复盘，也方便自动化验证）：
 *   ?view=liunian&dx=3&ln=4&ly=6&lr=12&ls=5&sel=8
 * 例：http://host/?view=liunian&sel=1  直接打开「流年盘 + 选中子宫」
 */
function applyUrlParams() {
  const qs = new URLSearchParams(location.search)
  const clamp = (v, lo, hi, d) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
  }
  const v = qs.get('view')
  if (v && VIEWS.some((x) => x.k === v)) view.value = v
  const ly = qs.get('layout')
  if (ly === 'list' || ly === 'grid') layout.value = ly
  if (qs.has('dx')) dxIndex.value = clamp(qs.get('dx'), 1, 12, 1)
  if (qs.has('ln')) lnIndex.value = clamp(qs.get('ln'), 1, 10, 1)
  if (qs.has('ly')) lyIndex.value = clamp(qs.get('ly'), 1, 12, 1)
  if (qs.has('lr')) lrIndex.value = clamp(qs.get('lr'), 1, 30, 1)
  if (qs.has('ls')) lsIndex.value = clamp(qs.get('ls'), 1, 12, 1)
  const s = clamp(qs.get('sel'), 0, 12, 0)
  if (s) {
    sel.value = s
    panRef.value?.selectAt(s)
  }
}

onMounted(() => {
  init()
  // ref 挂载后再应用，否则 panRef 为空
  applyUrlParams()
  // 切换器滑块要在布局稳定后量一次；字体加载完 / 旋转屏幕时再量
  requestAnimationFrame(syncMbInk)
  window.addEventListener('resize', syncMbInk)
  if (document.fonts?.ready) document.fonts.ready.then(syncMbInk).catch(() => {})
})
</script>

<template>
  <div class="app-header">
    <h1>天机阁 · {{ mode === 'bazi' ? '四柱八字排盘' : '紫微斗数排盘' }}</h1>

    <!-- 术数切换：紫微斗数 / 八字。同一份出生资料，两份盘一次算好，切换即刻出盘。
         滑块位置由 modeSwitchRef 实测按钮几何后写入 --mb-x / --mb-w（纯 CSS calc 在
         无单位数乘百分比时不解析，实测像素最稳，换皮肤/换字体也不会错位）。 -->
    <div
      ref="modeSwitchRef"
      class="modeswitch"
      :style="mbStyle"
      role="tablist"
      aria-label="术数"
    >
      <button
        v-for="m in MODES"
        :key="m.k"
        class="mb"
        role="tab"
        type="button"
        :class="{ on: mode === m.k }"
        :aria-selected="mode === m.k ? 'true' : 'false'"
        @click="mode = m.k"
      >
        {{ m.t }}
      </button>
      <span class="mb-ink"></span>
    </div>

    <!-- 风格切换：右上角小胶囊。原生 select 透明覆盖在胶囊上，
         手机上直接调起系统下拉，不占地方。选择写入 localStorage，下次打开默认沿用。 -->
    <div class="skinbar">
      <label class="sel" title="界面风格">
        <span class="seal"><span class="zi">{{ skinZi }}</span></span>
        <span class="nm">{{ skinNm }}</span>
        <svg class="cv" viewBox="0 0 10 6" aria-hidden="true">
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
        <select v-model="skin" aria-label="界面风格">
          <option v-for="s in SKINS" :key="s.k" :value="s.k">{{ s.label }}</option>
        </select>
      </label>
    </div>
  </div>

  <form class="panel" novalidate @submit.prevent="doPaipan">
    <div class="form-grid">
      <div class="field">
        <label>姓名<i class="req">必填</i></label>
        <input v-model="form.name" placeholder="请输入姓名" maxlength="20" />
      </div>

      <div class="field">
        <label>性别</label>
        <div class="radio-group">
          <label><input type="radio" :value="1" v-model.number="form.sex" /> 男</label>
          <label><input type="radio" :value="2" v-model.number="form.sex" /> 女</label>
        </div>
      </div>

      <div class="field">
        <label>历法</label>
        <select v-model="form.calendar">
          <option value="solar">公历</option>
          <option value="lunar">农历</option>
        </select>
      </div>

      <!-- 出生时间：年 / 月 / 日 / 时:分 共用一个标签、排成一行。
           五个框等分宽度（年给 1.4 倍），窄屏也不折行，不再五个独立小框各带一个标签。 -->
      <div class="field span2">
        <label>出生时间</label>
        <div class="dt">
          <input
            class="y"
            type="text"
            inputmode="numeric"
            aria-label="年"
            v-model="form.year"
          />
          <span class="sep">年</span>
          <input type="text" inputmode="numeric" aria-label="月" v-model="form.month" />
          <span class="sep">月</span>
          <input type="text" inputmode="numeric" aria-label="日" v-model="form.day" />
          <span class="sep">日</span>
          <input type="text" inputmode="numeric" aria-label="时" v-model="form.hour" />
          <span class="sep">:</span>
          <input type="text" inputmode="numeric" aria-label="分" v-model="form.minute" />
        </div>
      </div>

      <div v-if="form.calendar === 'lunar'" class="field">
        <label>闰月</label>
        <div class="radio-group">
          <label><input type="checkbox" v-model="form.isLeap" /> 是</label>
        </div>
      </div>

      <div class="field">
        <label>地理经度（东经）</label>
        <input type="text" inputmode="decimal" v-model="form.jd" />
      </div>

      <div class="field">
        <label>时间基准</label>
        <div class="radio-group">
          <label><input type="checkbox" v-model="form.trueSolarTime" /> 真太阳时</label>
        </div>
      </div>

      <div class="field span2">
        <label>快捷输入</label>
        <div class="input-row">
          <!-- keydown + prevent：原来是 keyup，回车会同时触发表单隐式提交，
               同一次按键排两遍盘；invalid 时先被 submit 清掉 error、又被这里写上，顺序混乱 -->
          <input
            v-model="quick"
            placeholder="201806180408"
            @keydown.enter.prevent="applyQuick"
            @focus="onQuickFocus"
            @blur="onQuickBlur"
          />
          <!-- 不用 btn.tiny：tiny 是 22px 小号样式，和旁边 32px 的输入框放一行会显得矮一截、没对齐 -->
          <button class="btn" type="button" @click="applyQuick">确定</button>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn primary" type="submit">开始排盘</button>
      <button class="btn primary" type="button" @click="saveChart">
        {{ activeChart ? '保存修改' : '保存命盘' }}
      </button>
      <button v-if="activeChart" class="btn" type="button" @click="saveAsNew">另存为新盘</button>
      <button class="btn" type="button" @click="reset">清空</button>
      <span v-if="quickInfo" class="quick-info">{{ quickInfo }}</span>
      <span v-if="savedFlash" class="saved-flash">{{ savedFlash }}</span>
    </div>

    <div class="actions status-row">
      <span v-if="activeChart" class="cur-chart">
        当前命盘：<b>{{ activeChart.name }}</b>
        <em v-if="dirty" class="dirty-tip">有未保存的修改</em>
        <em v-else class="saved-tip">已保存</em>
      </span>
      <span v-else-if="pan" class="dirty-tip">临时盘：尚未保存，点「保存命盘」存入命盘库</span>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div class="hint">
      支持范围：1900-01-31 至 2100-12-01；经度默认 120（东经，与源码 _BJJD 基准一致）；快捷键：任一输入框回车 = 排盘。
      快捷输入与上方年 / 月 / 日 / 时 / 分双向同步，填一边另一边跟着变。
    </div>
  </form>

  <!-- 命盘库：只存基本信息，点开即用该信息现排 -->
  <ChartLibrary
    :charts="charts"
    :active-id="activeId"
    @open="openChart"
    @remove="removeChart"
    @new="newChart"
  />

  <!-- ═══════════════ 八字盘 ═══════════════ -->
  <template v-if="mode === 'bazi'">
    <div v-if="!baziRaw" class="panel empty-state">
      <p>
        八字与紫微共用上面这份出生资料：填好<b>姓名</b>与<b>出生时间</b>，点<b>「开始排盘」</b>即可。<br />
        排完后在顶部切到<b>八字</b>，四柱、五行、格局用神、大运流年一次给全。
      </p>
      <p v-if="baziError" class="error">{{ baziError }}</p>
    </div>

    <template v-else>
      <div class="pan-wrap">
        <BaziPan
          :pan="baziRaw"
          :name="form.name"
          :depth="bzSel.depth"
          :dy-index="bzSel.dyIndex"
          :ln-index="bzSel.lnIndex"
          :ly-index="bzSel.lyIndex"
          @pick-dayun="pickDayun"
          @pick-liunian="pickLiunian"
          @pick-liuyue="pickLiuyue"
        />
      </div>

      <!-- 复制内容（给 AI）：本命四柱恒定 + 所选层级（大运 / 流年 / 流月）逐层追加 -->
      <div class="panel export-panel">
        <h3>
          <span class="ex-title">复制内容（给 AI）</span>
          <span class="ex-meta">Markdown · 约 {{ aiChars }} 字</span>
          <button class="btn tiny primary" type="button" @click="copyAiText">
            {{ copied ? '已复制 ✓' : copyFail ? '复制失败' : '复制全部' }}
          </button>
          <span v-if="copyFail" class="ex-warn">浏览器拒绝了剪贴板访问，请展开下方文本框手动全选复制</span>
          <button
            class="btn tiny dl"
            type="button"
            :disabled="aiDocBusy"
            @click="downloadAiDoc"
          >
            {{ aiDocBusy ? '正在生成…' : '下载 TXT' }}
          </button>
          <span v-if="aiDocInfo" class="ex-info">{{ aiDocInfo }}</span>
        </h3>
        <p class="ex-tip">
          恒定给出<b>本命四柱</b>（含五行力量、格局用神、干支关系），再按当前选择逐层追加：
          选中<b>大运</b>带上该运干支十神神煞；再选<b>流年</b>叠加该年；再选<b>流月</b>叠加该月。
          没选就只给本命盘。切换选择后文本自动重算，直接复制投喂 AI 即可。
        </p>
        <textarea class="ex-box" readonly :value="aiText" rows="12"></textarea>
      </div>
    </template>
  </template>

  <!-- ═══════════════ 紫微盘 ═══════════════ -->
  <template v-else>
  <div v-if="!pan" class="panel empty-state">
    <p>
      填一下<b>姓名</b>（出生时间已预填 1990-06-15 12:00，改成实际的即可），然后点<b>「开始排盘」</b>。<br />
      也可以用「快捷输入」直接粘 12 位数字，例如 <b>201806180408</b> = 2018-06-18 04:08。<br />
      满意后点<b>「保存命盘」</b>，就会存进下方的「我的命盘」，以后打开浏览器直接点开即可，刷新不会丢。
    </p>
  </div>

  <SettingsPanel
    v-if="pan"
    :cfg="cfg"
    @change="onCfgChange"
    @reset="resetCfg"
  />

  <div v-if="pan" class="pan-wrap">
    <!-- 工具条：盘级直达 + 盘面/列表切换。
         setLayout 此前只被 URL 参数调用，界面上没有任何入口，列表模式等于不可用。 -->
    <div class="pan-toolbar">
      <div class="pt-seg">
        <span class="pt-label">盘级</span>
        <button
          v-for="(v, i) in VIEWS"
          :key="v.k"
          class="btn tiny pt-btn"
          type="button"
          :class="{ primary: i === viewIdx }"
          :title="v.d"
          @click="gotoView(v.k)"
        >
          {{ v.t }}
        </button>
      </div>
      <div class="pt-seg">
        <span class="pt-label">视图</span>
        <button
          class="btn tiny pt-btn"
          type="button"
          :class="{ primary: layout === 'grid' }"
          title="传统 4×4 盘面"
          @click="setLayout('grid')"
        >
          盘面
        </button>
        <button
          class="btn tiny pt-btn"
          type="button"
          :class="{ primary: layout === 'list' }"
          title="宫位卡片列表，手机上每宫完整可读"
          @click="setLayout('list')"
        >
          列表
        </button>
      </div>
    </div>

    <div class="pan-scroll">
      <ZiweiPan
        ref="panRef"
        :pan="pan"
        :name="form.name"
        :marks="feiXingMarks"
        :fei-list="feiXing"
        :view="view"
        :xian="xianPan"
        :show-groups="showGroups"
        :flags="cfg"
        :layout="layout"
        @select="onSelect"
      />
    </div>

    <!-- 底部限流速查表：大限 / 流年 / 流月 / 流日 / 流时（层级联动，源码 XLP 面板） -->
    <XianBar
      :xian="xianPan"
      :view="view"
      :dx-index="dxIndex"
      :ln-index="lnIndex"
      :ly-index="lyIndex"
      :lr-index="lrIndex"
      :ls-index="lsIndex"
      @pick="onXianPick"
    />

    <!-- 复制内容（给 AI）：盘头 + 十二宫总览 + 逐宫点选 12×12 -->
    <div v-if="pan" class="panel export-panel">
      <h3>
        <span class="ex-title">复制内容（给 AI）</span>
        <span class="ex-meta">Markdown · 约 {{ aiChars }} 字</span>
        <button class="btn tiny primary" type="button" @click="copyAiText">
          {{ copied ? '已复制 ✓' : copyFail ? '复制失败' : '复制全部' }}
        </button>
        <span v-if="copyFail" class="ex-warn">浏览器拒绝了剪贴板访问，请展开下方文本框手动全选复制</span>
        <button
          v-if="dxDocReady"
          class="btn tiny dl"
          type="button"
          :disabled="dxDocBusy"
          @click="downloadDaXianDoc"
        >
          {{ dxDocBusy ? '正在生成…' : `下载本大限十年 TXT（${dxDocYears.length} 年）` }}
        </button>
        <span v-if="dxDocInfo" class="ex-info">{{ dxDocInfo }}</span>
      </h3>
      <p v-if="dxDocReady" class="ex-tip ex-tip-dl">
        当前已选中 <b>第 {{ xianPan.dx.index }} 大限</b>（{{ xianPan.dx.startAge }}-{{
          xianPan.dx.endAge
        }}
        岁）。点上面的按钮下载一份 TXT，里面依次给出这 {{ dxDocYears.length }} 年里<b>每一年</b>的完整文本，
        逐年内容与「选中该大限 → 点选该年 → 复制全部」一字不差，约
        {{ dxDocChars }} 字。本命 / 流月 / 流日 / 流时 / 小限不提供批量下载，仍只复制当前这一盘。
      </p>
      <p class="ex-tip">
        含盘头（写明当前选了哪个大限 / 流年 / 流月…）、十二宫总览，以及依次点选 12 个宫位后的内容。切换大限 /
        流年 / 流月…后自动重算。<b>详略可在「安星 / 显示设置 › AI 文本」切换</b>：精简（默认）只列点选带来的差异
        （立太极换算 + 飞星入宫），固有内容按宫序编号回查总览；完整则把 12×12 全量打印。两版信息等价。
      </p>
      <textarea class="ex-box" readonly :value="aiText" rows="10"></textarea>
    </div>

    <div v-if="selGong" class="panel gong-detail">
      <h3>
        {{ selGong.nameM }}　{{ selGong.ganName }}{{ selGong.zhiName }}　{{ selGong.zhiName }}宫
        <span v-if="selGong.isLaiYin && cfg.cfg_laiyin" class="tag">来因宫</span>
        <button class="btn tiny" @click="panRef?.clear()">关闭</button>
      </h3>

      <div class="kv">
        <div class="k">大限</div>
        <div>{{ selGong.daXianStart }}-{{ selGong.daXianEnd }} 岁（{{ selGong.daXianName }}）</div>
        <div class="k">小限</div>
        <div>{{ selGong.xiaoXianAge }} 岁</div>
        <div class="k">宫干四化</div>
        <div>{{ sihuaText(selGong.ganSiHua) }}</div>
        <template v-if="cfg.cfg_msihua">
          <div class="k">自化</div>
          <div>{{ zihuaText(selGong) }}</div>
        </template>
        <div class="k">十二星</div>
        <div>
          {{ selGong.changSheng || '—' }}　{{ selGong.boShi || '—' }}
          <template v-if="cfg.cfg_sj12s">　岁前：{{ selGong.suiQian || '—' }}</template>
          <template v-if="cfg.cfg_jq12s">　将前：{{ selGong.jiangQian || '—' }}</template>
        </div>
        <template v-if="xianGong && view !== 'benming'">
          <div class="k">限盘宫名</div>
          <div>
            {{ xianGongName(xianPan, xianGong, view) }}
            <span v-if="view === 'liuyue' && xianGong.lyGanZhi">（{{ xianGong.lyGanZhi }}月）</span>
            <span v-if="view === 'liuri' && xianPan.lrGanZhi">（{{ xianPan.lrGanZhi }}日）</span>
            <span v-if="view === 'liushi' && xianPan.lsGanZhi">（{{ xianPan.lsGanZhi }}时）</span>
          </div>
          <template v-if="cfg.cfg_sj12s">
            <div class="k">岁前星</div>
            <div>{{ xianGong.suiQian || '—' }}</div>
          </template>
          <template v-if="cfg.cfg_jq12s">
            <div class="k">将前星</div>
            <div>{{ xianGong.jiangQian || '—' }}</div>
          </template>
          <div class="k">运流曜</div>
          <div>
            <span v-if="xianYaoList.length" class="yao-list">
              <i v-for="(y, i) in xianYaoList" :key="i">{{ y.name }}</i>
            </span>
            <span v-else class="muted">—</span>
          </div>
        </template>
      </div>

      <div class="star-groups">
        <div class="sg">
          <div class="sg-title">主星</div>
          <div class="sg-body">
            <span v-for="s in starsIn(selGong, 1, 14)" :key="s.id" class="chip zhu">
              {{ s.name }}<em v-if="s.brightnessName">{{ s.brightnessName }}</em>
              <i v-for="(h, i) in s.sihua" :key="i" class="sihua">{{ h }}</i>
            </span>
            <span v-if="!starsIn(selGong, 1, 14).length" class="muted">（空宫，借对宫）</span>
          </div>
        </div>
        <div class="sg">
          <div class="sg-title">辅曜</div>
          <div class="sg-body">
            <span v-for="s in starsIn(selGong, 15, 22)" :key="s.id" class="chip fu">
              {{ s.name }}<em v-if="s.brightnessName">{{ s.brightnessName }}</em>
              <i v-for="(h, i) in s.sihua" :key="i" class="sihua">{{ h }}</i>
            </span>
            <span v-if="!starsIn(selGong, 15, 22).length" class="muted">—</span>
          </div>
        </div>
        <div class="sg">
          <div class="sg-title">煞曜</div>
          <div class="sg-body">
            <span v-for="s in starsIn(selGong, 23, 28)" :key="s.id" class="chip sha">
              {{ s.name }}<em v-if="s.brightnessName">{{ s.brightnessName }}</em>
            </span>
            <span v-if="!starsIn(selGong, 23, 28).length" class="muted">—</span>
          </div>
        </div>
        <div class="sg">
          <div class="sg-title">杂曜</div>
          <div class="sg-body">
            <span v-for="s in starsIn(selGong, 29, 82)" :key="s.id" class="chip xiao">
              {{ s.name }}<em v-if="s.brightnessName">{{ s.brightnessName }}</em>
            </span>
            <span v-if="!starsIn(selGong, 29, 82).length" class="muted">—</span>
          </div>
        </div>
      </div>

      <h4>四化飞星（{{ selGong.ganName }} 干）</h4>
      <div class="sf-list">
        <div v-for="(f, i) in feiXing" :key="i" class="sf-item fei">
          <div class="sf-title">{{ f.star }} 化{{ f.type }}</div>
          <div class="sf-stars">飞入 {{ f.toGong }}</div>
        </div>
        <div v-if="!feiXing.length" class="sf-item muted">—</div>
      </div>

      <template v-if="xianPan && view !== 'benming'">
        <h4>{{ XIAN_LABEL[view] }}四化（{{ xianGanText }}）</h4>
        <div class="sf-list">
          <div v-for="(f, i) in xianSiHua" :key="i" class="sf-item fei">
            <div class="sf-title">{{ f.star }} 化{{ f.type }}</div>
            <div class="sf-stars">
              飞入
              {{
                f.gong
                  ? `${gongAt(f.gong).nameM.trim()}（${gongAt(f.gong).zhiName}宫）`
                  : '—'
              }}
            </div>
          </div>
          <div v-if="!xianSiHua.length" class="sf-item muted">—</div>
        </div>
      </template>

      <template v-if="cfg.cfg_3f4z">
        <h4>三方四正</h4>
        <div class="sf-list">
          <div
            v-for="gi in selGong.sanFangSiZheng"
            :key="gi"
            class="sf-item"
            :class="{ cur: gi === selGong.idx }"
          >
            <div class="sf-title">
              {{ gongAt(gi).nameM }}（{{ gongAt(gi).zhiName }}）· {{ gongAt(gi).ganName
              }}{{ gongAt(gi).zhiName }}
            </div>
            <div class="sf-stars">
              {{
                starsIn(gongAt(gi), 1, 14)
                  .map((s) => s.name + (s.brightnessName ? `[${s.brightnessName}]` : ''))
                  .join('、') || '空宫'
              }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <div v-else class="panel empty-tip">请填写出生资料后点击「开始排盘」</div>
  </template>
</template>
