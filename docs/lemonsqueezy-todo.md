# Lemon Squeezy 回信 — 明天待办

> 英文完整材料（邮件模板 / demo 脚本 / pricing 一页纸）在
> `docs/lemonsqueezy-review-reply.md`。这份只是中文速查。

## 背景

2026-04-24 Lemon Squeezy 的 Ankith 发邮件要求补材料：定价、demo 视频、个人社交链接、产品更具体的描述、ToS / Privacy / Refund。

## Claude 已经做完的

- `/legal/terms`、`/legal/privacy`、`/legal/refund` 三页法律文档已写好并 push（commit `327d091`）
- landing 页 + pricing 页 footer 都加了三个法律链接 + `support@knosi.xyz`
- pricing 页加了一行"14-day money-back guarantee"提示
- sitemap 加了 4 个新路由
- e2e/legal.spec.ts 回归测试
- `docs/lemonsqueezy-review-reply.md` 里有完整英文回信模板

部署状态：push 后 GitHub Actions 自动部署到 Hetzner，约 6 分钟完成。

## 明天要做的 4 件事（按顺序）

### 1. 确认部署成功（30 秒）

```bash
curl -I https://www.knosi.xyz/legal/terms
curl -I https://www.knosi.xyz/legal/privacy
curl -I https://www.knosi.xyz/legal/refund
```

三个都 200 就 OK。如果是 404，去 `gh run list --workflow=deploy-hetzner.yml --limit 3` 看 workflow 有没有失败。

### 2. 确认 support@knosi.xyz 能收信（5 分钟）

三页法律文档都引用了这个地址。如果还没设置：

- 去域名注册商 / Cloudflare 给 knosi.xyz 加一个 email forwarding 规则
- 把 `support@knosi.xyz` 转发到你的个人邮箱
- 自己发一封测试邮件确认能收到

### 3. 录 demo 视频（30–45 分钟）

详细脚本在 `docs/lemonsqueezy-review-reply.md` 第 5 节。速览：

- 2–4 分钟就够，不要做得太精致
- 用 OBS 或 Loom 录屏，浏览器缩放 110–125%
- 用干净的测试账号（不要露个人笔记）
- 流程：landing 页 → 注册 → 建笔记（秀 slash command / Mermaid / callout）→ Ask AI 提问 → 去 pricing 页点 Upgrade 展示 Lemon Squeezy checkout 窗口（不用真付款）→ 翻到 footer 指一下 Terms / Privacy / Refund
- 上传 YouTube 选 **Unlisted**，或者 Loom 选 "anyone with the link"

### 4. 发回信（5 分钟）

打开 `docs/lemonsqueezy-review-reply.md` 第 3 节的邮件模板，把三个占位符填好：

- `[INSERT UNLISTED YOUTUBE OR LOOM LINK]` — 视频链接
- `[INSERT LINKEDIN URL]` — LinkedIn（必填，审核员最看这个）
- `[INSERT GITHUB URL]` — GitHub
- `[INSERT OR DELETE]` — X/Twitter（可选，有就填，没有就删掉这一行）

**LinkedIn 注意**：发之前过一眼你的 LinkedIn 主页——头像、headline、当前岗位要像样。空白账号会被质疑。

发完邮件等 2–5 个工作日回复。

## 两个要留意的坑

1. **Governing law 模糊措辞**：`src/app/legal/terms/page.tsx` 第 17 条说的是"Knosi 运营方所在司法辖区"。如果你之后在某国注册了公司，把这条改成具体法域更稳。目前这样发过去审核够用。

2. **e2e 本地没跑起来**：Next 16 dev server 在 Windows 有自检 bug。CI 会自动跑 `e2e/legal.spec.ts`，本地不用纠结。

## 快速索引

| 要找的东西 | 位置 |
| --- | --- |
| 回信模板 | `docs/lemonsqueezy-review-reply.md` 第 3 节 |
| Pricing 一页纸 | `docs/lemonsqueezy-review-reply.md` 第 4 节 |
| Demo 脚本 | `docs/lemonsqueezy-review-reply.md` 第 5 节 |
| Terms 源文件 | `src/app/legal/terms/page.tsx` |
| Privacy 源文件 | `src/app/legal/privacy/page.tsx` |
| Refund 源文件 | `src/app/legal/refund/page.tsx` |
| 本次 commit | `327d091` (on `main`) |
