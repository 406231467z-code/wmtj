<script setup>
/**
 * 河洛理数 · 盘面
 *
 * 由 horosa-web-app 的 React 组件 components/shusuan/HeLuoMain.js 移植而来。
 * 上游把内容拆成 center / aux 两个 slot（宿主是三栏布局），这里只有单栏，
 * 因此把两处内容纵向铺开，功能一个不少。
 */
import { computed, h, ref } from 'vue'
import {
  buildHeluoModel,
  HELUO_DEFAULTS,
  HELUO_SWITCHES,
  najia,
  jieQiLabel,
  liuNian,
  liuYue,
  liuRi,
  yaoText,
  guaInfo,
  yaoName,
  duiGua,
  wangShuai,
  classifyErShu,
  mingGe,
  shiJi,
  jiNian,
  isXiongPair,
  zhongZong,
  shunFanShu,
  seasonFit,
  guaRelations,
  periodLiShu,
  buildSnapshotText,
  buildFullCopyText,
} from '../heluo/heluo'

const props = defineProps({
  pan: { type: Object, default: null },
  /** 八字引擎的排盘结果 —— 河洛的四柱取自它（与上游 horosa 一致），不是紫微的 bzText */
  bazi: { type: Object, default: null },
  sex: { type: [Number, String], default: 1 },
})

// ---------- 流派开关 ----------
const opts = ref({ ...HELUO_DEFAULTS })
const switches = HELUO_SWITCHES
function setOpt(k, v) {
  opts.value = { ...opts.value, [k]: v }
}

// ---------- 模型 ----------
const model = computed(() =>
  buildHeluoModel({ pan: props.pan, bazi: props.bazi, sex: props.sex, opts: opts.value })
)

// ---------- 展开状态 ----------
const daxianKey = ref('')
const openYao = ref('')
const liunianKey = ref('')
const liuyueKey = ref('')
const yearForMonth = ref(null)
const monthForDay = ref(null)
const openJing = ref('')
const snapInfo = ref('')

const YUAN_RANK = {
  5: '上吉（五最尊）',
  2: '次吉（二得中）',
  3: '中平（三四）',
  4: '中平（三四）',
  1: '下（初上位卑）',
  6: '下（初上位卑）',
}
const YUE_JIE = {
  寅: '立春', 卯: '惊蛰', 辰: '清明', 巳: '立夏', 午: '芒种', 未: '小暑',
  申: '立秋', 酉: '白露', 戌: '寒露', 亥: '立冬', 子: '大雪', 丑: '小寒',
}
const YUE_SEASON = {
  寅: '春', 卯: '春', 辰: '春', 巳: '夏', 午: '夏', 未: '夏',
  申: '秋', 酉: '秋', 戌: '秋', 亥: '冬', 子: '冬', 丑: '冬',
}

// ---------- 派生 ----------
const detailRows = computed(() => {
  const m = model.value
  if (!m) return []
  const { chart, jg, extras } = m
  const eshu = classifyErShu(chart.tian, chart.di)
  const mg = mingGe(chart, jg)
  const xp = isXiongPair(chart.xian.lines, chart.hou.lines)
  const jn = jiNian(m.birthYear, { huangdiOffset: m.opts.huangdiOffset || 2697 })
  const sj = shiJi(chart, jg)
  const wsX = extras.season ? wangShuai(chart.xian.name, extras.season) : null
  const wsH = extras.season ? wangShuai(chart.hou.name, extras.season) : null
  return [
    ['紀年', jn ? `黃帝 ${jn.huangdi} 年 · ${jn.yuan}${jn.yunNo}運 · ${jn.ganzhi}` : '—'],
    ['簡斷', extras.jianDuan],
    ['數理', `天數 ${chart.tian}·${extras.shuLi.tian}　地數 ${chart.di}·${extras.shuLi.di}`],
    ['數名', `${eshu.primary || '—'}${eshu.severity.length ? `（${eshu.severity.join('·')}）` : ''}`],
    ['氣運', extras.sanhou || '—'],
    ['值月消息卦', extras.xiaoxi.gua ? `${extras.xiaoxi.monthLabel}月建${m.monthZhi}·${extras.xiaoxi.gua}` : '—'],
    ['元氣化工', `天元 ${jg.yuan.tian.gua}・地元 ${jg.yuan.di.gua}・化工 ${(jg.huagong.guas || []).join('/') || '—'}`],
    ['先後天八卦變化', extras.bianYi],
    ['五命', `${m.fourPillars.year}生人・${m.nayin || ''}${extras.benWei.length ? `（${extras.benWei.join('、')}）` : ''}`],
    ['元堂爻位', `${yaoName(chart.xian.lines, chart.xian.yuan)}·${YUAN_RANK[chart.xian.yuan] || '—'}`],
    ['命格', `吉${mg.jiCount}/12 ${mg.jiGe || '—'}　凶${mg.xiongCount}/12 ${mg.xiongGe || '—'}`],
    ['十吉', sj ? `${sj.hitCount}/10　${sj.hit.join('、') || '—'}` : '—'],
    ['卦氣旺衰', (wsX || wsH)
      ? `先天 内${wsX ? `${wsX.low.wuxing}${wsX.low.state}` : '—'}/外${wsX ? `${wsX.up.wuxing}${wsX.up.state}` : '—'}　后天 内${wsH ? `${wsH.low.wuxing}${wsH.low.state}` : '—'}/外${wsH ? `${wsH.up.wuxing}${wsH.up.state}` : '—'}`
      : '—'],
    ['命局對體', xp ? `先後天${xp}（凶·防災咎）` : '—'],
  ]
})

// aux 卡片
const auxCards = computed(() => {
  const m = model.value
  if (!m) return []
  const { chart, jg, fourPillars, st, extras } = m
  const yn = (g) => `${g.name}（${yaoName(g.lines, g.yuan)}）`
  const yq = (o) => `${o.gua}${o.present ? '（命卦藏·应）' : '（命卦无）'}`
  const sf = shunFanShu(chart.tian, chart.di, chart.yangLing)
  const sft = seasonFit(chart.tian, chart.di, extras && extras.season)
  const sj = shiJi(chart, jg)
  const jn = jiNian(m.birthYear, { huangdiOffset: m.opts.huangdiOffset || 2697 })
  const miss = sj ? sj.items.filter((x) => !x.ok).map((x) => x.name) : []
  const season = extras && extras.season
  const wx = season ? wangShuai(chart.xian.name, season) : null
  const wh = season ? wangShuai(chart.hou.name, season) : null
  return [
    { t: '四柱', rows: [['年柱', fourPillars.year], ['月柱', fourPillars.month], ['日柱', fourPillars.day], ['时柱', fourPillars.hour]] },
    { t: '起卦', rows: [
      ['天数', `${chart.tian} → ${chart.tianGua}`],
      ['地数', `${chart.di} → ${chart.diGua}`],
      ['先天卦', yn(chart.xian)],
      ['后天卦', yn(chart.hou)],
      ['节气', st && st.term ? `${st.houLabel || st.term}${st.tuyong ? ' · 土用' : ''}` : '—'],
    ] },
    { t: '卦气', rows: [
      ['天元气', yq(jg.yuan.tian)],
      ['地元气', yq(jg.yuan.di)],
      ['反天元', yq(jg.fanYuan.tian)],
      ['反地元', yq(jg.fanYuan.di)],
      ['化工', `${jg.huagong.guas.join('/') || '—'}${jg.huagong.present.length ? `（藏${jg.huagong.present.join('')}）` : ''}`],
      ['反化工', `${jg.fanhua.guas.join('/') || '—'}${jg.fanhua.present.length ? `（藏${jg.fanhua.present.join('')}）` : ''}`],
      ['释义', '元气主根基禀赋，化工主名誉际遇（命卦藏之为应）'],
    ] },
    { t: '得失·二数·元堂', rows: [
      ['得势', jg.deSheng ? '✓ 纳甲相逢' : '—'],
      ['得时', jg.deTime ? '✓ 卦月相逢' : '—'],
      ['得体', yq(jg.deTi)],
      ['二数', `天${jg.erShu.tian}·${jg.erShu.tianState}／地${jg.erShu.di}·${jg.erShu.diState}`],
      ['順逆', `${sf.label}${sft ? `／${sft.season}宜·天${sft.tian}地${sft.di}` : ''}`],
      ['眾宗', zhongZong(chart.xian.lines, chart.xian.yuan) || '—'],
      ['元堂', `${jg.yuanTang.dangWei ? '当位' : '不当位'}·${jg.yuanTang.youYing ? '有应' : '无应'}·${jg.yuanTang.heLi ? '顺气' : '逆气'}`],
      ['判格', jg.xie ? '葉（藏元气/化工）' : '不葉'],
    ] },
    { t: '断验 · 卦气旺衰 / 十吉 / 纪年', rows: [
      ['时令', season || '—'],
      ['先天卦气', wx ? `内 ${wx.low.wuxing}${wx.low.state}／外 ${wx.up.wuxing}${wx.up.state}` : '—'],
      ['后天卦气', wh ? `内 ${wh.low.wuxing}${wh.low.state}／外 ${wh.up.wuxing}${wh.up.state}` : '—'],
      ['十吉·合', sj ? `${sj.hitCount}/10${sj.hit.length ? '　' + sj.hit.join('、') : ''}` : '—'],
      ['十吉·缺', miss.length ? miss.join('、') : '（俱全）'],
      ['纪年', jn ? `黄帝 ${jn.huangdi} 年 · ${jn.yuan}${jn.yunNo}运 · ${jn.ganzhi}` : '—'],
    ] },
  ]
})

// ---------- 交互 ----------
/**
 * 折叠开关：返回切换后的值。
 *
 * 注意不能写成 `toggle(openYao, key)` 再在函数里改 `keyRef.value` ——
 * 模板里 `openYao` 已被自动解包成字符串，传进来的是值不是 ref，
 * 对原始值赋 `.value` 在严格模式下抛 TypeError，被 Vue 的
 * 事件错误处理吞掉，表现为「点了没反应」。
 * 正确用法：模板里直接赋值 `openYao = toggle(openYao, key)`，
 * 编译器会生成对 .value 的写入。
 */
function toggle(cur, val) {
  return cur === val ? '' : val
}
function liShuChips(lines, jg, chart) {
  const rels = chart ? guaRelations(lines, chart).filter((r) => r.indexOf('即') < 0) : []
  const items = periodLiShu(lines, jg)
  return [
    ...rels.map((r) => ({
      text: r,
      rel: true,
      xiong: r.indexOf('正對') >= 0 || r.indexOf('反對') >= 0,
      fan: false,
    })),
    ...items.map((it) => ({ text: it.text, rel: false, xiong: false, fan: !!it.fan })),
  ]
}
/**
 * 爻辞详情块的取数 —— 等价于上游 HeLuoMain.js:350-365 的 renderYaoci()。
 *
 * 上游对**所有层级**（本命 / 大限 / 流年 / 流月 / 流日）复用同一个 renderYaoci，
 * 四个字段一律全给：
 *   易经爻辞 yaoci / 摘要 detail / 诗歌 shige / 易经爻辞推命 mingtiao[slot]
 * 另外头部还拼了「命卦对体关系」rels（chart 存在时才算）。
 *
 * 之前这里只在流年·流月·流日渲染了「摘要 + 推命」，把爻辞和诗歌漏掉了，
 * 大限与流年的头部也缺 rels。现改为五处共用本函数，避免再各写一遍。
 */
function yaociBlock(guaName, pos, lines, slot) {
  const chart = model.value && model.value.chart
  const yt = yaoText(guaName, pos) || {}
  const ni = (((guaInfo(guaName) || {}).mingtiao || {})[slot || 'liunian']) || ''
  const rels = chart ? guaRelations(lines, chart).filter((r) => r.indexOf('即') < 0) : []
  return {
    head: `${guaName} · ${yaoName(lines, pos)}`,
    verdict: yt.verdict || '',
    rels,
    yaoci: yt.yaoci || '',
    detail: yt.detail || '',
    shige: yt.shige || '',
    mingtiao: ni,
    // 上游：四者全空才显示「（空爻·无条文）」
    empty: !(yt.shige || yt.detail || ni || yt.yaoci),
  }
}

/**
 * 大限取哪个「易经爻辞推命」：该限属先天盘用 xiantian，否则用 houtian。
 * 与上游 renderDaxian 里 `const slot = m.dy.xian.indexOf(s) >= 0 ? ...` 同义。
 */
function daxianSlot(s) {
  const m = model.value
  return m && m.dy && m.dy.xian.indexOf(s) >= 0 ? 'xiantian' : 'houtian'
}

/**
 * 爻辞详情块的呈现。功能组件，供上面五处复用。
 * 字段顺序与上游一致：易经爻辞 → 摘要 → 诗歌 → 易经爻辞推命。
 */
const YaociBlock = (props) => {
  const b = props.b
  if (!b || b.empty) return h('div', { class: 'hl-yaoci-none' }, '（空爻·无条文）')
  return h('div', { class: 'hl-yaoci' }, [
    h('div', { class: 'hl-yaoci-head' }, [
      b.head,
      b.verdict ? h('span', { class: 'hl-verdict' }, b.verdict) : null,
      b.rels && b.rels.length
        ? h('span', { class: 'hl-yaoci-rel' }, ' · ' + b.rels.join('，'))
        : null,
    ]),
    b.yaoci ? h('div', { class: 'hl-yaoci-item' }, [h('b', null, '易经爻辞'), b.yaoci]) : null,
    b.detail ? h('div', { class: 'hl-yaoci-item' }, [h('b', null, '摘要'), b.detail]) : null,
    b.shige
      ? h('div', { class: 'hl-yaoci-item is-shige' }, [h('b', null, '诗歌'), b.shige])
      : null,
    b.mingtiao
      ? h('div', { class: 'hl-yaoci-item' }, [h('b', null, '易经爻辞推命'), b.mingtiao])
      : null,
  ])
}
YaociBlock.props = { b: { type: Object, default: null } }

function drillDaxian(key) {
  daxianKey.value = daxianKey.value === key ? '' : key
  liunianKey.value = ''
  liuyueKey.value = ''
  yearForMonth.value = null
  monthForDay.value = null
}
function drillLiunian(key, y) {
  liunianKey.value = liunianKey.value === key ? '' : key
  liuyueKey.value = ''
  yearForMonth.value = y
  monthForDay.value = null
}
function drillLiuyue(key, mo) {
  liuyueKey.value = liuyueKey.value === key ? '' : key
  monthForDay.value = mo
}

// 下钻数据
const curSeg = computed(() => {
  const m = model.value
  if (!m || !daxianKey.value) return null
  return m.dy.all.find((s) => `${s.gua}|${s.pos}|${s.ageStart}` === daxianKey.value) || null
})
const liunianRows = computed(() => {
  const m = model.value
  const cur = curSeg.value
  if (!m || !cur) return []
  return liuNian(cur, m.birthYear, { step2: (m.opts && m.opts.liunianStep2) || 'ying' })
})
const liuyueRows = computed(() => {
  const m = model.value
  const y = yearForMonth.value
  if (!m || !liunianKey.value || !y) return []
  return liuYue(y.lines, y.pos, { mode: (m.opts && m.opts.liuYueMode) || 'ying' })
})
const liuriRows = computed(() => {
  const m = model.value
  const mo = monthForDay.value
  if (!m || m.opts.showLiuRi === false || !liuyueKey.value || !mo) return []
  return liuRi(mo.lines, mo.pos)
})

// ---------- 快照导出 ----------
/** 写剪贴板：优先 async API，失败退回 textarea + execCommand（非 https 也能用） */
async function putClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (e) {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.top = '-9999px'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch (e2) {
      return false
    }
  }
}

function flashSnap(text, ok) {
  snapInfo.value = ok ? `已复制 ${text.length} 字符` : `已生成 ${text.length} 字符（剪贴板不可用，请手动选取）`
  setTimeout(() => { snapInfo.value = '' }, 3000)
}

/** 简洁快照（大限/流年只出表格骨架） */
async function copySnapshot() {
  const m = model.value
  if (!m) return
  const text = buildSnapshotText(m.chart, m.jg, m.dy, {
    season: m.extras && m.extras.season,
    monthZhi: m.monthZhi,
    birthYear: m.birthYear,
    opts: m.opts,
  })
  flashSnap(text, await putClipboard(text))
}

/**
 * 复制全部：本命（起卦/经文/元堂爻辞/命运篇/断验）+ 大限 + 流年，
 * 每层都带 卦辞 / 易经爻辞 / 摘要 / 诗歌 / 易经爻辞推命。
 * 不含流月、流日（量级太大）。
 */
async function copyAll() {
  const m = model.value
  if (!m) return
  const text = buildFullCopyText(m)
  if (!text) return
  flashSnap(text, await putClipboard(text))
}
</script>

<template>
  <div v-if="!model" class="hl-empty">请先填写出生资料并排盘，河洛理数需要四柱干支。</div>

  <div v-else class="hl">
    <!-- 流派开关 -->
    <div class="hl-switches">
      <span class="hl-sw-label">流派开关</span>
      <template v-for="s in switches" :key="s.k">
        <label v-if="s.bool" class="hl-sw">
          <input type="checkbox" :checked="opts[s.k]" @change="setOpt(s.k, $event.target.checked)" />
          {{ s.t }}
        </label>
        <label v-else class="hl-sw">
          {{ s.t }}
          <select :value="opts[s.k]" @change="setOpt(s.k, $event.target.value)">
            <option v-for="o in s.opts" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
          </select>
        </label>
      </template>
      <label class="hl-sw">
        纪年基准
        <input
          class="hl-num"
          type="number"
          :value="opts.huangdiOffset"
          @change="setOpt('huangdiOffset', +$event.target.value || 2697)"
        />
      </label>
      <button
        class="btn tiny"
        type="button"
        title="本命 + 全部大限 + 全部流年，含卦辞/爻辞/摘要/诗歌/推命（不含流月、流日）"
        @click="copyAll"
      >
        复制全部结果
      </button>
      <button class="btn tiny" type="button" @click="copySnapshot">复制盘面文本</button>
      <span v-if="snapInfo" class="hl-snapinfo">{{ snapInfo }}</span>
    </div>

    <!-- 概要 -->
    <div class="hl-toolbar">
      <span class="hl-part">{{ model.chart.xian.name }} → {{ model.chart.hou.name }}</span>
      <span class="hl-sub">
        天数 {{ model.chart.tian }}（{{ model.chart.tianGua }}）· 地数
        {{ model.chart.di }}（{{ model.chart.diGua }}）· {{ model.gender }}命
      </span>
    </div>

    <!-- 起卦详情 -->
    <div class="hl-card">
      <h3>起卦详情</h3>
      <div v-for="(r, i) in detailRows" :key="i" class="hl-row">
        <span>{{ r[0] }}</span><strong>{{ r[1] }}</strong>
      </div>
    </div>

    <!-- 先后天卦 -->
    <div v-for="g in [
      { t: '先天卦（本命·主前段）', gua: model.chart.xian, slot: 'xiantian' },
      { t: '后天卦（主后段）', gua: model.chart.hou, slot: 'houtian' },
    ]" :key="g.slot" class="hl-card">
      <h3>{{ g.t }}</h3>
      <div class="hl-guahead">
        <div class="hl-gua">
          <div
            v-for="p in [6, 5, 4, 3, 2, 1]"
            :key="p"
            class="hl-yaorow"
            :class="{ 'is-yuan': p === g.gua.yuan }"
          >
            <span class="hl-najia">
              {{ (najia(g.gua.name).find((x) => x.yao === p) || {}).liuqin
              }}{{ (najia(g.gua.name).find((x) => x.yao === p) || {}).ganzhi
              }}<em v-if="(najia(g.gua.name).find((x) => x.yao === p) || {}).shiYing" class="hl-shiying">
                {{ (najia(g.gua.name).find((x) => x.yao === p) || {}).shiYing }}</em>
            </span>
            <span class="hl-barwrap">
              <span v-if="g.gua.lines[p - 1] === 1" class="hl-bar yang" />
              <span v-else class="hl-bar yin"><i /><i /></span>
            </span>
            <span class="hl-yaolabel">
              {{ yaoName(g.gua.lines, p) }}{{ p === g.gua.yuan ? ' ·元堂' : '' }}
            </span>
          </div>
        </div>
        <div class="hl-guameta">
          <div class="hl-guaname">
            {{ g.gua.name }}<span class="hl-verdict">{{ (guaInfo(g.gua.name) || {}).verdict }}</span>
          </div>
          <div class="hl-meta">元堂 · {{ yaoName(g.gua.lines, g.gua.yuan) }}</div>
          <div v-if="model.extras.season" class="hl-meta">
            卦气 · 内{{ (wangShuai(g.gua.name, model.extras.season) || {}).low?.wuxing
            }}{{ (wangShuai(g.gua.name, model.extras.season) || {}).low?.state }}／外{{
              (wangShuai(g.gua.name, model.extras.season) || {}).up?.wuxing
            }}{{ (wangShuai(g.gua.name, model.extras.season) || {}).up?.state }}
          </div>
          <div class="hl-gist">{{ (guaInfo(g.gua.name) || {}).gist }}</div>
          <div class="hl-meta">互卦 {{ duiGua(g.gua.name).hu }} · 覆卦 {{ duiGua(g.gua.name).fu }}</div>
          <div class="hl-tags">
            <span
              v-for="c in liShuChips(g.gua.lines, model.jg, model.chart)"
              :key="c.text"
              class="hl-tag"
              :class="{ 'is-rel': c.rel, 'is-xiong': c.xiong, 'is-fan': c.fan }"
            >{{ c.text }}{{ c.xiong ? '·凶' : '' }}</span>
            <span v-if="!liShuChips(g.gua.lines, model.jg, model.chart).length" class="hl-tag-none">—</span>
          </div>
          <button class="btn tiny" type="button" @click="openJing = toggle(openJing, 'jing:' + g.slot)">
            {{ openJing === 'jing:' + g.slot ? '▾ 收起经文' : '▸ 经文（卦义·卦辞·总诀）' }}
          </button>
        </div>
      </div>

      <div v-if="openJing === 'jing:' + g.slot" class="hl-jing">
        <div v-if="(guaInfo(g.gua.name) || {}).meaning" class="hl-jing-item">
          <b>卦义</b>{{ (guaInfo(g.gua.name) || {}).meaning }}
        </div>
        <div v-if="(guaInfo(g.gua.name) || {}).guaci" class="hl-jing-item">
          <b>卦辞</b>{{ (guaInfo(g.gua.name) || {}).guaci }}
        </div>
        <div v-if="(guaInfo(g.gua.name) || {}).zongjue" class="hl-jing-item">
          <b>总诀</b>{{ (guaInfo(g.gua.name) || {}).zongjue }}
        </div>
      </div>

      <!-- 元堂爻辞 -->
      <YaociBlock :b="yaociBlock(g.gua.name, g.gua.yuan, g.gua.lines, g.slot)" />
    </div>

    <!-- 大限四级下钻 -->
    <div class="hl-card">
      <h3>大限（歲運）· 阳爻9年/阴爻6年 · 点行看爻辞、点▾看流年</h3>
      <table class="hl-table">
        <thead>
          <tr><th>年龄</th><th>卦</th><th>动爻</th><th>阴阳·吉凶</th><th /></tr>
        </thead>
        <tbody>
          <template v-for="s in model.dy.all" :key="s.gua + s.pos + s.ageStart">
            <tr
              :class="{ 'is-active': daxianKey === `${s.gua}|${s.pos}|${s.ageStart}`, 'is-open': openYao === `dx:${s.gua}|${s.pos}|${s.ageStart}` }"
              @click="openYao = toggle(openYao, `dx:${s.gua}|${s.pos}|${s.ageStart}`)"
            >
              <td>{{ s.ageStart }}-{{ s.ageEnd }}</td>
              <td>{{ s.gua }}</td>
              <td>{{ yaoName(s.lines, s.pos) }}</td>
              <td>{{ s.yang ? '阳9' : '阴6' }} {{ (yaoText(s.gua, s.pos) || {}).verdict || '' }}</td>
              <td class="hl-arrowcell" @click.stop="drillDaxian(`${s.gua}|${s.pos}|${s.ageStart}`)">
                <span class="hl-arrow" :class="{ 'is-open': daxianKey === `${s.gua}|${s.pos}|${s.ageStart}` }">▾</span>
              </td>
            </tr>
            <tr v-if="openYao === `dx:${s.gua}|${s.pos}|${s.ageStart}`" class="hl-detailrow">
              <td :colspan="5">
                <YaociBlock :b="yaociBlock(s.gua, s.pos, s.lines, daxianSlot(s))" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- 流年 -->
      <div v-if="curSeg" class="hl-drill">
        <div class="hl-sub2">
          流年（{{ curSeg.ageStart }}-{{ curSeg.ageEnd }}岁 · {{ curSeg.gua }}）· 点行看爻辞、点▾看流月
        </div>
        <table class="hl-table">
          <thead>
            <tr><th>岁</th><th>干支</th><th>值年卦</th><th>动爻</th><th>理数</th><th /></tr>
          </thead>
          <tbody>
            <template v-for="y in liunianRows" :key="y.age">
              <tr
                :class="{ 'is-active': liunianKey === `${curSeg.ageStart}:${y.age}`, 'is-open': openYao === `ln:${curSeg.ageStart}:${y.age}` }"
                @click="openYao = toggle(openYao, `ln:${curSeg.ageStart}:${y.age}`)"
              >
                <td>{{ y.age }}</td>
                <td>
                  {{ y.ganzhi }}
                  <div v-if="y.year" class="hl-tiny">
                    {{ y.year }}年<span v-if="jieQiLabel(y.year, '立春')"> · 立春 {{ jieQiLabel(y.year, '立春') }}</span>
                  </div>
                </td>
                <td>{{ y.gua }}</td>
                <td>{{ yaoName(y.lines, y.pos) }}</td>
                <td class="hl-tagcell">
                  <span
                    v-for="c in liShuChips(y.lines, model.jg, model.chart)"
                    :key="c.text"
                    class="hl-tag"
                    :class="{ 'is-rel': c.rel, 'is-xiong': c.xiong, 'is-fan': c.fan }"
                  >{{ c.text }}{{ c.xiong ? '·凶' : '' }}</span>
                </td>
                <td class="hl-arrowcell" @click.stop="drillLiunian(`${curSeg.ageStart}:${y.age}`, y)">
                  <span class="hl-arrow" :class="{ 'is-open': liunianKey === `${curSeg.ageStart}:${y.age}` }">▾</span>
                </td>
              </tr>
              <tr v-if="openYao === `ln:${curSeg.ageStart}:${y.age}`" class="hl-detailrow">
                <td :colspan="6">
                  <YaociBlock :b="yaociBlock(y.gua, y.pos, y.lines, 'liunian')" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <!-- 流月 -->
        <div v-if="liuyueRows.length" class="hl-drill">
          <div class="hl-sub2">
            流月（{{ yearForMonth.age }}岁 {{ yearForMonth.ganzhi }}年 · {{ yearForMonth.gua }}）·
            起月{{ model.opts.liuYueMode === 'legacy' ? '现行序' : '应爻校准' }} · 点行看爻辞、点▾看流日
          </div>
          <table class="hl-table">
            <thead>
              <tr><th>月</th><th>流月卦</th><th>动爻</th><th>理数</th><th>旺衰</th><th /></tr>
            </thead>
            <tbody>
              <template v-for="mo in liuyueRows" :key="mo.month">
                <tr
                  :class="{ 'is-active': liuyueKey === `${yearForMonth.age}:${mo.month}`, 'is-open': openYao === `ly:${yearForMonth.age}:${mo.month}` }"
                  @click="openYao = toggle(openYao, `ly:${yearForMonth.age}:${mo.month}`)"
                >
                  <td>
                    {{ mo.label }}月
                    <div v-if="jieQiLabel(mo.zhi === '丑' ? yearForMonth.year + 1 : yearForMonth.year, YUE_JIE[mo.zhi])" class="hl-tiny">
                      {{ YUE_JIE[mo.zhi] }}
                      {{ jieQiLabel(mo.zhi === '丑' ? yearForMonth.year + 1 : yearForMonth.year, YUE_JIE[mo.zhi]) }}
                    </div>
                  </td>
                  <td>{{ mo.gua }}</td>
                  <td>{{ yaoName(mo.lines, mo.pos) }}</td>
                  <td class="hl-tagcell">
                    <span
                      v-for="c in liShuChips(mo.lines, model.jg, model.chart)"
                      :key="c.text"
                      class="hl-tag"
                      :class="{ 'is-rel': c.rel, 'is-xiong': c.xiong, 'is-fan': c.fan }"
                    >{{ c.text }}{{ c.xiong ? '·凶' : '' }}</span>
                  </td>
                  <td class="hl-wscell">
                    {{ YUE_SEASON[mo.zhi] && wangShuai(mo.gua, YUE_SEASON[mo.zhi])
                      ? `${wangShuai(mo.gua, YUE_SEASON[mo.zhi]).low.state}/${wangShuai(mo.gua, YUE_SEASON[mo.zhi]).up.state}`
                      : '—' }}
                  </td>
                  <td class="hl-arrowcell" @click.stop="drillLiuyue(`${yearForMonth.age}:${mo.month}`, mo)">
                    <span class="hl-arrow" :class="{ 'is-open': liuyueKey === `${yearForMonth.age}:${mo.month}` }">▾</span>
                  </td>
                </tr>
                <tr v-if="openYao === `ly:${yearForMonth.age}:${mo.month}`" class="hl-detailrow">
                  <td :colspan="6">
                    <YaociBlock :b="yaociBlock(mo.gua, mo.pos, mo.lines, 'liunian')" />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>

          <!-- 流日 -->
          <div v-if="liuriRows.length" class="hl-drill">
            <div class="hl-sub2">
              流日（{{ monthForDay.label }}月 · {{ monthForDay.gua }}）· 月卦元堂不动、每卦管6日、动爻逐日初→上
            </div>
            <table class="hl-table">
              <thead>
                <tr><th>日</th><th>流日卦</th><th>动爻</th><th>理数</th></tr>
              </thead>
              <tbody>
                <template v-for="d in liuriRows" :key="d.dayInMonth">
                  <tr
                    :class="{ 'is-open': openYao === `lr:${monthForDay.month}:${d.dayInMonth}` }"
                    @click="openYao = toggle(openYao, `lr:${monthForDay.month}:${d.dayInMonth}`)"
                  >
                    <td>第{{ d.dayInMonth }}日</td>
                    <td>{{ d.gua }}</td>
                    <td>{{ yaoName(d.lines, d.pos) }}</td>
                    <td class="hl-tagcell">
                      <span
                        v-for="c in liShuChips(d.lines, model.jg, model.chart)"
                        :key="c.text"
                        class="hl-tag"
                        :class="{ 'is-rel': c.rel, 'is-xiong': c.xiong, 'is-fan': c.fan }"
                      >{{ c.text }}{{ c.xiong ? '·凶' : '' }}</span>
                    </td>
                  </tr>
                  <tr v-if="openYao === `lr:${monthForDay.month}:${d.dayInMonth}`" class="hl-detailrow">
                    <td :colspan="4">
                      <YaociBlock :b="yaociBlock(d.gua, d.pos, d.lines, 'liunian')" />
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 原 aux 五张信息卡 -->
    <div class="hl-aux">
      <div v-for="c in auxCards" :key="c.t" class="hl-card">
        <h3>{{ c.t }}</h3>
        <div v-for="(r, i) in c.rows" :key="i" class="hl-row">
          <span>{{ r[0] }}</span><strong>{{ r[1] }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>
