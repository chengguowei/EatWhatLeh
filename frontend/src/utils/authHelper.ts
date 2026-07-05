/**
 * Utility to generate authorization headers for API calls.
 * Packages both the verified Clerk JWT token and local fallback headers for dev.
 * 
 * @param user The Clerk user object
 * @param getToken Function to fetch Clerk session token
 */
export async function getAuthHeaders(
  user: any,
  getToken: () => Promise<string | null>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (user) {
    headers['x-mock-clerk-id'] = user.id;
    
    // Determine user role (defaults to USER, ADMIN for demo_clerk_id or explicit metadata metadata)
    const role = (user.publicMetadata?.role as string) || (user.id === 'demo_clerk_id' ? 'ADMIN' : 'USER');
    headers['x-mock-role'] = role;
    
    try {
      const token = await getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('Failed to retrieve Clerk JWT token, falling back to mock headers:', err);
    }
  }
  return headers;
}
