/**
 * Compatibility report for the page: installed plugins, registered presets,
 * REA availability, media tooling, and the mode composition.
 */
import { spawnSync } from 'node:child_process'
import {
  CHILD_PRESET_ID,
  CHILD_PRESET_NAME,
  PARENT_PRESET_ID,
  PARENT_PRESET_NAME,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  pluginFacts,
} from './home.js'

function binaryAvailable(command, args = ['--version']) {
  try {
    return spawnSync(command, args, { timeout: 4000, encoding: 'utf8' }).status === 0
  } catch {
    return false
  }
}

export function compatReport({ presetState = {}, config = {} } = {}) {
  const facts = pluginFacts()
  const purgeAvailable = facts.purge.installed
  const liangshenAvailable = facts.liangshen.installed
  const reaAvailable = binaryAvailable('rea', ['--version'])
  const ffmpeg = binaryAvailable('ffmpeg')
  const checks = [
    {
      id: 'purge',
      label: 'dsh-purge',
      ok: purgeAvailable,
      value: purgeAvailable ? `v${facts.purge.version ?? '?'}` : '未安装',
      hint: purgeAvailable ? '无限制模式与无限制子任务来源' : '安装 dsh-purge 后本模式自动继承其宿主补丁',
    },
    {
      id: 'liangshen',
      label: '梁神模式',
      ok: liangshenAvailable,
      value: liangshenAvailable ? `v${facts.liangshen.version ?? '?'}` : '未安装',
      hint: liangshenAvailable ? 'minimal-prompt / PTC / 工具分页来源' : '本插件内置同源预设模块，未安装也可用',
    },
    {
      id: 'rea',
      label: 'REA 逆向',
      ok: reaAvailable,
      value: reaAvailable ? 'rea CLI 可用 · 229 tools' : '未安装',
      hint: reaAvailable ? 'MCP 命名空间 mcp__rea__*，先 tool_activate({namespace:"rea"})' : '运行 node scripts/install.mjs 或 npm i -g rea-agents',
    },
    {
      id: 'preset-parent',
      label: PARENT_PRESET_NAME,
      ok: Boolean(presetState.parentRegistered),
      value: presetState.parentRegistered ? PARENT_PRESET_ID : '未注册',
      hint: '新建会话的模式选择器里选择它',
    },
    {
      id: 'preset-child',
      label: CHILD_PRESET_NAME,
      ok: Boolean(presetState.childRegistered),
      value: presetState.childRegistered ? CHILD_PRESET_ID : '未注册',
      hint: 'subagent 默认使用；最多 10 层',
    },
    {
      id: 'ffmpeg',
      label: '视频抽帧',
      ok: ffmpeg,
      value: ffmpeg ? 'ffmpeg 可用' : '仅元数据',
      hint: '安装 ffmpeg 后 moren_media_inspect 自动抽关键帧',
    },
  ]
  return {
    ok: true,
    plugin: { name: PLUGIN_NAME, version: PLUGIN_VERSION },
    at: new Date().toISOString(),
    dsh: facts.dsh,
    profile: facts.profile,
    dshHome: facts.dshHome,
    presets: {
      parent: { id: PARENT_PRESET_ID, name: PARENT_PRESET_NAME, registered: Boolean(presetState.parentRegistered) },
      child: { id: CHILD_PRESET_ID, name: CHILD_PRESET_NAME, registered: Boolean(presetState.childRegistered) },
      dispatcher: Boolean(config.dispatcher),
      presentation: config.presentation ?? 'ptc',
      maxDepth: config.maxDepth ?? 10,
    },
    purge: {
      ...facts.purge,
      installed: purgeAvailable,
      patchHint: 'purge 的宿主补丁由其自己的面板应用；本插件不改 dsh 源码，因此两插件可同时开启。',
    },
    liangshen: facts.liangshen,
    rea: { installed: reaAvailable, command: 'rea mcp', namespace: 'rea', tools: 229 },
    checks,
    summary: {
      purge: purgeAvailable,
      liangshen: liangshenAvailable,
      rea: reaAvailable,
      mode: Boolean(presetState.parentRegistered),
      allGreen: checks.filter((check) => check.id !== 'ffmpeg').every((check) => check.ok),
    },
    tokenGuard: { thresholdChars: Number(config.tokenGuardChars ?? 24000) },
  }
}
