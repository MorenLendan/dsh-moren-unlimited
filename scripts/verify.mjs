#!/usr/bin/env node
/**
 * Post-install verifier: reads the live plugin API (no browser auth needed for
 * plugin routes) and checks mode registration, REA and client graph.
 *
 * Usage: node scripts/verify.mjs [--url http://127.0.0.1:3080] [--json]
 */
const args = process.argv.slice(2)
let url = 'http://127.0.0.1:3080'
let json = false
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--url') url = args[++i]
  else if (args[i] === '--json') json = true
}

async function call(op, payload = {}) {
  const response = await fetch(`${url.replace(/\/$/, '')}/dsh-moren/api`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, ...payload }),
  })
  const data = await response.json()
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`)
  return data
}

try {
  const status = await call('status')
  const client = await call('client').catch((error) => {
    const message = String(error.message)
    return /unknown op/i.test(message)
      ? { registered: null, note: '宿主尚未重启，客户端探针不可用（重启后再跑）' }
      : { registered: false, error: message }
  })
  const report = {
    plugin: status.plugin,
    dsh: status.dsh,
    mode: status.presets,
    rea: status.rea,
    purge: { installed: status.purge?.installed, version: status.purge?.version, hostBackup: status.purge?.hostBackup?.backup_files ?? 0 },
    liangshen: status.liangshen,
    client,
    checks: status.checks,
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const yes = (value) => (value ? '✓' : '✗')
    console.log(`dsh-moren-unlimited ${status.plugin?.version ?? ''}`)
    console.log(`  ${yes(status.presets?.parent?.registered)} 模式 ${status.presets?.parent?.id} (${status.presets?.parent?.name})`)
    console.log(`  ${yes(status.presets?.child?.registered)} 子预设 ${status.presets?.child?.id}`)
    console.log(`  ${yes(status.rea?.installed)} REA 逆向 (${status.rea?.tools ?? 0} tools)
`)
    console.log(`  ${yes(status.purge?.installed)} dsh-purge ${status.purge?.version ?? ''}；宿主备份 ${status.purge?.hostBackup?.backup_files ?? 0} 个`)
    console.log(`  ${yes(status.liangshen?.installed)} 梁神模式 ${status.liangshen?.version ?? ''}`)
    console.log(`  ${client.registered === null ? '…' : yes(client.registered)} 客户端模块${client.registered ? ` (${client.entry?.url ?? 'in graph'})` : ''}${client.note ? ` — ${client.note}` : ''}`)
    const bad = (status.checks ?? []).filter((check) => !check.ok && !['ffmpeg'].includes(check.id))
    if (bad.length) {
      console.log('\n需要处理：')
      for (const check of bad) console.log(`  - ${check.label}: ${check.value} (${check.hint})`)
    }
  }
  process.exit(status.presets?.parent?.registered ? 0 : 2)
} catch (error) {
  console.error(`[moren] 验证失败: ${error.message}`)
  console.error('确认 dsh web 正在运行，且 profile 中包含 dsh-moren-unlimited。')
  process.exit(1)
}
