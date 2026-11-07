/**
 * dsh-moren-unlimited — host half.
 *
 * Declares two agent presets (parent + unrestricted-child) to the live
 * agent-preset registry, serves the left-sidebar page API, and runs the
 * rollback auto-check. It never writes another plugin's files and never patches
 * dsh host sources, which is what lets dsh-purge and @linxin666/dsh-liangshen
 * stay enabled at the same time.
 */
import fs from 'node:fs'
import {
  CHILD_PRESET_ID,
  PARENT_PRESET_ID,
  PLUGIN_VERSION,
  ensureDir,
  morenHome,
  readJson,
  writeJson,
} from './lib/home.js'
import { buildPresetDefinitions } from './presets/moren/definition.mjs'
import { compatReport } from './lib/compat.js'
import {
  clearWallpaper,
  saveWallpaperSettings,
  uploadWallpaper,
  wallpaperFilePath,
  wallpaperStatus,
} from './lib/wallpaper.js'
import {
  createSnapshot,
  pruneSnapshots,
  repairRollback,
  restoreSnapshot,
  rollbackStatus,
  verifySnapshot,
} from './lib/snapshot.js'

export const name = 'moren-unlimited'
export const inject = ['systemPrompt']

const DEFAULTS = {
  enabled: true,
  announceToAgent: false,
  approvalNever: true,
  dispatcher: true,
  presentation: 'ptc',
  tokenGuardChars: 24000,
  autoRepairRollback: true,
  snapshotKeep: 20,
}

const ANNOUNCEMENT_ORDER = 151
const ANNOUNCEMENT = `本机已启用 dsh-moren-unlimited：新建会话的预设选择器里可选「Moren无限制梁神模式」（子预设「Moren无限制梁神模式 · 无限制子任务」供 subagent 使用）。该模式合并 dsh-purge 的无限制模式/无限制子任务与梁神模式：极简 persona + PTC 工具面 + 工具分页 + 事实登记 + 子任务路由守卫 + 深度 10 的子代理；会话内审批策略为 never。附加工具：moren_media_inspect（图片/视频识别与抽帧）、moren_image_generate（本地 PNG 生图）、moren_codec（编解码/哈希）、moren_token_audit（Token 估算与压缩）、moren_snapshot（回退快照）。超过阈值的工具输出会被自动折叠到 $DSH_HOME/moren/spill。左侧栏「Moren」入口提供状态、兼容、回退与教程。`

function resolveConfig(config) {
  const value = config && typeof config === 'object' ? config : {}
  const read = (key) => (value[key] && typeof value[key].get === 'function' ? value[key].get() : value[key])
  return {
    enabled: read('enabled') !== false,
    announceToAgent: read('announceToAgent') === true,
    approvalNever: read('approvalNever') !== false,
    dispatcher: read('dispatcher') !== false,
    presentation: read('presentation') === 'native' ? 'native' : 'ptc',
    tokenGuardChars: Math.max(0, Number(read('tokenGuardChars') ?? DEFAULTS.tokenGuardChars) || 0),
    autoRepairRollback: read('autoRepairRollback') !== false,
    snapshotKeep: Math.max(1, Number(read('snapshotKeep') ?? DEFAULTS.snapshotKeep) || DEFAULTS.snapshotKeep),
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function headerOf(request, name) {
  const value = request.headers?.[name]
  return Array.isArray(value) ? value.join(',') : String(value ?? '')
}

/** Same-origin guard for the page API (mirrors the pattern dsh-purge uses). */
function allowSameOrigin(request, response) {
  const site = headerOf(request, 'sec-fetch-site').toLowerCase()
  if (site === 'cross-site') { sendJson(response, 403, { ok: false, error: 'cross-site request refused' }); return false }
  const origin = headerOf(request, 'origin').trim()
  if (origin === 'null') { sendJson(response, 403, { ok: false, error: 'null origin refused' }); return false }
  if (!origin) return true
  let originHost = ''
  try { originHost = new URL(origin).host } catch { sendJson(response, 403, { ok: false, error: 'invalid origin' }); return false }
  const host = headerOf(request, 'host').trim()
  if (!host || originHost.toLowerCase() !== host.toLowerCase()) {
    sendJson(response, 403, { ok: false, error: 'origin mismatch' })
    return false
  }
  return true
}

async function readJsonBody(request, limit = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const presetState = { parentRegistered: false, childRegistered: false, error: null, at: null }
  let releaseParent
  let releaseChild
  let closed = false
  let queue = Promise.resolve()
  let generation = 0
  let registryMissing = false

  const state = () => {
    const stats = readJson(`${morenHome()}/token-stats.json`, { calls: 0, guarded: 0, deduped: 0, savedChars: 0, savedTokens: 0 })
    return {
      ...compatReport({ presetState, config }),
      wallpaper: wallpaperStatus(),
      tokenGuard: {
        thresholdChars: config.tokenGuardChars,
        ...stats,
        hitRate: stats.calls > 0 ? Math.round(((stats.guarded + stats.deduped) / stats.calls) * 1000) / 10 : 0,
      },
    }
  }

  const undeclare = async () => {
    const parent = releaseParent
    const child = releaseChild
    releaseParent = undefined
    releaseChild = undefined
    presetState.parentRegistered = false
    presetState.childRegistered = false
    for (const release of [parent, child]) {
      if (typeof release !== 'function') continue
      try { await release() } catch { /* a gone registry is not this plugin's failure */ }
    }
  }

  const declare = () => {
    const target = ++generation
    queue = queue.then(async () => {
      if (closed || target !== generation) return
      await undeclare()
      if (!config.enabled) {
        presetState.error = 'disabled by config'
        presetState.at = new Date().toISOString()
        return
      }
      let registry
      try { registry = ctx.get('agentPresets') } catch { registry = undefined }
      if (!registry) {
        registryMissing = true
        presetState.error = 'agentPresets registry unavailable'
        presetState.at = new Date().toISOString()
        ctx.logger?.warn?.('dsh-moren-unlimited: agent-preset registry unavailable; presets not declared')
        return
      }
      const definitions = buildPresetDefinitions({
        dispatcher: config.dispatcher,
        presentation: config.presentation,
        tokenGuardChars: config.tokenGuardChars,
        approvalNever: config.approvalNever,
        maxDepth: 10,
      })
      try {
        releaseChild = await registry.register(definitions.child)
        presetState.childRegistered = true
        releaseParent = await registry.register(definitions.parent)
        presetState.parentRegistered = true
        presetState.error = null
        presetState.at = new Date().toISOString()
        registryMissing = false
        ctx.logger?.info?.(`dsh-moren-unlimited: presets ${PARENT_PRESET_ID} + ${CHILD_PRESET_ID} declared`)
      } catch (error) {
        presetState.error = String(error?.message ?? error)
        presetState.at = new Date().toISOString()
        ctx.logger?.warn?.(`dsh-moren-unlimited: preset declaration failed: ${presetState.error}`)
        await undeclare()
      }
    }).catch((error) => {
      presetState.error = String(error?.message ?? error)
      ctx.logger?.warn?.(`dsh-moren-unlimited: declaration queue failed: ${presetState.error}`)
    })
  }

  // Announcement is opt-in and harmless for other presets (the merged preset's
  // minimal-prompt keeps only the persona section).
  let disposeSection
  const syncAnnouncement = () => {
    disposeSection?.()
    disposeSection = undefined
    if (!config.announceToAgent) return
    disposeSection = ctx.systemPrompt.section({
      name: 'plugin:dsh-moren-unlimited',
      order: ANNOUNCEMENT_ORDER,
      text: ANNOUNCEMENT,
    })
  }

  // Belt-and-braces: the preset-local moren-policy row sets approval `never`
  // inside the preset scope; this host listener catches the same event at the
  // root for agents whose session already records one of our presets.
  ctx.on('agent/created', ({ agent }) => {
    try {
      if (!config.approvalNever) return
      const registry = ctx.get('agentPresets')
      const id = registry?.presetForSession?.(agent.session)
      if (id !== PARENT_PRESET_ID && id !== CHILD_PRESET_ID) return
      ctx.get('approval')?.setPolicy?.(agent, 'never')
    } catch { /* optional services */ }
  })

  ctx.inject(['agentPresets'], () => {
    if (registryMissing) declare()
  })
  ctx.on('loader/volatile-update', () => { syncAnnouncement(); declare() })
  ctx.effect(() => {
    syncAnnouncement()
    declare()
    return async () => {
      closed = true
      generation += 1
      disposeSection?.()
      disposeSection = undefined
      await queue
      await undeclare()
    }
  }, 'dsh-moren-unlimited: preset declarations')

  // Keep the page API on the host: the browser calls it with same-origin fetch.
  const api = async (request, response) => {
    if (!allowSameOrigin(request, response)) return
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'cache-control': 'no-store' })
      response.end()
      return
    }
    try {
      const url = new URL(request.url ?? '', 'http://127.0.0.1')
      const body = request.method === 'POST' ? await readJsonBody(request, 32 * 1024 * 1024) : {}
      const op = String(body.op ?? url.searchParams.get('op') ?? 'status')
      let payload
      switch (op) {
        case 'status': payload = state(); break
        case 'snapshot': payload = createSnapshot({ reason: 'page', label: body.label ?? 'page' }); break
        case 'verify': payload = body.id ? verifySnapshot(String(body.id)) : rollbackStatus({ force: true }); break
        case 'restore': payload = restoreSnapshot(String(body.id ?? '')); break
        case 'repair': payload = repairRollback(); break
        case 'prune': payload = pruneSnapshots(Number(body.keep ?? config.snapshotKeep)); break
        case 'wallpaper': payload = wallpaperStatus(); break
        case 'wallpaper-upload': payload = uploadWallpaper(body); break
        case 'wallpaper-settings': payload = saveWallpaperSettings(body); break
        case 'wallpaper-clear': payload = clearWallpaper(); break
        case 'stats': payload = state().tokenGuard; break
        case 'client': {
          let graph
          let clientPath
          try { graph = ctx.get('clientModules')?.graph?.() } catch { graph = undefined }
          try { clientPath = ctx.get('clientModules')?.clientPath?.('dsh-moren-unlimited') } catch { clientPath = undefined }
          const entry = graph?.entries?.find?.((row) => row.id === 'dsh-moren-unlimited')
          payload = {
            ok: true,
            registered: Boolean(entry),
            entry: entry ?? null,
            clientPath: clientPath ?? null,
            batches: (graph?.batches ?? []).filter((batch) => (batch.entries ?? []).includes('dsh-moren-unlimited')).length,
          }
          break
        }
        case 'redeclare': declare(); await queue; payload = { ok: true, presetState, status: state() }; break
        case 'presets': {
          const registry = ctx.get('agentPresets')
          const list = registry ? await registry.list() : []
          const inventory = registry ? await registry.compositionInventory() : []
          const ids = new Set([PARENT_PRESET_ID, CHILD_PRESET_ID])
          payload = {
            ok: true,
            presets: list.map((preset) => ({ id: preset.id, name: preset.name, status: preset.status ?? preset.state ?? null })),
            ours: inventory.filter((entry) => ids.has(entry.id)).map((entry) => ({
              id: entry.id,
              name: entry.name,
              isDefault: entry.isDefault,
              broken: entry.broken ?? null,
              rows: entry.rows?.length ?? 0,
            })),
          }
          break
        }
        case 'open-docs': payload = { ok: true, docs: { readme: 'README.md', install: 'docs/INSTALL.zh.md', usage: 'docs/USAGE.zh.md', rollback: 'docs/ROLLBACK.zh.md' } }; break
        default: payload = { ok: false, error: `unknown op: ${op}` }
      }
      sendJson(response, payload?.ok === false ? 400 : 200, payload ?? { ok: true })
    } catch (error) {
      sendJson(response, 500, { ok: false, error: String(error?.message ?? error) })
    }
  }

  ctx.inject(['webServer'], (host) => {
    host.effect(() => host.webServer.register({ kind: 'prefix', path: '/dsh-moren/api', handler: api }))
    host.effect(() => host.webServer.register({ kind: 'prefix', path: '/dsh-moren/wallpaper', handler: async (request, response) => {
      if (!allowSameOrigin(request, response)) return
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' })
        response.end()
        return
      }
      const url = new URL(request.url ?? '', 'http://127.0.0.1')
      const file = decodeURIComponent(url.pathname.slice('/dsh-moren/wallpaper/'.length))
      const found = wallpaperFilePath(file)
      if (!found) {
        response.writeHead(404, { 'cache-control': 'no-store' })
        response.end()
        return
      }
      response.writeHead(200, {
        'content-type': found.mime,
        'content-length': fs.statSync(found.abs).size,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      })
      if (request.method === 'HEAD') {
        response.end()
        return
      }
      fs.createReadStream(found.abs).pipe(response)
    } }))
  })

  // Rollback auto-check: if the local rollback exists but is unusable, quarantine
  // the damaged snapshot and lay down a healthy baseline (the "replace" path).
  if (config.autoRepairRollback) {
    queueMicrotask(async () => {
      try {
        const status = rollbackStatus()
        const report = status.healthy ? { ok: true, healthy: true, checked_at: new Date().toISOString() } : repairRollback()
        ensureDir(morenHome())
        writeJson(`${morenHome()}/auto-check.json`, {
          at: new Date().toISOString(),
          healthy: status.healthy,
          repaired: Boolean(report.repaired),
          baseline: report.baseline ?? status.newest?.id ?? null,
          purge_backups: status.purge?.backup_files ?? 0,
        })
      } catch (error) {
        ctx.logger?.warn?.(`dsh-moren-unlimited: rollback auto-check failed: ${String(error?.message ?? error)}`)
      }
    })
  }

  ctx.logger?.info?.(`dsh-moren-unlimited ${PLUGIN_VERSION} loaded`)
}
