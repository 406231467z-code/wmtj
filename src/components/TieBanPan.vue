<script setup>
/**
 * 铁板神数 · 盘面
 *
 * 由 horosa 的 components/shusuan/ZhengChuanMain.js 里 renderTieban() 一支移植
 * （原为 React + antd 正传多流派页的中栏 + 右栏）。这里单栏呈现全部内容：
 *   本命推算流程 / 本命结论 / 本命条文 / 流年总纲 / 流年条文（108 年）/ 说明
 * 并保留「求测时辰」可调（古籍以时柱为默认，改它会整盘重算）。
 *
 * 算法内核在 src/tieban/tiebanLocal.js（原样搬入），条文库 465KB 按需动态加载。
 */
import { computed, onMounted, ref } from 'vue'
import { buildTiebanModel, buildTiebanText, loadTiebanVerses, GZ60 } from '../tieban/tieban'

const props = defineProps({
  pan: { type: Object, default: null },
  bazi: { type: Object, default: null },
  sex: { type: [Number, String], default: 1 },
})

/** 求测时辰：留空 = 用本人时柱（古籍默认） */
const askGz = ref('')

const model = computed(() =>
  buildTiebanModel({
    pan: props.pan,
    bazi: props.bazi,
    sex: props.sex,
    askGz: askGz.value || undefined,
  })
)

const b = computed(() => (model.value ? model.value.result.benming : null))
const ln = computed(() => (model.value ? model.value.result.liunian : null))
const currentAsk = computed(() => (model.value ? model.value.askGz : ''))

// ---------- 条文库（465KB，按需加载）----------
const verses = ref(null)
const verseState = ref('条文库载入中…')
onMounted(async () => {
  try {
    verses.value = await loadTiebanVerses()
    verseState.value = `条文库已载入（${Object.keys(verses.value).length} 条）`
  } catch (e) {
    verseState.value = '条文库载入失败，条文号仍可查看'
  }
})
/** 条文号 → 正文 */
function verse(n) {
  if (n === null || n === undefined) return ''
  if (!verses.value) return '…'
  return verses.value[String(n)] || '（此条正文原书未收）'
}

// 本命条文：按字段展开成「名称 条号 → 正文」
const benmingRows = computed(() => {
  const items = (b.value && b.value.items) || {}
  const rows = []
  Object.keys(items).forEach((k) => {
    const it = items[k]
    if (it.skipped) {
      rows.push({ key: k, num: null, text: it.reason })
      return
    }
    const nums = it.nums || []
    if (!nums.length) {
      rows.push({ key: k, num: null, text: '（无条文）' })
      return
    }
    nums.forEach((n) => rows.push({ key: k, num: n, text: verse(n) }))
  })
  return rows
})

// ---------- 一键复制 ----------
const snapInfo = ref('')

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

/**
 * 复制全部：本命推算流程 + 本命结论 + 本命条文 +
 * 流年总纲 + 流年条文（1~108 岁全）+ 说明，与盘面内容一一对应。
 * 条文库尚未载入时先补载，避免复制出只有条号的文本。
 */
async function copyAll() {
  const m = model.value
  if (!m) return
  if (!verses.value) {
    try {
      verses.value = await loadTiebanVerses()
      verseState.value = `条文库已载入（${Object.keys(verses.value).length} 条）`
    } catch (e) {
      verseState.value = '条文库载入失败，条文号仍可查看'
    }
  }
  const text = buildTiebanText(m, verses.value)
  if (!text) return
  const ok = await putClipboard(text)
  snapInfo.value = ok ? `已复制 ${text.length} 字符` : `已生成 ${text.length} 字符（剪贴板不可用，请手动选取）`
  setTimeout(() => { snapInfo.value = '' }, 3000)
}
</script>

<template>
  <div v-if="!model" class="tb-empty">
    请先填写出生资料并排盘。铁板神数需要四柱干支与农历月日，四柱不全时无法起数。
  </div>

  <div v-else class="tb">
    <!-- 概况 + 求测时辰 -->
    <div class="tb-bar">
      <span class="tb-kv">
        四柱
        <b>{{ model.fourPillars.join(' ') }}</b>
      </span>
      <span class="tb-kv">
        农历
        <b>{{ model.lunar.month }}月{{ model.lunar.day }}日{{ model.lunar.isLeapMonth ? '（闰）' : '' }}</b>
      </span>
      <span class="tb-kv">{{ model.gender }}命</span>
      <label class="tb-ask">
        求测时辰
        <select :value="currentAsk" @change="askGz = $event.target.value">
          <option v-for="g in GZ60" :key="g" :value="g">{{ g }}</option>
        </select>
        <span v-if="!askGz" class="tb-hint">（默认本人时柱）</span>
        <button v-else class="btn tiny" type="button" title="恢复为本人时柱" @click="askGz = ''">
          复原
        </button>
      </label>
      <button
        class="btn tiny primary"
        type="button"
        title="本命推算流程 + 本命结论 + 本命条文 + 流年总纲 + 流年条文（1~108 岁全）+ 说明"
        @click="copyAll"
      >
        复制全部结果
      </button>
      <span v-if="snapInfo" class="tb-snapinfo">{{ snapInfo }}</span>
      <span class="tb-hint">{{ verseState }}</span>
    </div>

    <!-- ═══ 本命推算流程 ═══ -->
    <div class="tb-card">
      <h3>本命推算流程</h3>
      <table class="tb-table tb-flow">
        <thead>
          <tr><th>步骤</th><th>输入</th><th>依据</th><th>结果</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in b.steps" :key="s.key">
            <td class="tb-step" data-label="步骤">{{ s.label }}</td>
            <td data-label="输入">{{ s.input }}</td>
            <td class="tb-dim" data-label="依据">{{ s.table }}</td>
            <td class="tb-out" data-label="结果">{{ s.output !== undefined ? s.output : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══ 本命结论 ═══ -->
    <div class="tb-card">
      <h3>本命结论</h3>
      <div class="tb-row"><span>考刻</span><strong>{{ b.ke }}</strong></div>
      <div class="tb-row"><span>本命数</span><strong>{{ b.benMingShu }}</strong></div>
      <div class="tb-row">
        <span>十二辟卦</span>
        <strong>{{ b.biGua || '（本命数超出古籍所载范围）' }}</strong>
      </div>
      <div class="tb-row">
        <span>辟卦基数＋序数</span>
        <strong>{{ b.base != null ? `${b.base} ＋ ${b.xuShu}` : '—' }}</strong>
      </div>
    </div>

    <!-- ═══ 本命条文 ═══ -->
    <div class="tb-card">
      <h3>本命条文</h3>
      <div v-if="!benmingRows.length" class="tb-none">暂无条文</div>
      <div v-for="(r, i) in benmingRows" :key="i" class="tb-verse">
        <span class="tb-tag">{{ r.key }}<b v-if="r.num != null">{{ r.num }}</b></span>
        <span class="tb-verse-text">{{ r.text }}</span>
      </div>
    </div>

    <!-- ═══ 流年总纲 ═══ -->
    <div v-if="ln" class="tb-card">
      <h3>流年总纲</h3>
      <div class="tb-row"><span>天四声（12 年一循环）</span><strong>{{ ln.seq.join(' ') }}</strong></div>
      <div class="tb-row"><span>后天命数</span><strong>{{ ln.houTian }}</strong></div>
      <div class="tb-row"><span>年支三合局</span><strong>{{ ln.zhiGroup }}</strong></div>
      <div class="tb-row"><span>覆盖</span><strong>{{ ln.rows.length }} 年（1~{{ ln.rows.length }}）</strong></div>
    </div>

    <!-- ═══ 流年条文（108 年） ═══ -->
    <div v-if="ln" class="tb-card">
      <h3>流年条文（{{ ln.rows.length }} 年全）</h3>
      <table class="tb-table tb-ln">
        <thead>
          <tr><th>岁</th><th>干支</th><th>天四声</th><th>条文号</th><th>条文</th></tr>
        </thead>
        <tbody>
          <tr v-for="x in ln.rows" :key="x.age">
            <td>{{ x.age }}</td>
            <td>{{ x.gz }}</td>
            <td class="tb-dim">{{ x.tianSiSheng }}</td>
            <td class="tb-out">{{ x.missing ? '—' : x.num }}</td>
            <td>
              <span v-if="x.missing" class="tb-dim">古籍原缺此格</span>
              <span v-else>{{ verse(x.num) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══ 说明 ═══ -->
    <div v-if="b.notes && b.notes.length" class="tb-card">
      <h3>说明</h3>
      <div v-for="(n, i) in b.notes" :key="i" class="tb-note">· {{ n }}</div>
    </div>
  </div>
</template>
