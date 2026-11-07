/**
 * Wallpaper store for the Moren page.
 *
 * Files live under `$DSH_HOME/moren/wallpaper/`, settings under
 * `$DSH_HOME/moren/wallpaper.json`. Only raster formats are accepted (no SVG:
 * CSS background SVG is a scriptable document in some browsers). The file name
 * is the SHA-256 of its bytes, so the serving URL is immutable and cacheable.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { morenHome, ensureDir, readJson, writeJson } from './home.js'

export const WALLPAPER_MAX_BYTES = 20 * 1024 * 1024
const EXTS = { png: 'png', jpeg: 'jpg', gif: 'gif', webp: 'webp' }
const MIMES = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }

export function wallpaperDir() {
  return path.join(morenHome(), 'wallpaper')
}

function settingsFile() {
  return path.join(morenHome(), 'wallpaper.json')
}

function defaults() {
  return {
    enabled: false,
    file: null,
    mime: null,
    name: null,
    size: 0,
    sha256: null,
    opacity: 100,
    blur: 0,
    dim: 25,
    fit: 'cover',
    updatedAt: null,
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function readRaw() {
  const raw = readJson(settingsFile(), null)
  return raw && typeof raw === 'object' ? raw : null
}

/** Sniff the accepted raster formats from magic bytes, not the client MIME. */
export function sniffWallpaper(buffer) {
  if (buffer.length > 3 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png'
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (buffer.length > 5 && buffer.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif'
  if (buffer.length > 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return undefined
}

/** Public projection used by the page and the API. */
export function wallpaperStatus() {
  const settings = { ...defaults(), ...(readRaw() ?? {}) }
  const file = settings.file ? path.basename(String(settings.file)) : null
  const exists = file ? fs.existsSync(path.join(wallpaperDir(), file)) : false
  return {
    ...settings,
    enabled: Boolean(settings.enabled) && exists,
    file: exists ? file : null,
    url: exists ? `dsh-moren/wallpaper/${file}?v=${String(settings.sha256 ?? '').slice(0, 12)}` : null,
    missing: Boolean(file) && !exists,
  }
}

/** Apply a settings patch (enabled/opacity/blur/dim/fit). */
export function saveWallpaperSettings(patch = {}) {
  const current = { ...defaults(), ...(readRaw() ?? {}) }
  const next = {
    ...current,
    enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
    opacity: clamp(patch.opacity ?? current.opacity, 0, 100, 100),
    blur: clamp(patch.blur ?? current.blur, 0, 40, 0),
    dim: clamp(patch.dim ?? current.dim, 0, 90, 25),
    fit: patch.fit === 'contain' ? 'contain' : patch.fit === 'cover' ? 'cover' : current.fit ?? 'cover',
    updatedAt: new Date().toISOString(),
  }
  writeJson(settingsFile(), next)
  return wallpaperStatus()
}

/** Store an uploaded image (base64/data URI) and enable it. */
export function uploadWallpaper({ data, mime, name } = {}) {
  if (typeof data !== 'string' || data.length === 0) throw new Error('缺少图片数据')
  const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data
  let buffer
  try { buffer = Buffer.from(base64, 'base64') } catch { throw new Error('base64 解码失败') }
  if (buffer.length === 0) throw new Error('图片为空')
  if (buffer.length > WALLPAPER_MAX_BYTES) throw new Error(`图片超过 ${Math.round(WALLPAPER_MAX_BYTES / 1024 / 1024)}MB 限制`)
  const format = sniffWallpaper(buffer)
  if (!format) throw new Error('仅支持 PNG / JPEG / WebP / GIF（不接受 SVG）')
  const sha = crypto.createHash('sha256').update(buffer).digest('hex')
  const file = `${sha}.${EXTS[format]}`
  ensureDir(wallpaperDir())
  const target = path.join(wallpaperDir(), file)
  if (!fs.existsSync(target)) fs.writeFileSync(target, buffer, { mode: 0o600 })
  const current = { ...defaults(), ...(readRaw() ?? {}) }
  // Remove the previous image only after the new one is safely written.
  if (current.file && current.file !== file) {
    try { fs.rmSync(path.join(wallpaperDir(), path.basename(String(current.file))), { force: true }) } catch { /* ignore */ }
  }
  const next = {
    ...current,
    enabled: true,
    file,
    mime: MIMES[format],
    name: String(name ?? 'wallpaper').replace(/[\r\n]/g, ' ').slice(0, 120),
    size: buffer.length,
    sha256: sha,
    opacity: 100,
    blur: 0,
    dim: current.dim ?? 25,
    fit: current.fit === 'contain' ? 'contain' : 'cover',
    updatedAt: new Date().toISOString(),
  }
  writeJson(settingsFile(), next)
  return { ...wallpaperStatus(), uploadedBytes: buffer.length, format }
}

/** Remove the current image and disable the wallpaper. */
export function clearWallpaper() {
  const current = { ...defaults(), ...(readRaw() ?? {}) }
  if (current.file) {
    try { fs.rmSync(path.join(wallpaperDir(), path.basename(String(current.file))), { force: true }) } catch { /* ignore */ }
  }
  writeJson(settingsFile(), { ...current, enabled: false, file: null, mime: null, sha256: null, size: 0, updatedAt: new Date().toISOString() })
  return wallpaperStatus()
}

/** Resolve one hashed wallpaper file for the HTTP route. */
export function wallpaperFilePath(file) {
  const name = path.basename(String(file ?? ''))
  if (!/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(name)) return undefined
  const abs = path.join(wallpaperDir(), name)
  if (!fs.existsSync(abs)) return undefined
  return { abs, mime: MIMES[name.split('.').pop() === 'jpg' ? 'jpeg' : name.split('.').pop()] ?? 'application/octet-stream', name }
}
