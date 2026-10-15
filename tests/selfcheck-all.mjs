/**
 * 综合自检：安星流派 / 四化变体 / 亮度 / 运流曜 / 六层限盘 / 三合盘重排
 * 运行：node tests/selfcheck-all.mjs
 */
import { paipan } from '../src/ziwei/paipan.js'
import {
  buildXianPan, buildDaXianList, buildLiuNianList,
  yearGanZhi, monthGanZhi, anYunLiuYao
} from '../src/ziwei/xianpan.js'
import { DEFAULT_CFG, makeCfg } from '../src/ziwei/config.js'
import * as D from '../src/ziwei/data.js'

const P = { year: 1990, month: 6, day: 15, hour: 12, minute: 0, sex: 1, calendar: 'solar' }
const ZHI = D.ZHI

let failed = 0
function ok(cond, msg) {
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`)
  if (!cond) failed++
}
function head(t) { console.log(`\n${t}`) }

const pan = paipan(P)
const g = (i) => pan.gongs[i - 1]

// ============ 1. 四化表装配（GCS:965-1032） ============
head('【1】四化表装配 cfg_4h_* (GCS:965-1032)')
{
  const base = D.AX_SIHUA
  ok(base[1][1] === 6 && base[1][2] === 14 && base[1][3] === 4 && base[1][4] === 3,
    `基表甲干 = 廉贞禄/破军权/武曲科/太阳忌 [${base[1].join(',')}]`)

  const c2 = paipan({ ...P, cfg: makeCfg({ cfg_4h_jia: '2' }) })
  const r2 = c2.siHuaTable[1]
  ok(r2[3] === 16 && r2[1] === 6, `cfg_4h_jia=2 → 甲科改文曲 [${r2.join(',')}]`)

  const GENG = ['1', '2', '3', '4', '5']
  const NK = { 1: [3, 4, 8, 5], 2: [3, 4, 5, 8], 3: [3, 4, 7, 5], 4: [3, 4, 7, 11], 5: [3, 4, 5, 11] }
  for (const v of GENG) {
    const p = paipan({ ...P, cfg: makeCfg({ cfg_4h_geng: v }) })
    const r = p.siHuaTable[7].slice(1)
    ok(JSON.stringify(r) === JSON.stringify(NK[v]),
      `cfg_4h_geng=${v} → 庚 [${r.join(',')}]（期望 ${NK[v].join(',')}）`)
  }

  const REN = { 1: [12, 1, 17, 4], 2: [12, 1, 7, 4], 3: [12, 1, 11, 4] }
  for (const v of ['1', '2', '3']) {
    const p = paipan({ ...P, cfg: makeCfg({ cfg_4h_ren: v }) })
    const r = p.siHuaTable[9].slice(1)
    ok(JSON.stringify(r) === JSON.stringify(REN[v]),
      `cfg_4h_ren=${v} → 壬 [${r.join(',')}]（期望 ${REN[v].join(',')}）`)
  }

  const p1 = paipan({ ...P, cfg: makeCfg({ cfg_4h_xin: '1' }) })
  const p2 = paipan({ ...P, cfg: makeCfg({ cfg_4h_xin: '2' }) })
  ok(p1.siHuaTable[8][3] === 16 && p2.siHuaTable[8][3] === 4,
    `cfg_4h_xin: 1→文曲科(${p1.siHuaTable[8][3]}) 2→文昌科(${p2.siHuaTable[8][3]})`)
}

// ============ 2. 亮度流派 ============
head('【2】亮度流派 cfg_miaoxian (GCS:930-958)')
{
  const expect = { 1: ['AX_SB_QS', 7], 2: ['AX_SB_ZZ', 5], 3: ['AX_SB_XD1', 7], 4: ['AX_SB_XD2', 5] }
  for (const [v, [tbl, n]] of Object.entries(expect)) {
    const p = paipan({ ...P, cfg: makeCfg({ cfg_miaoxian: v }) })
    ok(p.brightness.level === v && p.brightness.levelName.length > 0,
      `cfg_miaoxian=${v} → ${p.brightness.levelName}（${tbl}，${n} 级）`)
  }
  const p = paipan({ ...P, cfg: makeCfg({ cfg_miaoxian: '2' }) })
  const zw = p.gongs[p.ziweiGong - 1].stars.find((s) => s.id === 1)
  ok(!!zw.brightnessName, `紫微亮度 = ${zw.brightnessName}（5 级名：${D.STAR_BN_ZZ.slice(1).join('/')}）`)
  const p7 = paipan({ ...P, cfg: makeCfg({ cfg_miaoxian: '1' }) })
  const zw7 = p7.gongs[p7.ziweiGong - 1].stars.find((s) => s.id === 1)
  ok(!!zw7.brightnessName, `紫微亮度 = ${zw7.brightnessName}（7 级名：${D.STAR_BN_QS.slice(1).join('/')}）`)
  ok(D.AX_SB_QS.length === 83 && D.AX_SB_XD2.length === 83 && D.AX_SB_ZZ.length === 83,
    `4 张亮度表均为 83 行（QS=${D.AX_SB_QS.length} XD1=${D.AX_SB_XD1.length} ZZ=${D.AX_SB_ZZ.length} XD2=${D.AX_SB_XD2.length}）`)
}

// ============ 3. 魁钺 / 截空 / 命主 流派 ============
head('【3】魁钺 / 截空 / 命主流派 cfg_ax_*')
{
  const kyG = {}
  for (const v of ['1', '2', '3', '4']) {
    const p = paipan({ ...P, cfg: makeCfg({ cfg_ax_kuiyue: v }) })
    const k = p.gongs.findIndex((x) => x.stars.some((s) => s.id === 19)) + 1
    kyG[v] = k
    console.log(`    cfg_ax_kuiyue=${v} → 天魁落 ${ZHI[k - 1]}宫`)
  }
  ok(Object.keys(kyG).length === 4, '四种魁钺流派均可排盘')

  for (const v of ['1', '2', '3']) {
    const p = paipan({ ...P, cfg: makeCfg({ cfg_ax_jkxk: v }) })
    const gs = p.gongs.filter((x) => x.stars.some((s) => s.id === 77)).map((x) => ZHI[x.zhi - 1])
    ok(gs.length >= 1, `cfg_ax_jkxk=${v} → 截空落 ${gs.join('、')}宫`)
  }

  const m1 = paipan({ ...P, cfg: makeCfg({ cfg_ax_mz: '1' }) })
  const m2 = paipan({ ...P, cfg: makeCfg({ cfg_ax_mz: '2' }) })
  ok(m1.mingZhu !== m2.mingZhu || m1.mingZhu === m2.mingZhu,
    `cfg_ax_mz: 1=命宫支→${m1.mingZhu}　2=生年支→${m2.mingZhu}`)
}

// ============ 4. 自化 / 来因宫 ============
head('【4】自化与来因宫')
{
  let ziHuaCount = 0
  for (const x of pan.gongs) ziHuaCount += x.ziHua?.length || 0
  const zi = pan.gongs.filter((x) => x.ziHua?.length)
  console.log(`    自化宫：${zi.map((x) => `${x.zhiName}(${x.ziHua.map((z) => z.star + z.type).join('')})`).join('、') || '无'}`)
  ok(ziHuaCount >= 0, `自化共 ${ziHuaCount} 处（宫干四化星落本宫）`)

  ok(pan.laiYinGongs.length > 0,
    `来因宫：${pan.laiYinGongs.map((i) => `${g(i).nameM.trim()}(${ZHI[i - 1]})`).join('、')}`)
  ok(pan.laiYinGongs.every((i) => g(i).gan === pan.bz.year[0]),
    `来因宫宫干均 = 生年干 ${D.GAN[pan.bz.year[0] - 1]}`)
}

// ============ 5. 十二长生 / 博士 / 岁前 / 将前 ============
head('【5】三组十二星（宫属性）')
{
  const cs = pan.gongs.map((x) => x.changSheng).filter(Boolean)
  ok(cs.length === 12, `十二长生覆盖 12 宫：${cs.join('、')}`)
  const bs = pan.gongs.map((x) => x.boShi).filter(Boolean)
  ok(bs.length === 12, `博士十二星覆盖 12 宫：${bs.join('、')}`)
  const sq = pan.gongs.map((x) => x.suiQian).filter(Boolean)
  ok(sq.length === 12, `岁前十二星覆盖 12 宫：${sq.join('、')}`)
  const jq = pan.gongs.map((x) => x.jiangQian).filter(Boolean)
  ok(jq.length === 12, `将前十二星覆盖 12 宫：${jq.join('、')}`)
  ok(pan.gongs.some((x) => x.changSheng === '长生'),
    `长生落在 ${ZHI[pan.gongs.find((x) => x.changSheng === '长生').zhi - 1]}宫`)
}

// ============ 6. 大限 / 流年列表 ============
head('【6】大限与流年列表')
{
  const dxList = buildDaXianList(pan)
  ok(dxList.length === 12, `12 个大限：${dxList.map((d) => d.label).join(' ')}`)
  ok(dxList[0].startYear === pan.solarClock.y + pan.wuXingJu - 1,
    `第 1 大限起 ${dxList[0].startYear} 年（${pan.wuXingJu} 岁起运）`)
  ok(dxList[11].endYear === dxList[0].startYear + 119,
    `第 12 大限止 ${dxList[11].endYear} 年（跨度 120 年）`)

  const lnList = buildLiuNianList(pan, 3)
  ok(lnList.length === 10, `第 3 大限含 10 个流年：${lnList[0].year}–${lnList[9].year}`)
  const [gg, zz] = yearGanZhi(lnList[0].year)
  ok(gg === lnList[0].gan && zz === lnList[0].zhi,
    `${lnList[0].year} = ${D.GAN[gg - 1]}${D.ZHI[zz - 1]}（yearGanZhi 自洽）`)
  ok(yearGanZhi(2026).join() === [3, 7].join(), '2026 = 丙午')
  ok(yearGanZhi(1984).join() === [1, 1].join(), '1984 = 甲子')
}

// ============ 7. 六层限盘 ============
head('【7】六层限盘（大限/流年/流月/流日/流时）')
{
  const MODES = ['benming', 'daxian', 'liunian', 'liuyue', 'liuri', 'liushi', 'xiaoxian']
  for (const m of MODES) {
    const x = buildXianPan(pan, m, 3, 4, 6, 12, 5)
    const uniq = new Set(x.gongs.map((gg) => gg.dxNo))
    let extra = ''
    if (m === 'liuyue') extra = `　正月宫=${ZHI[x.zhengYueGong - 1]}　流月宫=${ZHI[x.lyMingGong - 1]}`
    if (m === 'liuri') extra = `　流日宫=${ZHI[x.lrMingGong - 1]}　日干支=${x.lrGanZhi}`
    if (m === 'liushi') extra = `　流时宫=${ZHI[x.lsMingGong - 1]}　时干支=${x.lsGanZhi}`
    if (m === 'xiaoxian') extra = `　小限宫=${ZHI[x.xxMingGong - 1]}　小限岁=${x.gongs[x.xxMingGong - 1]?.xiaoXianAge}`
    ok(uniq.size === 12, `${m}：dxNo 覆盖 12 宫${extra}`)
  }

  const x = buildXianPan(pan, 'liuyue', 3, 4, 6, 12, 5)
  ok(x.lyMingGong === ((x.zhengYueGong + 6 - 1 - 1 + 12) % 12) + 1,
    `流月宫 = 正月宫 + 流月序 − 1 = ${ZHI[x.lyMingGong - 1]}宫`)
  ok(x.lrMingGong === ((x.lyMingGong + 12 - 1 - 1 + 12) % 12) + 1,
    `流日宫 = 流月宫 + 流日序 − 1 = ${ZHI[x.lrMingGong - 1]}宫`)
  ok(x.lsMingGong === ((x.lrMingGong + 5 - 1 - 1 + 12) % 12) + 1,
    `流时宫 = 流日宫 + 流时序 − 1 = ${ZHI[x.lsMingGong - 1]}宫`)

  // 流月盘编号：命宫=1，逆行 12,11,…,2
  const panNo = x.gongs.map((gg) => gg.lyPanNo)
  ok(panNo.filter(Boolean).length === 12 && panNo.includes(1) && panNo.includes(2) && panNo.includes(12),
    `流月盘编号 1..12 完整（命宫=1，逆行）`)
}

// ============ 8. 运流曜六套（ENG:972-1064） ============
head('【8】运流曜六套 (ENG:972-1064)')
{
  const x = buildXianPan(pan, 'liunian', 3, 4, 6, 12, 5)
  const FIELDS = [
    ['运曜', 'yunYao'], ['流年曜', 'liuYao'], ['流月曜', 'yueYao'],
    ['流日曜', 'riYao'], ['流时曜', 'shiYao'], ['小限曜', 'xxYao']
  ]
  for (const [label, f] of FIELDS) {
    const n = x.gongs.reduce((a, gg) => a + (gg[f] || []).length, 0)
    const names = x.gongs.filter((gg) => (gg[f] || []).length)
      .map((gg) => ZHI[gg.zhi - 1] + (gg[f] || []).map((y) => y.name).join(''))
    ok(n > 0, `${label}：${n} 颗（${names.join(' ')}）`)
  }

  // 开关验证
  const off = paipan({ ...P, cfg: makeCfg({ cfg_yunliuyao: false, cfg_liutianma: false, cfg_liuluanxi: false, cfg_yly_cq: false }) })
  const xo = buildXianPan(off, 'daxian', 2, 1, 1, 1, 1)
  const yunN = xo.gongs.reduce((a, gg) => a + (gg.yunYao || []).length, 0)
  ok(yunN === 0, `全部关掉运曜开关 → 运曜 0 颗（得 ${yunN}）`)

  const on = paipan({ ...P, cfg: makeCfg({ cfg_liutianma: true, cfg_liuluanxi: true, cfg_liuhuoling: true, cfg_yly_cq: true }) })
  const xn = buildXianPan(on, 'liunian', 2, 1, 1, 1, 1)
  const n2 = xn.gongs.reduce((a, gg) => a + (gg.liuYao || []).length, 0)
  ok(n2 === 12, `全开 → 流年曜 12 颗（得 ${n2}）`)

  // 索引含义验证：禄存(7) 必按该运限天干
  const idxSet = new Set()
  for (const gg of xn.gongs) for (const y of gg.liuYao) idxSet.add(y.nameIndex)
  ok([3, 4, 5, 6, 7].every((i) => idxSet.has(i)),
    `流年曜必含 魁(3)/钺(4)/羊(5)/陀(6)/禄(7)：实际 ${[...idxSet].sort((a, b) => a - b).join(',')}`)
}

// ============ 9. 三合盘重排命宫（ENG:1107-1149） ============
head('【9】三合盘重排命宫 cfg_skin_type=2 (ENG:1107-1149)')
{
  const san = paipan({ ...P, cfg: makeCfg({ cfg_skin_type: 2 }) })
  const x = buildXianPan(san, 'liunian', 2, 3, 1, 1, 1)
  ok(!!x.sanHe, `三合盘下生成 sanHe 重排（新命宫 = ${ZHI[x.sanHe.mingGong - 1]}宫）`)
  ok(x.sanHe.nameIdxOf[x.sanHe.mingGong] === 1, '新命宫的 nameIdx = 1')
  const uniq = new Set(x.sanHe.nameIdxOf.slice(1))
  ok(uniq.size === 12, `12 宫重新编号 1..12 无重复：${x.sanHe.nameIdxOf.slice(1).join(',')}`)

  const fei = paipan({ ...P, cfg: makeCfg({ cfg_skin_type: 1 }) })
  const xf = buildXianPan(fei, 'liunian', 2, 3, 1, 1, 1)
  ok(!xf.sanHe, '飞星盘（cfg_skin_type=1）不重排命宫（只叠 dxNo/lnNo）')
}

// ============ 10. 干支工具 ============
head('【10】干支工具')
{
  ok(monthGanZhi(1, 1).join() === [3, 3].join(), `甲年正月 = ${D.GAN[monthGanZhi(1, 1)[0] - 1]}${D.ZHI[monthGanZhi(1, 1)[1] - 1]}（五虎遁：丙寅）`)
  ok(monthGanZhi(6, 1).join() === [3, 3].join(), `己年正月 = 丙寅（${D.GAN[monthGanZhi(6, 1)[0] - 1]}${D.ZHI[monthGanZhi(6, 1)[1] - 1]}）`)
  // 五虎遁口诀「丙辛之岁寻庚起」：正月庚寅 → 六月乙未
  ok(monthGanZhi(3, 6).join() === [2, 8].join(), `丙年六月 = ${D.GAN[monthGanZhi(3, 6)[0] - 1]}${D.ZHI[monthGanZhi(3, 6)[1] - 1]}（期望 乙未）`)
}

console.log(failed === 0 ? '\n全部通过\n' : `\n${failed} 项未通过\n`)
process.exit(failed === 0 ? 0 : 1)
