# GitHub Issues To File

> Temporarily tracking requested issues in-repo because the GitHub API is unavailable in this environment. Please copy these into GitHub Issues when convenient.

## 1. Question rotation ignores user2–user4 history
- **Location**: `convex/groups.ts` `selectQuestion`
- **Problem**: Recent question filtering only inspects the last three groups where a student occupied the `user1Id` slot, so users who joined groups as `user2Id`–`user4Id` can see the same prompt repeatedly in a short window.
- **Impact**: Repeats lower the quality of icebreaker prompts and contradict the design requirement to avoid the last 3 questions per student.
- **Proposal**: Track recent question IDs per user regardless of slot—either by querying indexes per slot, normalizing participation history into a dedicated table, or storing a short queue on each user document.

## 2. Slideshow preview shows stale percentages
- **Location**: `components/SlideshowQuestion.tsx`
- **Problem**: `showPercentages` is initialized from `isRevealed` and never reset when switching to a new round while `isPreview` is true. After revealing one round, subsequent previews still display the old percentages immediately, and `onRevealComplete` can execute during previews.
- **Impact**: Admin and projector previews can reveal results before a round is supposed to run, and reveal bookkeeping (`revealRound`) may fire unintentionally.
- **Proposal**: Reset `showPercentages` whenever `roundNumber` changes or `isRevealed` transitions to `false`, and guard `onRevealComplete` so it only fires after a genuine reveal animation.
