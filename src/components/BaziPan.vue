<script setup>
/**
 * 四柱八字盘（自 horosa-web-app 迁移）
 *
 * 与紫微盘同源：四柱横排 ↔ 十二宫格，日柱 ↔ 命宫（朱砂），
 * 大运流年条 ↔ 限流速查表。只吃数据、不做计算 —— 计算在 src/bazi/ 引擎里。
 *
 * 硬约束：八个字（四柱干支）任何屏宽都横向排列，不换行。
 * 窄屏靠分档缩小字级 + 折叠次要信息（纳音 / 星运 / 空亡）适配。
 */
import { computed } from 'vue'

const props = defineProps({
  pan: { type: Object, default: null },
  name: { type: String, default: '' },
  /** 当前选择的层级：0 本命 / 1 大运 / 2 流年 / 3 流月 */
  depth: { type: Number, default: 0 },
  dyIndex: { type: Number, default: 0 },
  lnIndex: { type: Number, default: 0 },
  lyIndex: { type: Number, default: 0 }
})
const emit = defineEmits(['pick-dayun', 'pick-liunian', 'pick-liuyue'])

const b = computed(() => props.pan?.bazi || null)
const fc = computed(() => b.value?.fourColumns || {})
const nl = computed(() => b.value?.nongli || {})

const ELEMENT_CN = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' }

/** 十神简写 → 全称（引擎用「劫/杀/枭/才」简写） */
const FULL = {
  比: '比肩', 劫: '劫财', 食: '食神', 伤: '伤官',
  才: '偏财', 财: '正财', 杀: '七杀', 官: '正官',
  枭: '偏印', 印: '正印'
}
const ss = (r) => (r ? FULL[r] || r : '—')

/** 四柱（固定顺序，日柱单独标记） */
const pillars = computed(() => {
  const f = fc.value
  const mk = (key, label) => {
    const p = f[key]
    if (!p || !p.ganzi) return null
    return {
      key,
      label,
      isDay: key === 'day',
      gan: p.stem?.cell || '',
      zhi: p.branch?.cell || '',
      rel: key === 'day' ? '日元' : ss(p.stem?.relative),
      cang: (p.stemInBranch || []).map((s) => ({ gan: s.cell, shi: ss(s.relative) })),
      naying: [p.naying, p.nayingPhase].filter(Boolean).join(' · '),
      phase: p.ganziPhase || '',
      xun: p.xunEmpty || '',
      gods: [
        ...(p.goodGods || []).map((n) => ({ n, kind: 'g' })),
        ...(p.badGods || []).map((n) => ({ n, kind: 'b' })),
        ...(p.neutralGods || []).map((n) => ({ n, kind: 'n' }))
      ]
    }
  }
  return [mk('year', '年 柱'), mk('month', '月 柱'), mk('day', '日 柱'), mk('time', '时 柱')].filter(Boolean)
})

/** 日主（日柱天干） */
const dayMaster = computed(() => {
  const dm = b.value?.wuxingStat?.dayMaster || {}
  const g = fc.value.day?.stem || {}
  return {
    gan: g.cell || '',
    el: dm.element || ELEMENT_CN[g.element] || '',
    polar: g.polar === 'Positive' ? '阳' : g.polar === 'Negative' ? '阴' : '',
    verdict: dm.verdict || ''
  }
})

/** 五行力量（带相对最旺者的百分比，用于条宽） */
const wuxing = computed(() => {
  const w = b.value?.wuxingStat
  if (!w?.scores?.length) return []
  const max = Math.max(...w.scores.map((s) => s.score || 0)) || 1
  return w.scores.map((s) => ({
    ...s,
    el: s.key,
    width: Math.round(((s.score || 0) / max) * 100),
    isMax: (s.score || 0) === max
  }))
})

/** 三宫（命宫 / 身宫 / 胎元） */
const gongs = computed(() => {
  const f = fc.value
  const it = (p, label) => (p?.ganzi ? `${label} ${p.ganzi}` : '')
  return [it(f.ming, '命宫'), it(f.shen, '身宫'), it(f.tai, '胎元')].filter(Boolean)
})

const g = computed(() => b.value?.gejuYongShen || {})
const fenye = computed(() => b.value?.fenYe || {})
const mangpai = computed(() => b.value?.mangpai || {})

/** 大运（含其下流年） */
const dayuns = computed(() => b.value?.direction || [])

/** 当前选中大运对象 */
const curDy = computed(() => dayuns.value[props.dyIndex] || null)
/** 当前选中流年对象 */
const curLn = computed(() => curDy.value?.subDirect?.[props.lnIndex] || null)
/** 当前选中流月对象 */
const curLy = computed(() => curLn.value?.flowMonths?.[props.lyIndex] || null)

/** 流月（只有当前公历年所在大运会预计算） */
const flowMonths = computed(() => curLn.value?.flowMonths || [])

const relKeys = [
  ['ganHe', '干合'], ['ganCong', '干冲'], ['ziHe6', '支六合'],
  ['ziHe3', '支三合'], ['ziHui', '支三会'], ['ziXing', '支刑'],
  ['ziCong', '支冲'], ['ziCuan', '支穿'], ['ziPo', '支破']
]

/** 干支关系：压成可读短句 */
const relations = computed(() => {
  const f = fc.value
  const out = []
  for (const [k, label] of relKeys) {
    const o = f[k]
    if (!o) continue
    for (const name of Object.keys(o)) {
      out.push({ kind: label, text: name, bad: k === 'ziXing' || k === 'ziCong' || k === 'ziPo' })
    }
  }
  return out
})

const p2 = (n) => String(n).padStart(2, '0')
</script>

<template>
  <div v-if="b" class="bz-root">
    <!-- ═══ 盘头 ═══ -->
    <div class="bz-head">
      <span class="bz-hn">
        {{ name || '—' }} · {{ b.gender === 'Female' ? '女' : '男' }}
      </span>
      <span v-if="nl.year" class="bz-hi">
        农历 <b>{{ nl.year }}年{{ nl.leap ? '闰' : '' }}{{ nl.month }}{{ nl.day }}</b>
      </span>
      <span v-if="nl.yearGZByLunar" class="bz-hi">
        {{ nl.yearGZByLunar }}年 · 属{{ nl.shengXiaoLichun || '' }}
      </span>
      <span v-if="nl.jieqi" class="bz-hi">
        节气 <b>{{ nl.jieqi }}</b> {{ nl.jiedelta || '' }}
      </span>
      <span v-if="nl.clockTime" class="bz-hi">
        直接时间 <b>{{ nl.clockTime }}</b>
      </span>
      <span v-if="nl.solarTime" class="bz-hi">
        真太阳时 <b>{{ nl.solarTime }}</b>
      </span>
      <span v-if="b.directInfo" class="bz-hi">
        起运 <b>{{ b.directInfo }}</b>
      </span>
    </div>

    <!-- ═══ 四柱（永远横排）═══ -->
    <section class="bz-board">
      <div class="bz-pan">
        <div
          v-for="p in pillars"
          :key="p.key"
          class="bz-zhu"
          :class="{ day: p.isDay }"
        >
          <div class="bz-tag">{{ p.label }}</div>
          <div class="bz-rel">{{ p.rel }}</div>
          <div class="bz-gan">{{ p.gan }}</div>
          <div class="bz-zhi">{{ p.zhi }}</div>
          <div class="bz-div"></div>
          <div class="bz-cang">
            <span v-for="(c, i) in p.cang" :key="i"><i>{{ c.gan }}</i>{{ c.shi }}</span>
          </div>
          <div class="bz-ny">{{ p.naying }}</div>
          <div class="bz-ph">{{ p.phase ? `星运 ${p.phase}` : '' }}</div>
          <div class="bz-xk">{{ p.xun ? `空亡 ${p.xun}` : '' }}</div>
          <div class="bz-gods">
            <span v-for="(gd, i) in p.gods" :key="i" class="bz-god" :class="gd.kind">
              {{ gd.n }}
            </span>
          </div>
        </div>
      </div>

      <!-- 中宫条：日主 + 五行 -->
      <div class="bz-mid">
        <div class="bz-dm">
          <div class="bz-dm-t">日 主</div>
          <div class="bz-dm-v">{{ dayMaster.gan }}{{ dayMaster.el }}</div>
          <div class="bz-dm-s">
            {{ dayMaster.polar }}{{ dayMaster.el }} · {{ dayMaster.verdict }}
          </div>
          <div v-if="gongs.length" class="bz-dm-s">{{ gongs.join(' · ') }}</div>
        </div>
        <div class="bz-wx">
          <div
            v-for="w in wuxing"
            :key="w.el"
            class="bz-wxrow"
            :class="{ max: w.isMax }"
          >
            <span class="bz-wxl">{{ w.label }}</span>
            <span class="bz-wxbar">
              <i class="bz-wxf" :class="`wx-${w.el}`" :style="{ width: w.width + '%' }"></i>
            </span>
            <span class="bz-wxv">{{ w.percent }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 格局 / 用神 ═══ -->
    <section class="bz-gj">
      <div class="bz-gjc">
        <div class="bz-gjt">格局 <em>透干十神 / 月令</em></div>
        <div class="bz-gjb">
          <div class="row"><span>格局</span><span><b>{{ g.geju?.name || '—' }}</b></span></div>
          <div class="row">
            <span>来源</span>
            <span>{{ g.geju?.gan || '—' }}{{ g.geju?.via ? ` · ${g.geju.via}` : '' }}</span>
          </div>
          <div class="row">
            <span>成败</span>
            <span>
              <span :class="g.chengBai?.verdict === '成格' ? 'bz-xi' : 'bz-ji2'">
                {{ g.chengBai?.verdict || '—' }}
              </span>
            </span>
          </div>
          <div v-if="g.chengBai?.xiang?.gan" class="row">
            <span>相神</span><span>{{ g.chengBai.xiang.how }} {{ g.chengBai.xiang.gan }}</span>
          </div>
        </div>
        <div v-if="g.chengBai?.reason" class="bz-note">
          {{ g.chengBai.reason }}{{ g.chengBai.note ? ` ${g.chengBai.note}` : '' }}
        </div>
      </div>

      <div class="bz-gjc">
        <div class="bz-gjt">用神 <em>扶抑派</em></div>
        <div class="bz-gjb">
          <div class="row"><span>判身</span><span><b>{{ g.yongshen?.verdict || '—' }}</b></span></div>
          <div class="row">
            <span>喜</span>
            <span><span class="bz-xi">{{ (g.yongshen?.xi || []).join(' · ') || '—' }}</span></span>
          </div>
          <div class="row">
            <span>忌</span>
            <span><span class="bz-ji2">{{ (g.yongshen?.ji || []).join(' · ') || '—' }}</span></span>
          </div>
        </div>
        <div v-if="g.yongshen?.note" class="bz-note">{{ g.yongshen.note }}</div>
      </div>

      <div class="bz-gjc">
        <div class="bz-gjt">调候 <em>调候派 · 速查版</em></div>
        <div class="bz-gjb">
          <div class="row">
            <span>气候</span>
            <span><b>{{ g.tiaohou?.climate || '—' }}</b>{{ g.tiaohou?.monthZhi ? `（月支 ${g.tiaohou.monthZhi}）` : '' }}</span>
          </div>
          <div class="row">
            <span>用神</span>
            <span><span class="bz-xi">{{ (g.tiaohou?.yong || []).join(' · ') || '—' }}</span></span>
          </div>
          <div class="row">
            <span>首取</span>
            <span><b>{{ g.tiaohou?.primary || '—' }}</b></span>
          </div>
        </div>
      </div>

      <div class="bz-gjc">
        <div class="bz-gjt">病药 <em>病药派</em></div>
        <div class="bz-gjb">
          <div class="row">
            <span>局病</span>
            <span><b>{{ (g.bingyao?.ji || []).join('·') || '—' }}</b></span>
          </div>
          <div class="row">
            <span>取药</span>
            <span><span class="bz-xi">{{ (g.bingyao?.xi || []).join('·') || '—' }}</span></span>
          </div>
        </div>
        <div v-if="g.bingyao?.note" class="bz-note">{{ g.bingyao.note }}</div>
      </div>

      <div class="bz-gjc">
        <div class="bz-gjt">月令司令 <em>月律分野 · {{ fenye.versionLabel || '通行版' }}</em></div>
        <div class="bz-gjb">
          <div class="row"><span>节后</span><span><b>{{ fenye.daysAfterJie ?? '—' }}</b> 天</span></div>
          <div class="row">
            <span>司令</span>
            <span><span class="bz-xi">{{ fenye.ruler?.gan || '—' }}</span> · {{ fenye.ruler?.pos || '—' }}</span>
          </div>
        </div>
        <div v-if="fenye.segments?.length" class="bz-note">
          {{ fenye.segments.map((s) => `${s.gan} ${s.days} 天（${s.pos}）`).join('｜') }}
        </div>
      </div>

      <div class="bz-gjc">
        <div class="bz-gjt">干支关系 <em>合 · 会 · 刑</em></div>
        <div class="bz-gjb">
          <div v-for="(r, i) in relations.slice(0, 4)" :key="i" class="row">
            <span>{{ r.kind }}</span>
            <span :class="{ 'bz-ji2': r.bad }">{{ r.text }}</span>
          </div>
          <div v-if="!relations.length" class="row"><span>—</span><span>—</span></div>
        </div>
        <div v-if="relations.length > 4" class="bz-note">
          {{ relations.slice(4).map((r) => `${r.kind}：${r.text}`).join('｜') }}
        </div>
      </div>
    </section>

    <!-- ═══ 大运 / 流年 ═══ -->
    <section v-if="dayuns.length" class="bz-xian">
      <div class="bz-xhd">
        <h3>大运流年</h3>
        <span v-if="b.directTime" class="bz-chip">起运 {{ b.directTime.slice(0, 10) }}</span>
        <span v-if="b.directInfo" class="bz-chip">{{ b.directInfo }}</span>
      </div>

      <div class="bz-xrow">
        <div class="bz-xtitle">大运</div>
        <div class="bz-xcells">
          <button
            v-for="(d, i) in dayuns"
            :key="i"
            type="button"
            class="bz-xcell"
            :class="{ on: depth >= 1 && i === dyIndex }"
            @click="emit('pick-dayun', i)"
          >
            <span class="l1">{{ d.age }}岁 {{ d.mainDirect?.ganzi }}</span>
            <span class="l2">{{ d.startYear }}</span>
          </button>
        </div>
      </div>

      <!-- 流年（选中大运后出现） -->
      <template v-if="depth >= 1 && curDy">
        <div class="bz-xrow bz-lnrow">
          <div class="bz-xtitle">流年</div>
          <div class="bz-xcells bz-xyears">
            <button
              v-for="(y, i) in curDy.subDirect || []"
              :key="i"
              type="button"
              class="bz-ycell"
              :class="{ on: depth >= 2 && i === lnIndex }"
              @click="emit('pick-liunian', i)"
            >
              <span>{{ y.ganzi }}</span>
              <span class="y2">{{ y.year }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- 流月（选中流年且该年预计算了流月时出现） -->
      <template v-if="depth >= 2 && flowMonths.length">
        <div class="bz-xrow bz-lnrow">
          <div class="bz-xtitle">流月</div>
          <div class="bz-xcells bz-xyears">
            <button
              v-for="(m, i) in flowMonths"
              :key="i"
              type="button"
              class="bz-ycell"
              :class="{ on: depth >= 3 && i === lyIndex }"
              @click="emit('pick-liuyue', i)"
            >
              <span>{{ m.ganzi }}</span>
              <span class="y2">{{ m.term }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- 当前所选层级摘要 -->
      <div v-if="depth >= 1" class="bz-xsum">
        <template v-if="curDy">
          <span class="bz-sm">
            大运 <b>{{ curDy.mainDirect?.ganzi }}</b>
            （{{ curDy.age }} 岁起 · {{ curDy.startYear }}-{{ curDy.endYear }}）
          </span>
        </template>
        <template v-if="depth >= 2 && curLn">
          <span class="bz-sm">流年 <b>{{ curLn.year }} {{ curLn.ganzi }}</b>（{{ curLn.age }} 岁）</span>
        </template>
        <template v-if="depth >= 3 && curLy">
          <span class="bz-sm">流月 <b>{{ curLy.term }} {{ curLy.ganzi }}</b></span>
        </template>
      </div>
    </section>
  </div>
</template>
