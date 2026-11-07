/**
 * Token accounting and lossless-ish compaction for the Moren token guard.
 *
 * The estimator is a deliberately simple structural estimate (CJK ~= one token
 * per character, ASCII ~= four characters per token) used for relative savings
 * and guard thresholds, not for billing.
 */

export function estimateTokens(text) {
  const value = String(text ?? '')
  let cjk = 0
  let ascii = 0
  let other = 0
  for (const char of value) {
    const code = char.codePointAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3040 && code <= 0x30ff) || (code >= 0xac00 && code <= 0xd7af)) cjk += 1
    else if (code < 128) ascii += 1
    else other += 1
  }
  return Math.round(cjk * 0.95 + ascii / 4 + other * 0.6)
}

export function compactText(text) {
  const before = String(text ?? '')
  let value = before
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
  const lines = value.split('\n')
  const deduped = []
  let repeats = 0
  for (const line of lines) {
    if (deduped.length > 0 && line === deduped[deduped.length - 1] && line.trim() !== '') {
      repeats += 1
      continue
    }
    deduped.push(line)
  }
  value = deduped.join('\n')
  return {
    text: value,
    beforeChars: before.length,
    afterChars: value.length,
    beforeTokens: estimateTokens(before),
    afterTokens: estimateTokens(value),
    removedRepeatLines: repeats,
    savedPercent: before.length === 0 ? 0 : Math.round((1 - value.length / before.length) * 1000) / 10,
  }
}

export function auditText(text, { path = null } = {}) {
  const value = String(text ?? '')
  const lines = value.split('\n')
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const base64Like = /^[A-Za-z0-9+/=\s]{256,}$/.test(value) || /^[0-9a-fA-F\s]{256,}$/.test(value)
  const suggestions = []
  if (value.includes('\u001b[')) suggestions.push('包含 ANSI 转义：先经 moren_token_audit action=compact 去掉。')
  if (/\n{3,}/.test(value)) suggestions.push('连续空行可折叠。')
  if (longest > 4000) suggestions.push('存在超长单行（可能是压缩/序列化数据）：改用 moren_codec 解码或按字节区间读取。')
  if (base64Like) suggestions.push('内容像 base64/hex：先解码再读，或直接用 moren_codec action=decode 写文件。')
  if (lines.length > 500) suggestions.push('行数很多：用 grep/head/tail 只取需要的片段，不要整段回读。')
  const compacted = compactText(value)
  if (compacted.beforeTokens > compacted.afterTokens) {
    suggestions.push(`无损压缩预计节省 ${compacted.beforeTokens - compacted.afterTokens} tokens（${compacted.savedPercent}%）。`)
  }
  return {
    ok: true,
    path,
    chars: value.length,
    bytes: Buffer.byteLength(value, 'utf8'),
    lines: lines.length,
    longestLine: longest,
    estimatedTokens: estimateTokens(value),
    compactPreview: compacted.text.length > 600 ? `${compacted.text.slice(0, 600)}…` : compacted.text,
    compactStats: {
      beforeChars: compacted.beforeChars,
      afterChars: compacted.afterChars,
      beforeTokens: compacted.beforeTokens,
      afterTokens: compacted.afterTokens,
      savedPercent: compacted.savedPercent,
      removedRepeatLines: compacted.removedRepeatLines,
    },
    suggestions,
  }
}
