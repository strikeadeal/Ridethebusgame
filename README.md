# Ride the Bus 🚌

Pass-and-play drinking game PWA. One phone is the deck and the table — deal,
guess, assign drinks, survive the pyramid, and someone rides the bus.

**Play:** `https://<your-github-username>.github.io/Ridethebusgame/`
(add to home screen via Share → *Add to Home Screen* for the full-screen app;
works offline after the first visit)

## Development

- `npm run dev` — dev server at `http://localhost:5173/Ridethebusgame/`
- `npm test` — engine unit tests (Vitest)
- `npm run test:e2e` — Playwright E2E on WebKit (iPhone emulation); first run
  needs `npx playwright install webkit chromium`
- `npm run build` — type-check + production build
- `npm run icons` — regenerate PWA icons into `public/`

The game rules engine lives in `src/engine/` — pure TypeScript, no React, all
randomness seeded. React screens in `src/ui/` can only dispatch engine actions.

## Aesthetic Thesis
A late-night back-room card table — worn forest-green felt, a brass rail framing the screen, aged-ivory cards with paper grain and burnished-gold accents, dark mahogany. Low light; legible at arm's length; glanceable during play. Casino-adjacent without cliché. Avoid: generic "party app" neon, purple gradients, Inter/Roboto, illustrated face cards.

## Deployment

Pushing to `main` runs unit + E2E tests and deploys to GitHub Pages.
One-time repo setup:

1. Create a GitHub repo named exactly `Ridethebusgame` (the Vite `base` path
   depends on it) and push.
2. Repo Settings → Pages → Source: **GitHub Actions**.
