<script setup>
/**
 * 单个宫位
 *
 * 纵向区块（对齐文墨天机 GONG 类渲染顺序）：
 *   1 顶部  限盘宫名（粗）| 地支 · 命/身角标
 *   2 叠宫  上一层盘的宫名（本命 / 大限 / 流年 / 流月 / 流日）
 *   3 干支  宫干支 · 大限区间 · 小限岁
 *   4 星曜  主星 / 辅曜 / 煞曜（竖排，亮度 + 多层四化角标）
 *   5 杂曜  小星（两列横排，自动换行，不裁剪）
 *   6 飞星  选中宫的宫干四化飞入本宫的标记（向心 ←）
 *   7 底部  十二长生 · 博士 · 岁前 · 将前 · 运流曜
 *
 * 四化角标底色区分「四化源」：sn 生年 / dx 大限 / ln 流年 / ly 流月 / lr 流日 / ls 流时 / xx 小限
 * 字形区分四化：禄 / 权 / 科 / 忌
 *
 * 自化（向心↑ / 离心↓）不在盘面画箭头：星曜名旁只保留四化角标，
 * 自化改由「宫位详情面板」与「复制内容（给 AI）」按文字列出。
 * 判定仍在 paipan.js（源码 GONG:4010-4072，落星时就地判定）。
 *
 * 盘面唯一保留的箭头是第 6 区「飞星入宫」——仅在点选某宫后，
 * 该宫宫干四化飞到哪些宫，那些宫才出现「←子·贪狼禄」标记。
 */
import { computed } from 'vue'
import { xianGongName, xianYao } from '../ziwei/xianpan.js'
import { taijiIndexOf, taijiNewIndex, GONG_S, GONG_M } from '../ziwei/taiji.js'
import * as D from '../ziwei/data.js'

const props = defineProps({
  pan: { type: Object, required: true },
  xian: { type: Object, default: null },
  view: { type: String, default: 'benming' },
  /** 宫位编号 1..12（1 = 子） */
  gi: { type: Number, required: true },
  showGroups: { type: Object, required: true },
  /** 当前选中宫号（0 = 未选） */
  selected: { type: Number, default: 0 },
  /** 选中宫的宫干四化飞星明细 [{ star, type, gong }] */
  feiList: { type: Array, default: () => [] },
  /** starId -> [{ kind, type }] */
  siHuaMap: { type: Map, default: () => new Map() },
  /** 限盘命宫宫号 */
  xianMingGong: { type: Number, default: 0 },
  /** 列表布局下显示完整标题 */
  listMode: { type: Boolean, default: false },
  /** 全量配置：读显示开关（cfg_sj12s 岁前 / cfg_jq12s 将前） */
  flags: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['select'])

const gong = computed(() => props.pan.gongs[props.gi - 1])
const xg = computed(() => (props.xian ? props.xian.gongs[props.gi - 1] : null))

const SIHUA_CLS = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' }

/** 顶部：限盘宫名 */
const title = computed(() => {
  if (props.xian && props.view !== 'benming' && xg.value) {
    return xianGongName(props.xian, xg.value, props.view) || gong.value.nameM
  }
  return gong.value.nameM
})

/** 叠宫：上一层盘的宫名 */
const stack = computed(() => {
  const x = xg.value
  if (!x) return ''
  switch (props.view) {
    case 'daxian': return `本命${(gong.value.nameM || '').trim()}`
    case 'liunian': return x.dxName || ''
    case 'liuyue': return x.lnName || ''
    case 'liuri': return x.lyPanName || ''
    case 'liushi': return x.lrPanName || ''
    case 'xiaoxian': return x.dxName || ''
    default: return ''
  }
})

/** 干支行附加：流月干支 / 流日干支 / 流时干支 */
const extraGz = computed(() => {
  const x = props.xian
  if (!x) return []
  if (props.view === 'liuyue' && xg.value?.lyGanZhi) return [xg.value.lyGanZhi]
  if (props.view === 'liuri' && x.lrGanZhi && props.gi === x.lrMingGong) return [x.lrGanZhi]
  if (props.view === 'liushi' && x.lsGanZhi && props.gi === x.lsMingGong) return [x.lsGanZhi]
  return []
})

const groupOf = (id) => (id <= 14 ? 'zhu' : id <= 22 ? 'fu' : id <= 28 ? 'sha' : 'xiao')

/** 按星曜表顺序（id 升序）排列 —— 即紫微/天府星系的传统次序，而非安星先后 */
function starsOf(group) {
  if (!props.showGroups[group]) return []
  return gong.value.stars
    .filter((s) => groupOf(s.id) === group)
    .sort((a, b) => a.id - b.id)
}

const zhuStars = computed(() => starsOf('zhu'))
const fuStars = computed(() => starsOf('fu'))
const shaStars = computed(() => starsOf('sha'))

const marksOf = (starId) => props.siHuaMap.get(starId) || []

/** 箭头路径（尖朝上）：盘面第 6 区「飞星入宫」专用 */
const ARW_PATH = 'M5 0.5 L9.3 6 L6.7 6 L6.7 11.5 L3.3 11.5 L3.3 6 L0.7 6 Z'

/** 飞星来源宫地支，用于落宫标记「←子·贪狼禄」 */
const fromZhi = computed(() =>
  props.selected ? props.pan.gongs[props.selected - 1].zhiName : ''
)

/** 飞星入本宫 */
const feiIn = computed(() =>
  props.selected ? props.feiList.filter((f) => f.gong === props.gi) : []
)

/** 流年及更深的盘：岁前 / 将前 改按流年支起 */
const lnMode = computed(() => ['liunian', 'liuyue', 'liuri', 'liushi'].includes(props.view))

const foot = computed(() => {
  const g = gong.value
  const x = xg.value
  const useLn = lnMode.value && x
  return {
    changSheng: g.changSheng,
    boShi: g.boShi,
    // 源码显示开关 cfg_sj12s / cfg_jq12s：关闭后这两栏不渲染，
    // 对应星曜会退回小星区显示（xiaoStars 的 shown 集合自动跟着变）
    suiQian: props.flags.cfg_sj12s === false ? '' : useLn ? x.suiQian : g.suiQian,
    jiangQian: props.flags.cfg_jq12s === false ? '' : useLn ? x.jiangQian : g.jiangQian,
    yao: x ? xianYao(x, props.view) : []
  }
})

/**
 * 小星：按星曜表顺序，且剔除已在底部单独成栏的十二神
 * （博士 / 岁前 / 将前 各有专属显示位，小星区再显示一次就是重复）
 */
const xiaoStars = computed(() => {
  const f = foot.value
  const shown = new Set([f.changSheng, f.boShi, f.suiQian, f.jiangQian].filter(Boolean))
  return starsOf('xiao').filter((s) => !shown.has(s.name))
})

const isRelated = computed(() => {
  if (!props.selected) return false
  const s = props.pan.gongs[props.selected - 1]
  return props.gi === s.duiGong || s.sanHe.includes(props.gi)
})

/* ---------------- 立太极（源码 GONG:384-444） ---------------- */

/** 立太极总开关 cfg_taijidian（源码 387-391：关闭则文本不显示） */
const taijiOn = computed(() => props.flags.cfg_taijidian !== false)

/** 太极点（= 当前选中宫）的十二宫编号；0 = 未点选 */
const taijiIdx = computed(() => {
  if (!props.selected) return 0
  const g = props.pan.gongs[props.selected - 1]
  const xg = props.xian ? props.xian.gongs[props.selected - 1] : null
  return taijiIndexOf(g, xg, props.view)
})

/** 本宫的十二宫编号（源码 392-415：本命盘 name_BM，限流盘按限级取 name_DX/LN/LY/LR/LS） */
const myIdx = computed(() => taijiIndexOf(gong.value, xg.value, props.view))

/** 本宫换算后的宫名编号；0 = 本宫即太极点（源码 416-419 置空） */
const taijiNew = computed(() => taijiNewIndex(taijiIdx.value, myIdx.value))

/** 宫格底部那行「X之Y」（源码 422-423；太极点自身源码留空，此处补全为「X之命」） */
const taijiLabel = computed(() => {
  if (!taijiOn.value || !taijiIdx.value || !myIdx.value) return ''
  return GONG_S[taijiIdx.value] + '之' + GONG_S[taijiNew.value || 1]
})

const taijiTip = computed(() => {
  if (!taijiLabel.value) return ''
  const from = GONG_M[myIdx.value] || ''
  const to = GONG_M[taijiNew.value || 1] || ''
  return taijiNew.value
    ? `立太极：以太极点「${GONG_M[taijiIdx.value]}」为命宫 → 原${from} 换算为新${to}`
    : `立太极：本宫即太极点，成为新命宫（源码此处置空，此处补全为「${taijiLabel.value}」）`
})

const fmt = (n) => String(n).padStart(2, '0')

function onClick() {
  emit('select', props.gi)
}
</script>

<template>
  <div
    class="gong clickable"
    :class="{
      ming: gi === pan.mingGong,
      shen: gi === pan.shenGong,
      selected: gi === selected,
      related: isRelated,
      marked: selected && gi !== selected && feiList.some((f) => f.gong === gi),
      xianming: gi === xianMingGong,
      laiyin: gong.isLaiYin,
      'list-mode': listMode
    }"
    :data-gi="gi"
    role="button"
    tabindex="0"
    :aria-label="`${title} ${gong.zhiName}宫，点击查看该宫详情与三方四正`"
    :aria-pressed="gi === selected ? 'true' : 'false'"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <!-- 1 顶部 -->
    <div class="g-top">
      <span class="g-name">
        {{ title
        }}<b v-if="gi === pan.mingGong" class="g-tag tg-m">命</b
        ><b v-if="gi === pan.shenGong" class="g-tag tg-s">身</b>
      </span>
      <span class="g-zhi">{{ gong.zhiName }}</span>
    </div>

    <!-- 2 叠宫 -->
    <div v-if="stack" class="g-stack">{{ stack }}</div>

    <!-- 3 干支 / 大限 / 小限 -->
    <div class="g-meta">
      <span class="gz">{{ gong.ganName }}{{ gong.zhiName }}</span>
      <span v-for="(t, i) in extraGz" :key="i" class="gz2">{{ t }}</span>
      <span class="dx">{{ fmt(gong.daXianStart) }}-{{ fmt(gong.daXianEnd) }}岁</span>
      <span class="xx">小限{{ gong.xiaoXianAge }}</span>
    </div>

    <!-- 4 星曜 -->
    <div class="g-stars">
      <div v-for="s in zhuStars" :key="'z' + s.id" class="st zhu">
        <span class="nm">{{ s.name }}</span>
        <em v-if="s.brightnessName" class="bn">{{ s.brightnessName }}</em>
        <i
          v-for="(m, k) in marksOf(s.id)"
          :key="k"
          class="sh"
          :class="[m.kind, SIHUA_CLS[m.type]]"
          >{{ m.type }}</i
        >
      </div>
      <div v-for="s in fuStars" :key="'f' + s.id" class="st fu">
        <span class="nm">{{ s.name }}</span>
        <em v-if="s.brightnessName" class="bn">{{ s.brightnessName }}</em>
        <i
          v-for="(m, k) in marksOf(s.id)"
          :key="k"
          class="sh"
          :class="[m.kind, SIHUA_CLS[m.type]]"
          >{{ m.type }}</i
        >
      </div>
      <div v-for="s in shaStars" :key="'s' + s.id" class="st sha">
        <span class="nm">{{ s.name }}</span>
        <em v-if="s.brightnessName" class="bn">{{ s.brightnessName }}</em>
        <i
          v-for="(m, k) in marksOf(s.id)"
          :key="k"
          class="sh"
          :class="[m.kind, SIHUA_CLS[m.type]]"
          >{{ m.type }}</i
        >
      </div>
    </div>

    <!-- 5 杂曜（两列，不裁剪） -->
    <div v-if="xiaoStars.length" class="g-xiao">
      <span v-for="s in xiaoStars" :key="'x' + s.id" class="xst">
        {{ s.name
        }}<i
          v-for="(m, k) in marksOf(s.id)"
          :key="k"
          class="sh"
          :class="[m.kind, SIHUA_CLS[m.type]]"
          >{{ m.type }}</i
        >
      </span>
    </div>

    <!-- 6 飞星入宫：点选宫后的宫干四化飞星标记（盘面唯一保留的箭头） -->
    <div v-if="feiIn.length" class="g-fei">
      <span
        v-for="(f, i) in feiIn"
        :key="'i' + i"
        class="fi"
        :class="SIHUA_CLS[f.type]"
        :title="`${fromZhi}宫 ${f.star}化${f.type} 飞入本宫（向心）`"
      >
        <i class="arw in"><svg viewBox="0 0 10 12" aria-hidden="true"><path :d="ARW_PATH" /></svg></i
        >{{ fromZhi }}·{{ f.star }}{{ f.type }}
      </span>
    </div>

    <!-- 7 底部 -->
    <div class="g-foot">
      <span v-if="foot.changSheng" class="cs">{{ foot.changSheng }}</span>
      <span v-if="foot.boShi" class="bs">{{ foot.boShi }}</span>
      <span v-if="foot.suiQian" class="xq">{{ foot.suiQian }}</span>
      <span v-if="foot.jiangQian" class="jq">{{ foot.jiangQian }}</span>
      <span v-for="(y, i) in foot.yao" :key="i" class="yao">{{ y.name }}</span>
    </div>

    <!-- 8 立太极：本宫换算后的宫名（源码 GONG:429-441 画在宫格底部） -->
    <div v-if="taijiLabel" class="g-taiji" :class="{ self: !taijiNew }" :title="taijiTip">
      {{ taijiLabel }}
    </div>
  </div>
</template>
