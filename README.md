# Ice - Classroom Icebreaker

A low-friction, face-to-face icebreaker application for classrooms. Users form groups of 2-4 using a request/accept system, answer "Would you rather?" questions, and have real conversations while devices fade into the background.

## Features

### Phase 1 (Group Formation) ✅ Complete
- **Avatar Identity**: Users select emoji avatars and get unique 2-digit codes (10-99)
- **Group Formation**: Request/accept system for 2-4 member groups with spam prevention
- **Question System**: Groups receive the same A/B "Would you rather?" question
- **Self-paced**: Groups complete conversations at their own pace
- **State Machine**: 8-state XState flow with session persistence
- **Host Dashboard**: Create rooms, start/stop Phase 1, adjust time, view live stats
- **Projector Display**: Large-screen real-time view of room activity
- **Dark Mode**: Full dark mode support across all pages

### Phase 2 (Slideshow Game) ✅ Complete
- **Auto-generation**: Creates slideshow from Phase 1 data (≥60% response threshold)
- **Animated Reveals**: 6-second race effect showing percentage breakdowns
- **Optional Voting**: Users can vote on which option they think was more popular
- **Leaderboard**: Top-5 scoring users at game end
- **Manual Navigation**: Host controls forward/backward through slides

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database and functions)
- **State Management**: XState (user flow state machine)
- **Animations**: Framer Motion
- **UI Libraries**: canvas-confetti

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Convex account (free tier works great)

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Set up Convex**:
```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex (or create an account)
- Create a new Convex project
- Generate a `.env.local` file with your deployment URL
- Start the Convex development server

3. **Run the development server**:

In a separate terminal:
```bash
npm run dev
```

4. **Open your browser**:
- Landing page: http://localhost:3000
- Host view: http://localhost:3000/host
- User view: http://localhost:3000/user
- Projector view: http://localhost:3000/projector

## Usage

### For Hosts (Teachers)

1. Go to http://localhost:3000/host
2. Click "Create New Room"
3. Enter room name and configure max group size (2-4 members, default 4)
4. Share the **4-letter room code** (e.g., "ABCD") with users
5. Save your **4-digit PIN** (needed to control the room)
6. Click "Start Phase 1" when ready
7. Monitor active groups and completed conversations in real-time
8. After Phase 1 ends, preview and start the Phase 2 slideshow game

### For Users (Students)

1. Go to http://localhost:3000 (landing page)
2. Enter the 4-letter room code (e.g., "ABCD")
3. Select an emoji avatar from 3 options
4. You'll receive a unique **2-digit code** (e.g., "42")
5. Browse available users and send a join request to someone
6. Wait for acceptance or accept incoming requests
7. Answer the "Would you rather?" A/B question with your group
8. Talk face-to-face about your answers
9. Click "Complete Group" when done to meet new people
10. After Phase 1 ends, optionally vote during the Phase 2 slideshow

### For Projector Display

1. Go to http://localhost:3000/projector
2. Enter the 4-letter room code (e.g., "ABCD")
3. Display shows:
   - **Phase 1**: Room name, status badges, countdown timer, user count, active/completed groups
   - **Phase 2**: Synchronized slideshow with animated percentage reveals

## Project Structure

```
ice/
├── app/
│   ├── page.tsx              # Landing page with 4-letter code entry
│   ├── user/page.tsx         # User view with 8-state XState flow
│   ├── host/page.tsx         # Host dashboard with Phase 1/2 controls
│   ├── projector/page.tsx    # Projector display (Phase 1 stats + Phase 2 slideshow)
│   └── ConvexClientProvider.tsx # Providers (Convex, Toast, ConfirmDialog)
├── components/
│   ├── Keypad.tsx            # Reusable 4-letter code entry
│   ├── SlideshowQuestion.tsx # Phase 2 slideshow with animated reveals
│   ├── RequestBanner.tsx     # Join request UI
│   ├── Toast.tsx             # Toast notification system
│   ├── ConfirmDialog.tsx     # Confirmation dialog provider
│   └── LoadingSpinner.tsx    # Loading indicator
├── convex/
│   ├── schema.ts             # 10-table database schema
│   ├── rooms.ts              # Room management
│   ├── users.ts              # User join/lookup
│   ├── groups.ts             # Group formation, questions, answers
│   ├── questions.ts          # Question bank management
│   ├── games.ts              # Phase 2 game generation & voting
│   ├── crons.ts              # Cleanup jobs
│   └── testData.ts           # Test data generators
└── lib/
    ├── userStateMachine.ts   # XState state machine (8 states)
    └── avatars.ts            # 200+ emoji avatars
```

## Key Design Decisions

### Simplified Entry Flow
- **Landing page**: Minimal 4-letter code entry (uppercase letters)
- **Auto-advance**: Automatically navigates when 4 letters are entered
- **No buttons**: One-tap entry reduces friction

### Group Formation
- **Request/accept system**: Browse available users and send join requests
- **Flexible group sizes**: 2-4 members (configurable per room, default 4)
- **Spam prevention**: Exponential backoff (1s → 2s → 4s → 8s → 16s) between requests
- **Mutual requests**: If two users request each other, auto-accepted
- **Request expiration**: 30-second timeout on pending requests

### Avatar Identity
- **Emoji-based**: 200+ emoji avatars for playful, anonymous identity
- **Random selection**: Users pick from 3 randomly presented options
- **2-digit codes**: Each user gets unique code (10-99) for easy identification

### Question System
- **"Would you rather?" format**: A/B choice questions for easy answering
- **Same question per group**: All group members see the same question
- **Rotation tracking**: Avoids last 3 questions per user to prevent repeats
- **35 pre-seeded questions**: Across multiple categories
- **Follow-up prompts**: Seed face-to-face conversations

### State Machine
User flow: `not_joined` → `browsing` → `waiting_for_acceptance` → `question_active` → `session_locked` → Phase 2 states

### Real-time Sync
Convex handles all real-time updates automatically:
- Group requests and acceptances
- Question delivery
- Answer submissions
- Room stats
- Phase 1/2 transitions
- Slideshow synchronization

## Sample Questions

The app comes pre-seeded with 35 "Would you rather?" questions:
- Would you rather have the ability to fly OR be invisible?
- Would you rather explore space OR the deep ocean?
- Would you rather read minds OR see the future?
- Would you rather live in the mountains OR by the beach?
- Would you rather have more time OR more money?
- And 30 more...

Hosts can manage questions through the Convex dashboard.

## Development Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npx convex dev       # Start Convex dev server
npx convex dashboard # Open Convex dashboard
```

## Deployment to Production

### Important: Convex and Next.js Deploy Separately!

When deploying to production (e.g., Vercel), you need to deploy both your Convex backend and Next.js frontend:

**1. Deploy Convex Functions First:**
```bash
npm run deploy:convex
# or manually: npx convex deploy --yes
```

This pushes your Convex functions to your production Convex deployment. Your production Convex URL will be something like `https://your-deployment.convex.cloud`.

**2. Set Environment Variables in Vercel:**
- Go to your Vercel project → Settings → Environment Variables
- Add `NEXT_PUBLIC_CONVEX_URL` with your **production** Convex URL (not the dev URL!)
- Make sure it's enabled for the **Production** environment

**3. Deploy Next.js to Vercel:**
- Push to your main branch (if auto-deploy is enabled), or
- Manually trigger a deployment from the Vercel dashboard

**Common Deployment Issue:**
If you get errors like `[CONVEX Q(functionName)] Server Error`, it usually means:
- You forgot to run `npm run deploy:convex` after making changes to Convex functions
- Your Vercel environment variable is pointing to the dev URL instead of prod URL

**Quick Deploy Script:**
```bash
npm run deploy:prod  # Deploys Convex, then builds Next.js
```

## Closing the App for Production

You can temporarily close public access to the app (e.g., between class sessions) while maintaining access for yourself as a developer.

### Environment Variables

Add these to your Vercel project → Settings → Environment Variables:

- **`APP_CLOSED`** - Set to `"true"` or `"1"` to close the app, or `"false"` (or leave unset) to open it
- **`APP_BYPASS_SECRET`** (optional) - A secret token that allows you to bypass the closed state

### How It Works

**When `APP_CLOSED="true"`:**
- All public routes show a "We'll be back soon" page
- The app is completely inaccessible to the public
- Next.js assets and the closed page itself are still served

**When `APP_CLOSED="false"` or unset:**
- The app behaves normally
- No blocking or redirection occurs

**Bypass Access (when `APP_BYPASS_SECRET` is set):**
- Visit `https://your-app.vercel.app/bypass?token=YOUR_SECRET`
- This sets a bypass cookie that lasts 7 days
- You'll be redirected to the home page and can use the app normally
- All subsequent navigation works as if the app is open

### Usage Examples

**To close the app:**
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Set `APP_CLOSED` to `"true"`
3. Redeploy (or wait for auto-redeploy if enabled)

**To re-open the app:**
1. Set `APP_CLOSED` to `"false"` or remove the variable
2. Redeploy

**To access the app while it's closed:**
1. Set `APP_BYPASS_SECRET` to a secret value (e.g., `"my-secret-123"`)
2. Redeploy
3. Visit `https://your-app.vercel.app/bypass?token=my-secret-123`
4. You'll be able to use the app normally for 7 days

**Security Note:** The bypass mechanism is intentionally simple and not cryptographically secure. It's designed to keep casual users out, not to provide high-security access control. Don't rely on it for sensitive data protection.

## Future Enhancements

- **Question Management UI**: Host interface to add/edit/disable questions in-app
- **QR Code Joining**: Scan code instead of typing 4 letters
- **Advanced Analytics**: Export CSV of aggregates, category breakdowns
- **Multi-session Support**: Track rooms over time with history
- **Custom Branding**: Configurable themes and room backgrounds
- **Mobile App**: Native iOS/Android apps for better performance

## Troubleshooting

### Convex not connecting
- Ensure `npx convex dev` is running in a separate terminal
- Check that `.env.local` has `NEXT_PUBLIC_CONVEX_URL` set
- Restart the Next.js dev server after Convex initialization

### Users can't join
- Verify Phase 1 is "Active" in host dashboard
- Check that room code is entered correctly (4 letters, uppercase)
- Ensure Convex dev server is running
- Check that room hasn't expired (48-hour TTL)

### Group formation not working
- User must send request and wait for acceptance
- Can't request to join full groups (check maxGroupSize setting)
- Spam prevention may be active (exponential backoff between requests)
- Requests expire after 30 seconds

### Phase 2 not generating
- Ensure Phase 1 had sufficient participation (≥60% response rate per question)
- Game is auto-generated when Phase 1 stops
- Check Convex dashboard logs for any errors

## License

MIT

## Contributing

This is an MVP implementation. Contributions welcome for Phase 2 features, improved UX, and bug fixes!
