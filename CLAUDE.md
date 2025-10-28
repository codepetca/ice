# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Ice" is a low-friction, face-to-face classroom icebreaker application with two phases:
1. **Phase 1 (Connection/Handshake)**: Students pair up using 2-digit codes, answer shared questions about themselves, and have face-to-face conversations
2. **Phase 2 (Summary Game)**: Class-wide A/B quiz game using aggregated data from Phase 1

The design emphasizes minimal device interaction—devices act as prompts, not distractions.

## Architecture

### Core State Machine (Phase 1)

Student clients follow this state flow:
1. `waiting_for_partner` - Display unique 2-digit code, accept partner code entry
2. `paired_intro` - Brief (1-2s) confirmation when both sides mutually enter codes
3. `question_active` - Both partners see same question, submit their own numeric answer
4. `talking_phase` - Screen dims, shows conversation prompt for 30-45s
5. `wrap_up` - Brief success animation
6. `return_to_handshake` - Ready to pair with someone new
7. `session_locked` - Phase 1 ended, transition to Phase 2

### Pairing System

- Each student gets a unique 2-digit code (10-99) per class
- Pairing requires mutual acknowledgement: both enter each other's code
- Unique pair key format: `min(codeA,codeB)-max(codeA,codeB)`
- Prevent duplicate pairs during Phase 1 (show "Already met" message)
- Throttle new pair attempts to ≥3s

### Question Delivery

- Both partners in a pair receive the **same question**
- Track last N questions (e.g., 3) per student to avoid repeats
- Balance across categories (round-robin or weighted)
- Questions have numeric answers with optional range hints and units
- Include follow-up prompts to seed conversation

### Data Model

Each answer stores:
```json
{
  "classId": "...",
  "pairId": "...",
  "questionId": "...",
  "playerId": "...",
  "value": 6.0,
  "skipped": false,
  "timestamp": 1730150400
}
```

**Privacy**: Store raw numeric values but only display aggregates publicly, never per-student data.

### Phase 2 (Summary Game)

- Generate A/B questions from Phase 1 data (e.g., "What % reported < 7 hours sleep?")
- Choices: **A) ≥ 50%** vs **B) < 50%**
- Only use questions with sufficient responses (≥60% of class)
- Prefer predicates near 50% for suspense
- Live vote bars on projector + phones
- Reveal actual percentage after voting
- Optional soft leaderboard (top 5 only)

## Backend API Contract Examples

The spec suggests these endpoints (implementation likely uses Convex for live subscriptions):

- `POST /join { name, classId }` → `{ code }`
- `POST /pair { myCode, partnerCode }` → `{ pairId, question }`
- `POST /answer { pairId, value }` → `200`
- `GET /summary/{classId}` → aggregates for Phase 2
- `POST /game/start { classId, mode }` → `{ gameId }`
- `POST /game/vote { gameId, roundId, choice }` → `200`
- `POST /game/advance { gameId }` → next phase/round

## UX Requirements

- **Big tap targets, minimal text**: One action per screen
- **Motion over text**: Use haptics/flashes instead of long instructions
- **Accessibility**: High contrast, non-color cues, readable at arm's length
- **Timing**: Phase 1 duration configurable (8-12 min), talking phase 30-45s
- **Auto-advancement**: Minimize manual taps between states

## Admin/Teacher Controls

- Start/Stop Phase 1 with configurable total time
- Toggle question categories, enable/disable prompts
- Launch Phase 2 with round count and timer settings
- Projector view: progress, vote bars, reveals, leaderboard

## Edge Cases to Handle

- Invalid partner codes
- Self-pairing attempts
- Duplicate pair attempts (already met)
- Outlier numeric values (clamp in analysis only)
- Insufficient responses for Phase 2 question generation
- Network interruptions during live phases

## Current Implementation Status

**Phase 1 (MVP)**: ✅ Complete
- Next.js 14 with App Router and TypeScript
- Convex backend with real-time subscriptions
- XState state machine for student flow (lib/studentStateMachine.ts)
- Three main views: /student, /teacher, /projector
- 10 pre-seeded sample questions

**Phase 2 (Summary Game)**: ⏳ Not yet implemented

## Key Files

### Frontend
- `app/page.tsx` - Landing page with 4-digit code entry and keypad
- `app/student/page.tsx` - Student view with 6-state flow, uses XState machine
- `app/teacher/page.tsx` - Teacher dashboard for class management
- `app/projector/page.tsx` - Large-screen display for classroom
- `app/ConvexClientProvider.tsx` - Convex React provider wrapper
- `components/Keypad.tsx` - Reusable numeric keypad component
- `lib/studentStateMachine.ts` - XState state machine definition

### Backend (Convex)
- `convex/schema.ts` - Database schema (classes, students, pairs, questions, answers, pairRequests)
- `convex/classes.ts` - Class CRUD, start/stop Phase 1, stats queries
- `convex/students.ts` - Student join, code generation, lookups
- `convex/pairing.ts` - Core pairing logic with mutual acknowledgement
- `convex/questions.ts` - Question queries and seed function

## Development Commands

```bash
# Start Convex backend (required, run first)
npx convex dev

# Start Next.js frontend (in separate terminal)
npm run dev

# Open Convex dashboard
npx convex dashboard

# Seed questions (called automatically on first class creation)
# Manual: convex dashboard → questions.seedQuestions
```

## Implementation Notes

- **Class codes**: Changed from 6 digits to 4 digits for easier entry
- **Landing page**: Minimal design with numeric keypad, auto-advances on 4-digit entry
- **Keypad component**: Reusable across landing and projector pages
- Convex handles all real-time subscriptions automatically via useQuery hooks
- Student codes are generated randomly (10-99) with uniqueness checks
- Pair requests use a temporary table to track pending connections
- XState machine runs client-side, syncs with Convex for pair state
- Animations use Framer Motion, confetti via canvas-confetti
- PIN-based teacher auth (no full authentication system)
- Questions seeded on first class creation via seedQuestions mutation
