# Moren 无限制梁神模式（dsh-moren-unlimited）

把 **DSH purge 的无限制模式**、**无限制子任务** 与 **梁神模式** 合成为一个原生 agent 预设，并带一个左侧栏入口：

- 新建会话时多一个模式：**Moren无限制梁神模式**
- 子代理默认进入：**Moren无限制梁神模式 · 无限制子任务**（最多 10 层）
- purge 与 `@linxin666/dsh-liangshen` 可以**同时保持开启**，不抢行、不改宿主源码
- 图片/视频识别、关键帧抽取、本地生图、编解码、Token 守卫、可自检修复的回退

> 左侧栏入口：侧栏底部面板列表里的 **Moren**（与 Purge 并列），点开是整页面板：状态 / 模式 / 回退 / 能力 / 兼容 / 教程。

---

## 1. 它到底合并了什么

| 来源 | 合并进来的部分 | 落在哪 |
| --- | --- | --- |
| dsh-purge · 无限制模式 | 无限制人设、shell/fs/技能/计划/压缩、`approval: never` 会话策略 | Agent 平面 + 每会话策略 |
| dsh-purge · 无限制子任务 | `subagent` 默认子预设、深度 10、模型选择、continuable 后台 | 父/子预设 |
| 梁神模式 | `minimal-prompt`、PTC `run_code` 工具面、工具分页 `tool_activate`、working-context、fact-ledger、子任务路由守卫、dispatch-guard | 预设行（vendored，Apache-2.0） |
| 本插件 | `moren_*` 工具、Token 守卫、回退快照、左侧栏页面、兼容自检 | 插件 + 预设作用域 |

**没有合并/没有替代**：purge 的 83 条宿主补丁仍然由 purge 自己的面板「应用」；本插件不写 dsh 源码、不写 purge 文件，所以两边同时开启不会互相覆盖。你没有应用 purge 宿主补丁时，本模式仍然可用，只是审批/沙箱闸门仍按当前 profile 执行。

---

## 2. 安装

### 2.1 先装 DSH（已有可跳过）

```bash
# 需要 Node.js >= 24.9
npm i -g @deepseek-ai/dsh

# 启动 Web GUI（默认 http://127.0.0.1:3080）
dsh --profile web
```

### 2.2 安装本插件（三选一）

**A. 本地目录（开发/自用，推荐）**

```bash
git clone https://github.com/YOUR_GITHUB_NAME/dsh-moren-unlimited.git
cd dsh-moren-unlimited

# 一条命令：pnpm link + 写入 dsh.profile.bundles
node scripts/install.mjs --profile web
```

**B. 直接 git 安装**

```bash
git clone https://github.com/YOUR_GITHUB_NAME/dsh-moren-unlimited.git
cd dsh-moren-unlimited
node scripts/install.mjs --profile web
```

**C. 手动 pnpm**

```bash
cd ~/.dsh/profiles/web
pnpm add link:/absolute/path/to/dsh-moren-unlimited
# 再把 "dsh-moren-unlimited" 加进 package.json 的 dsh.profile.bundles
```

安装完成后**重启 `dsh web`**（或让 HMR 应用），左侧栏出现 **Moren**，新建会话的预设选择器出现 **Moren无限制梁神模式**。

### 2.3 升级 / 卸载

```bash
# 升级
cd dsh-moren-unlimited && git pull
# 重启 dsh web

# 卸载（会移除 bundle 行，不会删除 $DSH_HOME/moren 下的快照）
dsh plugin --profile web remove dsh-moren-unlimited
```

---

## 3. 使用教程

### 3.1 开一个 Moren 会话

1. 打开 DSH Web GUI。
2. 新建会话。
3. 在预设/模式选择器里选 **Moren无限制梁神模式**（和「梁神模式」「无限制模式」并列）。
4. 直接派活。复杂任务会自动 `subagent` 到「无限制子任务」子预设。

### 3.2 左侧栏 Moren 页面

| 标签 | 内容 |
| --- | --- |
| 状态 | 模式注册、回退健康度、purge/梁神/DSH 版本、Token 守卫命中率 |
| 模式 | 父/子预设 id、子代理深度、PTC/native、梁神调度块开关、如何切换 |
| 回退 | 快照列表、创建/校验/恢复/修复/清理；purge `.bak` 状态 |
| 能力 | `moren_*` 工具清单与用途 |
| 兼容 | 两插件共存说明、回退不可用时的替代路径 |
| 教程 | 安装、使用、回退的常用命令 |

按钮直接调用 `/dsh-moren/api`（同源校验），不需要额外端口。

### 3.3 工具（只在 Moren 模式可见）

#### `moren_media_inspect` — 图片/视频识别

```js
moren_media_inspect({ path: "/data/demo.mp4", frames: 6 })
```

返回：魔术字节、尺寸/时长/编码、PNG 主色板与 `averageHash`、视频关键帧路径。
有 `ffmpeg` 时自动抽帧；没有时只返回容器元数据，并给出安装提示。

```bash
# 想要视频抽帧就装 ffmpeg
sudo apt install -y ffmpeg     # Debian/Ubuntu
brew install ffmpeg            # macOS
```

拿到帧路径后用 `read_image` 查看：

```js
read_image({ path: "/root/.dsh/moren/frames/demo-xxxxxxxx/frame-01.jpg" })
```

#### `moren_image_generate` — 本地生图

```js
moren_image_generate({ prompt: "墨绿极光，铜色点缀", width: 1024, height: 768 })
```

- 本地确定性生成：同一 `prompt + seed + style` 必然得到同一张 PNG
- 返回 `path`，用 `read_image` 查看
- 不联网、不需要模型 key；它是程序化视觉，不是扩散模型
- 要接自己的生图 API，可在插件里扩展 `moren_image_generate` 的 `outPath` 流程

#### `moren_codec` — 编解码/哈希

```js
moren_codec({ action: "encode", format: "base64", text: "hello" })
moren_codec({ action: "decode", format: "gzip", inputPath: "/tmp/a.gz", outPath: "/tmp/a.txt" })
moren_codec({ action: "hash", format: "sha256", inputPath: "/data/big.bin" })
moren_codec({ action: "jwt", text: "eyJ..." })
```

支持：`base64`、`base64url`、`hex`、`url`、`urlcomponent`、`html`、`unicode`、`gzip`、`deflate`、`brotli`、`base32`、`base58`、`rot13`、`binary`、`utf16le`、`datauri`、`jwt`；哈希 `md5/sha1/sha256/sha512/sha3-256`。
大载荷用 `inputPath` + `outPath`，工具只回执长度/路径，避免内容重复计入上下文。

#### `moren_token_audit` — Token 估算与压缩

```js
moren_token_audit({ path: "/data/huge.log" })
moren_token_audit({ action: "compact", path: "/data/huge.log", outPath: "/data/huge.compact.log" })
```

#### `moren_snapshot` — 回退

见下一节。

---

## 4. 回退（重点）

### 4.1 它备份什么

`$DSH_HOME/moren/snapshots/<id>/`：

- `$DSH_HOME/prompt-inject.md`
- `profiles/<profile>/cordis.patch.yml`
- `profiles/<profile>/package.json`
- `profiles/<profile>/cordis.yml`、`pnpm-workspace.yaml`（存在时）
- `$DSH_HOME/.agent-presets/*/{agent.cordis.yml,preset.yml}`
- `$DSH_HOME/dsh-purge/override-state.json`

每份快照有 `manifest.json`（大小 + SHA-256 + 权限 + 主机信息），`complete: true` 最后写入，崩溃留下的半份快照会被识别。

### 4.2 自动检查与修复

宿主启动时（`autoRepairRollback: true`）自动：

1. 扫描所有快照，校验 manifest、每个文件哈希、目标目录可写性
2. 做一次**试恢复**（复制到临时目录再比对哈希）
3. 损坏的快照不删除，重命名为 `<id>.broken-<时间戳>` 隔离
4. 没有健康快照时，建立一份 `auto-repair-baseline`
5. 记录到 `$DSH_HOME/moren/rollback-state.json` 与 `auto-check.json`

这覆盖了「识别到已有回退功能 → 自动检查是否可用 → 不可用则修复或替换成我们的回退」：

- **purge 回退**：检查 `.dshpurge.bak` 是否存在；没有就是不可用
- **Moren 回退**：检查快照健康度；不可用就自动修复/重建
- 两者都不可用时，页面会明确显示；Moren 会建立新基线，不会假装可用

### 4.3 手动操作

```js
// 改配置前
moren_snapshot({ action: "create", label: "before-config" })

// 自检
moren_snapshot({ action: "verify" })

// 修复（隔离坏快照 + 建新基线）
moren_snapshot({ action: "repair" })

// 恢复（先自动做 pre-restore 快照）
moren_snapshot({ action: "restore", id: "<snapshot-id>" })

// 清理
moren_snapshot({ action: "prune", keep: 10 })
```

页面按钮等价于这些调用。恢复后建议重启 `dsh web`，让宿主补丁/预设状态完全回到快照点。

### 4.4 purge 的宿主补丁回退

purge 的 `.dshpurge.bak` 由 purge 自己管理。Moren 不会删除它们，也不会伪造。页面会显示：

- `可用`：存在 `.bak`，可以走 `purge_revert`
- `无宿主备份`：用 Moren 快照替代 profile 级回退；要恢复宿主补丁，在 purge 面板先「应用」生成备份

---

## 5. Token 守卫（省 Token / 命中率）

预设作用域内注册 `tools/post-execute` 监听：

- 工具输出超过 `tokenGuardChars`（默认 24000 字符）→ 完整内容写 `$DSH_HOME/moren/spill/<tool>-<hash>.txt`
- 模型只看到头部 + 尾部 + 文件路径 + SHA-256 回执
- 15 分钟内**完全相同**的大输出 → 一行「去重命中」回执，不再重复计费
- 统计写 `$DSH_HOME/moren/token-stats.json`，页面显示命中率与累计节省

配合人设里的「大载荷走 codec / 媒体先 inspect / 长文本先 audit」三条纪律，减少重复搬运。

> 估算器是结构估算（CJK ≈ 1 token/字，ASCII ≈ 4 字符/token），用于相对比较与阈值，不等于账单。

---

## 6. 兼容性

| 组合 | 结果 |
| --- | --- |
| Moren + purge 同时开启 | ✅ 不冲突：唯一预设 id、唯一面板 id、不写对方文件 |
| Moren + 梁神模式同时开启 | ✅ 不冲突：两个独立预设，可分别选择 |
| purge + 梁神 + Moren 三者同时 | ✅ 预设选择器里三个模式并列 |
| purge 宿主补丁未应用 | ✅ Moren 仍可用；审批/沙箱按 profile |
| purge 宿主补丁已应用 | ✅ Moren 继承其宿主放宽；本插件不重复打补丁 |
| 子代理 | ✅ 默认进 Moren 子预设，最多 10 层；也可显式 `agent_preset` |

**为什么不冲突**：
1. 只注册 `moren-unlimited-liangshen` / `moren-unlimited-liangshen-child` 两个 id
2. 面板 id 固定 `moren-unlimited`
3. 不修改 `dsh` 安装目录、不修改 purge/梁神包
4. 预设行在各自 scope 内挂载，服务按 preset realm 隔离
5. 审批策略只对本模式会话 `setPolicy(agent, 'never')`

---

## 7. 配置

profile 的 `cordis.patch.yml` 里覆盖 `moren-unlimited` 行配置（改完重启）：

```yaml
- id: moren-unlimited
  name: dsh-moren-unlimited
  config:
    enabled: true
    announceToAgent: false   # 是否向 agent 宣告插件
    approvalNever: true      # 本模式会话审批 never
    dispatcher: false        # 梁神调度块（约 24KB，默认关，省 Token）
    presentation: ptc        # ptc | native
    tokenGuardChars: 24000   # 0 = 关闭守卫
    autoRepairRollback: true
    snapshotKeep: 20
```

`dispatcher: true` 会追加梁神的完整调度规则块（plan/task book/review/hand-off），Token 成本明显增加，按需开。

---

## 8. 目录结构

```
dsh-moren-unlimited/
├── index.js                 # 宿主：注册预设、HTTP API、自动回退检查
├── client.js                # 浏览器：sidebar.panellist + main 整页
├── cordis.patch.yml
├── lib/
│   ├── home.js              # 路径 / 版本 / purge 备份扫描
│   ├── snapshot.js          # 快照 create/verify/restore/repair/prune
│   ├── compat.js            # 页面状态与兼容报告
│   ├── media.js             # 图片/视频识别 + 本地 PNG 生图
│   ├── png.js               # 纯 JS PNG 编解码
│   ├── codec.js             # 编解码/哈希
│   └── tokens.js            # Token 估算与压缩
├── presets/moren/
│   ├── definition.mjs       # 合并后的父/子预设
│   ├── moren-tools.mjs      # 预设作用域工具 + Token 守卫
│   ├── moren-policy.mjs     # 本模式会话 approval never
│   └── vendor/              # 梁神预设模块（Apache-2.0，见 NOTICE）
├── locale/
├── docs/
└── icon.svg
```

---

## 9. 常见问题

**Q: 模式选择器里没有 Moren？**
A: 重启 `dsh web`；或在 Moren 页面点「重新注册模式」；确认 profile 的 `bundles` 里有 `dsh-moren-unlimited`。

**Q: 左侧栏没有 Moren？**
A: 确认 `dsh.client` 已加载（重启/刷新）；打开浏览器控制台看 `window.__DSH_BOOT__` 里是否有 `dsh-moren-unlimited`。

**Q: 视频只返回元数据，没有帧？**
A: 装 `ffmpeg`；`moren_media_inspect` 会自动抽帧到 `$DSH_HOME/moren/frames/`。

**Q: 生图不是我想的画面？**
A: 本地生成是程序化视觉（渐变/圆盘/线条/颗粒），不是扩散模型；它保证可复现、零依赖、零联网。要语义生图请扩展 `moren_image_generate` 接你的 API。

**Q: 恢复后模式消失？**
A: 快照可能包含安装前的 `package.json`/`cordis.patch.yml`，恢复会把插件行一起还原；重启后重新安装/启用即可。恢复前系统会自动做 `pre-restore` 快照，可再恢复回来。

**Q: 会不会和 purge 抢宿主补丁？**
A: 不会。本插件不写 dsh 源码，也不写 purge 的 `.bak`；宿主补丁只由 purge 面板操作。

---

## 10. 发布到 GitHub（公开）

仓库已经是完整的 git 仓库，`main` 已提交。任选其一：

```bash
# A. GitHub CLI 已登录
gh repo create dsh-moren-unlimited --public --source=. --remote=origin --push

# B. Token
GITHUB_USER=<你的用户名> GITHUB_TOKEN=<token> ./scripts/publish-github.sh
```

手动：

```bash
git remote add origin https://github.com/<你的用户名>/dsh-moren-unlimited.git
git push -u origin main
# 网页 Settings → 确认 Public
```

详细说明与失败排查见 [docs/GITHUB.zh.md](docs/GITHUB.zh.md)。

> README/docs 里的 `YOUR_GITHUB_NAME` 是占位符；发布后替换：
> `grep -rl YOUR_GITHUB_NAME . --exclude-dir=.git | xargs sed -i "s/YOUR_GITHUB_NAME/<你的用户名>/g"`

---

## 11. 许可与致谢

- 本项目：Apache-2.0
- `presets/moren/vendor/` 来自 [`@linxin666/dsh-liangshen`](https://github.com/zhu1090093659/dsh-web) 的 LiangShen 预设（Apache-2.0），保留原 `NOTICE`
- 预设骨架参考 DeepSeek Harness 内置 Minimal/Standard/PTC preset（MIT）
- 兼容对象：[`dsh-purge`](https://github.com/kingcharleslzy-ai/dsh-purge)（MIT）

详见 `NOTICE` 与 `LICENSE`。
