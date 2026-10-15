/**
 * 立太极（宫位转换 / 宫位借调 / 换太极）
 *
 * ============================ 源码出处 ============================
 * 文件：scripts/WenMoTianJiK3559F050B9884FCF8109116869D3081EK/
 *       WenMoTianJiK42EAF1116E184B6A97E97E5BEDF8723BK.as
 *
 * 渲染函数（第 384-444 行）：
 *   protected function WenMoTianJiK0200268D51BD4B9E8AEC7B3E00212D13K(param1:int) : void
 *
 * ------------------------------------------------------------------
 * ① 开关（387-391 行）
 *   if (!vars.cfg_taijidian) { 文本.visible = false; return; }
 *   对应本工程 config.js 的 cfg_taijidian（默认 true，分组「显示开关」）
 *
 * ② 本宫编号（392-415 行）
 *   _loc3_ = name_BM                       // 本命盘
 *   if (vars.panType == 4)                 // 限流盘：按限级改取
 *       限级1 大限 → name_DX      限级2 流年 → name_LN
 *       限级3 流月 → name_LY      限级4 流日 → name_LR
 *       限级5 流时 → name_LS
 *
 * ③ 点击派发（282-336 行，与 392-415 同一套取值逻辑）
 *   dispatchEvent(..., [天干, 地支, _loc3_])   ← 第三个就是「太极点编号」
 *
 * ④ 广播接收（249-273 行）
 *   盘面上【每一个】宫都监听该事件，收到后各自刷新自己那行文本
 *
 * ⑤ 换算（416-426 行）
 *   _loc3_ = 本宫编号，param1 = 太极点编号
 *   if (_loc3_ == param1)  文本 = ""        // 太极点自身，源码置空
 *   else {
 *     _loc2_ = _loc3_ > param1 ? _loc3_ - param1 + 1 : _loc3_ - param1 + 13;
 *     文本 = 宫名[param1] + "之" + 宫名[_loc2_];
 *   }
 *
 * ⑥ 位置（429-441 行）：画在宫格底部（y = gongHeight - 文本高度）
 *
 * ============================ 换算公式 ============================
 *   记 T = 太极点宫的十二宫编号（1=命宫 … 12=父母宫）
 *       C = 本宫的十二宫编号
 *   则
 *        newIdx = ((C - T + 12) % 12) + 1
 *        文本   = 宫名[T] + "之" + 宫名[newIdx]
 *   特例：C == T 时源码置空（本工程照常算出 1，即「新的命宫」，另行标注）
 *
 *   （源码 422 行的三元分支 _loc3_ - param1 + 1 / + 13，
 *     就是上面取模式在 C>T、C<T 两种情形下的展开。）
 *
 * ============================ 常量表 ============================
 *   宫名短表 _G_BM_S_CHS（gcs:114）= ["","命","兄","夫","子","财","疾","迁","友","官","田","福","父"]
 *   宫名中表 _G_BM_M_CHS（gcs:74） = ["","命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","交友","官禄","田宅","福德","父母"]
 *   注：源码 423 行两处宫名都取「短表」。
 */

import * as D from './data.js'

/** 十二宫编号 1..12 的短名 —— 源码 _G_BM_S_CHS（gcs:114） */
export const GONG_S = D.GONG_BM_S

/** 十二宫编号 1..12 的中名 —— 源码 _G_BM_M_CHS（gcs:74） */
export const GONG_M = D.GONG_BM_M

/**
 * 本宫的「十二宫编号」—— 源码 392-415 行
 *
 * 本命盘取 name_BM（本工程 gong.nameIdx）；
 * 限流盘（源码 panType==4）按限级取 name_DX / name_LN / name_LY / name_LR / name_LS。
 *
 * @param {object} gong 本命盘宫位（含 nameIdx）
 * @param {object} xg   限盘宫位（xian.gongs[i-1]，含 dxNo/lnNo/lyPanNo/lrPanNo/lsPanNo/xxNo）
 * @param {string} view benming / daxian / liunian / liuyue / liuri / liushi / xiaoxian
 * @returns {number} 1..12；0 表示取不到
 */
export function taijiIndexOf(gong, xg, view) {
  if (!gong) return 0
  if (view === 'benming' || !xg) return gong.nameIdx || 0
  switch (view) {
    case 'daxian': return xg.dxNo || 0
    case 'liunian': return xg.lnNo || 0
    case 'liuyue': return xg.lyPanNo || 0
    case 'liuri': return xg.lrPanNo || 0
    case 'liushi': return xg.lsPanNo || 0
    // 源码只枚举了限级 1-5（大限/流年/流月/流日/流时），无小限；
    // 此处按小限盘实际显示的宫名 xxName 取 xxNo，避免「宫名用小限、换算用本命」的错位
    case 'xiaoxian': return xg.xxNo || gong.nameIdx || 0
    default: return gong.nameIdx || 0
  }
}

/**
 * 以太极点 T 立太极后，原第 C 宫换算成的新宫名编号
 *
 * @param {number} t 太极点宫的十二宫编号（1=命宫 … 12=父母宫）
 * @param {number} c 被换算宫的十二宫编号
 * @returns {number} 新宫名编号 1..12；0 = 该宫即太极点自身（源码 416-419 置空）
 */
export function taijiNewIndex(t, c) {
  if (!t || !c) return 0
  if (t === c) return 0
  return ((c - t + 12) % 12) + 1
}

/**
 * 宫位上显示的「X之Y」—— 源码 422-423 行
 *
 * @param {number} t 太极点宫的十二宫编号
 * @param {number} c 本宫的十二宫编号
 * @returns {string} 如「夫之福」；太极点自身返回空串（与源码一致）
 */
export function taijiText(t, c) {
  const x = taijiNewIndex(t, c)
  if (!x) return ''
  return GONG_S[t] + '之' + GONG_S[x]
}

/**
 * 同上，但太极点自身不置空，而是返回「X之命」
 * （语义：以该宫立太极，它自己就是新的命宫。源码此处留空，页面另行标注。）
 */
export function taijiTextFull(t, c) {
  const x = taijiNewIndex(t, c)
  return GONG_S[t] + '之' + GONG_S[x || 1]
}
