# SBay Frontend

Modern React storefront for the SBay buyer marketplace. Talks to the Express/MongoDB backend at `/api/v1`.

## Stack

- **React 19 + TypeScript** with **Vite**
- **React Router v7**, **TanStack Query v5**, **Axios**
- **Tailwind CSS v4** with CSS-variable theming (light/dark)
- **Lenis** smooth scroll + **GSAP** (ScrollTrigger reveals, hero motion)
- Feature-sliced structure under `src/features/*`

## Design system

The visual identity is defined in [`DESIGN.md`](./DESIGN.md) (YAML tokens + prose,
per the `@google/design.md` spec) and materialized as CSS variables in
`src/theme.css`. Style: *Modern E-commerce Trust* — indigo primary, amber accent
reserved for ratings/sale prices, WCAG AA in both themes.

- Lint the design tokens: `npm run design:lint`
- Re-export a base Tailwind theme from tokens: `npm run design:export`

## Setup

```sh
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

The dev server proxies `/api`, `/health`, `/ready` to the backend on
`http://localhost:4000`, so auth cookies and CSRF stay same-origin. Run the
backend (`cd backend && npm run dev`) and seed data (`npm run seed`) first.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) and build for production
- `npm run preview` — preview the production build
- `npm run lint` — ESLint
- `npm run design:lint` — validate `DESIGN.md` (contrast, references)

## Security notes

- Auth tokens are **HttpOnly cookies** — never read/stored by JS. Every request
  sets `withCredentials`.
- Unsafe methods send a CSRF token (`x-csrf-token`) fetched from
  `GET /auth/csrf-token`; the Axios client caches it and refreshes on rejection.
- On a 401 the client performs a single-flight token refresh, then replays the
  request; repeated failure clears auth state and routes to login.
- User content (reviews, descriptions, attributes) is rendered through React's
  default escaping — no `dangerouslySetInnerHTML`.

## Known limitations (backend scope)

- No order/cart/checkout API yet → the cart is **client-side (localStorage)** and
  checkout shows a "coming soon" message.
- Review/feedback **display only**: writing requires a delivered `orderId` /
  `orderItemId`, and there is no buyer-order listing endpoint, so the write forms
  are intentionally not mounted.
- No avatar upload endpoint → avatar is a URL field.
