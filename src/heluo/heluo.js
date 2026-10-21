/**
 * 河洛理数 · 适配层
 *
 * 上游算法 heluoLocal.js 是纯函数（只依赖 heluoTiaowen.json），与框架无关，
 * 本文件负责把 wmtj 已有的排盘结果（四柱 / 公历日 / 性别）喂给它，
 * 并把「节气」用 wmtj 自己的历法层算出来 —— 因此不需要引入 lunar-javascript。
 */
import calc, {
  daYun,
  liuNian,
  liuYue,
  liuRi,
  judge,
  chartExtras,
  duiGua,
  solarTermHuagong,
  yaoText,
  guaInfo,
  yaoName,
  buildSnapshotText,
  NAME_TO_TRI,
  guaLines,
  classifyErShu,
  zhongZong,
  shunFanShu,
  seasonFit,
  isXiongPair,
  mingGe,
  wangShuai,
  jiNian,
  shiJi,
  guaRelations,
  periodLiShu,
} from './heluoLocal'
import { ganzhiYearBase } from './ganzhiYearBase'
import { Gua64 } from './gua64'
import { getTerm } from '../ziwei/lunar'
import { TERM_NAMES } from '../ziwei/data'

// ---------- 六十甲子纳音（五行只取末字，与上游口径一致） ----------
// 年柱 → 纳音全名。五命行显示全名，chartExtras 只吃末字五行。
const NAYIN = {
  甲子: '海中金', 乙丑: '海中金', 丙寅: '炉中火', 丁卯: '炉中火', 戊辰: '大林木', 己巳: '大林木',
  庚午: '路旁土', 辛未: '路旁土', 壬申: '剑锋金', 癸酉: '剑锋金', 甲戌: '山头火', 乙亥: '山头火',
  丙子: '涧下水', 丁丑: '涧下水', 戊寅: '城头土', 己卯: '城头土', 庚辰: '白蜡金', 辛巳: '白蜡金',
  壬午: '杨柳木', 癸未: '杨柳木', 甲申: '泉中水', 乙酉: '泉中水', 丙戌: '屋上土', 丁亥: '屋上土',
  戊子: '霹雳火', 己丑: '霹雳火', 庚寅: '松柏木', 辛卯: '松柏木', 壬辰: '长流水', 癸巳: '长流水',
  甲午: '沙中金', 乙未: '沙中金', 丙申: '山下火', 丁酉: '山下火', 戊戌: '平地木', 己亥: '平地木',
  庚子: '壁上土', 辛丑: '壁上土', 壬寅: '金箔金', 癸卯: '金箔金', 甲辰: '覆灯火', 乙巳: '覆灯火',
  丙午: '天河水', 丁未: '天河水', 戊申: '大驿土', 己酉: '大驿土', 庚戌: '钗钏金', 辛亥: '钗钏金',
  壬子: '桑柘木', 癸丑: '桑柘木', 甲寅: '大溪水', 乙卯: '大溪水', 丙辰: '沙中土', 丁巳: '沙中土',
  戊午: '天上火', 己未: '天上火', 庚申: '石榴木', 辛酉: '石榴木', 壬戌: '大海水', 癸亥: '大海水',
}

// ---------- 开关默认值（与上游宿主左栏 9 项一一对应） ----------
export const HELUO_DEFAULTS = {
  ziShuMode: 'pair',            // 取数法：成对全取 / 单取
  jiGongMode: 'manualSanYuan',  // 五寄中宫
  zhiZunEnabled: true,          // 三至尊卦
  pureGanKunVariant: 'current', // 纯乾坤落爻
  liunianStep2: 'ying',         // 流年次步：应爻法 / 逐爻上行
  liuYueMode: 'ying',           // 流月起月：应爻校准 / 现行序
  showLiuRi: true,              // 流月下列流日
  huangdiOffset: 2697,          // 纪年基准（黄帝纪元偏移）
  quHuaGong: 'tuWangKunGen',    // 取化工法：土王坤艮 / 仅四方泊
}

export const HELUO_SWITCHES = [
  { k: 'ziShuMode', t: '取数法', opts: [['pair', '成对全取'], ['single', '单取']] },
  { k: 'jiGongMode', t: '五寄中宫', opts: [['manualSanYuan', '三元寄宫'], ['legacy', '旧法']] },
  { k: 'zhiZunEnabled', t: '三至尊卦', bool: true },
  { k: 'pureGanKunVariant', t: '纯乾坤落爻', opts: [['current', '现行'], ['alt', '另法']] },
  { k: 'liunianStep2', t: '流年次步', opts: [['ying', '应爻法'], ['sequential', '逐爻上行']] },
  { k: 'liuYueMode', t: '流月起月', opts: [['ying', '应爻校准'], ['legacy', '现行序']] },
  { k: 'showLiuRi', t: '流月列流日', bool: true },
]

// ---------- 节气（用 wmtj 自己的历法层，日精度） ----------
const LI_TERMS = ['立春', '立夏', '立秋', '立冬'] // 四立
const HOU_LABEL = ['初候', '二候', '三候']

/** 第 n 个节气（1..24）在 y 年的公历日期 */
function termDate(y, n) {
  if (y < 1900 || y > 2100 || n < 1 || n > 24) return null
  const d = getTerm(y, n)
  if (!d || d < 0) return null
  return { y, m: Math.ceil(n / 2), d }
}

function dayDiff(a, b) {
  return Math.round(
    (Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000
  )
}

/**
 * 真实节气：上一个节气 + 土用（四立前 18 日）+ 三候（节气内 5 日一候）。
 * 对应上游 HeLuoMain.solarTerm()，但用 wmtj 的 getTerm 取代 lunar-javascript。
 * 差异：wmtj 节气表只到「日」，没有交节时分 → 交节日当天及候数可能相差 1 日。
 */
export function solarTermLocal(y, m, d, quHuaGong) {
  try {
    const today = { y: +y, m: +m, d: +d }
    let hit = null
    for (let n = 24; n >= 1; n -= 1) {
      const t = termDate(today.y, n)
      if (t && dayDiff(today, t) >= 0) { hit = { n, t }; break }
    }
    // 年初（小寒之前）：上一个节气落在前一年的冬至
    if (!hit) {
      const t = termDate(today.y - 1, 24)
      if (t) hit = { n: 24, t }
    }
    if (!hit) return null
    const prevName = TERM_NAMES[hit.n - 1]
    const tuyong = LI_TERMS.some((name) => {
      const n = TERM_NAMES.indexOf(name) + 1
      const t = termDate(today.y, n)
      if (!t) return false
      const diff = dayDiff(t, today)
      return diff >= 0 && diff <= 18
    })
    const daysIn = Math.max(0, dayDiff(today, hit.t))
    const hou = Math.min(3, Math.floor(daysIn / 5) + 1)
    return {
      ...solarTermHuagong(prevName, tuyong, { quHuaGong: quHuaGong || HELUO_DEFAULTS.quHuaGong }),
      term: prevName,
      hou,
      houLabel: `${prevName}${HOU_LABEL[hou - 1]}·${prevName}後`,
    }
  } catch (e) {
    return null
  }
}

/** 某年某节气的交节日期（'MM-DD'）。wmtj 节气表只到日，无时分。 */
export function jieQiLabel(year, name) {
  const n = TERM_NAMES.indexOf(name) + 1
  if (!n) return ''
  const t = termDate(+year, n)
  if (!t) return ''
  return `${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
}

// ---------- 纳甲六亲世应（六爻象图用） ----------
const NAJIA_GAN = {
  乾: ['甲', '壬'], 坤: ['乙', '癸'], 震: ['庚', '庚'], 巽: ['辛', '辛'],
  坎: ['戊', '戊'], 離: ['己', '己'], 艮: ['丙', '丙'], 兌: ['丁', '丁'],
}
const LIUQIN_SHORT = {
  父母: '父', 兄弟: '兄', 官鬼: '官', 妻财: '財', 妻財: '財', 子孙: '子', 子孫: '子',
}

/** 卦名 → 六爻 [{ yao, ganzhi, liuqin, shiYing }]（自下 1..6） */
export function najia(name) {
  const t = NAME_TO_TRI[name]
  if (!t) return []
  const lines = guaLines(t.up, t.low)
  const g64 = Gua64.find(
    (g) => Array.isArray(g.value) && g.value.length === 6 && g.value.every((b, i) => b === lines[i])
  )
  const out = []
  for (let p = 1; p <= 6; p += 1) {
    const tri = p <= 3 ? t.low : t.up
    const gan = (NAJIA_GAN[tri] || ['', ''])[p <= 3 ? 0 : 1]
    let zhi = ''
    let liuqin = ''
    let shiYing = ''
    if (g64 && g64.yaoname && g64.yaoname[p - 1]) {
      const yn = g64.yaoname[p - 1]
      zhi = yn[0]
      let rest = yn.slice(2)
      const tail = rest.slice(-1)
      if (tail === '世' || tail === '应' || tail === '應') {
        shiYing = tail === '應' ? '应' : tail
        rest = rest.slice(0, -1)
      }
      liuqin = LIUQIN_SHORT[rest] || rest
    }
    out.push({ yao: p, ganzhi: gan + zhi, liuqin, shiYing })
  }
  return out
}

// ---------- 四柱来源 ----------
/**
 * 取四柱：**优先用八字引擎的 fourColumns**，只在八字盘缺失时退回紫微的 bzText。
 *
 * 这一点是照搬上游 horosa 的做法（HeLuoMain.js:219-222）：
 *     const fc = (bazi && bazi.fourColumns) || {};
 *     const fourPillars = { year: gz(fc.year), ... };
 * 即河洛原本就吃八字引擎的结果，从不读紫微的 bzText。
 *
 * 为什么不能读紫微：两个引擎的晚子时口径不同。
 *   八字引擎 after23NewDay=1 → 23:00-23:59 日柱进位次日，时干按次日日干起子时；
 *   紫微 bzText            → 日柱留当日，时干按当日日干起子时。
 * 同一份出生信息差一整个日柱，起卦的天数/地数与先后天卦全错。
 */
function fourPillarsOf(bazi) {
  const fc = bazi && bazi.bazi && bazi.bazi.fourColumns
  if (!fc) return null
  const gz = (p) => (p && (p.ganzi || p.ganZhi)) || ''
  const fp = {
    year: gz(fc.year),
    month: gz(fc.month),
    day: gz(fc.day),
    hour: gz(fc.time),
  }
  return fp.year && fp.month && fp.day && fp.hour ? fp : null
}

// ---------- 主入口：由 wmtj 的排盘结果组装河洛模型 ----------
export function buildHeluoModel({ pan, bazi, sex, opts }) {
  const fp = fourPillarsOf(bazi) || (pan && pan.bzText)
  if (!fp) return null
  if (!fp.year || !fp.month || !fp.day || !fp.hour) return null

  const monthZhi = fp.month.charAt(1)
  const hourZhi = fp.hour.charAt(1)
  const solar = pan.solarClock
  if (!solar) return null

  const gender = +sex === 2 ? '女' : '男'
  // 河洛是干支/易数体系：流年·纪年的「年」一律取干支年，不是出生公历年。
  // 立春前出生者两者差一年，直接用公历年会让流年整体错一位。
  const birthYear = ganzhiYearBase(solar.y, fp.year)

  let chart
  try {
    chart = calc({ fourPillars: fp, gender, hourZhi, birthYear, monthZhi, opts: opts || {} })
  } catch (e) {
    return null
  }
  if (!chart.xian || !chart.hou || !chart.xian.name || !chart.hou.name) return null

  const dy = daYun(chart.xian, chart.hou, birthYear)
  const st = solarTermLocal(solar.y, solar.m, solar.d, (opts && opts.quHuaGong) || HELUO_DEFAULTS.quHuaGong)
  const jg = judge(chart, fp, monthZhi, st)

  // 纳音：上游取 fc.year.naying，这里优先用引擎给的，取不到再退回内置六十甲子表
  const fcYear = bazi && bazi.bazi && bazi.bazi.fourColumns && bazi.bazi.fourColumns.year
  const nayinStr = (fcYear && (fcYear.naying || fcYear.nayin)) || NAYIN[fp.year] || ''
  const nayin = '金木水火土'.includes(nayinStr.slice(-1)) ? nayinStr.slice(-1) : ''
  const extras = chartExtras(chart, fp, monthZhi, jg, {
    sanhou: st ? st.houLabel : '',
    nayin,
  })

  return {
    fourPillars: fp,
    monthZhi,
    hourZhi,
    birthYear,
    gender,
    chart,
    dy,
    jg,
    st,
    solar,
    nayin: nayinStr,
    extras,
    opts: opts || {},
  }
}

// ---------- 一键复制：全部排盘结果 ----------
const pad2 = (v) => String(v).padStart(2, '0')

/** 单爻的完整条文（易经爻辞 / 摘要 / 诗歌 / 推命 + 对体关系），四个层级共用 */
function detailLines(guaName, pos, lines, slot, chart) {
  const yt = yaoText(guaName, pos) || {}
  const info = guaInfo(guaName) || {}
  const ni = ((info.mingtiao || {})[slot || 'liunian']) || ''
  const rels = chart ? guaRelations(lines, chart).filter((r) => r.indexOf('即') < 0) : []
  const out = []
  out.push(
    `【${guaName} · ${yaoName(lines, pos)}】`
    + (yt.verdict ? `（${yt.verdict}）` : '')
    + (rels.length ? `　${rels.join('，')}` : '')
  )
  if (yt.yaoci) out.push(`易经爻辞：${yt.yaoci}`)
  if (yt.detail) out.push(`摘要：${yt.detail}`)
  if (yt.shige) out.push(`诗歌：${yt.shige}`)
  if (ni) out.push(`易经爻辞推命：${ni}`)
  if (out.length === 1) out.push('（空爻·无条文）')
  return out
}

/** 某卦的理数串（对体关系 + 期数），与大限/流年表格里的 chips 同源 */
function liShuText(lines, jg, chart) {
  const rels = chart ? guaRelations(lines, chart).filter((r) => r.indexOf('即') < 0) : []
  const items = jg ? (periodLiShu(lines, jg) || []) : []
  return [...rels, ...items.map((i) => i.text)].join('　')
}

/**
 * 生成「全部排盘结果」纯文本，供一键复制。
 *
 * 与 buildSnapshotText 的分工：
 *   buildSnapshotText 是简洁快照（大限/流年只出表格骨架，无条文）；
 *   本函数把每一层的 卦辞 / 易经爻辞 / 摘要 / 诗歌 / 易经爻辞推命 全部展开。
 *
 * 按需求**只到流年**：流月（12×72）与流日（30×更多）量级太大，
 * 塞进一次复制只会让文本不可读，故不含。
 */
export function buildFullCopyText(m) {
  if (!m || !m.chart) return ''
  const { chart, jg, dy, fourPillars: fp, gender, solar, opts } = m
  const L = []
  const blank = () => { if (L.length && L[L.length - 1] !== '') L.push('') }

  // ---------- 抬头 ----------
  L.push('天机阁 · 河洛理数排盘')
  if (solar) {
    L.push(`公历：${solar.y}-${pad2(solar.m)}-${pad2(solar.d)} ${pad2(solar.h)}:${pad2(solar.min)}　${gender}命`)
  } else {
    L.push(`${gender}命`)
  }
  L.push(`四柱：${fp.year} ${fp.month} ${fp.day} ${fp.hour}${m.nayin ? `（${m.nayin}）` : ''}`)
  if (m.st && m.st.term) {
    L.push(`节气：${m.st.houLabel || m.st.term}${m.st.tuyong ? ' · 土用' : ''}`)
  }

  // ---------- 一、本命 ----------
  blank()
  L.push('═══ 一、本命 ═══')
  L.push(`天数 ${chart.tian} → ${chart.tianGua}　地数 ${chart.di} → ${chart.diGua}`)
  L.push(`先天卦：${chart.xian.name}　元堂 ${yaoName(chart.xian.lines, chart.xian.yuan)}`)
  L.push(`后天卦：${chart.hou.name}　元堂 ${yaoName(chart.hou.lines, chart.hou.yuan)}`)

  for (const [label, g, slot] of [
    ['先天卦', chart.xian, 'xiantian'],
    ['后天卦', chart.hou, 'houtian'],
  ]) {
    blank()
    const info = guaInfo(g.name) || {}
    L.push(`── ${label}：${g.name} · 经文 ──`)
    if (info.meaning) L.push(`卦义：${info.meaning}`)
    if (info.guaci) L.push(`卦辞：${info.guaci}`)
    if (info.zongjue) L.push(`总诀：${info.zongjue}`)
    blank()
    L.push(`── ${label} · 元堂爻辞 ──`)
    L.push(...detailLines(g.name, g.yuan, g.lines, slot, chart))
  }

  // ---------- 命运篇 / 断验 ----------
  if (jg) {
    blank()
    L.push('── 命运篇 ──')
    L.push(`天元气 ${jg.yuan.tian.gua}${jg.yuan.tian.present ? '（有）' : '（无）'}　地元气 ${jg.yuan.di.gua}${jg.yuan.di.present ? '（有）' : '（无）'}`)
    L.push(`反天元 ${jg.fanYuan.tian.gua}${jg.fanYuan.tian.present ? '（有）' : '（无）'}　反地元 ${jg.fanYuan.di.gua}${jg.fanYuan.di.present ? '（有）' : '（无）'}`)
    L.push(`化工 ${jg.huagong.guas.join('/') || '—'}${jg.huagong.present.length ? `（藏${jg.huagong.present.join('')}）` : ''}　判格：${jg.xie ? '葉' : '不葉'}`)
    L.push(`得势 ${jg.deSheng ? '有' : '无'}　得时 ${jg.deTime ? '有' : '无'}　得体 ${jg.deTi.gua}${jg.deTi.present ? '（有）' : '（无）'}`)
    L.push(`二数：天${jg.erShu.tian}（${jg.erShu.tianState}）　地${jg.erShu.di}（${jg.erShu.diState}）`)
    L.push(`元堂：${jg.yuanTang.dangWei ? '当位' : '不当位'}　${jg.yuanTang.youYing ? '有应' : '无应'}　${jg.yuanTang.heLi ? '顺气' : '逆气'}`)

    const season = (m.extras && m.extras.season) || ''
    const jn = jiNian(m.birthYear, { huangdiOffset: (opts && opts.huangdiOffset) || 2697 })
    const sj = shiJi(chart, jg)
    const wsX = season ? wangShuai(chart.xian.name, season) : null
    const wsH = season ? wangShuai(chart.hou.name, season) : null
    blank()
    L.push('── 断验 ──')
    if (jn) L.push(`纪年：黄帝${jn.huangdi}年 · ${jn.yuan}${jn.yunNo}运 · ${jn.ganzhi}`)
    if (season) L.push(`时令：${season}`)
    if (wsX) L.push(`先天卦气：内${wsX.low.wuxing}${wsX.low.state}／外${wsX.up.wuxing}${wsX.up.state}`)
    if (wsH) L.push(`后天卦气：内${wsH.low.wuxing}${wsH.low.state}／外${wsH.up.wuxing}${wsH.up.state}`)
    if (sj) {
      const miss = sj.items.filter((x) => !x.ok).map((x) => x.name)
      L.push(`十吉：${sj.hitCount}/10${sj.hit.length ? ` 合[${sj.hit.join('、')}]` : ''}${miss.length ? ` 缺[${miss.join('、')}]` : ''}`)
    }
  }

  // ---------- 二、大限 ----------
  if (dy && dy.all) {
    blank()
    L.push('═══ 二、大限（歲運）· 阳爻9年 / 阴爻6年 ═══')
    for (const s of dy.all) {
      blank()
      L.push(`■ ${s.ageStart}-${s.ageEnd}岁　${s.gua}　${yaoName(s.lines, s.pos)}　${s.yang ? '阳9' : '阴6'}`)
      const li = liShuText(s.lines, jg, chart)
      if (li) L.push(`理数：${li}`)
      L.push(...detailLines(s.gua, s.pos, s.lines, dy.xian.indexOf(s) >= 0 ? 'xiantian' : 'houtian', chart))
    }

    // ---------- 三、流年（不含流月 / 流日）----------
    blank()
    L.push('═════ 三、流年（不含流月、流日）═════')
    const step2 = (opts && opts.liunianStep2) || 'ying'
    for (const s of dy.all) {
      const rows = liuNian(s, m.birthYear, { step2 })
      if (!rows.length) continue
      blank()
      L.push(`◆ ${s.ageStart}-${s.ageEnd}岁　${s.gua}　${yaoName(s.lines, s.pos)}`)
      for (const y of rows) {
        L.push('')
        const head = y.year ? `${y.age}岁　${y.year}·${y.ganzhi}` : `${y.age}岁　${y.ganzhi || ''}`
        L.push(`  ◎ ${head}　值年卦 ${y.gua}　${yaoName(y.lines, y.pos)}`)
        const li = liShuText(y.lines, jg, chart)
        if (li) L.push(`    理数：${li}`)
        for (const ln of detailLines(y.gua, y.pos, y.lines, 'liunian', chart)) L.push(`    ${ln}`)
      }
    }
  }

  return L.join('\n')
}

// 下游渲染要用的函数，统一从这里转出，组件不直接依赖算法文件
export {
  calc,
  daYun,
  liuNian,
  liuYue,
  liuRi,
  judge,
  chartExtras,
  duiGua,
  yaoText,
  guaInfo,
  yaoName,
  buildSnapshotText,
  classifyErShu,
  zhongZong,
  shunFanShu,
  seasonFit,
  isXiongPair,
  mingGe,
  wangShuai,
  jiNian,
  shiJi,
  guaRelations,
  periodLiShu,
}
