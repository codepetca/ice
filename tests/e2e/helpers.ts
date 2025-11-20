import { Page, Browser, BrowserContext, expect } from '@playwright/test';

/**
 * Helper to create a host room and retrieve the room code
 */
export async function createHostRoom(page: Page): Promise<string> {
  await page.goto('/host');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Click create room button
  const createButton = page.getByTestId('create-room-button');
  await createButton.waitFor({ state: 'visible' });
  await createButton.click();
  
  // Wait for room code to appear
  const roomCodeElement = page.getByTestId('room-code');
  await roomCodeElement.waitFor({ state: 'visible', timeout: 10000 });
  
  // Get room code text
  const roomCode = await roomCodeElement.textContent();
  if (!roomCode) {
    throw new Error('Room code not found');
  }
  
  return roomCode.trim();
}

/**
 * Helper to create multiple player contexts and join a room
 */
export async function createPlayers(
  browser: Browser,
  players: Array<{ roomCode: string }>
): Promise<{ contexts: BrowserContext[], pages: Page[] }> {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  
  for (const player of players) {
    // Create isolated browser context
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to landing page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Enter room code (4 letters)
    const roomCode = player.roomCode;
    for (let i = 0; i < 4; i++) {
      const input = page.getByTestId(`room-code-input-${i}`);
      await input.fill(roomCode[i]);
    }
    
    // Wait for redirect to user page
    await page.waitForURL(/\/user\?roomCode=/, { timeout: 10000 });
    
    // Wait for avatar selection to appear
    await page.getByTestId('avatar-selection').waitFor({ state: 'visible', timeout: 10000 });
    
    // Select first available avatar (will auto-join)
    const avatarOptions = page.locator('[data-testid^="avatar-option-"]');
    const firstAvatar = avatarOptions.first();
    await firstAvatar.waitFor({ state: 'visible' });
    await firstAvatar.click();
    
    // Wait for join to complete - we should see either the waiting screen or available users
    await page.waitForTimeout(2000); // Give time for join mutation
    
    contexts.push(context);
    pages.push(page);
  }
  
  return { contexts, pages };
}

/**
 * Helper to start the game from host view
 */
export async function startGame(hostPage: Page): Promise<void> {
  const startButton = hostPage.getByTestId('start-game-button');
  await startButton.waitFor({ state: 'visible' });
  await startButton.click();
  
  // Wait for game to start (button should disappear or change state)
  await hostPage.waitForTimeout(1000);
}

/**
 * Helper to wait for a specific phase/state
 * This is a simple implementation that checks for key UI elements
 */
export async function waitForPhase(page: Page, phase: 'browsing' | 'question_active' | 'session_locked'): Promise<void> {
  const timeout = 15000;
  
  switch (phase) {
    case 'browsing':
      // Wait for available users list or "waiting for others" message
      try {
        await page.getByTestId('available-users-list').waitFor({ state: 'visible', timeout });
      } catch {
        // If no users available, wait for the alternative message
        await page.getByText('Waiting for others to be available').waitFor({ state: 'visible', timeout });
      }
      break;
      
    case 'question_active':
      // Wait for question text and options to appear
      await page.getByTestId('question-text').waitFor({ state: 'visible', timeout });
      await page.getByTestId('question-options').waitFor({ state: 'visible', timeout });
      break;
      
    case 'session_locked':
      // Wait for "Results Starting..." or similar waiting message
      await page.getByText('Results Starting...').waitFor({ state: 'visible', timeout });
      break;
  }
}

/**
 * Helper to get the number of users in a room from host view
 */
export async function getRoomUserCount(hostPage: Page): Promise<number> {
  // Look for user count display - this might need adjustment based on actual UI
  const userCountText = await hostPage.locator('text=/\\d+ players?|\\d+ users?/i').first().textContent();
  if (!userCountText) {
    return 0;
  }
  const match = userCountText.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Helper to send a join request from one player to another
 */
export async function sendJoinRequest(playerPage: Page, targetCode: number): Promise<void> {
  // Wait for available users list
  await playerPage.getByTestId('available-users-list').waitFor({ state: 'visible', timeout: 10000 });
  
  // Click on the target user's avatar
  const targetAvatar = playerPage.getByTestId(`user-avatar-${targetCode}`);
  await targetAvatar.waitFor({ state: 'visible' });
  await targetAvatar.click();
  
  // Wait a moment for the request to be sent
  await playerPage.waitForTimeout(1000);
}

/**
 * Helper to check if a toast with specific message is visible
 */
export async function waitForToast(page: Page, type: 'success' | 'error' | 'info' | 'warning', messageContains?: string): Promise<void> {
  const toast = page.getByTestId(`toast-${type}`);
  await toast.waitFor({ state: 'visible', timeout: 10000 });
  
  if (messageContains) {
    const message = page.getByTestId('toast-message');
    await expect(message).toContainText(messageContains);
  }
}

/**
 * Cleanup helper to close all contexts
 */
export async function cleanupContexts(contexts: BrowserContext[]): Promise<void> {
  for (const context of contexts) {
    await context.close();
  }
}
