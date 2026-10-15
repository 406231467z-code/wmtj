/**
 * 限盘：大限盘 / 流年盘 / 流月盘 / 流日盘 / 流时盘
 *
 * 全部照搬反编译源码（WenMoTianJiK46167DEF02304705B093FF95C847AD49K.as）：
 *   - 大限编号 name_DX ....... ENG:1303 WenMoTianJiK9B73A908CB394075A1FD12D9B2F4FC46K
 *   - 流年编号 name_LN ....... ENG:1345 WenMoTianJiKBDC6B40439FE41398FEA4F3BF3AE4817K
 *   - 岁前十二星 lnSQX ....... ENG:1425 WenMoTianJiK06CF4798216F4D93975924E63D990AC2K
 *   - 将前十二星 lnJQX ....... ENG:1442 WenMoTianJiK34779876E54742F7A839011C8F8C3AADK
 *   - 流月/流日/流时宫 ....... ENG:1365 WenMoTianJiK550757A3497746D3958B10D80A0CDD11K
 *   - 子年斗君 ............... ENG:3928 gcs.AX_ZNDJ[农历月][时支]
 *   - 公元年→干支 ............ UTIL:22  WenMoTianJiKBD681620A6AC48D8A3202EF57E1C59A1K
 *   - 五虎遁月干支 ........... UTIL:171 WenMoTianJiK88B99FA0D76740AF81B51AB202D9A7BAK
 *   - 当前所在大限 ........... ENG:3701 WenMoTianJiKA31C9AE2F7414D33AEDF7D184EE4B369K
 *   - 四化表 ................. gcs.WenMoTianJiKF714BEC799CC49E1AAFF4B183A86C4F4K
 *   - 运流曜（六套）.......... ENG:972-1064 + ENG:1066-2451 各落宫函数
 */
import * as D from './data.js'
import { siHuaTable, kuiYueTable, SIHUA_NAME } from './paipan.js'
import { solar2lunar, lunar2solar, solarDayGanZhi, hourGanOf } from './lunar.js'

/** 运流曜类别（源码 ENG 里 addYunStar/addLiuStar/... 的分发码） */
export const YL = {
  YUN: 1,       // 运曜（大限）
  LIUNIAN: 2,   // 流年曜
  LIUYUE: 3,    // 流月曜
  LIURI: 4,     // 流日曜
  LIUSHI: 5,    // 流时曜
  XIAOXIAN: 22  // 小限曜
}

/** 运流曜名称表（1=昌 2=曲 3=魁 4=钺 5=羊 6=陀 7=禄 8=鸾 9=喜 10=马 11=火 12=铃） */
const YL_TABLES = {
  [YL.YUN]: D.YY_CHS,
  [YL.LIUNIAN]: D.LY_CHS,
  [YL.LIUYUE]: D.YUEY_CHS,
  [YL.LIURI]: D.RY_CHS,
  [YL.LIUSHI]: D.SY_CHS,
  [YL.XIAOXIAN]: D.XXY_CHS
}
const YL_FIELDS = {
  [YL.YUN]: 'yunYao',
  [YL.LIUNIAN]: 'liuYao',
  [YL.LIUYUE]: 'yueYao',
  [YL.LIURI]: 'riYao',
  [YL.LIUSHI]: 'shiYao',
  [YL.XIAOXIAN]: 'xxYao'
}

/** 盘面模式 → 读取哪一组运流曜 */
export const MODE_YL = {
  daxian: YL.YUN,
  liunian: YL.LIUNIAN,
  liuyue: YL.LIUYUE,
  liuri: YL.LIURI,
  liushi: YL.LIUSHI,
  xiaoxian: YL.XIAOXIAN
}

const wrap12 = (n) => ((((n - 1) % 12) + 12) % 12) + 1
const strip = (s) => String(s).replace(/\n/g, '')

/** 公元年 → [天干, 地支]（1 基，源码 UTIL:22） */
export function yearGanZhi(year) {
  if (year >= 0) {
    if (year === 1) return [8, 10]
    if (year === 2) return [9, 11]
    if (year === 3) return [10, 12]
    let g = (year - 3) % 10
    let z = (year - 3) % 12
    if (g === 0) g = 10
    if (z === 0) z = 12
    return [g, z]
  }
  return yearGanZhi(61 - Math.abs(year) % 60)
}

/** 五虎遁：年干 + 月序（1 = 正月） → [月干, 月支]（源码 UTIL:171） */
export function monthGanZhi(yearGan, m) {
  let g = (D.WHD[yearGan] + m - 1) % 10
  if (g === 0) g = 10
  let z = m + 2
  if (z > 12) z -= 12
  return [g, z]
}

/** 干支序号 → 干支字符串 */
export function gzText(g, z) {
  return (D.GAN[g - 1] || '') + (D.ZHI[z - 1] || '')
}

/**
 * 大限列表：每个大限的落宫、起止虚岁、起止公元年、大限干支
 * 大限干支沿用大限宫的宫干支（源码 ENG:5471 用 dx 之干查四化表）
 */
export function buildDaXianList(pan) {
  const birthYear = pan.solarClock.y
  const wj = pan.wuXingJu
  const list = []
  for (let n = 1; n <= 12; n++) {
    const g = pan.gongs.find((x) => x.daXianIndex === n) || pan.gongs[0]
    const startAge = wj + 10 * (n - 1)
    const endAge = wj + 10 * n - 1
    list.push({
      index: n,
      gong: g.idx,
      gan: g.gan,
      zhi: g.zhi,
      gz: g.ganName + g.zhiName,
      startAge,
      endAge,
      startYear: birthYear + startAge - 1,
      endYear: birthYear + endAge - 1,
      gongName: (g.nameM || '').trim().replace(/宫$/, ''),
      label: `${startAge}-${endAge}岁`
    })
  }
  return list
}

/** 某大限内的流年列表（10 年） */
export function buildLiuNianList(pan, dxIndex) {
  const dx = buildDaXianList(pan)[dxIndex - 1]
  if (!dx) return []
  const list = []
  for (let i = 1; i <= 10; i++) {
    const y = dx.startYear + i - 1
    const [g, z] = yearGanZhi(y)
    list.push({
      index: i,
      year: y,
      gan: g,
      zhi: z,
      gz: gzText(g, z),
      age: dx.startAge + i - 1
    })
  }
  return list
}

/** 当前公历日期所在的大限序号（源码 ENG:3701），返回 1..12 */
export function currentDaXianIndex(pan, today = new Date()) {
  const list = buildDaXianList(pan)
  let y = today.getFullYear()
  const m = today.getMonth() + 1
  const d = today.getDate()
  if (m === 1 || m === 2) {
    const ln = solar2lunar(y, m, d)
    if (ln !== -1 && (ln.lMonth === 11 || ln.lMonth === 12)) y -= 1
  }
  for (const dx of list) {
    if (y >= dx.startYear && y <= dx.endYear) return dx.index
  }
  return list[list.length - 1].index
}

/** 当前公历日期在该大限内的流年序号（1..10） */
export function currentLiuNianIndex(pan, dxIndex, today = new Date()) {
  const lnList = buildLiuNianList(pan, dxIndex)
  const y = today.getFullYear()
  const hit = lnList.find((x) => x.year === y)
  return hit ? hit.index : 1
}

function findStarGong(pan, starId) {
  const g = pan.gongs.find((x) => x.stars.some((s) => s.id === starId))
  return g ? g.idx : 0
}

/** 按某天干取四化（源码 gcs....F714BEC7[干]），返回 [禄,权,科,忌] */
function siHuaOf(pan, gan, SH) {
  const row = (SH || pan.siHuaTable || D.AX_SIHUA)[gan] || [0, 0, 0, 0, 0]
  const out = []
  for (let k = 1; k <= 4; k++) {
    if (!row[k]) continue
    out.push({
      type: SIHUA_NAME[k],
      starId: row[k],
      star: D.STARS[row[k]],
      gong: findStarGong(pan, row[k])
    })
  }
  return out
}

/**
 * 安一套「运流曜」（源码 ENG:1066-2451 六个落宫函数 + ENG:972-1064 的分发）
 * @param gongs 限盘宫数组（会就地写入 yunYao / liuYao / ... 字段）
 * @param kind  YL.* 类别
 * @param gan   该运限的天干（1..10）
 * @param zhi   该运限的地支（1..12）
 * @param shZhi 生时地支（火铃要用到，vars.bz[7]）
 */
export function anYunLiuYao(gongs, kind, gan, zhi, shZhi, cfg, kyTable) {
  const field = YL_FIELDS[kind]
  const names = YL_TABLES[kind] || []
  if (!field) return
  const push = (gi, idx) => {
    if (gi < 1 || gi > 12) return
    gongs[gi - 1][field].push({ nameIndex: idx, name: strip(names[idx] || '') })
  }

  // 文昌(1) / 文曲(2) —— 按干，cfg_yly_cq 控制（源码 ENG:4145）
  if (cfg.cfg_yly_cq) {
    push(D.AX_LIU_CHANG[gan] || 0, 1)
    push(D.AX_LIU_QU[gan] || 0, 2)
  }
  // 天魁(3) / 天钺(4) —— 按干，必安（源码 ENG:2417）
  const ky = (kyTable || D.AX_KY1)[gan] || [0, 0]
  push(ky[0], 3)
  push(ky[1], 4)
  // 禄存(7) / 陀罗(6) / 擎羊(5) —— 按干，必安（源码 ENG:2347）
  const lu = D.AX_LC[gan] || 0
  push(lu, 7)
  push(lu === 1 ? 12 : lu - 1, 6)
  push(lu === 12 ? 1 : lu + 1, 5)
  // 天马(10) —— 按支，cfg_liutianma（源码 ENG:1066）
  if (cfg.cfg_liutianma) push(D.AX_TM[zhi] || 0, 10)
  // 红鸾(8) / 天喜(9) —— 按支，cfg_liuluanxi（源码 ENG:1961）
  if (cfg.cfg_liuluanxi) {
    const hl = wrap12(5 - zhi)
    push(hl, 8)
    push(wrap12(hl + 6), 9)
  }
  // 火星(11) / 铃星(12) —— 按支 + 生时支，cfg_liuhuoling（源码 ENG:2273）
  if (cfg.cfg_liuhuoling) {
    const h = D.AX_HL[zhi] || [0, 0]
    push(wrap12(h[0] + shZhi - 1), 11)
    push(wrap12(h[1] + shZhi - 1), 12)
  }
}

/**
 * 生成限盘
 * @param {object} pan 本命盘（paipan() 的返回值）
 * @param {string} mode benming | daxian | liunian | liuyue | liuri | liushi
 * @param {number} dxIndex 大限序号 1..12
 * @param {number} lnIndex 流年在该大限内的序号 1..10
 * @param {number} lyIndex 流月序号 1..12（农历月）
 * @param {number} lrIndex 流日序号 1..30（农历日）
 * @param {number} lsIndex 流时序号 1..12（时辰，1=子）
 */
export function buildXianPan(pan, mode = 'benming', dxIndex = 1, lnIndex = 1, lyIndex = 1, lrIndex = 1, lsIndex = 1) {
  const cfg = pan.cfg
  const SH = pan.siHuaTable || siHuaTable(cfg)
  const kyTable = kuiYueTable(cfg)
  const dxList = buildDaXianList(pan)
  const dx = dxList[dxIndex - 1] || dxList[0]
  const lnList = buildLiuNianList(pan, dx.index)
  const ln = lnList[lnIndex - 1] || lnList[0]

  // 子年斗君（源码 ENG:3928）：AX_ZNDJ[农历生月][生时支]
  const douJun = D.AX_ZNDJ[pan.lunar.lMonth]?.[pan.bz.hour[1]] || 1
  const shZhi = pan.bz.hour[1]   // 生时支（火铃用）

  const gongs = pan.gongs.map((g) => ({
    ...g,
    stars: g.stars.map((s) => ({ ...s, sihua: s.sihua.slice() })),
    dxNo: 0, dxName: '',
    lnNo: 0, lnName: '',
    lyNo: 0, lyName: '', lyGanZhi: '',
    lrNo: 0, lrName: '', lrGanZhi: '',
    lsNo: 0, lsName: '', lsGanZhi: '',
    xxNo: 0, xxName: '',
    suiQian: '', jiangQian: '',
    yunYao: [], liuYao: [], yueYao: [], riYao: [], shiYao: [], xxYao: []
  }))
  const at = (idx) => gongs[wrap12(idx) - 1]

  // ---------- 1. 大限编号 name_DX（源码 ENG:1303）----------
  // 大限宫名的三套写法（源码 GONG:1260-1268）：
  //   飞星盘(1) → _G_DX_S2　四化盘(3) → _G_DX　三合盘(2) → _G_DX_S1
  const DX_NAME = cfg.cfg_skin_type === 1
    ? (D.GONG_DX_S2 || D.GONG_DX)
    : cfg.cfg_skin_type === 3
      ? D.GONG_DX
      : (D.GONG_DX_S1 || D.GONG_DX)

  const shun = pan.shunXing
  let dxMingGong = 0
  for (const g of gongs) {
    let n
    if (dxIndex === 0) {
      n = g.nameIdx - D.TXMG[Math.min(Math.max(lnIndex, 1), 5)] + 1
    } else {
      // 源码 ENG:1312-1319：顺行(阳男阴女) name_BM + dxIndex - 1；逆行(阴男阳女) name_BM - dxIndex + 1
      // 十二宫是逆地支排的（命宫→兄弟→夫妻…地支递减），所以大限盘编号要顺着 name_BM 加
      n = shun ? g.nameIdx + dxIndex - 1 : g.nameIdx - dxIndex + 1
    }
    n = wrap12(n)
    g.dxNo = n
    g.dxName = DX_NAME[n] || D.GONG_DX[n]
    if (n === 1) dxMingGong = g.idx
  }

  // ---------- 2. 流年编号 name_LN（源码 ENG:1345）----------
  let lnMingGong = 0
  if (ln) {
    for (const g of gongs) {
      let n = ln.zhi - g.idx + 1
      if (n <= 0) n += 12
      g.lnNo = n
      g.lnName = D.GONG_LN[n]
      if (n === 1) lnMingGong = g.idx
    }
  }

  // ---------- 3. 岁前 / 将前十二星（流年支起，源码 ENG:1425 / 1442）----------
  if (ln) {
    for (const g of gongs) {
      let v = 13 - ln.zhi + g.idx
      if (v > 12) v -= 12
      g.suiQianNo = v
      g.suiQian = D.LNSQX_CHS[v]
    }
    for (let k = 1; k <= 12; k++) {
      const gi = D.AX_LNJQX[k][ln.zhi]
      if (gi >= 1 && gi <= 12) {
        at(gi).jiangQianNo = k
        at(gi).jiangQian = D.LNJQX_CHS[k]
      }
    }
  }

  // ---------- 4. 流月 / 流日 / 流时宫（源码 ENG:1365-1423）----------
  // 正月宫 =（斗君 + 流年支 − 1）mod 12（0→12）；第 n 月宫 = 正月宫 + n − 1
  let zhengYueGong = (((douJun + (ln ? ln.zhi : 1) - 1) % 12) + 12) % 12
  if (zhengYueGong === 0) zhengYueGong = 12

  // 选中流月后的流月命宫（源码 vars.9312BA54 = _loc6_）
  const lyMingGong = wrap12(zhengYueGong + lyIndex - 1)
  // 流日宫 = 流月宫 + 流日序 − 1（源码 vars.2E0E47D2 = _loc8_）
  const lrMingGong = wrap12(lyMingGong + lrIndex - 1)
  // 流时宫 = 流日宫 + 流时序 − 1（源码 vars.0D81C115 = _loc17_）
  const lsMingGong = wrap12(lrMingGong + lsIndex - 1)

  if (ln) {
    // 4a. 十二个月的落宫 + 月干支（五虎遁）
    for (let n = 1; n <= 12; n++) {
      const gi = wrap12(zhengYueGong + n - 1)
      const g = at(gi)
      g.lyNo = n
      g.lyName = D.GONG_LY[n] || ''
      const [mg, mz] = monthGanZhi(ln.gan, n)
      g.lyGanZhi = gzText(mg, mz)
    }
    // 4b. 流月盘编号：以流月命宫为 1，逆行 12,11,…,2（源码 _loc7_ = 月序==1 ? 1 : 14-月序）
    for (let m = 1; m <= 12; m++) {
      const gi = wrap12(lyMingGong + m - 1)
      const no = m === 1 ? 1 : 14 - m
      at(gi).lyPanNo = no
      at(gi).lyPanName = D.GONG_LY[no] || ''
    }
    // 4c. 流日盘编号（同一套编号，起点平移到流日宫）
    for (let m = 1; m <= 12; m++) {
      const gi = wrap12(lrMingGong + m - 1)
      const no = m === 1 ? 1 : 14 - m
      at(gi).lrPanNo = no
      at(gi).lrPanName = D.GONG_LR[no] || ''
    }
    // 4d. 流时盘编号
    for (let m = 1; m <= 12; m++) {
      const gi = wrap12(lsMingGong + m - 1)
      const no = m === 1 ? 1 : 14 - m
      at(gi).lsPanNo = no
      at(gi).lsPanName = D.GONG_LS[no] || ''
    }
  }

  // ---------- 5. 流日 / 流时的干支 ----------
  // 流月初一：农历（流年, 流月）初一 → 公历 → 日干支；流日 n = 初一 + (n-1)
  let lrGan = 0, lrZhi = 0, lsGan = 0, lsZhi = lsIndex
  if (ln) {
    const s = lunar2solar(ln.year, lyIndex, 1, false)
    if (s !== -1) {
      const gz = solarDayGanZhi(s.cYear, s.cMonth, s.cDay)
      const g0 = D.GAN.indexOf(gz[0]) + 1
      const z0 = D.ZHI.indexOf(gz[1]) + 1
      lrGan = ((g0 - 1 + lrIndex - 1) % 10) + 1
      lrZhi = ((z0 - 1 + lrIndex - 1) % 12) + 1
      lsGan = hourGanOf(lrGan, lsIndex)
    }
  }

  // ---------- 5b. 底栏限流速查表的三个列表（标签格式照搬源码）----------
  // 流月 = 月名 + "月" + " " + 月干支（refreshLyBtnLabel:1649-1651；月干支由「流年」年干五虎遁）
  const lyList = []
  for (let n = 1; n <= 12; n++) {
    const [mg, mz] = monthGanZhi(ln ? ln.gan : pan.bz.year[0], n)
    lyList.push({ index: n, name: D.NLM_CHS[n], gz: gzText(mg, mz) })
  }

  // 流日 = 农历日名（初一…三十，lrBtnClickHandler:1356）；第 n 日干支 = 流月初一干支 + (n-1)
  const lrList = []
  let d0g = 0
  let d0z = 0
  if (ln) {
    const s0 = lunar2solar(ln.year, lyIndex, 1, false)
    if (s0 !== -1) {
      const gz0 = solarDayGanZhi(s0.cYear, s0.cMonth, s0.cDay)
      d0g = D.GAN.indexOf(gz0[0]) + 1
      d0z = D.ZHI.indexOf(gz0[1]) + 1
    }
  }
  for (let n = 1; n <= 30; n++) {
    // 该农历月可能只有 29 天：lunar2solar 返回 -1 即不存在（源码 lrBtnClickHandler:1461-1470 会弹「该日不存在」）
    const ok = ln ? lunar2solar(ln.year, lyIndex, n, false) !== -1 : false
    const g = d0g ? ((d0g - 1 + n - 1) % 10) + 1 : 0
    const z = d0z ? ((d0z - 1 + n - 1) % 12) + 1 : 0
    lrList.push({ index: n, name: D.NLD_CHS[n], gz: g ? gzText(g, z) : '', valid: ok })
  }

  // 流时 = 时支 + "时"；时干由流日干起（五鼠遁）
  const lsList = []
  for (let n = 1; n <= 12; n++) {
    const g = lrGan ? hourGanOf(lrGan, n) : 0
    lsList.push({ index: n, name: D.ZHI[n - 1] + '时', gz: g ? gzText(g, n) : '' })
  }

  // ---------- 6. 小限宫（源码 name_XX）----------
  // 小限从 _AX_XIAOXIAN[年支] 起，男顺女逆；当前小限宫 = 小限岁对应的宫
  let xxMingGong = 0
  {
    const y = new Date().getFullYear()
    const age = y - pan.solarClock.y + 1
    const cur = ((age - 1) % 12) + 1
    const hit = gongs.find((g) => g.xiaoXianAge === cur)
    xxMingGong = hit ? hit.idx : 0
    for (const g of gongs) {
      let n = 0
      if (xxMingGong) n = wrap12(g.idx - xxMingGong + 1)
      g.xxNo = n
      g.xxName = n ? (D.GONG_XX[n] || '') : ''
    }
  }

  // ---------- 7. 四化：大限干 / 流年干 / 流月干 / 流日干 / 流时干 ----------
  const dxSiHua = siHuaOf(pan, dx.gan, SH)
  // cfg_ax_ln4h（源码 ENG:761-768）：1 = 流年天干（默认）；2 = 【流年命宫】的宫干
  const ln4hGan = cfg.cfg_ax_ln4h === '2' && lnMingGong ? at(lnMingGong).gan : (ln ? ln.gan : 0)
  const lnSiHua = ln ? siHuaOf(pan, ln4hGan, SH) : []
  const lySiHua = ln ? siHuaOf(pan, (monthGanZhi(ln.gan, lyIndex)[0]), SH) : []
  const lrSiHua = lrGan ? siHuaOf(pan, lrGan, SH) : []
  const lsSiHua = lsGan ? siHuaOf(pan, lsGan, SH) : []
  const xxSiHua = xxMingGong ? siHuaOf(pan, at(xxMingGong).gan, SH) : []

  // ---------- 8. 运流曜（源码 ENG:972-1064）----------
  // 运曜（大限）：以「大限命宫」的宫干支为索引
  if (cfg.cfg_yunliuyao) {
    anYunLiuYao(gongs, YL.YUN, at(dxMingGong).gan, at(dxMingGong).zhi, shZhi, cfg, kyTable)
  }
  // 流年曜：流年干支
  if (ln) anYunLiuYao(gongs, YL.LIUNIAN, ln.gan, ln.zhi, shZhi, cfg, kyTable)
  // 流月曜：流月干支（五虎遁）
  if (ln) {
    const [mg, mz] = monthGanZhi(ln.gan, lyIndex)
    anYunLiuYao(gongs, YL.LIUYUE, mg, mz, shZhi, cfg, kyTable)
  }
  // 流日曜：流日干支
  if (lrGan) anYunLiuYao(gongs, YL.LIURI, lrGan, lrZhi, shZhi, cfg, kyTable)
  // 流时曜：五鼠遁时干 + 时支
  if (lsGan) anYunLiuYao(gongs, YL.LIUSHI, lsGan, lsZhi, shZhi, cfg, kyTable)
  // 小限曜：小限宫的宫干支
  if (xxMingGong) {
    anYunLiuYao(gongs, YL.XIAOXIAN, at(xxMingGong).gan, at(xxMingGong).zhi, shZhi, cfg, kyTable)
  }

  // ---------- 9. 三合盘（cfg_skin_type == 2）下的「重排命宫」（源码 ENG:1107-1149）----------
  // 三合盘在切到大限 / 流年时，把「选中的宫」当新命宫，命宫=1，顺行编号 1..12
  let sanHe = null
  if (cfg.cfg_skin_type === 2 && mode !== 'benming') {
    const newMing = mode === 'daxian' ? dxMingGong : lnMingGong
    if (newMing) {
      // 源码 ENG:1119-1129：新命宫 = 1，自新命宫起【逆时针】（地支递减）依次 2,3,...,12
      // —— 与十二宫的传统排布方向一致（命宫→兄弟→夫妻…）
      const nameIdxOf = new Array(13).fill(0)
      for (let k = 1; k <= 12; k++) {
        nameIdxOf[wrap12(newMing - k + 1)] = k
      }
      const table = pan.gongNameTable || []
      sanHe = {
        mingGong: newMing,
        nameIdxOf,
        gongNameOf: (gi) => table[nameIdxOf[gi]] || pan.gongs[gi - 1].name || ''
      }
      for (const g of gongs) {
        g.sanHeNameIdx = nameIdxOf[g.idx]
        // 重排后的宫名按【新编号】从本命宫名表取，而不是沿用原宫名
        g.sanHeName = sanHe.gongNameOf(g.idx)
      }
    }
  }

  return {
    mode,
    dxIndex: dx.index,
    lnIndex: ln ? ln.index : 1,
    lyIndex,
    lrIndex,
    lsIndex,
    dxList,
    lnList,
    dx,
    ln,
    douJun,
    zhengYueGong,
    dxMingGong,
    lnMingGong,
    lyMingGong,
    lrMingGong,
    lsMingGong,
    xxMingGong,
    lrGan, lrZhi, lrGanZhi: lrGan ? gzText(lrGan, lrZhi) : '',
    lsGan, lsZhi, lsGanZhi: lsGan ? gzText(lsGan, lsZhi) : '',
    // 底栏限流速查表（大限/流年/流月/流日/流时）
    lyList,
    lrList,
    lsList,
    dxSiHua,
    lnSiHua,
    lySiHua,
    lrSiHua,
    lsSiHua,
    xxSiHua,
    sanHe,
    gongs
  }
}

/**
 * 当前盘面模式下，某宫的「限盘宫名」
 * 大限 → dxName；流年 → lnName；流月 → lyPanName；流日 → lrPanName；流时 → lsPanName
 */
export function xianGongName(xian, g, mode) {
  if (!g) return ''
  switch (mode) {
    case 'daxian': return g.dxName
    case 'liunian': return g.lnName
    case 'liuyue': return g.lyPanName || g.lyName
    case 'liuri': return g.lrPanName
    case 'liushi': return g.lsPanName
    case 'xiaoxian': return g.xxName || g.nameM
    default: return g.nameM
  }
}

/** 当前盘面模式下，某宫要展示的运流曜列表 */
export function xianYao(g, mode) {
  if (!g) return []
  const k = MODE_YL[mode]
  if (!k) return []
  const f = YL_FIELDS[k]
  return g[f] || []
}

/** 当前盘面模式下的四化 */
export function xianSiHuaOf(xian, mode) {
  switch (mode) {
    case 'daxian': return xian.dxSiHua
    case 'liunian': return xian.lnSiHua
    case 'liuyue': return xian.lySiHua
    case 'liuri': return xian.lrSiHua
    case 'liushi': return xian.lsSiHua
    case 'xiaoxian': return xian.xxSiHua
    default: return []
  }
}
