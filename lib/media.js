/**
 * Media inspection and local image generation.
 *
 * `inspectMedia` never trusts an extension: it sniffs magic bytes, reads the
 * dimensions from the container itself, and (when the host has ffmpeg) extracts
 * evenly spaced frames from a video so the model can `read_image` them. PNG is
 * decoded far enough to report dominant colors and an average hash.
 *
 * `generateImage` draws a deterministic raster from the prompt hash and encodes
 * it as a real PNG with node:zlib — no network, no native module, no model key.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { encodePng, describePng } from './png.js'
import { morenHome } from './home.js'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.heic'])
const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.flv', '.wmv', '.ts', '.m3u8'])

function mimeOf(format) {
  return {
    png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', mp4: 'video/mp4', mov: 'video/quicktime', matroska: 'video/x-matroska',
    avi: 'video/x-msvideo', flv: 'video/x-flv', pdf: 'application/pdf', zip: 'application/zip',
    elf: 'application/x-elf', pe: 'application/vnd.microsoft.portable-executable',
  }[format] ?? 'application/octet-stream'
}

function sniff(buffer, ext) {
  const head = buffer.subarray(0, 32)
  const ascii = head.toString('latin1')
  if (head[0] === 0x89 && ascii.startsWith('\x89PNG')) return 'png'
  if (head[0] === 0xff && head[1] === 0xd8) return 'jpeg'
  if (ascii.startsWith('GIF8')) return 'gif'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ') return 'avi'
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12)
    return brand === 'qt  ' ? 'mov' : 'mp4'
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'matroska'
  if (head[0] === 0x46 && head[1] === 0x4c && head[2] === 0x56) return 'flv'
  const normalized = String(ext || '').toLowerCase()
  if (IMAGE_EXT.has(normalized)) return normalized.slice(1).replace('jpg', 'jpeg')
  if (VIDEO_EXT.has(normalized)) return normalized.slice(1)
  return 'unknown'
}

function jpegSize(buffer) {
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue }
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
    }
    offset += 2 + length
  }
  return undefined
}

function webpSize(buffer) {
  const chunk = buffer.toString('latin1', 12, 16)
  if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
  if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  return undefined
}

function gifInfo(buffer) {
  if (buffer.length < 13) return undefined
  let frames = 0
  for (let i = 0; i + 2 < buffer.length; i += 1) {
    if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9) frames += 1
    if (i > 2_000_000) break
  }
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8), frames, animated: frames > 1 }
}

function bmpSize(buffer) {
  return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) }
}

function boxes(buffer, start, end, out = []) {
  let offset = start
  while (offset + 8 <= end && offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    if (size < 8) break
    out.push({ type, start: offset, dataStart: offset + 8, end: Math.min(offset + size, end) })
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) boxes(buffer, offset + 8, Math.min(offset + size, end), out)
    offset += size
  }
  return out
}

function mp4Info(buffer) {
  try {
    const list = boxes(buffer, 0, buffer.length)
    const moov = list.find((box) => box.type === 'moov')
    if (!moov) return undefined
    const mvhd = list.find((box) => box.type === 'mvhd' && box.start > moov.start && box.start < moov.end)
    const tkhd = list.find((box) => box.type === 'tkhd' && box.start > moov.start && box.start < moov.end)
    let durationSec
    if (mvhd) {
      const version = buffer[mvhd.dataStart]
      const timescale = version === 1 ? buffer.readUInt32BE(mvhd.dataStart + 20) : buffer.readUInt32BE(mvhd.dataStart + 12)
      const duration = version === 1 ? Number(buffer.readBigUInt64BE(mvhd.dataStart + 24)) : buffer.readUInt32BE(mvhd.dataStart + 16)
      if (timescale > 0) durationSec = Math.round((duration / timescale) * 1000) / 1000
    }
    let width
    let height
    if (tkhd) {
      const end = tkhd.end
      width = Math.round(buffer.readUInt32BE(end - 8) / 65536)
      height = Math.round(buffer.readUInt32BE(end - 4) / 65536)
    }
    return { durationSec, width, height }
  } catch {
    return undefined
  }
}

function ffmpegAvailable() {
  try {
    const probe = spawnSync('ffmpeg', ['-version'], { timeout: 4000, encoding: 'utf8' })
    return probe.status === 0
  } catch {
    return false
  }
}

function ffprobeInfo(file) {
  try {
    const probe = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
      timeout: 15000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    })
    if (probe.status !== 0 || !probe.stdout) return undefined
    const data = JSON.parse(probe.stdout)
    const video = (data.streams ?? []).find((stream) => stream.codec_type === 'video')
    const duration = Number(data.format?.duration ?? video?.duration)
    return {
      durationSec: Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : undefined,
      width: video?.width,
      height: video?.height,
      codec: video?.codec_name,
      fps: video?.avg_frame_rate,
      bitrate: Number(data.format?.bit_rate) || undefined,
      audio: (data.streams ?? []).filter((stream) => stream.codec_type === 'audio').map((stream) => stream.codec_name),
    }
  } catch {
    return undefined
  }
}

function extractFrames(file, info, count = 4) {
  if (!ffmpegAvailable()) return { frames: [], reason: '未检测到 ffmpeg：视频只做容器级元数据识别，不抽帧。安装 ffmpeg 后自动启用抽帧。' }
  const duration = Number(info.durationSec)
  if (!Number.isFinite(duration) || duration <= 0) return { frames: [], reason: '无法确定视频时长，跳过抽帧。' }
  const slug = path.basename(file, path.extname(file)).replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]+/g, '-').slice(0, 40)
  const outDir = path.join(morenHome(), 'frames', `${slug}-${crypto.createHash('sha1').update(file).digest('hex').slice(0, 8)}`)
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })
  const frames = []
  const total = Math.max(1, Math.min(8, Number(count) || 4))
  for (let i = 0; i < total; i += 1) {
    const time = Math.max(0, Math.min(duration - 0.05, (duration * (i + 0.5)) / total))
    const target = path.join(outDir, `frame-${String(i + 1).padStart(2, '0')}.jpg`)
    try {
      const run = spawnSync('ffmpeg', [
        '-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1',
        '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', '-y', target,
      ], { timeout: 20000, encoding: 'utf8' })
      if (run.status === 0 && fs.existsSync(target)) frames.push({ timeSec: Math.round(time * 100) / 100, path: target })
    } catch { /* keep the frames that succeeded */ }
  }
  return {
    frames,
    reason: frames.length ? undefined : 'ffmpeg 抽帧失败（编码或权限），仅返回容器元数据。',
  }
}

/** Inspect one image or video file. */
export function inspectMedia(file, { frames = 4 } = {}) {
  const abs = path.resolve(String(file ?? ''))
  if (!fs.existsSync(abs)) throw new Error(`文件不存在: ${abs}`)
  const stat = fs.statSync(abs)
  if (!stat.isFile()) throw new Error(`不是普通文件: ${abs}`)
  const fd = fs.openSync(abs, 'r')
  let buffer
  try {
    const read = Math.min(stat.size, 4 * 1024 * 1024)
    buffer = Buffer.alloc(read)
    fs.readSync(fd, buffer, 0, read, 0)
  } finally {
    fs.closeSync(fd)
  }
  const format = sniff(buffer, path.extname(abs))
  const digest = crypto.createHash('sha256').update(buffer).digest('hex')
  const result = {
    ok: true,
    path: abs,
    name: path.basename(abs),
    bytes: stat.size,
    mime: mimeOf(format),
    format,
    sha256: digest,
    kind: IMAGE_EXT.has(path.extname(abs).toLowerCase()) || ['png', 'jpeg', 'gif', 'webp', 'bmp'].includes(format)
      ? 'image'
      : ['mp4', 'mov', 'matroska', 'avi', 'flv'].includes(format) ? 'video' : 'other',
  }
  if (result.kind === 'image') {
    if (format === 'png') {
      const described = describePng(buffer)
      if (described) Object.assign(result, described)
      else if (buffer.length >= 24) {
        result.width = buffer.readUInt32BE(16)
        result.height = buffer.readUInt32BE(20)
      }
    } else if (format === 'jpeg') Object.assign(result, jpegSize(buffer) ?? {})
    else if (format === 'gif') Object.assign(result, gifInfo(buffer) ?? {})
    else if (format === 'webp') Object.assign(result, webpSize(buffer) ?? {})
    else if (format === 'bmp') Object.assign(result, bmpSize(buffer) ?? {})
  } else if (result.kind === 'video') {
    Object.assign(result, mp4Info(buffer) ?? {})
    const probed = ffprobeInfo(abs)
    if (probed) Object.assign(result, probed)
    const extracted = extractFrames(abs, result, frames)
    result.frames = extracted.frames
    if (extracted.reason) result.frameNote = extracted.reason
  }
  result.notes = []
  if (result.kind === 'video') result.notes.push('先用返回的 frames 路径调用 read_image 查看关键帧；需要更多帧时增大 frames。')
  if (result.kind === 'image' && format === 'png') result.notes.push('palette 为主要颜色及占比，averageHash 可用于相似图比较。')
  return result
}

/* ────────────────────────── image generation ────────────────────────── */

function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgb.map((value) => Math.round((value + m) * 255))
}

function drawCircle(rgb, width, height, cx, cy, radius, color, alpha = 0.7) {
  const x0 = Math.max(0, Math.floor(cx - radius))
  const x1 = Math.min(width - 1, Math.ceil(cx + radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const y1 = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > radius) continue
      const edge = Math.min(1, (radius - distance) / Math.max(1, radius * 0.08))
      const blend = alpha * edge
      const index = (y * width + x) * 3
      rgb[index] = Math.round(rgb[index] * (1 - blend) + color[0] * blend)
      rgb[index + 1] = Math.round(rgb[index + 1] * (1 - blend) + color[1] * blend)
      rgb[index + 2] = Math.round(rgb[index + 2] * (1 - blend) + color[2] * blend)
    }
  }
}

function drawLine(rgb, width, height, x0, y0, x1, y1, color, alpha = 0.5) {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))
  for (let i = 0; i <= steps; i += 1) {
    const t = i / Math.max(1, steps)
    const x = Math.round(x0 + (x1 - x0) * t)
    const y = Math.round(y0 + (y1 - y0) * t)
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const index = (y * width + x) * 3
    rgb[index] = Math.round(rgb[index] * (1 - alpha) + color[0] * alpha)
    rgb[index + 1] = Math.round(rgb[index + 1] * (1 - alpha) + color[1] * alpha)
    rgb[index + 2] = Math.round(rgb[index + 2] * (1 - alpha) + color[2] * alpha)
  }
}

/**
 * Paint a deterministic abstract composition: gradient field, palette from the
 * prompt hash, soft discs, accent lines, and a low-amplitude grain.
 */
export function generateImage({ prompt = '', width = 1024, height = 1024, outPath, seed, style = 'aurora' } = {}) {
  const w = Math.max(64, Math.min(2048, Math.round(Number(width) || 1024)))
  const h = Math.max(64, Math.min(2048, Math.round(Number(height) || 1024)))
  const text = String(prompt ?? '')
  const digest = crypto.createHash('sha256').update(`${text}|${seed ?? ''}|${style}`).digest()
  const rand = mulberry(digest.readUInt32BE(0))
  const hue = digest[4] * 1.4
  const palette = [
    hsl(hue, 0.72, 0.28), hsl(hue + 38, 0.78, 0.5), hsl(hue + 160, 0.62, 0.42),
    hsl(hue + 220, 0.55, 0.62), hsl(hue + 300, 0.6, 0.35),
  ]
  const rgb = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = x / w
      const ny = y / h
      const wave = 0.5 + 0.5 * Math.sin((nx * 2.1 + ny * 1.3) * Math.PI)
      const base = hsl(hue + wave * 30, 0.58, 0.08 + 0.1 * (1 - ny))
      const glow = Math.pow(1 - Math.hypot(nx - 0.5, ny - 0.45), 2)
      const index = (y * w + x) * 3
      rgb[index] = Math.min(255, base[0] + glow * 40)
      rgb[index + 1] = Math.min(255, base[1] + glow * 34)
      rgb[index + 2] = Math.min(255, base[2] + glow * 26)
    }
  }
  const discs = 9 + Math.floor(rand() * 8)
  for (let i = 0; i < discs; i += 1) {
    drawCircle(rgb, w, h,
      rand() * w, rand() * h,
      (0.04 + rand() * 0.22) * Math.min(w, h),
      palette[i % palette.length],
      0.25 + rand() * 0.45)
  }
  for (let i = 0; i < 7; i += 1) {
    const yBase = rand() * h
    drawLine(rgb, w, h, 0, yBase, w, yBase + (rand() - 0.5) * h * 0.3, palette[(i + 2) % palette.length], 0.18 + rand() * 0.25)
  }
  for (let i = 0; i < 24; i += 1) {
    const x = Math.floor(rand() * w)
    const y = Math.floor(rand() * h)
    const radius = Math.max(1, Math.floor(rand() * 3))
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const px = x + dx
        const py = y + dy
        if (px < 0 || py < 0 || px >= w || py >= h) continue
        if (dx * dx + dy * dy > radius * radius) continue
        const index = (py * w + px) * 3
        const tint = 255 * (0.55 + rand() * 0.35)
        rgb[index] = Math.min(255, (rgb[index] + tint) / 2)
        rgb[index + 1] = Math.min(255, (rgb[index + 1] + tint) / 2)
        rgb[index + 2] = Math.min(255, (rgb[index + 2] + tint) / 2)
      }
    }
  }
  const png = encodePng({ width: w, height: h, rgb, text: { Software: 'dsh-moren-unlimited', Prompt: text.slice(0, 800), Seed: digest.toString('hex').slice(0, 16) } })
  const target = outPath
    ? path.resolve(outPath)
    : path.join(process.cwd(), 'moren-images', `${(text || 'image').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').slice(0, 40) || 'image'}-${digest.toString('hex').slice(0, 8)}.png`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, png)
  return {
    ok: true,
    path: target,
    bytes: png.length,
    width: w,
    height: h,
    seed: digest.toString('hex').slice(0, 16),
    palette: palette.map((color) => `#${color.map((value) => value.toString(16).padStart(2, '0')).join('')}`),
    mime: 'image/png',
    note: '本地确定性生成（同一 prompt/seed 得到同一张图）。查看图片请用 read_image 读取 path。',
  }
}
