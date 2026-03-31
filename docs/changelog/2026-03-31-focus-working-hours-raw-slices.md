# 2026-03-31 Focus Working Hours Raw Slice Fix

## date

- 2026-03-31

## task / goal

- 修复 `/focus` 和 dashboard 里 `Working Hours / Filtered out` 与 `Top apps` 对不上口径的问题，避免短暂的社交类 interruption 被 display merge 吞掉后不再计入 non-work。

## key changes

- 修改 `src/server/focus/aggregates.ts`
  - `workHoursSecs` 与 `filteredOutSecs` 改为基于当天 raw day slices 的 `durationSecs` 计算。
  - display merge 仍用于 UI 展示，但不再参与 non-work 统计。
- 修改 `src/server/focus/aggregates.test.mjs`
  - 新增回归用例，覆盖 `coding -> WeChat -> coding` 被 display merge 合成一个工作块时，`filteredOutSecs` 仍应保留 WeChat 时长。
- 新增 `src/components/focus/focus-working-hours.ts`
  - 抽出 `Working Hours` 卡片下方的 `8h baseline` 文案逻辑，统一按 `workHoursSecs` 判断，不再误用 `totalSecs`。
- 新增 `src/components/focus/focus-working-hours.test.mjs`
  - 覆盖 `4h 44m` 仍应显示剩余时长、`8h+` 显示达标、空数据显示等待文案。
- 修改 `src/components/focus/focus-page-client.tsx`
  - `Working Hours` 卡片改为使用新的 helper，避免在 `tracked >= 8h` 但 `working < 8h` 时错误显示“已达标”。
- 更新 `README.md`
  - 明确 `Working Hours` 的统计口径是 raw session cumulative time minus non-work tags，而不是 display block 合并结果。

## files touched

- `src/server/focus/aggregates.ts`
- `src/server/focus/aggregates.test.mjs`
- `README.md`
- `src/components/focus/focus-page-client.tsx`
- `src/components/focus/focus-working-hours.ts`
- `src/components/focus/focus-working-hours.test.mjs`
- `docs/changelog/2026-03-31-focus-working-hours-raw-slices.md`

## verification commands and results

- `node --test --experimental-strip-types src/server/focus/aggregates.test.mjs`
  - ✅ 12 passed
- `node --test --experimental-strip-types src/server/focus/aggregates.test.mjs src/components/focus/focus-working-hours.test.mjs`
  - ✅ 15 passed
- `pnpm exec eslint src/server/focus/aggregates.ts src/server/focus/aggregates.test.mjs`
  - ✅ passed
- `pnpm exec eslint src/server/focus/aggregates.ts src/server/focus/aggregates.test.mjs src/components/focus/focus-working-hours.ts src/components/focus/focus-working-hours.test.mjs src/components/focus/focus-page-client.tsx`
  - ✅ passed
- `pnpm build`
  - ✅ passed
- `set -a; source .env.turso-prod.local; node --experimental-strip-types --input-type=module ...`
  - ✅ 线上 `2026-03-31` 数据重算后：
    - `totalSecs = 33289`
    - `workHoursSecs = 31588`
    - `filteredOutSecs = 1701`

## remaining risks or follow-up items

- 现在线上已经证明问题在统计口径而不是 tag 缺失；如果后续要让 `Lark`、`iPhone Mirroring` 等也进入 non-work，需要另行调整 tag 规则，而不是继续改聚合。
