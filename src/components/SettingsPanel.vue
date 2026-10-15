<script setup>
/**
 * 安星 / 显示设置面板
 * 全部开关对应源码 VARS 里的 cfg_* 持久化键（src/ziwei/config.js）
 */
import { ref } from 'vue'
import { CFG_META, CFG_GROUPS, CFG_AFFECT_PAN } from '../ziwei/config.js'

const props = defineProps({
  cfg: { type: Object, required: true }
})
const emit = defineEmits(['change', 'reset'])

const open = ref(false)

/**
 * 枚举项的可读标签
 * label 形如「星曜亮度流派：1=全书派(7级) 2=中州派(5级) …」，按 `n=` 切分取对应段
 */
function optionLabel(key, v) {
  const label = CFG_META[key]?.label || ''
  const keys = [...label.matchAll(/(\d+)=/g)].map((m) => m[1])
  const parts = label.split(/\s*\d+=/)
  const i = keys.indexOf(String(v))
  return i >= 0 && parts[i + 1] ? parts[i + 1].trim() : String(v)
}

/** 设置项名称（取 `n=` 之前的部分） */
function itemName(key) {
  const label = CFG_META[key]?.label || key
  return label.split(/\s*\d+=/)[0].replace(/[：:]\s*$/, '')
}

function onChange(key) {
  emit('change', key)
}
</script>

<template>
  <div class="panel settings">
    <div class="s-head" @click="open = !open">
      <span class="s-title">安星 / 显示设置</span>
      <span class="s-toggle">{{ open ? '收起 ▲' : '展开 ▼' }}</span>
    </div>

    <div v-show="open" class="s-body">
      <div v-for="grp in CFG_GROUPS" :key="grp.title" class="s-group">
        <div class="s-gtitle">{{ grp.title }}</div>
        <div class="s-items">
          <label
            v-for="k in grp.keys"
            :key="k"
            class="s-item"
            :title="CFG_META[k]?.label || k"
          >
            <span class="s-name">{{ itemName(k) }}</span>

            <!-- 布尔开关 -->
            <input
              v-if="CFG_META[k]?.type === 'bool'"
              type="checkbox"
              v-model="props.cfg[k]"
              @change="onChange(k)"
            />
            <!-- 枚举 / 数值 -->
            <select
              v-else
              v-model="props.cfg[k]"
              @change="onChange(k)"
            >
              <option
                v-for="o in CFG_META[k]?.options || []"
                :key="o"
                :value="o"
              >
                {{ optionLabel(k, o) }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <div class="s-foot">
        <button class="btn tiny" type="button" @click="emit('reset')">恢复默认</button>
        <span class="muted">
          改动带 ⚙ 的项会自动重新排盘。配置保存在浏览器 localStorage。
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: 10px 14px;
}

.s-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.s-title {
  font-family: var(--f-head);
  font-weight: 600;
  color: var(--accent);
  font-size: 13px;
}

.s-toggle {
  font-size: 12px;
  color: var(--ink-3);
}

.s-body {
  margin-top: 10px;
  border-top: 1px dashed var(--line-soft);
  padding-top: 10px;
}

.s-group {
  margin-bottom: 10px;
}

.s-gtitle {
  font-size: 12px;
  color: var(--ink-3);
  margin-bottom: 4px;
}

.s-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 4px 12px;
}

.s-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.s-name {
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s-item select {
  height: 24px;
  font-size: 12px;
  padding: 0 4px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
  color: var(--ink);
  max-width: 150px;
}

.s-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line-soft);
}
</style>
