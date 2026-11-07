#!/usr/bin/env node
/**
 * Offline self-test for the plugin core. Runs entirely under a temp DSH_HOME so
 * it never touches the real profile.
 *
 *   node scripts/selftest.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'moren-selftest-'))
const home = path.join(temp, '.dsh')
const profile = path.join(home, 'profiles', 'web')
fs.mkdirSync(profile, { recursive: true })
fs.writeFileSync(path.join(profile, 'package.json'), JSON.stringify({
  name: 'selftest-profile',
  dependencies: {},
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
}, null, 2))
fs.writeFileSync(path.join(profile, 'cordis.patch.yml'), '[]\n')
fs.writeFileSync(path.join(profile, 'cordis.yml'), '[]\n')
process.env.DSH_HOME = home
process.env.DSH_PROFILE_DIR = profile

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`✓ ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.stack ?? error) })
    console.error(`✗ ${name}\n  ${String(error?.message ?? error)}`)
  }
}

const codec = await import('../lib/codec.js')
const media = await import('../lib/media.js')
const wallpaper = await import('../lib/wallpaper.js')
const snapshot = await import('../lib/snapshot.js')
const definition = await import('../presets/moren/definition.mjs')

await test('codec roundtrip: all formats', () => {
  const source = 'Moren 无限制梁神模式 123'
  for (const format of ['base64', 'base64url', 'hex', 'url', 'urlcomponent', 'html', 'unicode', 'gzip', 'deflate', 'brotli', 'base32', 'base58', 'rot13', 'binary', 'utf16le', 'datauri']) {
    const file = path.join(temp, `codec-${format}.bin`)
    codec.runCodec({ action: 'encode', format, text: source, outPath: file })
    const decoded = codec.runCodec({ action: 'decode', format, inputPath: file })
    assert.equal(decoded.ok, true, format)
    if (format !== 'utf16le') assert.equal(decoded.text, source, format)
  }
  assert.equal(codec.runCodec({ action: 'hash', format: 'sha256', text: 'abc' }).hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

await test('media: generate PNG and inspect metadata', () => {
  const out = path.join(temp, 'image.png')
  const generated = media.generateImage({ prompt: 'selftest', width: 160, height: 100, outPath: out })
  assert.equal(generated.width, 160)
  assert.equal(generated.height, 100)
  const info = media.inspectMedia(out)
  assert.equal(info.format, 'png')
  assert.equal(info.width, 160)
  assert.equal(info.height, 100)
  assert.ok(Array.isArray(info.palette))
})

await test('wallpaper: upload, status, settings, clear', () => {
  const img = media.generateImage({ prompt: 'wallpaper', width: 200, height: 120, outPath: path.join(temp, 'wallpaper.png') })
  const data = 'data:image/png;base64,' + fs.readFileSync(img.path).toString('base64')
  const uploaded = wallpaper.uploadWallpaper({ data, name: 'wall.png' })
  assert.equal(uploaded.enabled, true)
  assert.equal(uploaded.format, 'png')
  assert.match(uploaded.url, /dsh-moren\/wallpaper\/[a-f0-9]{64}\.png/)
  const found = wallpaper.wallpaperFilePath(uploaded.file)
  assert.ok(found)
  assert.equal(found.mime, 'image/png')
  const settings = wallpaper.saveWallpaperSettings({ opacity: 55, blur: 4, dim: 40, fit: 'contain' })
  assert.equal(settings.opacity, 55)
  assert.equal(settings.blur, 4)
  assert.equal(settings.fit, 'contain')
  const cleared = wallpaper.clearWallpaper()
  assert.equal(cleared.enabled, false)
  assert.equal(cleared.url, null)
})

await test('snapshot: create, verify, restore actual profile path, keep self', () => {
  const created = snapshot.createSnapshot({ reason: 'selftest', label: 'selftest' })
  assert.equal(snapshot.verifySnapshot(created.id, { deep: true }).ok, true)
  // Break the live profile, then restore.
  fs.writeFileSync(path.join(profile, 'package.json'), '{"name":"broken"}\n')
  const restored = snapshot.restoreSnapshot(created.id)
  assert.equal(restored.ok, true, restored.error)
  const live = JSON.parse(fs.readFileSync(path.join(profile, 'package.json'), 'utf8'))
  assert.equal(live.name, 'selftest-profile')
  assert.ok(live.dependencies['dsh-moren-unlimited'], 'self dependency re-added')
  assert.ok(live.dsh.profile.bundles.includes('dsh-moren-unlimited'), 'self bundle re-added')
  assert.equal(fs.existsSync(path.join(home, 'profile')), false, 'no stray $DSH_HOME/profile')
})

await test('preset: parent/child rows and key LiangShen rows', () => {
  const { parent, child } = definition.buildPresetDefinitions({ dispatcher: true })
  const ids = []
  const walk = (rows) => { for (const row of rows) { ids.push(row.id); if (row.group === true) walk(row.config) } }
  walk(parent.plugins)
  for (const required of ['persona', 'minimal-prompt', 'tool-catalog', 'working-context', 'tool-activate', 'fact-ledger', 'subagent-routes', 'dispatch-guard', 'str-replace-editor', 'tool-executor-ptc', 'moren-tools', 'moren-policy']) {
    assert.ok(ids.includes(required), `missing ${required}`)
  }
  assert.equal(parent.plugins.find((row) => row.id === 'minimal-prompt').config.dispatcher, true)
  assert.equal(child.id, 'moren-unlimited-liangshen-child')
})

await test('vendor: LiangShen modules byte-identical when installed', () => {
  const upstream = '/root/.dsh/profiles/web/node_modules/@linxin666/dsh-liangshen/presets/liangshen'
  if (!fs.existsSync(upstream)) return 'skipped (liangshen not installed)'
  for (const file of ['minimal-prompt.mjs', 'tool-catalog.mjs', 'tool-activate.mjs', 'working-context.mjs', 'fact-ledger.mjs', 'subagent-routes.mjs', 'dispatch-guard.mjs', 'paging.mjs', 'dispatcher-rules.mjs']) {
    const a = crypto.createHash('sha256').update(fs.readFileSync(path.join(upstream, file))).digest('hex')
    const b = crypto.createHash('sha256').update(fs.readFileSync(new URL(`../presets/moren/vendor/${file}`, import.meta.url))).digest('hex')
    assert.equal(b, a, file)
  }
})

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
fs.rmSync(temp, { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
