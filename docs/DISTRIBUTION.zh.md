# 怎么让 DSH 用命令安装这个插件

结论先说：DSH 的插件是 **npm 包 + bundle patch**，不是“把文件夹丢进某个目录”就行。

## 1. DSH 插件的最小结构

```json
{
  "name": "dsh-moren-unlimited",
  "type": "module",
  "main": "index.js",
  "exports": { ".": "./index.js", "./client": "./client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["..."] }
  }
}
```

- `dsh.bundle.patch`：这个包被启用时要插入的 Cordis 行
- `dsh.client`：Web 端模块（可选）
- 包里没有构建步骤，纯 ESM/JS

## 2. 为什么 `dsh plugin add` 不够

```bash
dsh plugin --profile web add dsh-moren-unlimited
```

它只是把参数转发给 profile 目录里的 `pnpm`：

```bash
pnpm add dsh-moren-unlimited
```

它**不会**把包名写进：

```json
"dsh": { "profile": { "bundles": ["dsh-moren-unlimited"] } }
```

所以包已下载，但 DSH 启动时不会 compose 它。必须再做一步：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-moren-unlimited"
      ]
    }
  }
}
```

本仓库的 `scripts/install.mjs` 就是同时做这两步：

```bash
node scripts/install.mjs --profile web
```

DSH 内部的插件管理器 `install_bundle` 也是做同样的事；它没有对应的公开 CLI 子命令。

## 3. 用 GitHub 一条命令安装

仓库公开后：

```bash
curl -fsSL https://raw.githubusercontent.com/MorenLendan/dsh-moren-unlimited/main/scripts/install-remote.sh | bash
```

它会：

1. clone 到 `~/.dsh/plugins/dsh-moren-unlimited`
2. 调 `scripts/install.mjs`
3. 写入 `dsh.profile.bundles`

指定 profile：

```bash
curl -fsSL .../install-remote.sh | bash -s -- --profile web
```

或手动：

```bash
git clone https://github.com/MorenLendan/dsh-moren-unlimited.git
cd dsh-moren-unlimited
node scripts/install.mjs --profile web
```

然后重启：

```bash
dsh web
```

## 4. 发布到 npm 后

```bash
cd dsh-moren-unlimited
npm login
npm publish --access public
```

用户：

```bash
dsh plugin --profile web add dsh-moren-unlimited
# 再把 dsh-moren-unlimited 加进 dsh.profile.bundles
# 或直接：
npx dsh-moren-install --profile web
```

`package.json` 已声明：

```json
"bin": { "dsh-moren-install": "./scripts/install.mjs" }
```

如果 npm 上包名被占用，改成 scope：

```json
"name": "@morenlendan/dsh-moren-unlimited"
```

同时把 `dsh.profile.bundles`、`dsh-moren-install` 的引用一起改。

## 5. 为什么 GitHub 链接不能直接 `dsh plugin add`

`dsh plugin add git+https://...` 仍然是 pnpm 安装，bundle 行还是要自己加。想要真正“一条命令”，只有两条路：

1. 发布 npm 包（用户仍需 bundle 行，或用我们的 installer）
2. 用 `scripts/install-remote.sh` 包装 git clone + bundle 写入

DSH 0.2.2 没有 `dsh plugin install-and-enable` 这样的原子命令；`install_bundle` 是宿主 API，不是 CLI。

## 6. 公开仓库

```bash
gh repo create dsh-moren-unlimited --public --source=. --remote=origin --push
```

或：

```bash
GITHUB_USER=MorenLendan GITHUB_TOKEN=<PAT> ./scripts/publish-github.sh
```

发布后确认 Settings → General 底部显示 **Public**。
