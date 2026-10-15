import { paipan } from '../src/ziwei/paipan.js'
import {
  buildXianPan,
  buildDaXianList,
  currentDaXianIndex,
  currentLiuNianIndex,
  yearGanZhi
} from '../src/ziwei/xianpan.js'

const pan = paipan({
  year: 1985, month: 11, day: 22, hour: 8, minute: 30,
  sex: 2, calendar: 'solar'
})

console.log('出生：', pan.solarClock, pan.bzText.year, pan.wuXingJuName,
  pan.shunXing ? '顺行' : '逆行', '命宫', pan.mingGongName)

console.log('\n--- 大限 ---')
for (const d of buildDaXianList(pan)) {
  console.log(`大限${String(d.index).padStart(2)}  ${d.gongName}宫  ${d.label}  ${d.startYear}-${d.endYear}`)
}

const cdx = currentDaXianIndex(pan)
const cln = currentLiuNianIndex(pan, cdx)
console.log('\n当前大限序号', cdx, '　当前流年序号', cln)

const x = buildXianPan(pan, 'liunian', cdx, cln, 10)
console.log('流年：', x.ln.year, x.ln.gz, x.ln.age + '岁',
  '　太岁宫(流年' + pan.gongs[x.lnMingGong - 1].zhiName + '宫)',
  '　斗君', pan.gongs[x.douJun - 1].zhiName + '宫',
  '　正月宫', pan.gongs[x.zhengYueGong - 1].zhiName + '宫')

console.log('\n--- 各宫（宫 / 大限 / 流年 / 岁前 / 将前 / 流月）---')
for (const g of x.gongs) {
  console.log(
    `${g.zhiName}宫  大限${String(g.dxNo).padStart(2)} ${g.dxName}` +
    `  流年${String(g.lnNo).padStart(2)} ${g.lnName}` +
    `  岁前:${(g.suiQian || '—').padEnd(2)}  将前:${(g.jiangQian || '—').padEnd(2)}` +
    (g.lyNo ? `  ${String(g.lyNo).padStart(2)}月 ${g.lyGanZhi}` : '')
  )
}

console.log('\n流年四化：', x.lnSiHua.map((s) => `${s.star}化${s.type}→${s.gong}宫`).join(' '))
console.log('大限四化：', x.dxSiHua.map((s) => `${s.star}化${s.type}→${s.gong}宫`).join(' '))

// 校验：公元年干支（2026 应为丙午，1984 应为甲子）
console.log('\n干支校验：2026 =', yearGanZhi(2026), ' 1984 =', yearGanZhi(1984), ' 2044 =', yearGanZhi(2044))
