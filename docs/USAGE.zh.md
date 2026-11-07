# 使用教程

## 1. 进入模式

1. 启动 `dsh --profile web`
2. 新建会话
3. 预设/模式选择器 → **Moren无限制梁神模式**
4. 直接发任务

它与这些模式并列，可随时切回：

- 梁神模式（`@linxin666/dsh-liangshen`）
- 无限制模式（`dsh-purge` 的 preset）

> 子代理默认进入 **Moren无限制梁神模式 · 无限制子任务**，最多 10 层；不需要手动选择。

---

## 2. 左侧栏页面

侧栏底部面板列表 → **Moren**。

### 状态

- 父/子预设是否注册
- REA / ffmpeg 是否就绪
- Token 守卫命中率、累计节省
- purge / 梁神 / DSH 版本
- 逐项检查（模式、REA、ffmpeg、purge）

### 模式

- 两个预设 id、子代理深度、PTC/native、梁神调度块开关
- 「重新注册模式」按钮：配置改动后无需重启即可重挂预设

### 回退

- 本机 purge 回退：修复 session 绑定；原生菜单回退一次 / 上一轮
- 不处理文件快照；文件回退已移除

### 能力

工具清单与用途。

### 兼容

purge / 梁神 / REA 共存说明。

### 教程

安装 / 使用 / REA / 情报 / 回退命令速查。

---

## 3. 工具速查

### 3.1 识别图片

```js
moren_media_inspect({ path: "/data/cover.png" })
```

返回：

```json
{
  "format": "png",
  "width": 1024,
  "height": 768,
  "averageColor": "#2c344a",
  "palette": [{ "hex": "#1a2538", "share": 14.5 }],
  "averageHash": "1101111001011100…",
  "brightness": 20
}
```

### 3.2 识别视频 / 抽帧

```js
moren_media_inspect({ path: "/data/demo.mp4", frames: 6 })
```

返回容器信息（时长、分辨率、编码、音轨）；有 ffmpeg 时返回：

```json
"frames": [
  { "timeSec": 1.2, "path": "/root/.dsh/moren/frames/demo-xxxxxxxx/frame-01.jpg" }
]
```

然后：

```js
read_image({ path: "/root/.dsh/moren/frames/demo-xxxxxxxx/frame-01.jpg" })
```

> 没装 ffmpeg 时只返回元数据 + `frameNote` 提示；装完自动生效。

### 3.3 生图

```js
moren_image_generate({ prompt: "深海极光，铜色星尘", width: 1280, height: 720 })
```

返回 `path`（PNG）。同一 `prompt/seed/style` 生成同一张图。查看：

```js
read_image({ path: "/root/Work/moren-images/深海极光-xxxxxxxx.png" })
```

### 3.4 编码 / 解码 / 哈希

```js
// 小文本直接回显
moren_codec({ action: "encode", format: "base64url", text: "hello" })

// 大文件：文件进、文件出，只回执长度
moren_codec({ action: "encode", format: "gzip", inputPath: "/data/big.json", outPath: "/tmp/big.gz" })
moren_codec({ action: "decode", format: "gzip", inputPath: "/tmp/big.gz", outPath: "/tmp/big.json" })

// 哈希
moren_codec({ action: "hash", format: "sha256", inputPath: "/data/app.bin" })

// JWT（只解码，不验签）
moren_codec({ action: "jwt", text: "eyJhbGciOi..." })
```

### 3.5 Token 审计

```js
moren_token_audit({ path: "/data/huge.log" })
moren_token_audit({ action: "compact", path: "/data/huge.log", outPath: "/tmp/huge.compact.log" })
```

会报告字符数、行数、最长行、估算 Token、压缩后大小与建议。

### 3.6 壁纸

左侧栏 **Moren → 壁纸**：

- 上传 PNG / JPEG / WebP / GIF，最大 20MB
- 不透明度 10–100%、模糊 0–40px、压暗 0–90%
- 铺满（cover）/ 完整显示（contain）
- 「应用设置」立即生效；「关闭壁纸」保留文件；「清除壁纸」删除文件

存储：

```text
$DSH_HOME/moren/wallpaper.json      # 设置
$DSH_HOME/moren/wallpaper/<sha>.png # 图片
```

壁纸是 `body::before` 固定背景层，不改 DSH 前端；面板仍用主题层背景，压暗可保证可读性。

### 3.7 对话回退 / REA / 情报

**本机 DSH 回退**

- 插件启动时给 `dsh-purge-community/client.js` 打 session 补丁
- 输入框右侧使用 purge 原生「回退」按钮
- 菜单：回退一次 / 回退上一轮（含子代理）
- 或 `/rewind once`、`/rewind round`

**REA 逆向**

```js
tool_activate({ namespace: "rea" })
mcp__rea__tool_catalog({})
```

229 个逆向工具：二进制、JS/Electron、.NET、WASM、原生 UI、Frida/GDB/LLDB、Hopper/Ghidra/IDA/JEB、Cutter/Rizin。

**联网情报**

```js
moren_intel({ action: "search", query: "product CVE", engine: "ddg" })
moren_intel({ action: "fetch", url: "https://example.com/advisory" })
moren_intel({ action: "fetch", url: "http://xxxx.onion/", proxy: "socks5h://127.0.0.1:9050" })
moren_intel({ action: "report", title: "research", findings: [...] })
```

---

## 4. 推荐工作流

### 逆向 / 外挂情报

```text
1. tool_activate({ namespace: "rea" })
2. mcp__rea__tool_catalog / analyze / binary_session 取证
3. moren_intel search/fetch 补外部情报
4. moren_intel report 归档证据
```

### 处理大日志

```text
1. moren_token_audit({ path: "app.log" })        # 先估算
2. grep/head/tail 只取相关段                      # 不要整段读
3. 需要保留全文时：moren_codec({ format: "gzip", inputPath, outPath })
```

### 视频取证 / 素材分析

```text
1. moren_media_inspect({ path, frames: 8 })
2. read_image 逐帧看
3. 需要帧图归档：frames 已落盘在 $DSH_HOME/moren/frames/
```

### 需要并行子任务

```text
subagent({ prompt: "第一行写边界与验收；只做 X", agent_preset: "moren-unlimited-liangshen-child" })
```

模型默认就会用子预设；也可以显式指定。

---

## 5. 省 Token 的机制

| 机制 | 触发 | 效果 |
| --- | --- | --- |
| 工具结果折叠 | 单次输出 > `tokenGuardChars`（默认 24k 字符） | 只回执头/尾 + spill 路径 |
| 去重命中 | 15 分钟内完全相同的大输出 | 一行回执，不重复计费 |
| 工具分页 | `mcp__*` 等大工具族 | 未激活前不进 wire |
| PTC | `presentation: ptc` | wire 收拢为 `run_code` |
| 编码器文件模式 | 大载荷 | 内容不进对话 |
| 有界输出纪律 | 人设 | 先 grep/head/tail |

页面「状态」里能看到命中率与累计节省（估算值）。

---

## 6. 与其它模式共存

- 三个模式可以同时存在，随时切换
- Moren 的审批 `never` 只作用于 Moren 会话
- 梁神模式/无限制模式各自的会话策略不变
- purge 的宿主补丁是全局的；Moren 不重复打补丁，也不撤销它

---

## 7. 排错

见 [INSTALL.zh.md](INSTALL.zh.md#6-常见错误)。
