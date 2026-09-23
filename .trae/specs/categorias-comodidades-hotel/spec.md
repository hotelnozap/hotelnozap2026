# Especificação — Categorias de Comodidades do Hotel + Render em Colunas no DetalhesQuarto

**Data:** 15/09/2026
**Autor:** Spec Mode — Hotel No Zap
**Nível do hotel:** Nível HOTEL (todos os quartos do estabelecimento herdam estas comodidades)
**Restrição de design:** Títulos das categorias no DetalhesQuarto DEVEM seguir exatamente o padrão de "Itens Inclusos no Quarto" — ícone Material + texto preto bold grande (não verde uppercase).

---

## 1. PROBLEMA, USUÁRIOS, GOALS E NÃO-GOALS

### 1.1 Problema
Atualmente o sistema tem dois níveis de itens do quarto:
1. **Itens Inclusos no Quarto** (nível individual por quarto via `items` JSONB + chips verde esmeralda)
2. **Destaques da Acomodação** (por quarto via tabela M:N `destaques_quarto`)

Falta um **3º nível**: as **Comodidades Padrão do Hotel**, agrupadas em CATEGORIAS em colunas, que valem para TODOS os quartos do estabelecimento e aparecem num grid 2x2 na página de Detalhes do Quarto, exatamente como no layout de referência (Banho & Bem-Estar, Tecnologia & Entretenimento, Gastronomia & Bar, Serviços Exclusivos).

O Admin Master / Gerente do hotel atualmente não tem tela no `FormHotel.tsx` (Cadastro/Edição de Hotel) para cadastrar estas categorias e seus itens. Sem esta estrutura, a página Detalhes do Quarto fica incompleta na seção "Comodidades & Conforto Inclusos".

### 1.2 Usuários Diretos
| Ator | Papel | O que faz |
|---|---|---|
| Super Admin Master | Cadastra novo hotel em `CadastroHoteis` → `FormHotel.tsx` | Preenche Categorias e seus Itens durante onboarding |
| Gerente do Hotel | Edita perfil do hotel | Altera/adiciona categorias e itens de comodidades |
| Hóspede Final | Página pública DetalhesQuarto | Visualiza grid 2x2 de comodidades agrupadas por categoria |

### 1.3 Goals
1. **G1** Fornecer tela CRUD (dentro do `FormHotel.tsx`) para o Admin cadastrar **Categorias de Comodidades do Hotel**, cada uma contendo: nome da categoria, ícone Material/classe CSS, cor do ícone, ordenação, e **lista de Itens** (strings curtas com comodidades).
2. **G2** Persistir estes dados no Supabase ligados por `hotel_id` — e carregá-los automaticamente no Detalhes de QUALQUER quarto daquele hotel.
3. **G3** Renderizar no `DetalhesQuarto.tsx` a seção "Comodidades & Conforto Inclusos" em grid 2 colunas × N linhas, fiel ao layout de referência:
   - Cabeçalho da seção: igual padrão de "Itens Inclusos no Quarto"
   - Cada card de categoria: ícone verde esmeralda + título categoria bold verde + lista vertical itens com ícone `check_circle` verde
4. **G4** Seed padrão: ao criar um NOVO hotel, sugerir automaticamente 4 categorias iniciais (Banho & Bem-Estar Privativo / Tecnologia & Entretenimento / Gastronomia & Bar Privativo / Serviços Exclusivos no WhatsApp) — com botão de remover individualmente se o hotel não possuir.
5. **G5** 100% backward compat: hotéis SEM categorias cadastradas simplesmente OCULTAM a seção (não quebram layout).

### 1.4 Não-Goals (Fora de Escopo)
- ❌ Não implementar CRUD separado em tela cheia para categorias (fica embedado dentro de `FormHotel.tsx` como seções dinâmicas).
- ❌ Não associar categorias a quartos individuais (não usar M:N). É nível HOTEL fixo.
- ❌ Não alterar layout de "Itens Inclusos no Quarto" (chips) nem "Destaques da Acomodação" (cards roxos) — ambos permanecem.
- ❌ Não trocar padrão de ícones (Material Symbols continua default; classe CSS opcional, igual ao DestaquesQuarto).

---

## 2. REQUISITOS FUNCIONAIS (RF)

| # | Requisito | Prio |
|---|---|---|
| RF01 | Migration SQL criar 2 tabelas novas: `hotel_comodidade_categorias` (id PK, hotel_id FK UUID, nome, icone, icone_classe, cor_icone, ordenacao, status) e `hotel_comodidade_itens` (id PK, categoria_id FK UUID, texto, ordenacao) | Obrigatorio |
| RF02 | Interface `FormHotel.tsx` adicionar 1ª seção "Comodidades Padrão do Hotel" contendo: 4 categorias default (seed) + botão "+ Adicionar Categoria" + cada categoria com "+ Adicionar Item" + "Remover Item" + "Remover Categoria" | Obrigatorio |
| RF03 | Cada categoria (no form) tem inputs editáveis inline: Nome, Ícone (Material autocomplete / ou classe CSS livre), Cor (color picker padrão verde esmeralda default), Ordenação numérica | Obrigatorio |
| RF04 | Service layer (`hoteisService` ou novo `comodidadesService`) implementar: `getCategoriasByHotelId`, `upsertCategoriasDoHotel` (transação idempotente: deleta antigas e insere novas no submit) | Obrigatorio |
| RF05 | Submit do FormHotel (create/update) disparar persistência das categorias + itens via `upsertCategoriasDoHotel` dentro da mesma transação visual; toast de sucesso quando concluir | Obrigatorio |
| RF06 | Mapper de hotel em `DetalhesQuarto.tsx` + `PaginaHotel.tsx` carregar `hotelComodidades` via service e incluir no objeto `currentHotel` retornado | Obrigatorio |
| RF07 | `DetalhesQuarto.tsx` renderizar SEÇÃO COMPLETA (apenas se `hotelComodidades.length > 0`) abaixo de Destaques Principais e acima de Itens Inclusos: `TÍTULO SEÇÃO` (padrão Itens Inclusos) + `grid grid-cols-1 md:grid-cols-2 gap-6` de cards categoria | Obrigatorio |
| RF08 | CARD CATEGORIA no DetalhesQuarto (padrão referência): `bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8` + Header categoria: ícone 24px verde (#006c49) + span título `text-[#006c49] font-bold text-xl tracking-tight` + lista `<ul>` itens com checkmark `check_circle` | Obrigatorio |
| RF09 | Ordem das categorias e itens: seguir campo `ordenacao` ASC. Categorias com mesma ordenação fallback por `criado_em`. | Obrigatorio |
| RF10 | Editar hotel existente: abrir `FormHotel.tsx` → carregar categorias + itens já gravadas no banco, permitir edição inline. | Obrigatorio |
| RF11 | Suporte a ícone-classe CSS (campo `icone_classe`) igual DestaquesQuarto: se preenchido usar `<i className={icone_classe} style={{color}}>`; fallback para `<span className="material-symbols-outlined">`. | Alta |
| RF12 | Validação form: categoria SEM NOME não pode ser salva (disabled save + borda vermelha); item SEM TEXTO idem. | Alta |

## 3. REQUISITOS NÃO-FUNCIONAIS (RNF)

| # | Requisito |
|---|---|
| RNF01 | **Performance:** carregamento das categorias junto ao fetch do hotel (1 JOIN extra ou segunda query paralela Promise.all) — tempo extra < 100ms. |
| RNF02 | **TypeScript strict:** 0 erros em `npx tsc --noEmit`. Todas interfaces novas com tipagem forte (não `any`). |
| RNF03 | **Row Level Security:** tabelas novas com `enable row level security` + policies `using (hotel_id in (select id from hoteis where ...))` ou público leitura e hotel_admin escrita. |
| RNF04 | **Design tokens 100% alinhados a [DESIGN.md](file:///c:/HotelNoZap2/DESIGN.md):** cores `#003400` / `#006c49` (sec), `rounded-3xl` cards, espaçamento 24px gutter, fonte Inter, bordas #c6c6cd. |
| RNF05 | **Mobile friendly:** grid colunas → em telas < 768px fica 1 coluna vertical (igual a seção Itens Inclusos). |
| RNF06 | **Idempotência migration:** usar `DO $$ BEGIN ... END $$; CREATE TABLE IF NOT EXISTS`; não quebrar em re-execuções. |

## 4. RESTRIÇÕES, DEPENDÊNCIAS, PREMISSAS

### 4.1 Restrições
- **RESTRIÇÃO DESIGN.md HARD:** Categorias permanecem DENTRO do FormHotel.tsx (é parte do cadastro do hotel). NÃO criar rota separada `CadastroCategoriasHotel` pois é configuração do hotel.
- **RESTRIÇÃO FK UUID:** `hotel_comodidade_categorias.hotel_id` = UUID (mesmo padrão de `quartos_destaques.quarto_id`).
- **RESTRIÇÃO TÍTULO USUÁRIO:** Títulos das categorias no DetalhesQuarto NÃO são uppercase verde (diferente de "DESTAQUES PRINCIPAIS"). Devem ser PRETO bold (padrão "Itens Inclusos no Quarto").

### 4.2 Dependências
- `src/services/supabaseService.ts`: service existente, adicionar métodos.
- Tabela `hoteis.id` já existe como UUID string.
- Migration engine pasta `supabase/migrations/` já usada em 4 ocasiões anteriores.

### 4.3 Premissas
- Um hotel tem em média 4 categorias × 4-6 itens cada (≈20 itens). Nenhuma paginação necessária.
- Usuário Super Admin Master = dono do projeto Everaldo. Seed default de 4 categorias será um botão "Carregar categorias padrão" no form.

### 4.4 Questões em Aberto (respondidas: N — nenhuma. Todas já resolvidas por análise)
- Nenhuma. Especificação fechada.

---

## 5. CRITÉRIOS DE ACEITE (AC) — RULE or RUBRIC

### Rule (pass/fail binário)
| ID | Regra de Aceite | Como verificar |
|---|---|---|
| AC-R01 | **Migration SQL idempotente roda 2x sem erro.** Executar migration; executar de novo → exit 0 em ambas. | Rodar script no SQL Editor Supabase 2x. |
| AC-R02 | **FormHotel.tsx create:** ao cadastrar hotel novo, seção "Comodidades Padrão" aparece; 4 categorias seed são renderizadas. | Abrir FormHotel (vazio), chegar até a seção. |
| AC-R03 | **FormHotel.tsx submit + persist:** adicionar 2 itens em "Tecnologia" → salvar → recarregar F5 editar mesmo hotel → itens continuam lá. | Editar e conferir state persistido. |
| AC-R04 | **DetalhesQuarto render:** abrir página detalhes do quarto 100 hotel Morada da Lua → seção "Comodidades & Conforto Inclusos" EXISTE com grid 2 colunas (desktop) ou 1 coluna (mobile). | Navegar página Detalhes, inspecionar DOM. |
| AC-R05 | **Categorias vazias OCULTAM seção:** Hotel sem categorias gravadas → NÃO renderiza o header "Comodidades & Conforto Inclusos". Zero espaços em branco. | Testar com hotel novo sem seed. |
| AC-R06 | **Ordenação obedecida:** categoria A (ordenacao=1) aparece ANTES de B (ordenacao=2) em TANTO form quanto Detalhes. | Editar ordenacao para 2/1 swap; conferir ordem. |
| AC-R07 | **tsc sem erros:** `npx tsc --noEmit` no projeto → exit 0. | Terminal. |
| AC-R08 | **Fallback ícone classe CSS:** categoria com `icone_classe = 'fi fi-rr-sparkles'` → renderiza `<i>` com cor inline. Sem classe → renderiza `<span>` material. | Editar categoria, colocar classe UIcons, salvar, abrir Detalhes. |
| AC-R09 | **RLS habilitado:** `SELECT row_security_active('public.hotel_comodidade_categorias')` retorna TRUE no Supabase. | SQL Editor. |
| AC-R10 | **Validação form:** categoria nome vazio → botão "Salvar Hotel" bloqueado + toast/vermelho "Preencha o nome da categoria X". | Tentar submit com nome vazio. |

### Rubric (escore qualitativo 0-2)
| ID | Dimensão | 0 | 1 | 2 | Limiar Pass |
|---|---|---|---|---|---|
| AC-U01 | **Fidelidade visual ao screenshot referência (2x2 grid cards)** | Diverge muito: cores erradas, bordas quadradas, listas sem checkmark. | Razoável: estrutura correta, pequenos desvios de padding/cor. | Fiel pixel-perfect: cantos 24px, ícone verde #006c49, título categoria verde bold, checkmark verde 16px. | ≥ 1.5 |
| AC-U02 | **UX do form (FormHotel categorias inline)** | Ruim: difícil adicionar/remover itens, sem feedback visual. | Médio: funcional mas confuso em alguns fluxos. | Excelente: inline edits com botões +/- intuitivos, estado hover ok, drag ordenação opcional. | ≥ 1.0 |
| AC-U03 | **Robustez contra dados corruptos (ex: categoria sem itens)** | Quebra a página (error boundary crash). | Mostra card vazio (leve ruído visual). | Oculta categoria automaticamente se 0 itens + console.warn. | ≥ 1.5 |
