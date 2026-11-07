window.__ModuleLoader__.load({
  id: 'dsh-moren-unlimited',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo } = React

    const NS = 'settings.dsh-moren-unlimited'
    const zh = {
      'entry.label': 'Moren',
      'page.title': 'Moren 无限制梁神模式',
      'page.subtitle': '无限制模式 × 无限制子任务 × 梁神模式',
      'tab.status': '状态',
      'tab.mode': '模式',
      'tab.rollback': '回退',
      'tab.tools': '能力',
      'tab.compat': '兼容',
      'tab.docs': '教程',
      'action.refresh': '刷新',
      'action.snapshot': '创建快照',
      'action.verify': '校验回退',
      'action.repair': '修复回退',
      'action.redeclare': '重新注册模式',
      'action.restore': '恢复',
      'action.prune': '清理旧快照',
      'state.loading': '读取中…',
      'state.error': '读取失败',
      'state.green': '全部就绪',
      'state.warn': '需要处理',
      'mode.hint': '新建会话时在模式/预设选择器里选择「Moren无限制梁神模式」。子代理默认进入「Moren无限制梁神模式 · 无限制子任务」。',
      'mode.select': '模式选择位置',
      'mode.selectBody': '新会话屏幕 → 预设选择器（与「梁神模式」「无限制模式」并列）。',
      'rollback.hint': '快照覆盖 profile 的 cordis.patch.yml、package.json、prompt-inject.md、已安装 agent 预设与 purge override 状态。恢复前会先自动再做一份 pre-restore 快照。',
      'rollback.empty': '还没有快照。点「创建快照」建立健康基线。',
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
      'tab.rollback': 'Rollback',
      'tab.tools': 'Capabilities',
      'tab.compat': 'Compatibility',
      'tab.docs': 'Docs',
      'action.refresh': 'Refresh',
      'action.snapshot': 'Create snapshot',
      'action.verify': 'Verify rollback',
      'action.repair': 'Repair rollback',
      'action.redeclare': 'Re-register mode',
      'action.restore': 'Restore',
      'action.prune': 'Prune old snapshots',
      'state.loading': 'Loading…',
      'state.error': 'Failed to load',
      'state.green': 'All ready',
      'state.warn': 'Needs attention',
      'mode.hint': 'Pick “Moren unrestricted LiangShen mode” in the new-session preset picker. Subagents default to its unrestricted-subtask child preset.',
      'mode.select': 'Where to select',
      'mode.selectBody': 'New-session screen → preset picker, beside “LiangShen mode” and “Unrestricted”.',
      'rollback.hint': 'Snapshots cover the profile cordis.patch.yml, package.json, prompt-inject.md, installed agent presets and purge override state. Restore creates a pre-restore snapshot first.',
      'rollback.empty': 'No snapshots yet. Create one to lay down a healthy baseline.',
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

    async function api(op, payload = {}) {
      const response = await fetch('/dsh-moren/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...payload }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`)
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
          h('div', { className: 'moren-card moren-metric' }, h('b', null, data.rollback?.healthy ? '健康' : '不可用'), h('span', null, `Moren 回退 · ${data.rollback?.count ?? 0} 份快照`)),
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

    function Rollback({ data, run, busy }) {
      const rollback = data.rollback ?? {}
      const snapshots = rollback.snapshots ?? []
      const purge = rollback.purge ?? {}
      return h(React.Fragment, null,
        h(Card, { title: '回退状态' },
          h(Line, { name: 'Moren 回退', ok: rollback.healthy, value: rollback.healthy ? '可用' : '不可用', hint: rollback.dir }),
          h(Line, { name: 'dsh-purge 宿主备份', ok: purge.available, value: purge.available ? `${purge.backup_files} 个 .bak` : '无', hint: purge.hint }),
          h(Line, { name: '其它回退', ok: (rollback.existing ?? []).length > 0, value: (rollback.existing ?? []).length > 0 ? `${rollback.existing.length} 处` : '未发现', hint: (rollback.existing ?? []).map((item) => item.path).join('、') }),
          h(Line, { name: '自动检查', ok: rollback.state?.ok !== false, value: rollback.state?.last_repair_at ?? rollback.state?.last_snapshot_at ?? '尚未运行' }),
          h('p', { className: 'moren-note' }, '用户已有回退功能时会自动检查：本地快照损坏会被隔离并重建健康基线；purge 的 .bak 为空时，用 Moren 快照替代宿主回退。')),
        h(Card, { title: `快照（${rollback.count ?? 0}）` },
          snapshots.length === 0
            ? h('div', { className: 'moren-empty' }, '还没有快照。点「创建快照」建立健康基线。')
            : h('table', { className: 'moren-table' },
              h('thead', null, h('tr', null, h('th', null, '时间'), h('th', null, '原因'), h('th', null, '文件'), h('th', null, '大小'), h('th', null, '操作'))),
              h('tbody', null, snapshots.map((snapshot) => h('tr', { key: snapshot.id },
                h('td', null, (snapshot.created_at ?? snapshot.id).replace('T', ' ').slice(0, 19)),
                h('td', null, snapshot.reason ?? '—', snapshot.label ? h('div', { className: 'moren-note' }, snapshot.label) : null),
                h('td', null, String(snapshot.files ?? 0), snapshot.missing ? h('div', { className: 'moren-note' }, `缺失 ${snapshot.missing}`) : null),
                h('td', null, `${Math.round((snapshot.bytes ?? 0) / 1024)} KB`),
                h('td', null, h('button', {
                  className: 'moren-btn tiny danger',
                  disabled: busy,
                  onClick: () => {
                    if (window.confirm(`恢复快照 ${snapshot.id}？\n恢复前会自动创建 pre-restore 快照。`)) run('restore', { id: snapshot.id })
                  },
                }, '恢复')))))))
        , h('p', { className: 'moren-note' }, '恢复会覆盖 profile 的 patch/package/prompt-inject 与已安装预设；需要重启 dsh 才能让宿主补丁状态完全回到快照点。'))
    }

    const TOOL_ROWS = [
      ['moren_media_inspect', '图片/视频识别：尺寸、时长、主色、averageHash、关键帧路径（ffmpeg）'],
      ['moren_image_generate', '本地确定性 PNG 生图：同一 prompt/seed 同一张图'],
      ['moren_codec', 'base64/hex/gzip/brotli/base32/base58/JWT/哈希；文件进文件出'],
      ['moren_token_audit', 'Token 估算、压缩建议、compact 写文件'],
      ['moren_snapshot', '回退快照：create/list/verify/restore/repair/status/prune'],
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
        h(Card, { title: '若回退不可用' },
          h('p', null, '自动检查会在宿主启动时运行。发现快照损坏时：隔离到 *.broken-<时间戳>，并建立新的健康基线；页面上的「修复回退」可手动重跑。')))
    }

    function Docs({ data }) {
      const repo = 'https://github.com/MorenLendan/dsh-moren-unlimited'
      return h(React.Fragment, null,
        h(Card, { title: '安装' },
          h('pre', { className: 'moren-code' }, `# 1) 安装 DSH（已有可跳过）\nnpm i -g @deepseek-ai/dsh\n\n# 2) 安装本插件（本地目录）\ndsh plugin --profile web add link:/path/to/dsh-moren-unlimited\n\n# 或用 git\ndsh plugin --profile web add git+${repo}.git\n\n# 3) 重启 dsh web`),
          h('p', { className: 'moren-note' }, '也可以把目录放到 profile 后用 DSH 插件管理器 install_bundle 安装；本插件无构建步骤、无 npm 依赖。')),
        h(Card, { title: '使用' },
          h('p', null, '新建会话 → 选「Moren无限制梁神模式」→ 直接派活。复杂任务会自动用 subagent 进入子预设；子代理最多 10 层。'),
          h('pre', { className: 'moren-code' }, `# 看状态\nmoren_snapshot({ action: "status" })\n\n# 改配置前先留快照\nmoren_snapshot({ action: "create", label: "before-config" })\n\n# 识别视频并抽帧\nmoren_media_inspect({ path: "/data/demo.mp4", frames: 6 })\n\n# 生成图片\nmoren_image_generate({ prompt: "墨绿极光，铜色点缀", width: 1024, height: 768 })`)),
        h(Card, { title: '回退' },
          h('pre', { className: 'moren-code' }, `moren_snapshot({ action: "verify" })\nmoren_snapshot({ action: "repair" })\nmoren_snapshot({ action: "restore", id: "<snapshot-id>" })\n\n# profile 配置改坏时\n# 1) 重启 dsh 2) 重新选择本模式`),
          h('p', { className: 'moren-note' }, '若你之前已有回退（purge 的 .bak / 手动备份），插件会自动检查；不可用时用 Moren 快照替代。')))
    }

    function Page() {
      const [tab, setTab] = useState('status')
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)

      const load = useCallback(async () => {
        try {
          setError(null)
          const next = await api('status')
          setData(next)
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
          setNotice({ ok: true, text: `${{ snapshot: '快照已创建', verify: '校验完成', restore: '已恢复（建议重启 dsh）', repair: '回退修复完成', prune: '清理完成', redeclare: '模式已重新注册' }[op] ?? '完成'}${result?.id ? `：${result.id}` : ''}` })
          await load()
        } catch (cause) {
          setNotice({ ok: false, text: String(cause?.message ?? cause) })
        } finally {
          setBusy(false)
        }
      }, [load])

      const tabs = [
        ['status', '状态'], ['mode', '模式'], ['rollback', '回退'], ['tools', '能力'], ['compat', '兼容'], ['docs', '教程'],
      ]
      const healthy = data?.summary?.allGreen && data?.rollback?.healthy
      return h('div', { className: 'moren-page' },
        h('style', null, CSS),
        h('div', { className: 'moren-head' },
          h('span', { className: 'moren-glyph' }, GLYPH),
          h('div', { className: 'moren-title' },
            h('h1', null, 'Moren 无限制梁神模式'),
            h('p', null, '无限制模式 × 无限制子任务 × 梁神模式 · 原生预设 + 媒体/编码/回退工具'))),
        h('div', { className: 'moren-strip' },
          h('span', null, h('b', null, '模式'), data?.presets?.parent?.registered ? ' 已注册' : ' 未注册'),
          h('span', null, h('b', null, '回退'), data?.rollback?.healthy ? ' 健康' : ' 待修复'),
          h('span', null, h('b', null, 'purge'), data?.purge?.installed ? ` v${data.purge.version}` : ' 未安装'),
          h('span', null, h('b', null, '梁神'), data?.liangshen?.installed ? ` v${data.liangshen.version}` : ' 未安装'),
          h('span', null, h('b', null, 'DSH'), data?.dsh?.version ? ` v${data.dsh.version}` : ' ?')),
        h('div', { className: 'moren-hero' },
          h('span', { className: 'state' },
            h('span', { className: `moren-dot ${healthy ? 'ok' : 'warn'}` }),
            healthy ? '全部就绪' : (data ? '需要处理' : '读取中…')),
          h('span', { className: 'sub' }, data ? `v${data.plugin?.version ?? ''} · ${data.profile ?? ''}` : ''),
          h('div', { className: 'ops' },
            h('button', { className: 'moren-btn primary', disabled: busy, onClick: () => run('snapshot', { label: 'page' }) }, busy ? h('span', { className: 'moren-spin' }) : '创建快照'),
            h('button', { className: 'moren-btn', disabled: busy, onClick: () => run('verify') }, '校验回退'),
            h('button', { className: 'moren-btn', disabled: busy, onClick: () => run('repair') }, '修复回退'),
            h('button', { className: 'moren-btn', disabled: busy, onClick: () => run('redeclare') }, '重新注册模式'),
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
        data && tab === 'rollback' ? h(Rollback, { data, run, busy }) : null,
        data && tab === 'tools' ? h(Tools, { data }) : null,
        data && tab === 'compat' ? h(Compat, { data }) : null,
        data && tab === 'docs' ? h(Docs, { data }) : null,
        h('p', { className: 'moren-note', style: { marginTop: '24px' } }, 'dsh-moren-unlimited · Apache-2.0 · 内含 Apache-2.0 的 LiangShen 预设模块（见 NOTICE）'))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'moren: locale')
        const t = ctx.locale.bind(NS)

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
          inject: () => ({ t }),
        }, Page))
      },
    }
  },
})
