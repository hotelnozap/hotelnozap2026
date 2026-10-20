# Memory Index

## Project
- [project] Commitar e subir sempre diretamente na branch master (Produção) para deploy oficial imediato na Vercel → project-conventions.md
- [project] AG Kit only supports Gemini CLI and Google Antigravity (not other AI coding tools) → project-conventions.md
- [project] Component metadata uses SemVer while toolkit releases use CalVer → tech-decisions.md
- [tech] Requisições HTTP para a Evolution API no n8n exigem obrigatoriamente headers Content-Type: application/json e apikey (Docs: https://docs.evolutionfoundation.com.br/evolution-api) → tech-decisions.md
- [tech] Chat Model oficial no n8n é OpenAI (gpt-4.1-mini, credencial 'OpenAI account') com temperature 0.4 → tech-decisions.md
- [tech] O n8n do portal portaln8n.hotelnozap.com.br é atualizado diretamente via Public API (PUT /api/v1/workflows/EdzWFVAC3AAshCiL) → tech-decisions.md
- [tech] Chave da Public API do n8n gravada no .env (N8N_API_KEY) para atualização direta de workflows (Super Agente: nWQ8ZJpKeTrYl5Ry) → tech-decisions.md
- [tech] No Super Agente Vendedor (nWQ8ZJpKeTrYl5Ry), follow-up automático cego foi removido para evitar ban/spam; o agente só responde quando o cliente fala, e gera apenas Alerta VIP para o Everaldo (5565996173004) → tech-decisions.md
- [tech] Intervenção humana no Atendente Virtual e Super Agente: mensagens enviadas pelo Everaldo (fromMe: true) ativam pausa de 2 minutos no Redis (pausa:atendimento e pausa:vendedor com expire: true, TTL 120s); o comando #ia reativa na hora → tech-decisions.md
- [feature] Hotéis Demo para Parceiros: Ocultos do showroom público via CatalogoHoteis (is_demo: true ou tag [DEMO_PARCEIRO]), botão 'Cadastrar Meu Hotel' no cabeçalho do parceiro que desaparece após cadastro dando lugar a 'Entrar no Meu Hotel Demo' + link direto → tech-decisions.md

## Feedback
- [feedback] Só fazer deploy/push quando expressamente solicitado/autorizado pelo usuário → feedback-history.md

## User Preferences
- [preference] Nome do usuário: Everaldo → user-preferences.md
- [preference] Disponibilizar no chat apenas scripts SQL prontos para colar no Supabase; código de aplicação já é aplicado diretamente nos arquivos → user-preferences.md
- [preference] O usuário chama o assistente de Jarvis (IA de alta precisão e cortesia) → user-preferences.md
- [preference] Segurança de chaves: NUNCA expor nem imprimir chaves de API nas mensagens do chat → user-preferences.md
