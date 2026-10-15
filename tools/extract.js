/**
 * 从反编译出的 ActionScript3 源码中逐字符抽取常量表，生成 src/ziwei/data.js
 * 目的：保证移植后的数据与「文墨天机」原版 SWF 完全一致（不手工抄录，避免出错）。
 *
 * 用法： node tools/extract.js
 */
import fs from 'node:fs'
import path from 'node:path'

const TEMP = process.env.TEMP || 'C:\\Users\\Jiliason\\AppData\\Local\\Temp'
const ROOT = path.join(TEMP, 'wm_script', 'script', 'scripts')

const FILE_LUNAR = path.join(
  ROOT,
  'WenMoTianJiK90F37E64A79445A5A47921CCA0A3D934K',
  'WenMoTianJiK504497B3265949B6AD61C1F1F9FDD603K.as'
)
const FILE_GCS = path.join(
  ROOT,
  'WenMoTianJiKBFF16CDEABBD49E68E432BF743F0F255K',
  'WenMoTianJiK26D2B9FDB77F4EC2AB30B26025D57FDFK.as'
)

function read(p) {
  return fs.readFileSync(p, 'utf8')
}

/** 从 `name:Array = [` 起做括号配对，返回完整数组字面量 */
function grabArray(src, name) {
  // 兼容两种写法： `private static const X:Array = [...]` 与 实例变量 `X = [...]`
  const re = new RegExp('(?:^|[\\s;])' + name + '\\s*(?::\\s*Array\\s*)?=\\s*(?=\\[)')
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length - (m[0].startsWith('[') ? 0 : 0)
  // 定位到 '['
  i = src.indexOf('[', m.index + m[0].length - 1)
  if (i < 0) return null
  let depth = 0
  let j = i
  let inStr = false
  let strCh = ''
  for (; j < src.length; j++) {
    const c = src[j]
    if (inStr) {
      if (c === '\\') { j++; continue }
      if (c === strCh) inStr = false
      continue
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) { j++; break }
    }
  }
  return src.slice(i, j)
}

/** 抽取字符串常量 name:String = "..." */
function grabString(src, name) {
  const re = new RegExp(name + '\\s*(?::\\s*String\\s*)?=\\s*"')
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  let out = ''
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') { out += c + src[i + 1]; i += 2; continue }
    if (c === '"') break
    out += c
    i++
  }
  return '"' + out + '"'
}

// ---- 需要抽取的常量： 导出名 -> AS3 中的常量名 ----
const LUNAR_MAP = {
  LUNAR_INFO: 'WenMoTianJiKB7B4746256DB4925B776F341192BDA9BK',      // 1900-2100 农历年数据
  SOLAR_TERM_INFO: 'WenMoTianJiKDA88BBC70B104457977083DBB7439C78K',  // 二十四节气数据
  SOLAR_MONTH_DAYS: 'WenMoTianJiK2D9F819A4C83448C91DF2AF73D58C160K',
  GAN: 'WenMoTianJiKD96B14C346FA4A1EAFF0E6CB78D4B42CK',
  ZHI: 'WenMoTianJiK767384BAB5754E8D8F840C81643CBDA4K',
  ANIMALS: 'WenMoTianJiKE2B287FEFD1E407685CBA37B45D7FBF6K',
  TERM_NAMES: 'WenMoTianJiK3531074D08324CD7AEFA456AECB4BCEBK',
  CN_DAY_NUM: 'WenMoTianJiK73E46402F70E49EBAE760334FAA6B534K',
  CN_DAY_PREFIX: 'WenMoTianJiKDF360149A61946A785B42C7B7BA7DDB4K',
  CN_MONTH: 'WenMoTianJiK76104D9209614C8E841A03CD1751F0D6K',
  CN_GENG: 'WenMoTianJiK1CF52D851B08413A8949FD5F7F2BFA97K'
}

const GCS_ARRAY_MAP = {
  STARS: 'stars_noWrap_CHS',
  TG_CHS: '_TG_CHS',
  DZ_CHS: '_DZ_CHS',
  WX_CHS: '_WX_CHS',
  WXJS_CHS: '_WXJS_CHS',
  GONG_BM: '_G_BM_CHS',
  GONG_BM_M: '_G_BM_M_CHS',
  GONG_BM_S: '_G_BM_S_CHS',
  GONG_DX: '_G_DX_CHS',
  GONG_DX_S1: '_G_DX_S1_CHS',
  GONG_LN: '_G_LN_CHS',
  GONG_LY: '_G_LY_CHS',
  GONG_LR: '_G_LR_CHS',
  GONG_LS: '_G_LS_CHS',
  // —— 各盘宫名的第二/第三套写法（飞星盘 / 四化盘 / 简写 / 小限）——
  GONG_BM_FX: '_G_BM_FX_CHS',
  GONG_BM_4H: '_G_BM_4H_CHS',
  GONG_DX_S2: '_G_DX_S2_CHS',
  GONG_LN_S: '_G_LN_S_CHS',
  GONG_LY_S: '_G_LY_S_CHS',
  GONG_LR_S: '_G_LR_S_CHS',
  GONG_LS_S: '_G_LS_S_CHS',
  GONG_XX: '_G_XX_CHS',
  GONG_XX_S1: '_G_XX_S1_CHS',
  GONG_XX_S2: '_G_XX_S2_CHS',
  XLP: '_XLP_CHS',
  XLP_S: '_XLP_S_CHS',
  SECS_CHS: '_SECS_CHS',      // 十二长生（原文带 \n，UI 侧需 strip）
  SH_CHS: '_SH_CHS',          // 四化名 禄权科忌
  NLM_S_CHS: '_NLM_S_CHS',
  NLM_CHS: '_NLM_CHS',
  NLD_CHS: '_NLD_CHS',
  BZ_CHS: '_BZ_CHS',
  CMN_TXT: '_CmnTxt_CHS',
  // —— 三组"十二星"（宫属性，非星曜）——
  SET_SSL: '_SETSSL_CHS',     // 博士十二星
  LNSQX_CHS: '_LNSQX_CHS',    // 岁前十二星
  LNJQX_CHS: '_LNJQX_CHS',    // 将前十二星
  // —— 运流曜名称表（1=昌 2=曲 3=魁 4=钺 5=羊 6=陀 7=禄 8=鸾 9=喜 10=马 11=火 12=铃）——
  YY_CHS: '_YY_CHS',          // 运曜（大限）
  LY_CHS: '_LY_CHS',          // 流年曜
  YUEY_CHS: '_YueY_CHS',      // 流月曜
  RY_CHS: '_RY_CHS',          // 流日曜
  SY_CHS: '_SY_CHS',          // 流时曜
  XXY_CHS: '_XXY_CHS',        // 小限曜
  // —— 星曜亮度（庙旺利陷）四套流派 ——
  AX_SB_QS: '_AX_SB_QS',      // cfg_miaoxian=="1"（默认）→ 7 级
  AX_SB_XD1: '_AX_SB_XD1',    // cfg_miaoxian=="3" → 7 级
  AX_SB_ZZ: '_AX_SB_ZZ',      // cfg_miaoxian=="2" → 5 级
  AX_SB_XD2: '_AX_SB_XD2',    // cfg_miaoxian=="4" → 5 级
  STAR_BN_QS: '_StarBN_QS_CHS', // 配 QS / XD1：庙旺得利平不陷
  STAR_BN_ZZ: '_StarBN_ZZ_CHS', // 配 ZZ / XD2：庙旺平闲陷
  SHENG_WANG: '_shengWang',
  WHD: '_WHD',
  MZX_ARR: '_MZX_ARR',
  SZX_ARR: '_SZX_ARR',
  JIA_ZI_TEXT: '_jiaZiTextArr_CHS',
  // 安星表
  AX_WXJS: '_AX_WXJS_ARR',
  AX_SIHUA: '_AX_SHB_ARR',
  AX_SIHUA_JLPWY: '_AX_SHB_ARR_JLPWY',
  AX_SIHUA_JLPQY: '_AX_SHB_ARR_JLPQY',
  AX_SIHUA_WTYYOUJ: '_AX_SHB_ARR_WTYYOUJ',
  AX_SIHUA_WTYYANGJ: '_AX_SHB_ARR_WTYYANGJ',
  AX_SIHUA_GYWYT: '_AX_SHB_ARR_GYWYT',
  AX_SIHUA_GYWTY: '_AX_SHB_ARR_GYWTY',
  AX_SIHUA_GYWFT: '_AX_SHB_ARR_GYWFT',
  AX_SIHUA_GYWFX: '_AX_SHB_ARR_GYWFX',
  AX_SIHUA_GYWTX: '_AX_SHB_ARR_GYWTX',
  AX_SIHUA_XJYQC: '_AX_SHB_ARR_XJYQC',
  AX_SIHUA_XJYWC: '_AX_SHB_ARR_XJYWC',
  AX_SIHUA_RLZFW: '_AX_SHB_ARR_RLZFW',
  AX_SIHUA_RLZFW2: '_AX_SHB_ARR_RLZFW2',
  AX_SIHUA_RLZXW: '_AX_SHB_ARR_RLZXW',
  AX_SIHUA_GPJYT1: '_AX_SHB_ARR_GPJYT1',
  AX_SIHUA_GPJYT2: '_AX_SHB_ARR_GPJYT2',
  AX_CQ: '_AX_CQ_ARR',      // 文昌文曲（按时支）
  AX_ZY: '_AX_ZY_ARR',      // 左辅右弼（按生月）
  AX_KY1: '_AX_KY_ARR1',    // 天魁天钺（按年干）
  AX_KY2: '_AX_KY_ARR2',
  AX_KY3: '_AX_KY_ARR3',
  AX_KY4: '_AX_KY_ARR4',
  AX_HL: '_AX_HL_ARR',      // 火星铃星（按年支）
  AX_GG: '_AX_GG_ARR',      // 孤辰寡宿（按年支）
  AX_FG: '_AX_FG_ARR',
  AX_JK1: '_AX_JK_ARR1',    // 截空
  AX_JK2: '_AX_JK_ARR2',    // 旬空
  AX_JK3: '_AX_JK_ARR3',
  AX_YS: '_AX_YS_ARR',
  AX_TY: '_AX_TY_ARR',
  AX_TW: '_AX_TW_ARR',
  AX_JS: '_AX_JS_ARR',
  AX_FL: '_AX_FL_ARR',
  AX_PS: '_AX_PS_ARR',
  AX_HG: '_AX_HG_ARR',
  AX_XC: '_AX_XC_ARR',
  AX_TC: '_AX_TC_ARR',
  AX_LC: '_AX_LC_ARR',      // 禄存（按年干）
  AX_TM: '_AX_TM_ARR',      // 天马（按年支）
  AX_LIU_CHANG: '_AX_LIUCHANG_ARR',
  AX_LIU_QU: '_AX_LIUQU_ARR',
  AX_XIAOXIAN: '_AX_XIAOXIAN_ARR',
  AX_LNSQX: '_AX_LNSQX_ARR',
  AX_LNJQX: '_AX_LNJQX_ARR',
  AX_ZNDJ: '_AX_ZNDJ_ARR',
  AX_SECS: '_AX_SECS_ARR',
  TXMG: '_TXMG'
}

function build(src, map, kind) {
  const out = []
  const missing = []
  for (const [jsName, asName] of Object.entries(map)) {
    const val = kind === 'array' ? grabArray(src, asName) : grabString(src, asName)
    if (!val) { missing.push(asName); continue }
    out.push(`/** ${asName} */\nexport const ${jsName} = ${val}\n`)
  }
  return { out, missing }
}

const lunarSrc = read(FILE_LUNAR)
const gcsSrc = read(FILE_GCS)

const r1 = build(lunarSrc, LUNAR_MAP, 'array')
const r2 = build(gcsSrc, GCS_ARRAY_MAP, 'array')
const astro = grabString(lunarSrc, 'WenMoTianJiKFEAE9F5B22D24D8EBA2843DD40704330K')

const header = `/**
 * 本文件由 tools/extract.js 从「文墨天机」Flash(ActionScript3) 源码自动抽取生成。
 * 数据与原始 SWF 逐字符一致，请勿手工修改；如需重生成请运行： node tools/extract.js
 *
 * 来源：
 *  - 历法层 WenMoTianJiK504497B3265949B6AD61C1F1F9FDD603K.as
 *  - 常量中枢 WenMoTianJiK26D2B9FDB77F4EC2AB30B26025D57FDFK.as (gcs)
 */

`

const body = [
  '// ===== 历法层 =====',
  ...r1.out,
  astro ? `/** 星座串 */\nexport const ASTRO = ${astro}\n` : '',
  '// ===== 常量中枢 gcs =====',
  ...r2.out
].join('\n')

const target = path.resolve(process.cwd(), 'src/ziwei/data.js')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, header + body, 'utf8')

console.log('generated:', target)
console.log('lunar missing:', r1.missing.join(', ') || '(none)')
console.log('gcs missing:', r2.missing.join(', ') || '(none)')
