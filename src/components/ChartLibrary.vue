<script setup>
/**
 * 命盘库：已保存命盘的列表 / 搜索 / 打开 / 删除
 *
 * 列表里每条只显示基本信息（姓名、出生时间、性别、更新时间），
 * 点一下即用该信息重新排盘 —— 命盘库本身不存排盘结果。
 */
import { computed, ref } from 'vue'
import { sortCharts } from '../ziwei/store.js'

const props = defineProps({
  charts: { type: Array, default: () => [] },
  /** 当前打开的命盘 id（'' = 临时未保存） */
  activeId: { type: String, default: '' }
})

const emit = defineEmits(['open', 'remove', 'new'])

const kw = ref('')
/** 待确认删除的 id（点一次「删除」变成「确认 / 取消」，避免误删） */
const pendingId = ref('')

const list = computed(() => {
  const k = kw.value.trim().toLowerCase()
  const arr = props.charts.filter((c) => !k || String(c.name || '').toLowerCase().includes(k))
  return sortCharts(arr)
})

const p2 = (n) => String(n ?? 0).padStart(2, '0')

/** 出生时间一行：公历 1990-06-15 12:00；农历 1990-闰05-23 12:00 */
function timeText(c) {
  const cal = c.calendar === 'lunar' ? '农历' : '公历'
  // 闰月是「哪一个月」的属性，要跟月份在一起，不能插到月和日中间（旧写法会输出 1990-06-闰15）
  const leap = c.calendar === 'lunar' && c.isLeap ? '闰' : ''
  return `${cal} ${c.year}-${leap}${p2(c.month)}-${p2(c.day)} ${p2(c.hour)}:${p2(c.minute)}`
}

/** 更新时间 */
function whenText(c) {
  const t = c.updatedAt || c.createdAt || 0
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

function onRemove(c) {
  if (pendingId.value !== c.id) {
    pendingId.value = c.id
    return
  }
  pendingId.value = ''
  emit('remove', c.id)
}

function cancelRemove() {
  pendingId.value = ''
}
</script>

<template>
  <div class="panel chart-lib">
    <h3>
      <span class="cl-title">我的命盘</span>
      <span class="cl-meta">共 {{ charts.length }} 个 · 最近更新在前</span>
      <button class="btn tiny primary" type="button" @click="emit('new')">+ 新建</button>
    </h3>

    <div v-if="charts.length" class="cl-search">
      <input v-model="kw" type="search" placeholder="按姓名查找…" />
      <button v-if="kw" class="btn tiny" type="button" @click="kw = ''">清除</button>
    </div>

    <p v-if="!charts.length" class="cl-empty">
      还没有保存的命盘。填好上方资料后点「保存命盘」，就会留存在这里（只存基本信息，刷新不丢）。
    </p>
    <p v-else-if="!list.length" class="cl-empty">没有匹配「{{ kw }}」的命盘。</p>

    <ul v-else class="cl-list">
      <li
        v-for="c in list"
        :key="c.id"
        class="cl-row"
        :class="{ active: c.id === activeId, pending: pendingId === c.id }"
      >
        <button class="cl-main" type="button" @click="emit('open', c.id)">
          <span class="cl-name">
            {{ c.name }}
            <em v-if="c.id === activeId" class="cl-badge">当前</em>
          </span>
          <span class="cl-time">{{ timeText(c) }}</span>
          <span class="cl-sex">{{ c.sex === 2 ? '女' : '男' }}</span>
          <span class="cl-when">{{ whenText(c) }}</span>
        </button>

        <template v-if="pendingId === c.id">
          <button class="btn tiny danger" type="button" @click="onRemove(c)">确认删除</button>
          <button class="btn tiny" type="button" @click="cancelRemove">取消</button>
        </template>
        <button v-else class="btn tiny" type="button" @click="onRemove(c)">删除</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.chart-lib h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cl-title {
  font-size: 14px;
  color: #6b4b2a;
}

.cl-meta {
  font-size: 12px;
  color: #8a7f6d;
}

.chart-lib h3 .btn.tiny {
  margin-left: auto;
}

.cl-search {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}

.cl-search input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid #cfc5b0;
  border-radius: 4px;
  font-size: 13px;
  background: #fff;
  color: #3a3a3a;
}

.cl-empty {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #8a7f6d;
}

.cl-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.cl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
}

.cl-row + .cl-row {
  border-top: 1px dotted #e2d9c8;
}

.cl-row:hover {
  background: #faf6ec;
}

.cl-row.active {
  background: #fdf3e0;
}

.cl-row.pending {
  background: #fbecea;
}

.cl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 2px;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.cl-name {
  font-weight: 700;
  color: #3a3a3a;
  white-space: nowrap;
}

.cl-badge {
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 2px;
  background: #b0432f;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
  vertical-align: 1px;
}

.cl-time {
  color: #2f5d8a;
  font-size: 12.5px;
  white-space: nowrap;
}

.cl-sex,
.cl-when {
  color: #8a7f6d;
  font-size: 12px;
  white-space: nowrap;
}

.cl-when {
  margin-left: auto;
}

@media (max-width: 640px) {
  .cl-main {
    flex-wrap: wrap;
    gap: 4px 10px;
  }

  .cl-when {
    margin-left: 0;
  }
}
</style>
