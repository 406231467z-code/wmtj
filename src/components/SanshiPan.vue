<script setup>
/**
 * 三式 · 盘面（奇门遁甲 · 大六壬 · 太乙神数）
 *
 * 上游 horosa 的 SanShiUnitedMain.js 是「本地引擎编排 + React 盘面」：
 *   算法在 dunjia/、liureng/、taiyi/，盘面是 antd + d3 的合并圆盘与三栏。
 * 这里按目标栈重写为纵向卡片：
 *   奇门九宫格 / 六壬天地盘·四课·三传 / 太乙（复用 TaiyiPan，embedded 模式去掉其选项条）。
 * 外圈七政四余星盘依赖上游星历，整块不做。
 */
import { computed, ref } from 'vue'
import { buildSanshiModel, buildSanshiText, PAIPAN_OPTIONS, SCHOOL_OPTIONS } from '../sanshi/sanshi'
import TaiyiPan from './TaiyiPan.vue'

const props = defineProps({
  pan: { type: Object, default: null },
  bazi: { type: Object, default: null },
  sex: { type: [Number, String], default: 1 },
})

// ---------- 起局选项 ----------
const paiPanType = ref(3)
const school = ref('转盘')

const model = computed(() =>
  buildSanshiModel({
    pan: props.pan,
    bazi: props.bazi,
    sex: props.sex,
    opts: { qimen: { paiPanType: paiPanType.value, school: school.value } },
  })
)

const q = computed(() => (model.value ? model.value.dunjia : null))
const lr = computed(() => (model.value ? model.value.liureng : null))

/** 九宫按洛书排布 4-9-2 / 3-5-7 / 8-1-6 */
const GRID = [4, 9, 2, 3, 5, 7, 8, 1, 6]
const gridCells = computed(() => {
  const map = {}
  ;((q.value && q.value.cells) || []).forEach((c) => { map[c.palaceNum] = c })
  return GRID.map((n) => map[n] || null)
})

function marks(c) {
  if (!c) return []
  const out = []
  if (c.isZhiFu) out.push('值符')
  if (c.isZhiShi) out.push('值使')
  if (c.hasJiXing) out.push('击刑')
  if (c.hasRuMu) out.push('入墓')
  if (c.hasMenPo) out.push('门迫')
  if (c.hasKongWang) out.push('空亡')
  if (c.isYiMa) out.push('驿马')
  return out
}

/** 六壬天地盘：地盘固定 12 支，天盘/天将按下标对应 */
const plate12 = computed(() => {
  const l = lr.value && lr.value.layout
  if (!l) return []
  return l.downZi.map((d, i) => ({ down: d, up: l.upZi[i], jiang: l.houseTianJiang[i] }))
})

const keRows = computed(() => {
  const raw = (lr.value && lr.value.keData && lr.value.keData.raw) || []
  const names = ['一课', '二课', '三课', '四课']
  // 上游 raw=[ke1..ke4]，而 lines 的展示序是 四课/三课/二课/一课
  return raw.map((r, i) => ({ name: names[i], jiang: r[0], up: r[1], down: r[2] }))
})

const sanChuanRows = computed(() => {
  const s = lr.value && lr.value.sanChuan
  if (!s || !s.cuang) return []
  const names = ['初传', '中传', '末传']
  return names.map((n, i) => ({ name: n, zhi: s.cuang[i], jiang: s.tianJiang[i], qin: s.liuQin[i] }))
})

// ---------- 一键复制 ----------
const snapInfo = ref('')

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

async function copyAll() {
  if (!model.value) return
  const text = buildSanshiText(model.value)
  if (!text) return
  const ok = await putClipboard(text)
  snapInfo.value = ok ? `已复制 ${text.length} 字符` : `已生成 ${text.length} 字符（剪贴板不可用，请手动选取）`
  setTimeout(() => { snapInfo.value = '' }, 3000)
}
</script>

<template>
  <div v-if="!model" class="ss-empty">
    请先填写出生资料并排盘。三式需要四柱干支、农历月日与节气，四柱不全时无法起局。
  </div>

  <div v-else class="ss">
    <!-- 概况 + 起局选项 -->
    <div class="ss-bar">
      <span class="ss-kv">四柱<b>{{ q.ganzhi.year }} {{ q.ganzhi.month }} {{ q.ganzhi.day }} {{ q.ganzhi.time }}</b></span>
      <span class="ss-kv">奇门<b>{{ q.juText }}</b></span>
      <label class="ss-opt">
        奇门盘式
        <select :value="paiPanType" @change="paiPanType = +$event.target.value">
          <option v-for="o in PAIPAN_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="ss-opt">
        排盘法
        <select :value="school" @change="school = $event.target.value">
          <option v-for="o in SCHOOL_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <button
        class="btn tiny primary"
        type="button"
        title="奇门九宫 + 六壬天地盘/四课/三传 + 太乙全盘"
        @click="copyAll"
      >
        复制全部结果
      </button>
      <span v-if="snapInfo" class="ss-snapinfo">{{ snapInfo }}</span>
    </div>

    <!-- ═══ 一、奇门遁甲 ═══ -->
    <div class="ss-card">
      <h3>一、奇门遁甲</h3>
      <div class="ss-row"><span>局式 / 节气</span><strong>{{ q.juText }}（{{ q.yinYangDun }}·{{ q.sanYuan }}） · {{ q.jieqiText }}</strong></div>
      <div class="ss-row"><span>值符 / 值使</span><strong>{{ q.zhiFu }}（{{ q.zhiFuPalace }}宫） · {{ q.zhiShi }}（{{ q.zhiShiPalace }}宫）</strong></div>
      <div class="ss-row"><span>旬首 / 空亡 / 驿马</span><strong>{{ q.xunShou }} · {{ q.kongWang || '—' }} · {{ q.yiMa && q.yiMa.palace ? q.yiMa.palace + '宫' : '—' }}</strong></div>
      <div class="ss-row"><span>盘式 / 起局法</span><strong>{{ q.school }} · {{ q.options ? q.options.qijuMethodLabel : '—' }}</strong></div>
      <div v-if="q.shuziInfo" class="ss-row"><span>报数用神</span><strong>{{ q.shuziInfo.sum }} → {{ q.shuziInfo.gong }}宫</strong></div>

      <div class="ss-grid">
        <div v-for="(c, i) in gridCells" :key="i" class="ss-cell" :class="{ 'is-center': c && c.isCenter, 'is-zf': c && c.isZhiFu, 'is-zs': c && c.isZhiShi }">
          <template v-if="c">
            <div class="ss-cell-head">
              <span>{{ c.palaceName }}</span>
              <span class="ss-dim">{{ c.god || '—' }}</span>
            </div>
            <div class="ss-cell-mid">
              <b>{{ c.tianXing || '—' }}</b>
              <em>{{ c.door || '—' }}</em>
            </div>
            <div class="ss-cell-gans">
              <span>天 {{ c.tianGan || '—' }}</span>
              <span>地 {{ c.diGan || '—' }}</span>
            </div>
            <div class="ss-cell-marks">
              <span v-for="m in marks(c)" :key="m" class="ss-tag">{{ m }}</span>
            </div>
          </template>
        </div>
      </div>
      <div v-if="q.shenSha && q.shenSha.allItems && q.shenSha.allItems.length" class="ss-note">
        <div v-for="(it, i) in q.shenSha.allItems" :key="i">· {{ it.name || it.label }}：{{ it.value || it.text }}</div>
      </div>
    </div>

    <!-- ═══ 二、大六壬 ═══ -->
    <div class="ss-card">
      <h3>二、大六壬</h3>
      <template v-if="lr.layout">
        <div class="ss-row"><span>月将 / 贵人 / 昼夜</span><strong>{{ lr.layout.yue }} · {{ lr.layout.guizi }} · {{ lr.diurnal ? '昼' : '夜' }}</strong></div>
        <div class="ss-row"><span>日干支 / 时支</span><strong>{{ lr.chartObj.nongli.dayGanZi }} · {{ lr.layout.timezi }}</strong></div>

        <table class="ss-table">
          <thead><tr><th>地盘</th><th>天盘</th><th>天将</th></tr></thead>
          <tbody>
            <tr v-for="r in plate12" :key="r.down">
              <td class="ss-dim">{{ r.down }}</td>
              <td>{{ r.up }}</td>
              <td class="ss-out">{{ r.jiang }}</td>
            </tr>
          </tbody>
        </table>

        <div class="ss-sub">四课</div>
        <table class="ss-table">
          <thead><tr><th>课</th><th>天将</th><th>上神</th><th>下神</th></tr></thead>
          <tbody>
            <tr v-for="k in keRows" :key="k.name">
              <td class="ss-dim">{{ k.name }}</td>
              <td>{{ k.jiang || '—' }}</td>
              <td>{{ k.up || '—' }}</td>
              <td class="ss-out">{{ k.down || '—' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="ss-sub">三传</div>
        <table class="ss-table">
          <thead><tr><th>传</th><th>干支</th><th>天将</th><th>六亲</th></tr></thead>
          <tbody>
            <tr v-for="s in sanChuanRows" :key="s.name">
              <td class="ss-dim">{{ s.name }}</td>
              <td>{{ s.zhi || '—' }}</td>
              <td>{{ s.jiang || '—' }}</td>
              <td class="ss-out">{{ s.qin || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="lr.sanChuan && lr.sanChuan.name" class="ss-row"><span>课体</span><strong>{{ lr.sanChuan.name }}</strong></div>
      </template>
      <div v-else class="ss-note">· 六壬起课失败：缺月将或时支。</div>
    </div>

    <!-- ═══ 三、太乙神数 ═══ -->
    <div v-if="model.taiyi" class="ss-card">
      <h3>三、太乙神数</h3>
      <TaiyiPan :pan="pan" :bazi="bazi" :sex="sex" embedded />
    </div>

    <!-- 说明 -->
    <div class="ss-card">
      <h3>说明</h3>
      <div class="ss-note">· 奇门：局式按节气置闰三元定局，九宫给出八神/九星/八门/天盘干/地盘干与值符值使、击刑入墓门迫空亡驿马标记。</div>
      <div class="ss-note">· 六壬：月将取「出生时刻前一中气」过宫（雨水亥将…大寒子将），贵人分昼夜以 6~18 点为昼；四课三传按涉害/贼克等课体立传。</div>
      <div class="ss-note">· 太乙：与「太乙神数」页同一内核，此处内嵌全盘（起局/三算/诸神/断法/十精/十六宫）。</div>
      <div class="ss-note">· 外圈七政四余星盘依赖上游星历，未移植；三式以奇门九宫、六壬天地盘四课三传、太乙全盘为准。</div>
    </div>
  </div>
</template>
