# 梁神模式功能对照（是否被阉割/删减）

结论：**核心实现没有删减**。9 个 LiangShen 预设模块是逐字节复制，SHA-256 与上游一致；预设行做了加法与有意的合并调整；1.0.0 有两处偏差（漏 `str-replace-editor`、`dispatcher` 默认 false），1.0.1 已修复。

## 1. 逐字节对照

```bash
cd /root/.dsh/profiles/web/node_modules/@linxin666/dsh-liangshen/presets/liangshen
for f in *.mjs; do
  printf '%s  ' "$f"
  [ "$(sha256sum "$f" | cut -d' ' -f1)" = "$(sha256sum /root/Work/dsh-moren-unlimited/presets/moren/vendor/$f | cut -d' ' -f1)" ] && echo OK || echo DIFF
done
```

| 模块 | SHA-256（前 16 位） | 状态 |
| --- | --- | --- |
| `minimal-prompt.mjs` | `6281fc0ad1755390` | 一致 |
| `tool-catalog.mjs` | `8eb0e57db6a97fdb` | 一致 |
| `tool-activate.mjs` | `ed22478be9cb006d` | 一致 |
| `working-context.mjs` | `ae5c85193df5162b` | 一致 |
| `fact-ledger.mjs` | `de3344bdf4eb0d3d` | 一致 |
| `subagent-routes.mjs` | `0e0c0c11d3457686` | 一致 |
| `dispatch-guard.mjs` | `47110d91e1ba2740` | 一致 |
| `paging.mjs` | `e3b2729d986df28d` | 一致 |
| `dispatcher-rules.mjs` | `f1d9aa84f977cc69` | 一致 |

没有改写、没有裁剪、没有用简化实现替代。

## 2. 预设行对照

| LiangShen 行 | Moren 行 | 说明 |
| --- | --- | --- |
| `persona` | `persona` | 有意合并：无限制执行 + 梁神纪律；纪律条目全部保留 |
| `minimal-prompt` | `minimal-prompt` | 配置一致；`dispatcher` 默认 **true**（已修复 1.0.0 默认 false 的偏差） |
| `tool-catalog` | `tool-catalog` | `presentation=ptc`、`mcp__*` 分页、8000 常驻 token；`descriptionMaxLength` 改为 200（与上游一致） |
| `working-context` | `working-context` | 一致 |
| `tool-activate` | `tool-activate` | 一致 |
| `fact-ledger` | `fact-ledger` | 一致 |
| `subagent-routes` | `subagent-routes` | 一致 |
| `dispatch-guard` | `dispatch-guard` | 一致 |
| `agent-instructions` | `agent-instructions` | 65536 字节 |
| `tool-bash` / `tool-pwsh` | 同名 | 平台条件一致 |
| `str-replace-editor` | **已补回** | 1.0.0 漏掉；1.0.1 加回，`maxOutputChars: 16000` |
| `tool-fs` / `tool-fs-search` | 同名 | `sampleOverCapGlobResults: false` |
| `tool-jobs` | 同名 | 一致 |
| `skill-filesystem` / `tool-skill` | 同名 | `includeDefaultRoots: true` |
| `command-goal` / `tool-goal` | 同名 | 一致 |
| `planning` / `plan-mode` | 同名 | 策略文本一致 |
| `compaction` / `compaction-basic` / `command-compact` / `tool-result-pruner` | 同名 | 4096/2048/1024 |
| `delegation` 组 | 同名 | 见下 |
| `tool-subagent-control` | 同名 | 一致 |
| `tool-subagent` | 同名 | 追加 `maxDepth: 10` 与子预设；`modelSelection/modelDiscovery/continuable` 保留 |
| `tool-subagent-fork` | 同名 | `continuable` 保留 |
| `tool-subagent-codex` / `claude-code` | 省略 | 上游本来就是 `disabled: true`，无能力差异 |
| `workflow-ptc` | 同名 | 一致 |
| `tool-workflow` | 同名 | 上游 `disabled: true`；Moren **打开**（加法） |
| `tool-ralph` | 同名 | 一致 |
| `tool-ask-user` / `tool-todo` | 同名 | `allowParallelInProgress: true` |
| `tool-web` | 同名 | 上游 `fetch: false`；Moren 打开（加法） |
| `tool-executor-ptc` | 同名 | 随 `presentation` 开关 |
| — | `moren-tools` | 新增：媒体/生图/codec/token/intel |
| — | `mcp-rea` | 新增：REA MCP，229 个逆向工具 |
| — | `moren-policy` | 新增：本模式会话 approval never |
| — | `tool-schedule` | 来自 purge 无限制预设（加法） |

## 3. 有意差异（都是加法或合并，不是删减）

1. **persona 合并**：梁神的工作纪律换成中文并入无限制人设；条目一一对应（反思熔断、行动导向、并发探索、Shell 纪律、YAGNI/PDCA、有界收敛、有界输出）。
2. **子代理深度 10 + 子预设**：梁神默认吃宿主深度；Moren 显式 10，并让子代理进入同一套合并模式。
3. **`tool-workflow` 打开**：梁神为了 PTC 面收敛而禁用；Moren 作为“无限制”保留。
4. **`tool-web.fetch` 打开**：来自 purge 无限制预设。
5. **审批 never**：只作用于 Moren 会话，其它模式不变。
6. **`dispatcher` 默认 true**：1.0.0 为了省 Token 默认 false，属于功能偏差；1.0.1 已改回 true，并在 profile patch 里可关。

## 4. 怎么自证

```bash
cd /root/Work/dsh-moren-unlimited
node - <<'EOF'
import('./presets/moren/definition.mjs').then((d) => {
  const p = d.buildPresetDefinitions({}).parent
  const ids = []
  const walk = (rows) => { for (const r of rows) { ids.push(r.id); if (r.group === true) walk(r.config) } }
  walk(p.plugins)
  console.log(ids.join('\n'))
})
EOF
```

应看到 `str-replace-editor`、`minimal-prompt`、`tool-catalog`、`working-context`、`tool-activate`、`fact-ledger`、`subagent-routes`、`dispatch-guard`、`tool-executor-ptc` 全部在列。

安装后验证（宿主重启后）：

```bash
node scripts/verify.mjs
# 或
curl -s -X POST http://127.0.0.1:3080/dsh-moren/api \
  -H 'content-type: application/json' -d '{"op":"presets"}'
```

`ours[].broken` 应为 `null`；`rows` 与当前定义一致（1.0.1 的 inventory 为 36，定义展开为 39）。
