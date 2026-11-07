# 发布到 GitHub（公开仓库）

本仓库已经是一个完整的 git 仓库（`main` 分支已提交）。发布有两种方式。

## 方式 A：GitHub CLI（已登录时最省事）

```bash
cd dsh-moren-unlimited
gh auth status
gh repo create dsh-moren-unlimited --public --source=. --remote=origin --push
```

如果仓库已存在：

```bash
git remote add origin https://github.com/MorenLendan/dsh-moren-unlimited.git
git push -u origin main
gh repo edit --visibility public
```

## 方式 B：Token + 脚本

1. 创建 token（classic：勾 `repo`；fine-grained：目标仓库 `Contents: Read and write`）
2. 运行：

```bash
cd dsh-moren-unlimited
GITHUB_USER=MorenLendan GITHUB_TOKEN=<token> ./scripts/publish-github.sh
```

脚本会：

- `POST /user/repos` 创建 **public** 仓库
- 已存在则 `PATCH private:false` 确保公开
- 推送 `main`
- 把 `origin` 设回无 token 的地址

## 方式 C：手动

```bash
# 1) 网页创建 public 仓库（不要初始化 README）
# 2) 推送
git remote add origin https://github.com/MorenLendan/dsh-moren-unlimited.git
git push -u origin main
```

## 发布后检查

- 仓库 Settings → General → 底部应显示 **Public**
- README 顶部的 `MorenLendan` 替换成你的用户名：

```bash
grep -rl "MorenLendan" . --exclude-dir=.git
# 逐个替换，或：
grep -rl "MorenLendan" . --exclude-dir=.git | xargs sed -i "s/MorenLendan/MorenLendan/g"
git commit -am "docs: point install commands at the real repository"
git push
```

- 如果使用 `install.mjs`，安装命令不需要仓库地址；git 安装才需要。

## 常见失败

| 错误 | 处理 |
| --- | --- |
| `404 Not Found` on create | token 没有 `repo` 权限 |
| `422` + "name already exists" | 已存在，脚本会继续并设为 public |
| `push declined` | token 无 `Contents: write` |
| `could not resolve host` | 本机 DNS/代理问题；`git config --global http.proxy` 或在能访问 GitHub 的网络下推送 |
| 组织仓库 | `POST /orgs/<org>/repos`，并把脚本里的 `/user/repos` 换掉 |
