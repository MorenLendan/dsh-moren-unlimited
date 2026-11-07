/**
 * Filesystem facts shared by the host half, the preset tools and the page API.
 * Pure Node builtins; nothing here imports a Harness package, so the module is
 * safe to load from a preset row and from the host process alike.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const PLUGIN_NAME = 'dsh-moren-unlimited'
export const PLUGIN_VERSION = '2.0.2'
export const PARENT_PRESET_ID = 'moren-unlimited-liangshen'
export const CHILD_PRESET_ID = 'moren-unlimited-liangshen-child'
export const PARENT_PRESET_NAME = 'Moren无限制梁神模式'
export const CHILD_PRESET_NAME = 'Moren无限制梁神模式 · 无限制子任务'
export const PANEL_ID = 'moren-unlimited'

/** DSH home: the same root the CLI and dsh-purge use. */
export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

/** The active profile directory (web by default). */
export function profileDir() {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR
  let profile = process.env.DSH_PROFILE
  if (!profile) {
    // A host booted as `dsh --profile <name>` keeps the flag in argv; a host
    // booted as `dsh web` has no flag and defaults to web.
    const argv = process.argv
    for (let i = 0; i < argv.length; i += 1) {
      if (argv[i] === '--profile' && argv[i + 1]) { profile = argv[i + 1]; break }
      if (argv[i].startsWith('--profile=')) { profile = argv[i].slice('--profile='.length); break }
    }
  }
  return path.join(dshHome(), 'profiles', profile || 'web')
}

/** Directory this plugin owns for wallpaper, reports, spills and cached state. */
export function morenHome() {
  return path.join(dshHome(), 'moren')
}

export function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode })
  try { fs.chmodSync(dir, mode) } catch { /* best effort on foreign filesystems */ }
  return dir
}

/** SHA-256 of bytes or text. */
export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/** Read JSON without throwing. */
export function readJson(file, fallback = undefined) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

/** Write JSON atomically (tmp in the same directory, then rename). */
export function writeJson(file, value) {
  ensureDir(path.dirname(file))
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(tmp, file)
  return file
}

/** Copy one file atomically, preserving the source mode. */
export function copyFileAtomic(source, target) {
  ensureDir(path.dirname(target))
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
  fs.copyFileSync(source, tmp)
  const stat = fs.statSync(source)
  try { fs.chmodSync(tmp, stat.mode & 0o777) } catch { /* ignore */ }
  fs.renameSync(tmp, target)
  return target
}

/** Whether a path exists (lstat, no symlink follow). */
export function exists(file) {
  try { fs.lstatSync(file); return true } catch { return false }
}

/** Walk up from a starting file looking for a package.json with this name. */
function packageAbove(start, name, depth = 10) {
  let current = start
  for (let i = 0; i < depth; i += 1) {
    const manifest = path.join(current, 'package.json')
    const parsed = readJson(manifest)
    if (parsed?.name === name) return { root: current, manifest: parsed }
    const next = path.dirname(current)
    if (next === current) break
    current = next
  }
  return undefined
}

/** The installed @deepseek-ai/dsh root, derived from the running entry point. */
export function dshInstallRoot() {
  const candidates = []
  for (const key of ['DSH_INSTALL', 'DSH_ROOT', 'DSH_PACKAGE_ROOT']) {
    if (process.env[key]) candidates.push(process.env[key])
  }
  try { candidates.push(path.dirname(fileURLToPath(import.meta.url))) } catch { /* ignore */ }
  if (process.argv[1]) candidates.push(path.dirname(path.resolve(process.argv[1])))
  // Global npm layout: <prefix>/bin/node → <prefix>/lib/node_modules/@deepseek-ai/dsh.
  const execDir = path.dirname(process.execPath)
  candidates.push(path.join(execDir, '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh'))
  candidates.push(path.join(execDir, '..', 'node_modules', '@deepseek-ai', 'dsh'))
  candidates.push(process.cwd())
  for (const candidate of candidates) {
    if (!candidate) continue
    const found = packageAbove(path.resolve(candidate), '@deepseek-ai/dsh', 12)
    if (found) return found
  }
  return undefined
}

/** Versions and presence of the two plugins this mode fuses. */
export function pluginFacts() {
  const profile = profileDir()
  const purgeDir = path.join(profile, 'node_modules', 'dsh-purge-community')
  const purgePkg = readJson(path.join(purgeDir, 'package.json'))
  const liangDir = path.join(profile, 'node_modules', '@linxin666', 'dsh-liangshen')
  const liangPkg = readJson(path.join(liangDir, 'package.json'))
  const install = dshInstallRoot()
  const dshPkg = install?.manifest
  return {
    dsh: {
      version: dshPkg?.version ?? null,
      root: install?.root ?? null,
    },
    purge: {
      installed: Boolean(purgePkg),
      version: purgePkg?.version ?? null,
      dir: purgeDir,
      overrideState: readJson(path.join(dshHome(), 'dsh-purge', 'override-state.json')),
      updateState: readJson(path.join(dshHome(), 'dsh-purge', 'update-status.json')),
    },
    liangshen: {
      installed: Boolean(liangPkg),
      version: liangPkg?.version ?? null,
      dir: liangDir,
    },
    profile,
    dshHome: dshHome(),
  }
}
