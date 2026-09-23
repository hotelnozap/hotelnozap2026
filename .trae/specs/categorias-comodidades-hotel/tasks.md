# Tasks — Categorias de Comodidades Nível Hotel (Implementação)

**Feature:** CRUD embedado FormHotel + Render 2 colunas DetalhesQuarto
**Padrão títulos:** Ícone verde Material + texto preto bold (igual "Itens Inclusos no Quarto")
**Ordem:** T1 (banco) → T2 (service) → T3 (form embed seed 4) → T4 (submit upsert) → T5 (mappers) → T6 (render grid) → T7 (tsc validação)

---

## T1 — Migration + RLS (idempotente DO blocks)
- **Path:** `supabase/migrations/20260119000000_add_hotel_comodidades.sql`
- **Tables:**
  - `hotel_comodidade_categorias`: id UUID PK, hotel_id UUID FK hoteis.id, nome TEXT NOT NULL, icone TEXT, icone_classe TEXT, cor_icone TEXT DEFAULT '#006c49', ordenacao INT DEFAULT 1, status TEXT DEFAULT 'ativo', criado_em timestamptz
  - `hotel_comodidade_itens`: id UUID PK, categoria_id UUID FK cascade delete, texto TEXT NOT NULL, ordenacao INT DEFAULT 1, criado_em
- **RLS:** ambas tabelas → ALTER enable row level security + policy public SELECT + policy owner INSERT/UPDATE/DELETE
- **Idempotência:** DO $$ BEGIN ... EXCEPTION WHEN duplicate_table / duplicate_object THEN NULL END $$;
- **Dependências:** Nenhuma.

## T2 — Tipos TS + Service Layer `comodidadesService`
- **Path:** `src/services/supabaseService.ts` (final do arquivo, export no fim)
- **Interfaces (export):**
  - `ComodidadeItemHotel`: id?, categoriaId?, texto: string, order: number
  - `ComodidadeCategoria`: id?, hotelId?, nome: string, icon: string, iconClass?: string, iconColor: string, order: number, status: string, itens: ComodidadeItemHotel[]
- **Métodos service:**
  - `async getCategoriasByHotelId(hotelId: string): Promise<ComodidadeCategoria[]>` — JOIN ambas tabelas, ordenacao ASC.
  - `async upsertCategoriasDoHotel(hotelId: string, categorias: ComodidadeCategoria[]): Promise<boolean>` — transaction pattern: deleta categorias antigas do hotel + insere novas + itens (snake_case banco).
- **Dependências:** T1 rodada (em types/database.ts refletida, mas TS strict pode ignorar por hora).
- **Mapping snake ↔ camel:** `icone_classe → iconClass`, `cor_icone → iconColor`, `ordenacao → order`, `categoria_id → categoriaId`, `hotel_id → hotelId`.

## T3 — FormHotel Embed Section + Seed 4 Categorias Padrão
- **Path:** `src/components/FormHotel.tsx`
- **Pontos de alteração:**
  (a) Import `comodidadesService` + `ComodidadeCategoria` (T2)
  (b) Novo useState: `comodidadesCategorias` (array ComodidadeCategoria[])
  (c) Helper `SEED_PADRAO_COMODIDADES()` → retorna 4 categorias com 4 itens cada (Banho & Bem-Estar / Tecnologia & Entretenimento / Gastronomia & Bar / Serviços WhatsApp).
  (d) No `useEffect loadHotelData()` (L403):
      - Modo create (!hotelToEdit && !isProfileView) → inicializa com SEED_PADRAO.
      - Modo edit (hotelToEdit || isProfileView) → `getCategoriasByHotelId(hotelId)` → setState.
  (e) Handlers inline:
      - `handleAddCategoria()` → push categoria vazia.
      - `handleRemoveCategoria(idx)` → splice.
      - `handleAddItem(idxCategoria)` → push item vazio.
      - `handleRemoveItem(idxCat, idxItem)` → splice.
      - `handleChangeCampoCategoria(idxCat, campo, valor)` → update state.
      - `handleChangeItem(idxCat, idxItem, valor)` → update state.
  (f) Nova seção JSX APÓS "Redes Sociais" (L96-L100), ACIMA de "Sistema de Cobrança". Estrutura:
      - Header seção: padrão Itens Inclusos (ícone verde + preto bold).
      - Map categorias → card inline: inputs Nome / Ícone Material / Classe CSS Ícone / Cor / Ordenação / Botão Remover Categoria.
      - Map itens dentro da categoria → input texto + botão remover item.
      - Botão "+ Adicionar Item" bottom card.
      - Botão "+ Adicionar Categoria" / "Restaurar Padrão 4 Categorias" seção footer.
- **Dependências:** T2 (service + tipos).
- **Restrição UI:** NÃO é modal. É seção inline dinâmica, tudo dentro do <form>.

## T4 — FormHotel Submit Integrado (persistência)
- **Path:** `src/components/FormHotel.tsx` função `handleSubmit` (L551)
- **Validação ANTES do submit:** todas categorias devem ter `nome.trim()` não-vazio; todos itens `texto.trim()` não-vazio. Se inválido, showToast + return (bloqueia salvar).
- **Persistência:**
  - Modo edição / profile update: APÓS `hoteisService.updateHotel` sucesso → chamar `comodidadesService.upsertCategoriasDoHotel(resolvedHotelId, categoriasState)`.
  - Modo create novo hotel: APÓS `hoteisService.createHotel` retornar `hotelCriadoId` + criar usuário sucesso → chamar `upsertCategoriasDoHotel(hotelCriadoId, categoriasState)`.
- **Toast:** "Hotel salvo com sucesso! X categorias e Y itens de comodidades sincronizados."
- **Dependências:** T3 (state categorias + handlers).

## T5 — Mappers injetam `comodidades` no objeto Hotel
### T5a — DetalhesQuarto mapper
- **Path:** `src/components/DetalhesQuarto.tsx` → `loadRoomDetails()` L133-L167 (mappedDbHoteis return)
- **Alteração:** fetch paralelo `comodidadesService.getCategoriasByHotelId(h.id)` no `Promise.all` (junto ou após getHoteis). No objeto `return {}` do map, incluir campo opcional `comodidades: listaOrdenada`.

### T5b — PaginaHotel mapper (opcional: propagar via props quarto)
- **Path:** `src/components/PaginaHotel.tsx` → load de targetHotel (início do useEffect geral)
- **Alteração:** carregar `comodidades` do hotel e salvar em `currentHotel` state via spread.
- **Dependências:** T2 (service).

## T6 — Render DetalhesQuarto Grid 2x2 Dinâmico (padrão títulos)
- **Path:** `src/components/DetalhesQuarto.tsx` render coluna esquerda (L528+)
- **Substituir:** bloco hardcoded "COMODIDADES E CONFORTO CATEGORIZADOS" (L590-L703) pela versão dinâmica.
- **Estrutura render (100% regra do usuário Everaldo):**
  - Render SOMENTE se `(currentHotel.comodidades && currentHotel.comodidades.length > 0)`. Sem categorias → OCULTA seção completamente.
  - **Header seção:** REPLICAR exatamente padrão de "Itens Inclusos no Quarto" (L572-L575):
    ```tsx
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#006c49] text-xl">list_alt</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">Comodidades & Conforto Inclusos</h3>
      </div>
    ```
    → PRETO bold, NÃO uppercase verde.
  - **Grid cards:** `grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6` DENTRO do bg-white container.
  - **Card categoria (por categoria):**
    - `bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-5 space-y-3`
    - **Header card:** `flex items-center gap-2` → PRIORIDADE iconClass > Material:
      - Se `cat.iconClass` → `<i className={cat.iconClass} style={{color: cat.iconColor, fontSize: 24}}>`
      - Senão → `<span className="material-symbols-outlined" style={{color: cat.iconColor || '#006c49', fontSize: 24}}>{cat.icon || 'category'}</span>`
      - Título: `<span className="font-bold text-lg" style={{color: cat.iconColor || '#006c49'}}>{cat.nome}</span>`
    - **Lista itens:** `<ul className="space-y-2 text-xs sm:text-sm text-slate-600">`
      - Cada item: `<li className="flex items-start gap-2"><span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span><span>{item.texto}</span></li>`
    - Categorias com 0 itens: NÃO renderiza (filter).
- **Ordenação:** `.sort((a,b) => a.order - b.order)` categorias, itens idem.
- **Dependências:** T5 (comodidades injetadas no hotel).

## T7 — Validação TypeScript
- **Comando:** `npx tsc --noEmit`
- **Saída esperada:** exit 0, 0 erros.
- **Ajustes:** Qualquer propriedade opcional (`?`) em interfaces PublicHotel / Hotel que não compilar.
- **Diagnósticos finais:** GetDiagnostics VS Code no fim.
