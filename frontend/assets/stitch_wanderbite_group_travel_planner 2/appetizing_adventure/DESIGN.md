---
name: Appetizing Adventure
colors:
  surface: '#fcf9f4'
  surface-dim: '#dcdad5'
  surface-bright: '#fcf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ee'
  surface-container: '#f0ede9'
  surface-container-high: '#ebe8e3'
  surface-container-highest: '#e5e2dd'
  on-surface: '#1c1c19'
  on-surface-variant: '#59413b'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f3f0eb'
  outline: '#8d7169'
  outline-variant: '#e1bfb7'
  surface-tint: '#ae310d'
  primary: '#ab2f0a'
  on-primary: '#ffffff'
  primary-container: '#cd4722'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb4a1'
  secondary: '#3a674f'
  on-secondary: '#ffffff'
  secondary-container: '#bceecf'
  on-secondary-container: '#406d55'
  tertiary: '#795600'
  on-tertiary: '#ffffff'
  tertiary-container: '#986d00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd2'
  primary-fixed-dim: '#ffb4a1'
  on-primary-fixed: '#3c0800'
  on-primary-fixed-variant: '#881f00'
  secondary-fixed: '#bceecf'
  secondary-fixed-dim: '#a1d1b4'
  on-secondary-fixed: '#002112'
  on-secondary-fixed-variant: '#224f39'
  tertiary-fixed: '#ffdea8'
  tertiary-fixed-dim: '#ffba20'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5e4200'
  background: '#fcf9f4'
  on-background: '#1c1c19'
  surface-variant: '#e5e2dd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system embodies the joyous chaos and savory anticipation of exploring new cities and flavors with close friends. Designed for food-loving millennial travelers, the experience strikes a balance between culinary editorial richness and tactile, frictionless collaboration. The aesthetic leans into a warm modernism that blends clean structural layouts with sun-drenched, appetizing chromatic vitality.

The emotional tone is generous, warm, vibrant, and spontaneous. It avoids the sterilized, hyper-minimal tech look in favor of sunlit organic warmth: reminiscent of outdoor street markets, clay ceramics, natural linens, and vibrant citrus wedges. Interactions feel energetic and bouncy, built around rich culinary imagery, collaborative avatars, playful tagging, and tactile scheduling nodes that make group trip coordination feel less like logistical planning and more like curating a shared feast.

## Colors

The color palette captures sun-ripened ingredients and artisanal kitchenware. All surfaces maintain high contrast against crisp slate text while sustaining an organic warmth.

- **Primary (`#E85A34`, hover/accent `#FF6F43`):** Terracotta and tangerine punch. Used for primary CTAs, active itinerary tabs, vote counts, high-priority food pins, and key interactive highlights.
- **Secondary (`#2D5A43`, lighter accent `#437D5D`):** Rich matcha forest green. Signifies grounded utility, verified reservations, host indicators, booked status chips, and travel transit metadata.
- **Tertiary (`#FFB800`):** Golden yuzu yellow. Serves as an expressive accent for culinary awards, Michelin/guide tags, bookmark pins, rating stars, and high-energy alerts.
- **Neutral Surface (`#FAF7F2`, secondary surface `#F4EEE5`, border `#E8DFD3`):** Warm linen and toasted flour tones that eliminate harsh display glare and evoke textured paper menus.
- **Text & Contrast (`#1E1E24` for headings/body, `#5A5A66` for secondary descriptions):** Crisp dark slate providing legibility while avoiding stark pure black.

## Typography

The type hierarchy relies entirely on **Plus Jakarta Sans**, utilizing its geometric proportions, wide aperture, and friendly rounded terminals to balance playful energy with utility.

- **Headlines (`800` & `700` weight):** Set tight tracking (-0.02em) for impactful, appetizing display headers that convey excitement when discovering local food stalls or destination hubs.
- **Body Text (`400` & `500` weight):** Normal tracking and relaxed line heights ensure high readability across ingredient lists, neighborhood reviews, and travel logistics.
- **Labels & Badges (`600` & `700` weight):** Uppercase tracking (+0.04em) is applied selectively on `label-sm` for culinary dietary chips (e.g., "NATURAL WINE", "STREET FOOD", "SPICY") to maximize clarity at compact sizes.

## Layout & Spacing

The layout is built upon an 8pt spatial grid with a fluid responsive structure adapted for mobile-first coordination:

- **Mobile Viewport (<768px):** Single-column stack with 16px (`1rem`) outer canvas margins and 16px gutter gaps. Interactive bottom navigation and floating bottom snackbars prioritize one-handed thumb interaction.
- **Tablet / Split Viewport (768px - 1024px):** Two-column fluid grid dividing live interactive maps/media on the left and chronological group itineraries on the right.
- **Desktop Viewport (>1024px):** Fixed-container fluid grid maxing out at 1280px with 40px (`2.5rem`) margins and 24px (`1.5rem`) column gutters. Supports three-pane workflows: collaborative member roster, main day-to-day culinary schedule, and contextual restaurant details.

## Elevation & Depth

Visual hierarchy uses warm ambient lighting rather than cold drop shadows. Shadows are tinted with deep terracotta undertones to harmonize with the linen ground:

- **Surface Level 0 (Canvas):** Base warm linen background (`#FAF7F2`).
- **Surface Level 1 (Cards, Modules):** Crisp elevated white or tinted linen (`#FFFFFF` or `#F4EEE5`) with a low-contrast 1px border (`#E8DFD3`) and subtle ground shadow: `0 2px 8px rgba(78, 42, 29, 0.04)`.
- **Surface Level 2 (Floating Day-Nodes, Interactive Chips, Active Cards):** Elevated for interactive feedback: `0 6px 18px rgba(78, 42, 29, 0.08)`.
- **Surface Level 3 (Modals, Bottom Sheets, Collaboration Drawers):** High-focus overlays: `0 16px 36px rgba(45, 30, 24, 0.14)`.
- **Glass Frosting:** Used sparingly for sticky itinerary headers and bottom floating toolbars using `backdrop-filter: blur(16px)` over a 85% alpha linen substrate (`rgba(250, 247, 242, 0.85)`).

## Shapes

The design uses a Level 2 (Rounded) curvature profile. Standard cards, photo containers, and inputs maintain 8px (`0.5rem`) to 16px (`1rem`) radii, creating a friendly, organic visual rhythm. 

Fully pill-shaped geometries (9999px) are reserved for collaborative avatars, interactive dietary filter chips, and primary floating action buttons to emphasize tap targets.

## Components

### Buttons
- **Primary:** Filled `#E85A34` with bold white text, pill-shaped or rounded (`12px`), with subtle scale transition (`0.98`) on press. Focus state features a 3px ring of `#FFB800`.
- **Secondary:** Filled `#2D5A43` with white text for action confirmations like "Add to Itinerary" or "Reserve Spot".
- **Outline / Ghost:** `#FAF7F2` background with 1.5px `#E8DFD3` border and dark slate text; active hover tints background to `#F4EEE5`.

### Chips & Food Tags
- **Dietary & Flavor Tags:** Pill-shaped tags using low-saturation tinted backgrounds with high-contrast text. Example: `#FFF3E0` base with `#C4411C` text for "Must Try Street Food"; `#EAF3ED` base with `#2D5A43` text for "Natural Wine".
- **Voting Chips:** Compact rounded badges containing heart or fork-and-knife icons alongside collaborative friend counters (`+3`).

### Cards & Media
- **Culinary Venue Card:** Displays high-aspect 16:10 photography with rounded top corners (`16px`), an absolute badge anchored top-right (e.g. Yuzu gold rating badge), title, location distance, friend bookmark avatars, and vote triggers.
- **Card States:** Resting state sits at Elevation Level 1; hover lifts smoothly to Elevation Level 2 with primary border glow (`#FF6F43`).

### Inputs & Controls
- **Form Fields:** Inset height (48px) with `#FFFFFF` background, 1.5px `#E8DFD3` border, rounded 12px corners, and crisp `#1E1E24` input text. Focus state illuminates the border with `#E85A34` and zero blur shadow.
- **Checkboxes & Radios:** Rounded square (checkbox) and full circle (radio) finished with `#2D5A43` fill when selected, enclosing a crisp white icon.

### Day-Timeline Itinerary Nodes
- Vertical connecting line in soft terracotta tint (`#F6D0C5`) anchored by circular timeline nodes.
- **Nodes:** Meal-specific markers (Breakfast, Lunch, Coffee, Dinner, Drinks) featuring clean iconography enclosed within 36px circular badges colored in alternating matcha green and terracotta hues.
- **Time Slot Modules:** Offset cards linking time, map check-in distance, walking time estimations, and group note comment bubbles.