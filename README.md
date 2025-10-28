# Ice - Classroom Icebreaker

A low-friction, face-to-face icebreaker application for classrooms. Students pair up using 2-digit codes, answer questions about themselves, and have real conversations while devices fade into the background.

## Features

### Phase 1 (MVP - Current Implementation)
- **Student Pairing**: Students get unique 2-digit codes and connect with mutual acknowledgement
- **Question System**: Paired students receive the same numeric question and share answers
- **Talking Phase**: Screens dim to encourage face-to-face conversation
- **State Machine**: 6-state flow from pairing → question → talking → wrap-up → repeat
- **Teacher Dashboard**: Create classes, start/stop sessions, view live stats
- **Projector Display**: Large-screen real-time view of class activity

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database and functions)
- **State Management**: XState (student flow state machine)
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
- Teacher view: http://localhost:3000/teacher
- Projector view: http://localhost:3000/projector

## Usage

### For Teachers

1. Go to http://localhost:3000 and click "Create new session"
2. Enter class name and duration (e.g., 10 minutes)
3. Share the **4-digit class code** with students
4. Save your **4-digit PIN** (needed to control the class)
5. Click "Start Phase 1" when ready
6. Monitor active pairs and completed conversations in real-time

### For Students

1. Go to http://localhost:3000 (landing page)
2. Enter the 4-digit class code using the keypad
3. Enter your name when prompted
4. You'll receive a unique **2-digit code** (e.g., "42")
5. Find a partner and exchange codes
6. Enter your partner's code
7. Both students answer the question that appears
7. Talk face-to-face about your answers
8. Click "Done Talking" → "Meet Someone New" to pair again

### For Projector Display

1. Go to http://localhost:3000/projector
2. Enter the 4-digit class code using the keypad
3. Display shows:
   - Class name and code
   - Active/Not Started status
   - Timer countdown (when active)
   - Number of students, active pairs, completed pairs

## Project Structure

```
ice/
├── app/
│   ├── page.tsx              # Landing page with 4-digit code entry
│   ├── student/page.tsx      # Student view with 6-state flow
│   ├── teacher/page.tsx      # Teacher dashboard
│   ├── projector/page.tsx    # Projector display
│   └── ConvexClientProvider.tsx
├── components/
│   └── Keypad.tsx            # Reusable numeric keypad
├── convex/
│   ├── schema.ts             # Database schema
│   ├── classes.ts            # Class management
│   ├── students.ts           # Student join/lookup
│   ├── pairing.ts            # Pairing logic & mutations
│   └── questions.ts          # Question management
└── lib/
    └── studentStateMachine.ts # XState state machine
```

## Key Design Decisions

### Simplified Entry Flow
- **Landing page**: Minimal 4-digit code entry with numeric keypad
- **Auto-advance**: Automatically navigates when 4 digits are entered
- **No buttons**: One-tap entry reduces friction

### Pairing System
- **Mutual acknowledgement**: Both students must enter each other's code
- **Duplicate prevention**: Students can't pair with the same person twice
- **Canonical pair key**: `min(code1, code2)-max(code1, code2)` ensures uniqueness

### Question Delivery
- Same question delivered to both students in a pair
- Avoids last 3 questions per student to prevent repeats
- 10 sample questions across categories (wellness, habits, hobbies, etc.)

### State Machine
Student flow: `waiting_for_partner` → `paired_intro` → `question_active` → `talking_phase` → `wrap_up` → repeat

### Real-time Sync
Convex handles all real-time updates automatically:
- Pairing requests
- Answer submissions
- Class stats
- Session locks

## Sample Questions

The app comes pre-seeded with 10 questions:
- How many hours did you sleep last night?
- How many minutes of screen time per day?
- How many cups of coffee/tea per day?
- How many books read in the past year?
- How many countries visited?
- And 5 more...

Teachers can manage questions through the Convex dashboard.

## Development Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npx convex dev       # Start Convex dev server
npx convex dashboard # Open Convex dashboard
```

## Future Enhancements (Phase 2)

- **Summary Game**: A/B voting game using aggregated data from Phase 1
- **Question Management UI**: Teacher interface to add/edit questions
- **QR Code Pairing**: Scan partner's code instead of typing
- **Advanced Analytics**: Export CSV of aggregates, category breakdowns
- **Multi-session Support**: Track classes over time

## Troubleshooting

### Convex not connecting
- Ensure `npx convex dev` is running in a separate terminal
- Check that `.env.local` has `NEXT_PUBLIC_CONVEX_URL` set
- Restart the Next.js dev server after Convex initialization

### Students can't join
- Verify Phase 1 is "Active" in teacher dashboard
- Check that class code is entered correctly (6 digits)
- Ensure Convex dev server is running

### Pairing not working
- Both students must enter each other's code
- Students can't pair with themselves
- Students can't pair with someone they've already met

## License

MIT

## Contributing

This is an MVP implementation. Contributions welcome for Phase 2 features, improved UX, and bug fixes!
