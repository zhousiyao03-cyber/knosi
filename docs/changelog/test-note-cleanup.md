# 2026-03-22 - Test Note Cleanup

Task / goal:
- 清理本地 `notes` 表中无用的测试笔记，保留真实用户内容，降低 Ask AI / 搜索被测试数据污染的风险。

Key changes:
- 先检查 `PLAN.md`，确认本次操作属于笔记模块的数据清理，不涉及越阶段开发。
- 盘点本地 SQLite `notes` 表，识别出 E2E / 手测遗留模式：
  - `v1-note-*`
  - `edit-title-*`
  - `save-*`
  - `apple-*`
  - `banana-*`
  - `del-*`
  - `AI 问答：把这段保存下来`
  - `测试笔记标题` / `要删除的笔记` / `手动保存测试`
  - 空内容或明显占位内容的 `无标题笔记`
  - 其余确认无业务价值的零散手测记录
- 在系统临时目录创建数据库备份后，删除上述测试笔记。
- 清理完成后复核 `notes` 表，仅保留 1 条真实笔记：`3月份的挣扎与思考`。

Files touched:
- `data/second-brain.db`（本地运行时数据，git ignored）
- `docs/changelog/test-note-cleanup.md`

Verification commands and results:
- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS total_before FROM notes;"` -> ✅ 清理前共 `237` 条笔记。
- `sqlite3 -header -column data/second-brain.db "SELECT title, COUNT(*) AS count FROM notes GROUP BY title ORDER BY count DESC, title LIMIT 40;"` -> ✅ 确认大量标题符合测试残留模式。
- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS total_notes FROM notes; SELECT id, title, type, length(coalesce(plain_text,'')) AS plain_len FROM notes;"` -> ✅ 清理后仅剩 `1` 条笔记，标题为 `3月份的挣扎与思考`。
- `sqlite3 data/second-brain.db ".backup '/tmp/second-brain-20260322-182059-before-test-note-cleanup.db'"` -> ✅ 已创建清理前临时备份，便于必要时回滚。

Remaining risks / follow-up:
- 本次删除直接作用于本地 SQLite 数据；如果你后面发现某条测试外观但仍想保留的内容，可以从 `/tmp/second-brain-20260322-182059-before-test-note-cleanup.db` 恢复。
- 现有时间戳仍显示为 1970 年附近，说明历史写入时间字段可能存在单位/格式问题；这不会影响本次清理结果，但后续值得单独修复。
