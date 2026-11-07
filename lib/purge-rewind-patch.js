/**
 * Local compatibility patch for dsh-purge rewind on DSH 0.2.2.
 *
 * 1) client.js: resolve the active session from uiSession because
 *    uiWorkspace.selection was removed; inject uiSession into the rewind UI.
 * 2) client.js: pin the menu to the bottom-right of the viewport so it is
 *    visible without scrolling.
 * 3) lib/rewind.js: fork a new live session from the prefix before the rewound
 *    prompt. DSH 0.2.2 surface replacement no longer removes the turn, which
 *    left the old implementation with a draft and no visible rewind.
 *
 * Idempotent. Originals are kept as *.moren-orig. Re-applied on every start.
 */
import fs from 'node:fs'
import path from 'node:path'
import { profileDir } from './home.js'

const CLIENT_MARK = '/* moren-rewind-session-patch */'
const SERVER_MARK = 'Moren fork-based rewind'

function dirs() {
  const profile = profileDir()
  return [
    path.join(profile, 'node_modules', 'dsh-purge-community'),
    path.join(profile, 'node_modules', 'dsh-purge'),
  ]
}

function backupAndWrite(file, source) {
  const backup = `${file}.moren-orig`
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup)
  const temp = `${file}.moren-tmp-${process.pid}`
  fs.writeFileSync(temp, source, { mode: fs.statSync(file).mode })
  fs.renameSync(temp, file)
}

function patchClient(source) {
  if (source.includes(CLIENT_MARK)) return source
  let next = source
  const decl = 'var workspace = null;'
  if (!next.includes(decl)) return null
  next = next.replace(decl, `${decl}\nvar uiSessionStore = null; ${CLIENT_MARK}`)
  const bind = 'function bindRewindHost(ctx) {\n  host2 = ctx || null;\n  workspace = ctx && ctx.uiWorkspace || null;\n  conversation = ctx && ctx.conversation || null;\n}'
  if (!next.includes(bind)) return null
  next = next.replace(bind, `function bindRewindHost(ctx) {\n  host2 = ctx || null;\n  workspace = ctx && ctx.uiWorkspace || null;\n  conversation = ctx && ctx.conversation || null;\n  uiSessionStore = ctx && ctx.uiSession || null; ${CLIENT_MARK}\n}`)
  const fn = 'function currentSessionId(sessions) {\n  try {'
  if (!next.includes(fn)) return null
  next = next.replace(fn, `function currentSessionId(sessions) {\n  try {\n    const live = uiSessionStore?.current?.getSnapshot?.()?.key;\n    if (typeof live === "string" && live) return live;\n  } catch {\n  }\n  try {`)
  next = next.replace('ctx.inject(\n    ["sessions", "uiWorkspace", "conversation"],', 'ctx.inject(\n    ["sessions", "uiWorkspace", "conversation", "uiSession"],')
  // menu: fixed bottom-right, no scroll dependency
  next = next.replace(
    'style: menuPos ? { left: menuPos.left + "px", top: menuPos.top + "px" } : { left: "8px", bottom: "48px", transform: "none" }',
    'style: { right: "18px", bottom: "84px", left: "auto", top: "auto", transform: "none" } /* moren-menu-fixed */',
  )
  next = next.replace(
    '.dshp-rewind-menu{position:fixed;z-index:2147483000;box-sizing:border-box;min-width:220px;padding:4px;border:0;border-radius:12px;background:var(--dsw-specific-menu,#fff);color:var(--dsw-alias-label-primary,#1a1a1a);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.16));transform:translateY(-100%)}',
    '.dshp-rewind-menu{position:fixed;z-index:2147483000;box-sizing:border-box;min-width:220px;padding:4px;border:0;border-radius:12px;background:var(--dsw-specific-menu,#fff);color:var(--dsw-alias-label-primary,#1a1a1a);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.16));transform:none}',
  )
  return next
}

function patchServer(source) {
  if (source.includes(SERVER_MARK)) return source
  const needle = `  const plan = planRewind(log.events);
  if (!plan.ok) return plan;

  await disarmRewoundSession(ctx, sessionId);`
  if (!source.includes(needle)) return null
  const replacement = `  const plan = planRewind(log.events);
  if (!plan.ok) return plan;

  // ${SERVER_MARK}: create a new session from the prefix before the prompt.
  try {
    const store = service(ctx, "sessions");
    if (typeof store?.fork === "function" && Number.isSafeInteger(plan.fromSeq) && plan.fromSeq > 0) {
      const child = store.fork(sessionId, plan.fromSeq - 1);
      const rec = rememberDraft(child.id, plan.text, sessionId);
      return { ok: true, sessionId: child.id, parentId: sessionId, archived: false, cleared: true, text: rec.text, cut: "fork", at: rec.at };
    }
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }

  await disarmRewoundSession(ctx, sessionId);`
  return source.replace(needle, replacement)
}

export function ensurePurgeRewindPatch(logger = console) {
  const results = []
  for (const dir of dirs()) {
    const client = path.join(dir, 'client.js')
    const server = path.join(dir, 'lib', 'rewind.js')
    try {
      if (fs.existsSync(client)) {
        const source = fs.readFileSync(client, 'utf8')
        const next = patchClient(source)
        if (next && next !== source) { backupAndWrite(client, next); results.push({ file: client, patched: true }) }
        else if (source.includes(CLIENT_MARK)) results.push({ file: client, patched: false })
      }
    } catch (error) {
      logger.warn?.(`[moren] purge client patch failed: ${String(error?.message ?? error)}`)
    }
    try {
      if (fs.existsSync(server)) {
        const source = fs.readFileSync(server, 'utf8')
        const next = patchServer(source)
        if (next && next !== source) { backupAndWrite(server, next); results.push({ file: server, patched: true }) }
        else if (source.includes(SERVER_MARK)) results.push({ file: server, patched: false })
      }
    } catch (error) {
      logger.warn?.(`[moren] purge server patch failed: ${String(error?.message ?? error)}`)
    }
  }
  return { ok: results.length > 0, results }
}
