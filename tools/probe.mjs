/**
 * CDP 探针：在真实浏览器里执行一段 JS 并把结果打印出来。
 * 用于精确验证布局 / 计算样式，比看截图可靠。
 *
 * 用法：
 *   node tools/probe.mjs <url> "<js表达式>"
 * 例：
 *   node tools/probe.mjs http://localhost:5199/ "document.querySelectorAll('.gong').length"
 *   node tools/probe.mjs http://localhost:5199/ "JSON.stringify([...document.querySelectorAll('.field')].map(f=>({c:f.className,w:f.getBoundingClientRect().width|0})))"
 *
 * 依赖：本机 Edge（Windows）。node >= 22（全局 WebSocket）。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
]
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!EDGE) {
  console.error('未找到 Edge，请改用其它 Chromium 浏览器路径')
  process.exit(2)
}

const url = process.argv[2] || 'http://localhost:5199/'
const expr = process.argv[3] || 'document.title'
/** 第 4 个参数：窗口尺寸，如 "414,900"（默认桌面 1400,1000） */
const winSize = process.argv[4] || '1400,1000'
const port = 9333 + (process.pid % 500)

const child = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(process.env.TEMP || '.', 'edgeprobe' + port)}`,
  `--window-size=${winSize}`,
  url
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 等调试端口就绪 */
let list = null
for (let i = 0; i < 50; i++) {
  await sleep(300)
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`)
    if (r.ok) {
      list = await r.json()
      if (list.some((t) => t.type === 'page')) break
    }
  } catch {
    /* 端口未就绪，继续等 */
  }
}
if (!list) {
  child.kill()
  console.error('调试端口未就绪')
  process.exit(3)
}

/** 等 Vue 挂载完成 */
await sleep(2600)

const page = list.find((t) => t.type === 'page' && t.url.startsWith('http')) || list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true })
  ws.addEventListener('error', rej, { once: true })
})

let seq = 0
const send = (method, params) =>
  new Promise((res) => {
    const id = ++seq
    const h = (e) => {
      const d = JSON.parse(e.data)
      if (d.id === id) {
        ws.removeEventListener('message', h)
        res(d)
      }
    }
    ws.addEventListener('message', h)
    ws.send(JSON.stringify({ id, method, params }))
  })

/* 视口覆盖：CDP 精确模拟手机尺寸（--window-size 在部分平台受最小宽度限制，测不到真实窄屏） */
const [vwPx, vhPx] = winSize.split(',').map((n) => parseInt(n, 10))
if (vwPx > 0 && vhPx > 0) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vwPx,
    height: vhPx,
    deviceScaleFactor: 1,
    mobile: vwPx < 760
  })
  await sleep(500)
}

/**
 * 可选第 5 个参数：取样前先注入的 JS（典型用途 = 写 localStorage 里的配置）。
 * 注入后必须重载页面才会生效，故此处 reload 并重新等待 Vue 挂载。
 */
const injectExpr = process.argv[5] || ''
if (injectExpr) {
  await send('Runtime.evaluate', {
    expression: `(() => { try { return (${injectExpr}) } catch (e) { return 'ERR: ' + e.message } })()`,
    returnByValue: true
  })
  await send('Page.enable', {})
  await send('Page.reload', { ignoreCache: false })
  await sleep(2800)
}

const r = await send('Runtime.evaluate', {
  expression: `(() => { try { return (${expr}) } catch (e) { return 'ERR: ' + e.message } })()`,
  returnByValue: true,
  awaitPromise: true
})

const out = r.result?.result?.value
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2))
if (r.result?.exceptionDetails) console.error(r.result.exceptionDetails.text)

ws.close()
child.kill()
process.exit(0)
