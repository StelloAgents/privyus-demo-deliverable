# Privyus demo

An interactive, hard-coded demo of the Privyus political-intelligence platform. All names, records, and figures are illustrative and do not describe real people or events. The demo has no backend: all data lives in `src/data/`.

## Run it locally

You need Node.js 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To run the production build:

```bash
npm run build
npm start
```

## Screens

| Route | Screen |
|---|---|
| `/` | Main dashboard |
| `/explore` | Exploration mode (relationship graph and AI chat) |
| `/search` | Search |
| `/login` | Sign-in screen |
| `/technical` | Technical architecture overview |
| `/lab` | Alternative graph visual concepts |

Presenter mode walks through the demo story step by step. Start it with the "Present" button in the top bar, or press `P`. In presenter mode, `N` toggles the speaker notes, and `Home` / `End` jump to the first and last step.

## Project layout

| Folder | Contents |
|---|---|
| `src/app/` | Next.js App Router pages |
| `src/features/` | Screen-level features (dashboard, explore, search, presenter, technical, lab) |
| `src/components/` | Shared UI components |
| `src/data/` | Demo fixtures and the chat script |
| `src/lib/` | Store, graph, script, and tour engines |
| `src/styles/` | Design tokens and global styles |
| `e2e/` | Playwright test of the full presenter tour |
| `scripts/` | Layout check and screenshot helpers |

## Tests

```bash
npx playwright install chromium
npm run e2e:tour
```

## Deploy

This is a standard Next.js project. It deploys to Vercel with no extra settings.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, React Flow, d3-force, and Three.js.
