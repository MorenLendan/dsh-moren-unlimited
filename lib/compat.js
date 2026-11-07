/**
 * Compatibility report for the page: what is installed, what is registered,
 * which rollback actually works, and what the mode composes.
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
import { rollbackStatus } from './snapshot.js'
import { estimateTokens } from './tokens.js'

function ffmpegAvailable() {
  try {
    return spawnSync('ffmpeg', ['-version'], { timeout: 3000, encoding: 'utf8' }).status === 0
  } catch {
    return false
  }
}

export function compatReport({ presetState = {}, config = {} } = {}) {
  const facts = pluginFacts()
  const rollback = rollbackStatus()
  const purgeAvailable = facts.purge.installed
  const liangshenAvailable = facts.liangshen.installed
  const hostBackup = rollback.purge
  const oursHealthy = rollback.healthy
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
      id: 'rollback-ours',
      label: 'Moren 回退',
      ok: oursHealthy,
      value: oursHealthy ? `${rollback.count} 份快照` : '不可用',
      hint: oursHealthy ? '快照可校验、可恢复' : '自动修复会建立健康基线',
    },
    {
      id: 'rollback-existing',
      label: '其它回退',
      ok: true,
      value: (rollback.existing ?? []).length > 0 ? `${rollback.existing.length} 处` : '未发现（用 Moren 快照）',
      hint: (rollback.existing ?? []).length > 0 ? '已识别；不可验证时用 Moren 快照兜底' : '没有现成 .bak/backups；Moren 快照作为回退',
    },
    {
      id: 'rollback-purge',
      label: 'dsh-purge 回退',
      ok: hostBackup.available,
      value: hostBackup.available ? `${hostBackup.backup_files} 个 .bak` : '无宿主备份',
      hint: hostBackup.available ? '可用 purge_apply/purge_revert' : '用 Moren 快照替代宿主回退',
    },
    {
      id: 'ffmpeg',
      label: '视频抽帧',
      ok: ffmpegAvailable(),
      value: ffmpegAvailable() ? 'ffmpeg 可用' : '仅元数据',
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
      hostBackup: hostBackup,
      patchHint: 'purge 的宿主补丁由其自己的面板应用；本插件不改 dsh 源码，因此两插件可同时开启。',
    },
    liangshen: facts.liangshen,
    rollback,
    checks,
    summary: {
      purge: purgeAvailable,
      liangshen: liangshenAvailable,
      mode: Boolean(presetState.parentRegistered),
      rollback: oursHealthy,
      allGreen: checks.filter((check) => !['ffmpeg', 'rollback-purge', 'rollback-existing'].includes(check.id)).every((check) => check.ok),
    },
    tokenGuard: {
      thresholdChars: Number(config.tokenGuardChars ?? 24000),
      estimatedSavedTokens: rollback.state?.token_saved ?? 0,
    },
    estimateTokensSample: estimateTokens('Moren 无限制梁神模式'),
  }
}
