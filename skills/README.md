# Knosi-shipped Claude Code skills

Reusable Claude Code skills that pair with this project's MCP server. Each skill's behavior is defined entirely in `SKILL.md`; there are no compiled artifacts here.

## How to install

Symlink each skill directory into your global Claude Code skills folder:

```bash
ln -s "$(pwd)/skills/bagu" ~/.claude/skills/bagu
```

Restart Claude Code (skill schemas are read at session start). The skill is now invocable by description match — no slash command needed.

## Skills in this folder

- **`bagu/`** — interview-prep ("八股文") Q&A generator. Triggered by phrases like `整理八股 RAG` or pasted question lists. Produces senior-engineer-voice cards via the knosi MCP `create_learning_card` tool. Cards land in the learning module (`/learn/<topicId>`), one per question.
