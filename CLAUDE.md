# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Ice" is a low-friction, face-to-face classroom icebreaker application with two phases:
1. **Phase 1 (Group Formation)**: Users form groups of 2-4 using a request/accept system, answer shared "Would you rather?" questions, and have face-to-face conversations
2. **Phase 2 (Slideshow Game)**: Class-wide interactive slideshow displaying aggregated data from Phase 1, with optional voting

The design emphasizes minimal device interaction—devices act as prompts, not distractions.

## Architecture

### Core State Machine (Phase 1)

User clients follow this state flow (see `lib/userStateMachine.ts`):
1. `not_joined` - Initial state before joining a room
2. `browsing` - Display unique 2-digit code, browse available users to join
3. `waiting_for_acceptance` - Sent join request, waiting for response
4. `question_active` - In group, all members see same A/B question and submit their choice
5. `session_locked` - Phase 1 ended, waiting for Phase 2 to start

**Phase 2 States:**
6. `phase2_voting` - User can vote on slideshow question
7. `phase2_waiting` - Waiting for reveal animation
8. `phase2_reveal` - Viewing revealed percentages
9. `phase2_complete` - Game ended, showing final results

**Note**: Original design included `talking_phase` and `wrap_up` states, but current implementation allows groups to complete at their own pace without enforced timing.

### Identity System

- Users select an emoji avatar from 3 random choices (200+ available emojis)
- Each user gets a unique 2-digit code (10-99) per room
- Anonymous by design - no names required
- Avatars + codes provide visual identity for joining requests

### Group Formation System

**Request/Accept Flow:**
- Users browse list of available users showing their avatars and current group sizes
- Send join request to any user (joins their group or creates new 2-person group)
- Requests expire after 30 seconds
- Target user can accept (adds to group) or reject
- **Mutual requests**: If two users request each other simultaneously, auto-accepted
- **Group sizes**: Configurable 2-4 members (default: 4), enforced during acceptance

**Spam Prevention:**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s between requests
- 3-second cooldown after canceling a request
- Can only send one request at a time
- Incoming requests queue up; users see most recent first

**Edge Cases Handled:**
- Group full during acceptance (request auto-rejected)
- Self-join attempts (prevented)
- Invalid user codes (validation)
- Network interruptions (request expiration)

### Question Delivery

- All group members receive the **same question** simultaneously
- "Would you rather?" format with two options (A and B)
- Each user submits their own choice independently
- Questions include follow-up prompts to seed conversation
- 35 pre-seeded questions across multiple categories
- **Rotation**: Deterministic daily shuffle, tracks last 3 questions per user to avoid repeats
- **Known Bug**: Currently only checks last 3 for users in the `user1` slot of groups (see GITHUB_ISSUES.md)

### Data Model

**Rooms** (formerly "classes"):
```typescript
{
  code: "ABCD",           // 4-letter room code
  pin: "1234",            // 4-digit host PIN
  name: "Room Name",
  phase1Active: true,
  phase1Duration: 600,    // seconds
  maxGroupSize: 4,        // 2-4 members
  expiresAt: timestamp    // 48-hour TTL
}
```

**Answers**:
```json
{
  "roomId": "...",
  "groupId": "...",
  "questionId": "...",
  "userId": "...",
  "choice": "A",          // "A" or "B"
  "skipped": false,
  "timestamp": 1730150400
}
```

**Privacy**: Store individual choices but only display aggregates publicly in Phase 2.

### Phase 2 (Slideshow Game)

**Auto-Generation:**
- Automatically created when Phase 1 ends
- Only includes questions with ≥60% response rate
- Each slide shows original question text + A/B options
- Displays percentage who chose each option

**Slideshow Features:**
- Manual navigation (host controls forward/backward)
- 6-second animated reveal with "race" effect
- Users can optionally vote on which option they think was more popular
- Voting is optional - users can just watch
- Score tracking with top-5 leaderboard at end
- Synchronized between projector and user devices

**UI Variants:**
- **Projector**: Large display for classroom (full-screen stats)
- **User**: Medium size on phones (with voting controls)
- **Host**: Compact admin view (with navigation controls)

## Backend Architecture (Convex)

### Database Schema (10 Tables)

1. **rooms** - Room sessions with Phase 1/2 state
2. **users** - User identities with avatars, codes, status
3. **groups** - 2-4 member groups with current question
4. **questions** - "Would you rather?" question bank (35 seeded)
5. **answers** - Phase 1 responses (A/B choices)
6. **groupRequests** - Temporary join requests (30s TTL)
7. **games** - Phase 2 game sessions
8. **gameRounds** - Individual slideshow slides
9. **votes** - Phase 2 user votes
10. **scores** - Phase 2 leaderboard rankings

### Key Backend Functions

**convex/rooms.ts**
- `createRoom` - Generate unique 4-letter code + PIN
- `startPhase1` / `stopPhase1` - Phase lifecycle with 15s winding down period
- `adjustPhase1Duration` - ±1 minute time adjustments
- `getRoomStats` - Active/completed group counts
- Auto-cleanup after 48 hours

**convex/users.ts**
- `joinRoom` - Create user with avatar + unique 2-digit code
- `rejoinRoom` - Restore session from localStorage
- `getAvailableUsers` - List users with group size info
- `removeUser` - Host can remove users

**convex/groups.ts** (most complex - 900+ lines)
- `sendGroupRequest` - Create request with spam prevention
- `acceptGroupRequest` - Join group or create new 2-person group
- `rejectGroupRequest` / `cancelGroupRequest` - Decline/cancel
- `submitAnswer` - Record A/B choice
- `completeGroup` - Mark done, reset all members to available
- `selectQuestion` - Deterministic shuffle with history tracking
- Auto-expire old requests (10s cron job)

**convex/games.ts**
- `generateGameInternal` - Auto-called after Phase 1 ends
- `startGame` - Begin slideshow (set currentRound=1)
- `submitVote` - Record user vote
- `revealRound` - Trigger percentage reveal
- `advanceRound` / `previousRound` - Navigation
- `endGame` - Calculate top-5 rankings

## UX Requirements

- **Big tap targets, minimal text**: One action per screen
- **Motion over text**: Animations and visual feedback over instructions
- **Accessibility**: High contrast, dark mode support, readable at arm's length
- **Timing**: Phase 1 duration configurable (default 10 min), groups self-pace conversation
- **Loading states**: Spinners and feedback for all async operations
- **Error handling**: Toast notifications for all error conditions
- **Mobile-first**: Responsive design optimized for phones

## Host Controls

- Create room with custom name and configurable max group size (2-4)
- Start/Stop Phase 1 with real-time countdown timer
- Adjust duration ±1 minute during active Phase 1
- View all users in room with removal capability
- 15-second winding down period before Phase 1 ends
- Auto-generate and preview Phase 2 slideshow
- Manual navigation through slideshow slides
- Dark mode toggle in settings
- Real-time join notifications

## Current Implementation Status

**Phase 1 (Group Formation)**: ✅ Complete
- Next.js 14 with App Router and TypeScript
- Convex backend with real-time subscriptions
- XState state machine for user flow (lib/userStateMachine.ts)
- Three main views: /user, /host, /projector
- 35 pre-seeded "Would you rather?" questions
- Avatar-based identity system (200+ emojis)
- Request/accept group formation (2-4 members)
- Spam prevention with exponential backoff
- Session persistence via localStorage
- Dark mode support

**Phase 2 (Slideshow Game)**: ✅ Complete
- Auto-generation from Phase 1 data (≥60% response threshold)
- Synchronized slideshow across all devices
- Animated reveal with 6-second race effect
- Optional user voting with score tracking
- Top-5 leaderboard at game end
- Manual navigation (forward/backward)
- Three UI variants (projector/user/host)

## Key Files

### Frontend
- `app/page.tsx` - Landing page with 4-letter room code entry
- `app/user/page.tsx` - User view with 8-state XState machine (1,173 lines)
- `app/host/page.tsx` - Host dashboard for room management (1,073 lines)
- `app/projector/page.tsx` - Large-screen classroom display (377 lines)
- `app/ConvexClientProvider.tsx` - Convex + Toast + ConfirmDialog providers
- `components/Keypad.tsx` - Reusable 4-letter code entry component
- `components/SlideshowQuestion.tsx` - Phase 2 slideshow with 3 variants
- `components/RequestBanner.tsx` - Join request UI (intrusive/subtle modes)
- `components/Toast.tsx` - Toast notification system
- `components/ConfirmDialog.tsx` - Confirmation dialog provider
- `lib/userStateMachine.ts` - XState state machine (8 states + context)
- `lib/avatars.ts` - 200+ emoji avatars with randomization

### Backend (Convex)
- `convex/schema.ts` - 10-table database schema
- `convex/rooms.ts` - Room lifecycle, Phase 1 controls (315 lines)
- `convex/users.ts` - User management, code generation (284 lines)
- `convex/groups.ts` - Group formation, questions, answers (903 lines)
- `convex/questions.ts` - Question bank, seeding (346 lines)
- `convex/games.ts` - Phase 2 generation, voting, scoring (652 lines)
- `convex/crons.ts` - Cleanup jobs (expired requests, old rooms)
- `convex/testData.ts` - Test data generators for development

## Development Commands

```bash
# Start Convex backend (required, run first)
npx convex dev

# Start Next.js frontend (in separate terminal)
npm run dev

# Open Convex dashboard
npx convex dashboard

# Generate test room with 20 users
# Convex dashboard → testData.generateTestRoom

# Clean up all data except questions
# Convex dashboard → testData.cleanupAllData
```

## Implementation Notes

### Terminology
- **"Users"** (not "students") - More flexible than educational context
- **"Host"** (not "teacher") - Room creator/manager role
- Routes: `/user`, `/host`, `/projector` (formerly /student, /teacher, /projector)
- Database: `rooms`, `users`, `groups` (formerly classes, students, pairs)

### Key Design Decisions
- **4-letter room codes** (not 6-digit) - Uppercase letters, easier to read aloud
- **Avatar-based identity** (not names) - More playful, anonymous
- **Request/accept groups** (not mutual code entry) - More flexible for 2-4 members
- **No enforced talking phase** - Groups complete at their own pace
- **Optional Phase 2 voting** - Users can just watch slideshow
- **Dark mode** - Supported across all pages with localStorage persistence
- **Session persistence** - Users can refresh page without losing state

### Technical Details
- Convex handles all real-time subscriptions via useQuery hooks
- User codes randomly generated (10-99) with collision detection
- Group requests use temporary table with 30-second expiration
- XState machine runs client-side, syncs with Convex for server state
- Animations use Framer Motion, confetti via canvas-confetti
- PIN-based host auth (4-digit, stored in localStorage, no encryption)
- Questions seeded automatically on first room creation
- Room cleanup cron runs daily at 3 AM UTC (48-hour TTL)
- Request cleanup cron runs every 10 seconds

### Known Issues
- **Question rotation bug**: Only tracks last 3 questions for users in `user1` slot of groups, not `user2-4` slots (see GITHUB_ISSUES.md)
- **Slideshow preview bug**: `showPercentages` state not reset when switching rounds in host preview mode

### Dependencies
- Next.js 14.2.0 (App Router)
- React 18.3.0
- Convex 1.28.2 (real-time backend)
- XState 5.18.0 (state machine)
- Framer Motion 11.5.0 (animations)
- Tailwind CSS 3.4.0 (styling)
- TypeScript 5.0.0 (strict mode)
- canvas-confetti 1.9.0 (celebrations)
- lucide-react 0.552.0 (icons)
