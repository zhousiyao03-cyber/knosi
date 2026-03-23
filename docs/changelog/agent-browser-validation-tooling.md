# 2026-03-23 - Agent Browser Validation Tooling

Task / goal:
- 安装 `agent-browser` 到仓库里，方便后续直接用浏览器自动化 CLI 做页面验证，而不是只依赖 Playwright。

Key changes:
- 将 `agent-browser@0.21.2` 加入项目 `devDependencies`，以便通过 `pnpm exec agent-browser ...` 在仓库内直接调用。
- 新增 `pnpm run browser:install` 脚本，供没有本地 Chrome 或想固定使用 Chrome for Testing 的环境执行一次性浏览器安装。
- 在 `README.md` 中补充 Browser 验证说明，记录常用命令和使用前提。
- 本机安装后自动识别到了系统 Chrome，因此当前机器无需额外下载 Chrome for Testing 也能直接运行。

Files touched:
- `package.json`
- `pnpm-lock.yaml`
- `README.md`
- `docs/changelog/agent-browser-validation-tooling.md`

Verification commands and results:
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm add -D agent-browser@0.21.2` -> ✅ 安装成功；postinstall 输出 `Native binary ready: agent-browser-darwin-arm64`，并识别到系统 Chrome。
- `printf '[ [\"open\", \"https://example.com\"], [\"get\", \"title\"], [\"snapshot\", \"-i\"], [\"close\"] ]' | PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm exec agent-browser batch --json` -> ✅ 成功打开页面，返回标题 `Example Domain`，并拿到带 refs 的 accessibility snapshot。
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm dev --port 3200` -> ✅ 本地 Next.js 服务正常启动，`http://localhost:3200` ready。
- `printf '[ [\"open\", \"http://127.0.0.1:3200/notes\"], [\"wait\", \"--load\", \"networkidle\"], [\"get\", \"title\"], [\"snapshot\", \"-i\"], [\"close\"] ]' | PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm exec agent-browser batch --json` -> ✅ 成功打开笔记页，返回标题 `Second Brain`，并在 snapshot 中识别到 `新建日记` / `新建笔记` 等页面元素。

Remaining risks / follow-up:
- `agent-browser` 现在是仓库内可执行的本地 CLI，我可以通过终端直接使用它验证页面；但它不会自动变成 Codex 当前会话里的内建工具按钮。
- 如果换到一台没有系统 Chrome 的机器，需要先执行 `pnpm run browser:install`，或者自行安装 Chrome。
