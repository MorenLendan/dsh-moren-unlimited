/**
 * The rollback layer.
 *
 * DSH has two kinds of "回退" in play here:
 *   1. dsh-purge's host-patch backups, `.dshpurge.bak` files next to patched
 *      host sources. They are the only way to restore purge's host patches.
 *   2. This plugin's own profile snapshot: the files a user or an agent can
 *      actually break while composing modes — the profile patch, the profile
 *      manifest, prompt-inject.md, installed agent presets, and purge's override
 *      state.
 *
 * The snapshot is content-addressed and verifiable without restoring: every
 * file carries size + SHA-256, and verification also test-restores into a
 * throwaway directory and checks the destination is writable. `repair()`
 * quarantines a damaged snapshot instead of deleting it and lays down a fresh
 * healthy baseline, so an unusable local rollback is replaced rather than
 * silently reported as present.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  copyFileAtomic,
  dshHome,
  ensureDir,
  exists,
  morenHome,
  profileDir,
  purgeHostBackupCount,
  readJson,
  sha256,
  writeJson,
} from './home.js'

const SNAPSHOT_VERSION = 1
const ID_RE = /^[0-9A-Za-z._-]{8,120}$/

function invalidateStatusCache() {
  statusCache = { at: 0, value: null }
}

export function snapshotsRoot() {
  return path.join(morenHome(), 'snapshots')
}

export function stateFile() {
  return path.join(morenHome(), 'rollback-state.json')
}

/** The files worth restoring; missing optional files are recorded, not fatal. */
export function snapshotTargets() {
  const home = dshHome()
  const profile = profileDir()
  const targets = [
    { rel: 'prompt-inject.md', abs: path.join(home, 'prompt-inject.md'), kind: 'prompt' },
    { rel: 'dsh-purge/override-state.json', abs: path.join(home, 'dsh-purge', 'override-state.json'), kind: 'purge' },
  ]
  for (const name of ['cordis.patch.yml', 'package.json', 'cordis.yml', 'pnpm-workspace.yaml']) {
    targets.push({ rel: `profile/${name}`, abs: path.join(profile, name), kind: 'profile' })
  }
  const presets = path.join(home, '.agent-presets')
  let entries = []
  try { entries = fs.readdirSync(presets, { withFileTypes: true }) } catch { /* no presets */ }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    for (const file of ['agent.cordis.yml', 'preset.yml']) {
      const abs = path.join(presets, entry.name, file)
      if (exists(abs)) targets.push({ rel: `agent-presets/${entry.name}/${file}`, abs, kind: 'preset' })
    }
  }
  return targets
}

function absFor(rel) {
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`unsafe snapshot path: ${rel}`)
  const home = dshHome()
  const abs = path.join(home, rel)
  if (!abs.startsWith(home + path.sep)) throw new Error(`snapshot path escapes DSH_HOME: ${rel}`)
  return abs
}

function newId(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-')
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`
}

function safeLabel(label) {
  return String(label ?? '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]+/g, '-').slice(0, 60) || 'manual'
}

/**
 * Create one snapshot. The manifest is written last with `complete: true`, so
 * a crash mid-copy leaves an obviously incomplete directory that `repair()`
 * will quarantine.
 */
export function createSnapshot({ reason = 'manual', label = '' } = {}) {
  const id = newId()
  const dir = path.join(snapshotsRoot(), id)
  ensureDir(dir)
  const targets = snapshotTargets()
  const files = []
  const missing = []
  for (const target of targets) {
    if (!exists(target.abs)) { missing.push(target.rel); continue }
    const stat = fs.lstatSync(target.abs)
    if (!stat.isFile()) { missing.push(target.rel); continue }
    const stored = path.join(dir, 'files', target.rel)
    fs.mkdirSync(path.dirname(stored), { recursive: true, mode: 0o700 })
    fs.copyFileSync(target.abs, stored)
    try { fs.chmodSync(stored, stat.mode & 0o777) } catch { /* ignore */ }
    const bytes = fs.readFileSync(stored)
    files.push({
      rel: target.rel,
      kind: target.kind,
      bytes: bytes.length,
      sha256: sha256(bytes),
      mode: stat.mode & 0o777,
    })
  }
  const manifest = {
    version: SNAPSHOT_VERSION,
    id,
    complete: true,
    created_at: new Date().toISOString(),
    reason,
    label: safeLabel(label),
    profile: profileDir(),
    dsh_home: dshHome(),
    host: { platform: process.platform, arch: process.arch, node: process.version, hostname: os.hostname() },
    files,
    missing,
  }
  writeJson(path.join(dir, 'manifest.json'), manifest)
  writeJson(stateFile(), {
    last_snapshot: id,
    last_snapshot_at: manifest.created_at,
    last_reason: reason,
    ok: true,
    updated_at: new Date().toISOString(),
  })
  invalidateStatusCache()
  return { ok: true, id, dir, manifest }
}

export function listSnapshots() {
  const root = snapshotsRoot()
  let entries = []
  try { entries = fs.readdirSync(root, { withFileTypes: true }) } catch { return [] }
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.includes('.broken'))
    .map((entry) => {
      const dir = path.join(root, entry.name)
      const manifest = readJson(path.join(dir, 'manifest.json'))
      let bytes = 0
      try { bytes = directoryBytes(dir) } catch { /* ignore */ }
      return {
        id: entry.name,
        dir,
        manifest,
        complete: manifest?.complete === true,
        created_at: manifest?.created_at ?? null,
        reason: manifest?.reason ?? null,
        label: manifest?.label ?? null,
        files: manifest?.files?.length ?? 0,
        missing: manifest?.missing?.length ?? 0,
        bytes,
      }
    })
    .sort((a, b) => String(b.created_at ?? b.id).localeCompare(String(a.created_at ?? a.id)))
}

function directoryBytes(dir) {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) total += directoryBytes(full)
    else if (entry.isFile()) total += fs.statSync(full).size
  }
  return total
}

function writableTarget(abs) {
  let current = path.dirname(abs)
  while (!exists(current)) {
    const next = path.dirname(current)
    if (next === current) return false
    current = next
  }
  try { fs.accessSync(current, fs.constants.W_OK); return true } catch { return false }
}

/**
 * Verify a snapshot without touching live state: manifest shape, every hash,
 * a real test restore into a temp directory, and destination writability.
 */
export function verifySnapshot(id, { deep = true } = {}) {
  const checks = []
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail })
  if (!ID_RE.test(String(id ?? ''))) {
    return { ok: false, id, checks: [{ name: 'id', ok: false, detail: 'invalid snapshot id' }], errors: ['invalid snapshot id'] }
  }
  const dir = path.join(snapshotsRoot(), id)
  const manifestPath = path.join(dir, 'manifest.json')
  add('manifest', exists(manifestPath), manifestPath)
  const manifest = readJson(manifestPath)
  if (!manifest) {
    return { ok: false, id, checks, errors: ['manifest missing or unreadable'] }
  }
  add('complete', manifest.complete === true, String(manifest.complete))
  add('version', manifest.version === SNAPSHOT_VERSION, `v${manifest.version}`)
  add('id-match', manifest.id === id, String(manifest.id))
  const errors = []
  for (const file of manifest.files ?? []) {
    let abs
    try { abs = path.join(dir, 'files', file.rel) } catch { abs = '' }
    const storedExists = abs !== '' && exists(abs)
    let ok = storedExists
    let detail = file.rel
    if (storedExists) {
      const bytes = fs.readFileSync(abs)
      ok = bytes.length === file.bytes && sha256(bytes) === file.sha256
      detail = `${file.rel} (${bytes.length}B)`
    }
    if (!ok) errors.push(`snapshot file mismatch: ${file.rel}`)
    add('file', ok, detail)
    let target
    try { target = absFor(file.rel) } catch (error) { add('target-path', false, String(error.message)); continue }
    const canWrite = writableTarget(target)
    add('target-writable', canWrite, file.rel)
    if (!canWrite) errors.push(`target not writable: ${file.rel}`)
  }
  add('files-present', (manifest.files ?? []).length > 0, String((manifest.files ?? []).length))
  if (deep) {
    const scratch = path.join(morenHome(), 'verify', `${id}-${Date.now()}`)
    try {
      let restored = 0
      for (const file of manifest.files ?? []) {
        const source = path.join(dir, 'files', file.rel)
        if (!exists(source)) continue
        const target = path.join(scratch, file.rel)
        ensureDir(path.dirname(target))
        fs.copyFileSync(source, target)
        const bytes = fs.readFileSync(target)
        if (sha256(bytes) !== file.sha256) throw new Error(`test restore mismatch: ${file.rel}`)
        restored += 1
      }
      add('test-restore', restored === (manifest.files ?? []).length, `${restored}/${(manifest.files ?? []).length}`)
      if (restored !== (manifest.files ?? []).length) errors.push('test restore incomplete')
    } catch (error) {
      add('test-restore', false, String(error?.message ?? error))
      errors.push(`test restore failed: ${String(error?.message ?? error)}`)
    } finally {
      try { fs.rmSync(scratch, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
  return { ok: errors.length === 0, id, created_at: manifest.created_at, checks, errors, manifest }
}

/** Restore a snapshot after a full verification; the pre-restore state is kept. */
export function restoreSnapshot(id) {
  const verification = verifySnapshot(id, { deep: true })
  if (!verification.ok) {
    return { ok: false, id, error: '快照未通过校验，已拒绝恢复', verification }
  }
  const pre = createSnapshot({ reason: `pre-restore:${id}`, label: 'pre-restore' })
  const restored = []
  for (const file of verification.manifest.files ?? []) {
    const source = path.join(snapshotsRoot(), id, 'files', file.rel)
    const target = absFor(file.rel)
    copyFileAtomic(source, target)
    restored.push({ rel: file.rel, bytes: file.bytes, sha256: file.sha256 })
  }
  const result = {
    ok: true,
    id,
    restored,
    pre_snapshot: pre.id,
    restoredAt: new Date().toISOString(),
  }
  writeJson(stateFile(), {
    last_restore: id,
    last_restore_at: result.restoredAt,
    pre_snapshot: pre.id,
    ok: true,
    updated_at: result.restoredAt,
  })
  invalidateStatusCache()
  return result
}

/** Latest healthy snapshot, or undefined. */
export function newestHealthy() {
  for (const item of listSnapshots()) {
    const verification = verifySnapshot(item.id, { deep: false })
    if (verification.ok) return { item, verification }
  }
  return undefined
}

/**
 * Auto-detect and repair: quarantine unreadable/damaged snapshots, ensure one
 * healthy baseline exists, and record the result. Returns a machine-readable
 * report for the page.
 */
export function repairRollback() {
  ensureDir(snapshotsRoot())
  const quarantined = []
  for (const item of listSnapshots()) {
    const check = verifySnapshot(item.id, { deep: false })
    if (check.ok) continue
    const target = `${item.dir}.broken-${Date.now()}`
    try {
      fs.renameSync(item.dir, target)
      quarantined.push({ id: item.id, movedTo: target, errors: check.errors.slice(0, 4) })
    } catch (error) {
      quarantined.push({ id: item.id, error: String(error?.message ?? error) })
    }
  }
  const healthy = newestHealthy()
  let baseline = null
  if (!healthy) baseline = createSnapshot({ reason: 'auto-repair-baseline', label: 'auto-repair' })
  const purge = purgeHostBackupCount({ force: true })
  const report = {
    ok: true,
    repaired: quarantined.length > 0 || Boolean(baseline),
    quarantined,
    baseline: baseline?.id ?? healthy?.item.id ?? null,
    purge,
    checked_at: new Date().toISOString(),
  }
  writeJson(stateFile(), {
    last_repair_at: report.checked_at,
    repaired: report.repaired,
    baseline: report.baseline,
    quarantined: quarantined.length,
    purge_backups: purge.count,
    ok: true,
    updated_at: report.checked_at,
  })
  invalidateStatusCache()
  return report
}

export function pruneSnapshots(keep = 20) {
  const limit = Math.max(1, Math.min(200, Number(keep) || 20))
  const items = listSnapshots()
  const removed = []
  for (const item of items.slice(limit)) {
    try {
      fs.rmSync(item.dir, { recursive: true, force: true })
      removed.push(item.id)
    } catch (error) {
      removed.push(`${item.id}: ${String(error?.message ?? error)}`)
    }
  }
  invalidateStatusCache()
  return { ok: true, keep: limit, removed, remaining: listSnapshots().length }
}

let statusCache = { at: 0, value: null }

/** The full rollback status shown in the sidebar page. */
export function rollbackStatus({ force = false } = {}) {
  if (!force && statusCache.value && Date.now() - statusCache.at < 30_000) return statusCache.value
  const items = listSnapshots()
  const newest = items[0]
  const newestCheck = newest ? verifySnapshot(newest.id, { deep: true }) : null
  const purge = purgeHostBackupCount()
  const state = readJson(stateFile())
  const value = {
    ok: true,
    dir: snapshotsRoot(),
    writable: writableTarget(path.join(snapshotsRoot(), '.probe')),
    snapshots: items.slice(0, 30).map((item) => ({
      id: item.id,
      created_at: item.created_at,
      reason: item.reason,
      label: item.label,
      files: item.files,
      missing: item.missing,
      bytes: item.bytes,
      complete: item.complete,
    })),
    count: items.length,
    newest: newest
      ? { id: newest.id, created_at: newest.created_at, healthy: newestCheck?.ok === true, errors: newestCheck?.errors ?? [] }
      : null,
    healthy: newestCheck?.ok === true,
    checks: newestCheck?.checks ?? [],
    purge: {
      backup_files: purge.count,
      available: purge.count > 0,
      root: purge.root,
      hint: purge.count > 0 ? 'dsh-purge 宿主补丁备份存在' : 'dsh-purge 宿主补丁备份为空（无 .dshpurge.bak）',
    },
    state,
    checked_at: new Date().toISOString(),
  }
  statusCache = { at: Date.now(), value }
  return value
}
