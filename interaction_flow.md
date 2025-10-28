# Meet & Reflect — Interaction Flow

A concise, implementation-ready flow for a low‑friction, face‑to‑face icebreaker with a class‑wide summary game.

---

## Goals
- Devices act as **prompts**, not distractions.
- **One quick code entry** + **one quick answer** per pairing.
- Encourage **talking** during each round.
- Collect numeric data for a **class quiz** at the end.

---

## Roles
- **Student**: Joins, pairs via 2‑digit code, answers their **own** question, talks, repeats.
- **Admin/Teacher**: Starts/stops Phase 1 timer, launches Phase 2 (summary game), displays projector view.

---

## Phases
1. **Phase 1 – Connection / Handshake** (pair → question → self‑answer → talk → wrap → repeat)
2. **Phase 2 – Summary Game** (percentage A/B rounds based on collected data)

---

## Phase 1 — State Machine

### States
1. `waiting_for_partner`
2. `paired_intro`
3. `question_active`
4. `talking_phase`
5. `wrap_up`
6. `return_to_handshake`
7. `session_locked` (when Phase 2 begins)

### Transitions & Events
- **Enter Partner Code** → `waiting_for_partner` → `paired_intro` when both sides have mutually entered valid codes.
- **Auto‑advance (1–2s)** → `question_active` (same question delivered to both).
- **Answer Submitted** (self value) → remain in `question_active` until both have submitted.
- **Both Submitted** → `talking_phase` (device fades UI; shows talking prompt + gentle timer).
- **Timer End or Done Tap** → `wrap_up` (brief success animation).
- **Auto‑return (≤1s)** → `return_to_handshake` (ready to pair again).
- **Admin stops Phase 1** → all clients go to `session_locked` (transition screen to Phase 2).

---

## Phase 1 — Screen Specs

### 1) Handshake / Pair
- **My Code**: big (e.g., “36”).
- **Partner Code Input**: large keypad; optional QR scan.
- **Status**: “Waiting for your partner to enter your code…”
- **Edge Cases**: invalid code, self‑code, duplicate pair (show "Already met—try someone new").

### 2) Paired Intro (1–2s)
- “You’re paired with **Jamie (42)**!”
- Quick haptic/flash; no inputs.

### 3) Question Active
- Giant prompt + emoji/graphic.
- **Self‑answer only** via big slider or numeric keypad.
- **Submit** auto‑advances when both have answered.

### 4) Talking Phase (20–60s)
- Screen dims; shows: “Share your answer + follow‑up: *[short question]*”.
- Subtle circular countdown; minimal UI.

### 5) Wrap‑up
- Brief confetti pulse; button: **Meet Someone New**.

---

## Question Delivery & Selection
- Same question sent to both partners.
- Avoid repeats per student (track last `N` seen per student, e.g., 3).
- Balance categories (round‑robin or weighted).
- Include optional **range hint** and **unit** (e.g., hours, minutes).

**Follow‑up**: Short, light prompt to seed conversation (e.g., “When did this start?” / “What’s your go‑to example?”).

---

## Data Captured (per answer)
```json
{
  "classId": "...",
  "pairId": "...",          // canonical: min(codeA, codeB)-max(codeA, codeB)
  "questionId": "...",
  "playerId": "...",
  "value": 6.0,
  "skipped": false,
  "timestamp": 1730150400
}
```
- Store **raw** numeric value; clamp outliers only in analysis.
- Do **not** display per‑student data publicly; use aggregates only.

---

## Pairing Logic (low friction)
- Each student gets a unique 2‑digit **code** (10–99) per class.
- Pair forms when **both** sides enter each other’s code (mutual acknowledgement).
- Unique pair key prevents duplicates during Phase 1.

**Edge Handling**
- If a duplicate pair is attempted: reopen the last question or show “Already met”.
- Throttle new pairs to ≥3s to prevent spam.

---

## Phase 1 — Timing
- Admin sets total **Phase 1 duration** (e.g., 8–12 min).
- Each round’s **talking phase** is ~30–45s (configurable) with a gentle timer.
- Clients automatically respect server time; when Phase 1 ends, they lock.

---

## Phase 2 — Summary Game (A/B 50‑50)

### Round Flow
1. **Prompt** (projector + phones): e.g., “What % of players reported **< 7 hours** of sleep last night?”
   - Choices: **A) ≥ 50%** vs **B) < 50%** (tie rule shown on screen)
2. **Vote Timer** (≈10–15s): phones show A/B; projector shows live vote bars.
3. **Reveal**: actual percentage (from Phase 1 data), highlight correct side, show #responses.
4. **Score**: +1 per correct vote; optional streak bonus. Show **soft leaderboard** (top 5 only).
5. **Advance**: 6–10 rounds total.

### Question Generation
- Build predicates from numeric questions: `== k`, `≥ k`, `≤ k` (configurable per question).
- Only include prompts with **sufficient responses** (e.g., ≥60% of class).
- Prefer predicates **near 50%** (most suspenseful).

---

## Teacher / Admin Controls
- Start/Stop Phase 1; set total time.
- Toggle question categories; enable/disable specific prompts.
- Launch Phase 2; choose round count and timer; select tie rule (e.g., ≥50 vs <50).
- Projector view: progress, vote bars, reveal, leaderboard.

---

## Minimal Backend Contracts (example)
- `POST /join { name, classId }` → `{ code }`
- `POST /pair { myCode, partnerCode }` → `{ pairId, question }`
- `POST /answer { pairId, value }` → `200`
- `GET  /summary/{classId}` → aggregates for Phase 2 generation
- `POST /game/start { classId, mode }` → `{ gameId }`
- `POST /game/vote { gameId, roundId, choice }` → `200`
- `POST /game/advance { gameId }` → next phase/round

*(With Convex, these become mutations/queries with live subscriptions.)*

---

## UX Principles
- Big tap targets; minimal text.
- One action per screen.
- Motion cues (haptic/flash) instead of long instructions.
- Accessibility: high contrast, non‑color cues, readable at arm’s length.

---

## Nice‑to‑Haves (later)
- QR pairing (scan partner code).
- Category themes (color/emoji).
- Export CSV of aggregates.
- Small‑team mode (2–3 students per node).
- Rounds mode in Phase 1 (short timed sprints).

