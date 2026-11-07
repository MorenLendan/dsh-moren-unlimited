/**
 * Web/OSINT research helpers for `moren_intel`.
 *
 * Uses the system curl binary so the same code path supports HTTP, HTTP proxies
 * and Tor's SOCKS5 (`socks5h://127.0.0.1:9050`) for .onion research. No network
 * client dependency is added to the plugin.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { morenHome, ensureDir } from './home.js'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function proxyArgs(proxy) {
  if (!proxy) return []
  const value = String(proxy)
  if (value.startsWith('socks5h://')) return ['--socks5-hostname', value.slice('socks5h://'.length)]
  if (value.startsWith('socks5://')) return ['--socks5-hostname', value.slice('socks5://'.length)]
  if (value.startsWith('socks4://')) return ['--socks4a', value.slice('socks4://'.length)]
  return ['--proxy', value]
}

export function httpGet(url, { proxy, timeout = 25, headers = {}, maxBytes = 4 * 1024 * 1024 } = {}) {
  const args = ['-sS', '-L', '--max-time', String(timeout), '--max-filesize', String(maxBytes), '-A', UA, ...proxyArgs(proxy)]
  for (const [key, value] of Object.entries(headers)) args.push('-H', `${key}: ${value}`)
  args.push(url)
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks = []
    let stderr = ''
    let size = 0
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch { /* ignore */ } }, (timeout + 5) * 1000)
    child.stdout.on('data', (chunk) => { size += chunk.length; if (size <= maxBytes + 1024 * 1024) chunks.push(chunk) })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); if (stderr.length > 4000) stderr = stderr.slice(-4000) })
    child.on('error', (error) => { clearTimeout(timer); reject(new Error(`curl: ${error.message}`)) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(`curl exit ${code}: ${stderr.slice(0, 300)}`))
      const body = Buffer.concat(chunks).toString('utf8')
      resolve({ status: 200, body, bytes: Buffer.byteLength(body), url })
    })
  })
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return named[body] ?? all
  })
}

export function stripHtml(html) {
  return decodeEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
}

function ddgResults(html, limit) {
  const results = []
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi
  let match
  while ((match = re.exec(html)) && results.length < limit) {
    let url = decodeEntities(match[1])
    const redirect = /[?&]uddg=([^&]+)/.exec(url)
    if (redirect) { try { url = decodeURIComponent(redirect[1]) } catch { /* ignore */ } }
    const snippet = stripHtml(match[3] || match[4] || '')
    const title = stripHtml(match[2] || '')
    if (url && title) results.push({ title, url, snippet })
  }
  return results
}

function bingResults(html, limit) {
  const results = []
  const blocks = String(html).split(/<li class="b_algo"/i).slice(1)
  for (const block of blocks) {
    if (results.length >= limit) break
    const link = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block)
    if (!link) continue
    const snippet = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block)
    results.push({ title: stripHtml(link[2]), url: decodeEntities(link[1]), snippet: stripHtml(snippet?.[1] || '') })
  }
  return results
}

export async function searchWeb(query, { engine = 'ddg', limit = 8, proxy } = {}) {
  const q = String(query || '').trim()
  if (!q) throw new Error('query required')
  const max = Math.max(1, Math.min(25, Number(limit) || 8))
  if (engine === 'github') {
    const headers = { Accept: 'application/vnd.github+json' }
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    const data = JSON.parse((await httpGet(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${max}`, { headers, proxy })).body)
    return {
      engine, query: q,
      results: (data.items || []).map((item) => ({ title: item.full_name, url: item.html_url, snippet: item.description || '', stars: item.stargazers_count })),
    }
  }
  if (engine === 'searx') {
    const base = String(process.env.MOREN_SEARX_URL || '').replace(/\/$/, '')
    if (!base) throw new Error('MOREN_SEARX_URL is empty')
    const data = JSON.parse((await httpGet(`${base}/search?q=${encodeURIComponent(q)}&format=json`, { proxy })).body)
    return { engine, query: q, results: (data.results || []).slice(0, max).map((item) => ({ title: item.title, url: item.url, snippet: item.content || '' })) }
  }
  const url = engine === 'bing'
    ? `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=${max}`
    : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
  const html = (await httpGet(url, { proxy })).body
  return { engine: engine === 'bing' ? 'bing' : 'ddg', query: q, results: engine === 'bing' ? bingResults(html, max) : ddgResults(html, max) }
}

export async function fetchPage(url, { proxy, limit = 12000 } = {}) {
  const target = String(url || '').trim()
  if (!/^https?:\/\//i.test(target)) throw new Error('http(s) url required')
  const host = (() => { try { return new URL(target).hostname } catch { return '' } })()
  if (host.endsWith('.onion') && !proxy) throw new Error('.onion requires proxy=socks5h://127.0.0.1:9050')
  const response = await httpGet(target, { proxy, headers: { Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' } })
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(response.body)?.[1]
  const text = stripHtml(response.body)
  return {
    url: target,
    title: stripHtml(title || ''),
    text: text.slice(0, Math.max(1000, Math.min(50000, Number(limit) || 12000))),
    textLength: text.length,
    bytes: response.bytes,
    sha256: crypto.createHash('sha256').update(response.body).digest('hex'),
  }
}

export function writeReport({ title, query, findings = [], notes = '' } = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const slug = String(title || query || 'report').replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]+/g, '-').slice(0, 60) || 'report'
  const dir = path.join(morenHome(), 'reports')
  ensureDir(dir)
  const file = path.join(dir, `${stamp}-${slug}.md`)
  const lines = [`# ${title || query || 'Research report'}`, '', `- generated: ${new Date().toISOString()}`, `- query: ${query || ''}`, '']
  for (const item of findings) {
    lines.push(`## ${item.title || 'Finding'}`, '', item.url ? `- URL: ${item.url}` : '', item.snippet ? `- ${item.snippet}` : '', item.text ? `\n${item.text}\n` : '', '')
  }
  if (notes) lines.push('## Notes', '', notes, '')
  fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 })
  return { ok: true, path: file, bytes: fs.statSync(file).size, findings: findings.length }
}
