/**
 * A tiny PNG writer/reader used by `moren_image_generate` and the image branch
 * of `moren_media_inspect`. No native dependency: an 8-bit RGB raster is
 * deflated with node:zlib and framed with the four chunks a PNG needs.
 */
import zlib from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

/** Encode an RGB byte array (width * height * 3) as a PNG buffer. */
export function encodePng({ width, height, rgb, text = {} }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('invalid PNG dimensions')
  }
  if (rgb.length !== width * height * 3) throw new Error('RGB buffer does not match dimensions')
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  const parts = [signature, chunk('IHDR', ihdr), chunk('IDAT', idat)]
  for (const [keyword, value] of Object.entries(text)) {
    if (typeof value !== 'string' || value.length === 0) continue
    // iTXt carries UTF-8 (the prompt may be Chinese): keyword\0 flag=0 method=0
    // language-tag\0 translated-keyword\0 text.
    parts.push(chunk('iTXt', Buffer.concat([
      Buffer.from(String(keyword), 'latin1'), Buffer.from([0, 0, 0, 0, 0]), Buffer.from(value, 'utf8'),
    ])))
  }
  parts.push(chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * Decode enough of a non-interlaced 8-bit PNG to describe it: dimensions,
 * dominant colors, average color and an 8x8 average hash. Returns undefined
 * for formats outside that supported subset.
 */
export function describePng(buffer) {
  try {
    if (buffer.length < 33 || buffer[0] !== 0x89) return undefined
    let offset = 8
    let width = 0
    let height = 0
    let bitDepth = 0
    let colorType = 0
    let interlace = 0
    const idat = []
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset)
      const type = buffer.toString('latin1', offset + 4, offset + 8)
      const data = buffer.subarray(offset + 8, offset + 8 + length)
      if (type === 'IHDR') {
        width = data.readUInt32BE(0)
        height = data.readUInt32BE(4)
        bitDepth = data[8]
        colorType = data[9]
        interlace = data[12]
      } else if (type === 'IDAT') idat.push(data)
      else if (type === 'IEND') break
      offset += length + 12
    }
    if (!width || !height || bitDepth !== 8 || interlace !== 0) return undefined
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0
    if (channels === 0) return undefined
    const raw = zlib.inflateSync(Buffer.concat(idat))
    const stride = width * channels
    const pixels = Buffer.alloc(stride * height)
    let pos = 0
    for (let y = 0; y < height; y += 1) {
      const filter = raw[pos]
      pos += 1
      for (let x = 0; x < stride; x += 1) {
        const value = raw[pos + x]
        const left = x >= channels ? pixels[y * stride + x - channels] : 0
        const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
        const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
        let out
        switch (filter) {
          case 0: out = value; break
          case 1: out = value + left; break
          case 2: out = value + up; break
          case 3: out = value + ((left + up) >> 1); break
          case 4: out = value + paeth(left, up, upLeft); break
          default: return undefined
        }
        pixels[y * stride + x] = out & 0xff
      }
      pos += stride
    }
    let r = 0
    let g = 0
    let b = 0
    const buckets = new Map()
    const step = Math.max(1, Math.floor((width * height) / 20000))
    let samples = 0
    for (let i = 0; i < width * height; i += step) {
      const base = i * channels
      const pr = pixels[base]
      const pg = channels >= 3 ? pixels[base + 1] : pr
      const pb = channels >= 3 ? pixels[base + 2] : pr
      r += pr
      g += pg
      b += pb
      const key = `${pr >> 4}-${pg >> 4}-${pb >> 4}`
      const hit = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
      hit.r += pr
      hit.g += pg
      hit.b += pb
      hit.n += 1
      buckets.set(key, hit)
      samples += 1
    }
    const palette = [...buckets.values()]
      .sort((a, b2) => b2.n - a.n)
      .slice(0, 6)
      .map((hit) => ({
        hex: `#${[hit.r, hit.g, hit.b].map((v) => Math.round(v / hit.n).toString(16).padStart(2, '0')).join('')}`,
        share: Math.round((hit.n / samples) * 1000) / 10,
      }))
    const hash = []
    for (let gy = 0; gy < 8; gy += 1) {
      for (let gx = 0; gx < 8; gx += 1) {
        const x = Math.min(width - 1, Math.floor(((gx + 0.5) * width) / 8))
        const y = Math.min(height - 1, Math.floor(((gy + 0.5) * height) / 8))
        const base = (y * width + x) * channels
        const pr = pixels[base]
        const pg = channels >= 3 ? pixels[base + 1] : pr
        const pb = channels >= 3 ? pixels[base + 2] : pr
        hash.push(Math.round(0.299 * pr + 0.587 * pg + 0.114 * pb))
      }
    }
    const average = hash.reduce((sum, value) => sum + value, 0) / hash.length
    const bits = hash.map((value) => (value >= average ? '1' : '0')).join('')
    return {
      width,
      height,
      colorType,
      channels,
      averageColor: `#${[r, g, b].map((v) => Math.round(v / samples).toString(16).padStart(2, '0')).join('')}`,
      palette,
      averageHash: `${bits.slice(0, 16)}…`,
      brightness: Math.round((average / 255) * 100),
    }
  } catch {
    return undefined
  }
}
