# 2026-03-23 - Pin Node Version With .nvmrc

Task / goal:
- 固定项目使用的 Node 版本，避免 `better-sqlite3` 这类原生模块在不同 Node ABI 之间切换时导致 `pnpm dev` 启动失败。

Key changes:
- 新增根目录 `.nvmrc`，固定为 `22.16.0`，与当前已验证可运行的本地开发环境保持一致。
- 更新 `README.md` 的快速开始说明，提示先执行 `nvm use`（首次可先 `nvm install`），减少因版本漂移造成的环境问题。

Files touched:
- `.nvmrc`
- `README.md`
- `docs/changelog/node-version-pin.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; nvm use && node -v` -> ✅ 自动切换到 `.nvmrc` 中的 `v22.16.0`。
- `source ~/.zshrc >/dev/null 2>&1; pnpm exec node -e "require('better-sqlite3'); console.log('better-sqlite3:ok')"` -> ✅ 在 Node `22.16.0` 下成功加载原生模块。
- `source ~/.zshrc >/dev/null 2>&1; pnpm dev --port 3000` -> ✅ 临时验证可启动，首页和 `/api/trpc/dashboard.stats,tokenUsage.overview` 请求正常返回。

Remaining risks / follow-up:
- 如果你后面想切回 Node 20，需要重新执行一次 `pnpm rebuild better-sqlite3` 或重新安装依赖，否则仍可能出现 ABI 不匹配。
