---
name: ZapHotel Checkout & Subscription
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf6'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dde9ff'
  surface-container-highest: '#d3e3ff'
  on-surface: '#0b1c30'
  on-surface-variant: '#42493e'
  inverse-surface: '#213146'
  inverse-on-surface: '#ebf1ff'
  outline: '#72796d'
  outline-variant: '#c1c9ba'
  surface-tint: '#386a2e'
  primary: '#001c00'
  on-primary: '#ffffff'
  primary-container: '#003400'
  on-primary-container: '#6ba05d'
  inverse-primary: '#9dd58d'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#9af2c5'
  on-secondary-container: '#0c714d'
  tertiary: '#171717'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b2b2b'
  on-tertiary-container: '#929292'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b9f2a7'
  primary-fixed-dim: '#9dd58d'
  on-primary-fixed: '#002200'
  on-primary-fixed-variant: '#205118'
  secondary-fixed: '#9df4c8'
  secondary-fixed-dim: '#81d8ad'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e3ff'
  gradient-start: '#003400'
  gradient-end: '#000000'
  surface-page: '#f8f9ff'
  surface-card: '#ffffff'
  surface-tint-active: rgba(108, 248, 187, 0.15)
  accent-mint: '#6cf8bb'
  border-subtle: '#c6c6cd'
  border-focused: '#003400'
  error-base: '#ba1a1a'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
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
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
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
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The brand personality embodies focused enterprise hospitality—channeling the operational speed of messaging-first hotel communications into an ultra-streamlined, high-trust subscription workflow. The visual style is **Corporate Modern with Focus Mode Isolation**, eliminating standard SaaS chrome (removing global headers and sidebars on desktop) to prioritize high-intent conversions and plan configurations without distraction.

For desktop viewport experiences, the interface relies on an uncluttered full-screen form canvas centered on structural clarity, crisp input rhythm, and friction-free payment progression. On mobile (390px viewport width), the system pivots into an executive native feel, anchored by a branded top header utilizing the signature deep forest-to-black gradient, accompanied by a fixed elevated bottom bar for primary checkout actions.

The emotional tone balances high-tier enterprise stability with effortless completion: authoritative, clean, predictable, and reassuring.

## Colors

The subscription experience employs a tailored corporate palette designed to bridge operational software reliability with transactional security:

- **Primary (`#003400`):** Deep forest green anchors interactive form buttons, active toggles, input selection states, and primary plan selections.
- **Secondary (`#006c49`):** Supporting pine green applied to positive verification badges, discount indicators, and step validation signals.
- **Tertiary & Neutral (`#000000` and `#0b1c30`):** Pure black serves as the foundation for high-contrast headlines, paired with deep slate-navy for razor-sharp label legibility against soft backgrounds.
- **Mobile Header Gradient:** A smooth vertical linear blend running from `#003400` at the top edge down into `#000000` at the mobile header threshold, evoking the system's core control-center motif.
- **Canvas & Containers:** Base canvas is set to cool-tinted `#f8f9ff` to mitigate high-contrast eye strain, while active registration containers and form panels occupy pure `#ffffff` cards framed by `#c6c6cd`.

## Typography

The design system exclusively uses **Inter** to ensure maximum legibility during data entry, plan evaluation, and payment credential inputs.

- **Headlines:** Form headers, plan pricing figures, and section titles utilize tight tracking (-0.02em to -0.01em) and strong weights (600–700) to reinforce decision confidence.
- **Form Labels & Helpers:** Input labels utilize `label-md` (weight 500) paired with `on-surface` (`#0b1c30`), while hints and error text leverage `body-sm`.
- **Badges & Microcopy:** Tier tags, billing tags (e.g., "FATURADO ANUALMENTE"), and secure checkout badges utilize `label-sm` with uppercase transformation and expanded letter spacing (`0.05em`) for immediate scannability.

## Layout & Spacing

The layout model adapts distinct structural archetypes depending on context:

- **Desktop (Full-Screen Immersive Canvas):** Both the global SaaS sidebar and top navigation header are suppressed to prevent checkout abandonment. The view uses a focused dual-column or centered single-column layout (max-width 1040px) suspended within the `#f8f9ff` field:
  - Left/Main Column: Step-by-step subscription details, billing frequency toggle, customer info, and payment gateway inputs.
  - Right Rail: Sticky order summary, plan feature highlights, and secure compliance guarantee.
- **Mobile (390px Viewport):**
  - **Header:** Branded gradient header spanning 64px in height with `#003400` fading into `#000000`, containing a back navigation affordance, centered plan title, and secure SSL badge.
  - **Body Canvas:** Single-column vertical stack with `1rem` outer margins (`margin-mobile`), stacking form fieldsets with `1rem` gaps (`space-md`).
  - **Bottom Action Bar:** A fixed 72px persistent footer floating above bottom safe areas, housing the summary total and a full-width primary submission button.

## Elevation & Depth

Visual hierarchy is maintained through crisp structural surfaces, subtle boundaries, and controlled ambient depth:

- **Base Field (Elevation 0):** Background surface `#f8f9ff` provides a low-strain foundation.
- **Form Card Enclosures (Elevation 1):** White `#ffffff` cards bound by a 1px uniform `#c6c6cd` border, elevated with an ultra-soft ambient shadow: `0 4px 16px -2px rgba(11, 28, 48, 0.05)`.
- **Mobile Persistent Bars (Elevation 2):**
  - Mobile Top Header: Casts a delicate shadow downward (`0 2px 8px rgba(0, 0, 0, 0.25)`).
  - Mobile Bottom Sticky Bar: White surface with a top outline border `#c6c6cd` and an upward ambient shadow (`0 -4px 14px rgba(11, 28, 48, 0.08)`).
- **Active / Dropdown Tiers (Elevation 3):** Modal dialogs, select menus, and CVV tooltip flyouts feature crisp 1px borders with `0 12px 28px -4px rgba(0, 52, 0, 0.12)`.

## Shapes

The design system adheres to a **Soft (Level 1)** geometric standard, reinforcing corporate precision and rapid enterprise data entry:

- **Input Fields & Text Areas:** `0.25rem` (4px) corner radius, ensuring form fields retain structured architectural boundaries.
- **Buttons & Selectable Plan Tiles:** Standardize on `0.375rem` to `0.5rem` (`rounded-lg`) for a clean, professional click area.
- **Form Containers & Cards:** `0.5rem` (8px) for mobile cards and `0.75rem` (12px) for desktop container groupings.
- **Pills / Badges:** Full circular rounding (`9999px`) reserved exclusively for discount flags, security badges, and plan indicator chips.

## Components

### Form Inputs & Text Fields
- **Container:** 44px base height (48px on mobile for touch optimization), `#ffffff` background, 1px `#c6c6cd` border, `0.25rem` radius.
- **States:**
  - *Default:* `#45464d` placeholder text with a clear 14px `Inter` body typography.
  - *Focus:* 2px solid `#003400` perimeter border with an optional subtle glow (`0 0 0 3px rgba(0, 52, 0, 0.12)`).
  - *Error:* 1.5px solid `#ba1a1a` border accompanied by an error icon and `#ba1a1a` microcopy positioned 4px below the input.
- **Leading/Trailing Icons:** Standardized 20px icons (e.g., credit card types, lock icons, user and WhatsApp icons) tinted in `#76777d`.

### Buttons
- **Primary Action (Confirm Plan / Assinar Agora):**
  - Solid `#003400` background, pure white `#ffffff` label text, `0.375rem` radius, semibold 14px/16px weight.
  - Hover state darkens toward `#002100` with a smooth 150ms ease. Active state scales subtly (99%).
  - Mobile bottom bar variant stretches to 100% width with a fixed 48px height.
- **Secondary / Outline (Alterar Plano / Voltar):**
  - Transparent surface, 1px `#c6c6cd` border, `#0b1c30` text. Hover fills to `rgba(0, 52, 0, 0.04)`.

### Plan Selection Chips & Frequency Toggles
- **Billing Switcher (Mensal / Anual):** Segmented pill control housed in `#e5eeff` with a sliding white pill button. Active tier features an inline green savings chip (`rgba(108, 248, 187, 0.2)` fill with `#006c49` text).
- **Plan Summary Cards:** Selectable card variants with a 1px `#c6c6cd` edge that transitions to 2px `#003400` with a soft mint background tint (`rgba(108, 248, 187, 0.08)`) upon selection.

### Checkboxes & Radios
- **Radio Buttons (Payment Method):** 20px circles. Selected state produces a `#003400` outer ring enclosing an 8px solid center dot.
- **Terms & Conditions Checkbox:** 18px square with `0.125rem` radius. Unchecked has a 1.5px border `#c6c6cd`. Checked fills `#003400` with an inset white checkmark vector.

### Mobile Navigation Header & Bottom Bar
- **Top Header:** Fixed 64px bar featuring the `#003400` to `#000000` vertical gradient, white iconography for the back arrow, centered high-contrast white text, and a secure checkout padlock badge.
- **Bottom Bar:** Fixed 72px bar on mobile (390px width) containing the subtotal computation on the left and the primary full-width or flex button on the right, providing persistent, ergonomically optimal reach for thumb zones.