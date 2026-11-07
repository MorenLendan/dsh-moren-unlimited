# Changelog

## 1.0.6 — 2026-11-07

- 新增 Moren 自己的输入框「回退」按钮，直接调用 `/dsh-purge/rewind`，不依赖 purge 的 session 绑定
- 隐藏 purge 在 DSH 0.2.2 下被禁用的回退按钮，避免两个入口
- 回退成功后尝试把上一句放回输入框并重新打开会话
- 保留页面「对话回退」和 `/rewind once` 兜底

## 1.0.5 — 2026-11-07

- 新增 Moren 页面「对话回退」按钮：直接执行 `/rewind once`，不依赖 purge 输入框按钮
- 保留 1.0.4 的同步早注入 shim，修复输入框「回退」按钮的 session 绑定

## 1.0.4 — 2026-11-07

- 回退按钮兼容 shim 改为**同步早注入**，不再依赖 `uiSession` 注入；修复 1.0.3 中 `ctx.inject` 回调未执行导致按钮仍禁用
- shim 优先用 `uiSession.current`，回退 `sessions.list.retainedBy.mainView`

## 1.0.3 — 2026-11-07

- 修复 purge 对话回退按钮在 DSH 0.2.2 下无反应：补回 `uiWorkspace.selection` 会话绑定（`uiSession.current` / `sessions.list` 双来源）
- 修复壁纸在 AppFrame 与 ConversationRoot 被 `--dsw-alias-bg-base` 背景盖住
- 修复壁纸不透明度/模糊不生效：移除重复 html 背景层
- 发布 Release 1.0.3 tarball

## 1.0.2 — 2026-11-07

- 壁纸在聊天/主界面不显示：清理 AppFrame 与 ConversationRoot 的 `--dsw-alias-bg-base` 背景层
- 壁纸不透明度/模糊：移除重复的 html 背景图，只保留可调层
- 修复 purge 对话回退按钮无反应：为 DSH 0.2.2 补回 `uiWorkspace.selection` 会话绑定
- 新增左侧栏「壁纸」页：上传 PNG/JPEG/WebP/GIF（最大 20MB）作为 DSH Web 背景
- 壁纸保存到 `$DSH_HOME/moren/wallpaper`，设置保存到 `wallpaper.json`，刷新/重启后仍生效
- 支持不透明度、模糊、压暗、cover/contain；纯 CSS 背景层，不改 DSH 前端
- 壁纸设置纳入回退快照（只快照 JSON，不复制大图）

## 1.0.1 — 2026-11-07

- 回退根因修复：`profile/...` 快照路径现在映射到**实际 profile 目录**；1.0.0 会写到 `$DSH_HOME/profile/`，真实 profile 完全没变，看起来“恢复成功”但什么都没回退
- 非 web profile 修复：`profileDir()` 从 `--profile <name>` argv 解析，不再一律落到 `profiles/web`
- 回退修复：恢复旧快照时自动保留 Moren 自身（link 依赖 + bundle 行 + node_modules 链接），不再把回退工具删掉
- 回退修复：增加 profile / DSH_HOME 归属校验，拒绝跨 profile 恢复；恢复后缓存立即失效
- 梁神完整性：补回漏掉的 `str-replace-editor` 行
- 梁神完整性：`dispatcher` 默认恢复为 true（1.0.0 默认 false 属于功能偏差）
- 梁神完整性：`tool-catalog.descriptionMaxLength` 恢复 200，与上游一致
- 诊断：区分「Moren profile 回退」与「purge 宿主 .bak 回退」，无 .bak 时明确说明

## 1.0.0 — 2026-11-07

- 首个版本：`Moren无限制梁神模式` 父/子 agent 预设
- 合并 dsh-purge 无限制模式、无限制子任务与梁神模式
- 左侧栏 Moren 入口 + 整页状态/模式/回退/能力/兼容/教程
- `moren_media_inspect`、`moren_image_generate`、`moren_codec`、`moren_token_audit`、`moren_snapshot`
- Token 守卫：超大工具结果折叠 + 15 分钟去重命中
- 回退：快照 create/verify/restore/repair/prune，启动自动检查与损坏隔离
- 兼容：purge / 梁神模式同时开启，不修改宿主源码
