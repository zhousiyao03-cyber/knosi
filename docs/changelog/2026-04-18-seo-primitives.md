# 2026-04-18 — SEO primitives (P0)

## 任务 / 目标

网站 `knosi.xyz` 在 Google 上几乎搜不到。落地最小可行的 SEO 基础设施（robots、sitemap、rich metadata），把站点提交给 Google Search Console 之前先确保页面本身可被发现、可被渲染成像样的搜索结果。

## 关键变更

- **新增 `src/app/robots.ts`** — 静态 `/robots.txt`，允许爬取 `/` 和 `/share/`，禁止所有认证后的应用路径（`/dashboard`、`/notes`、`/settings`、`/api/...` 等），并声明 `Host` + `Sitemap`。
- **新增 `src/app/sitemap.ts`** — ISR（revalidate 3600s）生成 `/sitemap.xml`，包含首页 + 所有带 `shareToken` 的公开笔记与项目笔记 URL。DB 访问用 try/catch 包起来，连不上数据库时仍能返回静态条目。
- **扩充 `src/app/layout.tsx` 的 `metadata`**：
  - `metadataBase: https://knosi.xyz`
  - `title: { default, template: "%s · Knosi" }`
  - 描述性更强的 title / description，覆盖 og、twitter、keywords、alternates.canonical
  - `robots.googleBot` 指令（`max-snippet: -1`、`max-image-preview: large`）
  - `openGraph.images` 指向 `/knosi-logo.png`（512×512，PNG，已在 public/）
- **把 `<html lang="zh">` 改成 `lang="en"`** — 落地页和所有公开页面全是英文，之前的标签会误导 Google 的语言定向。
- **放行 middleware 的三个 public 路径**：`src/proxy.ts` 之前会把 `/robots.txt`、`/sitemap.xml`、`/manifest.webmanifest` 一并 307 到 `/login`，导致爬虫永远看不到这些文件。现已加入 public 白名单。
- **新增 `e2e/seo.spec.ts`** — 三个 smoke test：robots.txt 规则 & sitemap 引用、sitemap.xml 内容、landing page 的 `lang="en"` + og/twitter/canonical meta。

## 涉及文件

- `src/app/robots.ts`（新）
- `src/app/sitemap.ts`（新）
- `src/app/layout.tsx`（metadata 扩充 + lang 修正）
- `src/proxy.ts`（public 白名单加 robots / sitemap / manifest）
- `e2e/seo.spec.ts`（新）
- `docs/changelog/2026-04-18-seo-primitives.md`（本文件）

## 验证

- `pnpm build` → ✅ 通过。构建产物路由列表显示 `/robots.txt` 为 Static，`/sitemap.xml` 为 ISR（revalidate 1h）。
- `pnpm lint` → ✅ 0 errors（8 个既有 warning，与本次改动无关）。
- **实地 HTTP 验证**（`pnpm dev --port 3150`）：
  - `GET /robots.txt` → 200，正确列出 Allow / Disallow / Host / Sitemap。
  - `GET /sitemap.xml` → 200，合法 XML，包含 `https://knosi.xyz/` 条目。
  - `GET /` → HTML 中 `<html lang="en">`、`<link rel="canonical" href="https://knosi.xyz">`、完整 `og:*` / `twitter:*` / `keywords` / `description` meta 全部到位。
- `pnpm test:e2e`（含新加的 `seo.spec.ts`）**未能在本机跑通** —— 本机 Windows 上 `data/second-brain.e2e.db` 存在一个与本次改动无关的 `EBUSY unlink` 既有问题（怀疑是前次 Playwright 运行残留的 libsql 句柄被 Windows 延迟释放）。Linux CI 不受影响，`seo.spec.ts` 本身的断言在 dev server 上全部可人工对齐。该 e2e infra 问题另行追踪。

## 数据库 / 生产环境

本次改动不涉及 schema，无需生产 Turso rollout。

## 已知风险 / 后续

- 需要用户自己去 [Google Search Console](https://search.google.com/search-console) 做域名验证（TXT 记录或 DNS CNAME），并提交 `https://knosi.xyz/sitemap.xml` + 对首页 "请求编入索引"。
- P1：apex `knosi.xyz` 和 `www.knosi.xyz` 目前两个都通过 Traefik 直接服务，建议二选一做 301（权重不分散）。
- P1：`ops/k3s/30-ingress.yaml` 里 `www.knosi.xyz` 和 `knosi.xyz` 共存，应挑一个 canonical host 并在另一个上做重定向。
- P2：`/share/[token]` 和 `/share/project-note/[token]` 页面目前没有 `generateMetadata`，公开分享的笔记在搜索结果里只能显示根 layout 的默认 title。对 long-tail SEO 有价值，可择期加上。
- 本机 Windows 上 `e2e/global-setup.ts` 的 `rmSync` 路径在多次连续运行后会 EBUSY，是 infra 层面的独立问题，不在本次范围内。
