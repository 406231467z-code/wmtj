/**
 * 紫微斗数排盘引擎 —— 移植自 ActionScript3 源码
 * 源：WenMoTianJiK46167DEF02304705B093FF95C847AD49K.as（安星落宫引擎）
 *     + gcs 常量表（src/ziwei/data.js）
 *     + 安星流派开关（src/ziwei/config.js）
 *
 * 宫位索引约定（与源码一致）：1=子 2=丑 3=寅 4=卯 5=辰 6=巳 7=午 8=未 9=申 10=酉 11=戌 12=亥
 */
import * as D from './data.js'
import { makeCfg } from './config.js'
import {
  solar2lunar,
  lunar2solar,
  hourToZhiIndex
} from './lunar.js'

// 星曜索引（与 STARS 表一致）
export const S = {
  ZIWEI: 1, TIANJI: 2, TAIYANG: 3, WUQU: 4, TIANTONG: 5, LIANZHEN: 6,
  TIANFU: 7, TAIYIN: 8, TANLANG: 9, JUMEN: 10, TIANXIANG: 11, TIANLIANG: 12,
  QISHA: 13, POJUN: 14, WENCHANG: 15, WENQU: 16, ZUOFU: 17, YOUBI: 18,
  TIANKUI: 19, TIANYUE: 20, LUCUN: 21, TIANMA: 22, HUOXING: 23, LINGXING: 24,
  QINGYANG: 25, TUOLUO: 26, DIKONG: 27, DIJIE: 28,
  GUCHEN: 48, GUASU: 57, JIEKONG: 77, XUNKONG: 78,
  // 小星（源码 ENG:1199 主调度里的各安星函数）
  // 注：天福是 id 29，与上面的天府(7) 同名不同星，故记 TIANFU2
  TIANFU2: 29, TIANGUAN: 30, TIANXING: 31, BAZUO: 32, SANTAI: 33, TIANCAI: 34,
  TIANYUE2: 35, TIANWU: 36, TIANKONG: 37, TIANYAO: 38, TIANKU: 39, TIANXI: 40,
  TIANXU: 41, TIANGUI: 42, TIANSHOU: 43, TIANCHU: 44, TIANDE: 45, YUEDE: 46,
  TAIFU: 47, FENGGAO: 50, HONGLUAN: 51, ENGUANG: 52, POSUI: 53, YINSHA: 54,
  HUAGAI: 55, JIESHEN: 56, FENGGE: 58, FEILIAN: 59, LONGCHI: 60, DAHAO: 62,
  TIANSHI: 64, TIANSHANG: 65, NIANJIE: 79, JIESHA: 80, LONGDE: 81, XIANCHI: 82
}

/** 四化名（gcs._SH_CHS，index 1..4） */
export const SIHUA_NAME = ['', '禄', '权', '科', '忌']

const CHANG_SHENG_RAW = D.SECS_CHS || []
/** 十二长生名（源码 _SECS_CHS 带换行，UI 需 strip） */
const CHANG_SHENG = CHANG_SHENG_RAW.map((s) => String(s).replace(/\n/g, ''))

const wrap12 = (n) => ((((n - 1) % 12) + 12) % 12) + 1

/**
 * 四化表装配（源码 GCS:965-1032）
 * 只覆盖 index 1(甲) / 5(戊) / 7(庚) / 8(辛) / 9(壬) / 10(癸)；
 * index 0、2(乙)、3(丙)、4(丁)、6(己) 恒用基表。
 * 枚举外的值保持基表原值不动（源码无 else 兜底）。
 */
export function siHuaTable(cfg) {
  const t = D.AX_SIHUA.map((r) => r.slice())
  const set = (i, arr) => { t[i] = arr.slice() }
  if (cfg.cfg_4h_jia === '1') set(1, D.AX_SIHUA_JLPWY)
  else if (cfg.cfg_4h_jia === '2') set(1, D.AX_SIHUA_JLPQY)

  if (cfg.cfg_4h_wu === '1') set(5, D.AX_SIHUA_WTYYOUJ)
  else if (cfg.cfg_4h_wu === '2') set(5, D.AX_SIHUA_WTYYANGJ)

  if (cfg.cfg_4h_geng === '1') set(7, D.AX_SIHUA_GYWYT)
  else if (cfg.cfg_4h_geng === '2') set(7, D.AX_SIHUA_GYWTY)
  else if (cfg.cfg_4h_geng === '3') set(7, D.AX_SIHUA_GYWFT)
  else if (cfg.cfg_4h_geng === '4') set(7, D.AX_SIHUA_GYWFX)
  else if (cfg.cfg_4h_geng === '5') set(7, D.AX_SIHUA_GYWTX)

  if (cfg.cfg_4h_xin === '1') set(8, D.AX_SIHUA_XJYQC)
  else if (cfg.cfg_4h_xin === '2') set(8, D.AX_SIHUA_XJYWC)

  if (cfg.cfg_4h_ren === '1') set(9, D.AX_SIHUA_RLZFW)
  else if (cfg.cfg_4h_ren === '2') set(9, D.AX_SIHUA_RLZFW2)
  else if (cfg.cfg_4h_ren === '3') set(9, D.AX_SIHUA_RLZXW)

  if (cfg.cfg_4h_gui === '1') set(10, D.AX_SIHUA_GPJYT1)
  else if (cfg.cfg_4h_gui === '2') set(10, D.AX_SIHUA_GPJYT2)

  return t
}

/** 亮度表 + 名称表（源码 GCS:930-958，按 cfg_miaoxian 选） */
export function brightnessTable(cfg) {
  switch (cfg.cfg_miaoxian) {
    case '1': return { t: D.AX_SB_QS, names: D.STAR_BN_QS }
    case '2': return { t: D.AX_SB_ZZ, names: D.STAR_BN_ZZ }
    case '3': return { t: D.AX_SB_XD1, names: D.STAR_BN_QS }
    case '4': return { t: D.AX_SB_XD2, names: D.STAR_BN_ZZ }
    default: return { t: D.AX_SB_XD1, names: D.STAR_BN_QS }
  }
}

/** 天魁天钺表（源码 GCS:889-908，按 cfg_ax_kuiyue 选） */
export function kuiYueTable(cfg) {
  switch (cfg.cfg_ax_kuiyue) {
    case '2': return D.AX_KY2
    case '3': return D.AX_KY3
    case '4': return D.AX_KY4
    default: return D.AX_KY1
  }
}

/**
 * 截空双宫（源码 ENG:1827-1850，star 77）
 * 1 → _AX_JK_ARR1（一维，取 [年干] 与 [年干] 相邻）
 * 2 → _AX_JK_ARR2（二维，[年干] = [正空, 截空]）
 * 3 → _AX_JK_ARR3（一维）
 */
function jieKongGongs(cfg, yGan) {
  if (cfg.cfg_ax_jkxk === '1') {
    const a = D.AX_JK1[yGan] || 0
    return [a, a]
  }
  if (cfg.cfg_ax_jkxk === '3') {
    const a = D.AX_JK3[yGan] || 0
    return [a, a]
  }
  const row = D.AX_JK2[yGan] || [0, 0]
  return [row[0], row[1]]
}

/**
 * 旬空双宫（源码 ENG:1455-1580，star 78）
 * 年干支还原所属旬，取该旬空亡之两宫（阳干先正空，阴干反之）
 */
function xunKongGongs(yGan, yZhi) {
  const yang = yGan % 2 === 1
  const pair = (a, b) => (yang ? [a, b] : [b, a])
  const d = yZhi - yGan
  if (d === 0) return pair(11, 12)
  if (d === 2) return pair(1, 2)
  if (d === 4 || d === -8) return pair(3, 4)
  if (d === 6 || d === -6) return pair(5, 6)
  if (d === 8 || d === -4) return pair(7, 8)
  if (d === 10 || d === -2) return pair(9, 10)
  return [0, 0]
}

// 擎羊 / 陀罗（按年干 1..10）—— 通行安星法（源码表待进一步对齐）
const YANG_TUO = [
  null,
  [4, 2], [5, 3], [7, 5], [8, 6], [7, 5],
  [8, 6], [10, 8], [11, 9], [1, 11], [2, 12]
]

// 地空 / 地劫（按出生时支 0 基：0=子 … 11=亥）
// 均从亥宫起子时：地空逆行(亥−时支)、地劫顺行(亥+时支) → 子时、午时两星同宫
// 校验：子时同落亥；午时同落巳；亥时地空在子、地劫在戌
const KONG_JIE = [
  [12, 12], [11, 1], [10, 2], [9, 3], [8, 4], [7, 5],
  [6, 6], [5, 7], [4, 8], [3, 9], [2, 10], [1, 11]
]

/** 十天干索引（1..10）：甲=1 … 癸=10 */
function indexOfGan(ch) { return D.GAN.indexOf(ch) + 1 }
function indexOfZhi(ch) { return D.ZHI.indexOf(ch) + 1 }

/**
 * 均时差 EOT = 真太阳时 − 平太阳时（分钟）
 * 用平黄经 L 与太阳赤经 α 之差换算：EOT = 4·(L − α)，单位 度→分钟。
 * 校验：11-03 得 +16.32（真值 +16.4）；02-11 得 −14.58（真值 −14.2）。
 */
function equationOfTime(t) {
  const RAD = Math.PI / 180
  const n = (t - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000 // 距 J2000.0 的天数
  const norm = (x) => ((x % 360) + 360) % 360
  const L = norm(280.46 + 0.9856474 * n)          // 太阳平黄经
  const g = norm(357.528 + 0.9856003 * n)         // 平近点角
  const lam = L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD) // 黄经
  // 赤经 α（atan2 自动落在与 λ 相同的象限）
  const eps = 23.439 * RAD
  const alpha = norm(Math.atan2(Math.cos(eps) * Math.sin(lam * RAD), Math.cos(lam * RAD)) / RAD)
  let diff = L - alpha
  while (diff > 180) diff -= 360
  while (diff <= -180) diff += 360
  return diff * 4
}

/**
 * 真太阳时换算
 * 真太阳时 = 钟表时间(北京时间) + 经度修正 + 均时差；东经 120 为基准（源码 gcs._BJJD=120）。
 */
export function toTrueSolarTime(y, m, d, h, min, jd) {
  const t = Date.UTC(y, m - 1, d, h, min)
  const lonDiff = (jd - 120) * 4 // 每度 4 分钟（东经 120 为基准）
  const eot = equationOfTime(t)
  const r = new Date(t + (lonDiff + eot) * 60000)
  return {
    y: r.getUTCFullYear(),
    m: r.getUTCMonth() + 1,
    d: r.getUTCDate(),
    h: r.getUTCHours(),
    min: r.getUTCMinutes()
  }
}

/** 五虎遁：正（寅）月天干 = WHD[年干] */
function monthHeadGan(yearGan) {
  return D.WHD[yearGan]
}

/** 十天干循环归一（1..10） */
function wrap12Gan(g) { return ((g - 1 + 10) % 10) + 1 }

/**
 * 第 n 宫的天干（五虎遁：寅宫起月干，其余按地支序顺推）
 * n 为地支索引（1=子 … 3=寅 … 12=亥）
 */
function gongGan(n, yearGan) {
  const head = monthHeadGan(yearGan)
  const offset = (n - 3 + 12) % 12
  return ((head - 1 + offset) % 10) + 1
}

/** 五鼠遁：子时天干（按日干 1..10） */
function hourHeadGan(dayGan) {
  return (((dayGan - 1) % 5) * 2 + 1)
}

/**
 * 主入口
 * @param {Object} opt
 *  year/month/day/hour/minute 出生时间（钟表时间）
 *  calendar: 'solar' | 'lunar'
 *  isLeap: 农历闰月
 *  sex: 1=男 2=女
 *  jd: 出生地经度（东经），默认 120
 *  trueSolarTime: 是否换算真太阳时
 *  cfg: 安星配置（见 config.js），缺省用 DEFAULT_CFG
 */
export function paipan(opt) {
  const {
    year, month, day, hour, minute,
    calendar = 'solar',
    isLeap = false,
    sex = 1,
    jd = 120,
    trueSolarTime = true
  } = opt
  const cfg = makeCfg(opt.cfg)

  // ---------- 1. 时间换算 ----------
  let cy = year, cm = month, cd = day, ch = hour, cmin = minute
  if (calendar === 'lunar') {
    const s = lunar2solar(year, month, day, isLeap)
    if (s === -1) throw new Error('农历日期超出支持范围（1900-2100）')
    cy = s.cYear; cm = s.cMonth; cd = s.cDay
  }
  const solarClock = { y: cy, m: cm, d: cd, h: ch, min: cmin }
  const st = trueSolarTime ? toTrueSolarTime(cy, cm, cd, ch, cmin, jd) : solarClock

  const lunar = solar2lunar(st.y, st.m, st.d)
  if (lunar === -1) throw new Error('日期超出支持范围（1900-01-31 ~ 2100-12-01）')

  // ---------- 2. 四柱 ----------
  const lMonth = lunar.lMonth
  const lDay = lunar.lDay
  const yearPillar = lunar.gzYear               // 农历年干支
  const yGan = indexOfGan(yearPillar[0])
  const yZhi = indexOfZhi(yearPillar[1])

  // 月干 = (五虎遁(年干) + 农历月 - 1) % 10，为 0 记 10（源码 WenMoTianJiKA48FFE45）
  const mGanRaw = (D.WHD[yGan] + lMonth - 1) % 10
  const mGan = mGanRaw === 0 ? 10 : mGanRaw
  const mZhi = lMonth + 2 > 12 ? lMonth + 2 - 12 : lMonth + 2

  // ---------- 晚子时（cfg_wanzishi_bz）----------
  // hourToZhiIndex 把 00:00-00:59 与 23:00-23:59 **都**映射成「子」（0 基 0），
  // 所以早/晚子时开关根本不该去改时支——旧实现写 `hZhi0 = 11`（11 是「亥」），
  // 一旦命中就会把子时算成亥时；另一个分支 `hZhi0 = 0` 更是空操作。
  // 真正的分歧点是**日柱**：23 点算当日还是次日。时支恒为子，时干按日干起。
  let dayPillar = lunar.gzDay
  if (st.h === 23 && cfg.cfg_wanzishi_bz === '2') {
    const t = new Date(Date.UTC(st.y, st.m - 1, st.d) + 86400000)
    const nl = solar2lunar(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
    if (nl !== -1 && nl && nl.gzDay) dayPillar = nl.gzDay
  }
  const dGan = indexOfGan(dayPillar[0])
  const dZhi = indexOfZhi(dayPillar[1])

  // 早子时（cfg_zaozishi='2' 归当日）：hourToZhiIndex(0) 本就是子，此处无需改动。
  const hZhi0 = hourToZhiIndex(st.h)            // 0 基（23 点与 0 点均为 0=子）
  const hZhi = hZhi0 + 1                        // 1 基（源码 vars.bz[7]）
  const hGan = wrap12Gan((hourHeadGan(dGan) - 1 + hZhi0) % 10 + 1)

  const bz = {
    year: [yGan, yZhi],
    month: [mGan, mZhi],
    day: [dGan, dZhi],
    hour: [hGan, hZhi]
  }

  // ---------- 3. 定命宫 / 身宫（源码 3882 / 3931）----------
  let mg = lMonth >= hZhi ? lMonth - hZhi + 3 : lMonth - hZhi + 15
  if (mg <= 0) mg += 12
  if (mg > 12) mg -= 12

  let sg = lMonth + hZhi + 1
  if (sg > 24) sg -= 24
  else if (sg > 12) sg -= 12
  else if (sg <= 0) sg += 12

  // ---------- 4. 十二宫天干（源码 3848）----------
  // 本命宫名的三套写法：飞星盘(1) → _G_BM_FX　四化盘(3) → _G_BM_4H　三合盘(2) → _G_BM
  const BM_NAME = cfg.cfg_skin_type === 1
    ? (D.GONG_BM_FX || D.GONG_BM)
    : cfg.cfg_skin_type === 3
      ? (D.GONG_BM_4H || D.GONG_BM)
      : D.GONG_BM

  const gongs = []
  for (let i = 1; i <= 12; i++) {
    gongs[i] = {
      idx: i,
      zhi: i,
      zhiName: D.ZHI[i - 1],
      gan: gongGan(i, yGan),
      ganName: D.GAN[gongGan(i, yGan) - 1],
      nameIdx: ((mg - i + 12) % 12) + 1,   // 十二宫名索引（1=命宫…12=父母）
      stars: [],
      isMing: i === mg,
      isShen: i === sg,
      // 运流曜（源码 GONG 的六个数组；由 xianpan.js 填充）
      yunYao: [], liuYao: [], yueYao: [], riYao: [], shiYao: [], xxYao: []
    }
    gongs[i].name = BM_NAME[gongs[i].nameIdx]
    gongs[i].nameM = D.GONG_BM_M[gongs[i].nameIdx] || gongs[i].name.replace(/\s+/g, '')
    gongs[i].nameS = D.GONG_BM_S[gongs[i].nameIdx] || ''
  }

  // ---------- 5. 五行局（源码 3953）----------
  const tg = yGan > 5 ? yGan - 5 : yGan
  const dz = mg % 2 === 0 ? Math.floor(mg / 2) : Math.ceil(mg / 2)
  const wuXingJu = D.AX_WXJS[tg][dz]
  const wuXingJuName = D.WXJS_CHS[wuXingJu] || ''

  // ---------- 6. 起紫微 + 布十四主星（源码 3965）----------
  let zw = 0
  for (let n = 0; n <= 12; n++) {
    if ((lDay + n) % wuXingJu === 0) {
      const q = (lDay + n) / wuXingJu
      if (n === 0) zw = q + 2
      else if (n % 2 === 1) zw = q - n + 2
      else zw = q + n + 2
      break
    }
  }
  while (zw <= 0) zw += 12
  while (zw > 12) zw -= 12

  const TF_MAP = [0, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 7, 6]
  const tf = TF_MAP[zw]

  const bright = brightnessTable(cfg)
  const add = (idx, starId) => addStar(gongs, idx, starId, bright)

  add(zw, S.ZIWEI)
  add(wrap12(zw - 1), S.TIANJI)
  add(wrap12(zw - 3), S.TAIYANG)
  add(wrap12(zw - 4), S.WUQU)
  add(wrap12(zw - 5), S.TIANTONG)
  add(wrap12(zw - 8), S.LIANZHEN)
  add(tf, S.TIANFU)
  add(wrap12(tf + 1), S.TAIYIN)
  add(wrap12(tf + 2), S.TANLANG)
  add(wrap12(tf + 3), S.JUMEN)
  add(wrap12(tf + 4), S.TIANXIANG)
  add(wrap12(tf + 5), S.TIANLIANG)
  add(wrap12(tf + 6), S.QISHA)
  add(wrap12(tf + 10), S.POJUN)

  // ---------- 7. 辅曜 / 煞曜（源码各 _AX_* 表）----------
  const cq = D.AX_CQ[hZhi] || [0, 0]
  add(cq[0], S.WENCHANG)
  add(cq[1], S.WENQU)

  const zy = D.AX_ZY[lMonth] || [0, 0]
  add(zy[0], S.ZUOFU)
  add(zy[1], S.YOUBI)

  // 天魁天钺（按 cfg_ax_kuiyue 选表）
  const ky = kuiYueTable(cfg)[yGan] || [0, 0]
  add(ky[0], S.TIANKUI)
  add(ky[1], S.TIANYUE)

  // 禄存（按年干）、天马（按年支，cfg_tianma）
  add(D.AX_LC[yGan], S.LUCUN)
  if (cfg.cfg_tianma === '2') add(wrap12(yZhi + 3), S.TIANMA)  // 分支 B：年支 +3
  else add(D.AX_TM[yZhi], S.TIANMA)                            // 分支 A：_AX_TM_ARR

  // 火星铃星（_AX_HL_ARR 给的是「子时」基准宫，再按时支顺行至生时）
  const hl = D.AX_HL[yZhi] || [0, 0]
  add(wrap12(hl[0] + hZhi0), S.HUOXING)
  add(wrap12(hl[1] + hZhi0), S.LINGXING)

  // 孤辰寡宿（按年支）
  const gg = D.AX_GG[yZhi] || [0, 0]
  add(gg[0], S.GUCHEN)
  add(gg[1], S.GUASU)

  // 截空（按年干 + cfg_ax_jkxk）
  const jk = jieKongGongs(cfg, yGan)
  add(jk[0], S.JIEKONG)
  if (jk[1] !== jk[0]) add(jk[1], S.JIEKONG)

  // 旬空（按年干支，源码 ENG:1455）
  const xk = xunKongGongs(yGan, yZhi)
  add(xk[0], S.XUNKONG)
  add(xk[1], S.XUNKONG)

  // ---------- 7.5 小星（源码主调度 ENG:1199）----------
  const fg = D.AX_FG[yGan] || [0, 0]
  add(fg[0], S.TIANGUAN)
  add(fg[1], S.TIANFU2)

  add(wrap12(10 + lMonth - 1), S.TIANXING)
  add(wrap12(2 + lMonth - 1), S.TIANYAO)

  const zyBase = D.AX_ZY[lMonth]
  add(wrap12(zyBase[0] + lDay - 1), S.SANTAI)
  add(wrap12(zyBase[1] - lDay + 1), S.BAZUO)

  add(wrap12(mg + yZhi - 1), S.TIANCAI)
  add(wrap12(sg + yZhi - 1), S.TIANSHOU)

  add(D.AX_TY[lMonth], S.TIANYUE2)
  add(D.AX_TW[lMonth], S.TIANWU)
  add(D.AX_YS[lMonth], S.YINSHA)
  add(D.AX_JS[lMonth], S.JIESHEN)

  // 天空（源码 ENG:1791）：生年支 + 1；cfg_ax_tk == "2"（安天空顺加生时）再 + 生时支 - 1
  const tkOff = cfg.cfg_ax_tk === '2' ? hZhi - 1 : 0
  add(wrap12(yZhi + 1 + tkOff), S.TIANKONG)

  // 天哭 / 天虚（源码 ENG:1771 / 1781，只按生年支，不受 cfg_ax_tk 影响）
  add(wrap12(8 - yZhi), S.TIANKU)
  add(wrap12(6 + yZhi), S.TIANXU)

  const hongLuan = wrap12(5 - yZhi)
  add(hongLuan, S.HONGLUAN)
  add(wrap12(hongLuan + 6), S.TIANXI)

  add(wrap12(cq[0] + lDay - 2), S.ENGUANG)
  add(wrap12(cq[1] + lDay - 2), S.TIANGUI)

  add(D.AX_TC[yGan], S.TIANCHU)

  // 天德 / 月德 / 龙德（源码 ENG:1240-1243，受 cfg_tdydld 控制，源码默认 true）
  if (cfg.cfg_tdydld) {
    const tianDe = wrap12(yZhi + 9)
    add(tianDe, S.TIANDE)
    add(wrap12(tianDe - 4), S.YUEDE)
    add(wrap12(yZhi + 7), S.LONGDE)
  }

  add(wrap12(7 + hZhi - 1), S.TAIFU)
  add(wrap12(3 + hZhi - 1), S.FENGGAO)

  add(D.AX_PS[yZhi], S.POSUI)
  add(D.AX_FL[yZhi], S.FEILIAN)

  // 华盖 / 劫煞 / 咸池（源码 ENG:1228-1239，受 cfg_hgjsxc 控制，源码默认 true）
  if (cfg.cfg_hgjsxc) {
    const huaGai = D.AX_HG[yZhi]
    add(huaGai, S.HUAGAI)
    add(wrap12(huaGai + 1), S.JIESHA)
    add(D.AX_XC[yZhi], S.XIANCHI)
  }

  add(wrap12(yZhi + 4), S.LONGCHI)
  add(wrap12(12 - yZhi), S.FENGGE)

  add(wrap12(wrap12(yZhi + 6) + (yZhi % 2 !== 0 ? 1 : -1)), S.DAHAO)

  // 年解（源码 ENG:1876）：12 - 生年支；不为正时改用 24 - 生年支
  add(wrap12(12 - yZhi > 0 ? 12 - yZhi : 24 - yZhi), S.NIANJIE)

  // 天伤 / 天使（源码 ENG:2191）：以【命宫】为基准 ±5
  // cfg_ax_tsts == "2"（中州派）时，按【生年干】奇偶 + 性别互换
  let tianShang = wrap12(mg + 5)
  let tianShi = wrap12(mg - 5)
  if (cfg.cfg_ax_tsts === '2') {
    if ((yGan % 2 === 0 && sex === 1) || (yGan % 2 === 1 && sex === 2)) {
      const t = tianShang; tianShang = tianShi; tianShi = t
    }
  }
  add(tianShang, S.TIANSHANG)
  add(tianShi, S.TIANSHI)

  // ---------- 7.6 十二星体系（宫属性，非星曜）----------
  // 博士十二星：禄存宫起，阴干男 / 阳干女 逆行，其余顺行（源码 ENG:2154）
  const luCun = D.AX_LC[yGan] || 0
  const boShiNi = (yGan % 2 === 0 && sex === 1) || (yGan % 2 === 1 && sex === 2)
  for (let i = 1; i <= 12; i++) {
    const gi = boShiNi ? wrap12(luCun - i + 1) : wrap12(luCun + i - 1)
    gongs[gi].boShi = D.SET_SSL[i]
  }
  // 岁前十二星：岁建起生年支顺行（源码 ENG:1425）
  for (let i = 1; i <= 12; i++) gongs[i].suiQian = D.LNSQX_CHS[wrap12(13 - yZhi + i)]
  // 将前十二星：_AX_LNJQX_ARR[星序][年支] = 宫（源码 ENG:1442）
  for (let k = 1; k <= 12; k++) {
    const gi = D.AX_LNJQX[k][yZhi]
    if (gi >= 1 && gi <= 12) gongs[gi].jiangQian = D.LNJQX_CHS[k]
  }

  // 擎羊陀罗（按年干）、地空地劫（按时支）
  const yt = YANG_TUO[yGan]
  add(yt[0], S.QINGYANG)
  add(yt[1], S.TUOLUO)
  const kj = KONG_JIE[hZhi0]
  add(kj[0], S.DIKONG)
  add(kj[1], S.DIJIE)

  // ---------- 8. 四化（源码 _AX_SHB_ARR + cfg_4h_*）----------
  const SH = siHuaTable(cfg)
  const shengNian = SH[yGan] || [0, 0, 0, 0, 0]
  for (let k = 1; k <= 4; k++) {
    const starId = shengNian[k]
    if (!starId) continue
    const g = findStarGong(gongs, starId)
    if (g) gongs[g].stars.find((s) => s.id === starId).sihua.push(SIHUA_NAME[k])
  }

  // 各宫宫干四化（用于宫干飞星展示）
  for (let i = 1; i <= 12; i++) {
    const gh = SH[gongs[i].gan] || [0, 0, 0, 0, 0]
    gongs[i].ganSiHua = []
    for (let k = 1; k <= 4; k++) {
      if (!gh[k]) continue
      gongs[i].ganSiHua.push({
        star: D.STARS[gh[k]],
        starId: gh[k],
        type: SIHUA_NAME[k],
        gong: findStarGong(gongs, gh[k]) || 0
      })
    }
  }

  /**
   * 自化（源码 GONG:4010-4072，落星时就地判定）
   *   离心自化 ziHua_LiXin   ：本宫宫干的四化表化到「本宫这颗星」→ 画 ↓
   *   向心自化 ziHua_XiangXin：对宫宫干的四化表化到「本宫这颗星」→ 画 ↑
   * 仅主星 + 辅曜（id ≤ 22）参与，小星走 addSmallStar 不算自化
   */
  for (let i = 1; i <= 12; i++) {
    const g = gongs[i]
    const dui = gongs[((i + 5) % 12) + 1]
    const self = SH[g.gan] || [0, 0, 0, 0, 0]
    const opp = SH[dui.gan] || [0, 0, 0, 0, 0]
    g.ziHua = []
    g.ziHuaXiangXin = []
    for (const s of g.stars) {
      if (s.id > 22) continue
      for (let k = 1; k <= 4; k++) {
        if (self[k] === s.id) {
          s.ziHuaLiXin = SIHUA_NAME[k]
          g.ziHua.push({ star: s.name, starId: s.id, type: SIHUA_NAME[k] })
        }
        if (opp[k] === s.id) {
          s.ziHuaXiangXin = SIHUA_NAME[k]
          g.ziHuaXiangXin.push({ star: s.name, starId: s.id, type: SIHUA_NAME[k] })
        }
      }
    }
  }

  // ---------- 9. 大限（源码 1303）----------
  const yinYang = yGan % 2 === 0 ? 2 : 1
  const shun = (yinYang === 1 && sex === 1) || (yinYang === 2 && sex === 2)
  for (let i = 1; i <= 12; i++) {
    const bm = gongs[i].nameIdx
    const n = shun ? (((1 - bm + 12) % 12) + 1) : bm
    gongs[i].daXianIndex = n
    gongs[i].daXianStart = wuXingJu + 10 * (n - 1)
    gongs[i].daXianEnd = wuXingJu + 10 * n - 1
    gongs[i].daXianName = D.GONG_DX[n]
    gongs[i].daXianNameS = D.GONG_DX_S1[n] || ''
  }

  // ---------- 10. 小限（源码 _AX_XIAOXIAN_ARR，按年支起）----------
  const xxStart = D.AX_XIAOXIAN[yZhi]
  for (let i = 1; i <= 12; i++) {
    const step = sex === 1 ? i - xxStart : xxStart - i
    gongs[i].xiaoXianAge = ((step + 12) % 12) + 1
  }

  // ---------- 11. 十二长生（源码 _AX_SECS_ARR + cfg_ax_12cs2，GCS:1039-1043）----------
  const secsArr = (() => {
    if (wuXingJu === 5 && cfg.cfg_ax_12cs2 === '2') return D.AX_SECS[6]
    return D.AX_SECS[wuXingJu]
  })() || [[], []]
  const secs = (cfg.cfg_ax_12cs1 === '2' ? secsArr[0] : secsArr[shun ? 0 : 1]) || []
  for (let k = 1; k <= 12; k++) {
    const gi = secs[k]
    if (gi >= 1 && gi <= 12) gongs[gi].changSheng = CHANG_SHENG[k] || ''
  }

  // ---------- 12. 命主 / 身主（源码 3926 / 3927）----------
  // cfg_ax_mz：1=按命宫支  2=按生年支
  const mzKey = cfg.cfg_ax_mz === '2' ? yZhi : mg
  const mingZhu = D.STARS[D.MZX_ARR[mzKey]]
  const shenZhu = D.STARS[D.SZX_ARR[yZhi]]

  // ---------- 13. 来因宫（源码 ENG:5038）
  // 判定：宫干 == 生年干，且地支不属子(1)、丑(2)
  const laiYinGongs = []
  for (let i = 1; i <= 12; i++) {
    if (i !== 1 && i !== 2 && gongs[i].gan === yGan) laiYinGongs.push(i)
  }
  for (const i of laiYinGongs) gongs[i].isLaiYin = true

  // ---------- 14. 三方四正（对宫 / 三合方）----------
  for (let i = 1; i <= 12; i++) {
    gongs[i].duiGong = ((i + 5) % 12) + 1
    gongs[i].sanHe = [((i + 3) % 12) + 1, ((i + 7) % 12) + 1]
    gongs[i].sanFangSiZheng = [i, gongs[i].duiGong, gongs[i].sanHe[0], gongs[i].sanHe[1]]
  }

  return {
    cfg,
    solarClock,
    solarTrueSolarTime: st,
    lunar,
    bz,
    bzText: {
      year: D.GAN[yGan - 1] + D.ZHI[yZhi - 1],
      month: D.GAN[mGan - 1] + D.ZHI[mZhi - 1],
      day: D.GAN[dGan - 1] + D.ZHI[dZhi - 1],
      hour: D.GAN[hGan - 1] + D.ZHI[hZhi - 1]
    },
    sex,
    jd,
    mingGong: mg,
    shenGong: sg,
    mingGongName: gongs[mg].name,
    shenGongName: gongs[sg].name,
    wuXingJu,
    wuXingJuName,
    ziweiGong: zw,
    tianfuGong: tf,
    mingZhu,
    shenZhu,
    shunXing: shun,
    laiYinGongs,
    siHuaTable: SH,
    brightness: {
      level: cfg.cfg_miaoxian,
      levelName: { 1: '全书派', 2: '中州派', 3: '现代一', 4: '现代二' }[cfg.cfg_miaoxian] || ''
    },
    shengNianSiHua: [1, 2, 3, 4].map((k) => ({
      star: shengNian[k] ? D.STARS[shengNian[k]] : '',
      starId: shengNian[k] || 0,
      type: SIHUA_NAME[k],
      gong: shengNian[k] ? findStarGong(gongs, shengNian[k]) : 0
    })),
    /**
     * 日干四化 —— 源码星曜字段 h4_RG（STAR:145）
     * 赋值点 ENG:4203-4206 取 四化表[vars.bz[4]]（bz[4] = 日柱天干），
     * 再于 ENG:4228-4267 逐星写入；关闭时恒为 0。
     */
    riGanSiHua: [1, 2, 3, 4].map((k) => {
      const id = cfg.cfg_ax_ri4h && SH[dGan] ? SH[dGan][k] || 0 : 0
      return {
        star: id ? D.STARS[id] : '',
        starId: id,
        type: SIHUA_NAME[k],
        gong: id ? findStarGong(gongs, id) : 0
      }
    }),
    gongs: gongs.slice(1),
    /** 本命十二宫名表（索引 1..12），三合盘重排命宫后取「新宫名」用（源码 ENG:1148） */
    gongNameTable: BM_NAME
  }
}

function addStar(gongs, idx, starId, bright) {
  if (!idx || idx < 1 || idx > 12) return
  if (!gongs[idx]) return
  // 亮度：源码 gcs.A6B47D64B7FE4189AF26A829D926D3AAK[星曜id][宫位]
  const row = bright.t[starId]
  const b = row ? row[idx] || 0 : 0
  gongs[idx].stars.push({
    id: starId,
    name: D.STARS[starId],
    sihua: [],
    brightness: b,
    brightnessName: b ? bright.names[b] || '' : ''
  })
}

function findStarGong(gongs, starId) {
  for (let i = 1; i <= 12; i++) {
    if (gongs[i] && gongs[i].stars.some((s) => s.id === starId)) return i
  }
  return 0
}

/** 供 UI 使用的星曜分类（是否主星） */
export function isZhuStar(id) {
  return id >= 1 && id <= 14
}

/** 星曜分段：主星 1-14 / 辅曜 15-22 / 煞曜 23-28 / 杂曜 29-82 */
export function starGroup(id) {
  if (id >= 1 && id <= 14) return 'zhu'
  if (id >= 15 && id <= 22) return 'fu'
  if (id >= 23 && id <= 28) return 'sha'
  return 'xiao'
}
