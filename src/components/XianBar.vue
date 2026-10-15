<script setup>
/**
 * 底部限流速查表 —— 照搬源码 WenMoTianJiK5190409B1D754067B5DA296F1C25ED5DK.as
 *
 * 五行：大限 / 流年 / 流月 / 流日 / 流时（源码 XLP[2..7]）
 *
 * 层级联动（源码 dxBtnClickHandler:1034 / lnBtnClickHandler:1155 /
 *          lyBtnClickHandler:1244 / lrBtnClickHandler:1454 / lsBtnClickHandler:1558）：
 *   1. 必须选上一级，下一级才可点
 *      （setLiuYueBtnsEnabled / setLiuRiBtnsEnabled / setLiuShiBtnsEnabled）
 *   2. 选某一级会清空其下所有级（源码 _lyIndex = _lrIndex = _lsIndex = 0 …）
 *   3. 再点一次已选中的格子 = 退回上一级
 *   4. 点「起限前(童限)」= 回本命盘（源码 :1067-1084 派发 ZxBack2Base）
 *
 * 标签格式：
 *   大限  dxAgeB~dxAgeE + 大限宫干支                       （initDaXian:1000-1002）
 *   流年  year + 年干支 + "年"                             （getLiuNianBtnLabel:2030-2039）
 *   流月  月名 + "月" + " " + 月干支                       （refreshLyBtnLabel:1649-1651）
 *   流日  农历日名 初一…三十                                （lrBtnClickHandler:1356）
 *   流时  时支 + "时"                                      （refreshLsBtnLabel）
 *
 * 流日行是 10 列 × 3 行网格（源码 type==7 分支 :464 Math.floor((i-1)/10)，
 * 且 lrTitle.height = lnTitle.height * 3 :323），对应「流日」标签占 3 行高。
 */
import { computed } from 'vue'

const props = defineProps({
  /** buildXianPan() 的返回值（含 dxList / lnList / lyList / lrList / lsList） */
  xian: { type: Object, default: null },
  /** 当前盘面层级：benming / daxian / liunian / liuyue / liuri / liushi / xiaoxian */
  view: { type: String, default: 'benming' },
  dxIndex: { type: Number, default: 1 },
  lnIndex: { type: Number, default: 1 },
  lyIndex: { type: Number, default: 1 },
  lrIndex: { type: Number, default: 1 },
  lsIndex: { type: Number, default: 1 }
})

const emit = defineEmits(['pick'])

/* 大限行：第 0 格固定是「起限前(童限)」，其后 12 个大限 */
const dxCells = computed(() => {
  const out = [{ i: 0, l1: '起限前', l2: '(童限)', on: props.dxIndex === 0 }]
  for (const d of props.xian?.dxList || []) {
    out.push({
      i: d.index,
      l1: `${d.startAge}-${d.endAge}`,
      l2: `${d.gz}限`,
      on: props.dxIndex === d.index
    })
  }
  return out
})

/* 流年行：该大限内的 10 年 */
const lnCells = computed(() =>
  (props.xian?.lnList || []).map((l) => ({
    i: l.index,
    l1: `${l.year}年`,
    l2: `${l.gz} ${l.age}`,
    on: props.lnIndex === l.index
  }))
)

/* 流月行：12 个月，干支由所选流年的年干五虎遁 */
const lyCells = computed(() =>
  (props.xian?.lyList || []).map((m) => ({
    i: m.index,
    l1: `${m.name}月`,
    l2: m.gz,
    on: props.lyIndex === m.index
  }))
)

/* 流日行：农历初一…三十（该农历月不足 30 天时末格禁用，对应源码的「该日不存在」告警） */
const lrCells = computed(() =>
  (props.xian?.lrList || []).map((d) => ({
    i: d.index,
    l1: d.name,
    l2: d.gz,
    bad: !d.valid,
    on: props.lrIndex === d.index
  }))
)

/* 流时行：十二时辰 */
const lsCells = computed(() =>
  (props.xian?.lsList || []).map((s) => ({
    i: s.index,
    l1: s.name,
    l2: s.gz,
    on: props.lsIndex === s.index
  }))
)

/* 逐级启用：必须已选上一级，本级才可点
   （源码 setLiuYueBtnsEnabled:1756 / setLiuRiBtnsEnabled:1769 / setLiuShiBtnsEnabled:1782） */
const lnOn = computed(() => props.dxIndex >= 1)
const lyOn = computed(() => props.lnIndex >= 1)
const lrOn = computed(() => props.lyIndex >= 1)
const lsOn = computed(() => props.lrIndex >= 1)

/* 点击：已选中的格子 → 退回上一级（源码 :1191 / :1287 / :1588 …） */
function pickDx(i) {
  if (i === 0) return emit('pick', { level: 'benming', dx: 0 })
  if (props.dxIndex === i) return emit('pick', { level: 'benming', dx: 0 })
  emit('pick', { level: 'daxian', dx: i })
}

function pickLn(i) {
  if (props.lnIndex === i) return emit('pick', { level: 'daxian' })
  emit('pick', { level: 'liunian', ln: i })
}

function pickLy(i) {
  if (props.lyIndex === i) return emit('pick', { level: 'liunian' })
  emit('pick', { level: 'liuyue', ly: i })
}

function pickLr(i) {
  if (props.lrIndex === i) return emit('pick', { level: 'liuyue' })
  emit('pick', { level: 'liuri', lr: i })
}

function pickLs(i) {
  if (props.lsIndex === i) return emit('pick', { level: 'liuri' })
  emit('pick', { level: 'liushi', ls: i })
}
</script>

<template>
  <div v-if="xian" class="xian-bar panel">
    <!-- 大限 -->
    <div class="xb-row">
      <div class="xb-title">大限</div>
      <div class="xb-cells">
        <button
          v-for="c in dxCells"
          :key="c.i"
          class="xb-cell"
          :class="{ on: c.on }"
          type="button"
          @click="pickDx(c.i)"
        >
          <i class="l1">{{ c.l1 }}</i><i class="l2">{{ c.l2 }}</i>
        </button>
      </div>
    </div>

    <!-- 流年 -->
    <div class="xb-row">
      <div class="xb-title">流年</div>
      <div class="xb-cells">
        <button
          v-for="c in lnCells"
          :key="c.i"
          class="xb-cell"
          :class="{ on: c.on }"
          type="button"
          :disabled="!lnOn"
          @click="pickLn(c.i)"
        >
          <i class="l1">{{ c.l1 }}</i><i class="l2">{{ c.l2 }}</i>
        </button>
      </div>
    </div>

    <!-- 流月 -->
    <div class="xb-row">
      <div class="xb-title">流月</div>
      <div class="xb-cells">
        <button
          v-for="c in lyCells"
          :key="c.i"
          class="xb-cell"
          :class="{ on: c.on }"
          type="button"
          :disabled="!lyOn"
          @click="pickLy(c.i)"
        >
          <i class="l1">{{ c.l1 }}</i><i class="l2">{{ c.l2 }}</i>
        </button>
      </div>
    </div>

    <!-- 流日：10 列 × 3 行 -->
    <div class="xb-row">
      <div class="xb-title">流日</div>
      <div class="xb-cells grid10">
        <button
          v-for="c in lrCells"
          :key="c.i"
          class="xb-cell"
          :class="{ on: c.on }"
          type="button"
          :disabled="!lrOn || c.bad"
          @click="pickLr(c.i)"
        >
          <i class="l1">{{ c.l1 }}</i><i class="l2">{{ c.l2 }}</i>
        </button>
      </div>
    </div>

    <!-- 流时 -->
    <div class="xb-row">
      <div class="xb-title">流时</div>
      <div class="xb-cells">
        <button
          v-for="c in lsCells"
          :key="c.i"
          class="xb-cell"
          :class="{ on: c.on }"
          type="button"
          :disabled="!lsOn"
          @click="pickLs(c.i)"
        >
          <i class="l1">{{ c.l1 }}</i><i class="l2">{{ c.l2 }}</i>
        </button>
      </div>
    </div>
  </div>
</template>
