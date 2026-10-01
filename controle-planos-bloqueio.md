# Plano: Controle de Planos dos Hotéis e Bloqueio Inteligente de Acesso Expirado

**Objetivo:** 
1. Criar na área administrativa master o menu e página para controle completo de todos os hotéis cadastrados nos planos.
2. Permitir ao administrador master incluir dias de acesso/cortesia ao hotel com plano expirado (ou em alerta) para que ele possa se programar para a próxima compra.
3. Bloquear o acesso do hotel ao sistema quando os créditos e dias de bônus expirarem, direcionando para uma tela explicativa e intuitiva para aquisição imediata de novos créditos com o Checkout Automático integrado.

---

## 1. Arquitetura da Solução

### 1.1 Painel Master: Controle de Planos & Créditos
- **Menu Lateral Admin:** Adicionar `{ id: 'creditos-saas', label: 'Controle de Planos & Créditos', icon: 'card_membership' }` na barra de navegação master.
- **Página [`GestaoCreditosSaaS.tsx`](file:///c:/HotelNoZap2/src/components/GestaoCreditosSaaS.tsx):**
  - Exibição de todos os hotéis com:
    - Nome, CNPJ, Cidade/UF, Responsável
    - **Plano Atual** (Badges visuais para Grátis, 1 Crédito, 2 Créditos, etc.)
    - Status de Crédito: 🟢 Ativo / 🟡 Alerta / 🔴 Expirado
    - Validade formatada e contagem regressiva de dias
    - Créditos ativos
  - **Filtros Avançados:** Por status (Ativos, Alerta, Expirados), por Plano e busca por texto.
  - **Modal Exclusivo: "Incluir Dias ao Hotel (Prorrogação de Prazo)":**
    - Atalhos rápidos: **+7 Dias**, **+15 Dias**, **+30 Dias** e campo numérico livre.
    - Campo de motivo / anotação (ex: "Prorrogação comercial solicitada pelo cliente").
    - Ao salvar:
      - Atualiza a validade do hotel no `creditosService`.
      - Se o hotel estava com status `'inativo'` ou `'expirado'`, reativa para `'ativo'` no Supabase (`hoteisService.updateHotel`).
      - Emite evento em tempo real `hotel_creditos_changed`.

### 1.2 Bloqueio Inteligente de Hotel Expirado
- **Componente [`TelaPlanoExpirado.tsx`](file:///c:/HotelNoZap2/src/components/TelaPlanoExpirado.tsx):**
  - Renderizado quando `isHotelUser` está logado e `creditosInfo.status === 'expirado'`.
  - Impede o uso das abas operacionais (quartos, reservas, financeiro, cardápio, etc.).
  - Exibe:
    - Alerta claro: "Seus créditos e dias de bônus expiraram".
    - Data exata do encerramento e histórico do plano anterior.
    - Seletor com os cards dos planos comerciais para renovação/recarga imediata.
    - Ao selecionar um plano, abre o Checkout Automático (PIX instantâneo / Cartão) com liberação automática da conta.
    - Botão para contato direto com o suporte/financeiro via WhatsApp solicitando inclusão de dias.
    - Se o admin master incluir dias no painel, a tela do hotel detecta a mudança e desbloqueia o painel na hora sem necessidade de novo login.

---

## 2. Etapas de Execução

1. **Aprimoramento do Serviço `creditosService.ts`:**
   - Adicionar método `adicionarDiasAoHotel(hotelId, dias, motivo)` com atualização de status no Supabase e auditoria no `systemLogsService`.
2. **Criação do Componente `TelaPlanoExpirado.tsx`:**
   - Tela de bloqueio responsiva com vitrine de planos para recarga e checkout online imediato.
3. **Aprimoramento de `GestaoCreditosSaaS.tsx`:**
   - Visualização consolidada de planos e botão/modal para incluir dias a hotéis expirados ou ativos.
4. **Integração no `App.tsx`:**
   - Adicionar menu no menu lateral do Super Admin Master.
   - Adicionar guarda de verificação de crédito no `App.tsx` para bloquear rotas operacionais caso o hotel esteja expirado.
5. **Validação:**
   - Executar `npm run build` garantindo 0 erros.
