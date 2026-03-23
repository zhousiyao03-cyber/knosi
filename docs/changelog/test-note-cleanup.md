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

# 2026-03-23 - Test Note Cleanup (Post Isolated E2E DB)

Task / goal:
- 清理主库里混入的历史测试笔记和残留索引，确保切换到独立 Playwright 测试库后，本地真实笔记不再继续被旧测试数据干扰。

Key changes:
- 先盘点主库 `notes` 表，按高置信度规则识别出 `135` 条测试笔记候选：
  - `无标题笔记`
  - `apple-*`
  - `banana-*`
  - `edit-title-*`
  - `save-*`
  - `v1-note-*`
  - 带 `["ask-ai"]` 标签的 `AI 问答：把这段保存下来`
- 在系统临时目录创建数据库备份后，删除上述 `135` 条候选笔记，并同步清理它们关联的 `knowledge_chunks` / `knowledge_index_jobs` 记录。
- 复核剩余笔记时发现还有 `2` 条标题为 `2026年3月23日`、内容完全未编辑的空白日记模版，判断为功能验证遗留，再次删除并一并清掉关联索引。
- 追加一致性检查后，又清理了 `2` 条历史孤儿 `knowledge_chunks` 和 `6` 条历史孤儿 `knowledge_index_jobs`，确保知识索引里不再引用不存在的笔记。
- 最终主库只保留 `3` 条更像真实内容的笔记：`3.22`、`3.23`、`3月份的挣扎与思考`。

Files touched:
- `data/second-brain.db`（本地运行时数据，git ignored）
- `docs/changelog/test-note-cleanup.md`

Verification commands and results:
- `sqlite3 data/second-brain.db ".backup '/tmp/second-brain-20260323-125411-before-test-note-cleanup.db'"` -> ✅ 已创建清理前备份。
- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS total_before FROM notes; ..."` -> ✅ 清理前主库共有 `140` 条笔记，其中高置信度测试候选 `135` 条；关联 `knowledge_chunks` 有 `33` 条，关联 `knowledge_index_jobs` 有 `146` 条。
- 执行删除事务后，`deleted_notes = 135`，`deleted_chunks = 33`，`deleted_jobs = 146` -> ✅ 第一轮清理完成后，主库剩余 `5` 条笔记。
- `sqlite3 -header -column data/second-brain.db "SELECT id, title, type, plain_text FROM notes WHERE title = '2026年3月23日';"` -> ✅ 发现 `2` 条内容完全相同、未编辑的空白日记模版。
- 第二轮删除事务结果：`journal_template_candidates = 2`，`deleted_notes = 2`，`deleted_chunks = 6`，`deleted_jobs = 2` -> ✅ 主库剩余 `3` 条笔记。
- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS orphan_chunks ...; SELECT COUNT(*) AS orphan_jobs ...; SELECT COUNT(*) AS orphan_embeddings ...;"` -> ✅ 发现并清理 `2` 条孤儿 note chunks、`6` 条孤儿 note jobs；最终三类孤儿记录均为 `0`。
- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS total_notes_final FROM notes; SELECT title, COUNT(*) AS count FROM notes GROUP BY title ORDER BY count DESC, title; ..."` -> ✅ 最终主库仅剩 `3` 条笔记，标题分别为 `3.22`、`3.23`、`3月份的挣扎与思考`，且 note 相关孤儿索引为 `0`。

Remaining risks / follow-up:
- 本次清理对主库做了直接删除；如果你发现某条被误删，可以从 `/tmp/second-brain-20260323-125411-before-test-note-cleanup.db` 恢复。
- `3.23` 目前仍是一条空白笔记；因为它不符合现有测试命名规则，我这次选择保留。若你也确认它是无用草稿，可以再补做一轮更激进的人工清理。
