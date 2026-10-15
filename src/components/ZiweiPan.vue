<script setup>
/**
 * 盘面容器：十二宫布局 + 中宫 + 四化图例 + 飞星连线
 *
 * layout = 'grid' 传统 4×4 盘（巳午未申 / 辰[中宫]酉 / 卯[中宫]戌 / 寅丑子亥）
 * layout = 'list' 宫位卡片列表（手机上可完整阅读每宫，不受盘面尺寸限制）
 *
 * 四化分层（叠加到当前限级）：生年 → 大限 → 流年 → 流月 → 流日 → 流时
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import GongCell from './GongCell.vue'
import * as D from '../ziwei/data.js'

const props = defineProps({
  pan: { type: Object, required: true },
  name: { type: String, default: '' },
  /** 需要额外标注的宫位（选中宫的四化飞星落宫） */
  marks: { type: Array, default: () => [] },
  /** 选中宫的宫干四化飞星明细 [{ star, type, gong }] */
  feiList: { type: Array, default: () => [] },
  /** benming / daxian / liunian / liuyue / liuri / liushi / xiaoxian */
  view: { type: String, default: 'benming' },
  /** buildXianPan() 的结果 */
  xian: { type: Object, default: null },
  /** 星曜分类显示开关 { zhu, fu, sha, xiao } */
  showGroups: { type: Object, default: () => ({ zhu: true, fu: true, sha: true, xiao: true }) },
  /** grid | list */
  layout: { type: String, default: 'grid' },
  /** 全量配置：宫位据此读显示开关（cfg_sj12s / cfg_jq12s …） */
  flags: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['select'])

const LAYOUT = [
  [6, 7, 8, 9],
  [5, 0, 0, 10],
  [4, 0, 0, 11],
  [3, 2, 1, 12]
]

const selected = ref(0)
const zhiName = (i) => (i ? D.ZHI[i - 1] : '')
const gongOf = (i) => props.pan.gongs[i - 1]

/** 图例：四化源分类 */
const KINDS = [
  { k: 'sn', t: '生年' },
  { k: 'rg', t: '日干' },
  { k: 'dx', t: '大限' },
  { k: 'ln', t: '流年' },
  { k: 'ly', t: '流月' },
  { k: 'lr', t: '流日' },
  { k: 'ls', t: '流时' },
  { k: 'xx', t: '小限' }
]

/* ---------------- 四化分层 ---------------- */

const DEPTH = { benming: 0, daxian: 1, liunian: 2, liuyue: 3, liuri: 4, liushi: 5, xiaoxian: 1 }

const siHuaSources = computed(() => {
  const p = props.pan
  const x = props.xian
  const src = [{ kind: 'sn', label: '生年', list: p.shengNianSiHua || [] }]
  // 日干四化（h4_RG）：仅在开关打开且确有化星时并入
  if ((p.riGanSiHua || []).some((it) => it.starId)) {
    src.push({ kind: 'rg', label: '日干', list: p.riGanSiHua })
  }
  if (!x) return src
  const chain = [
    ['dx', '大限', x.dxSiHua],
    ['ln', '流年', x.lnSiHua],
    ['ly', '流月', x.lySiHua],
    ['lr', '流日', x.lrSiHua],
    ['ls', '流时', x.lsSiHua]
  ]
  const d = DEPTH[props.view] ?? 0
  for (let i = 0; i < d; i++) {
    src.push({ kind: chain[i][0], label: chain[i][1], list: chain[i][2] || [] })
  }
  if (props.view === 'xiaoxian') src.push({ kind: 'xx', label: '小限', list: x.xxSiHua || [] })
  return src
})

/** starId -> [{ kind, type }] */
const siHuaMap = computed(() => {
  const m = new Map()
  for (const s of siHuaSources.value) {
    for (const it of s.list || []) {
      if (!it.starId) continue
      if (!m.has(it.starId)) m.set(it.starId, [])
      m.get(it.starId).push({ kind: s.kind, type: it.type })
    }
  }
  return m
})

const activeKinds = computed(() => siHuaSources.value.filter((s) => (s.list || []).length))

const xianMingGong = computed(() => {
  const x = props.xian
  if (!x || props.view === 'benming') return 0
  return {
    daxian: x.dxMingGong,
    liunian: x.lnMingGong,
    liuyue: x.lyMingGong,
    liuri: x.lrMingGong,
    liushi: x.lsMingGong,
    xiaoxian: x.xxMingGong
  }[props.view] || 0
})

/* ---------------- 自适应密度 ---------------- */

const groupOf = (id) => (id <= 14 ? 'zhu' : id <= 22 ? 'fu' : id <= 28 ? 'sha' : 'xiao')

const maxStarCount = computed(() => {
  let m = 0
  for (let i = 1; i <= 12; i++) {
    const st = props.pan.gongs[i - 1].stars
    let n = 0
    for (const s of st) if (props.showGroups[groupOf(s.id)]) n++
    if (n > m) m = n
  }
  return m
})
const densityCls = computed(() =>
  maxStarCount.value > 15 ? 'd3' : maxStarCount.value > 10 ? 'd2' : 'd1'
)

/* ---------------- 三方四正连线 ---------------- */

const SIHUA_CLS = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' }

const wrap12 = (n) => (((n - 1) % 12) + 12) % 12 + 1

const panEl = ref(null)
const panSize = ref({ w: 0, h: 0 })
/** 强制连线重算的计数器（尺寸/布局变化后 bump） */
const lineTick = ref(0)

/** 盘面 padding box 的原点（SVG 覆盖层以 padding box 为基准，需扣掉边框） */
function panOrigin(p) {
  const b = p.getBoundingClientRect()
  const cs = getComputedStyle(p)
  return [b.left + (parseFloat(cs.borderLeftWidth) || 0), b.top + (parseFloat(cs.borderTopWidth) || 0)]
}

/** 宫位中心相对盘面 padding box 的像素坐标（实测，不受宫位高度自适应影响） */
function centerOf(gi) {
  const p = panEl.value
  if (!p) return null
  const el = p.querySelector(`.gong[data-gi="${gi}"]`)
  if (!el) return null
  const a = el.getBoundingClientRect()
  const o = panOrigin(p)
  return [a.left - o[0] + a.width / 2, a.top - o[1] + a.height / 2]
}

/**
 * 三方四正是否显示（源码 WenMoTianJiKD63FD02D…as:1821）
 *   飞星盘(cfg_skin_type=1) → cfg_fxp_3f4z
 *   三合盘(cfg_skin_type=2) → cfg_3f4z
 *   四化盘(3) 源码未列入条件，不画
 */
const sf4zOn = computed(() => {
  const skin = Number(props.flags.cfg_skin_type ?? 2)
  if (skin === 1) return props.flags.cfg_fxp_3f4z !== false
  if (skin === 2) return props.flags.cfg_3f4z !== false
  return false
})

/**
 * 三方四正连线（源码 :1823-1867）
 *   本宫 −4 / −8 = 两个三合宫，−6 = 对宫（mod 12，故 −4/−8 ≡ +8/+4）
 *   共 4 笔：本宫→三合1、本宫→三合2、三合1↔三合2、本宫→对宫
 *   其中从本宫发出的是 3 条，另一条是两个三合宫之间的连线
 */
const sf4zLines = computed(() => {
  void lineTick.value
  if (!selected.value || props.layout === 'list' || !sf4zOn.value) return []
  const s = selected.value
  const h1 = wrap12(s - 4)
  const h2 = wrap12(s - 8)
  const dui = wrap12(s - 6)
  const segs = [
    { key: 'h1', from: s, to: h1 },
    { key: 'h2', from: s, to: h2 },
    { key: 'h12', from: h1, to: h2 },
    { key: 'dui', from: s, to: dui }
  ]
  const out = []
  for (const sg of segs) {
    const a = centerOf(sg.from)
    const b = centerOf(sg.to)
    if (!a || !b) continue
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const pad = Math.min(14, len / 3)
    out.push({
      key: sg.key,
      x1: a[0] + ux * pad,
      y1: a[1] + uy * pad,
      x2: b[0] - ux * pad,
      y2: b[1] - uy * pad
    })
  }
  return out
})

let ro = null
function measure() {
  const el = panEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const bx = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
  const by = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
  panSize.value = {
    w: Math.max(1, Math.round(r.width - bx)),
    h: Math.max(1, Math.round(r.height - by))
  }
  lineTick.value++
}

onMounted(() => {
  measure()
  if (panEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(panEl.value)
  }
})
onBeforeUnmount(() => ro && ro.disconnect())

watch(selected, async () => {
  await nextTick()
  measure()
})
watch([() => props.feiList, () => props.layout, () => props.pan], () => {
  lineTick.value++
})

/* ---------------- 交互 ---------------- */

function select(gi) {
  selected.value = selected.value === gi ? 0 : gi
  emit('select', selected.value)
}

function clear() {
  selected.value = 0
  emit('select', 0)
}

function selectAt(i) {
  selected.value = i || 0
  emit('select', selected.value)
}

defineExpose({ clear, selectAt })
</script>

<template>
  <!-- 传统盘面 -->
  <div v-if="layout !== 'list'" ref="panEl" class="pan" :class="densityCls">
    <!-- 三方四正连线：像素坐标覆盖层（源码 :1864-1867） -->
    <svg
      v-if="sf4zLines.length && panSize.w > 1"
      class="pan-lines"
      :width="panSize.w"
      :height="panSize.h"
      :viewBox="`0 0 ${panSize.w} ${panSize.h}`"
      aria-hidden="true"
    >
      <line
        v-for="l in sf4zLines"
        :key="l.key"
        :x1="l.x1"
        :y1="l.y1"
        :x2="l.x2"
        :y2="l.y2"
        class="fl sf4z"
      />
    </svg>

    <template v-for="(row, r) in LAYOUT" :key="r">
      <template v-for="(gi, c) in row" :key="c">
        <!-- 中宫 -->
        <div
          v-if="gi === 0 && r === 1 && c === 1"
          class="pan-center"
          style="grid-column: span 2; grid-row: span 2"
        >
          <div class="c-name">{{ name || '匿 名' }}</div>
          <div class="c-row"><span>性别</span><span>{{ pan.sex === 1 ? '男' : '女' }}</span></div>
          <div class="c-title">四柱</div>
          <div class="c-row"><span>年</span><span>{{ pan.bzText.year }}</span></div>
          <div class="c-row"><span>月</span><span>{{ pan.bzText.month }}</span></div>
          <div class="c-row"><span>日</span><span>{{ pan.bzText.day }}</span></div>
          <div class="c-row"><span>时</span><span>{{ pan.bzText.hour }}</span></div>

          <template v-if="xian && view !== 'benming'">
            <div class="c-title">限盘</div>
            <div class="c-row">
              <span>大限</span>
              <span>{{ xian.dx.label }}（{{ xian.dx.startYear }}–{{ xian.dx.endYear }}）</span>
            </div>
            <div v-if="view !== 'daxian'" class="c-row">
              <span>流年</span>
              <span>{{ xian.ln.year }} {{ xian.ln.gz }}　{{ xian.ln.age }}岁</span>
            </div>
            <div v-if="['liuyue', 'liuri', 'liushi'].includes(view)" class="c-row">
              <span>流月</span>
              <span>{{ xian.lyIndex }}月（{{ zhiName(xian.zhengYueGong) }}宫起正月）</span>
            </div>
            <div v-if="['liuri', 'liushi'].includes(view)" class="c-row">
              <span>流日</span>
              <span>{{ xian.lrIndex }}日 {{ xian.lrGanZhi }}</span>
            </div>
            <div v-if="view === 'liushi'" class="c-row">
              <span>流时</span>
              <span>{{ zhiName(xian.lsZhi) }}时 {{ xian.lsGanZhi }}</span>
            </div>
            <div class="c-row opt">
              <span>斗君</span><span>{{ zhiName(xian.douJun) }}宫</span>
            </div>
            <div class="c-row opt">
              <span>{{
                { daxian: '大限宫', liunian: '太岁宫', xiaoxian: '小限宫' }[view] || '命宫'
              }}</span>
              <span>{{ zhiName(xianMingGong) }}宫</span>
            </div>
            <div v-if="view === 'xiaoxian'" class="c-row opt">
              <span>小限岁</span>
              <span>{{ xian.gongs[xian.xxMingGong - 1]?.xiaoXianAge ?? '—' }} 岁</span>
            </div>
          </template>

          <div class="c-title">盘面</div>
          <div class="c-row"><span>五行局</span><span>{{ pan.wuXingJuName }}</span></div>
          <div class="c-row opt"><span>命主</span><span>{{ pan.mingZhu }}</span></div>
          <div class="c-row opt"><span>身主</span><span>{{ pan.shenZhu }}</span></div>
          <div class="c-row opt">
            <span>紫微</span><span>{{ pan.gongs[pan.ziweiGong - 1].zhiName }}宫</span>
          </div>
        </div>

        <!-- 宫位 -->
        <GongCell
          v-else-if="gi !== 0"
          :key="'g' + gi"
          :pan="pan"
          :xian="xian"
          :view="view"
          :gi="gi"
          :show-groups="showGroups"
          :selected="selected"
          :fei-list="feiList"
          :si-hua-map="siHuaMap"
          :xian-ming-gong="xianMingGong"
          :flags="flags"
          @select="select"
        />
      </template>
    </template>
  </div>

  <!-- 宫位列表（手机友好） -->
  <div v-else class="gong-list">
    <div class="gong-list-head">
      <span class="gl-name">{{ name || '匿 名' }}</span>
      <span class="gl-item">{{ pan.sex === 1 ? '男' : '女' }}</span>
      <span class="gl-item">{{ pan.bzText.year }} {{ pan.bzText.month }} {{ pan.bzText.day }} {{ pan.bzText.hour }}</span>
      <span class="gl-item">{{ pan.wuXingJuName }} · 命主{{ pan.mingZhu }} · 身主{{ pan.shenZhu }}</span>
      <template v-if="xian && view !== 'benming'">
        <span class="gl-item">大限{{ xian.dx.label }}（{{ xian.dx.startYear }}–{{ xian.dx.endYear }}）</span>
        <span v-if="view !== 'daxian'" class="gl-item">流年{{ xian.ln.year }} {{ xian.ln.gz }} {{ xian.ln.age }}岁</span>
      </template>
    </div>
    <!-- 按地支顺序列出 12 宫 -->
    <GongCell
      v-for="gi in 12"
      :key="'l' + gi"
      :pan="pan"
      :xian="xian"
      :view="view"
      :gi="gi"
      :show-groups="showGroups"
      :selected="selected"
      :fei-list="feiList"
      :si-hua-map="siHuaMap"
      :xian-ming-gong="xianMingGong"
      :flags="flags"
      :list-mode="true"
      @select="select"
    />
  </div>

  <!-- 四化图例 -->
  <div class="pan-legend">
    <span class="lg lg-hd">四化：</span>
    <span class="lg"><i class="sh lu">禄</i>禄</span>
    <span class="lg"><i class="sh quan">权</i>权</span>
    <span class="lg"><i class="sh ke">科</i>科</span>
    <span class="lg"><i class="sh ji">忌</i>忌</span>
    <span class="lg lg-sep">飞星入宫：</span>
    <span class="lg">
      <i class="arw in"><svg viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0.5 L9.3 6 L6.7 6 L6.7 11.5 L3.3 11.5 L3.3 6 L0.7 6 Z" /></svg></i
      >点选宫位后，其宫干四化飞到的宫显示「子·贪狼禄」
    </span>
    <span class="lg lg-sep">角标底色：</span>
    <span v-for="k in KINDS" :key="k.k" class="lg">
      <i class="sq" :class="k.k"></i>{{ k.t }}
    </span>
    <span class="lg lg-sep">
      当前叠加：{{ activeKinds.map((s) => s.label).join(' + ') }}
    </span>
  </div>

  <div class="pan-tip">
    <span v-if="selected">
      已选中：{{ gongOf(selected).nameM.trim() }}（{{ gongOf(selected).zhiName }}宫）　红框=选中　黄框=三方四正　绿框=飞星落宫　蓝框=限盘命宫
    </span>
    <span v-else>提示：点击任一宫位，画出该宫的三方四正（两个三合宫 + 对宫）连线</span>
  </div>
</template>
