# Quick Start Guide

Follow these steps to get Ice running locally:

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set up Convex (Required!)

Convex needs to be initialized before you can run the app. This generates the necessary TypeScript types and connects to the backend.

```bash
npx convex dev
```

**What will happen:**
1. You'll be prompted to log in to Convex (or create a free account)
2. Convex will create a new project
3. A `.env.local` file will be created with your deployment URL
4. The Convex dev server will start running
5. TypeScript types will be generated in `convex/_generated/`

**Keep this terminal open** - Convex needs to keep running!

## Step 3: Start the Next.js Dev Server

Open a **new terminal** and run:

```bash
npm run dev
```

## Step 4: Open the App

- Landing page: http://localhost:3000
- Teacher view: http://localhost:3000/teacher
- Projector view: http://localhost:3000/projector

## Testing the Flow

### As a Teacher:
1. Go to http://localhost:3000 and click "Create new session"
2. Click "Create New Class"
3. Enter a name (e.g., "Test Class") and duration (e.g., 10 minutes)
4. **Save the 4-digit class code** (e.g., "1234")
5. **Save the 4-digit PIN** (e.g., "5678")
6. Click "Start Phase 1"

### As a Student:
1. Open http://localhost:3000 in two different browser tabs (or devices)
2. In each tab:
   - Enter the 4-digit class code using the keypad (e.g., "1234")
   - Enter your name when prompted (e.g., "Alice" and "Bob")
3. Each student will get a 2-digit code (e.g., Alice gets "42", Bob gets "73")
4. Alice enters "73", Bob enters "42"
5. Both students will be paired and see the same question
6. Both submit numeric answers
7. Screens dim for the talking phase
8. Click "Done Talking" → "Meet Someone New"

### Projector Display:
1. Go to http://localhost:3000/projector
2. Enter the 4-digit class code using the keypad
3. Watch live stats update as students pair and complete conversations

## Troubleshooting

### "Module not found: Can't resolve '@/convex/_generated/api'"
- This means Convex hasn't been initialized yet
- Run `npx convex dev` first and wait for it to complete
- The build will fail until Convex generates the types

### "Class not found" error when joining
- Make sure the teacher has started Phase 1
- Double-check the class code

### Changes to Convex schema not updating
- The Convex dev server should auto-detect changes
- If not, stop and restart `npx convex dev`

### Students can't pair
- Both students must enter each other's code
- Make sure both students have joined the same class

## Next Steps

- Try pairing multiple times to see different questions
- Check the Convex dashboard: `npx convex dashboard`
- Explore the real-time updates on the projector view
- Add more questions in `convex/questions.ts`

## Development Tips

**Two terminals required:**
```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: Next.js frontend
npm run dev
```

**To reset everything:**
1. Stop both servers
2. Delete the Convex deployment from the Convex dashboard
3. Run `npx convex dev` to create a fresh deployment
