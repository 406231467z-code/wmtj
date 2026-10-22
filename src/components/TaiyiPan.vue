<script setup>
/**
 * 太乙神数 · 盘面
 *
 * 算法内核在 src/taiyi/core/（自 horosa components/taiyi/core 原样搬入），
 * 适配层 src/taiyi/taiyi.js 把紫微 solarClock 与八字四柱/农历翻成内核输入。
 * 界面为 Vue 重写：原 React 页（TaiYiMain.js）的右栏概览/十六宫/断法分页与
 * SVG 五环盘，这里统一铺成纵向卡片，另保留起盘方式与古法公式可调。
 */
import { computed, ref } from 'vue'
import {
  buildTaiyiModel,
  buildTaiyiText,
  STYLE_OPTIONS,
  ACCUM_OPTIONS,
  TAIYI_SCHOOL_OPTIONS,
  DEFAULT_TAIYI_SCHOOL,
  shenMeaning,
} from '../taiyi/taiyi'

const props = defineProps({
  pan: { type: Object, default: null },
  bazi: { type: Object, default: null },
  sex: { type: [Number, String], default: 1 },
  /** 内嵌模式（三式页）：不显示自己的概况条与流派设置，只出盘面 */
  embedded: { type: Boolean, default: false },
})

// ---------- 起盘选项 ----------
const style = ref(3)
const tn = ref(0)
const trueSolar = ref(false)
const school = ref({ ...DEFAULT_TAIYI_SCHOOL })

const SCHOOL_LABELS = {
  jishen: '计神方向',
  wenchang: '文昌重留',
  keJianChen: '客算间辰',
  sanji: '三基起宫',
  youshen: '游神方向',
  shijiCoord: '始击坐标',
}

const model = computed(() =>
  buildTaiyiModel({
    pan: props.pan,
    bazi: props.bazi,
    sex: props.sex,
    opts: {
      style: style.value,
      tn: tn.value,
      school: school.value,
      timeBasis: trueSolar.value ? 'trueSolar' : 'direct',
    },
  })
)
const p = computed(() => (model.value ? model.value.pan : null))
const d = computed(() => (model.value ? model.value.derived : null))

function setSchool(k, v) {
  school.value = { ...school.value, [k]: v }
}

// 十六宫去「中」，中宫单列
const palaces16 = computed(() => ((p.value && p.value.palace16) || []).filter((x) => x.palace !== '中'))
const centerPalace = computed(() => {
  const all = (p.value && p.value.palace16) || []
  return all.find((x) => x.palace === '中') || null
})

/** 诸神落点表：名称 / 数（或落点）/ 宫 */
const godRows = computed(() => {
  const q = p.value
  if (!q) return []
  return [
    ['太乙', q.taiyiNum, q.taiyiPalace],
    ['文昌（天目）', q.skyeyes, ''],
    ['始击', q.sf, ''],
    ['计神', q.jigod, ''],
    ['太岁', q.taishui, ''],
    ['合神', q.hegod, ''],
    ['岁计', q.se, ''],
    ['主大将', q.homeGeneral, q.homeGeneralPalace],
    ['主参将', q.homeVGen, q.homeVGenPalace],
    ['客大将', q.awayGeneral, q.awayGeneralPalace],
    ['客参将', q.awayVGen, q.awayVGenPalace],
    ['定大将', q.setGeneral, q.setGeneralPalace],
    ['定参将', q.setVGen, q.setVGenPalace],
    ['君基', q.kingbase, ''],
    ['臣基', q.officerbase, ''],
    ['民基', q.pplbase, ''],
    ['四神', q.fgd, ''],
    ['天乙', q.skyyi, ''],
    ['地乙', q.earthyi, ''],
    ['直符', q.zhifu, ''],
    ['飞符', q.flyfu, ''],
    ['五福', q.wufuNum, q.wufuPalace],
    ['君符', q.kingfu, ''],
    ['太君', q.taijun, ''],
    ['飞鸟', q.flybird, ''],
  ]
})

const windRows = computed(() => {
  const q = p.value
  if (!q) return []
  return [
    ['三风', q.threewindNum, q.threewindPalace],
    ['五风', q.fivewindNum, q.fivewindPalace],
    ['八风', q.eightwindNum, q.eightwindPalace],
    ['大游', q.bigyoNum, q.bigyoPalace],
    ['小游', q.smyoNum, q.smyoPalace],
  ]
})

const themeLabels = { good: '吉', bad: '凶', neutral: '中' }
function toneOf(tag) {
  return /大灾|重阳|重阴|不和/.test(tag) ? 'bad' : (/上和|次和|下和/.test(tag) ? 'good' : 'neutral')
}

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
  const text = buildTaiyiText(model.value)
  if (!text) return
  const ok = await putClipboard(text)
  snapInfo.value = ok ? `已复制 ${text.length} 字符` : `已生成 ${text.length} 字符（剪贴板不可用，请手动选取）`
  setTimeout(() => { snapInfo.value = '' }, 3000)
}
</script>

<template>
  <div v-if="!model" class="ty-empty">
    请先填写出生资料并排盘。太乙神数需要四柱干支与农历月日，四柱不全时无法起局。
  </div>

  <div v-else class="ty">
    <!-- 概况 + 起盘选项（内嵌时只出盘面） -->
    <div v-if="!embedded" class="ty-bar">
      <span class="ty-kv">四柱<b>{{ p.ganzhi.year }} {{ p.ganzhi.month }} {{ p.ganzhi.day }} {{ p.ganzhi.time }}</b></span>
      <span class="ty-kv">局式<b>{{ p.kook.text }}</b></span>
      <span class="ty-kv">太乙数<b>{{ p.taiyiNum }}</b>（{{ p.taiyiPalace }}）</span>
      <label class="ty-opt">
        起盘方式
        <select :value="style" @change="style = +$event.target.value">
          <option v-for="o in STYLE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="ty-opt">
        古法公式
        <select :value="tn" @change="tn = +$event.target.value">
          <option v-for="o in ACCUM_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="ty-opt">
        <input type="checkbox" :checked="trueSolar" @change="trueSolar = $event.target.checked" />
        真太阳时
      </label>
      <button
        class="btn tiny primary"
        type="button"
        title="起盘信息 + 起局 + 三算胜负格局 + 诸神落点 + 断法 + 十精 + 十六宫/十二宫 + 十六神主事"
        @click="copyAll"
      >
        复制全部结果
      </button>
      <span v-if="snapInfo" class="ty-snapinfo">{{ snapInfo }}</span>
    </div>

    <!-- 起局 -->
    <div class="ty-card">
      <h3>起局</h3>
      <div class="ty-row"><span>公历 / 时间基准</span><strong>{{ p.dateStr }} {{ p.timeStr }} · {{ p.options.timeBasisLabel }}</strong></div>
      <div v-if="p.realSunTime" class="ty-row"><span>真太阳时</span><strong>{{ p.realSunTime }}</strong></div>
      <div class="ty-row"><span>农历</span><strong>{{ p.lunarText }}<template v-if="p.jiedelta">（{{ p.jiedelta }}）</template></strong></div>
      <div class="ty-row"><span>积数</span><strong>{{ p.accNum }}</strong></div>
      <div class="ty-row"><span>五子元 / 纪元</span><strong>{{ d.wuziyuan || '—' }}<template v-if="p.jiyuan">　纪元 {{ p.jiyuan }}<template v-if="d.sanyuan">（{{ d.sanyuan }}）</template></template></strong></div>
      <div class="ty-row"><span>局式</span><strong>{{ p.kook.text }}（{{ p.kook.year }}）</strong></div>
      <div class="ty-row"><span>阴阳遁</span><strong>{{ d.dun || '—' }}</strong></div>
      <div class="ty-row"><span>起盘方式 / 古法</span><strong>{{ p.options.styleLabel }} · {{ p.options.methodLabel }}<template v-if="p.options.methodSource && p.options.methodSource !== '命法不适用'">（{{ p.options.methodSource }}）</template></strong></div>
      <div class="ty-row"><span>换日 / 命式</span><strong>{{ p.options.daySwitchLabel }} · {{ p.zhao }}</strong></div>
      <div class="ty-row"><span>太乙纳音</span><strong>{{ d.nayin ? `${d.nayin.pillar}柱 ${d.nayin.ganzhi} · ${d.nayin.nayin}（${d.nayin.element}）` : '—' }}</strong></div>
      <div v-if="p._schoolNote" class="ty-row"><span>流派覆盖</span><strong>{{ p._schoolNote }}</strong></div>
    </div>

    <!-- 三算 · 胜负 · 格局 -->
    <div class="ty-card">
      <h3>三算 · 胜负 · 格局</h3>
      <div class="ty-row"><span>主算 / 客算 / 定算</span><strong>{{ p.homeCal }} / {{ p.awayCal }} / {{ p.setCal }}</strong></div>
      <div v-if="d.shuli" class="ty-row">
        <span>数理</span>
        <strong class="ty-tags">
          <span>主</span>
          <span v-for="t in d.shuli.home" :key="'h' + t" class="ty-tag" :class="'is-' + toneOf(t)">{{ t }}</span>
          <span>客</span>
          <span v-for="t in d.shuli.away" :key="'a' + t" class="ty-tag" :class="'is-' + toneOf(t)">{{ t }}</span>
          <span>定</span>
          <span v-for="t in d.shuli.set" :key="'s' + t" class="ty-tag" :class="'is-' + toneOf(t)">{{ t }}</span>
        </strong>
      </div>
      <div v-if="d.victory" class="ty-row"><span>胜负</span><strong>{{ d.victory.side }} — {{ d.victory.verdict }}</strong></div>
      <div v-if="d.geju && d.geju.length" class="ty-row">
        <span>格局</span>
        <strong>{{ d.geju.map((g) => g.name).join('、') }}</strong>
      </div>
      <div v-else class="ty-row"><span>格局</span><strong>无掩、迫、囚、格、对、挟、提、关、击</strong></div>
      <div v-for="g in d.geju" :key="g.name" class="ty-note">· {{ g.name }}：{{ g.text }}</div>
      <div v-if="d.ehui && d.ehui.length" class="ty-row"><span>厄会</span><strong>{{ d.ehui.join('、') }}</strong></div>
    </div>

    <!-- 诸神落点 -->
    <div class="ty-card">
      <h3>诸神落点</h3>
      <table class="ty-table">
        <thead><tr><th>神</th><th>数 / 落点</th><th>宫</th></tr></thead>
        <tbody>
          <tr v-for="r in godRows" :key="r[0]">
            <td class="ty-dim">{{ r[0] }}</td>
            <td>{{ r[1] !== undefined && r[1] !== null && r[1] !== '' ? r[1] : '—' }}</td>
            <td class="ty-out">{{ r[2] || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="ty-row"><span>三风 / 五风 / 八风</span><strong>{{ p.threewindNum }}（{{ p.threewindPalace }}） / {{ p.fivewindNum }}（{{ p.fivewindPalace }}） / {{ p.eightwindNum }}（{{ p.eightwindPalace }}）</strong></div>
      <div v-for="r in windRows.slice(3)" :key="r[0]" class="ty-row"><span>{{ r[0] }}</span><strong>{{ r[1] }}（{{ r[2] }}）</strong></div>
    </div>

    <!-- 断法 -->
    <div class="ty-card">
      <h3>断法</h3>
      <div v-if="d.fenye && d.fenye.taiyi" class="ty-row">
        <span>太乙分野</span>
        <strong>{{ d.fenye.taiyi.zhou }}（{{ d.fenye.taiyi.gua }}宫·{{ d.fenye.taiyi.men }}·{{ d.fenye.taiyi.qi }}）— {{ d.fenye.taiyi.omen }}</strong>
      </div>
      <div v-if="d.fenye && d.fenye.shiji" class="ty-row">
        <span>始击分野</span>
        <strong>{{ d.fenye.shiji.zhou }}（{{ d.fenye.shiji.gua }}宫·{{ d.fenye.shiji.men }}·{{ d.fenye.shiji.qi }}）— {{ d.fenye.shiji.omen }}</strong>
      </div>
      <div v-if="d.doors" class="ty-row"><span>值使八门</span><strong>{{ d.doors.door }}（{{ d.doors.jixiong }}）</strong></div>
      <div v-if="d.limitYun" class="ty-row">
        <span>大限 / 小限</span>
        <strong>太乙 {{ d.limitYun.daxian.at || '—' }}（{{ d.limitYun.daxian.span }}） · 文昌 {{ d.limitYun.xiaoxian.at || '—' }}（{{ d.limitYun.xiaoxian.span }}）</strong>
      </div>
      <div v-if="d.limitYun" class="ty-row">
        <span>二限</span>
        <strong>大游 {{ d.limitYun.erxian.dayou || '—' }} · 小游 {{ d.limitYun.erxian.xiaoyou || '—' }}</strong>
      </div>
      <div v-for="(it, k) in d.shenSuan || {}" :key="k" class="ty-row">
        <span>{{ k }}</span>
        <strong>{{ it ? `${it.value}　${(it.tags || []).join('、')}` : '—' }}</strong>
      </div>
    </div>

    <!-- 十精 -->
    <div v-if="d.shiJing" class="ty-card">
      <h3>十精（二目 · 八将）</h3>
      <div v-for="it in d.shiJing" :key="it.name" class="ty-row">
        <span>{{ it.name }}（{{ it.role }}）</span><strong>{{ it.at }}</strong>
      </div>
    </div>

    <!-- 十六宫 -->
    <div class="ty-card">
      <h3>十六宫标记</h3>
      <table class="ty-table">
        <thead><tr><th>宫</th><th>落神</th><th>主事</th></tr></thead>
        <tbody>
          <tr v-for="it in palaces16" :key="it.palace">
            <td class="ty-dim">{{ it.palace }}</td>
            <td>{{ it.items && it.items.length ? it.items.join('、') : '—' }}</td>
            <td class="ty-out">{{ shenMeaning(it.palace) || '—' }}</td>
          </tr>
          <tr v-if="centerPalace">
            <td class="ty-dim">中</td>
            <td>{{ centerPalace.items && centerPalace.items.length ? centerPalace.items.join('、') : '—' }}</td>
            <td class="ty-out">中宫</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 十二宫 -->
    <div class="ty-card">
      <h3>十二宫</h3>
      <table class="ty-table">
        <thead><tr><th>支</th><th>标记</th></tr></thead>
        <tbody>
          <tr v-for="it in p.branch12 || []" :key="it.branch">
            <td class="ty-dim">{{ it.branch }}</td>
            <td>{{ it.items && it.items.length ? it.items.join('、') : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 流派设置 -->
    <div v-if="!embedded" class="ty-card">
      <h3>流派设置（默认「从盘」，改则整盘重算）</h3>
      <div class="ty-school">
        <label v-for="(opts, k) in TAIYI_SCHOOL_OPTIONS" :key="k" class="ty-opt">
          {{ SCHOOL_LABELS[k] || k }}
          <select :value="school[k]" @change="setSchool(k, $event.target.value)">
            <option v-for="o in opts" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
      <div class="ty-note">
        · 流派覆盖为纯派生层：默认即内核现行盘，改动只影响计神/文昌/始击/主客算/三基/游神，不改立成表本体。
      </div>
      <div class="ty-note">· 「始击坐标」两式为实验项，存疑待源，默认不启用。</div>
    </div>

    <!-- 说明 -->
    <div class="ty-card">
      <h3>说明</h3>
      <div class="ty-note">· 积数按所选起盘方式与古法公式（统宗/金镜/淘金歌/太乙局）取常数，局式为积数对 72 取余。</div>
      <div class="ty-note">· 太乙落宫由太乙数派生；主客定算与主客大将同源立成表，不由几何法另算。</div>
      <div class="ty-note">· 十六神主事、九州分野、数理十类、格局九式均为古法通则在本地派生。</div>
      <div class="ty-note">· 命法（太乙命法）所需命宫/身宫/飞禄等分节数据原属后端 kintaiyi，本地内核未产，故命法页只给十二宫标记。</div>
    </div>
  </div>
</template>
