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

// ---------- 一键复制：全部结果 ----------

/**
 * 生成「全部结果」纯文本，供一键复制。
 *
 * 覆盖盘面全部卡片，一字不漏：
 *   本命推算流程（10 步）/ 本命结论 / 本命条文 /
 *   流年总纲 / 流年条文（1~108 岁全）/ 说明
 *
 * @param {object} m      buildTiebanModel() 的返回值
 * @param {object|null} vs 条文库（loadTiebanVerses()）；未载入时只留条号，不阻塞复制
 */
export function buildTiebanText(m, vs) {
  if (!m || !m.result) return ''
  const { fourPillars: fp, gender, lunar, askGz, defaultAskGz } = m
  const b = m.result.benming
  const ln = m.result.liunian

  const verse = (n) => {
    if (n === null || n === undefined) return ''
    if (!vs) return '（条文库未载入）'
    return vs[String(n)] || '（此条正文原书未收）'
  }

  const L = []
  const blank = () => { if (L.length && L[L.length - 1] !== '') L.push('') }
  const section = (t) => { blank(); L.push(`═══ ${t} ═══`) }

  // ---------- 抬头 ----------
  L.push('天机阁 · 铁板神数排盘')
  L.push(`四柱：${fp.join(' ')}　${gender}命`)
  L.push(`农历：${lunar.month}月${lunar.day}日${lunar.isLeapMonth ? '（闰月按下月计）' : ''}`)
  L.push(
    `求测时辰：${askGz}`
    + (askGz === defaultAskGz ? '（本人时柱）' : `（改自本人时柱 ${defaultAskGz}，整盘已重算）`)
  )

  // ---------- 一、本命推算流程 ----------
  section('一、本命推算流程')
  ;(b.steps || []).forEach((s, i) => {
    L.push(`${i + 1}. ${s.label}：${s.input} → ${s.output !== undefined ? s.output : '—'}　（${s.table}）`)
  })

  // ---------- 二、本命结论 ----------
  section('二、本命结论')
  L.push(`考刻：${b.ke}`)
  L.push(`本命数：${b.benMingShu}`)
  L.push(`十二辟卦：${b.biGua || '（本命数超出古籍所载范围）'}`)
  L.push(`辟卦基数＋序数：${b.base != null ? `${b.base} ＋ ${b.xuShu}` : '—'}`)

  // ---------- 本命条文 ----------
  blank()
  L.push('── 本命条文 ──')
  const items = b.items || {}
  const keys = Object.keys(items)
  if (!keys.length) {
    L.push('（暂无条文）')
  } else {
    keys.forEach((k) => {
      const it = items[k]
      if (it.skipped) {
        L.push(`${k}：${it.reason}`)
        return
      }
      const nums = it.nums || []
      if (!nums.length) {
        L.push(`${k}：（无条文）`)
        return
      }
      nums.forEach((n) => L.push(`${k} ${n}：${verse(n)}`))
    })
  }

  // ---------- 三、流年总纲 ----------
  if (ln) {
    section('三、流年总纲')
    L.push(`天四声（12 年一循环）：${(ln.seq || []).join(' ')}`)
    L.push(`后天命数：${ln.houTian}`)
    L.push(`年支三合局：${ln.zhiGroup}`)
    L.push(`覆盖：${ln.rows.length} 年（1~${ln.rows.length}）`)

    // ---------- 四、流年条文 ----------
    section(`四、流年条文（${ln.rows.length} 年全）`)
    ln.rows.forEach((x) => {
      const head = `${x.age}岁　${x.gz}　${x.tianSiSheng}`
      if (x.missing) L.push(`${head}　—　（古籍原缺此格）`)
      else L.push(`${head}　${x.num}　${verse(x.num)}`)
    })
  }

  // ---------- 五、说明 ----------
  if (b.notes && b.notes.length) {
    section('五、说明')
    b.notes.forEach((n) => L.push(`· ${n}`))
  }

  return L.join('\n')
}

export {
  calcTieban,
  calcTiebanBenming,
  calcTiebanLiunian,
  correctTiebanVerse,
  loadTiebanVerses,
  TIEBAN_META,
}
