/**
 * 导出给 AI 的 Markdown 文本
 *
 * 结构：
 *   盘头（含「当前选择」：选中的大限 / 流年 / 流月 / 流日 / 流时，逐层列到当前盘级为止）
 *   一、十二宫总览          12 块（未点选基线，全模式的唯一宫位内容出处）
 *   二、逐宫点选详情        12 组  × { 组头 + 12 宫 }
 *
 * 盘头必写「当前选择了哪个时间」——AI 得先知道在看哪一步大运 / 哪一年，
 * 否则下面 12×12 的宫位内容无从定位到具体时限。
 *
 * ---------------- 两种详略（cfg_aitext） ----------------
 *   1 = 完整：12 组每组把十二宫内容全量打印，共 12 × 12 = 144 块（冗余但每组自包含）
 *   2 = 精简（默认）：每组只打印「点选带来的差异」（立太极换算 + 飞星入宫），
 *                    组内十二宫的固有内容改由 AI 按宫序编号到「一、总览」对照。
 *
 *   两种模式的信息完全等价，原因见 sec2NoteCompact()：
 *   「点选」不改变任何宫位的固有内容（星曜 / 四化 / 自化 / 长生 / 运流曜 / 叠宫 / 大限小限），
 *   这些字段在两种模式下**逐字**取自同一处（一、十二宫总览）。
 *   精简节省约 72%（单年 42,005 → 11,574 字；十年文档 953 KB → 339 KB）。
 *
 * 内容口径与页面完全一致（GongCell / 宫位详情面板）：
 *   叠宫、限盘宫名、宫干支、大限小限、四类星曜（亮度 + 多层四化角标）、
 *   自化（向心↑ / 离心↓）、飞星入宫、十二长生、博士、岁前、将前、运流曜、来因宫。
 *
 * 立太极（源码 GONG:384-444）：点选 a 即以 a 为太极点，各组十二宫多一层「X之Y」换算命名。
 *   本命盘用 nameIdx，限流盘按限级改用 name_DX/LN/LY/LR/LS（源码 392-415）。
 *   两种模式的换算结果由同一个 taijiParts() 产出，不会出现两套口径。
 * 显示开关同样跟随 cfg（cfg_msihua / cfg_sj12s / cfg_jq12s / cfg_3f4z / cfg_laiyin）与星曜分类开关。
 */
import { xianGongName, xianYao, xianSiHuaOf } from './xianpan.js'
import { taijiIndexOf, taijiNewIndex, GONG_S, GONG_M } from './taiji.js'
import * as D from './data.js'

const VIEW_NAME = {
  benming: '本命盘',
  daxian: '大限盘',
  liunian: '流年盘',
  liuyue: '流月盘',
  liuri: '流日盘',
  liushi: '流时盘',
  xiaoxian: '小限盘'
}

/** 限级深度：与 ZiweiPan.DEPTH 一致 */
const DEPTH = { benming: 0, daxian: 1, liunian: 2, liuyue: 3, liuri: 4, liushi: 5, xiaoxian: 1 }

const KIND_LABEL = {
  sn: '生年', rg: '日干', dx: '大限', ln: '流年',
  ly: '流月', lr: '流日', ls: '流时', xx: '小限'
}

const GROUP_LABEL = { zhu: '主星', fu: '辅曜', sha: '煞曜', xiao: '杂曜' }
const groupOf = (id) => (id <= 14 ? 'zhu' : id <= 22 ? 'fu' : id <= 28 ? 'sha' : 'xiao')

const p2 = (n) => String(n).padStart(2, '0')
const dash = (v) => (v === undefined || v === null || v === '' ? '—' : v)

/* ---------------- 四化分层（与 ZiweiPan.siHuaSources 一致） ---------------- */

function siHuaMapOf(pan, xian, view) {
  const m = new Map()
  const push = (kind, list) => {
    for (const it of list || []) {
      if (!it.starId) continue
      if (!m.has(it.starId)) m.set(it.starId, [])
      m.get(it.starId).push({ kind, type: it.type })
    }
  }
  push('sn', pan.shengNianSiHua)
  if ((pan.riGanSiHua || []).some((it) => it.starId)) push('rg', pan.riGanSiHua)
  if (xian) {
    const chain = [
      ['dx', xian.dxSiHua],
      ['ln', xian.lnSiHua],
      ['ly', xian.lySiHua],
      ['lr', xian.lrSiHua],
      ['ls', xian.lsSiHua]
    ]
    const d = DEPTH[view] ?? 0
    for (let i = 0; i < d; i++) push(chain[i][0], chain[i][1])
    if (view === 'xiaoxian') push('xx', xian.xxSiHua)
  }
  return m
}

/* ---------------- 单颗星 ---------------- */

function starText(s, map, zihuaOn) {
  let t = s.name
  if (s.brightnessName) t += `[${s.brightnessName}]`
  const marks = map.get(s.id) || []
  if (marks.length) t += `（${marks.map((m) => KIND_LABEL[m.kind] + m.type).join('、')}）`
  if (zihuaOn) {
    if (s.ziHuaXiangXin) t += ` ↑向心${s.ziHuaXiangXin}`
    if (s.ziHuaLiXin) t += ` ↓离心${s.ziHuaLiXin}`
  }
  return t
}

function starsLine(g, group, map, zihuaOn) {
  const arr = (g.stars || []).filter((s) => groupOf(s.id) === group).sort((a, b) => a.id - b.id)
  if (!arr.length) return '—'
  return arr.map((s) => starText(s, map, zihuaOn)).join('、')
}

/* ---------------- 单个宫位 ---------------- */

/** 限盘宫名（与 GongCell.title 一致） */
function gongTitle(pan, xian, view, g, xg) {
  if (xian && view !== 'benming' && xg) {
    return xianGongName(xian, xg, view) || g.nameM
  }
  return g.nameM
}

/** 叠宫名（与 GongCell.stack 一致） */
function gongStack(pan, xian, view, g, xg) {
  if (!xg) return ''
  switch (view) {
    case 'daxian': return `本命${(g.nameM || '').trim()}`
    case 'liunian': return xg.dxName || ''
    case 'liuyue': return xg.lnName || ''
    case 'liuri': return xg.lyPanName || ''
    case 'liushi': return xg.lrPanName || ''
    case 'xiaoxian': return xg.dxName || ''
    default: return ''
  }
}

/**
 * 立太极的**唯一数据源**（源码 GONG:384-444）
 *
 *   点选 a 宫即以 a 为太极点 T，本宫 C 被换算成新的宫位编号 x：
 *        x = ((C - T + 12) % 12) + 1      （C === T 时源码置空，此处按 +1 记作新的命宫）
 *   本宫原本叫什么、里面有什么，**全部保持不变**；「T之x」只是叠加的一层换算命名。
 *
 * 精简 / 完整两种模式都从这里取值，保证两版结果不会出现两套口径。
 *
 * @returns {null | {from, taijiName, text, name, isSelf}} null = 未立太极 / 开关关闭
 */
function taijiParts(ctx, gi, taijiZhi) {
  if (!taijiZhi || ctx.cfg.cfg_taijidian === false) return null
  const g = ctx.pan.gongs[gi - 1]
  const xg = ctx.xian ? ctx.xian.gongs[gi - 1] : null
  const tg = ctx.pan.gongs[taijiZhi - 1]
  const txg = ctx.xian ? ctx.xian.gongs[taijiZhi - 1] : null
  const t = taijiIndexOf(tg, txg, ctx.view)
  const c = taijiIndexOf(g, xg, ctx.view)
  if (!t || !c) return null
  const x = taijiNewIndex(t, c) || 1
  return {
    from: (gongTitle(ctx.pan, ctx.xian, ctx.view, g, xg) || '').trim(),
    taijiName: (gongTitle(ctx.pan, ctx.xian, ctx.view, tg, txg) || '').trim(),
    text: `${GONG_S[t]}之${GONG_S[x]}`,
    name: GONG_M[x],
    isSelf: c === t
  }
}

/** 完整模式下那行「立太极」文案 */
function taijiField(ctx, gi, taijiZhi) {
  const p = taijiParts(ctx, gi, taijiZhi)
  if (!p) return ''
  return (
    `本宫原「${p.from}」保持不变，以太极点「${p.taijiName}」立太极换算 → ` +
    `「${p.text}」（即新${p.name}）` +
    (p.isSelf ? '；本宫即太极点' : '')
  )
}

/**
 * 一个宫位的完整内容（多行）
 * feiIn    ：当前选中宫飞入本宫的四化（未点选时为空）
 * fromZhi  ：来源宫地支名
 * taijiZhi ：太极点所在宫的地支号 1..12（0 = 未立太极）
 */
function gongBlock(ctx, gi, feiIn, fromZhi, taijiZhi = 0) {
  const { pan, xian, view, cfg, showGroups, map } = ctx
  const g = pan.gongs[gi - 1]
  const xg = xian ? xian.gongs[gi - 1] : null
  const zihuaOn = cfg.cfg_msihua !== false
  const lnMode = ['liunian', 'liuyue', 'liuri', 'liushi'].includes(view)

  const title = gongTitle(pan, xian, view, g, xg)
  const stack = gongStack(pan, xian, view, g, xg)
  const tags = []
  if (gi === pan.mingGong) tags.push('命宫')
  if (gi === pan.shenGong) tags.push('身宫')
  if (g.isLaiYin && cfg.cfg_laiyin !== false) tags.push('来因宫')

  const sq = cfg.cfg_sj12s === false ? '' : lnMode && xg ? xg.suiQian : g.suiQian
  const jq = cfg.cfg_jq12s === false ? '' : lnMode && xg ? xg.jiangQian : g.jiangQian
  const shown = new Set([g.changSheng, g.boShi, sq, jq].filter(Boolean))
  const xiao = (g.stars || [])
    .filter((s) => groupOf(s.id) === 'xiao' && !shown.has(s.name))
    .sort((a, b) => a.id - b.id)

  const out = []
  out.push(
    `- ${gi}. **${title}**（${g.zhiName}宫）${g.ganName}${g.zhiName}` +
      (tags.length ? `　【${tags.join('、')}】` : '')
  )
  if (stack) out.push(`  - 叠宫：${stack}`)
  const tj = taijiField(ctx, gi, taijiZhi)
  if (tj) out.push(`  - 立太极：${tj}`)
  out.push(
    `  - 大限：${g.daXianStart}-${g.daXianEnd} 岁（${dash(g.daXianName)}）　小限：${g.xiaoXianAge} 岁`
  )
  for (const grp of ['zhu', 'fu', 'sha']) {
    if (showGroups && showGroups[grp] === false) continue
    out.push(`  - ${GROUP_LABEL[grp]}：${starsLine(g, grp, map, zihuaOn)}`)
  }
  if (!showGroups || showGroups.xiao !== false) {
    out.push(
      `  - ${GROUP_LABEL.xiao}：${xiao.length ? xiao.map((s) => starText(s, map, zihuaOn)).join('、') : '—'}`
    )
  }
  if (zihuaOn) {
    const zs = []
    for (const z of g.ziHuaXiangXin || []) zs.push(`${z.star}${z.type} ↑向心（对宫宫干化入）`)
    for (const z of g.ziHua || []) zs.push(`${z.star}${z.type} ↓离心（本宫宫干化出）`)
    out.push(`  - 自化：${zs.length ? zs.join('、') : '—'}`)
  }
  if (feiIn && feiIn.length) {
    out.push(
      `  - 飞星入宫：${feiIn.map((f) => `←${fromZhi}宫 ${f.star}${f.type}`).join('、')}`
    )
  }
  out.push(
    `  - 十二长生：${dash(g.changSheng)}　博士：${dash(g.boShi)}　岁前：${dash(sq)}　将前：${dash(jq)}`
  )
  if (xg) {
    const yao = xianYao(xg, view)
    out.push(`  - 运流曜：${yao.length ? yao.map((y) => y.name).join('、') : '—'}`)
  }
  return out.join('\n')
}

/* ---------------- 盘头 ---------------- */

/**
 * 当前选中了哪个大限 / 流年 / 流月 / 流日 / 流时
 * 逐层列到当前盘级为止（DEPTH），没选到的层级不写，免得 AI 误以为已叠加。
 */
function xianSelectLines(pan, xian, view) {
  if (!xian || view === 'benming') {
    return ['- 当前盘：本命盘（先天静态盘，未叠加任何限盘，无大限 / 流年等时间选择）']
  }
  const L = [`- 当前盘：${VIEW_NAME[view] || view}`]
  /** 某宫的「宫名（地支宫）干支」 */
  const at = (gi) =>
    gi
      ? `${(pan.gongs[gi - 1].nameM || '').trim()}（${D.ZHI[gi - 1]}宫）${pan.gongs[gi - 1].ganName}${pan.gongs[gi - 1].zhiName}`
      : '—'
  const d = DEPTH[view] ?? 0

  if (d >= 1 && xian.dx) {
    const dx = xian.dx
    L.push(
      `- 选择的大限：第 ${dx.index} 大限　${dx.startAge}-${dx.endAge} 岁（${dx.startYear}-${dx.endYear} 年）　` +
        `落${dx.gongName}宫（${dx.gz}）　大限命宫＝${at(xian.dxMingGong)}`
    )
  }
  if (d >= 2 && xian.ln) {
    L.push(
      `- 选择的流年：${xian.ln.year} 年 ${xian.ln.gz}（${xian.ln.age} 岁）　流年命宫＝${at(xian.lnMingGong)}`
    )
  }
  if (d >= 3) {
    const it = (xian.lyList || [])[xian.lyIndex - 1]
    L.push(
      `- 选择的流月：${it ? `${it.name}月` : `${xian.lyIndex}月`}${it && it.gz ? `（${it.gz}）` : ''}　` +
        `流月命宫＝${at(xian.lyMingGong)}`
    )
  }
  if (d >= 4) {
    const it = (xian.lrList || [])[xian.lrIndex - 1]
    L.push(
      `- 选择的流日：${it ? it.name : `${xian.lrIndex}日`}${it && it.gz ? `（${it.gz}）` : ''}　` +
        `流日命宫＝${at(xian.lrMingGong)}`
    )
  }
  if (d >= 5) {
    const it = (xian.lsList || [])[xian.lsIndex - 1]
    L.push(
      `- 选择的流时：${it ? it.name : `${D.ZHI[xian.lsIndex - 1]}时`}${it && it.gz ? `（${it.gz}）` : ''}　` +
        `流时命宫＝${at(xian.lsMingGong)}`
    )
  }
  if (view === 'xiaoxian') {
    // 小限宫按当前公历年份推算（源码走 12 年一轮），不受大限 / 流年选择影响
    L.push(`- 小限：小限命宫＝${at(xian.xxMingGong)}（按当前公历年份推算，12 年一轮，不随大限 / 流年选择改变）`)
  }
  L.push(`- 子年斗君：${D.ZHI[xian.douJun - 1]}宫　正月宫：${D.ZHI[xian.zhengYueGong - 1]}宫`)
  return L
}

function panHead(opts, ctx) {
  const { pan, xian, view, cfg } = ctx
  const f = opts.form || {}
  const sc = pan.solarClock || {}
  const ln = pan.lunar || {}
  const bz = pan.bzText || {}
  const L = []
  L.push(`# 紫微斗数 · ${VIEW_NAME[view] || view}`)
  L.push('')
  L.push('## 盘头')
  if (f.name) L.push(`- 姓名：${f.name}`)
  L.push(`- 性别：${f.sex === 2 ? '女' : '男'}`)
  L.push(
    `- 出生（公历）：${sc.y || f.year}-${p2(sc.m || f.month)}-${p2(sc.d || f.day)} ${p2(sc.h ?? f.hour)}:${p2(sc.min ?? f.minute)}` +
      (f.trueSolarTime ? '（真太阳时）' : '')
  )
  if (ln.lYear) {
    L.push(`- 出生（农历）：${ln.lYear}年${ln.isLeap ? '闰' : ''}${ln.lMonth}月${ln.lDay}日`)
  }
  L.push(`- 四柱：${bz.year} ${bz.month} ${bz.day} ${bz.hour}`)
  L.push(`- 五行局：${dash(pan.wuXingJuName)}`)
  L.push(
    `- 命宫：${(pan.gongs[pan.mingGong - 1].nameM || '').trim()}（${D.ZHI[pan.mingGong - 1]}宫）　` +
      `身宫：${(pan.gongs[pan.shenGong - 1].nameM || '').trim()}（${D.ZHI[pan.shenGong - 1]}宫）`
  )
  L.push(`- 命主：${dash(pan.mingZhu)}　身主：${dash(pan.shenZhu)}`)
  L.push(`- 紫微在：${D.ZHI[pan.ziweiGong - 1]}宫　天府在：${D.ZHI[pan.tianfuGong - 1]}宫`)
  if ((pan.laiYinGongs || []).length) {
    L.push(
      `- 来因宫：${pan.laiYinGongs.map((i) => `${(pan.gongs[i - 1].nameM || '').trim()}（${D.ZHI[i - 1]}宫）`).join('、')}`
    )
  }
  L.push(
    `- 生年四化：${(pan.shengNianSiHua || []).filter((s) => s.starId).map((s) => `${s.star}${s.type}`).join('、') || '—'}`
  )
  // 当前选择了哪个大限 / 流年 / 流月 / 流日 / 流时（AI 先知道时间上下文）
  for (const t of xianSelectLines(pan, xian, view)) L.push(t)
  L.push(
    `- 盘面配置：${VIEW_NAME[view] || view}　亮度${pan.brightness?.levelName || cfg.cfg_miaoxian}` +
      `　魁钺法${cfg.cfg_ax_kuiyue}　空劫法${cfg.cfg_ax_jkxk}`
  )
  return L.join('\n')
}

/* ---------------- 二、逐宫点选 · 说明 ---------------- */

/** 完整模式：12×12 全量打印的结构说明 */
function sec2NoteFull(view) {
  return [
    `**结构说明**：以下 12 组，每组 = 「点选某一个宫位」时的完整盘面，组内再逐一展开十二宫，故共 12 × 12 = 144 块。`,
    '',
    `- 组标题「点选 N／12」＝ 当前点选第 N 宫，该宫同时是**立太极的太极点**；` +
      `组内十二宫每块都带一行「立太极」，说明本宫原本叫什么保持不变、以太极点换算后叫什么。`,
    `- 组内「当前宫 / 三方四正 / 宫干四化飞星」＝ 点选该宫时页面右上角显示的内容。`,
    `- 点选宫的宫干四化飞到哪个宫，那个宫的「飞星入宫」一行出现「←X宫 星曜化」；` +
      `本命盘之外再叠加的${VIEW_NAME[view] || view}四化单列一行。`,
    `- 上方「一、十二宫总览」是未点选时的基线，可与此节对照看点选带来的差异。`
  ]
}

/**
 * 精简模式：必须告诉 AI 省略了什么、怎么还原 —— 否则它会把「没抄过来」当成「没有」。
 * 写清三条：① 省略清单 ② 还原方法（按宫序编号回查总览）③ 点选到底带来了哪两件新东西 + 换算公式。
 */
function sec2NoteCompact(view) {
  return [
    '**本节省略了什么，以及如何还原**（按下面还原，结果与「完整」模式的 12×12 全量打印**逐字一致**）：',
    '',
    '1. **点选不改变任何宫位的固有内容。** 所以每组不再重复打印这些字段：' +
      '`叠宫`、`大限`、`小限`、`主星`、`辅曜`、`煞曜`、`杂曜`、`自化`、`十二长生`（含博士 / 岁前 / 将前）、`运流曜`，' +
      '以及宫位标题行（宫名 / 地支 / 干支 / 【命宫】【身宫】【来因宫】标签）。',
    '2. **还原方法**：上面这些字段**逐字**取自「一、十二宫总览」。' +
      '本节每组的十二宫编号 1..12 与总览的宫序编号**一一对应**（同为地支序：1 子宫、2 丑宫 … 12 亥宫），' +
      '按编号或「宫名 + 地支」即可取到该宫的全部内容。',
    '3. **点选只带来两件新东西**，本节每组都完整给出：',
    '   - **立太极换算**：以点选宫为太极点 T，十二宫各被重新命名为「T之x」（＝新某宫）。' +
      '换算公式：`x = ((本宫十二宫编号 − 太极点十二宫编号 + 12) % 12) + 1`；' +
      '太极点自身编号差为 0，取 +1 记作新的命宫，行尾标注「本宫即太极点」。' +
      '**各宫原名与其全部固有内容均保持不变**，「T之x」只是叠加的一层换算命名。',
    '   - **飞星入宫**：点选宫的宫干四化飞到哪个宫，该宫多一条「飞星入宫：←X宫 星曜化」' +
      '（与本组「宫干四化飞星」行同源，此处按宫就近列出，省去跨行对照）。',
    `4. 每组内的「三方四正 / 宫干四化飞星 / ${VIEW_NAME[view] || view}四化」＝ 点选该宫时页面显示的内容，两种模式完全相同。`
  ]
}

/**
 * 精简模式下，组内某一宫的「点选差异」一行：
 *   编号. 宫名（地支宫）→「T之x」＝新某宫［（本宫即太极点）］［　飞星入宫：←X宫 星曜化］
 */
function gongDeltaRow(ctx, gi, taijiZhi, feiList, fromZhi) {
  const g = ctx.pan.gongs[gi - 1]
  const xg = ctx.xian ? ctx.xian.gongs[gi - 1] : null
  const title = (gongTitle(ctx.pan, ctx.xian, ctx.view, g, xg) || '').trim()
  let r = `  ${gi}. ${title}（${g.zhiName}宫）`
  const p = taijiParts(ctx, gi, taijiZhi)
  r += p ? ` →「${p.text}」＝新${p.name}${p.isSelf ? '（本宫即太极点）' : ''}` : ' →（未立太极）'
  const fi = (feiList || []).filter((f) => f.gong === gi)
  if (fi.length) {
    r += `　飞星入宫：${fi.map((f) => `←${fromZhi}宫 ${f.star}${f.type}`).join('、')}`
  }
  return r
}

/* ---------------- 主入口 ---------------- */

/**
 * @param {object} opts { pan, xian, view, cfg, showGroups, form }
 * @returns {string} Markdown
 */
export function buildMarkdown(opts) {
  const { pan, xian, view = 'benming', cfg = {}, showGroups } = opts
  if (!pan) return ''
  const ctx = { pan, xian, view, cfg, showGroups, map: siHuaMapOf(pan, xian, view) }
  const L = [panHead(opts, ctx)]

  // 一、十二宫总览
  L.push('')
  L.push('## 一、十二宫总览（未点选）')
  L.push('')
  L.push('未点选任何宫位时的十二宫基线内容：无飞星入宫、无立太极换算。')
  L.push('')
  for (let i = 1; i <= 12; i++) L.push(gongBlock(ctx, i, [], ''))

  // 二、逐宫点选
  const compact = String(cfg.cfg_aitext ?? '2') !== '1'
  L.push('')
  L.push(compact ? '## 二、逐宫点选详情（12 组 · 精简）' : '## 二、逐宫点选详情（12 × 12 · 完整）')
  L.push('')
  for (const t of compact ? sec2NoteCompact(view) : sec2NoteFull(view)) L.push(t)
  const zihuaOn = cfg.cfg_msihua !== false
  for (let a = 1; a <= 12; a++) {
    const ga = pan.gongs[a - 1]
    const xga = xian ? xian.gongs[a - 1] : null
    const titleA = gongTitle(pan, xian, view, ga, xga)
    const fromZhi = ga.zhiName
    // 该宫宫干四化 → 落宫
    const feiList = (ga.ganSiHua || []).map((s) => ({ ...s }))

    L.push('')
    L.push(`### 点选 ${a}／12：${titleA}（${fromZhi}宫）${ga.ganName}${ga.zhiName}`)
    L.push('')
    if (compact) {
      // 每组开头的锚点：提醒 AI 固有内容在总览的哪一处，别把「没抄过来」当成「没有」
      L.push(
        `- **本组读法**：太极点＝${titleA}（第 ${a} 宫）。下列 12 行编号与「一、十二宫总览」同编号宫位一一对应；` +
          `星曜 / 四化 / 自化 / 长生 / 运流曜 / 干支 / 标签等固有内容到总览取（逐字相同），本行以下只列点选差异。`
      )
    }
    L.push(`- **当前宫**：${titleA}（${fromZhi}宫）${ga.ganName}${ga.zhiName}`)

    // 三方四正（含本宫）
    if (cfg.cfg_3f4z !== false) {
      const sfsz = (ga.sanFangSiZheng || []).map((gi) => {
        const g = pan.gongs[gi - 1]
        const main = (g.stars || [])
          .filter((s) => s.id <= 14)
          .sort((x, y) => x.id - y.id)
          .map((s) => s.name + (s.brightnessName ? `[${s.brightnessName}]` : ''))
          .join('、')
        const role = gi === a ? '本宫' : gi === ga.duiGong ? '对宫' : '三合'
        return `${(g.nameM || '').trim()}（${g.zhiName}宫）${g.ganName}${g.zhiName}·${role}：${main || '空宫'}`
      })
      L.push(`- **三方四正**：\n${sfsz.map((s) => `  - ${s}`).join('\n')}`)
    }

    // 宫干四化飞星
    const feiTxt = feiList.length
      ? feiList
          .map(
            (f) =>
              `${f.star}化${f.type} → 飞入 ${f.gong ? `${(pan.gongs[f.gong - 1].nameM || '').trim()}（${pan.gongs[f.gong - 1].zhiName}宫）` : '—'}`
          )
          .join('；')
      : '—'
    L.push(`- **宫干四化飞星（${ga.ganName}干）**：${feiTxt}`)

    // 限盘四化
    if (xian && view !== 'benming') {
      const xs = xianSiHuaOf(xian, view) || []
      L.push(
        `- **${VIEW_NAME[view] || view}四化**：${
          xs.length
            ? xs
                .map(
                  (f) =>
                    `${f.star}化${f.type} → 飞入 ${f.gong ? `${(pan.gongs[f.gong - 1].nameM || '').trim()}（${pan.gongs[f.gong - 1].zhiName}宫）` : '—'}`
                )
                .join('；')
            : '—'
        }`
      )
    }

    if (compact) {
      // 精简：只给点选带来的差异 —— 立太极换算 + 飞星入宫
      L.push('')
      L.push(
        `- **立太极换算与飞星入宫**（以太极点「${titleA}」换算；各宫原名与其全部固有内容均保持不变，仅叠加「X之Y」命名）：`
      )
      for (let i = 1; i <= 12; i++) L.push(gongDeltaRow(ctx, i, a, feiList, fromZhi))
      L.push('')
    } else {
      // 完整：点选后 12 宫全量打印（点选 a 即以 a 为太极点立太极）
      L.push('')
      L.push(`- **点选后十二宫全量**：`)
      L.push('')
      for (let i = 1; i <= 12; i++) {
        L.push(gongBlock(ctx, i, feiList.filter((f) => f.gong === i), fromZhi, a))
      }
      if (!zihuaOn) L.push('')
    }
  }

  return L.join('\n')
}
