---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- Em requisições HTTP para a Evolution API (via n8n ou cliente HTTP), sempre incluir obrigatoriamente os headers: Content-Type: application/json e apikey: [chave da evolution].
- Documentação oficial da Evolution API: https://docs.evolutionfoundation.com.br/evolution-api
- Chat Model oficial nos fluxos do n8n: OpenAI Chat Model (@n8n/n8n-nodes-langchain.lmChatOpenAi) com modelo `gpt-4.1-mini`, temperatura 0.4 e credencial 'OpenAI account' (id: qolmiCqcrID0XaTc). O Gemini foi descontinuado devido a instabilidades frequentes.
- O n8n do portal portaln8n.hotelnozap.com.br é atualizado diretamente via Public API (PUT /api/v1/workflows/{id}). O workflow oficial do concierge é EdzWFVAC3AAshCiL.
- Reconhecimento de Voz no n8n: Implementado com nó Switch ('Switch: Texto ou Voz?') roteando tipo === 'texto' (Saída 0) para o Redis Buffer direto, e tipo === 'voz' (Saída 1) para: 'Evolution: Baixar Áudio' (POST /chat/getBase64FromMediaMessage/{instance}) -> 'Preparar Binário do Áudio' -> 'OpenAI: Transcrever Áudio (Whisper)' (credencial 'OpenAI account') -> 'Definir Mensagem Transcrita' -> 'Redis: Ler Buffer Atual' convergindo para o buffer unificado do Concierge.

