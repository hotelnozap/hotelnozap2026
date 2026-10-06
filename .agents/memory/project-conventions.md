---
type: project
created: 2026-05-25
updated: 2026-09-23
---

# Project Conventions

## Git Workflow & Deploy
- Commitar e subir sempre diretamente na branch `master` (Produção), para que a Vercel gere deploy oficial em **Production** e atualize imediatamente os domínios oficiais (`hotelnozap.com.br` e `app.hotelnozap.com.br`).
- Não usar branches de feature/preview para deploys, a menos que o usuário solicite explicitamente uma branch separada.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.
