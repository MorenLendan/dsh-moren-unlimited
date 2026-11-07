# 安装教程

## 0. 前置条件

- Node.js **>= 24.9**（`node -v`）
- 已安装 DSH：`npm i -g @deepseek-ai/dsh`
- 已有一个可用的 DSH profile（默认 `web`）：`dsh --profile web` 能打开 GUI
- 可选：`ffmpeg`（视频抽帧）、`pnpm`（DSH 自带/`corepack enable`）

检查：

```bash
node -v
dsh --version
dsh --profile web --dump-config | head
```

---

## 1. 获取代码

```bash
git clone https://github.com/MorenLendan/dsh-moren-unlimited.git
cd dsh-moren-unlimited
```

或者下载 ZIP 解压。

---

## 2. 安装

### 2.0 官方 Release tarball（推荐）

```bash
dsh plugin --profile web add "https://github.com/MorenLendan/dsh-moren-unlimited/releases/download/v1.0.3/dsh-moren-unlimited-1.0.3.tgz?download=1"
```

DSH 0.2.2 会自动把包名写进 `dsh.profile.bundles`。

### 2.1 自带脚本

```bash
# 默认 profile=web，DSH_HOME=~/.dsh
node scripts/install.mjs

# 指定 profile / DSH_HOME
node scripts/install.mjs --profile web --home ~/.dsh
```

脚本做两件事：

1. 在 profile 里执行 `pnpm add link:<本目录>`
2. 把 `dsh-moren-unlimited` 追加到 profile `package.json` 的 `dsh.profile.bundles`

然后：

```bash
# 重启 Web 宿主（Ctrl+C 后重新运行）
dsh --profile web
```

### 2.1 安装结果检查

```bash
# profile 里应出现依赖与 bundle
cat ~/.dsh/profiles/web/package.json

# 离线全量自检（临时 DSH_HOME，不改真实 profile）
node scripts/selftest.mjs

# 校验运行中的宿主
node scripts/verify.mjs
```

期望输出包含：

```
✓ 模式 moren-unlimited-liangshen (Moren无限制梁神模式)
✓ 子预设 moren-unlimited-liangshen-child
✓ 回退健康 (n 份快照)
✓ dsh-purge 1.6.x；宿主备份 0 个
✓ 梁神模式 0.4.x
✓ 客户端模块
```

---

## 3. 其它安装方式

### 3.1 只要 pnpm 链接（然后手动加 bundle）

```bash
cd ~/.dsh/profiles/web
pnpm add link:/path/to/dsh-moren-unlimited
```

编辑 `~/.dsh/profiles/web/package.json`：

```json
{
  "dependencies": {
    "dsh-moren-unlimited": "link:/path/to/dsh-moren-unlimited"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-purge-community",
        "@linxin666/dsh-liangshen",
        "dsh-moren-unlimited"
      ]
    }
  }
}
```

重启 `dsh web`。

### 3.2 git 依赖

```bash
cd ~/.dsh/profiles/web
pnpm add git+https://github.com/MorenLendan/dsh-moren-unlimited.git
# 再把 "dsh-moren-unlimited" 加进 dsh.profile.bundles
```

### 3.3 在 DSH 内用插件管理器

打开 DSH 的插件管理界面，选择安装本地 bundle，目标填本目录的**绝对路径**。宿主会完成包安装与 bundle 选择。安装完成后同样需要重启。

---

## 4. 升级

```bash
cd dsh-moren-unlimited
git pull
# link 安装无需重新 pnpm add；重启 dsh web
```

如果改过包名/依赖，重新跑 `node scripts/install.mjs`。

---

## 5. 卸载

```bash
node scripts/install.mjs --remove
# 或
cd ~/.dsh/profiles/web
pnpm remove dsh-moren-unlimited
# 并从 package.json 的 dsh.profile.bundles 删掉 dsh-moren-unlimited
```

`$DSH_HOME/moren/` 下的快照、spill、统计不会自动删除；需要彻底清理时：

```bash
rm -rf ~/.dsh/moren
```

---

## 6. 常见错误

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `profile "web" 尚未初始化` | 没有跑过 `dsh --profile web` | 先启动一次 |
| 左侧栏没有 Moren | 宿主未重启 / client 未加载 | 重启、刷新；跑 `verify.mjs` 看 `客户端模块` |
| 模式选择器没有 Moren | bundle 未加进 `dsh.profile.bundles` | 检查 `package.json`；或页面点「重新注册模式」 |
| `agentPresets registry unavailable` | 宿主没 compose 预设注册表 | 确认 `@deepseek-ai/dsh-base` 在 bundles 里 |
| 子代理报 `maxDepth` 不支持 | 自定义 provider 不支持深度 | 本模式默认 `spawn`，支持；换回 spawn |
| 视频没有关键帧 | 没有 ffmpeg | `sudo apt install -y ffmpeg` |
| pnpm peer warning | 本包 `peerDependencies` 指向 dsh | 警告不影响；宿主由 dsh 提供 |

---

## 7. 安全说明

- 本插件不改 dsh 安装目录、不改 purge/梁神包
- 回退 API 只接受同源请求，且只操作 `$DSH_HOME` 内的白名单文件
- `approvalNever` 只影响 **Moren 模式会话**；其它模式保持原策略
- 快照包含 `prompt-inject.md` 与 profile 配置，注意备份目录权限（默认 0700）
