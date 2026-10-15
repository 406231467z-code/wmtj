/**
 * 历法层 —— 逐行移植自 ActionScript3 源码
 * 源：WenMoTianJiK504497B3265949B6AD61C1F1F9FDD603K.as（文墨天机 农历/公历/干支/节气）
 * 所有位运算、边界判断与原版保持一致。
 */
import {
  LUNAR_INFO,
  SOLAR_TERM_INFO,
  SOLAR_MONTH_DAYS,
  GAN,
  ZHI,
  ANIMALS,
  TERM_NAMES,
  CN_DAY_NUM,
  CN_DAY_PREFIX,
  CN_MONTH,
  CN_GENG,
  ASTRO
} from './data.js'

/** 农历年是否有闰月，返回闰几月（0 = 无闰月） */
export function leapMonth(y) {
  return LUNAR_INFO[y - 1900] & 0x0f
}

/** 农历闰月的天数 */
export function leapDays(y) {
  if (leapMonth(y)) {
    return LUNAR_INFO[y - 1900] & 0x010000 ? 30 : 29
  }
  return 0
}

/** 农历某年的总天数 */
export function lYearDays(y) {
  let sum = 348
  for (let i = 32768; i > 8; i >>= 1) {
    sum += LUNAR_INFO[y - 1900] & i ? 1 : 0
  }
  return sum + leapDays(y)
}

/** 农历某年某月的天数 */
export function monthDays(y, m) {
  if (m > 12 || m < 1) return -1
  return LUNAR_INFO[y - 1900] & (65536 >> m) ? 30 : 29
}

/** 公历某年某月的天数 */
export function solarMonthDays(y, m) {
  if (m > 12 || m < 1) return -1
  if (m === 2) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28
  }
  return SOLAR_MONTH_DAYS[m - 1]
}

/** 农历年干支（以农历年为准，立春分界在 fourPillars 中处理） */
export function ganZhiYear(lYear) {
  let g = (lYear - 3) % 10
  let z = (lYear - 3) % 12
  if (g === 0) g = 10
  if (z === 0) z = 12
  return GAN[g - 1] + ZHI[z - 1]
}

/** 由「距甲子日的偏移」取干支 */
export function ganZhi(offset) {
  return GAN[offset % 10] + ZHI[offset % 12]
}

/** 第 n 个节气（1..24）在公历 y 年的日期 */
export function getTerm(y, n) {
  if (y < 1900 || y > 2100) return -1
  if (n < 1 || n > 24) return -1
  const s = SOLAR_TERM_INFO[y - 1900]
  const seg = []
  for (let i = 0; i < 6; i++) {
    seg.push(parseInt('0x' + s.slice(i * 5, i * 5 + 5), 16).toString())
  }
  const parts = []
  for (const t of seg) {
    parts.push(t[0], t.slice(1, 3), t[3], t.slice(4, 6))
  }
  return parseInt(parts[n - 1])
}

/** 农历日的中文（初一 … 三十） */
export function cnDay(d) {
  switch (d) {
    case 10: return '初十'
    case 20: return '二十'
    case 30: return '三十'
    default: return CN_DAY_PREFIX[Math.floor(d / 10)] + CN_DAY_NUM[d % 10]
  }
}

/** 农历月的中文（正月 … 腊月） */
export function cnMonth(m) {
  return CN_MONTH[m - 1] + '月'
}

/** 生肖 */
export function animalOf(lYear) {
  return ANIMALS[(lYear - 4) % 12]
}

/** 星座 */
export function astroOf(m, d) {
  const borders = [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22]
  return ASTRO.substr(m * 2 - (d < borders[m - 1] ? 2 : 0), 2) + '座'
}

/** 时辰（0..23）→ 地支索引（0 基：0=子 … 11=亥） */
export function hourToZhiIndex(h) {
  let x = h + 1
  if (x === 24) x = 0
  return Math.floor(x / 2)
}

/** 时辰（0..23）→ 时支中文 + 时辰名 */
export function hourToZhiCn(h) {
  return ZHI[hourToZhiIndex(h)] + '时'
}

/** 更（19-04 时） */
export function hourToGeng(h) {
  if (h > 23 || h < 0 || (h > 4 && h < 19)) return ''
  let n = 0
  if (h === 19 || h === 20) n = 1
  else if (h === 21 || h === 22) n = 2
  else if (h === 23 || h === 0) n = 3
  else if (h === 1 || h === 2) n = 4
  else if (h === 3 || h === 4) n = 5
  return CN_GENG[n - 1] + '更'
}

/** 刻（每分钟 14.4 分一刻） */
export function minuteToKe(min) {
  if (min > 59 || min < 0) return ''
  return CN_GENG[Math.floor(min / 14.4) - 1] + '刻'
}

/**
 * 公历 → 农历
 * 返回与原版 Solar2lunar 完全相同的字段结构
 */
export function solar2lunar(y, m, d) {
  if (y < 1900 || y > 2100) return -1
  if (y === 1900 && m === 1 && d < 31) return -1

  const base = new Date(y, m - 1, d)
  const Y = base.getFullYear()
  const M = base.getMonth() + 1
  const D = base.getDate()

  let offset = (Date.UTC(Y, M - 1, D) - Date.UTC(1900, 0, 31)) / 86400000

  let temp = 0
  let i = 1900
  for (; i < 2101 && offset > 0; i++) {
    temp = lYearDays(i)
    offset -= temp
  }
  if (offset < 0) {
    offset += temp
    i--
  }
  const lYear = i
  const leap = leapMonth(lYear)
  let isLeapMonth = false

  i = 1
  while (i < 13 && offset > 0) {
    if (leap > 0 && i === leap + 1 && isLeapMonth === false) {
      i--
      isLeapMonth = true
      temp = leapDays(lYear)
    } else {
      temp = monthDays(lYear, i)
    }
    if (isLeapMonth === true && i === leap + 1) {
      isLeapMonth = false
    }
    offset -= temp
    i++
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeapMonth) {
      isLeapMonth = false
    } else {
      isLeapMonth = true
      i--
    }
  }
  if (offset < 0) {
    offset += temp
    i--
  }
  const lMonth = i
  const lDay = offset + 1

  // 月干支：以节气为界（原版逻辑）
  const firstTerm = getTerm(Y, M * 2 - 1)
  const secondTerm = getTerm(Y, M * 2)
  let gzMonth = ganZhi((Y - 1900) * 12 + M + 11)
  if (D >= firstTerm) {
    gzMonth = ganZhi((Y - 1900) * 12 + M + 12)
  }

  let isTerm = false
  let term = ''
  if (firstTerm === D) {
    isTerm = true
    term = TERM_NAMES[M * 2 - 2]
  }
  if (secondTerm === D) {
    isTerm = true
    term = TERM_NAMES[M * 2 - 1]
  }

  const dayCyclical = Date.UTC(Y, M - 1, 1, 0, 0, 0, 0) / 86400000 + 25567 + 10
  const gzDay = ganZhi(dayCyclical + D - 1)

  const week = base.getDay()
  const weekCn = CN_DAY_NUM[week]
  const nWeek = week === 0 ? 7 : week
  const isLeapYear = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0

  return {
    cYear: Y,
    cMonth: M,
    cDay: D,
    lYear,
    lMonth,
    lDay,
    IMonthCn: (isLeapMonth ? '闰' : '') + cnMonth(lMonth),
    IDayCn: cnDay(lDay),
    gzYear: ganZhiYear(lYear),
    gzMonth,
    gzDay,
    ncWeek: '星期' + weekCn,
    ncWeek2: '周' + weekCn,
    Animal: animalOf(lYear),
    astro: astroOf(M, D),
    isToday: false,
    nWeek,
    isTerm,
    Term: term,
    isLeapYear,
    isLeapMonth
  }
}

/**
 * 农历 → 公历（再回调 solar2lunar 补全信息）
 * isLeap：是否闰月
 */
export function lunar2solar(y, m, d, isLeap) {
  const leap = leapMonth(y)
  const leapD = leapDays(y)
  if (isLeap && leap !== m) return -1
  if ((y === 2100 && m === 12 && d > 1) || (y === 1900 && m === 1 && d < 31)) return -1

  const monthD = monthDays(y, m)
  let dayLimit = monthD
  if (isLeap) dayLimit = leapD
  if (y < 1900 || y > 2100 || d > dayLimit) return -1

  let offset = 0
  for (let i = 1900; i < y; i++) {
    offset += lYearDays(i)
  }
  let leapFlag = false
  for (let i = 1; i < m; i++) {
    const l = leapMonth(y)
    if (!leapFlag) {
      if (l <= i && l > 0) {
        offset += leapD
        leapFlag = true
      }
    }
    offset += monthDays(y, i)
  }
  if (isLeap) offset += monthD

  const base = Date.UTC(1900, 1, 30, 0, 0, 0)
  const res = new Date((offset + d - 31) * 86400000 + base)
  return solar2lunar(res.getUTCFullYear(), res.getUTCMonth() + 1, res.getUTCDate())
}

/** 一年中的第几天 */
/**
 * 公历日期的日干支（与 solar2lunar 内部 gzDay 同一算法：1900-01-01 = 甲戌）
 * 供流日盘推算「某日干支」使用。
 */
export function solarDayGanZhi(y, m, d) {
  const dayCyclical = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) / 86400000 + 25567 + 10
  return ganZhi(dayCyclical + d - 1)
}

/** 五鼠遁：日干 + 时支(1..12) → 时干(1..10)（源码 UTIL WenMoTianJiK6B81DDCD） */
export function hourGanOf(dayGan, hourZhi) {
  const head = (((dayGan - 1) % 5) * 2 + 1)
  return (((head - 1 + hourZhi - 1) % 10) + 10) % 10 + 1
}

export function dayOfYear(y, m, d) {
  let n = 0
  for (let i = 1; i < m; i++) n += solarMonthDays(y, i)
  return n + d
}
