# ❄️ Ice / Icewyrm — New Group Name-Matching Gameplay

## 0. Tech Context

- **Frontend:** Next.js (App Router)
- **Backend / Realtime:** Convex
- **Hosting:** Vercel
- **Existing features to keep:**
  - Rooms + host control
  - Avatar selection on join
  - “Would you rather” question flow at the group level

This document describes changes to the gameplay loop and group logic.

---

## 1. High-Level Gameplay Loop

Each **game session in a room** consists of **5 rounds**.

Each **round** has two phases:

1. **Name Matching Phase**
2. **Would-You-Rather Phase** (already implemented; integrate with new group logic)

Each round has a **fixed duration** (initially 30 seconds; configurable constant). When the timer expires:

- All groups dissolve
- New groups form
- Next round begins

---

## 2. Player Join & Lobby Flow

When a player joins:

1. Select avatar (existing)
2. Enter display name (new)
3. Enter lobby until host starts game
4. Late joiners handled in Section 6

**Player data:**
- playerId
- roomId
- displayName
- avatarId
- connection status
- currentRoundIndex
- groupId
- name-matching state

---

## 3. Group Assignment & Rotation

### 3.1 Group Size
- Target: **3–4 players**
- Max: **4 players**

### 3.2 Round-Based Grouping
- On each round start:
  - Gather all active players
  - Form groups of 3–4
  - Assign `groupId`
  - Reset name-matching state

### 3.3 Reduce Repeat Pairings
- Track `(playerA, playerB) → count`
- Prefer groupings that minimize repeated pairs
- Heuristic:
  - Shuffle players
  - Build groups minimizing pair-history counts
  - Fall back to random if necessary

---

## 4. Name Matching Phase

### 4.1 UI
- Own avatar shown prominently
- Other group avatars shown below
- Each other avatar has a **dropdown** for choosing a name

### 4.2 Dropdown Contents
- Exactly **3 names** when possible:
  - Correct displayName
  - Two random decoys from the room
- Small rooms:
  - Use all available names
  - Duplicate names if needed

### 4.3 Objective
- Player must select a name for *each* other avatar
- Track:
  - `selectedNames`
  - `isCompletedNamePhase`

---

## 5. Name Matching Validation

### 5.1 Completion Condition
A group moves to next phase only when **all players**:
- Completed all selections
- All selections are **correct**

### 5.2 Validation
Triggered when:
- Last player submits
- Any player changes a selection

### 5.3 Wrong Answer Handling
If last player submits and someone is wrong:
- Reset only incorrect answers
- Mark them as incomplete
- Send error indicators to their UI

### 5.4 Progress Indicator
Shows how many group members have completed correctly.

---

## 6. Would-You-Rather Phase

When a group completes name matching:
- They enter WYR phase for remainder of timer
- Behavior is group-based, not room-wide
- If they never complete, they simply stay in name-matching until time expires

At round end:
- All groups dissolve
- Next round begins

---

## 7. Late Joiners

Late joiner = joins after game start.

Behavior:
- If enough late joiners (≥3), form a group immediately
- Otherwise, accumulate them in a temporary pool
- If <3, they wait until next round
- Late-join groups follow same phases

---

## 8. Host Controls

Host can:
- Start game
- Stop game

Host cannot:
- Change round length
- Manually reshuffle
- Pause timer

---

## 9. State & Data Model (Guidance)

**Room:**
- id
- hostId
- currentRoundIndex
- roundEndTime
- status
- pairHistory

**Player:**
- id
- roomId
- displayName
- avatarId
- connectionStatus
- currentGroupId
- isLateJoiner

**Group:**
- id
- roomId
- roundIndex
- playerIds[]
- phase
- nameChoicesByPlayer
- nameSelectionsByPlayer
- completedPlayers[]
- createdAt

Timer:
- Server timestamp
- Clients compute countdown from `roundEndTime`

---

## 10. UX / Edge Cases

- Disconnected players:
  - Treat as inactive
  - Group may never finish, but timer ends the round

- Very small rooms:
  - Allow 2-player groups if needed

---

End of spec.

