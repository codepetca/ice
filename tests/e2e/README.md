# E2E Testing for Icewyrm

This directory contains end-to-end tests using Playwright that simulate real multiplayer scenarios.

## Overview

The E2E tests verify the complete user flow from room creation through group formation and gameplay. Tests use isolated browser contexts to simulate multiple concurrent users.

## Running Tests

### Prerequisites

1. **Start Convex dev server:**
   ```bash
   npx convex dev
   ```

2. **Start Next.js dev server:**
   ```bash
   npm run dev
   ```

3. **Run tests** (in a separate terminal):
   ```bash
   npm run test:e2e          # Headless mode
   npm run test:e2e:ui       # Interactive UI mode
   npm run test:e2e:headed   # See browser windows
   npm run test:e2e:debug    # Step-by-step debugging
   ```

## Test Structure

### Files

- **`helpers.ts`**: Reusable helper functions for common E2E actions
- **`multiplayer.spec.ts`**: Main test suite covering multiplayer scenarios
- **`smoke.spec.ts`**: Basic smoke tests to verify setup

### Test Coverage

#### Implemented Tests

1. **Happy Path** (`multiplayer.spec.ts`)
   - Host creates room
   - 4 players join using room code
   - Players select avatars and auto-join
   - All players reach browsing state
   - Host starts game
   - Verifies Phase 1 is active

2. **Room Capacity Limit** (`multiplayer.spec.ts`)
   - Creates room with 35 players (max capacity)
   - Attempts to add 36th player
   - Verifies error toast: "Room is full (max 35 players)"

3. **Late Joiner** (`multiplayer.spec.ts`)
   - Host creates room with 2 initial players
   - Host starts game
   - 3rd player joins after game start
   - Verifies late joiner can reach browsing state

4. **Avatar Uniqueness** (`multiplayer.spec.ts`)
   - Verifies system provides 3 unique avatar options per player
   - Ensures no duplicate avatars within same room

5. **Session Lock** (`multiplayer.spec.ts`)
   - Placeholder for Phase 1 → Phase 2 transition testing

#### Not Yet Implemented

- **Group formation**: Players sending/accepting join requests
- **Question answering**: Group members answering "Would you rather?" questions
- **Phase 2 slideshow**: Viewing results and voting
- **Reconnection**: Page refresh during active session

## Helper Functions

### `createHostRoom(page: Page): Promise<string>`

Creates a new room from the host view and returns the room code.

**Usage:**
```typescript
const hostPage = await browser.newPage();
const roomCode = await createHostRoom(hostPage);
console.log(`Room code: ${roomCode}`);
```

### `createPlayers(browser: Browser, configs: Array<{ roomCode: string }>): Promise<{ contexts: BrowserContext[], pages: Page[] }>`

Creates multiple isolated player sessions that join the same room.

**Usage:**
```typescript
const { contexts, pages } = await createPlayers(browser, [
  { roomCode },
  { roomCode },
  { roomCode },
]);
// Now you have 3 independent player sessions
```

### `startGame(hostPage: Page): Promise<void>`

Starts Phase 1 from the host view.

**Usage:**
```typescript
await startGame(hostPage);
```

### `waitForPhase(page: Page, phase: 'browsing' | 'question_active' | 'session_locked'): Promise<void>`

Waits for a player to reach a specific game phase.

**Usage:**
```typescript
await waitForPhase(playerPage, 'browsing');
await waitForPhase(playerPage, 'question_active');
```

### `waitForToast(page: Page, type: 'success' | 'error' | 'info' | 'warning', messageContains?: string): Promise<void>`

Waits for a toast notification to appear.

**Usage:**
```typescript
await waitForToast(page, 'error', 'full'); // Wait for error containing "full"
```

### `cleanupContexts(contexts: BrowserContext[]): Promise<void>`

Closes all browser contexts to free resources.

**Usage:**
```typescript
try {
  // ... test code ...
} finally {
  await cleanupContexts([hostContext, ...playerContexts]);
}
```

## Data Test IDs

All interactive elements have `data-testid` attributes for stable selection:

### Landing Page (`/`)
- `room-code-input-0` through `room-code-input-3` - Room code input fields
- `room-code-input-container` - Container for all inputs

### Host View (`/host`)
- `create-room-button` - Button to create new room
- `room-code` - Display of room code (appears after creation)
- `start-game-button` - Button to start Phase 1

### User View (`/user`)
- `avatar-selection` - Avatar selection container
- `avatar-option-{emoji}` - Individual avatar buttons
- `available-users-list` - List of users available to join
- `user-avatar-{code}` - Individual user buttons (by 2-digit code)
- `question-text` - Current question text
- `question-options` - Container for A/B options
- `question-option-a` - Option A button
- `question-option-b` - Option B button

### Toast Notifications
- `toast-error` - Error toast container
- `toast-success` - Success toast container
- `toast-info` - Info toast container
- `toast-warning` - Warning toast container
- `toast-message` - Toast message text

## Writing New Tests

### Template

```typescript
import { test, expect } from '@playwright/test';
import {
  createHostRoom,
  createPlayers,
  cleanupContexts,
} from './helpers';

test('your test name', async ({ browser }) => {
  // Create host
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const roomCode = await createHostRoom(hostPage);
  
  // Create players
  const { contexts, pages } = await createPlayers(browser, [
    { roomCode },
    { roomCode },
  ]);
  
  try {
    // Your test assertions here
    
  } finally {
    // Always clean up
    await cleanupContexts([hostContext, ...contexts]);
  }
});
```

### Best Practices

1. **Use isolated contexts**: Each player should have their own `BrowserContext` to avoid shared state
2. **Clean up resources**: Always use try/finally to clean up contexts
3. **Wait for UI signals**: Use `waitForPhase` and `waitFor` instead of arbitrary timeouts
4. **Use data-testid**: Prefer `page.getByTestId()` over CSS selectors for stability
5. **Assert on visible elements**: Test what users see, not internal state
6. **Keep tests focused**: One scenario per test function
7. **Handle async operations**: Always await promises and use proper timeouts

### Common Patterns

**Waiting for state changes:**
```typescript
// Wait for a specific element
await page.getByTestId('available-users-list').waitFor({ state: 'visible' });

// Wait for text to appear
await page.getByText('Waiting for host').waitFor({ state: 'visible' });
```

**Multiple players acting in sequence:**
```typescript
for (const [index, page] of pages.entries()) {
  await waitForPhase(page, 'browsing');
  console.log(`Player ${index + 1} reached browsing state`);
}
```

**Checking toast messages:**
```typescript
const toast = page.getByTestId('toast-error');
await expect(toast).toBeVisible();
const message = page.getByTestId('toast-message');
await expect(message).toContainText('Room is full');
```

## Debugging

### Interactive Mode

Run tests with Playwright Inspector for step-by-step debugging:
```bash
npm run test:e2e:debug
```

### Headed Mode

See browser windows while tests run:
```bash
npm run test:e2e:headed
```

### Screenshots on Failure

Playwright automatically captures screenshots on test failures. Find them in:
- `test-results/` directory

### Trace Viewer

For failed tests, review traces with:
```bash
npx playwright show-trace test-results/.../trace.zip
```

## Known Limitations

1. **Room capacity test is slow** (~60 seconds) due to creating 35 sequential players
2. **Real-time sync delays** may require increasing timeouts in flaky scenarios
3. **Convex dev must be running** - tests will fail if backend is not available
4. **Single worker** - tests run sequentially to avoid database conflicts

## Future Enhancements

- Add tests for group formation (send/accept requests)
- Add tests for question answering flow
- Add tests for Phase 2 slideshow
- Add tests for page refresh/reconnection
- Implement parallel test execution with database isolation
- Add visual regression testing with Percy or similar
- Add performance benchmarks
