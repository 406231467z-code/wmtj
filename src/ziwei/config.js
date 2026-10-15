/**
 * 安星 / 显示配置（源码 VARS:461-833 的 `cfg_*` 持久化开关）
 *
 * 每个键给出：默认值、取值域、作用。
 * 键名与源码 `WenMoTianJiK3B32B976C1F0453384B6617F732A9ED5K`（本地存储读写）中的键一一对应，
 * 默认值取 VARS 里 backing 字段的初值（VARS:173-335）。
 *
 * 分类：
 *   an    —— 影响安星/排盘结果（改了要重排盘）
 *   h4    —— 影响四化表（改了要重算四化）
 *   view  —— 只影响宫位/盘面显示（不用重排盘）
 */

/** [键名, 默认值, 类型, 取值域, 说明] */
const SPEC = [
  // ===== 安星类（改了必须重排盘）=====
  ['cfg_miaoxian', '1', 'enum', ['1', '2', '3', '4'],
    '星曜亮度流派：1=全书派(7级) 2=中州派(5级) 3=现代一(7级) 4=现代二(5级)'],
  ['cfg_ax_jkxk', '2', 'enum', ['1', '2', '3'],
    '旬空 / 截空流派：1=_AX_JK_ARR1  2=_AX_JK_ARR2  3=_AX_JK_ARR3'],
  ['cfg_ax_kuiyue', '1', 'enum', ['1', '2', '3', '4'],
    '天魁天钺流派：1..4 对应 _AX_KY_ARR1..4'],
  ['cfg_ax_mz', '1', 'enum', ['1', '2'],
    '命主起法：1=按命宫支  2=按生年支'],
  ['cfg_ax_tsts', '1', 'enum', ['1', '2'],
    '天使天伤（ENG:2191）：2=中州派，按【生年干】奇偶+性别互换命宫±5'],
  ['cfg_ax_tk', '1', 'enum', ['1', '2'],
    '安天空（ENG:1794）：2=顺加生时（天空再加生时支-1）'],
  ['cfg_ax_12cs1', '1', 'enum', ['1', '2'], '十二长生（一）'],
  ['cfg_ax_12cs2', '1', 'enum', ['1', '2'], '十二长生（二）：2 时土五局改用 _AX_SECS_ARR[6]'],
  ['cfg_ax_ln4h', '1', 'enum', ['1', '2'],
    '流年四化取干（ENG:761）：1=流年天干  2=【流年命宫】的宫干'],
  ['cfg_ax_ri4h', false, 'bool', null,
    '日干四化（星曜字段 h4_RG，源码 ENG:4203 取四化表[日干]）'],
  ['cfg_tianma', '1', 'enum', ['1', '2'], '本命天马起法'],
  ['cfg_runyue', '3', 'enum', ['2', '3'], '闰月处理（3 时另判年龄 ≥16）'],
  ['cfg_zaozishi', '2', 'enum', ['1', '2'], '早子时(00:00-01:00)归属'],
  ['cfg_wanzishi_bz', '1', 'enum', ['1', '2'], '晚子时(23:00-24:00)八字算法'],

  // ===== 四化变体（GCS:965-1032 装配 _AX_SHB_ARR）=====
  ['cfg_4h_jia', '1', 'enum', ['1', '2'], '甲干四化：1=廉贞禄/破军权/武曲科/太阳忌  2=科改文曲'],
  ['cfg_4h_wu', '1', 'enum', ['1', '2'], '戊干四化：1=贪狼禄/太阴权/右弼科/天机忌  2=科改天机'],
  ['cfg_4h_geng', '1', 'enum', ['1', '2', '3', '4', '5'],
    '庚干四化：1=太阳禄/武曲权/太阴科/天同忌  2=权科互换  3=权化天同  4=权化天同+忌化天机  5=权科互换+忌化天机'],
  ['cfg_4h_xin', '1', 'enum', ['1', '2'], '辛干四化：1=巨门禄/太阳权/文曲科/文昌忌  2=科改文昌'],
  ['cfg_4h_ren', '1', 'enum', ['1', '2', '3'],
    '壬干四化：1=天同禄/天梁权/左辅科/武曲忌  2=科改天府  3=科改文昌'],
  ['cfg_4h_gui', '1', 'enum', ['1', '2'], '癸干四化：1=破军禄/巨门权/太阴科/贪狼忌  2=科改贪狼'],

  // ===== 导出给 AI 的文本（本地扩展键，非源码 cfg_*）=====
  ['cfg_aitext', '2', 'enum', ['1', '2'],
    'AI 文本详略：1=完整(12×12 全打印，每组自包含)  2=精简(省略组内重复的宫位内容，改从总览按宫序对照，省约 72%)'],

  // ===== 盘面样式 =====
  ['cfg_skin_type', 2, 'int', [1, 2, 3], '盘面样式：1=飞星盘 2=三合盘 3=四化盘'],
  ['cfg_lang', 'zh-CN', 'enum', ['zh-CN', 'zh-CHT', 'ko-KOR'], '语言'],

  // ===== 显示开关（view，改了不用重排盘）=====
  ['cfg_shensha', true, 'bool', null, '神煞'],
  ['cfg_msihua', true, 'bool', null, '自化'],
  ['cfg_laiyin', true, 'bool', null, '来因宫'],
  ['cfg_3f4z', true, 'bool', null, '三方四正（三合盘）'],
  ['cfg_fxp_3f4z', true, 'bool', null, '三方四正（飞星盘）'],
  ['cfg_sj12s', true, 'bool', null, '岁前十二星'],
  ['cfg_jq12s', true, 'bool', null, '将前十二星'],
  ['cfg_taijidian', true, 'bool', null, '太极点'],
  ['cfg_hgjsxc', true, 'bool', null, '（源码 cfg_hgjsxc）'],
  ['cfg_tdydld', true, 'bool', null, '（源码 cfg_tdydld）'],
  ['cfg_b12', false, 'bool', null, '（源码 cfg_b12）'],
  ['cfg_3hzihua', true, 'bool', null, '三合自化'],
  ['cfg_3hp_showln', true, 'bool', null, '三合盘显示流年'],
  ['cfg_3hp_showxx', true, 'bool', null, '三合盘显示小限'],
  ['cfg_3hp_lnage', true, 'bool', null, '三合盘流年年龄'],
  ['cfg_3hp_xxage', true, 'bool', null, '三合盘小限年龄'],
  ['cfg_3hp_showfjqbz', true, 'bool', null, '三合盘显示分居 / 起运'],
  ['cfg_3hp_zh_bold', false, 'bool', null, '三合盘字体加粗'],
  ['cfg_6shacolor_3h', true, 'bool', null, '三合盘六煞配色'],
  ['cfg_zhufustarbold_3h', false, 'bool', null, '三合盘主星加粗'],
  ['cfg_fxp_sms', false, 'bool', null, '飞星盘-小星'],
  ['cfg_fxp_sg', false, 'bool', null, '飞星盘-四化干'],
  ['cfg_fxp_dxpf_lp', false, 'bool', null, '飞星盘-大限盘分'],
  ['cfg_bz_fxp', false, 'bool', null, '八字-飞星'],
  ['cfg_dpbtn_fxp', false, 'bool', null, '飞星盘-按钮'],
  ['cfg_dpbtn_4hua', false, 'bool', null, '四化盘-按钮'],
  ['cfg_shensha_4hua', true, 'bool', null, '神煞四化'],
  ['cfg_rg4h_4hua', false, 'bool', null, '壬干四化'],
  ['cfg_38eg_4hua', false, 'bool', null, '三十八乙/干四化'],
  ['cfg_liunian_4hua', true, 'bool', null, '流年四化'],
  ['cfg_bz_4hua', false, 'bool', null, '八字四化'],
  ['cfg_fx_zh_style', '2', 'enum', ['1', '2'], '飞星盘字体样式'],
  ['cfg_3h_zh_style', '2', 'enum', ['1', '2'], '三合盘字体样式'],
  ['cfg_theme_4hua', '1', 'enum', ['1', '2'], '四化主题'],
  ['cfg_xlpanel', '2', 'enum', ['1', '2'], '小限面板模式'],
  ['cfg_xlpanel_ppl', '2', 'enum', ['1', '2'], '小限面板每页行数'],
  ['cfg_other_hapticfeedback', true, 'bool', null, '触感反馈'],
  ['cfg_other_localAuth', true, 'bool', null, '本地认证'],
  ['cfg_other_highComp', false, 'bool', null, '高对比度'],
  ['cfg_other_audio', false, 'bool', null, '音效'],
  ['cfg_other_animate', false, 'bool', null, '动画'],
  ['cfg_other_dlfw', true, 'bool', null, '地理方位（ENG:3412/3448 用到）'],

  // ===== 运流曜（源码 ENG:972-1064）=====
  ['cfg_yunliuyao', true, 'bool', null, '运曜总开关（大限曜）'],
  ['cfg_yly_cq', true, 'bool', null, '运流曜-昌曲'],
  ['cfg_liutianma', true, 'bool', null, '流天马'],
  ['cfg_liuluanxi', true, 'bool', null, '流鸾喜'],
  ['cfg_liuhuoling', false, 'bool', null, '流火铃'],
  ['cfg_yly_simp', false, 'bool', null, '运流曜-简略模式']
]

/** 默认配置对象 */
export const DEFAULT_CFG = Object.freeze(
  SPEC.reduce((o, [k, v]) => {
    o[k] = v
    return o
  }, {})
)

/** 键元信息：key -> { def, type, options, label } */
export const CFG_META = Object.freeze(
  SPEC.reduce((o, [k, def, type, options, label]) => {
    o[k] = { def, type, options, label }
    return o
  }, {})
)

/** 分类：用于设置面板分组 */
export const CFG_GROUPS = [
  {
    title: '安星流派',
    keys: [
      'cfg_miaoxian', 'cfg_ax_jkxk', 'cfg_ax_kuiyue', 'cfg_ax_mz',
      'cfg_ax_tsts', 'cfg_ax_tk', 'cfg_ax_12cs1', 'cfg_ax_12cs2',
      'cfg_ax_ln4h', 'cfg_ax_ri4h',
      'cfg_tianma', 'cfg_runyue', 'cfg_zaozishi', 'cfg_wanzishi_bz'
    ]
  },
  {
    title: '四化变体',
    keys: ['cfg_4h_jia', 'cfg_4h_wu', 'cfg_4h_geng', 'cfg_4h_xin', 'cfg_4h_ren', 'cfg_4h_gui']
  },
  {
    title: '盘面样式',
    keys: ['cfg_skin_type']
  },
  {
    title: 'AI 文本（复制 / 下载 TXT）',
    keys: ['cfg_aitext']
  },
  {
    title: '运流曜',
    keys: [
      'cfg_yunliuyao', 'cfg_yly_cq', 'cfg_liutianma',
      'cfg_liuluanxi', 'cfg_liuhuoling', 'cfg_yly_simp'
    ]
  },
  {
    title: '显示开关',
    keys: [
      'cfg_shensha', 'cfg_msihua', 'cfg_laiyin', 'cfg_3f4z', 'cfg_fxp_3f4z',
      'cfg_sj12s', 'cfg_jq12s', 'cfg_taijidian', 'cfg_hgjsxc', 'cfg_tdydld',
      'cfg_b12', 'cfg_3hzihua', 'cfg_3hp_showln', 'cfg_3hp_showxx',
      'cfg_3hp_lnage', 'cfg_3hp_xxage', 'cfg_3hp_showfjqbz',
      'cfg_shensha_4hua', 'cfg_liunian_4hua', 'cfg_rg4h_4hua',
      'cfg_38eg_4hua', 'cfg_bz_4hua', 'cfg_fxp_sms', 'cfg_fxp_sg',
      'cfg_fxp_dxpf_lp', 'cfg_bz_fxp', 'cfg_dpbtn_fxp', 'cfg_dpbtn_4hua'
    ]
  },
  {
    title: '小限面板',
    keys: ['cfg_xlpanel', 'cfg_xlpanel_ppl']
  }
]

/** 取一个合并了默认值的配置对象 */
export function makeCfg(partial) {
  return { ...DEFAULT_CFG, ...(partial || {}) }
}

/** 改了会影响排盘结果（需要重新 paipan）的键 */
export const CFG_AFFECT_PAN = Object.freeze(
  SPEC.filter(([k]) => k.startsWith('cfg_ax_') || k.startsWith('cfg_4h_') ||
    ['cfg_miaoxian', 'cfg_tianma', 'cfg_runyue', 'cfg_zaozishi', 'cfg_wanzishi_bz',
      // 这两个决定整组神煞「安不安」，改了必须重排
      'cfg_hgjsxc', 'cfg_tdydld'].includes(k))
    .map(([k]) => k)
)

const LS_KEY = 'wm_tianji_cfg'

/** 从 localStorage 读（浏览器环境）；失败则回默认 */
export function loadCfg() {
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY)
    if (!raw) return makeCfg()
    return makeCfg(JSON.parse(raw))
  } catch {
    return makeCfg()
  }
}

export function saveCfg(cfg) {
  try {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(cfg))
  } catch {
    /* 忽略：无痕模式 / SSR */
  }
}
