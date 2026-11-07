/**
 * Local compatibility patch for dsh-purge's composer rewind button.
 *
 * DSH 0.2.2 removed `uiWorkspace.selection`. purge still resolves the active
 * session from it, so its button renders disabled. This patch adds the live
 * `uiSession.current` source and injects the uiSession service into the rewind
 * UI host. The original file is kept as client.js.moren-orig.
 *
 * The patch is idempotent and is re-applied on every harness start, so a purge
 * update only needs a restart to be patched again.
 */
import fs from 'node:fs'
import path from 'node:path'
import { profileDir } from './home.js'

const MARK = '/* moren-rewind-session-patch */'

function candidateFiles() {
  const profile = profileDir()
  return [
    path.join(profile, 'node_modules', 'dsh-purge-community', 'client.js'),
    path.join(profile, 'node_modules', 'dsh-purge', 'client.js'),
  ]
}

function patchSource(source) {
  if (source.includes(MARK)) return null
  let next = source
  const decl = 'var workspace = null;'
  if (!next.includes(decl)) return null
  next = next.replace(decl, `${decl}\nvar uiSessionStore = null; ${MARK}`)
  const bind = 'function bindRewindHost(ctx) {\n  host2 = ctx || null;\n  workspace = ctx && ctx.uiWorkspace || null;\n  conversation = ctx && ctx.conversation || null;\n}'
  if (!next.includes(bind)) return null
  next = next.replace(bind, `function bindRewindHost(ctx) {\n  host2 = ctx || null;\n  workspace = ctx && ctx.uiWorkspace || null;\n  conversation = ctx && ctx.conversation || null;\n  uiSessionStore = ctx && ctx.uiSession || null; ${MARK}\n}`)
  const fn = 'function currentSessionId(sessions) {\n  try {'
  if (!next.includes(fn)) return null
  next = next.replace(fn, `function currentSessionId(sessions) {\n  try {\n    const live = uiSessionStore?.current?.getSnapshot?.()?.key;\n    if (typeof live === "string" && live) return live;\n  } catch {\n  }\n  try {`)
  next = next.replace('ctx.inject(\n    ["sessions", "uiWorkspace", "conversation"],', 'ctx.inject(\n    ["sessions", "uiWorkspace", "conversation", "uiSession"],')
  return next === source ? null : next
}

export function ensurePurgeRewindPatch(logger = console) {
  for (const file of candidateFiles()) {
    try {
      if (!fs.existsSync(file)) continue
      const source = fs.readFileSync(file, 'utf8')
      if (source.includes(MARK)) return { ok: true, file, patched: false }
      const next = patchSource(source)
      if (!next) {
        logger.warn?.(`[moren] purge rewind patch pattern not found: ${file}`)
        continue
      }
      const backup = `${file}.moren-orig`
      if (!fs.existsSync(backup)) fs.copyFileSync(file, backup)
      const temp = `${file}.moren-tmp-${process.pid}`
      fs.writeFileSync(temp, next, { mode: fs.statSync(file).mode })
      fs.renameSync(temp, file)
      logger.info?.(`[moren] patched purge rewind session binding: ${file}`)
      return { ok: true, file, patched: true }
    } catch (error) {
      logger.warn?.(`[moren] purge rewind patch failed: ${String(error?.message ?? error)}`)
    }
  }
  return { ok: false, patched: false }
}
