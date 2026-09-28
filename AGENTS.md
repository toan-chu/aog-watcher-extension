# AOG Watcher agent router

AOG Watcher is a Chrome/Edge Manifest V3 extension that watches WhatsApp Web and Outlook Web during overnight AOG shifts.

Before doing any work:

1. Read `handoff/RULES.md` and `handoff/STATE.md`.
2. Open exactly one ticket assigned to your identity in `handoff/`.
3. Read `handoff/MAP.md` only when the work touches architecture.
4. Follow `Nối tiếp` to at most one prior ticket when `Kế thừa` is insufficient.

Do not recreate `handoff/todo.md`, `handoff/audit.md`, `log/history.md`, `log/failure.md`, or `log/sessions/`.
Runtime evidence on Windows belongs to Codex; static review belongs to Claude.
Do not change product behavior without a ticket containing a Chairman-written acceptance scenario.
Use `npm run check` as the repository verification command.
