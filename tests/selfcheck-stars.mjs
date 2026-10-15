import { paipan } from '../src/ziwei/paipan.js'
import * as D from '../src/ziwei/data.js'

/** 已知会重复出现的星（正副空 / 双宫） */
const DUP_OK = new Set([77, 78]) // 截空、旬空

const GONG_DX = ['', '命', '兄', '妻', '子', '财', '疾', '迁', '友', '官', '田', '福', '父']

function check(opt, label) {
  const pan = paipan(opt)
  console.log(`\n================ ${label} ================`)
  console.log(
    `四柱 ${pan.bzText.year} ${pan.bzText.month} ${pan.bzText.day} ${pan.bzText.hour}` +
    `　命宫 ${pan.mingGongName.trim()}　身宫 ${pan.shenGongName.trim()}` +
    `　${pan.wuXingJuName}　${pan.shunXing ? '顺行' : '逆行'}`
  )

  const seen = new Map()
  let total = 0
  for (const g of pan.gongs) {
    const names = g.stars.map((s) => `${s.name}(${s.id})`).join(' ')
    total += g.stars.length
    for (const s of g.stars) {
      seen.set(s.id, (seen.get(s.id) || 0) + 1)
    }
    console.log(
      `${g.zhiName}宫 ${GONG_DX[g.nameIdx].padEnd(2)} ${g.ganName}${g.zhiName} ` +
      `[${g.changSheng || '-'}/${g.boShi || '-'}/${g.suiQian || '-'}/${g.jiangQian || '-'}] ${names}`
    )
  }

  console.log(`\n星曜总数：${total}（本命盘，含重复安放的截空/旬空）`)
  const dup = [...seen.entries()].filter(([id, n]) => n > 1 && !DUP_OK.has(id))
  console.log('异常重复星：', dup.length ? dup.map(([id, n]) => `${D.STARS[id]}x${n}`).join(' ') : '无')

  // 小星覆盖率：29..82 中应出现的
  const present = new Set([...seen.keys()])
  const missing = []
  for (let id = 29; id <= 82; id++) {
    if (!D.STARS[id]) continue
    if ([49, 67, 69, 79].includes(id)) continue // 名称表条目 / 无独立安星函数
    if (!present.has(id)) missing.push(`${id}${D.STARS[id]}`)
  }
  console.log('未安放的小星：', missing.length ? missing.join(' ') : '无')
  return pan
}

// 例 1：1985-11-22 辰时 女（乙丑年）
const p1 = check(
  { year: 1985, month: 11, day: 22, hour: 8, minute: 30, sex: 2, calendar: 'solar' },
  '例1 1985-11-22 08:30 女（公历）'
)

// 手工核对若干小星落宫（乙丑：年干 2 乙，年支 2 丑）
const g = (i) => p1.gongs[i - 1]
const find = (id) => {
  for (const x of p1.gongs) if (x.stars.some((s) => s.id === id)) return x.zhiName + '宫'
  return '未安'
}
console.log('\n--- 例1 小星落宫核对（乙丑年，年干乙=2，年支丑=2）---')
console.log('红鸾(51) 应在寅宫(5-2=3→寅)：', find(51))
console.log('天喜(40) 应对冲红鸾=申宫：', find(40))
console.log('天才(34) 命宫起子顺数至丑：', find(34), '（命宫', p1.mingGongName.trim(), '）')
console.log('天寿(43) 身宫起子顺数至丑：', find(43), '（身宫', p1.shenGongName.trim(), '）')
console.log('天哭(39)=8-2=6→巳：', find(39), '　天虚(41)=6+2=8→未：', find(41))
console.log('龙池(60)=丑+4=6→巳：', find(60), '　凤阁(58)=12-2=10→酉：', find(58))
console.log('天德(45)=丑+9=11→戌：', find(45), '　月德(46)=天德-4=7→午：', find(46), '　龙德(81)=丑+7=9→申：', find(81))
console.log('华盖(55) 巳酉丑→丑宫：', find(55), '　劫煞(80)=华盖+1→寅：', find(80))
console.log('咸池(82) 巳酉丑→午宫：', find(82))
console.log('孤辰(48) 巳午未→辰?（按表 AX_GG[丑]=[4,2]→卯、丑）：', find(48), '　寡宿(57)：', find(57))

// 例 2：2000-01-01 子时 男
const p2 = check(
  { year: 2000, month: 1, day: 1, hour: 0, minute: 10, sex: 1, calendar: 'solar' },
  '例2 2000-01-01 00:10 男（公历）'
)

// 例 3：农历输入
const p3 = check(
  { year: 1985, month: 10, day: 11, hour: 8, minute: 0, sex: 2, calendar: 'lunar' },
  '例3 农历1985年十月十一 辰时 女'
)

// 十二星体系完整性
for (const [p, t] of [[p1, '例1'], [p2, '例2']]) {
  const cs = p.gongs.map((x) => x.changSheng).filter(Boolean).length
  const bs = p.gongs.map((x) => x.boShi).filter(Boolean).length
  const sq = p.gongs.map((x) => x.suiQian).filter(Boolean).length
  const jq = p.gongs.map((x) => x.jiangQian).filter(Boolean).length
  console.log(`\n${t} 十二星覆盖：长生 ${cs}/12　博士 ${bs}/12　岁前 ${sq}/12　将前 ${jq}/12`)
}
