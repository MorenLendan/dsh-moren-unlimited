/**
 * The codec behind `moren_codec`: a deterministic, dependency-free encoder /
 * decoder used to move large payloads without paying for them twice in tokens.
 * File input and file output keep the conversation surface to a short receipt.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export const FORMATS = [
  'base64', 'base64url', 'hex', 'url', 'urlcomponent', 'html', 'unicode',
  'gzip', 'deflate', 'brotli', 'base32', 'base58', 'base85', 'rot13', 'binary',
  'utf16le', 'datauri', 'jwt', 'quoted-printable',
]

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  while (out.length % 8 !== 0) out += '='
  return out
}

function base32Decode(text) {
  const clean = text.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const out = []
  for (const char of clean) {
    const index = B32.indexOf(char)
    if (index === -1) throw new Error(`invalid base32 character: ${char}`)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function base58Encode(buffer) {
  let zeros = 0
  while (zeros < buffer.length && buffer[zeros] === 0) zeros += 1
  const digits = []
  for (let i = zeros; i < buffer.length; i += 1) {
    let carry = buffer[i]
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let out = '1'.repeat(zeros)
  for (let i = digits.length - 1; i >= 0; i -= 1) out += B58[digits[i]]
  return out
}

export function base58Decode(text) {
  const clean = text.trim()
  let zeros = 0
  while (zeros < clean.length && clean[zeros] === '1') zeros += 1
  const bytes = []
  for (let i = zeros; i < clean.length; i += 1) {
    const value = B58.indexOf(clean[i])
    if (value === -1) throw new Error(`invalid base58 character: ${clean[i]}`)
    let carry = value
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  return Buffer.from([...Buffer.alloc(zeros), ...bytes.reverse()])
}

function base85Encode(buffer) {
  let out = ''
  for (let i = 0; i < buffer.length; i += 4) {
    const chunk = buffer.subarray(i, i + 4)
    const pad = 4 - chunk.length
    const value = (chunk[0] << 24) | ((chunk[1] ?? 0) << 16) | ((chunk[2] ?? 0) << 8) | (chunk[3] ?? 0)
    let block = ''
    let v = value >>> 0
    for (let j = 0; j < 5; j += 1) { block = String.fromCharCode(33 + (v % 85)) + block; v = Math.floor(v / 85) }
    out += block.slice(0, 5 - pad)
  }
  return out
}

function base85Decode(text) {
  const clean = String(text).replace(/\s+/g, '')
  const out = []
  for (let i = 0; i < clean.length; i += 5) {
    const block = clean.slice(i, i + 5)
    const pad = 5 - block.length
    let value = 0
    for (let j = 0; j < 5; j += 1) value = value * 85 + ((block.charCodeAt(j) || 117) - 33)
    const bytes = [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
    out.push(...bytes.slice(0, 4 - pad))
  }
  return Buffer.from(out)
}

function qpEncode(buffer) {
  let out = ''
  for (const byte of buffer) {
    if ((byte >= 33 && byte <= 126 && byte !== 61) || byte === 9 || byte === 10 || byte === 13) out += String.fromCharCode(byte)
    else out += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
  }
  return out
}

function qpDecode(text) {
  const bytes = []
  const value = String(text).replace(/=\r?\n/g, '')
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '=' && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(value.slice(i + 1, i + 3), 16)); i += 2
    } else bytes.push(value.charCodeAt(i) & 255)
  }
  return Buffer.from(bytes)
}

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
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

function xorBuffer(buffer, key) {
  const bytes = Buffer.from(String(key ?? 'moren'))
  if (bytes.length === 0) throw new Error('xor key required')
  return Buffer.from([...buffer].map((byte, index) => byte ^ bytes[index % bytes.length]))
}

function htmlEncode(text) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

function htmlDecode(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return named[body] ?? all
  })
}

function readInput({ text, inputPath }) {
  if (typeof text === 'string' && text.length > 0) return { buffer: Buffer.from(text, 'utf8'), source: 'text' }
  if (inputPath) {
    const abs = path.resolve(inputPath)
    return { buffer: fs.readFileSync(abs), source: abs }
  }
  throw new Error('需要 text 或 inputPath')
}

function writeOutput({ outPath, buffer }) {
  if (!outPath) return null
  const abs = path.resolve(outPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, buffer)
  return abs
}

function preview(text, limit = 400) {
  return text.length > limit ? `${text.slice(0, limit)}…[共 ${text.length} 字符]` : text
}

/** One codec call. */
export function runCodec(args = {}) {
  const action = String(args.action ?? 'encode')
  const format = String(args.format ?? 'base64').toLowerCase()
  const started = Date.now()
  if (action === 'hash') {
    const { buffer, source } = readInput(args)
    if (String(args.format ?? '').toLowerCase() === 'crc32') {
      return { ok: true, action, format: 'crc32', source, bytes: buffer.length, hash: crc32(buffer), text: crc32(buffer) }
    }
    if (String(args.format ?? '').toLowerCase() === 'hmac') {
      const algorithm = String(args.algorithm ?? 'sha256')
      const digest = crypto.createHmac(algorithm, String(args.key ?? '')).update(buffer).digest('hex')
      return { ok: true, action, format: `hmac-${algorithm}`, source, bytes: buffer.length, hash: digest, text: digest }
    }
    const algorithm = String(args.format ?? 'sha256').toLowerCase().replace(/^sha-?/, 'sha')
    const name = ['md5', 'sha1', 'sha256', 'sha512', 'sha3-256'].includes(algorithm)
      ? algorithm.replace('sha3-256', 'sha3-256')
      : 'sha256'
    const digest = crypto.createHash(name).update(buffer).digest('hex')
    return { ok: true, action, format: name, source, bytes: buffer.length, text: digest, hash: digest, ms: Date.now() - started }
  }
  if (action === 'inspect') {
    const { buffer, source } = readInput(args)
    const head = buffer.subarray(0, 64)
    return {
      ok: true,
      action,
      source,
      bytes: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      detected: detect(buffer),
      headHex: head.toString('hex'),
      headText: preview(head.toString('utf8').replace(/[^\x20-\x7e\n]/g, '·'), 120),
      ms: Date.now() - started,
    }
  }
  if (action === 'jwt') {
    const { buffer } = readInput(args)
    const token = buffer.toString('utf8').trim()
    const parts = token.split('.')
    if (parts.length < 2) throw new Error('not a JWT')
    const decodePart = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    const result = {
      ok: true,
      action,
      format: 'jwt',
      header: decodePart(parts[0]),
      payload: decodePart(parts[1]),
      signature: parts[2] ? `${parts[2].slice(0, 24)}…` : null,
      note: parts[2] ? '仅解码，不验证签名' : '未签名 token',
      ms: Date.now() - started,
    }
    return result
  }
  if (action === 'decode') {
    const { buffer } = readInput(args)
    let raw = buffer
    if (!args.inputPath) raw = Buffer.from(buffer.toString('utf8').trim(), 'utf8')
    let out
    switch (format) {
      case 'base64': out = Buffer.from(raw.toString('utf8').replace(/\s+/g, ''), 'base64'); break
      case 'base64url': out = Buffer.from(raw.toString('utf8').replace(/\s+/g, ''), 'base64url'); break
      case 'hex': out = Buffer.from(raw.toString('utf8').replace(/[^0-9a-fA-F]/g, ''), 'hex'); break
      case 'url': out = Buffer.from(decodeURI(raw.toString('utf8')), 'utf8'); break
      case 'urlcomponent': out = Buffer.from(decodeURIComponent(raw.toString('utf8')), 'utf8'); break
      case 'html': out = Buffer.from(htmlDecode(raw.toString('utf8')), 'utf8'); break
      case 'unicode': out = Buffer.from(raw.toString('utf8').replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))), 'utf8'); break
      case 'gzip': out = zlib.gunzipSync(raw); break
      case 'deflate': out = zlib.inflateSync(raw); break
      case 'brotli': out = zlib.brotliDecompressSync(raw); break
      case 'base32': out = base32Decode(raw.toString('utf8')); break
      case 'base85': out = base85Decode(raw.toString('utf8')); break
      case 'quoted-printable': out = qpDecode(raw.toString('utf8')); break
      case 'xor': out = xorBuffer(Buffer.from(raw.toString('utf8').replace(/\s+/g, ''), 'hex'), args.key); break
      case 'base58': out = base58Decode(raw.toString('utf8')); break
      case 'rot13': out = Buffer.from(raw.toString('utf8').replace(/[a-zA-Z]/g, (char) => String.fromCharCode((char <= 'Z' ? 90 : 122) >= char.charCodeAt(0) + 13 ? char.charCodeAt(0) + 13 : char.charCodeAt(0) - 13)), 'utf8'); break
      case 'binary': {
        const bits = raw.toString('utf8').replace(/[^01]/g, '')
        const bytes = []
        for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
        out = Buffer.from(bytes)
        break
      }
      case 'utf16le': out = Buffer.from(raw.toString('utf8'), 'utf16le'); break
      case 'datauri': {
        const match = /^data:[^;,]*;base64,(.*)$/s.exec(raw.toString('utf8').trim())
        if (!match) throw new Error('not a base64 data URI')
        out = Buffer.from(match[1], 'base64')
        break
      }
      default: throw new Error(`unsupported decode format: ${format}`)
    }
    const written = writeOutput({ outPath: args.outPath, buffer: out })
    let text
    try { text = out.toString('utf8') } catch { text = out.toString('hex') }
    return {
      ok: true,
      action,
      format,
      bytesIn: raw.length,
      bytesOut: out.length,
      written,
      text: written ? undefined : preview(text),
      textLength: text.length,
      ms: Date.now() - started,
    }
  }
  const { buffer, source } = readInput(args)
  let out
  switch (format) {
    case 'base64': out = Buffer.from(buffer.toString('base64'), 'utf8'); break
    case 'base64url': out = Buffer.from(buffer.toString('base64url'), 'utf8'); break
    case 'hex': out = Buffer.from(buffer.toString('hex'), 'utf8'); break
    case 'url': out = Buffer.from(encodeURI(buffer.toString('utf8')), 'utf8'); break
    case 'urlcomponent': out = Buffer.from(encodeURIComponent(buffer.toString('utf8')), 'utf8'); break
    case 'html': out = Buffer.from(htmlEncode(buffer.toString('utf8')), 'utf8'); break
    case 'unicode': out = Buffer.from([...buffer.toString('utf8')].map((char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(''), 'utf8'); break
    case 'gzip': out = zlib.gzipSync(buffer, { level: 9 }); break
    case 'deflate': out = zlib.deflateSync(buffer, { level: 9 }); break
    case 'brotli': out = zlib.brotliCompressSync(buffer); break
    case 'base32': out = Buffer.from(base32Encode(buffer), 'utf8'); break
    case 'base85': out = Buffer.from(base85Encode(buffer), 'utf8'); break
    case 'quoted-printable': out = Buffer.from(qpEncode(buffer), 'utf8'); break
    case 'xor': out = Buffer.from(xorBuffer(buffer, args.key).toString('hex'), 'utf8'); break
    case 'base58': out = Buffer.from(base58Encode(buffer), 'utf8'); break
    case 'rot13': out = Buffer.from(buffer.toString('utf8').replace(/[a-zA-Z]/g, (char) => String.fromCharCode((char <= 'Z' ? 90 : 122) >= char.charCodeAt(0) + 13 ? char.charCodeAt(0) + 13 : char.charCodeAt(0) - 13)), 'utf8'); break
    case 'binary': out = Buffer.from([...buffer].map((byte) => byte.toString(2).padStart(8, '0')).join(''), 'utf8'); break
    case 'utf16le': out = Buffer.from(buffer.toString('utf8'), 'utf16le'); break
    case 'datauri': out = Buffer.from(`data:application/octet-stream;base64,${buffer.toString('base64')}`, 'utf8'); break
    default: throw new Error(`unsupported encode format: ${format}`)
  }
  const written = writeOutput({ outPath: args.outPath, buffer: out })
  return {
    ok: true,
    action,
    format,
    source,
    bytesIn: buffer.length,
    bytesOut: out.length,
    written,
    text: written ? undefined : preview(out.toString('utf8')),
    textLength: out.length,
    ms: Date.now() - started,
  }
}

/** Cheap format sniffing for the inspect action. */
export function detect(buffer) {
  const head = buffer.subarray(0, 16)
  const ascii = head.toString('latin1')
  if (head[0] === 0x89 && ascii.startsWith('\x89PNG')) return 'png'
  if (head[0] === 0xff && head[1] === 0xd8) return 'jpeg'
  if (ascii.startsWith('GIF8')) return 'gif'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ') return 'avi'
  if (ascii.slice(4, 8) === 'ftyp') return 'mp4'
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'matroska'
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  if (head[0] === 0x50 && head[1] === 0x4b) return 'zip'
  if (head[0] === 0x7f && ascii.startsWith('\x7fELF')) return 'elf'
  if (ascii.startsWith('MZ')) return 'pe'
  if (ascii.startsWith('{') || ascii.startsWith('[')) return 'json?'
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(buffer.toString('utf8').slice(0, 512))) return 'jwt?'
  return 'unknown'
}
