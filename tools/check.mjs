import { paipan } from '../src/ziwei/paipan.js'

const cases = [
  { year: 1990, month: 6, day: 15, hour: 12, minute: 0, sex: 1 },
  { year: 1988, month: 2, day: 14, hour: 8, minute: 30, sex: 2 },
  { year: 2000, month: 1, day: 1, hour: 0, minute: 10, sex: 1 }
]

for (const c of cases) {
  const p = paipan({ ...c, calendar: 'solar', jd: 120, trueSolarTime: true })
  console.log('='.repeat(50))
  console.log(
    `输入 ${c.year}-${c.month}-${c.day} ${c.hour}:${c.minute} 性别${c.sex === 1 ? '男' : '女'}`
  )
  console.log('农历', p.lunar.lYear, p.lunar.IMonthCn + p.lunar.IDayCn, '时支', p.bz.hour[1])
  console.log('四柱', JSON.stringify(p.bzText))
  console.log('命宫', p.mingGong, p.mingGongName.trim(), '| 身宫', p.shenGong, p.shenGongName.trim())
  console.log('五行局', p.wuXingJuName, '| 紫微宫', p.ziweiGong, '| 天府宫', p.tianfuGong)
  console.log('命主', p.mingZhu, '| 身主', p.shenZhu, '| 大限', p.shunXing ? '顺行' : '逆行')
  for (const g of p.gongs) {
    const zhu = g.stars
      .filter((s) => s.id <= 14)
      .map((s) => s.name + (s.brightnessName ? `[${s.brightnessName}]` : ''))
      .join(' ')
    console.log(
      String(g.idx).padStart(2),
      g.zhiName,
      g.ganName + g.zhiName,
      g.nameM.padEnd(3),
      '大限' + String(g.daXianStart).padStart(2) + '-' + g.daXianEnd,
      zhu
    )
  }
}
