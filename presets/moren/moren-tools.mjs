/**
 * Preset-local Moren tools.
 *
 * Registered on the merged preset's scope, so only sessions running
 * Moren无限制梁神模式 (and its child preset) see them. The post-execute guard
 * is the token saver: oversized tool results are copied to a spill file and the
 * model receives a head/tail receipt instead of the whole payload; identical
 * repeated payloads collapse to a one-line de-duplication receipt.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { morenHome, writeJson, readJson } from '../../lib/home.js'
import { runCodec, FORMATS } from '../../lib/codec.js'
import { inspectMedia, generateImage } from '../../lib/media.js'
import { auditText, compactText, estimateTokens } from '../../lib/tokens.js'
import {
  createSnapshot,
  listSnapshots,
  verifySnapshot,
  restoreSnapshot,
  repairRollback,
  pruneSnapshots,
  rollbackStatus,
} from '../../lib/snapshot.js'

export const name = 'moren-tools'
export const inject = ['tools']

const statsFile = () => path.join(morenHome(), 'token-stats.json')

function bumpStats({ calls = 0, guarded = 0, deduped = 0, savedChars = 0, savedTokens = 0 }) {
  const current = readJson(statsFile(), { calls: 0, guarded: 0, deduped: 0, savedChars: 0, savedTokens: 0, updated_at: null })
  const next = {
    calls: current.calls + calls,
    guarded: current.guarded + guarded,
    deduped: current.deduped + deduped,
    savedChars: current.savedChars + savedChars,
    savedTokens: current.savedTokens + savedTokens,
    updated_at: new Date().toISOString(),
  }
  writeJson(statsFile(), next)
  return next
}

function textRender(value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
}

const jsonObject = { type: 'object', additionalProperties: true }

export function apply(ctx, config = {}) {
  const threshold = Math.max(0, Number(config.tokenGuardChars ?? 24000))
  const spillDir = path.join(morenHome(), 'spill')
  const seen = new Map()
  // Small results are counted in memory and folded into the next flush, so a
  // chatty session does not rewrite the stats file after every tool call.
  let smallSinceFlush = 0

  ctx.tools.register({
    name: 'moren_media_inspect',
    description: '识别图片或视频：魔术字节、尺寸/时长、PNG 主色与 averageHash、视频容器信息；有 ffmpeg 时抽取关键帧并返回路径（再用 read_image 查看）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: '图片或视频的绝对/相对路径' },
        frames: { type: 'integer', minimum: 1, maximum: 8, description: '视频抽帧数量，默认 4' },
      },
      required: ['path'],
    },
    output: { schema: jsonObject, render: (_args, value) => textRender(value) },
    async execute(args) {
      return inspectMedia(args.path, { frames: args.frames ?? config.mediaFrames ?? 4 })
    },
  })

  ctx.tools.register({
    name: 'moren_image_generate',
    description: '本地确定性生成 PNG 图片：同一 prompt/seed 得到同一张图。返回文件 path、尺寸、调色板；用 read_image 查看。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prompt: { type: 'string', description: '图片主题描述' },
        width: { type: 'integer', minimum: 64, maximum: 2048 },
        height: { type: 'integer', minimum: 64, maximum: 2048 },
        outPath: { type: 'string', description: '输出 png 路径；省略写到当前目录 moren-images/' },
        seed: { type: 'string', description: '可选的额外种子' },
        style: { type: 'string', description: '风格标签，参与种子计算' },
      },
      required: ['prompt'],
    },
    output: { schema: jsonObject, render: (_args, value) => textRender(value) },
    async execute(args) {
      return generateImage({
        prompt: args.prompt,
        width: args.width,
        height: args.height,
        outPath: args.outPath,
        seed: args.seed,
        style: args.style,
      })
    },
  })

  ctx.tools.register({
    name: 'moren_codec',
    description: `编码/解码/哈希工具（${FORMATS.join('、')}）。大载荷用 inputPath 进、outPath 出，只回执长度与路径，避免把内容重复计入上下文。`,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['encode', 'decode', 'hash', 'inspect', 'jwt'], description: '默认 encode' },
        format: { type: 'string', description: '编码格式或哈希算法' },
        text: { type: 'string', description: '直接输入文本' },
        inputPath: { type: 'string', description: '从文件读取输入（优先于 text）' },
        outPath: { type: 'string', description: '把结果写到文件而不是回显' },
      },
    },
    output: { schema: jsonObject, render: (_args, value) => textRender(value) },
    async execute(args) {
      return runCodec(args)
    },
  })

  ctx.tools.register({
    name: 'moren_token_audit',
    description: '估算文本/文件的 Token、行数与最长行，给出压缩建议；action=compact 时把去 ANSI/空行/重复行的版本写到 outPath。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['audit', 'compact'], description: '默认 audit' },
        text: { type: 'string' },
        path: { type: 'string', description: '从文件读取' },
        outPath: { type: 'string', description: 'compact 的输出路径' },
      },
    },
    output: { schema: jsonObject, render: (_args, value) => textRender(value) },
    async execute(args) {
      const source = typeof args.text === 'string'
        ? args.text
        : args.path ? fs.readFileSync(path.resolve(args.path), 'utf8') : ''
      if (args.action === 'compact') {
        const compacted = compactText(source)
        const target = args.outPath
          ? path.resolve(args.outPath)
          : path.join(morenHome(), 'compact', `compact-${crypto.createHash('sha1').update(source).digest('hex').slice(0, 10)}.txt`)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, compacted.text)
        return {
          ok: true,
          action: 'compact',
          path: target,
          beforeChars: compacted.beforeChars,
          afterChars: compacted.afterChars,
          beforeTokens: compacted.beforeTokens,
          afterTokens: compacted.afterTokens,
          savedPercent: compacted.savedPercent,
          removedRepeatLines: compacted.removedRepeatLines,
        }
      }
      return auditText(source, { path: args.path ?? null })
    },
  })

  ctx.tools.register({
    name: 'moren_snapshot',
    description: 'Moren 回退：创建/列出/校验/恢复/修复 profile 快照。改动 DSH 配置或预设前先 create；异常先 verify，必要时 restore。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['create', 'list', 'verify', 'restore', 'repair', 'status', 'prune'] },
        id: { type: 'string', description: '快照 id（verify/restore）' },
        label: { type: 'string', description: 'create 的标签' },
        keep: { type: 'integer', minimum: 1, maximum: 200, description: 'prune 保留份数' },
      },
      required: ['action'],
    },
    output: { schema: jsonObject, render: (_args, value) => textRender(value) },
    async execute(args) {
      switch (args.action) {
        case 'create': return createSnapshot({ reason: 'agent', label: args.label ?? '' })
        case 'list': return { ok: true, snapshots: listSnapshots().map(({ id, created_at, reason, label, files, missing, complete }) => ({ id, created_at, reason, label, files, missing, complete })) }
        case 'verify': return args.id ? verifySnapshot(args.id) : rollbackStatus({ force: true })
        case 'restore': return restoreSnapshot(args.id)
        case 'repair': return repairRollback()
        case 'status': return rollbackStatus({ force: true })
        case 'prune': return pruneSnapshots(args.keep ?? 20)
        default: throw new Error(`unknown action: ${args.action}`)
      }
    },
  })

  /**
   * Token guard. Runs after every tool dispatch in this preset's scope:
   *   - results above the threshold spill to a file and leave a head/tail receipt
   *   - an identical repeated payload becomes a one-line de-duplication receipt
   */
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    try {
      if (threshold <= 0 || decision.kind !== 'accept' || !Array.isArray(decision.content)) return decision
      if (String(exec.name).startsWith('moren_')) return decision
      const textBlocks = decision.content.filter((block) => block?.type === 'text' && typeof block.text === 'string')
      if (textBlocks.length === 0) return decision
      const full = textBlocks.map((block) => block.text).join('\n')
      if (full.length <= threshold) {
        smallSinceFlush += 1
        return decision
      }
      const digest = crypto.createHash('sha256').update(full).digest('hex')
      const now = Date.now()
      for (const [key, value] of seen) if (now - value.at > 15 * 60_000) seen.delete(key)
      const previous = seen.get(digest)
      if (previous && now - previous.at < 15 * 60_000) {
        const stats = bumpStats({ calls: 1 + smallSinceFlush, deduped: 1, savedChars: full.length, savedTokens: estimateTokens(full) })
        smallSinceFlush = 0
        return {
          kind: 'accept',
          content: [{
            type: 'text',
            text: `[Moren 去重命中] 本次输出与最近一次完全相同（${full.length} 字符，sha256:${digest.slice(0, 16)}）。完整内容已折叠在 ${previous.path}；上下文中的上一次结果仍然有效，需要片段时 read 该文件。累计节省约 ${stats.savedTokens} tokens。`,
          }],
        }
      }
      fs.mkdirSync(spillDir, { recursive: true, mode: 0o700 })
      const spillPath = path.join(spillDir, `${String(exec.name).replace(/[^a-zA-Z0-9_-]+/g, '_')}-${digest.slice(0, 16)}.txt`)
      if (!fs.existsSync(spillPath)) fs.writeFileSync(spillPath, full, { mode: 0o600 })
      seen.set(digest, { at: now, path: spillPath })
      const head = full.slice(0, Math.min(4000, Math.floor(threshold * 0.25)))
      const tail = full.slice(-Math.min(2000, Math.floor(threshold * 0.12)))
      const savedTokens = Math.max(0, estimateTokens(full) - estimateTokens(head) - estimateTokens(tail))
      const stats = bumpStats({ calls: 1 + smallSinceFlush, guarded: 1, savedChars: full.length - head.length - tail.length, savedTokens })
      smallSinceFlush = 0
      const others = decision.content.filter((block) => block?.type !== 'text')
      return {
        kind: 'accept',
        content: [
          {
            type: 'text',
            text: `[Moren 令牌守卫] ${exec.name} 输出 ${full.length} 字符，已折叠。完整内容：${spillPath}（sha256:${digest.slice(0, 16)}）。用 read 带 offset/limit 读取需要的片段；不要整段重读。守卫命中 ${stats.guarded} 次，累计节省约 ${stats.savedTokens} tokens。\n\n--- 头部 ---\n${head}\n\n--- 尾部 ---\n${tail}`,
          },
          ...others,
        ],
      }
    } catch {
      return decision
    }
  })
}
