# REA 逆向集成

REA（[morluto/rea](https://github.com/morluto/rea)，MIT）是一个 MCP 逆向服务器。Moren 不复制它的源码，而是在预设里声明 MCP 行，让会话直接使用它的 229 个工具。

## 安装

安装器会自动执行：

```bash
npm i -g rea-agents@6.8.0
```

跳过：

```bash
node scripts/install.mjs --profile web --no-rea
```

验证：

```bash
rea --version
rea mcp doctor
```

`rea mcp doctor` 应显示 `healthy: true`、`tools expected=229 observed=229`。

## 在 Moren 会话里使用

1. 新建会话，选 **Moren无限制梁神模式**
2. 先激活 REA 命名空间：

```js
tool_activate({ namespace: "rea" })
```

3. 查看工具：

```js
mcp__rea__tool_catalog({})
```

4. 按目标调用 `mcp__rea__*`。常用入口：

- `mcp__rea__analyze`：应用总览
- `mcp__rea__binary_session`：二进制分析会话
- `mcp__rea__analyze_javascript_application`：JS/Electron/ASAR
- `mcp__rea__analyze_web_bundle`：Web bundle
- `mcp__rea__compare_application_versions`：版本对比
- `mcp__rea__capture_process` / `capture_browser_scenario`：运行时取证
- `mcp__rea__build_reconstruction_obligation_ledger`：重构义务清单

工具名以 REA 6.8.0 的 catalog 为准；先 `tool_catalog` 再看参数。

## 预设里的 MCP 行

```yaml
- id: mcp-rea
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: rea
    transport: stdio
    command: rea
    args: ['mcp']
    toolCallTimeoutMs: 300000
    failOnStartupError: false
    env:
      REA_MCP_INPUT_SCHEMA_PROFILE: compact
```

- 工具命名空间：`mcp__rea__*`
- 默认被 `mcp__*` 分页；不激活时不会占用 wire 上下文
- `failOnStartupError: false`：没装 REA 时模式仍可用，只是没有 REA 工具

## 取证纪律

- 每个结论带 REA 返回的 Evidence：地址、函数、字节、调用链、截图
- 不靠猜：先用 `analyze` / `binary_session` 建立目标事实
- 需要外部情报时用 `moren_intel`，报告写到 `$DSH_HOME/moren/reports/`
- 版本对比、重构义务清单可直接作为报告附件

## 与更多插件的兼容

- REA 是独立 MCP 进程，和 purge、梁神模式的工具不共享命名空间
- Moren 不修改 REA 包，也不写它的配置
- 升级 REA：`npm i -g rea-agents@latest`，重启 `dsh web`
