/**
 * 太乙神数 · 适配层
 *
 * 算法内核 core/*.js 自 horosa 的 components/taiyi/core/ 原样搬入
 * （唯一改动：taiyiSchool 的 dateStrSafe 引用路径）。
 * 本文件把 wmtj 已有的排盘结果翻译成内核要的输入形状，并与界面解耦：
 *   紫微 pan.solarClock → fields（钟表/真太阳时）
 *   八字 bazi.bazi.nongli + fourColumns → nongli（农历月日 + 四柱干支）
 *
 * 内核只用 nongli 的四柱/农历与 fields 的日期时间，不读紫微盘本身。
 */
import {
  TAIYI_STYLE_OPTIONS,
  TAIYI_ACCUM_OPTIONS,
  calcTaiyiPanFromKintaiyi,
  buildTaiyiSnapshotLines,
  getTaiyiStyleLabel,
  getTaiyiAccumLabel,
  getTaiyiMethodSource,
} from './core/TaiYiCore'
import {
  DEFAULT_TAIYI_SCHOOL,
  TAIYI_SCHOOL_OPTIONS,
  applyTaiyiSchool,
  dunOfKook,
  normalizeTaiyiSchool,
  isDefaultSchool,
} from './core/taiyiSchool'
import { computeTaiyiShuli } from './core/taiyiShuli'
import { computeGeju } from './core/taiyiGeju'
import {
  TAIYI_GONG_INFO,
  SHEN_MEANING,
  computeSanyuan,
  computeTaisuiAlias,
  computeShenSuan,
  computeFenye,
  activeDoorJixiong,
  computeEhui,
  computeLimitYun,
  computeShiJing,
  computeWuziyuan,
  computeHeShen,
  computeVictory,
  shenMeaning,
} from './core/taiyiDuanfa'
import { computeTaiyiNayin } from './core/taiyiNayin'

export {
  TAIYI_STYLE_OPTIONS,
  TAIYI_ACCUM_OPTIONS,
  TAIYI_SCHOOL_OPTIONS,
  DEFAULT_TAIYI_SCHOOL,
  TAIYI_GONG_INFO,
  SHEN_MEANING,
  shenMeaning,
  getTaiyiStyleLabel,
  getTaiyiAccumLabel,
  getTaiyiMethodSource,
  dunOfKook,
  normalizeTaiyiSchool,
  isDefaultSchool,
}

/** 起盘方式：時/年/月/日/分計 + 太乙命法（命法在本地内核下只有十二宫标记） */
export const STYLE_OPTIONS = [...TAIYI_STYLE_OPTIONS.slice(), { value: 5, label: '太乙命法' }]

/** 古法公式（积年常数口径） */
export const ACCUM_OPTIONS = TAIYI_ACCUM_OPTIONS.slice()

const PALACE_ORDER = ['巽', '巳', '午', '未', '坤', '申', '酉', '戌', '乾', '亥', '子', '丑', '艮', '寅', '卯', '辰']

const gz = (p) => (p && (p.ganzi || p.ganZhi)) || ''
const pad2 = (v) => String(v).padStart(2, '0')

/** 十六宫归一到固定序（内核的 palace16 顺序即 LAYER 环，这里给渲染一份稳定顺序） */
function normalizePalaces(palace16) {
  const map = {}
  PALACE_ORDER.forEach((p) => { map[p] = [] })
  ;(palace16 || []).forEach((it) => {
    if (!it || !it.palace || !map[it.palace]) return
    map[it.palace] = Array.isArray(it.items) ? it.items.slice(0) : []
  })
  return PALACE_ORDER.map((palace) => ({ palace, items: map[palace] }))
}

/** fields 里内核只要 `.value.format(fmt)`；给一个不依赖 moment 的最小子集 */
const clockField = (text) => ({ value: { format: () => text } })

/**
 * 组装太乙模型。
 * @param {object} p
 * @param {object} p.pan   紫微排盘结果（取 solarClock）
 * @param {object} p.bazi  八字引擎结果（取 nongli / fourColumns）
 * @param {number|string} p.sex 1=男 2=女
 * @param {object} p.opts  起盘选项（style/tn/school/tenching/rotation/gameTheory/timeBasis）
 * @returns null | { pan, nongli, options, derived }
 */
export function buildTaiyiModel({ pan, bazi, sex, opts }) {
  const solar = pan && pan.solarClock
  const bb = bazi && bazi.bazi
  const fc = bb && bb.fourColumns
  if (!solar || !fc) return null
  const year = gz(fc.year)
  const month = gz(fc.month)
  const dayGz = gz(fc.day)
  const hourGz = gz(fc.time)
  if (!year || !month || !dayGz || !hourGz) return null

  const nl = bb.nongli || {}
  const o = opts || {}
  // 时间基准：真太阳时口径取 nongli.solarTime，直接时间取钟表时（与八字引擎四柱同源）
  const basisText = (o.timeBasis === 'trueSolar' && nl.solarTime) ? nl.solarTime : ''
  const clockText = `${solar.y}-${pad2(solar.m)}-${pad2(solar.d)} ${pad2(solar.h)}:${pad2(solar.min)}:00`
  const useText = basisText || nl.clockTime || clockText
  const m = String(useText).match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  const dateText = m ? `${m[1]}-${pad2(m[2])}-${pad2(m[3])}` : clockText.slice(0, 10)
  const timeText = m ? `${pad2(m[4])}:${pad2(m[5])}:${pad2(m[6] || 0)}` : clockText.slice(11)

  const fields = { date: clockField(dateText), time: clockField(timeText) }

  const nongli = {
    year: nl.year || '',
    month: nl.month || '',
    day: nl.day || '',
    leap: !!nl.leap,
    monthInt: nl.monthNum,
    dayInt: nl.dayNum,
    // 立春口径年干支 = 八字年柱（内核按此取太岁/合神）
    yearJieqi: year,
    monthGanZi: month,
    dayGanZi: dayGz,
    time: hourGz,
    minute: '',
    jieqi: nl.jieqi || '',
    jiedelta: nl.jiedelta || '',
    birth: nl.solarTime || '',
    clockTime: nl.clockTime || clockText,
  }

  const options = {
    style: o.style !== undefined ? o.style : 3,
    tn: o.tn !== undefined ? o.tn : 0,
    sex: +sex === 2 ? '女' : '男',
    tenching: o.tenching !== undefined ? o.tenching : 0,
    rotation: o.rotation || '固定',
    timeBasis: o.timeBasis || 'direct',
    after23NewDay: o.after23NewDay !== undefined ? o.after23NewDay : 1,
    lateZiHourUseNextDay: o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : 1,
    gameTheory: o.gameTheory !== undefined ? o.gameTheory : 0,
    school: normalizeTaiyiSchool(o.school || DEFAULT_TAIYI_SCHOOL),
    showBoardMark: !!o.showBoardMark,
  }

  let base = null
  try {
    base = calcTaiyiPanFromKintaiyi(fields, nongli, options)
  } catch (e) {
    base = null
  }
  if (!base) return null

  const applied = applyTaiyiSchool(base, options.school)
  const p = { ...applied.pan }
  const style = options.style
  p.tenching = options.tenching
  p.rotation = options.rotation
  p.options = {
    ...p.options,
    styleLabel: style === 5 ? '太乙命法' : getTaiyiStyleLabel(style),
    methodLabel: style === 5 ? '命法不适用' : getTaiyiAccumLabel(options.tn),
    methodSource: style === 5 ? '命法不适用' : getTaiyiMethodSource(options.tn),
    accumLabel: getTaiyiAccumLabel(options.tn),
    sexLabel: options.sex,
    tenchingLabel: options.tenching === 1 ? '有' : '无',
    rotationLabel: options.rotation,
    timeBasisLabel: options.timeBasis === 'trueSolar' ? '真太阳时' : '直接时间',
    daySwitchLabel: options.after23NewDay === 1 ? '23点算第二天' : '24点算第二天',
    gameTheoryLabel: options.gameTheory === 1 ? '开启' : '关闭',
  }
  p.palaces = normalizePalaces(p.palace16)

  const geju = computeGeju(p)
  const derived = {
    shuli: computeTaiyiShuli(p),
    geju,
    victory: computeVictory(p, geju),
    ehui: computeEhui(p),
    limitYun: computeLimitYun(p),
    shiJing: computeShiJing(p),
    sanyuan: computeSanyuan(p),
    taisuiAlias: computeTaisuiAlias(p),
    heShen: computeHeShen(p),
    shenSuan: computeShenSuan(p),
    fenye: computeFenye(p),
    wuziyuan: computeWuziyuan(p),
    nayin: computeTaiyiNayin(p),
    doors: activeDoorJixiong(p),
    dun: dunOfKook(p),
    school: applied.overrides.size ? [...applied.overrides] : [],
  }

  return {
    pan: p,
    nongli,
    fields,
    options,
    derived,
    overrides: applied.overrides,
  }
}

// ---------- 一键复制：全部结果 ----------

const fmtOne = (v) => {
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.map(fmtOne).filter((x) => x && x !== '—').join('、') || '—'
  if (typeof v === 'object') {
    return Object.keys(v)
      .map((k) => {
        const t = fmtOne(v[k])
        return t && t !== '—' ? `${k}：${t}` : ''
      })
      .filter(Boolean)
      .join('；') || '—'
  }
  return `${v}`.replace(/得None/g, '未得').replace(/None/g, '未得')
}

/**
 * 生成「全部结果」纯文本，供一键复制。
 * 与盘面一一对应：起盘信息 / 概览 / 三算数理 / 格局 / 断法 / 十精 / 风游 /
 * 十六宫标记 / 十二宫 / 十六神主事 / 说明。
 */
export function buildTaiyiText(model) {
  if (!model || !model.pan) return ''
  const { pan, derived, options } = model
  const L = []
  const blank = () => { if (L.length && L[L.length - 1] !== '') L.push('') }
  const section = (t) => { blank(); L.push(`═══ ${t} ═══`) }

  // 抬头
  L.push('天机阁 · 太乙神数排盘')
  L.push(`公历：${pan.dateStr} ${pan.timeStr}　${pan.options.sexLabel}命`)
  if (pan.realSunTime) L.push(`真太阳时：${pan.realSunTime}`)
  if (pan.lunarText) L.push(`农历：${pan.lunarText}`)
  if (pan.jiedelta) L.push(`${pan.jiedelta}`)
  L.push(`干支：年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}`)
  L.push(`起盘方式：${pan.options.styleLabel}　古法公式：${pan.options.methodLabel}`)
  if (pan.options.methodSource && pan.options.methodSource !== '命法不适用') {
    L.push(`古法出处：${pan.options.methodSource}`)
  }
  L.push(`时间基准：${pan.options.timeBasisLabel}　换日：${pan.options.daySwitchLabel}`)
  L.push(`命式：${pan.zhao}　博弈分析：${pan.options.gameTheoryLabel}`)
  if (pan._schoolNote) L.push(`流派覆盖：${pan._schoolNote}`)

  // 一、起局
  section('一、起局')
  L.push(`积数：${pan.accNum}`)
  L.push(
    `五子元：${derived.wuziyuan || '—'}`
    + (pan.jiyuan ? `　纪元：${pan.jiyuan}${derived.sanyuan ? `（${derived.sanyuan}）` : ''}` : '')
  )
  L.push(`局式：${pan.kook.text}（${pan.kook.year}）　阴阳遁：${derived.dun || '—'}`)
  L.push(`太乙数：${pan.taiyiNum}　太乙落宫：${pan.taiyiPalace}`)
  L.push(`太岁：${pan.taishui}${derived.taisuiAlias ? `（${derived.taisuiAlias}）` : ''}　合神：${pan.hegod}${derived.heShen ? `（六合 ${derived.heShen.he}）` : ''}　计神：${pan.jigod}`)
  L.push(`始击：${pan.sf}　文昌（天目）：${pan.skyeyes}　岁计：${pan.se}`)
  L.push(`太乙纳音：${derived.nayin
    ? `${derived.nayin.pillar}柱 ${derived.nayin.ganzhi} · ${derived.nayin.nayin}（${derived.nayin.element}）`
    : '—'}`)

  // 二、三算与胜负
  section('二、三算·胜负·格局')
  L.push(`主算：${pan.homeCal}　客算：${pan.awayCal}　定算：${pan.setCal}`)
  if (derived.shuli) {
    L.push(`主算数理：${derived.shuli.home.join('、')}`)
    L.push(`客算数理：${derived.shuli.away.join('、')}`)
    L.push(`定算数理：${derived.shuli.set.join('、')}`)
  }
  if (derived.victory) {
    L.push(`胜负：${derived.victory.side} — ${derived.victory.verdict}`)
    derived.victory.reasons.forEach((r) => L.push(`· ${r}`))
  }
  if (derived.geju && derived.geju.length) {
    L.push(`格局：${derived.geju.map((g) => g.name).join('、')}`)
    derived.geju.forEach((g) => L.push(`· ${g.name}：${g.text}`))
  } else {
    L.push('格局：无掩、迫、囚、格、对、挟、提、关、击')
  }
  if (derived.ehui && derived.ehui.length) L.push(`厄会：${derived.ehui.join('、')}`)

  // 三、诸神落点
  section('三、诸神落点')
  const gods = [
    ['主大将', pan.homeGeneral, pan.homeGeneralPalace],
    ['主参将', pan.homeVGen, pan.homeVGenPalace],
    ['客大将', pan.awayGeneral, pan.awayGeneralPalace],
    ['客参将', pan.awayVGen, pan.awayVGenPalace],
    ['定大将', pan.setGeneral, pan.setGeneralPalace],
    ['定参将', pan.setVGen, pan.setVGenPalace],
    ['君基', pan.kingbase, ''],
    ['臣基', pan.officerbase, ''],
    ['民基', pan.pplbase, ''],
    ['四神', pan.fgd, ''],
    ['天乙（天乙宫）', pan.skyyi, ''],
    ['地乙', pan.earthyi, ''],
    ['直符', pan.zhifu, ''],
    ['飞符', pan.flyfu, ''],
    ['五福', pan.wufuNum, pan.wufuPalace],
    ['君符', pan.kingfu, ''],
    ['太君', pan.taijun, ''],
    ['飞鸟', pan.flybird, ''],
  ]
  gods.forEach(([name, val, palace]) => {
    L.push(`${name}：${val !== undefined && val !== null && val !== '' ? val : '—'}${palace ? `（${palace}宫）` : ''}`)
  })
  L.push(`三风：${pan.threewindNum}（${pan.threewindPalace}）　五风：${pan.fivewindNum}（${pan.fivewindPalace}）　八风：${pan.eightwindNum}（${pan.eightwindPalace}）`)
  L.push(`大游：${pan.bigyoNum}（${pan.bigyoPalace}）　小游：${pan.smyoNum}（${pan.smyoPalace}）`)

  // 四、断法
  section('四、断法')
  if (derived.fenye && derived.fenye.taiyi) {
    const f = derived.fenye.taiyi
    L.push(`太乙分野：${f.zhou}（${f.gua}宫·${f.men}·${f.qi}）— ${f.omen}`)
  }
  if (derived.fenye && derived.fenye.shiji) {
    const f = derived.fenye.shiji
    L.push(`始击分野：${f.zhou}（${f.gua}宫·${f.men}·${f.qi}）— ${f.omen}`)
  }
  if (derived.doors) L.push(`值使八门：${derived.doors.door}（${derived.doors.jixiong}）`)
  if (derived.limitYun) {
    const ly = derived.limitYun
    L.push(`大限（太乙）：${ly.daxian.at || '—'} · ${ly.daxian.span}　小限（文昌）：${ly.xiaoxian.at || '—'} · ${ly.xiaoxian.span}`)
    L.push(`二限：大游 ${ly.erxian.dayou || '—'}　小游 ${ly.erxian.xiaoyou || '—'}`)
  }
  if (derived.shenSuan) {
    Object.keys(derived.shenSuan).forEach((k) => {
      const it = derived.shenSuan[k]
      L.push(`${k}：${it ? `${it.value}（${(it.tags || []).join('、')}）` : '—'}`)
    })
  }

  // 五、十精
  if (derived.shiJing) {
    section('五、十精（二目·八将）')
    derived.shiJing.forEach((it) => L.push(`${it.name}（${it.role}）：${it.at}`))
  }

  // 六、十六宫标记
  section('六、十六宫标记')
  ;(pan.palace16 || []).forEach((it) => {
    L.push(`${it.palace}：${it.items && it.items.length ? it.items.join('、') : '—'}`)
  })

  // 七、十二宫（命法）
  if (pan.branch12 && pan.branch12.length) {
    section('七、十二宫')
    pan.branch12.forEach((it) => {
      L.push(`${it.branch}：${it.items && it.items.length ? it.items.join('、') : '—'}`)
    })
  }

  // 八、十六神主事
  section('八、十六神主事')
  ;(pan.palace16 || []).forEach((it) => {
    const mean = shenMeaning(it.palace)
    if (mean) L.push(`${it.palace}：${mean}`)
  })

  // 九、快照式盘面（内核自带，保持与上游同口径）
  section('九、太乙盘（内核快照）')
  buildTaiyiSnapshotLines(pan).forEach((line) => L.push(line))

  blank()
  L.push('说明：太乙积数/局式/诸神落宫取自前端 TaiYiCore 立成表；流派覆盖为纯派生层，默认「从盘」不改盘。')

  return L.join('\n')
}
