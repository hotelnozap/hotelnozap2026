# Plano de Implementação: Checkout Automático / Pagamento Online dos Planos

**Objetivo:** Integrar o pagamento imediato via PIX e Cartão (Mercado Pago) na etapa final do cadastro (`/lp/lpnovohotel` e `/assinar`), liberando a conta do hotel automaticamente assim que o pagamento for aprovado.

---

## 1. Arquitetura e Fluxo

```
[Formulário de Cadastro]
        │ (Etapas 1 a 5 preenchidas)
        ▼
[Criação do Hotel e Usuário]
        │ Hotel criado (status: 'prospecto') + Usuário registrado
        ▼
[Avaliação do Plano Selecionado]
   ├── Se Plano Grátis:
   │      └── Ativação Imediata (status: 'ativo') ➔ Tela de Boas-Vindas
   │
   └── Se Plano Comercial Pago:
          └── Etapa 6: Checkout Automático de Planos
                 ├── Aba 1: PIX Instantâneo
                 │      ├── Criação via Mercado Pago API (Master Access Token)
                 │      ├── Fallback padrão EMV BR Code (Chave Pix Master)
                 │      ├── QR Code visual + Botão Copia e Cola
                 │      ├── Polling de status (a cada 5s)
                 │      ├── Botão manual "Verificar Pagamento Agora"
                 │      └── Modo Simulação (para testes locais/sandbox)
                 │
                 └── Aba 2: Cartão de Crédito
                        ├── Link direto/Checkout Pro Mercado Pago
                        └── Suporte a parcelamento em até 12x
```

---

## 2. Liberação Automática da Conta

Ao detectar status `approved` / pagamento confirmado:
1. **Supabase `hoteis`:** Atualiza o status do hotel para `'ativo'` (`hoteisService.updateHotel(hotelId, { status: 'ativo' })`).
2. **SaaS Créditos:** Registra a validade dos créditos do plano (dias base + dias bônus) via `creditosService.saveCreditoHotel`.
3. **Auditoria:** Salva o evento em `systemLogsService`.
4. **Interface:** Transição comemorativa imediata ("🎉 Pagamento Aprovado e Conta Liberada com Sucesso!").
5. **Acesso Direto:** Botão para entrar direto no Painel Administrativo do Hotel (`/paineladmin` ou `dashboard`).

---

## 3. Arquivos Envolvidos

1. `src/services/mercadopagoService.ts`
   - Função utilitária de geração de payload BR Code EMV (PIX estático e dinâmico).
   - Integração com Mercado Pago REST API para geração de PIX dinâmico (`/v1/payments`).
   - Consulta de status de pagamento (`consultarPagamentoMaster`).
   - Função centralizada de ativação de hotel pós-pagamento (`ativarHotelAposPagamento`).

2. `src/components/CheckoutPlanoStep.tsx` (Novo Componente)
   - Componente reutilizável para o Step 6 em `/lp/lpnovohotel` e `/assinar`.
   - Gerencia estado de PIX (QR Code + Copia e Cola), Cartão, polling de status e celebração de liberação de conta.

3. `src/components/LpNovoHotel.tsx`
   - Integra o `CheckoutPlanoStep` na Etapa 6.
   - Passa `createdHotelId`, dados do responsável e plano selecionado.

4. `src/components/LpAssinar.tsx`
   - Integra o `CheckoutPlanoStep` na Etapa 6 mantendo a referência do parceiro indicador (`refCode`).

---

## 4. Critérios de Validação

- [ ] `npm run build` passa com 0 erros.
- [ ] O PIX Copia e Cola gerado é válido e copiável em 1 clique.
- [ ] Planos gratuitos ativam a conta imediatamente sem passar pela cobrança.
- [ ] Ao aprovar o pagamento, o status do hotel no Supabase muda de `'prospecto'` para `'ativo'`.
- [ ] Validade de créditos e dias bônus é creditada no hotel.
- [ ] Redirecionamento leva o cliente autenticado diretamente ao painel.
