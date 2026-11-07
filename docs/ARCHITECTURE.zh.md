# 架构与兼容性

## 1. 两个平面

DSH 的模式由 agent preset 决定，但宿主闸门（审批、沙箱、持久化、模型路由）在 profile/宿主平面。

```
Host plane
├── profile bundles: base, web-app, dsh-purge, liangshen, dsh-moren-unlimited
├── approval / sandbox / fs / session / tokenMeter
└── agentPresets registry
        │ register(parent), register(child)
        ▼
Agent plane (per preset realm)
├── persona / minimal-prompt / tool-catalog
├── shell / fs / skills / plan / compaction
├── delegation (spawn with agentPreset=child, maxDepth=10)
├── moren-tools (media / image / codec / token / intel)
├── mcp-rea (REA MCP, 229 tools)
└── moren-policy (approval never for this preset)
```

**关键**：宿主补丁只能由 purge 打；本插件不碰。Agent 平面合并不会与 purge 的宿主补丁冲突，因为一个是全局文件替换，一个是 per-preset 的注册。

## 2. 预设合并

### 父预设 `moren-unlimited-liangshen`

- persona：无限制执行 + 梁神纪律 + 效率 + REA/情报
- `minimal-prompt`：把系统提示压到 persona + plan policy + workspace 行
- `tool-catalog`：PTC wire、`mcp__*` 分页、常驻 token 上限
- `working-context` / `fact-ledger` / `subagent-routes` / `dispatch-guard`
- shell/fs/skills/plan/compaction/delegation/ask/todo/web
- `moren-tools` / `moren-policy`

### 子预设 `moren-unlimited-liangshen-child`

同样的行，差异：

- `tool-subagent` 不设默认 `agentPreset`（子代理继承自身 → 继续递归）
- `allowedAgentPresets` 指向自己
- `maxDepth` 同样 10

### 为什么用 vendored 模块

梁神预设的 `.mjs` 是自包含的（只有 node 内置 + 相互引用）。放进 `presets/moren/vendor/` 后：

- 不依赖梁神插件是否安装/启用
- 不受梁神升级导致的路径变化影响
- 保留 Apache-2.0 NOTICE

代价：上游梁神更新不会自动同步；升级时手动 diff。

## 3. 兼容性保证

| 冲突面 | 措施 |
| --- | --- |
| 预设 id | 只用 `moren-*` |
| 面板 id | `moren-unlimited` |
| 工具名 | `moren_*` 前缀 |
| 服务名 | 不 provide 任何服务 |
| 事件监听 | `agent/created` 只读判断 preset；`tools/post-execute` 只改内容 |
| 审批 | 只对本模式 agent `setPolicy('never')` |
| 文件 | 只写 `$DSH_HOME/moren/` |
| purge | 不读写 `.bak`，不调用 purge 内部 |
| 梁神 | 不修改其包，不注册同名预设 |

## 4. 请求路径

1. 用户选父预设 → registry mount 父预设行
2. `minimal-prompt` 组装 persona + workspace
3. `tool-catalog` 声明 PTC，生成工具目录消息
4. 模型 `run_code` → PTC SDK 调工具
5. 工具结果 → `tools/post-execute` → Token 守卫
6. 子代理 → `subagent` → child preset → 同样流程

## 5. REA 与情报层

- `mcp-rea` 行：`@deepseek-ai/dsh-mcp-client` 以 stdio 启动 `rea mcp`
- 工具名 `mcp__rea__*`，默认被 `mcp__*` 分页；先 `tool_activate({ namespace: "rea" })`
- REA 6.8.0：229 tools，覆盖二进制/JS/Electron/.NET/WASM/UI/Frida/GDB/LLDB/Hopper/Ghidra/IDA/JEB/Cutter
- `lib/intel.js`：curl 驱动的 search/fetch/report，支持 HTTP 代理与 Tor SOCKS（.onion）
- 情报报告写 `$DSH_HOME/moren/reports/`

## 6. 页面 API

`POST /dsh-moren/api`，同源校验，`op`：

- `status` — 兼容报告 + Token 统计
- `wallpaper` / `wallpaper-upload` / `wallpaper-settings` / `wallpaper-clear`
- `rewind`：客户端直接调 purge `/dsh-purge/rewind`，mode=once/round
- `stats` / `client` / `redeclare` / `open-docs`

`client` 返回 boot graph 中是否包含 `dsh-moren-unlimited`，用于安装验证。

## 7. 扩展点

- 接远程生图：在 `moren_image_generate` 里按配置转发到你的 endpoint
- 换生图风格：改 `lib/media.js` 的绘制函数
- 调 Token 阈值：profile patch `tokenGuardChars`
- 开梁神调度块：`dispatcher: true`
- 改子代理深度：`presets/moren/definition.mjs` 的 `maxDepth`
