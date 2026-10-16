/**
 * 八字 · 导出给 AI 的 Markdown 文本
 *
 * 与紫微 export.js 同一套逻辑：**带上「原来（本命）信息」＋「所选层级信息」**。
 *
 * 结构：
 *   盘头（含「当前选择」：选中的大运 / 流年 / 流月，逐层列到当前层级为止）
 *   一、本命四柱（年月日时，日柱＝日元）＋ 五行 + 格局用神 + 干支关系 + 命宫身宫胎元
 *   二、大运流年总览  —— 全部大运（每运 10 年）与各运流年清单
 *   三、当前层级详情  —— 选中哪一层就展开哪一层的干支、十神、藏干、神煞
 *
 * 为什么要「带上原来信息」：
 *   AI 拿到「第 3 大运」时，若不给本命四柱，它无从判断这步运对日元是喜是忌；
 *   只给本命又不知道在讨论哪一步运。所以两者必须同时给出 —— 与紫微侧一致。
 *
 * 层级（depth）：
 *   0 = 本命　1 = 大运　2 = 流年　3 = 流月
 *   选大运 → 盘头 + 本命四柱 + 大运详情（其下流年逐条列出）
 *   选流年 → 盘头 + 本命四柱 + 大运详情 + 该流年详情
 *   选流月 → 盘头 + 本命四柱 + 大运 + 流年 + 该流月详情
 */

const X = (v) => (v === undefined || v === null || v === '' ? '—' : v)
const p2 = (n) => String(n).padStart(2, '0')

const ZHU_NAME = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' }

/** 十神简写 → 全称（引擎内部用「劫/杀/枭/才」等简写，导出给 AI 用全称更清楚） */
const SHI_SHEN_FULL = {
  比: '比肩', 劫: '劫财', 食: '食神', 伤: '伤官',
  才: '偏财', 财: '正财', 杀: '七杀', 官: '正官',
  枭: '偏印', 印: '正印'
}
const shiShen = (r) => (r ? SHI_SHEN_FULL[r] || r : '—')

const ELEMENT_CN = {
  Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水'
}

/* ---------------- 四柱 ---------------- */

/** 单柱一行：庚午（劫财）　藏干 丁/己　纳音 路旁土·胎　星运 沐浴　空亡 戌亥 */
function pillarLine(p, label) {
  if (!p || !p.ganzi) return `- **${label}**：—`
  const parts = []
  parts.push(`${p.ganzi}（${shiShen(p.stem?.relative)}）`)
  const cang = (p.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`)
  parts.push(`藏干 ${cang.length ? cang.join('、') : '—'}`)
  parts.push(`纳音 ${X(p.naying)}${p.nayingPhase ? `·${p.nayingPhase}` : ''}`)
  if (p.ganziPhase) parts.push(`星运 ${p.ganziPhase}`)
  if (p.xunEmpty) parts.push(`空亡 ${p.xunEmpty}`)
  return `- **${label}**：${parts.join('　')}`
}

/** 四柱神煞（合到一行，避免 4 柱刷屏） */
function pillarGodsLine(p, label) {
  if (!p) return ''
  const g = []
  const push = (arr, tag) => (arr || []).forEach((n) => g.push(`${n}${tag}`))
  push(p.goodGods, '(吉)')
  push(p.badGods, '(凶)')
  push(p.neutralGods, '')
  push(p.taisuiGods, '(太岁)')
  return g.length ? `- **${label}神煞**：${g.join('、')}` : ''
}

/* ---------------- 干支关系 ---------------- */

/** 把 {「甲己合土」:[{cell,zhu,...}]} 压成「甲己合土（时→身）」 */
function relationLines(obj, label) {
  const ks = Object.keys(obj || {})
  if (!ks.length) return ''
  const items = ks.map((k) => {
    const who = (obj[k] || []).map((x) => x.cell).join('')
    return `${k}${who ? `（${who}）` : ''}`
  })
  return `- **${label}**：${items.join('、')}`
}

/* ---------------- 五行 / 格局 / 用神 ---------------- */

function wuxingLines(w) {
  if (!w) return []
  const L = []
  const scores = (w.scores || []).map((s) => `${s.label} ${s.percent}%（${s.score}）`)
  L.push(`- 五行力量：${scores.join('　')}`)
  L.push(`- 合计 ${X(w.total)}　最旺：${X(w.dominant)}　最弱：${X(w.weakest)}`)
  const dm = w.dayMaster || {}
  L.push(
    `- 日主：${X(dm.element)}　同类 ${X(dm.same)} / 异类 ${X(dm.other)}（同类占 ${X(dm.samePercent)}%）　` +
      `判定：**${X(dm.verdict)}**`
  )
  const dim = w.dimensions || {}
  if (dim.summary) L.push(`- 旺衰三维：${dim.summary}`)
  if (dim.deLing) L.push(`  - 得令：${X(dim.deLing.state)}（${X(dim.deLing.score)} 分）`)
  if (dim.deDi) L.push(`  - 得地：${dim.deDi.roots?.length ? `${dim.deDi.roots.length} 处通根` : '无根'}（${X(dim.deDi.score)} 分）`)
  if (dim.deShi) L.push(`  - 得势：${X(dim.deShi.count)} 透（${X(dim.deShi.score)} 分）`)
  return L
}

function gejuLines(g) {
  if (!g) return []
  const L = []
  if (g.geju) {
    L.push(`- 格局：**${X(g.geju.name)}**　取格十神 ${shiShen(g.geju.tenGod)}　引透 ${X(g.geju.gan)}（${X(g.geju.via)}）`)
  }
  if (g.chengBai) {
    L.push(`- 成破：**${X(g.chengBai.verdict)}**　${X(g.chengBai.reason)}`)
    if (g.chengBai.breaks?.length) L.push(`  - 破格因素：${g.chengBai.breaks.join('、')}`)
    if (g.chengBai.rescues?.length) L.push(`  - 救应：${g.chengBai.rescues.join('、')}`)
    if (g.chengBai.xiang?.how) L.push(`  - 相神：${g.chengBai.xiang.how} ${X(g.chengBai.xiang.gan)}（${X(g.chengBai.xiang.el)}）`)
  }
  // 四派用神（扶抑 / 调候 / 病药 / 格局）
  const names = { yongshen: '扶抑派用神', tiaohou: '调候用神', bingyao: '病药用神', gejuYong: '格局用神' }
  for (const [k, label] of Object.entries(names)) {
    const s = g[k]
    if (!s) continue
    const xi = (s.xi || []).join('、') || '—'
    const ji = (s.ji || []).join('、') || '—'
    let extra = ''
    if (s.primary) extra = `　首取 ${s.primary}`
    if (s.climate) extra += `　气候 ${s.climate}`
    L.push(`- ${label}：喜 ${xi}　忌 ${ji}${extra}`)
    if (s.note) L.push(`  - ${s.note}`)
  }
  if (g.schools?.length) {
    L.push(`- 流派对照：${g.schools.map((s) => `${s.school}→${X(s.verdict)}`).join('　')}`)
  }
  return L
}

function tiaohouLines(t) {
  // 注意：顶层 b.tiaohou 为空对象；真实调候数据在 b.gejuYongShen.tiaohou
  //（已由 gejuLines 的「调候用神」一行覆盖）。此处仅作兜底，无数据时不输出空块。
  if (!t || (!t.climate && !t.yong?.length && !t.primary)) return []
  const L = ['- 调候：']
  if (t.climate) L.push(`  - 气候：${t.climate}`)
  if (t.monthZhi) L.push(`  - 月支：${t.monthZhi}`)
  if (t.yong?.length) L.push(`  - 调候用神：${t.yong.join('、')}${t.primary ? `　首取 ${t.primary}` : ''}`)
  return L
}

/* ---------------- 命宫 / 身宫 / 胎元 ---------------- */

function gongLines(fc) {
  const L = []
  const item = (p, label) => {
    if (!p || !p.ganzi) return
    const cang = (p.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
    L.push(`- ${label}：${p.ganzi}（${shiShen(p.stem?.relative)}）　藏干 ${cang || '—'}`)
  }
  item(fc.tai, '胎元')
  item(fc.ming, '命宫')
  item(fc.shen, '身宫')
  return L
}

/* ---------------- 大运 / 流年 ---------------- */

/** 一步大运（含其下流年清单）
 *  实测字段：{ age(起运岁), startYear, endYear, mainDirect, subDirect }
 *  注意：只有 age（起运年龄），没有 endAge —— 由 startYear/endYear 反推更可靠。 */
function daYunLine(d, idx) {
  const md = d.mainDirect || {}
  const cang = (md.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
  const godStr = []
  ;(md.goodGods || []).forEach((n) => godStr.push(`${n}(吉)`))
  ;(md.badGods || []).forEach((n) => godStr.push(`${n}(凶)`))
  ;(md.neutralGods || []).forEach((n) => godStr.push(n))
  return (
    `- **第 ${idx} 大运**：${X(md.ganzi)}（${shiShen(md.stem?.relative)}）　` +
    `${X(d.age)} 岁起　${X(d.startYear)}-${X(d.endYear)} 年　` +
    `藏干 ${cang || '—'}${godStr.length ? `　神煞 ${godStr.join('、')}` : ''}`
  )
}

/** 流年一行 */
function liuNianLine(y) {
  const cang = (y.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
  return `    - ${y.year} 年 ${X(y.ganzi)}（${shiShen(y.stem?.relative)}）　${X(y.age)} 岁　藏干 ${cang || '—'}`
}

/* ---------------- 流月 ---------------- */

/** 流月（当前大运当前流年才 eager 算；其余为 null，此处只处理有值的情况）
 *  实测字段：{ year, month(数字), day, term(节名), date, ganzi, stem, branch, stemInBranch, ... } */
function liuYueLines(months) {
  if (!months || !months.length) return []
  const L = ['- **流月**：']
  for (const m of months) {
    const cang = (m.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
    const nm = m.month ? `${m.month}月` : '—'
    L.push(
      `  - ${m.term || nm}　${X(m.ganzi)}（${shiShen(m.stem?.relative)}）　` +
        `${X(m.date)}　藏干 ${cang || '—'}`
    )
  }
  return L
}

/** 流月单行（当前层级详情用） */
function liuYueName(m) {
  if (!m) return '—'
  return `${m.term || (m.month ? `${m.month}月` : '')}`
}

/* ---------------- 盘头 ---------------- */

function baziHead(opts, sel) {
  const { pan, form } = opts
  const b = pan
  const nl = b.nongli || {}
  const L = []
  L.push('# 四柱八字 · 命理分析文本')
  L.push('')
  L.push('## 盘头')
  if (form?.name) L.push(`- 姓名：${form.name}`)
  L.push(`- 性别：${b.gender === 'Female' ? '女' : '男'}`)
  if (nl.birth) L.push(`- 出生（公历）：${nl.birth}${form?.trueSolarTime ? '（真太阳时）' : ''}`)
  if (nl.solarTime && nl.solarTime !== nl.birth) L.push(`- 真太阳时：${nl.solarTime}`)
  if (nl.year) {
    L.push(`- 出生（农历）：${nl.year}年${nl.leap ? '闰' : ''}${nl.month}${nl.day}`)
  }
  if (nl.yearGZByLunar) L.push(`- 农历年干支：${nl.yearGZByLunar}　生肖：${X(nl.shengXiaoLichun)}`)
  if (nl.jieqi) L.push(`- 节气：${nl.jieqi}　${X(nl.jiedelta)}`)
  const fc = b.fourColumns || {}
  const pillars = ['year', 'month', 'day', 'time'].map((k) => X(fc[k]?.ganzi))
  if (pillars.every((x) => x !== '—')) L.push(`- **四柱**：${pillars.join(' ')}`)
  if (b.directInfo) L.push(`- 起运：${b.directInfo}${b.directTime ? `（${b.directTime}）` : ''}`)

  // 当前选择（与紫微 xianSelectLines 同构：逐层列到当前层级为止）
  L.push(...selectLines(opts, sel))
  return L
}

/** 当前选中了哪个大运 / 流年 / 流月，逐层列到当前层级为止 */
function selectLines(opts, sel) {
  const { pan, gender } = opts
  const b = pan
  const d = sel.depth
  if (d === 0) {
    return ['- 当前视角：本命（未选择大运 / 流年，仅四柱先天盘）']
  }
  const L = []
  const dy = (b.direction || [])[sel.dyIndex]
  if (d >= 1 && dy) {
    const md = dy.mainDirect || {}
    L.push(
      `- 选择的大运：第 ${sel.dyIndex + 1} 大运　${md.ganzi}（${shiShen(md.stem?.relative)}）　` +
        `${X(dy.age)} 岁起　${X(dy.startYear)}-${X(dy.endYear)} 年`
    )
  }
  if (d >= 2 && dy) {
    const ln = (dy.subDirect || [])[sel.lnIndex]
    if (ln) {
      L.push(
        `- 选择的流年：${ln.year} 年 ${X(ln.ganzi)}（${shiShen(ln.stem?.relative)}）　${X(ln.age)} 岁`
      )
    }
  }
  if (d >= 3 && dy) {
    const ln = (dy.subDirect || [])[sel.lnIndex]
    const ly = (ln?.flowMonths || [])[sel.lyIndex]
    if (ly) L.push(`- 选择的流月：${liuYueName(ly)} ${X(ly.ganzi)}（${shiShen(ly.stem?.relative)}）`)
    else L.push(`- 选择的流月：第 ${(sel.lyIndex || 0) + 1} 月（该年流月未展开）`)
  }
  return L
}

/* ---------------- 主入口 ---------------- */

/**
 * 生成八字 AI 文本
 *
 * @param {object} opts
 *   pan     buildLocalBaziResult() 返回的整包（用 .bazi）
 *   form    原始表单（姓名 / 性别 / 真太阳时）
 *   sel     { depth, dyIndex, lnIndex, lyIndex }  当前选择层级
 * @returns {string} Markdown
 */
export function buildBaziMarkdown(opts) {
  const raw = opts.pan
  if (!raw) return ''
  const b = raw.bazi || raw
  const o = { ...opts, pan: b }
  const sel = opts.sel || { depth: 0, dyIndex: 0, lnIndex: 0, lyIndex: 0 }

  const L = baziHead(o, sel)
  const fc = b.fourColumns || {}

  // ── 一、本命四柱（无论选到哪一层都要带 —— 这是「原来信息」）──
  L.push('')
  L.push('## 一、本命四柱')
  L.push('')
  L.push('> 无论当前选中哪一层大运 / 流年，本命四柱都先给出——否则无从判断所选运对日元的喜忌。')
  L.push('')
  for (const k of ['year', 'month', 'day', 'time']) {
    L.push(pillarLine(fc[k], ZHU_NAME[k]))
  }
  L.push('')
  L.push('### 四柱神煞')
  L.push('')
  let anyGods = false
  for (const k of ['year', 'month', 'day', 'time']) {
    const line = pillarGodsLine(fc[k], ZHU_NAME[k])
    if (line) {
      L.push(line)
      anyGods = true
    }
  }
  if (!anyGods) L.push('- （无）')

  L.push('')
  L.push('### 命宫 / 身宫 / 胎元')
  L.push('')
  const gl = gongLines(fc)
  L.push(...(gl.length ? gl : ['- —']))

  L.push('')
  L.push('### 五行力量')
  L.push('')
  L.push(...wuxingLines(b.wuxingStat))

  L.push('')
  L.push('### 格局与用神')
  L.push('')
  const gjl = gejuLines(b.gejuYongShen)
  L.push(...(gjl.length ? gjl : ['- —']))
  L.push(...tiaohouLines(b.tiaohou))

  L.push('')
  L.push('### 干支关系')
  L.push('')
  const rels = [
    relationLines(fc.ganHe, '天干五合'),
    relationLines(fc.ganCong, '天干相冲'),
    relationLines(fc.ziHe6, '地支六合'),
    relationLines(fc.ziHe3, '地支三合'),
    relationLines(fc.ziHui, '地支三会'),
    relationLines(fc.ziXing, '地支相刑'),
    relationLines(fc.ziCong, '地支相冲'),
    relationLines(fc.ziCuan, '地支相穿'),
    relationLines(fc.ziPo, '地支相破')
  ].filter(Boolean)
  L.push(...(rels.length ? rels : ['- （无）']))

  // ── 二、大运流年总览 ──
  const dirs = b.direction || []
  if (dirs.length) {
    L.push('')
    L.push('## 二、大运流年总览')
    L.push('')
    L.push(`共 ${dirs.length} 步大运。每步列出干支、十神、起止年龄 / 年份，及其下流年。`)
    L.push('')
    // 只展开「当前选中」那一步的流年，其余只给干支（避免整份文档过长）
    dirs.forEach((d, i) => {
      const isSel = sel.depth >= 1 && i === sel.dyIndex
      L.push(daYunLine(d, i + 1))
      const subs = d.subDirect || []
      if (isSel && subs.length) {
        for (const y of subs) L.push(liuNianLine(y))
      } else if (subs.length) {
        L.push(
          `    - （该运 ${subs.length} 个流年：${subs[0].year} ${subs[0].ganzi} … ` +
            `${subs[subs.length - 1].year} ${subs[subs.length - 1].ganzi}，选中该大运后展开）`
        )
      }
    })
  }

  // ── 三、当前层级详情 ──
  L.push('')
  L.push('## 三、当前层级详情')
  L.push('')
  if (sel.depth === 0) {
    L.push('当前为本命视角，未选择大运 / 流年。上「二、大运流年总览」即为全部可选项。')
  } else {
    const dy = dirs[sel.dyIndex]
    if (dy) {
      const md = dy.mainDirect || {}
      L.push(`### 大运：第 ${sel.dyIndex + 1} 运 ${X(md.ganzi)}`)
      L.push('')
      L.push(`- 起止：${X(dy.age)} 岁起　${X(dy.startYear)}-${X(dy.endYear)} 年`)
      L.push(`- 干支十神：${shiShen(md.stem?.relative)}（天干）　${shiShen(md.branch?.relative)}（地支）`)
      const cang = (md.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
      L.push(`- 藏干：${cang || '—'}`)
      L.push(`- 纳音：${X(md.naying)}${md.nayingPhase ? `·${md.nayingPhase}` : ''}　星运：${X(md.ganziPhase)}`)
      const gods = []
      ;(md.goodGods || []).forEach((n) => gods.push(`${n}(吉)`))
      ;(md.badGods || []).forEach((n) => gods.push(`${n}(凶)`))
      ;(md.neutralGods || []).forEach((n) => gods.push(n))
      L.push(`- 神煞：${gods.length ? gods.join('、') : '—'}`)
    }

    if (sel.depth >= 2) {
      const ln = (dy?.subDirect || [])[sel.lnIndex]
      if (ln) {
        L.push('')
        L.push(`### 流年：${ln.year} 年 ${X(ln.ganzi)}（${X(ln.age)} 岁）`)
        L.push('')
        L.push(`- 干支十神：${shiShen(ln.stem?.relative)}（天干）　${shiShen(ln.branch?.relative)}（地支）`)
        const cang = (ln.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
        L.push(`- 藏干：${cang || '—'}`)
        L.push(`- 纳音：${X(ln.naying)}${ln.nayingPhase ? `·${ln.nayingPhase}` : ''}　星运：${X(ln.ganziPhase)}`)
        const gods = []
        ;(ln.goodGods || []).forEach((n) => gods.push(`${n}(吉)`))
        ;(ln.badGods || []).forEach((n) => gods.push(`${n}(凶)`))
        ;(ln.neutralGods || []).forEach((n) => gods.push(n))
        L.push(`- 神煞：${gods.length ? gods.join('、') : '—'}`)
        // 该年流月（引擎只对「当前公历年所在大运」预计算，其余为 null）
        const mls = liuYueLines(ln.flowMonths)
        if (mls.length) {
          L.push('')
          L.push(...mls)
        }
      }
    }

    if (sel.depth >= 3) {
      const ln = (dy?.subDirect || [])[sel.lnIndex]
      const ly = (ln?.flowMonths || [])[sel.lyIndex]
      L.push('')
      if (ly) {
        L.push(`### 流月：${liuYueName(ly)} ${X(ly.ganzi)}`)
        L.push('')
        L.push(`- 干支十神：${shiShen(ly.stem?.relative)}（天干）　${shiShen(ly.branch?.relative)}（地支）`)
        const cang = (ly.stemInBranch || []).map((s) => `${s.cell}${shiShen(s.relative)}`).join('、')
        L.push(`- 藏干：${cang || '—'}`)
        L.push(`- 节气：${X(ly.term)}　日期：${X(ly.date)}`)
      } else {
        L.push(`### 流月：第 ${(sel.lyIndex || 0) + 1} 月`)
        L.push('')
        L.push('（该年流月明细未展开；仅当前公历年所在大运的流年会预计算流月。）')
      }
    }
  }

  L.push('')
  L.push('## 说明')
  L.push('')
  L.push(
    '本文档遵循「原来信息 + 所选层级信息」：本命四柱（含五行、格局用神、干支关系）恒定给出；' +
      '选中大运 / 流年 / 流月时，在「三、当前层级详情」追加对应干支、十神、藏干、神煞。'
  )
  L.push('术语口径与原局一致：十神用全称，藏干标注十神，纳音附长生十二运（即「星运」）。')
  return L.join('\n')
}

export default buildBaziMarkdown
