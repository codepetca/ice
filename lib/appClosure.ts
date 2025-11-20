/**
 * App Closure Utilities
 * 
 * Provides functions to check if the app is closed and handle bypass logic.
 */

/**
 * Checks if the app is currently closed based on the APP_CLOSED environment variable.
 * 
 * @returns true if the app is closed (APP_CLOSED is set to "true" or "1")
 */
export function isAppClosed(): boolean {
  const appClosed = process.env.APP_CLOSED;
  return appClosed === "true" || appClosed === "1";
}

/**
 * Checks if a request has a valid bypass token or cookie.
 * 
 * @param token - Query parameter token from the URL (e.g., ?token=SECRET)
 * @param bypassCookie - Value of the app_bypass cookie
 * @returns true if the request should bypass the closed state
 */
export function hasBypass(token: string | null, bypassCookie: string | undefined): boolean {
  const bypassSecret = process.env.APP_BYPASS_SECRET;
  
  // If no bypass secret is configured, bypass is not possible
  if (!bypassSecret) {
    return false;
  }
  
  // Check if token matches secret
  if (token === bypassSecret) {
    return true;
  }
  
  // Check if bypass cookie is set
  if (bypassCookie === "1") {
    return true;
  }
  
  return false;
}
