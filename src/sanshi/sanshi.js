/**
 * 三式（奇门 · 六壬 · 太乙）· 适配层
 *
 * 上游 horosa 的三式页（components/sanshi/SanShiUnitedMain.js，220KB）
 * 是「三式浏览器本地引擎的编排 + 盘面」：算法本体分散在 dunjia/、liureng/、taiyi/。
 * 移植策略：
 *   1. 算法原样搬：src/dunjia/*（奇门）、src/liureng/{LRConst,ChuangChart}（六壬三传）、
 *      src/taiyi/*（太乙，与独立太乙页共用）；
 *   2. 上游 484-1041 行的六壬四课三传纯函数层原样搬入本文件（layout / 四课 / 三传）；
 *   3. 盘面在 Vue 侧重写，不用 antd/d3；外圈星盘（七政四余）依赖上游星历，整块降级不做。
 *
 * 输入：紫微 pan.solarClock（日期时间）＋ 八字 bazi.bazi（四柱/农历）。
 */
import { Solar } from 'lunar-javascript'
import { calcDunJia, PAIPAN_OPTIONS, SCHOOL_OPTIONS } from '../dunjia/DunJiaCalc'
import * as LRConst from '../liureng/LRConst'
import ChuangChart from '../liureng/ChuangChart'
import { buildTaiyiModel, buildTaiyiText } from '../taiyi/taiyi'

export { PAIPAN_OPTIONS, SCHOOL_OPTIONS }

const gz = (p) => (p && (p.ganzi || p.ganZhi)) || ''
const p2 = (v) => String(v).padStart(2, '0')

/** 中气 → 月将（太阳过宫）；六壬「月将」以此为准 */
const YUE_JIANG_BY_QI = {
  雨水: '亥',
  春分: '戌',
  谷雨: '酉',
  小满: '申',
  夏至: '未',
  大暑: '午',
  处暑: '巳',
  秋分: '辰',
  霜降: '卯',
  小雪: '寅',
  冬至: '丑',
  大寒: '子',
}

/** 月将：取出生时刻之前最近一个「中气」所对应的将 */
function monthGeneral(solar) {
  try {
    const s = Solar.fromYmdHms(solar.y, solar.m, solar.d, solar.h, solar.min, 0)
    const table = s.getLunar().getJieQiTable() || {}
    const now = s.getJulianDay()
    let best = ''
    let bestJd = -Infinity
    Object.keys(table).forEach((name) => {
      const jiang = YUE_JIANG_BY_QI[name]
      if (!jiang) return
      const item = table[name]
      const jd = item && item.getJulianDay ? item.getJulianDay() : NaN
      if (jd <= now && jd > bestJd) {
        best = jiang
        bestJd = jd
      }
    })
    return best
  } catch (e) {
    return ''
  }
}

/** 昼夜：以 6~18 点为昼（六壬贵人分昼夜的近似口径，上游按太阳出入，需星历） */
const isDaytime = (hour) => Number(hour) >= 6 && Number(hour) < 18

// ---------- 六壬：四课三传（上游 SanShiUnitedMain.js:884-1041 纯函数层） ----------

function buildLiuRengLayout(chartObj, guirengType, castOverride) {
  if (!chartObj || !chartObj.nongli || !chartObj.nongli.time) return null
  const yue = castOverride && castOverride.yue
  if (!yue) return null
  const downZi = LRConst.ZiList.slice(0)
  const upZi = LRConst.ZiList.slice(0)
  const yueIndexs = []
  const timezi = chartObj.nongli.time.substr(1)
  const yueIdx = LRConst.ZiList.indexOf(yue)
  const tmIdx = LRConst.ZiList.indexOf(timezi)
  if (yueIdx < 0 || tmIdx < 0) return null
  const delta = yueIdx - tmIdx
  for (let i = 0; i < 12; i += 1) {
    const idx = (i + delta + 12) % 12
    yueIndexs[i] = idx
    upZi[i] = LRConst.ZiList[idx]
  }

  const houseTianJiang = LRConst.TianJiang.slice(0)
  const guizi = LRConst.getGuiZi(
    chartObj,
    guirengType === undefined ? 2 : guirengType,
    castOverride ? castOverride.isDiurnal : undefined,
    castOverride ? castOverride.yinyangSystem : undefined
  )
  let houseidx = 0
  for (let i = 0; i < 12; i += 1) {
    const zi = LRConst.ZiList[yueIndexs[i]]
    if (zi === guizi) {
      houseidx = i
      break
    }
  }
  const housezi = LRConst.ZiList[houseidx]
  if (LRConst.SummerZiList.indexOf(housezi) >= 0) {
    for (let i = 0; i < 12; i += 1) {
      const idx = (houseidx - i + 12) % 12
      houseTianJiang[i] = LRConst.TianJiang[idx]
    }
  } else {
    for (let i = 0; i < 12; i += 1) {
      const idx = (i - houseidx + 12) % 12
      houseTianJiang[i] = LRConst.TianJiang[idx]
    }
  }
  return { yue, timezi, guizi, downZi, upZi, houseTianJiang }
}

function buildKeData(layout, chartObj) {
  const result = { raw: [], lines: [] }
  if (!layout || !chartObj || !chartObj.nongli || !chartObj.nongli.dayGanZi) return result
  const dayGanZi = chartObj.nongli.dayGanZi
  const daygan = dayGanZi.substr(0, 1)
  const dayzi = dayGanZi.substr(1, 1)

  const idx1 = layout.downZi.indexOf(LRConst.GanJiZi[daygan])
  if (idx1 < 0) return result
  const ke1zi = layout.upZi[idx1]
  const ke1 = [layout.houseTianJiang[idx1], ke1zi, daygan]

  const idx2 = layout.downZi.indexOf(ke1zi)
  const ke2zi = idx2 >= 0 ? layout.upZi[idx2] : ''
  const ke2 = [idx2 >= 0 ? layout.houseTianJiang[idx2] : '', ke2zi, ke1zi]

  const idx3 = layout.downZi.indexOf(dayzi)
  const ke3zi = idx3 >= 0 ? layout.upZi[idx3] : ''
  const ke3 = [idx3 >= 0 ? layout.houseTianJiang[idx3] : '', ke3zi, dayzi]

  const idx4 = layout.downZi.indexOf(ke3zi)
  const ke4zi = idx4 >= 0 ? layout.upZi[idx4] : ''
  const ke4 = [idx4 >= 0 ? layout.houseTianJiang[idx4] : '', ke4zi, ke3zi]

  result.raw = [ke1, ke2, ke3, ke4]
  result.lines = [
    `四课 ${ke1[2]}${ke1[1]}${ke1[0]}`,
    `三课 ${ke2[2]}${ke2[1]}${ke2[0]}`,
    `二课 ${ke3[2]}${ke3[1]}${ke3[0]}`,
    `一课 ${ke4[2]}${ke4[1]}${ke4[0]}`,
  ]
  return result
}

function buildSanChuan(layout, keRaw, chartObj, castOverride) {
  if (!layout || !keRaw || keRaw.length !== 4 || !chartObj || !chartObj.nongli) return null
  try {
    const helper = new ChuangChart({
      chartObj,
      nongli: chartObj.nongli,
      ke: keRaw,
      seHaiOpts: castOverride ? castOverride.seHaiOpts : null,
      liuRengChart: {
        upZi: layout.upZi,
        downZi: layout.downZi,
        houseTianJiang: layout.houseTianJiang,
      },
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
    helper.genCuangs()
    return helper.cuangs || null
  } catch (e) {
    return null
  }
}

// ---------- 组装三式 ----------

/**
 * @param {object} p  pan / bazi / sex / opts{qimen:{paiPanType,school,...}}
 * @returns null | { nongli, fields, dunjia, liureng, taiyi }
 */
export function buildSanshiModel({ pan, bazi, sex, opts }) {
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
  const dateText = `${solar.y}-${p2(solar.m)}-${p2(solar.d)}`
  const timeText = `${p2(solar.h)}:${p2(solar.min)}:00`
  const fields = {
    date: { value: { format: () => dateText } },
    time: { value: { format: () => timeText } },
  }

  // 四柱直接由八字引擎给（含真太阳时与晚子时口径），奇门/六壬共用同一份
  const nongli = {
    year: nl.year || '',
    month: nl.month || '',
    day: nl.day || '',
    leap: !!nl.leap,
    monthInt: nl.monthNum,
    dayInt: nl.dayNum,
    yearJieqi: year,
    monthGanZi: month,
    dayGanZi: dayGz,
    time: hourGz,
    jieqi: nl.jieqi || '',
    jiedelta: nl.jiedelta || '',
    birth: nl.solarTime || '',
    clockTime: nl.clockTime || '',
    bazi: { fourColumns: fc },
    solarYear: solar.y,
  }

  const o = opts || {}
  const qopts = {
    paiPanType: 3, // 时家
    school: '转盘',
    qijuMethod: 'zhirun',
    kongMode: 'day',
    yimaMode: 'day',
    timeAlg: 0,
    after23NewDay: 1,
    lateZiHourUseNextDay: 1,
    ...(o.qimen || {}),
  }
  const diurnal = isDaytime(solar.h)
  const context = {
    year: solar.y,
    jieqiYearSeeds: null,
    isDiurnal: diurnal,
    displaySolarTime: nongli.birth || '',
  }

  let dunjia = null
  try {
    dunjia = calcDunJia(fields, nongli, qopts, context)
  } catch (e) {
    dunjia = null
  }
  if (!dunjia) return null

  const yue = monthGeneral(solar)
  const castOverride = {
    yue,
    isDiurnal: diurnal,
    yinyangSystem: 'danmu',
    yearShenShaSort: 'sanyuan',
    tuWangShuai: 'siji',
    seHaiOpts: null,
  }
  const chartObj = { nongli, isDiurnal: diurnal }
  const layout = buildLiuRengLayout(chartObj, 2, castOverride)
  const keData = buildKeData(layout, chartObj)
  const sanChuan = buildSanChuan(layout, keData.raw, chartObj, null)

  const taiyi = buildTaiyiModel({ pan, bazi, sex, opts: { style: 3, tn: 0 } })

  return {
    nongli,
    fields,
    dunjia,
    liureng: { chartObj, layout, keData, sanChuan, yue, diurnal },
    taiyi,
    options: { qimen: qopts },
  }
}

// ---------- 一键复制：全部结果 ----------

/**
 * 生成「全部结果」纯文本：奇门（局式/九宫） + 六壬（天地盘/四课/三传） + 太乙（全盘）。
 */
export function buildSanshiText(model) {
  if (!model || !model.dunjia) return ''
  const { dunjia: q, liureng: lr, nongli } = model
  const L = []
  const blank = () => { if (L.length && L[L.length - 1] !== '') L.push('') }
  const section = (t) => { blank(); L.push(`═══ ${t} ═══`) }

  L.push('天机阁 · 三式排盘（奇门 · 六壬 · 太乙）')
  L.push(`公历：${q.dateStr} ${q.timeStr}`)
  if (q.realSunTime) L.push(`真太阳时：${q.realSunTime}`)
  if (nongli.year) L.push(`农历：${nongli.year}年${nongli.leap ? '闰' : ''}${nongli.month}${nongli.day}${q.jiedelta ? `（${q.jiedelta}）` : ''}`)
  L.push(`四柱：${q.ganzhi.year} ${q.ganzhi.month} ${q.ganzhi.day} ${q.ganzhi.time}`)

  // ---------- 一、奇门遁甲 ----------
  section('一、奇门遁甲')
  L.push(`局式：${q.juText}（${q.yinYangDun}·${q.sanYuan}）　节气：${q.jieqiText}`)
  L.push(`盘式：${q.school}　起局法：${q.options ? q.options.qijuMethodLabel : ''}　值符：${q.zhiFu}（${q.zhiFuPalace}宫）　值使：${q.zhiShi}（${q.zhiShiPalace}宫）`)
  L.push(`旬首：${q.xunShou}　空亡：${q.kongWang || '—'}　驿马：${q.yiMa && q.yiMa.palace ? `${q.yiMa.palace}宫` : '—'}`)
  if (q.shuziInfo) L.push(`报数起局：${q.shuziInfo.sum} → ${q.shuziInfo.gong}宫（用神）`)
  const cellRows = (q.cells || []).filter((c) => !c.isCenter)
  if (cellRows.length) {
    blank()
    L.push('── 九宫（外八宫） ──')
    L.push('宫　八神　九星　八门　天盘干　地盘干　标记')
    cellRows.forEach((c) => {
      const marks = []
      if (c.isZhiFu) marks.push('值符')
      if (c.isZhiShi) marks.push('值使')
      if (c.hasJiXing) marks.push('击刑')
      if (c.hasRuMu) marks.push('入墓')
      if (c.hasMenPo) marks.push('门迫')
      if (c.hasKongWang) marks.push('空亡')
      if (c.isYiMa) marks.push('驿马')
      L.push(`${c.palaceName}　${c.god || '—'}　${c.tianXing || '—'}　${c.door || '—'}　${c.tianGan || '—'}　${c.diGan || '—'}　${marks.join('、') || '—'}`)
    })
    const center = (q.cells || []).find((c) => c.isCenter)
    if (center) L.push(`中宫　${center.god || '—'}　${center.tianXing || '—'}　${center.door || '—'}　${center.tianGan || '—'}　${center.diGan || '—'}`)
  }
  if (q.shenSha && q.shenSha.allItems && q.shenSha.allItems.length) {
    blank()
    L.push('── 神煞 ──')
    q.shenSha.allItems.forEach((it) => L.push(`${it.name || it.label || ''}：${it.value || it.text || ''}`))
  }

  // ---------- 二、大六壬 ----------
  section('二、大六壬')
  if (lr.layout) {
    L.push(`月将：${lr.layout.yue}　贵人：${lr.layout.guizi}　昼夜：${lr.diurnal ? '昼' : '夜'}`)
    L.push(`日干支：${lr.chartObj.nongli.dayGanZi}　时支：${lr.layout.timezi}`)
    blank()
    L.push('── 天地盘（地盘 → 天盘 / 天将） ──')
    lr.layout.downZi.forEach((d, i) => {
      L.push(`${d} → ${lr.layout.upZi[i]}　${lr.layout.houseTianJiang[i]}`)
    })
    blank()
    L.push('── 四课 ──')
    ;(lr.keData.lines || []).forEach((line) => L.push(line))
    blank()
    L.push('── 三传 ──')
    if (lr.sanChuan && lr.sanChuan.cuang) {
      const names = ['初传', '中传', '末传']
      for (let i = 0; i < 3; i += 1) {
        L.push(`${names[i]}：${lr.sanChuan.cuang[i] || '—'}　${lr.sanChuan.tianJiang[i] || ''}　${lr.sanChuan.liuQin[i] || ''}`)
      }
      if (lr.sanChuan.name) L.push(`课体：${lr.sanChuan.name}`)
    } else {
      L.push('（三传未成课）')
    }
  } else {
    L.push('（六壬起课失败：缺月将或时支）')
  }

  // ---------- 三、太乙 ----------
  if (model.taiyi) {
    section('三、太乙神数')
    const t = buildTaiyiText(model.taiyi).split('\n')
    // 去掉太乙文本自己的抬头（前 5 行），避免与本文件抬头重复；
    // 段标题降一级（═══ 一、起局 ═══ → ── 太乙·一、起局 ──），避免与三式一二三编号相混
    const start = Math.max(0, t.findIndex((line) => line.startsWith('═══')))
    t.slice(start).forEach((line) => {
      L.push(line.replace(/^═══ (.*) ═══$/, '── 太乙·$1 ──'))
    })
  }

  blank()
  L.push('说明：奇门九宫/六壬四课三传/太乙诸神均为本地引擎计算，无后端请求。')
  L.push('说明：外圈七政四余星盘依赖上游星历，未移植；三式以「奇门九宫 + 六壬天地盘四课三传 + 太乙全盘」为准。')

  return L.join('\n')
}
