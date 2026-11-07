# Moren unrestricted LiangShen mode (dsh-moren-unlimited)

One native DSH agent preset that fuses **dsh-purge's unrestricted mode**, **unrestricted subagents**, and **LiangShen mode**, with a left-sidebar page.

- New mode in the new-session picker: **Moren无限制梁神模式**
- Subagents default to **Moren无限制梁神模式 · 无限制子任务** (up to 10 levels)
- dsh-purge and `@linxin666/dsh-liangshen` can stay enabled together
- Image/video inspection with frame extraction, local PNG generation, codecs, a token guard, and a self-checking rollback

## Install

Requires Node.js >= 24.9 and DSH.

```bash
npm i -g @deepseek-ai/dsh

git clone https://github.com/MorenLendan/dsh-moren-unlimited.git
dsh plugin --profile web add link:$PWD
# restart dsh web
```

Or:

```bash
dsh plugin --profile web add git+https://github.com/MorenLendan/dsh-moren-unlimited.git
```

## Use

1. Open the Web GUI, create a session, pick **Moren无限制梁神模式**.
2. The left sidebar shows a **Moren** entry with Status / Mode / Rollback / Capabilities / Compatibility / Docs.
3. Agent tools (only on this preset):
   - `moren_media_inspect({ path, frames })`
   - `moren_image_generate({ prompt, width, height })`
   - `moren_codec({ action, format, text | inputPath, outPath })`
   - `moren_token_audit({ path | text, action })`
   - `moren_snapshot({ action: create|list|verify|restore|repair|status|prune })`

## Rollback

Snapshots live under `$DSH_HOME/moren/snapshots`. Each manifest records size + SHA-256; verification also test-restores into a scratch directory. On boot the plugin checks the newest snapshot, quarantines damaged ones as `*.broken-<timestamp>`, and creates a healthy baseline when none exists. purge's `.dshpurge.bak` state is reported separately; this plugin never touches it.

## Compatibility

Unique preset ids, unique panel id, no dsh source patches, no writes into other plugins. purge's host patches remain purge's own switch; LiangShen's preset remains selectable on its own.

## Docs

- [docs/INSTALL.zh.md](docs/INSTALL.zh.md)
- [docs/USAGE.zh.md](docs/USAGE.zh.md)
- [docs/ROLLBACK.zh.md](docs/ROLLBACK.zh.md)
- [docs/ARCHITECTURE.zh.md](docs/ARCHITECTURE.zh.md)

Apache-2.0. Vendored LiangShen preset modules retain their NOTICE.
