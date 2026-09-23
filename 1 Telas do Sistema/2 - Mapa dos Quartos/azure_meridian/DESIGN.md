---
name: ZapHotel Management
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

The brand identity for **ZapHotel** is rooted in "Digital Hospitality"—merging the urgency of real-time messaging with the structured reliability of professional hotel management. The visual style is **Corporate Modern** with a distinct **Dark-Sidebar emphasis**, designed to feel efficient, trustworthy, and systematic.

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

- **Sidebar:** A fixed 280px navigation drawer on the left establishes the primary hierarchy.
- **Grid:** A fluid grid system with a 24px gutter is used for the "Bento-style" dashboard cards.
- **Margins:** Desktop views utilize a generous 32px outer margin for the main canvas to provide breathing room for data-heavy components. 
- **Rhythm:** All spacing is based on a 4px base unit. Component internal padding typically scales in multiples of 4 (e.g., 12px for list items, 20px for card interiors).

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
- **Dashboard Cards:** White background, 12px radius, 1px border. They should include a header area for titles and a body area for data or charts.
- **KPI Indicators:** Small pill-shaped tags with 10% opacity background of the semantic color (Green/Red) and 100% opacity text.
- **Charts:** Donut charts use thick strokes with 2px gaps between segments. Bar charts use slightly rounded tops for bars (2px).
- **Inputs:** Search bars and text inputs use a light background, 1px border, and leading icons for functional clarity.