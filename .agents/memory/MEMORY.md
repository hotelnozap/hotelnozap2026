# Memory Index

## Project
- [project] Commitar e subir sempre diretamente na branch master (Produção) para deploy oficial imediato na Vercel → project-conventions.md
- [project] AG Kit only supports Gemini CLI and Google Antigravity (not other AI coding tools) → project-conventions.md
- [project] Component metadata uses SemVer while toolkit releases use CalVer → tech-decisions.md
- [tech] Requisições HTTP para a Evolution API no n8n exigem obrigatoriamente headers Content-Type: application/json e apikey (Docs: https://docs.evolutionfoundation.com.br/evolution-api) → tech-decisions.md
- [tech] Chat Model oficial no n8n é OpenAI (gpt-4.1-mini, credencial 'OpenAI account') com temperature 0.4 → tech-decisions.md
- [tech] O n8n do portal portaln8n.hotelnozap.com.br é atualizado diretamente via Public API (PUT /api/v1/workflows/EdzWFVAC3AAshCiL) → tech-decisions.md

## Feedback
- [feedback] Só fazer deploy/push quando expressamente solicitado/autorizado pelo usuário → feedback-history.md

## User Preferences
- [preference] Nome do usuário: Everaldo → user-preferences.md
- [preference] Disponibilizar no chat apenas scripts SQL prontos para colar no Supabase; código de aplicação já é aplicado diretamente nos arquivos → user-preferences.md
- [preference] O usuário chama o assistente de Jarvis (IA de alta precisão e cortesia) → user-preferences.md
- [preference] Segurança de chaves: NUNCA expor nem imprimir chaves de API nas mensagens do chat → user-preferences.md
