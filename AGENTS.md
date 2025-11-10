# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts all Next.js App Router routes (student, teacher, projector views) plus shared providers; colocate route-specific components under their route folder to keep data dependencies obvious.
- `components/` stores reusable UI such as the numeric keypad; keep them presentation-focused and export with named exports for tree-shaking.
- `convex/` contains real-time backend functions (`schema.ts`, `classes.ts`, `pairing.ts`, etc.) and test helpers in `testData.ts`; mutations and queries should remain side-effect free beyond Convex writes.
- `lib/` holds pure utilities like `studentStateMachine.ts`; treat files here as framework-agnostic business logic that can be unit tested in isolation.
- Static assets live in `public/`; Tailwind and global config files (`tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`) sit at the repo root for easy reference.

## Build, Test, and Development Commands
- `npm run dev` — starts the Next.js dev server; pair it with `npx convex dev` in another terminal for live data.
- `npm run build` / `npm run start` — compile and serve the production bundle; use before shipping significant backend changes.
- `npm run lint` — runs ESLint with `next/core-web-vitals`; fix or silence findings before opening a PR.
- `npm run clear-db` — convenience wrapper around `npx convex run dev:clearAllData` for resetting local Convex tables.
- `npx convex dev` — logs you into Convex, seeds `.env.local`, and runs the realtime backend; required for any flow that mutates data.

## Coding Style & Naming Conventions
- TypeScript is `strict` per `tsconfig.json`; prefer explicit types on public APIs and let inference handle internals.
- Use 2-space indentation, `PascalCase` for React components and XState machines, `camelCase` for helpers, and `UPPER_SNAKE_CASE` for environment variables.
- Co-locate UI logic with Tailwind utility classes; extract shared styling tokens into Tailwind config instead of duplicating class strings.
- Keep Convex functions pure and deterministic: arguments validated with `convex/values` schemas and errors surfaced via thrown Exceptions.

## Testing Guidelines
- No automated test harness ships today, so add focused unit tests when touching pure modules (e.g., `lib/studentStateMachine.ts`) using the tooling of your choice and document how to run them in the PR.
- Use `convex/testData.ts` mutations to spin up seeded rooms or to clean data before manual QA; follow the script comments so demo codes (e.g., `TEST`, pin `1234`) stay consistent.
- Before merging, run through student/teacher/projector flows in separate browser windows to confirm real-time syncing, pairing rules, and question cycling.

## Commit & Pull Request Guidelines
- Follow the existing imperative, feature-focused commit style (`Add dark mode theme system…`); start with a capitalized verb and keep to ~72 characters.
- Each PR description should cover motivation, screenshots or short clips for UI tweaks, relevant routes touched, and any data reset steps (e.g., “run `npm run clear-db`”).
- Link related issues, call out Convex schema changes explicitly, and list manual test scenarios executed so reviewers can reproduce quickly.

## Security & Configuration Tips
- Never commit `.env.local`; store Convex deployment URLs and secrets there, mirroring keys from `.env.example`.
- Rotate classroom PINs when demoing in public spaces and avoid hard-coding codes outside controlled test helpers.
- When capturing logs or screenshots, redact student names and codes to preserve FERPA-aligned privacy expectations.
