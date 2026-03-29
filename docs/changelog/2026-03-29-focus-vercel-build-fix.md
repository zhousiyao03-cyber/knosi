# 2026-03-29 Focus Vercel Build Fix

## Task / Goal

修复 Vercel 生产构建失败，避免 Web 部署时把独立的 Tauri `focus-tracker/` 工程纳入 Next.js 的 TypeScript 检查。

## Key Changes

- 将根项目 `tsconfig.json` 的 `exclude` 扩展为排除 `focus-tracker/`
- 保持 Web 应用和桌面端工程的 TypeScript 边界分离，避免 Vercel 在安装根项目依赖时解析 Tauri 专属包
- 补充 README，明确 Web 构建与桌面端构建是分开的

## Files Touched

- `tsconfig.json`
- `README.md`
- `docs/changelog/2026-03-29-focus-vercel-build-fix.md`

## Verification Commands And Results

- `pnpm build`
  - passed
- `git diff -- tsconfig.json README.md`
  - confirmed only deployment-scope changes

## Remaining Risks / Follow-up

- 这次修的是 Vercel Web build 范围，不影响 `focus-tracker/` 自己的构建；桌面端仍需在其目录内单独执行 `pnpm build` / `cargo` 流程。
- 推送修复后仍需看一次 Vercel 构建日志，确认线上生产构建通过。
