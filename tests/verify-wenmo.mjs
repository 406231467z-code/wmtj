/**
 * 把「文墨天机」导出的命盘文本逐盘比对本地排盘结果。
 * 用法：node tests/verify-wenmo.mjs
 *
 * 期望值来自 App 2.5.29 / API 1.1.5 / 安星码 C51UC 的导出文本。
 * 说明：小星按「集合」比对（顺序是渲染细节，不影响安星）；主星同理。
 */
import { paipan } from '../src/ziwei/paipan.js'

// 纯神煞 id：不属于「小星」分组，比对时剔除
const SHENSHA = new Set([61, 63, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76])

const CASES = [
  {
    name: '盘0 男 1996-09-18 00:00 东经120 火六局（早子时）',
    opt: { year: 1996, month: 9, day: 18, hour: 0, minute: 0, sex: 1, calendar: 'solar', jd: 120 },
    bz: '丙子 丁酉 戊午 壬子', wuxing: '火六局', ming: '酉', shen: '酉',
    gongs: {
      子: { zhu: '破军', fu: '无', x: '天福,天厨,阴煞', s: '岁建/將星/胎' },
      丑: { zhu: '天机', fu: '无', x: '天空', s: '晦气/攀鞍/养' },
      寅: { zhu: '紫微,天府', fu: '天马,火星', x: '恩光,天伤,封诰,解神,孤辰', s: '丧门/岁驿/长生' },
      卯: { zhu: '太阴', fu: '右弼', x: '红鸾', s: '贯索/息神/沐浴' },
      辰: { zhu: '贪狼', fu: '文曲,陀罗', x: '天刑,三台,龙池,天使,截空,华盖', s: '官符/华盖/冠带' },
      巳: { zhu: '巨门', fu: '禄存', x: '天官,截空,破碎,劫煞,月德', s: '小耗/劫煞/临官' },
      午: { zhu: '廉贞,天相', fu: '擎羊', x: '台辅,天哭,天虚', s: '岁破/灾煞/帝旺' },
      未: { zhu: '天梁', fu: '无', x: '天月,大耗,龙德', s: '龙德/天煞/衰' },
      申: { zhu: '七杀', fu: '无', x: '天姚,天贵,旬空,蜚廉', s: '白虎/指背/病' },
      酉: { zhu: '天同', fu: '天钺', x: '天喜,天才,天寿,旬空,咸池,天德', s: '天德/咸池/死' },
      戌: { zhu: '武曲', fu: '文昌,铃星', x: '八座,凤阁,寡宿,年解', s: '吊客/月煞/墓' },
      亥: { zhu: '太阳', fu: '左辅,天魁,地劫,地空', x: '天巫', s: '病符/亡神/绝' }
    }
  },
  {
    name: '盘1 男 1995-06-16 22:30 东经120 木三局',
    opt: { year: 1995, month: 6, day: 16, hour: 22, minute: 30, sex: 1, calendar: 'solar', jd: 120 },
    bz: '乙亥 壬午 戊寅 癸亥', wuxing: '木三局', ming: '未', shen: '巳',
    gongs: {
      子: { zhu: '七杀', fu: '天魁,地空', x: '八座,天伤,解神,天空,咸池', s: '晦气/咸池/养' },
      丑: { zhu: '无', fu: '无', x: '天刑,封诰,蜚廉', s: '丧门/月煞/胎' },
      寅: { zhu: '廉贞', fu: '陀罗', x: '三台,天使,孤辰', s: '贯索/亡神/绝' },
      卯: { zhu: '无', fu: '文曲,禄存', x: '龙池', s: '官符/將星/墓' },
      辰: { zhu: '破军', fu: '擎羊', x: '红鸾,恩光,天寿,天官,大耗,月德', s: '小耗/攀鞍/死' },
      巳: { zhu: '天同', fu: '天马', x: '天姚,台辅,天巫,天虚', s: '岁破/岁驿/病' },
      午: { zhu: '武曲,天府', fu: '右弼', x: '天才,天厨,截空,阴煞,龙德', s: '龙德/息神/衰' },
      未: { zhu: '太阳,太阴', fu: '无', x: '天月,截空,天哭,华盖', s: '白虎/华盖/帝旺' },
      申: { zhu: '贪狼', fu: '左辅,天钺,火星', x: '天贵,天福,旬空,劫煞,天德', s: '天德/劫煞/临官' },
      酉: { zhu: '天机,巨门', fu: '铃星', x: '旬空,破碎', s: '吊客/灾煞/冠带' },
      戌: { zhu: '紫微,天相', fu: '地劫', x: '天喜,寡宿', s: '病符/天煞/沐浴' },
      亥: { zhu: '天梁', fu: '文昌', x: '凤阁,年解', s: '岁建/指背/长生' }
    }
  },
  {
    name: '盘2 女 农历1995-06-15 午时 火六局',
    opt: { year: 1995, month: 6, day: 15, hour: 12, minute: 0, sex: 2, calendar: 'lunar', trueSolarTime: false },
    bz: '乙亥 癸未 甲辰 庚午', wuxing: '火六局', ming: '丑', shen: '丑',
    gongs: {
      子: { zhu: '天机', fu: '天魁', x: '天才,天寿,台辅,解神,天空,咸池', s: '晦气/咸池/胎' },
      丑: { zhu: '紫微,破军', fu: '无', x: '蜚廉', s: '丧门/月煞/养' },
      寅: { zhu: '无', fu: '陀罗', x: '天刑,孤辰', s: '贯索/亡神/长生' },
      卯: { zhu: '天府', fu: '禄存,火星', x: '八座,龙池,天月', s: '官符/將星/沐浴' },
      辰: { zhu: '太阴', fu: '文昌,擎羊,铃星', x: '红鸾,天官,阴煞,大耗,月德', s: '小耗/攀鞍/冠带' },
      巳: { zhu: '廉贞,贪狼', fu: '右弼,地劫,地空,天马', x: '恩光,天虚', s: '岁破/岁驿/临官' },
      午: { zhu: '巨门', fu: '无', x: '天姚,天伤,天厨,截空,龙德', s: '龙德/息神/帝旺' },
      未: { zhu: '天相', fu: '无', x: '截空,天哭,华盖', s: '白虎/华盖/衰' },
      申: { zhu: '天同,天梁', fu: '天钺', x: '天福,天使,封诰,天巫,旬空,劫煞,天德', s: '天德/劫煞/病' },
      酉: { zhu: '武曲,七杀', fu: '左辅', x: '旬空,破碎', s: '吊客/灾煞/死' },
      戌: { zhu: '太阳', fu: '文曲', x: '天喜,寡宿', s: '病符/天煞/墓' },
      亥: { zhu: '无', fu: '无', x: '三台,天贵,凤阁,年解', s: '岁建/指背/绝' }
    }
  },
  {
    name: '盘3 女 1995-06-16 11:30 东经116.383 火六局',
    opt: { year: 1995, month: 6, day: 16, hour: 11, minute: 30, sex: 2, calendar: 'solar', jd: 116.383 },
    bz: '乙亥 壬午 戊寅 戊午', wuxing: '火六局', ming: '子', shen: '子',
    gongs: {
      子: { zhu: '紫微', fu: '天魁', x: '八座,台辅,解神,天空,咸池', s: '晦气/咸池/胎' },
      丑: { zhu: '无', fu: '无', x: '天刑,蜚廉', s: '丧门/月煞/养' },
      寅: { zhu: '破军', fu: '陀罗', x: '三台,孤辰', s: '贯索/亡神/长生' },
      卯: { zhu: '无', fu: '禄存,火星', x: '天贵,龙池', s: '官符/將星/沐浴' },
      辰: { zhu: '廉贞,天府', fu: '文昌,擎羊,铃星', x: '红鸾,天官,大耗,月德', s: '小耗/攀鞍/冠带' },
      巳: { zhu: '太阴', fu: '地劫,地空,天马', x: '天姚,天伤,天巫,天虚', s: '岁破/岁驿/临官' },
      午: { zhu: '贪狼', fu: '右弼', x: '天厨,截空,阴煞,龙德', s: '龙德/息神/帝旺' },
      未: { zhu: '天同,巨门', fu: '无', x: '天使,天月,截空,天哭,华盖', s: '白虎/华盖/衰' },
      申: { zhu: '武曲,天相', fu: '左辅,天钺', x: '天福,封诰,旬空,劫煞,天德', s: '天德/劫煞/病' },
      酉: { zhu: '太阳,天梁', fu: '无', x: '恩光,旬空,破碎', s: '吊客/灾煞/死' },
      戌: { zhu: '七杀', fu: '文曲', x: '天喜,寡宿', s: '病符/天煞/墓' },
      亥: { zhu: '天机', fu: '无', x: '凤阁,天才,天寿,年解', s: '岁建/指背/绝' }
    }
  }
]

const asSet = (s) => (s === '无' ? '' : s).split(',').filter(Boolean).sort().join(',')

function check(c) {
  const p = paipan(c.opt)
  const bad = []
  const bz = [p.bzText.year, p.bzText.month, p.bzText.day, p.bzText.hour].join(' ')
  if (bz !== c.bz) bad.push(`四柱 期望[${c.bz}] 实得[${bz}]`)
  const mg = p.gongs.find((g) => g.isMing)
  const sg = p.gongs.find((g) => g.isShen)
  if (mg.zhiName !== c.ming) bad.push(`命宫 期望[${c.ming}] 实得[${mg.zhiName}]`)
  if (sg.zhiName !== c.shen) bad.push(`身宫 期望[${c.shen}] 实得[${sg.zhiName}]`)
  if (p.wuXingJuName !== c.wuxing) bad.push(`五行局 期望[${c.wuxing}] 实得[${p.wuXingJuName}]`)

  for (const [zhi, e] of Object.entries(c.gongs)) {
    const g = p.gongs.find((x) => x.zhiName === zhi)
    const zhu = g.stars.filter((s) => s.id <= 14).map((s) => s.name).join(',')
    const fu = g.stars.filter((s) => s.id >= 15 && s.id <= 28).map((s) => s.name).join(',')
    const x = g.stars.filter((s) => s.id >= 29 && !SHENSHA.has(s.id)).map((s) => s.name).join(',')
    const shen = `${g.suiQian}/${g.jiangQian}/${g.changSheng}`
    if (asSet(zhu) !== asSet(e.zhu)) bad.push(`${zhi}主星 期望[${e.zhu}] 实得[${zhu}]`)
    if (asSet(fu) !== asSet(e.fu)) bad.push(`${zhi}辅星 期望[${e.fu}] 实得[${fu}]`)
    if (asSet(x) !== asSet(e.x)) bad.push(`${zhi}小星 期望[${e.x}] 实得[${x}]`)
    if (shen !== e.s) bad.push(`${zhi}神煞 期望[${e.s}] 实得[${shen}]`)
  }
  return bad
}

let fail = 0
for (const c of CASES) {
  const bad = check(c)
  console.log(`\n=== ${c.name} ===`)
  if (bad.length === 0) {
    console.log('  ✅ 四柱/命宫/身宫/五行局 + 12宫主星/辅星/小星/神煞 全部一致')
  } else {
    fail += bad.length
    bad.forEach((b) => console.log('  ❌ ' + b))
  }
}
console.log(`\n共 ${fail} 处不一致`)
process.exit(fail ? 1 : 0)
