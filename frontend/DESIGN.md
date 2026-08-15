---
name: SBay Storefront
description: Modern e-commerce storefront for the SBay buyer marketplace — trustworthy, clean, conversion-oriented.
colors:
  primary: "#1E293B"
  on-primary: "#FFFFFF"
  primary-hover: "#0F172A"
  accent: "#E11D48"
  accent-hover: "#BE123C"
  on-accent: "#FFFFFF"
  rating: "#F59E0B"
  bg: "#F8FAFC"
  surface: "#FFFFFF"
  surface-2: "#EEF2F7"
  text: "#0F172A"
  muted: "#64748B"
  border: "#E2E8F0"
  success: "#16A34A"
  danger: "#DC2626"
  bg-dark: "#0F172A"
  surface-dark: "#1E293B"
  surface-2-dark: "#273449"
  text-dark: "#F8FAFC"
  muted-dark: "#94A3B8"
  border-dark: "#334155"
  primary-dark: "#F8FAFC"
  accent-dark: "#F43F5E"
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.75rem
    fontWeight: 800
    lineHeight: "1.1"
    letterSpacing: "-0.02em"
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: "1.6"
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 16px
  rating-star:
    textColor: "{colors.rating}"
---

## Overview

Modern e-commerce storefront for a buyer-focused marketplace. The visual register
sits between the structural cleanliness of a tool like Linear and the warm,
trustworthy feel of a premium online store. The person here came to **buy** —
every screen must make the product, its price, its rating, and the "add to cart"
action unmistakable. The UI is confident and quiet: it earns trust through
clarity and restraint, not through decoration.

Think of a well-run department store's website: generous whitespace, crisp
product cards on a light canvas, one dependable brand color for actions, and a
single warm accent reserved for the things a shopper scans for — ratings and
prices. It supports a full dark mode of the same character.

## Colors

A confident streetwear/premium system: a charcoal-navy brand color gives
structure, a vivid coral drives every call-to-action, and a scarce amber marks
evaluation cues (ratings, sale prices). Color guides the eye, never decorates.

- **Primary — Charcoal Navy {colors.primary}:** The brand/structure color —
  header, nav, links, headings, banner blocks, focus rings. Calm and premium; it
  frames the product without competing with it. Hover deepens to
  {colors.primary-hover}.
- **Accent — Coral {colors.accent}:** The single call-to-action color — every
  action button (login, buy now, add-to-cart). It pops on both light and dark
  canvases so "act here" is always unmistakable. Not used for large surfaces.
- **Rating — Amber {colors.rating}:** Scarce by design. Appears only on rating
  stars and promotional/sale prices, kept visually distinct from the coral CTA
  so the two never blur.
- **Background {colors.bg}:** A soft slate-tinted off-white, never pure white —
  gentler on the eyes across long browsing sessions.
- **Surface {colors.surface}:** Pure white for cards and panels, lifted off the
  background by a hairline border rather than a heavy shadow.
- **Text {colors.text}:** Near-black slate for headings and body; never `#000`.
- **Muted {colors.muted}:** Secondary metadata — seller names, timestamps, counts.
- **Border {colors.border}:** Hairline dividers and card edges; 1px, low-contrast.
- **Success {colors.success} / Danger {colors.danger}:** Semantic only —
  in-stock/confirmation and errors/destructive actions respectively.

Dark mode mirrors the same roles on a deep charcoal canvas ({colors.bg-dark}
/ {colors.surface-dark}); the brand flips to a light slate ({colors.primary-dark})
for legible text while coral ({colors.accent-dark}) stays vivid, so both action
and evaluation cues keep WCAG AA contrast.

## Typography

One family — **Plus Jakarta Sans** — across the whole UI. A modern geometric
humanist sans: friendly enough for retail, precise enough to feel trustworthy.
Hierarchy comes from weight and size, not from switching families.

- **H1 {typography.h1}:** Page and hero titles. Heavy (800), tight tracking.
- **H2 {typography.h2}:** Section titles. Modest — ~1.75× body, not 3×.
- **Body {typography.body-md}:** Descriptions and general copy at a comfortable
  1.6 line-height.
- **Label caps {typography.label-caps}:** Small uppercase eyebrows, badges,
  category tags — wide tracking, 600 weight.

## Layout

- Content max width ~1280px, centered, with generous gutters.
- Product grids are responsive: 2 columns on mobile, up to 4–5 on wide screens.
- Vertical rhythm on the spacing scale; sections breathe with `xl` gaps.
- Cards align to a consistent grid; never crowd the price and CTA.

## Elevation & Depth

Depth is expressed through **hairline borders and layering**, not drop shadows.
Shadows, when present, are ultra-diffuse and low opacity (< 0.08) — used only to
lift interactive overlays (dropdowns, drawers, modals). Resting cards use a 1px
border only. No neumorphism, no glow.

## Shapes

Soft but not playful. Corners are rounded at `sm`–`lg` (6–16px). Buttons and
inputs use `md` (10px). Pills (`full`) are reserved for small tags, badges, and
avatars — never for large containers or primary buttons.

## Components

- **button-primary {components.button-primary}:** Solid coral, white text,
  10px radius, no shadow. Every action button uses it. Hover deepens the coral;
  `:active` applies a subtle `scale(0.98)`.
- **card {components.card}:** White surface, 16px radius, 1px border, generous
  padding. On hover, an ultra-subtle shadow and 1px lift — nothing dramatic.
- **rating-star {components.rating-star}:** Amber fill for the earned portion,
  muted border for the remainder.

## Do's and Don'ts

- **Don't** use purple/pink or blue "AI gradient" backgrounds, neon, or
  glassmorphism. This is a store, not a crypto landing page.
- **Don't** use heavy Tailwind shadows (`shadow-lg`, `shadow-xl`) on resting
  cards. Depth comes from borders and layering.
- **Don't** spend the amber rating color on anything other than ratings and sale
  prices. Its meaning collapses if it's everywhere.
- **Don't** make body text pure black or headings 3–5× body size. Trust modest
  contrast in scale.
- **Don't** use pill shapes for cards or primary buttons.
- **Do** keep the canvas calm and let product imagery carry the color.
- **Do** make price, rating, stock status, and the primary CTA the loudest
  things on any product surface.
- **Do** keep both light and dark themes at WCAG AA for all text and controls.
- **Do** collapse all motion to 0ms under `prefers-reduced-motion`.
