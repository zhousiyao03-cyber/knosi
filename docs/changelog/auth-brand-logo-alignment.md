# 2026-03-28 - Auth Brand Logo Alignment

Task / goal:
- 把登录页和注册页顶部仍然残留的旧 `S` 字母块替换成和主应用一致的品牌 logo。

Key changes:
- 更新 `src/app/login/page.tsx`，在登录卡片顶部改用共享的 `AppBrand` 紧凑版标识。
- 更新 `src/app/register/page.tsx`，让注册页和登录页保持同一套品牌视觉。

Files touched:
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `docs/changelog/auth-brand-logo-alignment.md`

Verification commands and results:
- `pnpm lint` -> ✅ 通过。
- `pnpm build` -> ✅ 通过，Next.js 16 生产构建成功。

Remaining risks / follow-up:
- 当前只统一了认证页顶部品牌块；如果后续要继续做 README 截图或营销页，建议再统一公开页里的品牌露出风格。
