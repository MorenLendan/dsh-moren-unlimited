# 回退教程

## 1. 设计目标

用户已有的回退可能是：

- dsh-purge 的宿主补丁 `.dshpurge.bak`
- 手动备份的 profile 文件
- 别的插件自己的备份

Moren 不假设它们可用，而是：

1. **识别**：读 purge 的 `.bak` 数量与 override 状态
2. **自检**：校验自己的快照（哈希、试恢复、可写性）
3. **修复**：隔离坏快照，建立健康基线
4. **替代**：purge 没有 `.bak` 时，用 Moren 快照承担 profile 级回退

> 你的当前环境里 purge 的 `.bak` 数量为 0（页面会显示「无宿主备份」），Moren 会自动建立健康快照作为替代。这是正常路径，不是错误。

---

## 2. 快照内容

```
$DSH_HOME/moren/snapshots/<timestamp>-<rand>/
├── manifest.json
└── files/
    ├── prompt-inject.md
    ├── dsh-purge/override-state.json
    ├── profile/cordis.patch.yml
    ├── profile/package.json
    ├── profile/cordis.yml
    ├── profile/pnpm-workspace.yaml
    └── agent-presets/<preset>/agent.cordis.yml | preset.yml
```

`manifest.json`：

```json
{
  "version": 1,
  "id": "2026-11-07T09-27-58-220Z-m17jx1",
  "complete": true,
  "created_at": "2026-11-07T09:27:58.226Z",
  "reason": "before-install",
  "label": "pre-install",
  "files": [
    { "rel": "profile/cordis.patch.yml", "kind": "profile", "bytes": 123, "sha256": "…", "mode": 420 }
  ],
  "missing": []
}
```

`complete` 最后写入；崩溃留下的半份快照会被隔离。

---

## 3. 自动检查

宿主启动时（`autoRepairRollback: true`）：

1. 遍历 `snapshots/`
2. 校验 manifest 结构、`complete`、版本、id
3. 逐个文件比对 **大小 + SHA-256**
4. **试恢复**：复制到 `$DSH_HOME/moren/verify/<id>-<ts>/` 再比对哈希
5. 检查目标目录可写（向上找最近存在目录 `access(W_OK)`）
6. 失败 → 重命名 `<id>.broken-<时间戳>`（不删除）
7. 没有健康快照 → `createSnapshot({ reason: "auto-repair-baseline" })`
8. 写 `rollback-state.json`、`auto-check.json`

页面状态：

- `Moren 回退：可用/不可用`
- `dsh-purge 宿主备份：n 个 .bak`
- `自动检查：时间`

---

## 4. 手动流程

### 4.1 创建

```js
moren_snapshot({ action: "create", label: "before-config" })
```

页面按钮：**创建快照**。

### 4.2 校验

```js
moren_snapshot({ action: "verify" })          // 最新快照 + 完整状态
moren_snapshot({ action: "verify", id: "…" }) // 指定快照
```

### 4.3 恢复

```js
moren_snapshot({ action: "restore", id: "2026-11-07T09-27-58-220Z-m17jx1" })
```

行为：

1. 先完整校验；不通过直接拒绝
2. 自动创建 `pre-restore:<id>` 快照
3. 逐文件 `tmp + rename` 原子覆盖
4. 写 `rollback-state.json`
5. 返回 `pre_snapshot`，不满意可以再恢复回去

恢复后重启 `dsh web`，让宿主补丁/预设拿到快照点状态。

### 4.4 修复

```js
moren_snapshot({ action: "repair" })
```

页面按钮：**修复回退**。

### 4.5 清理

```js
moren_snapshot({ action: "prune", keep: 10 })
```

只删最旧的、超出保留数的快照；`.broken-*` 目录不参与排序，需要手动清理。

---

## 5. 典型场景

### 场景 A：改 cordis.patch.yml 后模式消失

```text
1. 页面「校验回退」→ 看最新快照是否健康
2. 「恢复」最近的 before-config 快照
3. 重启 dsh web
4. 重新选择 Moren 模式
```

### 场景 B：快照校验失败

```text
1. 页面「修复回退」
2. 坏快照被隔离为 *.broken-<ts>
3. 自动建立新基线
4. 检查磁盘空间/权限（目录需 0700，文件可写）
```

### 场景 C：purge 回退不可用

```text
1. 页面确认「无宿主备份」
2. 用 Moren 快照覆盖 profile 级回退
3. 要恢复宿主补丁：打开 purge 面板 → 应用（生成 .bak）→ purge_revert
```

### 场景 D：恢复错了

```text
1. 每次 restore 都会先建 pre-restore 快照
2. 在快照表里找 reason=pre-restore:<id>
3. 恢复它
```

---

## 6. 边界与限制

- 快照只覆盖**白名单文件**，不是整机备份
- 不包含 `node_modules`（避免巨大与符号链接问题）
- 不包含 sessions 数据库
- 不修改 purge 的 `.bak`
- 不保证跨 DSH 版本兼容；升级 DSH 后建议新建快照
- 恢复是覆盖，不删除快照点之后新增的其它文件

---

## 7. 目录与状态文件

```
$DSH_HOME/moren/
├── snapshots/
├── spill/            # Token 守卫折叠的完整输出
├── frames/           # 视频抽帧
├── compact/          # token_audit compact 输出
├── token-stats.json
├── rollback-state.json
└── auto-check.json
```
