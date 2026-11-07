window.__ModuleLoader__.load({
  id: 'dsh-moren-unlimited',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const ReactDOM = (() => { try { return require('react-dom') } catch { return null } })()
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    const NS = 'settings.dsh-moren-unlimited'
    const zh = {
      'entry.label': 'Moren',
      'page.title': 'Moren 无限制梁神模式',
      'page.subtitle': '无限制模式 × 无限制子任务 × 梁神模式',
      'tab.status': '状态',
      'tab.mode': '模式',
      'tab.wallpaper': '壁纸',
      'tab.rollback': '回退',
      'tab.tools': '能力',
      'tab.compat': '兼容',
      'tab.docs': '教程',
      'action.refresh': '刷新',
      'action.redeclare': '重新注册模式',
      'action.restore': '恢复',
      'state.loading': '读取中…',
      'state.error': '读取失败',
      'state.green': '全部就绪',
      'state.warn': '需要处理',
      'mode.hint': '新建会话时在模式/预设选择器里选择「Moren无限制梁神模式」。子代理默认进入「Moren无限制梁神模式 · 无限制子任务」。',
      'mode.select': '模式选择位置',
      'mode.selectBody': '新会话屏幕 → 预设选择器（与「梁神模式」「无限制模式」并列）。',
      'tools.hint': '这些工具只在 Moren 模式（含子任务预设）里出现。',
      'compat.hint': '本插件不改 dsh 源码、不写其它插件文件，因此 purge 与梁神模式可以同时开启。',
      'docs.hint': '完整文档在仓库 docs/ 下；下面是常用片段。',
    }
    const en = {
      'entry.label': 'Moren',
      'page.title': 'Moren unrestricted LiangShen mode',
      'page.subtitle': 'Unrestricted × unrestricted subagents × LiangShen',
      'tab.status': 'Status',
      'tab.mode': 'Mode',
      'tab.wallpaper': 'Wallpaper',
      'tab.rollback': 'Rollback',
      'tab.tools': 'Capabilities',
      'tab.compat': 'Compatibility',
      'tab.docs': 'Docs',
      'action.refresh': 'Refresh',
      'action.redeclare': 'Re-register mode',
      'action.restore': 'Restore',
      'state.loading': 'Loading…',
      'state.error': 'Failed to load',
      'state.green': 'All ready',
      'state.warn': 'Needs attention',
      'mode.hint': 'Pick “Moren unrestricted LiangShen mode” in the new-session preset picker. Subagents default to its unrestricted-subtask child preset.',
      'mode.select': 'Where to select',
      'mode.selectBody': 'New-session screen → preset picker, beside “LiangShen mode” and “Unrestricted”.',
      'tools.hint': 'These tools are registered on the Moren preset scope only (parent and child).',
      'compat.hint': 'No dsh source is patched and no other plugin file is written, so purge and LiangShen can stay enabled together.',
      'docs.hint': 'Full docs live under docs/ in the repository. Common snippets below.',
    }

    const CSS = `
.moren-page { box-sizing: border-box; height: 100%; min-height: 0; overflow: auto; padding: 22px 26px 48px; color: var(--dsw-alias-label-primary, currentColor); font: inherit; line-height: 1.55; }
.moren-page *, .moren-page *::before, .moren-page *::after { box-sizing: border-box; }
.moren-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.moren-glyph { width: 36px; height: 36px; border-radius: 11px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25)); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06)); display: flex; align-items: center; justify-content: center; flex: none; }
.moren-title h1 { margin: 0; font-size: 1.15em; font-weight: 650; letter-spacing: .01em; }
.moren-title p { margin: 2px 0 0; font-size: .86em; color: var(--dsw-alias-label-secondary, color-mix(in srgb, currentColor 62%, transparent)); }
.moren-strip { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 12px 0 12px; margin-top: 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22)); font-size: .86em; color: var(--dsw-alias-label-secondary, color-mix(in srgb, currentColor 62%, transparent)); }
.moren-strip b { color: var(--dsw-alias-label-primary, currentColor); font-weight: 600; }
.moren-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-label-secondary, #999); flex: none; }
.moren-dot.ok { background: var(--dsw-alias-state-success-primary, #1f9d55); }
.moren-dot.warn { background: var(--dsw-alias-state-warn-primary, #b7791f); }
.moren-dot.bad { background: var(--dsw-alias-state-error-primary, #d14343); }
.moren-tabs { display: flex; gap: 2px; margin: 10px 0 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22)); overflow-x: auto; }
.moren-tabs button { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #777); font: inherit; font-size: .92em; padding: 9px 12px 10px; border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; white-space: nowrap; }
.moren-tabs button[aria-selected="true"] { color: var(--dsw-alias-label-primary, currentColor); border-bottom-color: var(--dsw-alias-brand-primary, #4d6bfe); font-weight: 600; }
.moren-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 14px 0 4px; }
.moren-btn { font: inherit; font-size: .9em; border-radius: 8px; padding: 6px 12px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3)); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06)); color: var(--dsw-alias-label-primary, currentColor); cursor: pointer; white-space: nowrap; }
.moren-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2, rgba(127,127,127,.5)); }
.moren-btn:disabled { opacity: .45; cursor: not-allowed; }
.moren-btn.primary { background: var(--dsw-alias-brand-primary, #2f6b4f); border-color: var(--dsw-alias-brand-primary, #2f6b4f); color: #fff; font-weight: 600; }
.moren-btn.danger { color: var(--dsw-alias-state-error-primary, #a63b3b); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #a63b3b) 40%, transparent); }
.moren-btn.tiny { padding: 3px 9px; font-size: .8em; }
.moren-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 12px 0 4px; }
.moren-card { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22)); border-radius: 11px; background: var(--dsw-alias-bg-layer-1, transparent); padding: 13px 14px; min-width: 0; }
.moren-card h3 { margin: 0 0 8px; font-size: .95em; font-weight: 600; }
.moren-metric b { display: block; font-size: 1.08em; font-weight: 650; margin-bottom: 1px; overflow-wrap: anywhere; }
.moren-metric span { color: var(--dsw-alias-label-secondary, #777); font-size: .82em; }
.moren-sec { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22)); border-radius: 11px; background: var(--dsw-alias-bg-layer-1, transparent); padding: 14px 16px; margin-top: 12px; }
.moren-sec h2 { margin: 0 0 10px; font-size: 1em; font-weight: 650; }
.moren-sec p { margin: 0 0 8px; font-size: .9em; color: var(--dsw-alias-label-secondary, #777); }
.moren-line { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding: 6px 0; font-size: .9em; }
.moren-line + .moren-line { border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); }
.moren-line .name { min-width: 150px; font-weight: 550; }
.moren-line .val { color: var(--dsw-alias-label-secondary, #777); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .86em; overflow-wrap: anywhere; }
.moren-line .hint { color: var(--dsw-alias-label-secondary, #777); font-size: .84em; margin-left: auto; text-align: right; }
.moren-pill { display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3)); font-size: .8em; color: var(--dsw-alias-label-secondary, #777); }
.moren-pill.ok { color: var(--dsw-alias-state-success-primary, #1f9d55); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #1f9d55) 35%, transparent); }
.moren-pill.bad { color: var(--dsw-alias-state-error-primary, #d14343); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d14343) 40%, transparent); }
.moren-table { width: 100%; border-collapse: collapse; font-size: .86em; }
.moren-table th, .moren-table td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); vertical-align: top; overflow-wrap: anywhere; }
.moren-table th { color: var(--dsw-alias-label-secondary, #777); font-weight: 500; }
.moren-empty { padding: 18px 6px; text-align: center; color: var(--dsw-alias-label-secondary, #777); font-size: .9em; }
.moren-code { margin: 8px 0 0; padding: 10px 12px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.2)); overflow: auto; font: .84em/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
.moren-note { margin-top: 10px; font-size: .84em; color: var(--dsw-alias-label-secondary, #777); }
.moren-bad { color: var(--dsw-alias-state-error-primary, #d14343); white-space: pre-wrap; overflow-wrap: anywhere; font-size: .86em; }
.moren-ok { color: var(--dsw-alias-state-success-primary, #1f9d55); }
.moren-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--dsw-alias-border-l1, #bbb); border-top-color: var(--dsw-alias-brand-primary, #4d6bfe); border-radius: 50%; animation: moren-spin .8s linear infinite; }
@keyframes moren-spin { to { transform: rotate(360deg); } }
.moren-icon-btn { width: 18px; height: 18px; display: block; }
.moren-hero { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22)); border-radius: 12px; background: linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary, #2f6b4f) 9%, transparent), transparent 65%); padding: 14px 16px; margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.moren-hero .state { font-weight: 650; font-size: 1em; display: inline-flex; align-items: center; gap: 8px; }
.moren-hero .sub { color: var(--dsw-alias-label-secondary, #777); font-size: .85em; margin-left: auto; }
.moren-hero .ops { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
@media (max-width: 700px) { .moren-line .hint { margin-left: 0; text-align: left; } .moren-page { padding: 16px 14px 40px; } }
.moren-rewind-btn { appearance:none; display:inline-flex; align-items:center; gap:4px; height:28px; padding:0 8px; border:0; border-radius:8px; background:transparent; color:var(--dsw-alias-label-secondary, currentColor); font:12px/1 var(--ds-font-sans, system-ui, sans-serif); cursor:pointer; }
.moren-rewind-btn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); color:var(--dsw-alias-label-primary, currentColor); }
.moren-rewind-btn:disabled { opacity:.4; cursor:default; }
.moren-rewind-wrap { position:relative; display:inline-flex; align-items:center; gap:6px; }
.moren-rewind-menu { position:fixed; z-index:2147483000; box-sizing:border-box; min-width:248px; padding:4px; border-radius:12px; background:var(--dsw-specific-menu, #fff); color:var(--dsw-alias-label-primary, #1a1a1a); box-shadow:0 12px 32px rgba(0,0,0,.22); transform:translateY(-100%); }
.moren-rewind-item { display:flex; flex-direction:column; gap:2px; width:100%; padding:8px 10px; border:0; border-radius:8px; background:transparent; color:inherit; text-align:left; cursor:pointer; font:12px/1.35 var(--ds-font-sans, system-ui, sans-serif); }
.moren-rewind-item:hover { background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); }
.moren-rewind-item b { font-size:12.5px; font-weight:600; }
.moren-rewind-item span { color:var(--dsw-alias-label-secondary, #777); font-size:11px; }
.moren-rewind-note { max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary, #777); font-size:11px; }
.moren-wallpaper-preview { width: 100%; max-height: 260px; object-fit: cover; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25)); display: block; }
.moren-wallpaper-empty { padding: 28px 12px; text-align: center; color: var(--dsw-alias-label-secondary, #777); border: 1px dashed var(--dsw-alias-border-l1, rgba(127,127,127,.3)); border-radius: 10px; }
.moren-slider { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: .9em; }
.moren-slider input[type="range"] { flex: 1; min-width: 140px; accent-color: var(--dsw-alias-brand-primary, #2f6b4f); }
.moren-slider output { min-width: 48px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .86em; color: var(--dsw-alias-label-secondary, #777); }
.moren-select { font: inherit; color: var(--dsw-alias-label-primary, currentColor); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3)); border-radius: 8px; padding: 6px 10px; }
`

    const GLYPH = h('svg', { className: 'moren-icon-btn', viewBox: '0 0 64 64', 'aria-hidden': 'true' },
      h('path', { d: 'M14 46V20c0-2.6 3.2-3.5 4.6-1.3L32 39l13.4-20.3c1.4-2.2 4.6-1.3 4.6 1.3v26', fill: 'none', stroke: 'currentColor', strokeWidth: 5.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h('circle', { cx: 14, cy: 46, r: 3.1, fill: 'currentColor' }),
      h('circle', { cx: 50, cy: 46, r: 3.1, fill: 'currentColor' }))

    function Icon({ size = 16 } = {}) {
      return h('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true', style: { display: 'block' } },
        h('path', { d: 'M14 46V20c0-2.6 3.2-3.5 4.6-1.3L32 39l13.4-20.3c1.4-2.2 4.6-1.3 4.6 1.3v26', fill: 'none', stroke: 'currentColor', strokeWidth: 5.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('circle', { cx: 14, cy: 46, r: 3.1, fill: 'currentColor' }),
        h('circle', { cx: 50, cy: 46, r: 3.1, fill: 'currentColor' }))
    }

    function appBase() {
      try {
        if (document.baseURI) return document.baseURI
        if (window.location?.origin) return `${window.location.origin}/`
      } catch { /* ignore */ }
      return 'http://127.0.0.1/'
    }

    async function api(op, payload = {}) {
      const response = await fetch(new URL('dsh-moren/api', appBase()), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...payload }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`)
      return data
    }

    // Global wallpaper layer. Body's own background is cleared only while the
    // wallpaper is on; panels keep their layer backgrounds, so contrast stays.
    const WALLPAPER_CSS = `
html.moren-wallpaper {
  background-color: var(--dsw-alias-bg-base, #fff);
}
html.moren-wallpaper body {
  background: transparent !important;
  isolation: isolate;
}
html.moren-wallpaper body::before {
  content: "";
  position: fixed;
  inset: -48px;
  z-index: -2;
  pointer-events: none;
  background-image: var(--moren-wallpaper-image);
  background-size: var(--moren-wallpaper-size, cover);
  background-position: center center;
  background-repeat: no-repeat;
  opacity: var(--moren-wallpaper-opacity, 1);
  filter: blur(var(--moren-wallpaper-blur, 0px));
  transform: scale(1.03);
}
html.moren-wallpaper body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: rgba(0, 0, 0, var(--moren-wallpaper-dim, 0));
}
html.moren-wallpaper #root {
  position: relative;
  z-index: 0;
  background: transparent !important;
}
html.moren-wallpaper #root > div {
  background-color: transparent !important;
}
html.moren-wallpaper [class*="_frame"],
html.moren-wallpaper [class*="_centerCol"],
html.moren-wallpaper [class*="_mainPanel"],
html.moren-wallpaper [class*="_root"][data-phase],
html.moren-wallpaper [data-conversation-content] {
  background: transparent !important;
}
`

    function paintWallpaper(settings) {
      try {
        const root = document.documentElement
        const enabled = Boolean(settings?.enabled && settings?.url)
        root.classList.toggle('moren-wallpaper', enabled)
        if (!enabled) {
          for (const name of ['--moren-wallpaper-image', '--moren-wallpaper-opacity', '--moren-wallpaper-blur', '--moren-wallpaper-dim', '--moren-wallpaper-size']) {
            root.style.removeProperty(name)
          }
          return
        }
        root.style.setProperty('--moren-wallpaper-image', `url("${new URL(settings.url, appBase()).href}")`)
        root.style.setProperty('--moren-wallpaper-opacity', String(Math.max(0, Math.min(100, Number(settings.opacity ?? 100))) / 100))
        root.style.setProperty('--moren-wallpaper-blur', `${Math.max(0, Math.min(40, Number(settings.blur ?? 0)))}px`)
        root.style.setProperty('--moren-wallpaper-dim', String(Math.max(0, Math.min(90, Number(settings.dim ?? 25))) / 100))
        root.style.setProperty('--moren-wallpaper-size', settings.fit === 'contain' ? 'contain' : 'cover')
      } catch { /* non-browser context */ }
    }

    async function loadWallpaper() {
      const data = await api('wallpaper')
      paintWallpaper(data)
      return data
    }

    function Pill({ ok, text }) {
      return h('span', { className: `moren-pill ${ok ? 'ok' : 'bad'}` }, ok ? '●' : '○', text)
    }

    function Line({ name, ok, value, hint }) {
      return h('div', { className: 'moren-line' },
        h('span', { className: `moren-dot ${ok ? 'ok' : 'bad'}` }),
        h('span', { className: 'name' }, name),
        h('span', { className: 'val' }, value ?? '—'),
        hint ? h('span', { className: 'hint' }, hint) : null)
    }

    function Card({ title, children }) {
      return h('section', { className: 'moren-sec' }, h('h2', null, title), children)
    }

    function Status({ data }) {
      const checks = data.checks ?? []
      const token = data.tokenGuard ?? {}
      return h(React.Fragment, null,
        h('div', { className: 'moren-grid' },
          h('div', { className: 'moren-card moren-metric' }, h('b', null, data.presets?.parent?.registered ? '已注册' : '未注册'), h('span', null, 'Moren无限制梁神模式')),
          h('div', { className: 'moren-card moren-metric' }, h('b', null, data.presets?.child?.registered ? '已注册' : '未注册'), h('span', null, '无限制子任务预设')),
          h('div', { className: 'moren-card moren-metric' }, h('b', null, data.rea?.installed ? '229 tools' : '未安装'), h('span', null, 'REA 逆向 MCP')),
          h('div', { className: 'moren-card moren-metric' }, h('b', null, `${token.hitRate ?? 0}%`), h('span', null, `令牌守卫命中 · 省 ${token.savedTokens ?? 0} tokens`))),
        h(Card, { title: '逐项检查' },
          checks.map((check) => h(Line, { key: check.id, name: check.label, ok: check.ok, value: check.value, hint: check.hint }))),
        h(Card, { title: '这个模式做了什么' },
          h('p', null, 'Agent 平面：无限制人设 + 梁神 minimal-prompt / PTC 工具面 / 工具分页 / 事实登记 / 子任务路由守卫 + 深度 10 的子代理。宿主平面：不改 dsh 源码；purge 的宿主补丁仍由 purge 自己应用。'),
          h('p', null, '会话进入本模式时审批策略设为 never（仅本模式会话）；沙箱仍由 profile 决定，避免与其它插件抢同一道闸。')))
    }

    function Mode({ data }) {
      const presets = data.presets ?? {}
      return h(React.Fragment, null,
        h(Card, { title: '模式选择' },
          h('p', null, '新建会话 → 预设选择器 → “Moren无限制梁神模式”。它与「梁神模式」「无限制模式」并列出现，可同时保留。'),
          h(Line, { name: '父预设', ok: presets.parent?.registered, value: presets.parent?.id }),
          h(Line, { name: '子预设', ok: presets.child?.registered, value: presets.child?.id }),
          h(Line, { name: '子代理深度', ok: true, value: String(presets.maxDepth ?? 10) }),
          h(Line, { name: '工具呈现', ok: true, value: presets.presentation === 'native' ? 'native' : 'ptc (run_code)' }),
          h(Line, { name: '梁神调度块', ok: true, value: presets.dispatcher ? '开' : '关（省 Token）', hint: 'profile patch 里改 dispatcher: true' })),
        h(Card, { title: '切换与共存' },
          h('p', null, 'purge 与梁神模式插件保持开启即可；本插件只注册自己的预设 id，不覆盖它们的行。两边的模式仍然可以单独选择。'),
          h('pre', { className: 'moren-code' }, `# 让宿主重新注册本模式（改了配置后）\ncurl -s -X POST http://127.0.0.1:3080/dsh-moren/api -H 'content-type: application/json' -d '{"op":"redeclare"}'`)))
    }

    function Rollback({ onRewind, rewindBusy }) {
      return h(Card, { title: '对话回退' },
        h('p', null, '调用 DSH 的 /rewind：切到保留之前上下文的新会话，并把那句放回输入框。'),
        h('div', { className: 'moren-actions' },
          h('button', { className: 'moren-btn primary', disabled: rewindBusy, onClick: () => onRewind('once') }, rewindBusy ? h('span', { className: 'moren-spin' }) : '回退上一步'),
          h('button', { className: 'moren-btn', disabled: rewindBusy, onClick: () => onRewind('round') }, '回退上一轮（含子代理）'),
          h('button', { className: 'moren-btn danger', disabled: rewindBusy, onClick: () => onRewind('all') }, '全部回退')),
        h('p', { className: 'moren-note' }, '输入框右侧「回退 ▾」也提供同样三个选项。'))
    }

    const TOOL_ROWS = [
      ['moren_media_inspect', '图片/视频识别：尺寸、时长、主色、averageHash、关键帧路径（ffmpeg）'],
      ['moren_image_generate', '本地确定性 PNG 生图：同一 prompt/seed 同一张图'],
      ['moren_codec', 'base64/hex/gzip/brotli/base32/base58/JWT/哈希；文件进文件出'],
      ['moren_token_audit', 'Token 估算、压缩建议、compact 写文件'],
    ]

    function Tools({ data }) {
      return h(Card, { title: '能力（仅本模式可见）' },
        h('p', null, '这些工具注册在父/子预设作用域里，其它模式看不到，避免工具面互相污染。'),
        TOOL_ROWS.map(([name, desc]) => h(Line, { key: name, name, ok: true, value: '', hint: desc })),
        h('p', { className: 'moren-note' }, `令牌守卫阈值 ${data.tokenGuard?.thresholdChars ?? 24000} 字符；超过后完整内容写到 $DSH_HOME/moren/spill，模型只看到头/尾与路径。`))
    }

    function Compat({ data }) {
      const purge = data.purge ?? {}
      const liang = data.liangshen ?? {}
      return h(React.Fragment, null,
        h(Card, { title: '插件共存' },
          h(Line, { name: 'dsh-purge', ok: purge.installed, value: purge.version ? `v${purge.version}` : '未安装', hint: '无限制模式 / 无限制子任务来源' }),
          h(Line, { name: 'dsh-liangshen', ok: liang.installed, value: liang.version ? `v${liang.version}` : '未安装', hint: '梁神模式' }),
          h(Line, { name: 'DSH', ok: true, value: data.dsh?.version ? `v${data.dsh.version}` : '未知' }),
          h('p', { className: 'moren-note' }, '兼容策略：唯一预设 id + 唯一面板 id + 不改宿主源码 + 不写其它插件的文件。purge 的宿主补丁由其自己的面板应用，本插件不抢这个开关。')),
        h(Card, { title: 'REA 逆向' },
          h('p', null, 'REA 以 MCP 接入，命名空间 mcp__rea__*；进入会话后先 tool_activate({ namespace: "rea" })。229 个逆向工具，覆盖二进制、JS/Electron、.NET、Web、原生 UI。')))
    }

    function Docs({ data }) {
      const repo = 'https://github.com/MorenLendan/dsh-moren-unlimited'
      return h(React.Fragment, null,
        h(Card, { title: '安装' },
          h('pre', { className: 'moren-code' }, `# 1) 安装 DSH（已有可跳过）\nnpm i -g @deepseek-ai/dsh\n\n# 2) 安装本插件（本地目录）\ndsh plugin --profile web add link:/path/to/dsh-moren-unlimited\n\n# 或用 git\ndsh plugin --profile web add git+${repo}.git\n\n# 3) 重启 dsh web`),
          h('p', { className: 'moren-note' }, '也可以把目录放到 profile 后用 DSH 插件管理器 install_bundle 安装；本插件无构建步骤、无 npm 依赖。')),
        h(Card, { title: '使用' },
          h('p', null, '新建会话 → 选「Moren无限制梁神模式」→ 直接派活。复杂任务会自动用 subagent 进入子预设；子代理最多 10 层。'),
          h('pre', { className: 'moren-code' }, `# 逆向先激活 REA 命名空间\ntool_activate({ namespace: "rea" })\n\n# 识别视频并抽帧\nmoren_media_inspect({ path: "/data/demo.mp4", frames: 6 })\n\n# 生成图片\nmoren_image_generate({ prompt: "墨绿极光，铜色点缀", width: 1024, height: 768 })`)),
        h(Card, { title: '回退（对话）' },
          h('pre', { className: 'moren-code' }, `# 输入框右侧 回退 ▾\n# 或 Moren → 回退\n# 或直接命令\n/rewind once\n/rewind round`)))
    }

    /**
     * dsh-purge's rewind button is registered into
     * `conversation.input.right` and resolves the active session through
     * `uiWorkspace.selection`. DSH 0.2.2 removed that field, so the button's
     * `sessionId` stays empty and the click is a no-op. Expose the old shape on
     * the live service (read-only, derived from the Session controller) so the
     * purge button works without patching purge's bundle.
     */
    function installPurgeRewindCompat(host) {
      const workspace = host.uiWorkspace
      const sessions = host.sessions
      const uiSession = host.uiSession || host.get?.('uiSession')
      if (!workspace || !sessions || workspace.selection) return () => {}
      const activeSessionId = () => {
        try {
          const current = uiSession?.current?.getSnapshot?.()
          if (typeof current?.key === 'string' && current.key) return current.key
          if (typeof uiSession?.current?.value?.key === 'string' && uiSession.current.value.key) return uiSession.current.value.key
        } catch { /* fall through */ }
        try {
          const snapshot = sessions.list?.getSnapshot?.()
          if (typeof snapshot?.current === 'string' && snapshot.current) return snapshot.current
          const rows = Object.values(snapshot?.byId ?? {})
          const main = rows.find((row) => (row?.retainedBy?.mainView ?? 0) > 0)
          if (main?.id) return main.id
          const first = rows.find((row) => typeof row?.id === 'string')
          return first?.id ?? ''
        } catch {
          return ''
        }
      }
      const selection = { getSnapshot: () => ({ sessionId: activeSessionId() }) }
      try {
        Object.defineProperty(workspace, 'selection', { value: selection, configurable: true })
        return () => {
          try {
            if (workspace.selection === selection) delete workspace.selection
          } catch { /* ignore */ }
        }
      } catch {
        try {
          workspace.selection = selection
          return () => {
            try { if (workspace.selection === selection) delete workspace.selection } catch { /* ignore */ }
          }
        } catch {
          return () => {}
        }
      }
    }

    function MorenRewind({ onRewind }) {
      const [busy, setBusy] = useState(false)
      const [open, setOpen] = useState(false)
      const [notice, setNotice] = useState('')
      const [pos, setPos] = useState(null)
      const btnRef = useRef(null)
      const run = async (mode) => {
        if (busy) return
        setOpen(false)
        setBusy(true)
        setNotice('')
        try {
          const result = await onRewind(mode)
          if (!result?.cancelled) setNotice(mode === 'all' ? `已回退 ${result?.rounds ?? 0} 轮` : '已回退')
        } catch (cause) {
          setNotice(String(cause?.message ?? cause))
        } finally {
          setBusy(false)
        }
      }
      const toggle = (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!open) {
          const rect = btnRef.current?.getBoundingClientRect?.()
          if (rect) setPos({ left: Math.max(8, rect.right - 260), top: Math.max(8, rect.top - 8) })
        }
        setOpen((value) => !value)
      }
      const item = (mode, label, hint) => h('button', {
        type: 'button',
        className: 'moren-rewind-item',
        onMouseDown: (event) => event.preventDefault(),
        onClick: (event) => { event.preventDefault(); event.stopPropagation(); run(mode) },
      }, h('b', null, label), h('span', null, hint))
      const menu = open ? h('div', {
        className: 'moren-rewind-menu',
        role: 'menu',
        style: { left: `${pos?.left ?? 8}px`, top: `${pos?.top ?? 8}px` },
      },
        item('once', '回退上一步', '撤回最后一步，保留之前的上下文'),
        item('round', '回退上一轮', '整轮撤回，包含本轮子代理'),
        item('all', '全部回退', '反复回退上一轮，直到没有可撤内容')) : null
      return h('div', { className: 'moren-rewind-wrap' },
        h('button', {
          ref: btnRef,
          type: 'button',
          className: 'moren-rewind-btn',
          title: notice || '回退：上一步 / 上一轮 / 全部',
          disabled: busy,
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onMouseDown: (event) => event.preventDefault(),
          onClick: toggle,
        }, busy ? '回退中…' : '回退 ▾'),
        menu && ReactDOM?.createPortal ? ReactDOM.createPortal(menu, document.body) : menu,
        notice ? h('span', { className: 'moren-rewind-note' }, notice) : null)
    }

    function Wallpaper({ data, notify, refresh }) {
      const current = data.wallpaper ?? {}
      const [opacity, setOpacity] = useState(current.opacity ?? 100)
      const [blur, setBlur] = useState(current.blur ?? 0)
      const [dim, setDim] = useState(current.dim ?? 25)
      const [fit, setFit] = useState(current.fit === 'contain' ? 'contain' : 'cover')
      const [busy, setBusy] = useState(false)

      useEffect(() => {
        setOpacity(current.opacity ?? 100)
        setBlur(current.blur ?? 0)
        setDim(current.dim ?? 25)
        setFit(current.fit === 'contain' ? 'contain' : 'cover')
      }, [current.url, current.opacity, current.blur, current.dim, current.fit])

      const upload = (file) => {
        if (!file) return
        if (file.size > 20 * 1024 * 1024) {
          notify({ ok: false, text: '图片超过 20MB 限制' })
          return
        }
        const reader = new FileReader()
        reader.onload = async () => {
          setBusy(true)
          try {
            const next = await api('wallpaper-upload', { data: String(reader.result || ''), mime: file.type, name: file.name })
            paintWallpaper(next)
            notify({ ok: true, text: `壁纸已上传：${file.name}` })
            await refresh()
          } catch (cause) {
            notify({ ok: false, text: String(cause?.message ?? cause) })
          } finally {
            setBusy(false)
          }
        }
        reader.onerror = () => notify({ ok: false, text: '读取图片失败' })
        reader.readAsDataURL(file)
      }

      const save = async (enabled = true) => {
        setBusy(true)
        try {
          const next = await api('wallpaper-settings', { enabled, opacity, blur, dim, fit })
          paintWallpaper(next)
          notify({ ok: true, text: enabled ? '壁纸设置已应用' : '壁纸已关闭' })
          await refresh()
        } catch (cause) {
          notify({ ok: false, text: String(cause?.message ?? cause) })
        } finally {
          setBusy(false)
        }
      }

      const clear = async () => {
        if (!window.confirm('删除当前壁纸并关闭？')) return
        setBusy(true)
        try {
          const next = await api('wallpaper-clear')
          paintWallpaper(next)
          notify({ ok: true, text: '壁纸已清除' })
          await refresh()
        } catch (cause) {
          notify({ ok: false, text: String(cause?.message ?? cause) })
        } finally {
          setBusy(false)
        }
      }

      return h(React.Fragment, null,
        h(Card, { title: 'DSH 壁纸' },
          current.url
            ? h('img', { className: 'moren-wallpaper-preview', src: current.url, alt: '当前壁纸' })
            : h('div', { className: 'moren-wallpaper-empty' }, '还没有自定义壁纸。上传一张图片即可作为 DSH Web 的背景。'),
          h('div', { className: 'moren-actions' },
            h('label', {
              className: 'moren-btn primary',
              style: { cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.55 : 1 },
            },
              busy ? h('span', { className: 'moren-spin' }) : (current.url ? '更换图片' : '上传图片'),
              h('input', {
                type: 'file',
                accept: 'image/png,image/jpeg,image/webp,image/gif',
                style: { display: 'none' },
                disabled: busy,
                onChange: (event) => { const file = event.target.files?.[0]; event.target.value = ''; upload(file) },
              })),
            h('button', { className: 'moren-btn', disabled: busy || !current.url, onClick: clear }, '清除壁纸')),
          h('p', { className: 'moren-note' }, '支持 PNG / JPEG / WebP / GIF，最大 20MB；文件保存在 $DSH_HOME/moren/wallpaper，刷新页面后仍然生效。'),
          current.url ? h('p', { className: 'moren-note' }, `当前：${current.name || current.file} · ${Math.round((current.size || 0) / 1024)} KB · ${current.enabled ? '已启用' : '已关闭'}`) : null),
        h(Card, { title: '显示参数' },
          h('label', { className: 'moren-slider' },
            h('span', null, '不透明度'), h('input', { type: 'range', min: 10, max: 100, value: opacity, onChange: (event) => setOpacity(Number(event.target.value)) }), h('output', null, `${opacity}%`)),
          h('label', { className: 'moren-slider' },
            h('span', null, '模糊'), h('input', { type: 'range', min: 0, max: 40, value: blur, onChange: (event) => setBlur(Number(event.target.value)) }), h('output', null, `${blur}px`)),
          h('label', { className: 'moren-slider' },
            h('span', null, '压暗'), h('input', { type: 'range', min: 0, max: 90, value: dim, onChange: (event) => setDim(Number(event.target.value)) }), h('output', null, `${dim}%`)),
          h('div', { className: 'moren-actions' },
            h('label', { className: 'moren-line', style: { border: 0, padding: 0, margin: 0 } },
              h('span', { className: 'name' }, '铺满方式'),
              h('select', { className: 'moren-select', value: fit, onChange: (event) => setFit(event.target.value) },
                h('option', { value: 'cover' }, '铺满（cover）'),
                h('option', { value: 'contain' }, '完整显示（contain）'))),
            h('button', { className: 'moren-btn primary', disabled: busy || !current.url, onClick: () => save(true) }, '应用设置'),
            h('button', { className: 'moren-btn', disabled: busy || !current.url, onClick: () => save(false) }, '关闭壁纸'))),
        h(Card, { title: '说明' },
          h('p', null, '壁纸是纯 CSS 背景层：不改 DSH 前端代码、不写 DOM 组件，只给 body 加一个固定背景层。面板与文字仍使用主题层背景，压暗可提高可读性。'),
          h('p', { className: 'moren-note' }, '如果你在使用桌面客户端而不是 Web，这个入口只在 Web GUI 生效。')))
    }

    function Page({ onRewind } = {}) {
      const [tab, setTab] = useState('status')
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)
      const [rewindBusy, setRewindBusy] = useState(false)

      const load = useCallback(async () => {
        try {
          setError(null)
          const next = await api('status')
          setData(next)
          paintWallpaper(next.wallpaper)
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }, [])

      useEffect(() => { load() }, [load])

      const run = useCallback(async (op, payload = {}) => {
        setBusy(true)
        setNotice(null)
        try {
          const result = await api(op, payload)
          setNotice({ ok: true, text: op === 'redeclare' ? '模式已重新注册' : '完成' })
          await load()
        } catch (cause) {
          setNotice({ ok: false, text: String(cause?.message ?? cause) })
        } finally {
          setBusy(false)
        }
      }, [load])

      const doRewind = useCallback(async (mode = 'once') => {
        if (!onRewind) return
        setRewindBusy(true)
        setNotice(null)
        try {
          const result = await onRewind(mode)
          if (result?.cancelled) return
          setNotice({ ok: true, text: mode === 'all' ? `全部回退完成：${result?.rounds ?? 0} 轮` : mode === 'round' ? '已回退上一轮（含子代理）' : '已回退上一步' })
          await load()
        } catch (cause) {
          setNotice({ ok: false, text: String(cause?.message ?? cause) })
        } finally {
          setRewindBusy(false)
        }
      }, [onRewind, load])

      const tabs = [
        ['status', '状态'], ['mode', '模式'], ['wallpaper', '壁纸'], ['rollback', '回退'], ['tools', '能力'], ['compat', '兼容'], ['docs', '教程'],
      ]
      const healthy = data?.summary?.allGreen
      return h('div', { className: 'moren-page' },
        h('style', null, CSS),
        h('div', { className: 'moren-head' },
          h('span', { className: 'moren-glyph' }, GLYPH),
          h('div', { className: 'moren-title' },
            h('h1', null, 'Moren 无限制梁神模式'),
            h('p', null, '无限制模式 × 无限制子任务 × 梁神模式 · 原生预设 + 媒体/编码/回退工具'))),
        h('div', { className: 'moren-strip' },
          h('span', null, h('b', null, '模式'), data?.presets?.parent?.registered ? ' 已注册' : ' 未注册'),
          h('span', null, h('b', null, 'REA'), data?.rea?.installed ? ' 已安装' : ' 未安装'),
          h('span', null, h('b', null, 'purge'), data?.purge?.installed ? ` v${data.purge.version}` : ' 未安装'),
          h('span', null, h('b', null, '梁神'), data?.liangshen?.installed ? ` v${data.liangshen.version}` : ' 未安装'),
          h('span', null, h('b', null, 'DSH'), data?.dsh?.version ? ` v${data.dsh.version}` : ' ?')),
        h('div', { className: 'moren-hero' },
          h('span', { className: 'state' },
            h('span', { className: `moren-dot ${healthy ? 'ok' : 'warn'}` }),
            healthy ? '全部就绪' : (data ? '需要处理' : '读取中…')),
          h('span', { className: 'sub' }, data ? `v${data.plugin?.version ?? ''} · ${data.profile ?? ''}` : ''),
          h('div', { className: 'ops' },
            h('button', { className: 'moren-btn primary', disabled: busy, onClick: () => run('redeclare') }, '重新注册模式'),
            h('button', { className: 'moren-btn', disabled: busy, onClick: load }, '刷新'))),
        notice ? h('p', { className: notice.ok ? 'moren-ok' : 'moren-bad' }, notice.text) : null,
        error ? h('p', { className: 'moren-bad' }, `读取失败：${error}`) : null,
        h('div', { className: 'moren-tabs', role: 'tablist' },
          tabs.map(([id, label]) => h('button', {
            key: id, role: 'tab', 'aria-selected': tab === id, onClick: () => setTab(id),
          }, label))),
        !data && !error ? h('div', { className: 'moren-empty' }, h('span', { className: 'moren-spin' }), ' 读取中…') : null,
        data && tab === 'status' ? h(Status, { data }) : null,
        data && tab === 'mode' ? h(Mode, { data }) : null,
        data && tab === 'wallpaper' ? h(Wallpaper, { data, notify: setNotice, refresh: load }) : null,
        data && tab === 'rollback' ? h(Rollback, { onRewind: doRewind, rewindBusy }) : null,
        data && tab === 'tools' ? h(Tools, { data }) : null,
        data && tab === 'compat' ? h(Compat, { data }) : null,
        data && tab === 'docs' ? h(Docs, { data }) : null,
        h('p', { className: 'moren-note', style: { marginTop: '24px' } }, 'dsh-moren-unlimited · Apache-2.0 · 内含 Apache-2.0 的 LiangShen 预设模块（见 NOTICE）'))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'moren: locale')

        ctx.effect(() => {
          const style = document.createElement('style')
          style.id = 'moren-wallpaper-style'
          style.textContent = WALLPAPER_CSS
          document.head.appendChild(style)
          loadWallpaper().catch(() => {})
          return () => {
            style.remove()
            document.documentElement.classList.remove('moren-wallpaper')
            for (const name of ['--moren-wallpaper-image', '--moren-wallpaper-opacity', '--moren-wallpaper-blur', '--moren-wallpaper-dim', '--moren-wallpaper-size']) {
              document.documentElement.style.removeProperty(name)
            }
          }
        }, 'moren: wallpaper layer')
        const t = ctx.locale.bind(NS)

        const currentSessionId = () => {
          try {
            const id = ctx.get('uiSession')?.current?.getSnapshot?.()?.key
            if (id) return id
          } catch { /* ignore */ }
          try {
            const snapshot = ctx.get('sessions')?.list?.getSnapshot?.()
            const rows = Object.values(snapshot?.byId ?? {})
            return rows.find((row) => (row?.retainedBy?.mainView ?? 0) > 0)?.id ?? ''
          } catch { return '' }
        }
        const postRewind = async (id, mode) => {
          let data
          try {
            const response = await fetch(new URL('dsh-purge/rewind', appBase()), {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionId: id, mode }),
            })
            data = await response.json().catch(() => ({}))
            if (!response.ok || !data?.ok || data.cleared === false) {
              throw new Error(data?.error || `回退失败 HTTP ${response.status}`)
            }
          } catch (cause) {
            if (!ctx.remote?.commands?.execute) throw cause
            const result = await ctx.remote.commands.execute(id, `/rewind ${mode}`, [])
            if (result && (result.ok === false || result.kind === 'error')) {
              throw new Error(result.text || result.error || '回退失败')
            }
            return { ok: true, sessionId: id, text: result?.text || '', via: 'command' }
          }
          const target = data.sessionId || id
          try {
            const conversation = ctx.get('conversation')
            const sessions = ctx.get('sessions')
            const scope = sessions?.scope?.(target)
            const input = conversation?.input?.shell?.(target) || conversation?.input?.for?.(scope)
            if (data?.text) input?.setDraft?.(data.text)
          } catch { /* draft is best effort */ }
          try { ctx.get('uiWorkspace')?.openSession?.(target) } catch { /* ignore */ }
          return data
        }

        const onRewind = async (mode = 'once') => {
          const action = mode === 'round' ? 'round' : mode === 'all' ? 'all' : 'once'
          let id = currentSessionId()
          if (!id) throw new Error('没有当前会话')
          if (action !== 'all') return postRewind(id, action)
          if (typeof window !== 'undefined' && !window.confirm('全部回退会反复撤销上一轮，直到没有可回退内容。继续？')) {
            return { cancelled: true, rounds: 0 }
          }
          let rounds = 0
          let target = id
          while (rounds < 30) {
            try {
              const data = await postRewind(target, 'round')
              rounds += 1
              target = data?.sessionId || currentSessionId() || target
              await new Promise((resolve) => setTimeout(resolve, 250))
              const current = currentSessionId()
              if (current) target = current
            } catch (cause) {
              if (rounds === 0) throw cause
              break
            }
          }
          return { all: true, rounds }
        }

        // Install as early as possible (before the conversation composer first
        // renders), then re-check once the optional services are injected.
        const immediate = (() => {
          try {
            const workspace = ctx.get('uiWorkspace')
            const sessions = ctx.get('sessions')
            if (!workspace || !sessions) return undefined
            return installPurgeRewindCompat({ uiWorkspace: workspace, sessions, uiSession: ctx.get('uiSession') })
          } catch {
            return undefined
          }
        })()
        if (immediate) ctx.effect(() => immediate, 'moren: purge rewind session shim (early)')
        ctx.inject(['uiWorkspace', 'sessions'], (host) => {
          host.effect(() => installPurgeRewindCompat(host), 'moren: purge rewind session shim')
        })

        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'moren-rewind',
          order: 21,
          inject: () => ({ onRewind }),
        }, MorenRewind))

        // The purge undo button is disabled on DSH 0.2.2 because it resolves
        // the session through the removed uiWorkspace.selection. Moren's button
        // above is the working replacement; hide the broken one when present.
        ctx.effect(() => {
          const style = document.createElement('style')
          style.id = 'moren-rewind-replace'
          style.textContent = '.dshp-rewind-wrap{display:none!important}[data-dsh-purge-rewind-host]{display:none!important}'
          document.head.appendChild(style)
          return () => style.remove()
        }, 'moren: replace purge rewind button')

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'moren-unlimited',
          order: 31,
          label: 'Moren',
          inject: () => ({ t }),
        }, Icon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'moren-unlimited',
          inject: () => ({ t, onRewind }),
        }, Page))
      },
    }
  },
})
