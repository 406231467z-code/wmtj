/** 排盘引擎冒烟测试（不依赖 Vue，直接跑算法） */
import { paipan } from '../src/ziwei/paipan.js'
import { solar2lunar, getTerm, hourToZhiIndex } from '../src/ziwei/lunar.js'

function brief(p, title) {
  console.log('===== ' + title + ' =====')
  console.log('农历:', p.lunar.IMonthCn + p.lunar.IDayCn, p.lunar.gzYear, p.lunar.Animal, p.lunar.astro)
  console.log('四柱:', p.bzText.year, p.bzText.month, p.bzText.day, p.bzText.hour)
  console.log('命宫:', p.mingGong, p.gongs[p.mingGong - 1].zhiName + '宫', '| 身宫:', p.shenGong, p.gongs[p.shenGong - 1].zhiName + '宫')
  console.log('五行局:', p.wuXingJuName, '| 紫微在', p.gongs[p.ziweiGong - 1].zhiName + '宫', '| 天府在', p.gongs[p.tianfuGong - 1].zhiName + '宫')
  console.log('命主:', p.mingZhu, '身主:', p.shenZhu, '| 大限', p.shunXing ? '顺行' : '逆行')
  console.log('生年四化:', p.shengNianSiHua.map((s) => s.star + s.type).join(' '))
  for (let i = 1; i <= 12; i++) {
    const g = p.gongs[i - 1]
    console.log(
      ('  ' + g.zhiName + '宫 ' + g.ganName + ' ' + g.nameM).padEnd(18, ' ') +
        '| 大限' + String(g.daXianStart).padStart(2, '0') + '-' + String(g.daXianEnd).padStart(2, '0') +
        ' | ' + (g.changSheng || '') +
        ' | ' + g.stars.map((s) => s.name + (s.sihua.length ? '[' + s.sihua.join('') + ']' : '')).join(' ')
    )
  }
  const cnt = {}
  for (const g of p.gongs) {
    for (const s of g.stars) cnt[s.id] = (cnt[s.id] || 0) + 1
  }
  const bad = []
  for (let i = 1; i <= 14; i++) {
    if ((cnt[i] || 0) !== 1) bad.push(i + '×' + (cnt[i] || 0))
  }
  console.log('十四主星校验:', bad.length ? '异常 ' + bad.join(' ') : 'OK（14 颗各 1 次）')
  console.log('')
}

// 用例 1：1990-06-15 12:00 男
brief(paipan({ year: 1990, month: 6, day: 15, hour: 12, minute: 0, sex: 1 }), '公历 1990-06-15 12:00 男')

// 用例 2：农历 1990 五月廿三 午时 女
brief(
  paipan({ year: 1990, month: 5, day: 23, hour: 12, minute: 30, sex: 2, calendar: 'lunar' }),
  '农历 1990-05-23 12:30 女'
)

// 用例 3：子时头（检验早晚子与时支）
brief(paipan({ year: 2000, month: 1, day: 1, hour: 0, minute: 10, sex: 1 }), '公历 2000-01-01 00:10 男')

// 历法单点校验
console.log('=== 历法校验 ===')
console.log('solar2lunar(2024,2,10):', solar2lunar(2024, 2, 10).IMonthCn + solar2lunar(2024, 2, 10).IDayCn, solar2lunar(2024, 2, 10).gzYear)
console.log('solar2lunar(1900,1,31) 边界:', solar2lunar(1900, 1, 31))
console.log('2024 立春（第3节气）:', getTerm(2024, 3), '日')
console.log('hourToZhiIndex(23):', hourToZhiIndex(23), ' hourToZhiIndex(0):', hourToZhiIndex(0), ' hourToZhiIndex(12):', hourToZhiIndex(12))
