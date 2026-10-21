/**
 * 铁板神数 · 适配层
 *
 * 算法内核 tiebanLocal.js 自 horosa 的 zhengchuanTiebanLocal.js 原样搬入
 * （只改了数据文件路径与纳音依赖），本文件负责把 wmtj 已有的排盘结果
 * 翻译成内核要的输入形状，并与界面解耦。
 *
 * 内核需要的输入（见 calcTieban 的入口守卫）：
 *   yearGz / monthGz / dayGz / hourGz  四柱干支（缺一或非真干支即返回 null）
 *   gender                             '男' | '女'
 *   lunarMonth(1-12) / lunarDay(1-30) / isLeapMonth
 *   askGz                              求测时辰干支（可调，默认本人时柱）
 */
import calcTieban, {
  calcTiebanBenming,
  calcTiebanLiunian,
  correctTiebanVerse,
  loadTiebanVerses,
  TIEBAN_META,
} from './tiebanLocal'

const GAN = '甲乙丙丁戊己庚辛壬癸'
const ZHI = '子丑寅卯辰巳午未申酉戌亥'

/** 六十甲子（供「求测时辰」下拉） */
export const GZ60 = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12])

/** 四柱：优先八字引擎，退回紫微的 bzText（与河洛同一取舍） */
function fourPillarsOf(bazi, pan) {
  const fc = bazi && bazi.bazi && bazi.bazi.fourColumns
  if (fc) {
    const gz = (p) => (p && (p.ganzi || p.ganZhi)) || ''
    const r = [gz(fc.year), gz(fc.month), gz(fc.day), gz(fc.time)]
    if (r.every((x) => x.length === 2)) return r
  }
  const bz = pan && pan.bzText
  if (bz) {
    const r = [bz.year, bz.month, bz.day, bz.hour]
    if (r.every((x) => typeof x === 'string' && x.length === 2)) return r
  }
  return null
}

/**
 * 组装铁板模型。
 * @returns null | { fourPillars, gender, lunar, askGz, defaultAskGz, result }
 */
export function buildTiebanModel({ pan, bazi, sex, askGz }) {
  const fp = fourPillarsOf(bazi, pan)
  if (!fp) return null

  const lunar = (pan && pan.lunar) || (bazi && bazi.bazi && bazi.bazi.lunar) || null
  if (!lunar) return null
  const lunarMonth = Number(lunar.lMonth != null ? lunar.lMonth : lunar.month)
  const lunarDay = Number(lunar.lDay != null ? lunar.lDay : lunar.day)
  if (!(lunarMonth >= 1 && lunarMonth <= 12)) return null
  if (!(lunarDay >= 1 && lunarDay <= 30)) return null
  const isLeapMonth = !!(lunar.isLeapMonth || lunar.isLeap)

  const gender = +sex === 2 ? '女' : '男'
  const defaultAskGz = fp[3]
  const ask = askGz && GZ60.indexOf(askGz) >= 0 ? askGz : defaultAskGz

  let result = null
  try {
    // 内核的 monthGz 当前算法链未使用，但契约要求四柱齐备
    result = calcTieban({
      yearGz: fp[0],
      monthGz: fp[1],
      dayGz: fp[2],
      hourGz: fp[3],
      gender,
      lunarMonth,
      lunarDay,
      isLeapMonth,
      askGz: ask,
    })
  } catch (e) {
    return null
  }
  if (!result) return null

  return {
    fourPillars: fp,
    gender,
    lunar: { month: lunarMonth, day: lunarDay, isLeapMonth },
    askGz: ask,
    defaultAskGz,
    result,
  }
}

export {
  calcTieban,
  calcTiebanBenming,
  calcTiebanLiunian,
  correctTiebanVerse,
  loadTiebanVerses,
  TIEBAN_META,
}
