---
name: Hotel No Zap
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2a1700'
  on-tertiary-container: '#b87500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  sidebar-start: '#003400'
  sidebar-end: '#000000'
  active-tab-bg: rgba(108, 248, 187, 0.2)
  active-tab-text: '#6cf8bb'
  surface-bg: '#f8f9ff'
  border-subtle: '#c6c6cd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 32px
  margin-mobile: 16px
  sidebar-width: 280px
  top-bar-height: 64px
---

## Brand & Style

The brand identity for **Hotel No Zap** is rooted in "Digital Hospitality"�merging the urgency of real-time messaging with the structured reliability of professional hotel management. The visual style is **Corporate Modern** with a distinct **Dark-Sidebar emphasis**, designed to feel efficient, trustworthy, and systematic.

The interface evokes a sense of control and clarity. It utilizes a clear information hierarchy where critical KPIs are surfaced through color-coded status indicators (success greens and error reds) against a neutral, high-legibility backdrop. The overall aesthetic is clean and functional, prioritizing data density without sacrificing airiness, suitable for high-frequency operational use.

## Colors

The palette is anchored by a sophisticated interplay between a deep, immersive sidebar and a crisp, light-mode workspace.

- **Primary & Neutral:** Deep slates (#0f172a) and cool grays provide the professional backbone, used for text and primary action buttons.
- **Semantic Accents:** A vibrant emerald green (#10b981) represents availability and success, while a sharp red (#ba1a1a) identifies occupancy and alerts.
- **The Sidebar Gradient:** A signature vertical gradient from deep forest green (#003400) to pure black (#000000) creates a distinctive "command center" feel, separating navigation from the work area.
- **Surface Strategy:** Backgrounds use a very light cool-blue tint (#f8f9ff) to reduce eye strain compared to pure white, while containers utilize pure white to pop against the background.

## Typography

The system exclusively utilizes **Inter**, a typeface designed for screen legibility and UI precision. 

- **Headlines:** Use tight letter-spacing and bold weights (700) to create a strong visual anchor for page titles.
- **Data Display:** KPI values use `headline-lg` to ensure immediate glanceability.
- **Labels:** Small labels use a higher font weight (600) and increased letter-spacing (0.05em) to maintain readability at 12px.
- **Scale:** The hierarchy is optimized for dense dashboards, with a clear distinction between metadata (label-sm) and actionable content (body-md).

## Layout & Spacing

The layout follows a **Fixed-Sidebar Fluid-Content** model.

- **Sidebar:** A fixed 280px navigation drawer on the left establishes the primary hierarchy (`w-[280px]`, `lg:ml-[280px]`).
- **Standard Screen Wrapper:** All main view screens (e.g. Dashboard, MapaQuartos, ListagemHospedes) MUST use the standardized page container wrapper:
  ```tsx
  className="p-6 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12"
  ```
  This ensures:
  - Responsive padding (`p-6` mobile, `sm:p-8` tablet, `lg:p-10` desktop) to maintain a generous 24px-40px margin from the 280px sidebar and screen edges.
  - Alignment with the desktop header (`px-6 sm:px-8 lg:px-10`).
  - Mobile bottom navigation clearance (`pb-24 lg:pb-12`).
- **Grid:** A fluid grid system with a 24px gutter is used for the "Bento-style" dashboard cards.
- **Margins:** Desktop views utilize a generous 32px to 40px outer margin for the main canvas.
- **Rhythm:** All spacing is based on a 4px base unit. Component internal padding typically scales in multiples of 4.

## Photo Upload Guidelines

All forms with photo upload options MUST pull images directly from the user's local computer:
1. **Native File Input**: Use a hidden `<input type="file" ref={fileInputRef} accept="image/*" multiple onChange={handleFileSelect} className="hidden" />` element.
2. **Local Preview Generation**: Use `URL.createObjectURL(file)` to generate instant local image previews without needing an external upload server.
3. **Interactive Actions**: Clicking the "Adicionar Foto" / Upload Box triggers `fileInputRef.current?.click()`. Provide a hover delete button (`delete` icon) on preview cards to remove images.

## Elevation & Depth

Hierarchy is established through **Low-contrast Outlines** and **Tonal Layering** rather than heavy shadows.

- **Surface Levels:** 
  - Level 0: Background (#f8f9ff)
  - Level 1: Cards and Sidebar (#ffffff or Gradient)
  - Level 2: Interactive states and dropdowns.
- **Borders:** All containers use a subtle 1px border (#c6c6cd) to define boundaries. 
- **Shadows:** Use a very soft `shadow-sm` (low blur, low opacity) only on primary containers and floating elements to provide a slight lift from the background without cluttering the interface.

## Shapes

The shape language is **Soft and Professional**, avoiding the playfulness of hyper-rounded corners while maintaining an approachable feel.

- **Standard Radius:** 0.25rem (4px) for small elements like inputs and tags.
- **Large Radius:** 0.75rem (12px) for dashboard cards and primary container blocks.
- **Pill:** Reserved exclusively for status indicators (tags) and circular profile/icon buttons.
- **Icons:** Material Symbols Outlined are used with a 400 weight for a crisp, lightweight appearance.

## Components

- **Buttons:** 
  - *Primary:* Solid slate background with white text, 12px corner radius.
  - *Sidebar Tabs:* Transparent by default, changing to a 20% opacity tint of the secondary color with a left-edge "active" highlight.
  - *Creation Buttons ("Novo / Nova"):* Buttons that trigger creation of entities (e.g. "Novo Quarto", "Nova Categoria", "Novo Item") MUST use the leading `add` icon (`<span className="material-symbols-outlined">add</span>`) AND MUST NOT include a literal `+` character inside the text label string (e.g. `<span>Nova Categoria</span>`). This prevents duplicated plus signs (`+ +`).
- **Dashboard Cards:** White background, 12px radius, 1px border. They should include a header area for titles and a body area for data or charts.
- **KPI Indicators:** Small pill-shaped tags with 10% opacity background of the semantic color (Green/Red) and 100% opacity text.
- **Charts:** Donut charts use thick strokes with 2px gaps between segments. Bar charts use slightly rounded tops for bars (2px).
- **Inputs:** Search bars and text inputs use a light background, 1px border, and leading icons for functional clarity.

## Input Formatting & Mask Guidelines

All forms in the application MUST use standardized live input mask utilities imported from `@/utils/masks` (or `../utils/masks`):

1. **CPF / CNPJ**:
   - **CPF**: `maskCpf(value)` formats 11 digits as `000.000.000-00`.
   - **CNPJ**: `maskCnpj(value)` formats 14 digits as `00.000.000/0000-00`.
   - **Dynamic CPF/CNPJ**: `maskCpfCnpj(value)` automatically toggles between CPF and CNPJ format depending on digit count.
2. **CEP**:
   - `maskCep(value)` formats 8 digits as `00000-000`.
3. **Telefone / WhatsApp**:
   - `maskPhone(value)` formats 10 digits as `(00) 0000-0000` (landline) or 11 digits as `(00) 00000-0000` (mobile/WhatsApp).

All mask functions sanitize input by stripping non-numeric characters (`\D`), preventing invalid input characters.

## ViaCEP Auto-Address Integration Guidelines

All registration forms that contain a CEP input field MUST integrate automatic address retrieval using `fetchAddressByCep` from `@/utils/viacep` (or `../utils/viacep`):

1. **Auto Lookup**: Trigger `fetchAddressByCep(cep)` automatically when 8 digits are typed (`clean.length === 8`) or on `onBlur` of the CEP input field.
2. **Auto Population**: Upon successful API response, populate:
   - `address` / `logradouro`
   - `neighborhood` / `bairro`
   - `city` / `localidade`
   - `stateUf` / `uf`
   - `complement` / `complemento` (if present and user complement is empty).
3. **UX Feedback**: Display a discreet loading state ("Buscando...") while fetching and show user-friendly error feedback if the CEP is not found.

## Modal Design Standard Guidelines ("Ver Detalhes" / View Modals)

All view/details modals in the system MUST adhere strictly to the standardized 1:1 layout specification:

1. **Overlay & Backdrop**:
   - Backdrop: `fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto`.
   - Container max width: `max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col my-auto max-h-[92vh]`.

2. **Modal Header**:
   - **Background**: Dark forest green (`bg-[#003400] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md`).
   - **Left Title Area**: Leading icon in vibrant green (`text-[#25D366]`), title text (e.g. `Detalhes do Produto`), ID code badge (`bg-emerald-950/80 text-emerald-300 font-mono border border-emerald-800`), and status pill (`bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1`).
   - **Header Close Button**: MUST ALWAYS be a solid red rounded box button (`bg-[#b91c1c] text-white hover:bg-red-800 p-1.5 rounded-xl shrink-0 flex items-center justify-center shadow-xs active:scale-95`) with white `close` icon (never transparent on default).

3. **Modal Body Content (Scrollable)**:
   - `overflow-y-auto px-3.5 sm:px-6 py-4 space-y-4 text-slate-700 text-xs sm:text-sm`.
   - **Hero Identity Card**: Gradient background (`from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 rounded-xl p-3.5 sm:p-4`), large icon box (`w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white text-blue-600 border border-blue-200 shadow-2xs`), category dot line, bold title, and barcode scanner / SKU tag.
   - **KPI Metric Cards**: 3 or 4 columns (2 columns on mobile) for prices, stock levels, and profitability with semantic badges (`bg-emerald-50/80 border border-emerald-200` for profit margin / healthy levels).
   - **Operational Details Section**: Card container with `description` icon, structured sub-info fields (supplier, location, etc.).
   - **Audit Metadata**: Subtle bottom line (`text-[9.5px] sm:text-[11px] text-slate-400 border-t border-slate-100`) displaying creation and last update timestamps.

4. **Modal Footer Actions**:
   - **Container**: `bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-end gap-2.5 shrink-0`.
      - **Close Button ("Fechar")**: MUST ALWAYS use solid red background (`bg-[#b91c1c] hover:bg-red-800`), bold white text (`text-white font-bold`), rounded corners (`rounded-xl`), and leading `close` icon (`<span className="material-symbols-outlined text-base">close</span>`), positioned at the bottom right corner (`justify-end`).
      - **Edit Button**: Orange (`bg-[#EA580C] hover:bg-orange-700 text-white font-bold`) with `edit` icon, which seamlessly closes the view modal and opens the edit modal.

## Mobile Bottom Navigation Standard

In mobile views (`lg:hidden`), the bottom sticky navigation bar (`<nav className="fixed bottom-0 ...">`) MUST map the **"Financeiro"** tab (`account_balance_wallet` icon) to open the **Controle de Caixa** component (`activeTab === 'caixa'`) across all mobile screens.

## Global Automatic Scroll-to-Top Standard

Whenever the user changes tabs or navigates between screens (`activeTab` state change in `App.tsx`), the application MUST automatically reset scroll position to the top (`window.scrollTo(0, 0)` and `mainContentRef.current.scrollTop = 0`). This ensures that every newly opened view ALWAYS renders scrolled to the very top, avoiding carrying over scroll offsets from previously viewed screens.

## Dropdown Inline Quick Creation Guidelines ("+" Button)

All registration forms (`Cadastro...`) in the system containing selection dropdowns (e.g. *Motivo / Justificativa*, *Conta de Saída / Origem*, *Condição de Pagamento*, *Categoria*, etc.) MUST feature an inline green `+` action button:

1. **Inline Button Placement**: Place the `+` button directly next to the `<select>` input element inside a flex container (`flex items-center gap-2`).
2. **Button Styling**: Light green background (`bg-[#d1fae5] hover:bg-emerald-200 border border-emerald-400`), black text, and bold font (`text-black font-bold p-2.5 rounded-xl shrink-0 shadow-sm cursor-pointer`) with leading `add` icon (`<span className="material-symbols-outlined text-xl text-black font-bold">add</span>`).
3. **Modal or Route Behavior**:
   - Clicking `+` opens a dedicated quick-creation modal (or navigates to the dedicated full creation route if requested).
   - Quick creation modals use dark green header (`bg-[#003400] text-white`) with solid red close button (`bg-[#b91c1c] text-white`).
4. **Instant State Update & Selection**:
   - Upon saving the new item, it is immediately appended to the dropdown options array, automatically set as the active selected option (`setValue(newOptionValue)`), and feedback is provided via standard system Toast (`bg-[#d1fae5] border border-emerald-300 text-black font-bold`).




