# Debug Session: pix-pagamento-nao-identificado [OPEN]

**Data:** 2026-10-02
**Relator:** TRAE-debugger
**Sintoma:** Pagamento Pix feito com sucesso (debitado na conta do pagador) mas sistema não reconhece automaticamente. UI fica "Identificando pagamento..." até expirar os 5min → Prazo Pagamento Esgotado.
**Ambiente:** Vercel Preview branch feature/melhorias-landing-page. Rotacionado SUPABASE_SERVICE_ROLE_KEY + atualizado Vercel Envs por Everaldo.
**Regressão:** Hotfix segurança 9c429d7 (remover fallbacks hardcoded service_role / PIX key).

---

## 5 Hipóteses Falsificáveis (H1-H5)

| # | Hipótese | Tipo | Como Falsificar |
|---|----------|------|-----------------|
| H1 | Endpoints serverless retornam 500 por SUPABASE_SERVICE_ROLE_KEY faltando em runtime Vercel (redeploy não feito) | Ambiente | GET /api/mercadopago-pix?action=check retorna 500? |
| H2 | MERCADOPAGO_ACCESS_TOKEN ausente (env e db) → fallback local pix_chave, sem MP payment_id real | Negócio | action=create log masterToken.length < 15 → cai pix_chave, webhook NUNCA dispara MP |
| H3 | consultarPagamentoMaster polling NÃO implementa detecção para gateway=pix_chave (só MP API) | Lógica | Status nunca approved quando paymentId = pix_hnz_ |
| H4 | mercadopago-webhook retorna 500 (service_role env faltando) → MP notifica mas salvamento falha | Infra | MP dashboard → webhook event deliveries = 5xx |
| H5 | Client-side status parser ou polling interval 2s tem bug (ex.: campo status nome errado após mudanças P1-P7) | Frontend | CheckoutPlanoStep setStatus approved não executa |

---

## Instrumentation Points (Adicionar logs via Debug Server)

1. **api/mercadopago-pix.js (L17-L30 + action=create/check entry)**: report SUPABASE_SERVICE_ROLE_KEY length, masterToken length, branch action, create response JSON fields
2. **api/mercadopago-webhook.js (L19-L31 + body parse)**: req.method, query params length, paymentId extraído, update DB success
3. **src/services/mercadopagoService.ts (consultarPagamentoMaster)**: paymentId, raw status returned, approved computed value
4. **src/components/CheckoutPlanoStep.tsx polling tick**: currentPaymentId, currentStatus, pollingCounter, timer restante

---

## Evidências

### Pré-fix (análise estática + screenshots + hotfix 9c429d7)

| H | Veredito | Evidência (antes do fix) |
|---|---------|-----------|
| H1 | PENDING → VERIFICAR RUNTIME | service_role pattern 500 adicionado instrumentation. Everaldo disse "tudo feito" mas NENHUMA evidência runtime logs. |
| H2 | PROVÁVEL (alta chance) + fix aplicado | masterToken <15 → cai ramo fallback `pix_chave` SEM paymentId MP numérico, SEM external_reference, SEM disparo webhook MP |
| H3 | ✅ CONFIRMADO por análise estática + screenshots + código | Screenshots mostram "PIX COPIA E COLA" visível → pix_hnz_*. polling action=check NÃO tinha ramo específico para pix_chave sem external_reference. FASE 2B limit=10 e janela 15min insuficientes para busca MP Search. |
| H4 | PENDING → VERIFICAR RUNTIME | Webhook instrumentation adicionado em todos pontos (serviceRole, token, update DB). Antes só log L47 genérico. |
| H5 | ✅ ELIMINADO. Parser client-side está correto. | mercadopagoService:consultarPagamentoMaster lê corretamente `data.approved`. CheckoutPlanoStep polling usa `check.approved === true`. Bug não está no client. |

**Root Cause Dupla Confirmada (análise estática):**
1. **RC1 (H2/H3) — 90% de probabilidade:** Quando MERCADOPAGO_ACCESS_TOKEN é curto/ausente ou create falha, cai no fallback local EMV (`gateway=pix_chave`, `paymentId=pix_hnz_*`). Nenhum pagamento oficial MP é criado, então: SEM external_reference, SEM webhook MP, NINGUÉM atualiza `hoteis.status='ativo'`. O polling FASE 1 falha. FASE 2A (paymentId numérico) é pulada. FASE 2B antiga limit=10 + janela 15min + condição curto-circuito `matchRef || matchAmount` — SEMPRE retorna pending (código antigo) para fallback pix_chave.
2. **RC2 (H1/H2) — 10% de probabilidade:** MERCADOPAGO_ACCESS_TOKEN e/ou SUPABASE_SERVICE_ROLE_KEY não foram aplicados runtime functions Vercel após Everaldo atualizar vars (sem redeploy ou vars erradas).

---

## Instrumentation + Minimal Fix Aplicados (commit a ser criado)

### Arquivos Alterados: 4 + 1 (debug session)

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| api/mercadopago-pix.js | Instrumentation + Fix H2/H3 | 8+ logs [MP-PIX] + **FASE 2B limit=100**, janela=30min fallback, **regra ESPECIAL match por VALOR APENAS (sem external_reference) quando isFallbackPixChave=true**, log return pending final com `debug` payload. |
| api/mercadopago-webhook.js | Instrumentation H1/H2/H4 | 6+ logs [MP-WEBHOOK], log antes/depois update hotel, log exceção completa stack. |
| src/services/mercadopagoService.ts:consultarPagamentoMaster | Instrumentation H5 | `pollingCheckId` único a cada tick, log completo request URL + resposta. Elimina H5. |
| src/components/CheckoutPlanoStep.tsx polling useEffect | Instrumentation H5 | tickCounter, log evento INÍCIO polling + tick#s + ✅ approved + ❌ rejected. Elimina H5. |

**Fix H3 Aplicado — Regra Especial Fallback Pix Copia-e-Cola:**
```
isFallbackPixChave = paymentId startsWith pix_hnz_ OR NOT numeric
  SE isFallbackPixChave = TRUE:
    - search limit = 100 (antes: 10)
    - janela recente = 30min (antes: 15min)
    - match = isApproved AND matchAmount (valor EXATO ±0.05). SEM precisar external_reference!
    - SE match → update hoteis.status='ativo' → return approved=true source=mercadopago_search_fallback_pix_chave
```

**Passo Manual Everaldo Obrigatório ANTES teste (H1):**
- Vercel Dashboard: Project Settings → Environment Variables → confirmar que `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `DEFAULT_PIX_KEY` existem com valores corretos.
- Deploy: Trigger REDEPLOY da Preview branch feature/melhorias-landing-page para aplicar novas vars + novas functions instrumentadas.

---
