#!/usr/bin/env node
/**
 * CLI installer for dsh-moren-unlimited.
 *
 * `dsh plugin --profile web add link:...` only forwards to pnpm; it does not add
 * the package to `dsh.profile.bundles`. This script performs both steps:
 *   1. pnpm add link:<this package>
 *   2. add the bundle name to package.json → dsh.profile.bundles
 *
 * Usage:
 *   node scripts/install.mjs [--profile web] [--home /path/to/.dsh]
 *   node scripts/install.mjs --remove [--profile web]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
const name = manifest.name

function parseArgs(argv) {
  const options = { profile: process.env.DSH_PROFILE || 'web', home: process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), remove: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--profile') options.profile = argv[++i]
    else if (arg === '--home') options.home = argv[++i]
    else if (arg === '--remove') options.remove = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

function fail(message) {
  console.error(`\n[moren] ${message}\n`)
  process.exit(1)
}

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  console.log('node scripts/install.mjs [--profile web] [--home ~/.dsh] [--remove]')
  process.exit(0)
}

const profileDir = path.join(options.home, 'profiles', options.profile)
const profileManifestPath = path.join(profileDir, 'package.json')
if (!fs.existsSync(profileManifestPath)) {
  fail(`profile "${options.profile}" 尚未初始化。先运行一次：dsh --profile ${options.profile}`)
}

const pnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8' })
if (pnpm.status !== 0) fail('找不到 pnpm。请先安装 pnpm（Node 24 自带 corepack：corepack enable）。')

const spec = `link:${packageRoot}`
const command = options.remove ? ['remove', name] : ['add', spec]
console.log(`[moren] pnpm ${command.join(' ')}  (cwd: ${profileDir})`)
const install = spawnSync('pnpm', command, { cwd: profileDir, stdio: 'inherit' })
if (install.status !== 0) fail('pnpm 执行失败，请检查上面的输出。')

const profile = JSON.parse(fs.readFileSync(profileManifestPath, 'utf8'))
profile.dependencies ??= {}
profile.dsh ??= {}
profile.dsh.profile ??= {}
profile.dsh.profile.bundles ??= []
if (options.remove) {
  delete profile.dependencies[name]
  profile.dsh.profile.bundles = profile.dsh.profile.bundles.filter((bundle) => bundle !== name)
} else {
  profile.dependencies[name] = spec
  if (!profile.dsh.profile.bundles.includes(name)) profile.dsh.profile.bundles.push(name)
}
const tmp = `${profileManifestPath}.tmp-${process.pid}`
fs.writeFileSync(tmp, `${JSON.stringify(profile, null, 2)}\n`)
fs.renameSync(tmp, profileManifestPath)

console.log(`
[moren] ${options.remove ? '已移除' : '已安装'} ${name}
  profile : ${profileDir}
  bundles : ${profile.dsh.profile.bundles.join(', ') || '(empty)'}

下一步：
  ${options.remove ? '重启 dsh web' : '重启 dsh web，然后新建会话 → 选择「Moren无限制梁神模式」'}
  左侧栏会出现 Moren 入口。

验证：
  node ${path.join(packageRoot, 'scripts', 'verify.mjs')} --profile ${options.profile}
`)
