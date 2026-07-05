import dotenv from 'dotenv';
dotenv.config();

/**
 * Middleware to authenticate requests using Clerk Session JWT tokens.
 * Supports fallback to X-Mock headers for local/offline mock database testing.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    // Fallback search in headers or body for mock testing
    const mockClerkId = req.headers['x-mock-clerk-id'] || req.body.clerkId;
    const mockRole = req.headers['x-mock-role'] || 'USER';

    const isProduction = process.env.NODE_ENV === 'production';

    // 1. If in production, strictly enforce JWT verification. Do not check mock options.
    if (isProduction) {
      if (!process.env.CLERK_SECRET_KEY) {
        return res.status(500).json({ error: 'Security misconfiguration: Clerk Secret Key is missing in production.' });
      }
    } else {
      // 2. If not in production, allow mock credentials bypass for local offline testing
      if (process.env.CLERK_JWT_VERIFICATION === 'false' || !process.env.CLERK_SECRET_KEY) {
        if (mockClerkId) {
          req.auth = {
            userId: mockClerkId,
            claims: {
              publicMetadata: {
                role: mockClerkId === 'demo_clerk_id' ? 'ADMIN' : mockRole,
              },
            },
          };
          return next();
        }
        return res.status(401).json({ error: 'Authentication required (mock credentials missing).' });
      }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Non-production fallback for missing token header
      if (!isProduction && mockClerkId) {
        req.auth = {
          userId: mockClerkId,
          claims: {
            publicMetadata: {
              role: mockRole
            }
          }
        };
        return next();
      }
      return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const { clerkClient } = await import('@clerk/clerk-sdk-node');
      const claims = await clerkClient.verifyToken(token);
      req.auth = {
        userId: claims.sub,
        claims: claims,
      };
      next();
    } catch (err) {
      console.warn('Clerk JWT Verification failed:', err.message);
      
      // Secondary fallback: Only allowed in non-production environments
      if (mockClerkId && !isProduction) {
        console.warn('Falling back to local mock credentials.');
        req.auth = {
          userId: mockClerkId,
          claims: { publicMetadata: { role: mockRole } }
        };
        return next();
      }
      
      return res.status(401).json({ error: 'Invalid or expired Clerk session token.' });
    }
  } catch (err) {
    console.error('Auth middleware exception:', err);
    res.status(500).json({ error: 'Internal server error in authentication.' });
  }
}

/**
 * Middleware wrapper to assert role-based access control.
 * @param {string} allowedRole Role required, e.g. 'ADMIN'
 */
export function requireRole(allowedRole) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    let role = req.auth.claims?.publicMetadata?.role || req.auth.claims?.metadata?.role || 'USER';

    // Dev bypass: Allow role override via header in non-production
    const isProduction = process.env.NODE_ENV === 'production';
    const mockRole = req.headers['x-mock-role'];
    if (!isProduction && mockRole) {
      role = mockRole;
    }

    if (String(role).toUpperCase() !== String(allowedRole).toUpperCase()) {
      return res.status(403).json({ error: `Forbidden: Requires ${allowedRole} permissions.` });
    }

    next();
  };
}
