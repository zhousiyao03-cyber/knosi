# 2026-03-28 Personalized Dashboard Greeting

- date: 2026-03-28
- task / goal: 让首页也带上当前用户身份，增强进入系统时的参与感。
- key changes:
  - 首页标题区新增按时间段变化的问候语。
  - 首页主标题改为优先显示当前用户昵称；没有昵称时退回邮箱前缀。
  - 首页说明文案同步收口，不再重复“首页”这个泛标题。
- files touched:
  - `src/app/(app)/page.tsx`
  - `src/app/(app)/layout.tsx`
  - `src/components/layout/workspace-identity-provider.tsx`
  - `docs/changelog/personalized-dashboard-greeting.md`
- verification commands and results:
  - `pnpm lint` -> 通过。
  - 真实登录本地 TEST 账号后访问首页，检查个性化问候 -> 通过，首页同时显示时间段问候和 `TEST`。
- remaining risks or follow-up items:
  - 当前首页个性化已经改为复用 app 布局层的服务端身份下发；如果后续要继续增强参与感，可以再补“最近为你准备好的内容”这类个性化副标题。
