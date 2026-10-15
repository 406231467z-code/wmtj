/**
 * 宫位渲染数据自检：叠宫 / 多层四化角标 / 飞星入宫 / 星曜分组密度
 * 运行：node tests/selfcheck-ui.mjs
 */
import { paipan } from '../src/ziwei/paipan.js'
import { buildXianPan, xianGongName } from '../src/ziwei/xianpan.js'
import { makeCfg } from '../src/ziwei/config.js'
import * as D from '../src/ziwei/data.js'

const ZHI = D.ZHI
let failed = 0
const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) failed++ }
const head = (t) => console.log(`\n${t}`)

const P = { year: 1990, month: 6, day: 15, hour: 12, minute: 0, sex: 1, calendar: 'solar' }
const pan = paipan(P)

const groupOf = (id) => (id <= 14 ? 'zhu' : id <= 22 ? 'fu' : id <= 28 ? 'sha' : 'xiao')
const DEPTH = { benming: 0, daxian: 1, liunian: 2, liuyue: 3, liuri: 4, liushi: 5, xiaoxian: 1 }

/** 复刻 ZiweiPan 里的四化源叠加逻辑 */
function buildSources(view, x) {
  const src = [{ kind: 'sn', label: '生年', list: pan.shengNianSiHua || [] }]
  if (!x) return src
  const chain = [
    ['dx', '大限', x.dxSiHua], ['ln', '流年', x.lnSiHua],
    ['ly', '流月', x.lySiHua], ['lr', '流日', x.lrSiHua], ['ls', '流时', x.lsSiHua]
  ]
  const d = DEPTH[view] ?? 0
  for (let i = 0; i < d; i++) src.push({ kind: chain[i][0], label: chain[i][1], list: chain[i][2] || [] })
  if (view === 'xiaoxian') src.push({ kind: 'xx', label: '小限', list: x.xxSiHua || [] })
  return src
}

// ============ 1. 叠宫名 ============
head('【1】叠宫：每层的宫名 + 上一层宫名')
{
  for (const v of ['daxian', 'liunian', 'liuyue', 'liuri', 'liushi', 'xiaoxian']) {
    const x = buildXianPan(pan, v, 3, 4, 6, 12, 5)
    const names = x.gongs.map((g) => xianGongName(x, g, v)).filter(Boolean)
    const uniq = new Set(names)
    ok(uniq.size === 12, `${v}：12 宫宫名互不相同（${[...uniq].slice(0, 4).join('、')}…）`)

    // 叠宫层：上一层宫名
    const stack = x.gongs.map((g) => {
      switch (v) {
        case 'daxian': return `本命${pan.gongs[g.idx - 1].nameM.trim()}`
        case 'liunian': return g.dxName || ''
        case 'liuyue': return g.lnName || ''
        case 'liuri': return g.lyPanName || ''
        case 'liushi': return g.lrPanName || ''
        case 'xiaoxian': return g.dxName || ''
        default: return ''
      }
    })
    ok(stack.every((s) => s), `${v}：叠宫层有值（如 ${stack[0]} / ${stack[5]}）`)
  }
}

// ============ 2. 多层四化角标 ============
head('【2】星曜上的多层四化角标')
{
  const view = 'liunian'
  const x = buildXianPan(pan, view, 3, 4, 6, 12, 5)
  const src = buildSources(view, x)
  ok(src.length === 3, `流年盘叠加 3 个四化源：${src.map((s) => s.label).join('/')}`)

  const map = new Map()
  for (const s of src) {
    for (const it of s.list || []) {
      if (!it.starId) continue
      if (!map.has(it.starId)) map.set(it.starId, [])
      map.get(it.starId).push(`${s.label}${it.type}`)
    }
  }
  ok(map.size >= 4, `共 ${map.size} 颗星带四化角标`)
  for (const [id, marks] of map) {
    const gi = pan.gongs.findIndex((g) => g.stars.some((s) => s.id === id)) + 1
    console.log(`    ${D.STARS[id]}（${ZHI[gi - 1]}宫）：${marks.join(' ')}`)
  }
  // 至少有一颗星同时挂 2 个源的角标？不一定，但每层至少 1 颗
  for (const s of src) ok((s.list || []).length >= 1, `${s.label}四化 ${(s.list || []).length} 颗`)

  const v6 = buildXianPan(pan, 'liushi', 3, 4, 6, 12, 5)
  const src6 = buildSources('liushi', v6)
  ok(src6.length === 6, `流时盘叠加 6 个四化源：${src6.map((s) => s.label).join('/')}`)
}

// ============ 3. 飞星入宫 ============
head('【3】飞星：选中宫的宫干四化飞入何处')
{
  for (let gi = 1; gi <= 12; gi++) {
    const g = pan.gongs[gi - 1]
    const fei = g.ganSiHua.filter((f) => f.gong > 0)
    if (gi <= 3 || gi === pan.mingGong) {
      console.log(
        `    ${ZHI[gi - 1]}宫（${g.ganName}干）→ ` +
        (fei.map((f) => `${f.star}${f.type}→${ZHI[f.gong - 1]}宫`).join('　') || '—')
      )
    }
    ok(fei.length > 0, `${ZHI[gi - 1]}宫有 ${fei.length} 条飞星`)
  }
  const all = pan.gongs.reduce((a, g) => a + g.ganSiHua.filter((f) => f.gong > 0).length, 0)
  ok(all === 48, `12 宫 × 4 化 = ${all} 条飞星（应为 48）`)
}

// ============ 4. 星曜分组与密度 ============
head('【4】星曜分组与自适应密度')
{
  let max = 0
  const rows = []
  for (let i = 1; i <= 12; i++) {
    const g = pan.gongs[i - 1]
    const c = { zhu: 0, fu: 0, sha: 0, xiao: 0 }
    for (const s of g.stars) c[groupOf(s.id)]++
    const n = c.zhu + c.fu + c.sha + c.xiao
    if (n > max) max = n
    rows.push({ zhi: ZHI[i - 1], n, ...c })
  }
  for (const r of rows) {
    console.log(`    ${r.zhi}宫：主${r.zhu} 辅${r.fu} 煞${r.sha} 杂${r.xiao} = ${r.n}`)
  }
  ok(max > 0, `最密宫 ${max} 颗 → 密度档 ${max > 15 ? 'd3' : max > 10 ? 'd2' : 'd1'}`)
  const totalXiao = pan.gongs.reduce((a, g) => a + g.stars.filter((s) => groupOf(s.id) === 'xiao').length, 0)
  ok(totalXiao > 0, `杂曜合计 ${totalXiao} 颗（两列排版，overflow:visible 不裁剪）`)
}

// ============ 5. 底部行与运流曜 ============
head('【5】底部行：长生/博士/岁前/将前 + 运流曜')
{
  const x = buildXianPan(pan, 'liunian', 3, 4, 6, 12, 5)
  let footOk = 0
  for (const g of x.gongs) {
    const foot = [g.changSheng, g.boShi, g.suiQian, g.jiangQian].filter(Boolean)
    if (foot.length >= 2) footOk++
  }
  ok(footOk === 12, `${footOk}/12 宫底行有内容`)

  const yaoN = x.gongs.reduce((a, g) => a + g.liuYao.length, 0)
  ok(yaoN > 0, `流年曜 ${yaoN} 颗会显示在宫位底行`)
}

console.log(failed === 0 ? '\n全部通过\n' : `\n${failed} 项未通过\n`)
process.exit(failed === 0 ? 0 : 1)
