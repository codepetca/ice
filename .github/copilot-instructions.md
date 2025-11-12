# Copilot Instructions for Ice

This file provides guidance to GitHub Copilot coding agents when working with code in this repository.

## Project Overview

"Ice" is a low-friction, face-to-face classroom icebreaker application with two phases:
1. **Phase 1 (Group Formation)**: Users form groups of 2-4 using a request/accept system, answer shared "Would you rather?" questions, and have face-to-face conversations
2. **Phase 2 (Slideshow Game)**: Class-wide interactive slideshow displaying aggregated data from Phase 1, with optional voting

The design emphasizes minimal device interaction—devices act as prompts, not distractions.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database and functions)
- **State Management**: XState v5 (user flow state machine)
- **Animations**: Framer Motion
- **UI Libraries**: lucide-react, canvas-confetti

## Project Structure

```
ice/
├── app/                           # Next.js App Router routes
│   ├── page.tsx                  # Landing page with 4-letter code entry
│   ├── user/page.tsx             # User view with 8-state XState flow
│   ├── host/page.tsx             # Host dashboard with Phase 1/2 controls
│   ├── projector/page.tsx        # Projector display (Phase 1 stats + Phase 2 slideshow)
│   └── ConvexClientProvider.tsx  # Providers (Convex, Toast, ConfirmDialog)
├── components/                    # Reusable UI components
│   ├── Keypad.tsx                # 4-letter code entry
│   ├── SlideshowQuestion.tsx     # Phase 2 slideshow with animated reveals
│   ├── RequestBanner.tsx         # Join request UI
│   ├── Toast.tsx                 # Toast notification system
│   ├── ConfirmDialog.tsx         # Confirmation dialog provider
│   └── LoadingSpinner.tsx        # Loading indicator
├── convex/                        # Real-time backend functions
│   ├── schema.ts                 # 10-table database schema
│   ├── rooms.ts                  # Room management
│   ├── users.ts                  # User join/lookup
│   ├── groups.ts                 # Group formation, questions, answers
│   ├── questions.ts              # Question bank management
│   ├── games.ts                  # Phase 2 game generation & voting
│   ├── crons.ts                  # Cleanup jobs
│   └── testData.ts               # Test data generators
└── lib/                           # Pure utilities
    ├── userStateMachine.ts       # XState state machine (8 states)
    └── avatars.ts                # 200+ emoji avatars
```

### Key Directories

- **`app/`**: All Next.js App Router routes (user, host, projector views) plus shared providers. Colocate route-specific components under their route folder to keep data dependencies obvious.
- **`components/`**: Reusable UI components. Keep them presentation-focused and export with named exports for tree-shaking.
- **`convex/`**: Real-time backend functions. Mutations and queries should remain side-effect free beyond Convex writes.
- **`lib/`**: Pure utilities. Treat files here as framework-agnostic business logic that can be unit tested in isolation.

## Development Commands

```bash
# Start Convex backend (REQUIRED - run first)
npx convex dev

# Start Next.js frontend (in separate terminal)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint

# Clear database (dev only)
npm run clear-db

# Deploy Convex functions to production
npm run deploy:convex

# Deploy both Convex and Next.js
npm run deploy:prod
```

### Development Workflow

1. **Always start Convex first**: Run `npx convex dev` before starting the Next.js dev server
2. **Separate terminals**: Keep Convex and Next.js running in separate terminal windows
3. **Environment setup**: Convex dev will create `.env.local` automatically on first run
4. **Database seeding**: Questions are auto-seeded on first room creation

## Coding Style & Conventions

### TypeScript
- **Strict mode enabled** (`tsconfig.json`): Prefer explicit types on public APIs, let inference handle internals
- Use 2-space indentation
- Naming conventions:
  - `PascalCase` for React components and XState machines
  - `camelCase` for functions, variables, and helpers
  - `UPPER_SNAKE_CASE` for environment variables

### React & Next.js
- Use Next.js 14 App Router conventions
- Colocate route-specific components with their routes
- Use named exports for components (better for tree-shaking)
- Keep components focused and single-purpose

### Styling
- **Tailwind CSS**: Use utility classes for styling
- Co-locate UI logic with Tailwind utility classes
- Extract shared styling tokens into `tailwind.config.ts` instead of duplicating class strings
- Support both light and dark mode

### Convex Backend
- Keep functions pure and deterministic
- Validate arguments with `convex/values` schemas
- Surface errors via thrown Exceptions
- Mutations should only write to Convex (no external side effects)
- Use Convex's real-time subscriptions via `useQuery` hooks

## Architecture

### User State Machine (Phase 1)

The user flow follows an 8-state XState machine (`lib/userStateMachine.ts`):

1. `not_joined` - Initial state before joining a room
2. `browsing` - Display unique 2-digit code, browse available users to join
3. `waiting_for_acceptance` - Sent join request, waiting for response
4. `question_active` - In group, all members see same A/B question and submit their choice
5. `session_locked` - Phase 1 ended, waiting for Phase 2 to start
6. `phase2_voting` - User can vote on slideshow question
7. `phase2_waiting` - Waiting for reveal animation
8. `phase2_reveal` - Viewing revealed percentages

### Data Model

**Key Tables** (10 total in `convex/schema.ts`):
- `rooms` - Room sessions with Phase 1/2 state
- `users` - User identities with avatars, 2-digit codes, status
- `groups` - 2-4 member groups with current question
- `questions` - "Would you rather?" question bank (35 seeded)
- `answers` - Phase 1 responses (A/B choices)
- `groupRequests` - Temporary join requests (30s TTL)
- `games` - Phase 2 game sessions
- `gameRounds` - Individual slideshow slides
- `votes` - Phase 2 user votes
- `scores` - Phase 2 leaderboard rankings

### Identity System
- Users select emoji avatar from 3 random choices (200+ available)
- Each user gets unique 2-digit code (10-99) per room
- Anonymous by design - no names required
- Avatars + codes provide visual identity

### Group Formation
- Request/accept flow for joining groups
- Groups of 2-4 members (configurable per room, default 4)
- Spam prevention with exponential backoff (1s → 2s → 4s → 8s → 16s)
- Requests expire after 30 seconds
- Mutual requests are auto-accepted

### Question System
- "Would you rather?" format with A/B options
- All group members receive the same question
- 35 pre-seeded questions across categories
- Rotation tracking to avoid last 3 questions per user
- Follow-up prompts to seed conversations

## Testing Guidelines

- **No automated test harness**: Project currently has no automated tests
- Add focused unit tests when touching pure modules (e.g., `lib/userStateMachine.ts`)
- Use `convex/testData.ts` mutations to spin up seeded rooms for manual QA
- Keep demo codes consistent (e.g., room code `TEST`, PIN `1234`)
- Before merging, manually test through user/host/projector flows to confirm:
  - Real-time syncing
  - Pairing rules
  - Question cycling
  - Phase transitions

## Common Tasks

### Adding New Features

1. **Frontend changes**: Update components in `app/` or `components/`
2. **Backend changes**: Add/modify Convex functions in `convex/`
3. **Schema changes**: Update `convex/schema.ts` and run `npx convex dev` to apply
4. **State machine changes**: Modify `lib/userStateMachine.ts`
5. **Test manually**: Use multiple browser windows to simulate different users

### Modifying Database Schema

1. Update `convex/schema.ts`
2. Convex will automatically handle migrations
3. Test with `npm run clear-db` to reset local data
4. Document breaking changes in PR

### Adding Questions

- Questions are seeded in `convex/questions.ts`
- Format: A/B options with follow-up prompts
- Host can manage via Convex dashboard (no UI yet)

## Known Issues

1. **Question rotation bug**: Only tracks last 3 questions for users in `user1` slot of groups, not `user2-4` slots (see GITHUB_ISSUES.md)
2. **Slideshow preview bug**: `showPercentages` state not reset when switching rounds in host preview mode

## Security & Configuration

- **Never commit `.env.local`**: Contains Convex deployment URLs and secrets
- Use `.env.example` as template
- Rotate classroom PINs when demoing publicly
- Avoid hard-coding codes outside test helpers
- Redact student names/codes in logs and screenshots (FERPA compliance)

## Deployment

### Important: Deploy Convex and Next.js Separately

1. **Deploy Convex first**: `npm run deploy:convex`
2. **Set Vercel environment variables**: `NEXT_PUBLIC_CONVEX_URL` with production URL
3. **Deploy Next.js**: Push to main branch or manual deploy from Vercel

Common deployment errors usually mean:
- Forgot to run `npm run deploy:convex` after backend changes
- Vercel env var points to dev URL instead of prod URL

## Pull Request Guidelines

- Use imperative, feature-focused commit style (e.g., "Add dark mode theme system")
- Start with capitalized verb, keep to ~72 characters
- PR description should include:
  - Motivation for changes
  - Screenshots or clips for UI tweaks
  - Relevant routes/files touched
  - Data reset steps if needed (e.g., "run `npm run clear-db`")
  - Manual test scenarios executed
- Link related issues
- Call out Convex schema changes explicitly

## UX Requirements

- **Big tap targets, minimal text**: One action per screen
- **Motion over text**: Use animations and visual feedback over instructions
- **Accessibility**: High contrast, dark mode support, readable at arm's length
- **Loading states**: Show spinners and feedback for all async operations
- **Error handling**: Use toast notifications for all error conditions
- **Mobile-first**: Responsive design optimized for phones

## Additional Resources

- See `CLAUDE.md` for detailed architecture documentation
- See `AGENTS.md` for repository guidelines
- See `README.md` for user-facing documentation
- See `GITHUB_ISSUES.md` for tracked known issues
