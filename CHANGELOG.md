# Changelog

## 1.0.1 — 2026-11-07

- 回退根因修复：`profile/...` 快照路径现在映射到**实际 profile 目录**；1.0.0 会写到 `$DSH_HOME/profile/`，真实 profile 完全没变，看起来“恢复成功”但什么都没回退
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
