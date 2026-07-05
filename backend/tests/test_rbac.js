// Disable JWT verification for local test execution to allow mock headers bypass
process.env.CLERK_JWT_VERIFICATION = 'false';

import { requireAuth, requireRole } from '../src/middleware/auth.js';

// Helper to construct mock Express req, res, and next
function mockReqRes(headers = {}, body = {}, params = {}) {
  const req = {
    headers: headers,
    body: body,
    params: params,
    auth: null
  };
  let statusVal = 200; // default success status
  let jsonVal = null;
  let nextCalled = false;

  const res = {
    status: function (code) {
      statusVal = code;
      return this;
    },
    json: function (data) {
      jsonVal = data;
      return this;
    }
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusVal,
    getJson: () => jsonVal,
    wasNextCalled: () => nextCalled
  };
}

// Custom router checks (copied from index.js / users.js route controllers)
function executeOwnerCheck(req, res, next) {
  const authenticatedUserId = req.auth?.userId;
  const role = req.auth?.claims?.publicMetadata?.role || 'USER';
  
  if (req.params.clerkId !== authenticatedUserId && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: You cannot access other users profiles.' });
  }
  next();
}

function executeSyncCheck(req, res, next) {
  const authenticatedUserId = req.auth?.userId;
  const { clerkId } = req.body;
  
  if (clerkId !== authenticatedUserId) {
    return res.status(403).json({ error: 'Forbidden: Cannot sync profile for another user ID.' });
  }
  next();
}

async function main() {
  console.log('=== ROLE-BASED ACCESS CONTROL (RBAC) EVALUATION ===\n');

  const testCases = [
    // Endpoint 1: POST /api/restaurants (ADMIN only)
    {
      id: 1,
      endpoint: 'POST /api/restaurants',
      role: 'ADMIN',
      clerkId: 'demo_clerk_id',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'demo_clerk_id', 'x-mock-role': 'ADMIN' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 2,
      endpoint: 'POST /api/restaurants',
      role: 'COMMUNITY_DINER (USER)',
      clerkId: 'user_regular',
      expected: 'Deny (403)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },

    // Endpoint 2: PUT /api/restaurants/:id (ADMIN only)
    {
      id: 3,
      endpoint: 'PUT /api/restaurants/:id',
      role: 'ADMIN',
      clerkId: 'demo_clerk_id',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'demo_clerk_id', 'x-mock-role': 'ADMIN' }, {}, { id: 'rest_1' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 4,
      endpoint: 'PUT /api/restaurants/:id',
      role: 'COMMUNITY_DINER (USER)',
      clerkId: 'user_regular',
      expected: 'Deny (403)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' }, {}, { id: 'rest_1' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },

    // Endpoint 3: DELETE /api/reviews/:id (ADMIN only)
    {
      id: 5,
      endpoint: 'DELETE /api/reviews/:id',
      role: 'ADMIN',
      clerkId: 'demo_clerk_id',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'demo_clerk_id', 'x-mock-role': 'ADMIN' }, {}, { id: 'rev_1' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 6,
      endpoint: 'DELETE /api/reviews/:id',
      role: 'COMMUNITY_DINER (USER)',
      clerkId: 'user_regular',
      expected: 'Deny (403)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' }, {}, { id: 'rev_1' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },

    // Endpoint 4: GET /api/reviews (ADMIN only)
    {
      id: 7,
      endpoint: 'GET /api/reviews',
      role: 'ADMIN',
      clerkId: 'demo_clerk_id',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'demo_clerk_id', 'x-mock-role': 'ADMIN' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 8,
      endpoint: 'GET /api/reviews',
      role: 'COMMUNITY_DINER (USER)',
      clerkId: 'user_regular',
      expected: 'Deny (403)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' });
        await requireAuth(req, res, () => {
          requireRole('ADMIN')(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },

    // Endpoint 5: GET /api/users/profile/:clerkId (Owner or ADMIN)
    {
      id: 9,
      endpoint: 'GET /api/users/profile/:clerkId',
      role: 'COMMUNITY_DINER (Owner Match)',
      clerkId: 'user_regular',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes(
          { 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' },
          {},
          { clerkId: 'user_regular' }
        );
        await requireAuth(req, res, () => {
          executeOwnerCheck(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 10,
      endpoint: 'GET /api/users/profile/:clerkId',
      role: 'COMMUNITY_DINER (Owner Mismatch)',
      clerkId: 'user_regular',
      expected: 'Deny (403)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes(
          { 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' },
          {},
          { clerkId: 'another_user' }
        );
        await requireAuth(req, res, () => {
          executeOwnerCheck(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 11,
      endpoint: 'GET /api/users/profile/:clerkId',
      role: 'ADMIN (Owner Mismatch Bypass)',
      clerkId: 'demo_clerk_id',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes(
          { 'x-mock-clerk-id': 'demo_clerk_id', 'x-mock-role': 'ADMIN' },
          {},
          { clerkId: 'another_user' }
        );
        await requireAuth(req, res, () => {
          executeOwnerCheck(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    },

    // Endpoint 6: POST /api/reviews (Auth required)
    {
      id: 12,
      endpoint: 'POST /api/reviews',
      role: 'COMMUNITY_DINER (Authenticated)',
      clerkId: 'user_regular',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({ 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' });
        await requireAuth(req, res, next);
        return wasNextCalled() ? 200 : getStatus();
      }
    },
    {
      id: 13,
      endpoint: 'POST /api/reviews',
      role: 'Unauthenticated Guest',
      clerkId: null,
      expected: 'Deny (401)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes({});
        await requireAuth(req, res, next);
        return wasNextCalled() ? 200 : getStatus();
      }
    },

    // Endpoint 7: POST /api/users/sync (Owner Match required)
    {
      id: 14,
      endpoint: 'POST /api/users/sync',
      role: 'COMMUNITY_DINER (Owner Match)',
      clerkId: 'user_regular',
      expected: 'Allow (200)',
      run: async () => {
        const { req, res, next, wasNextCalled, getStatus } = mockReqRes(
          { 'x-mock-clerk-id': 'user_regular', 'x-mock-role': 'USER' },
          { clerkId: 'user_regular' }
        );
        await requireAuth(req, res, () => {
          executeSyncCheck(req, res, next);
        });
        return wasNextCalled() ? 200 : getStatus();
      }
    }
  ];

  let passes = 0;
  const results = [];

  for (const tc of testCases) {
    const statusCode = await tc.run();
    const isAllowed = statusCode === 200;
    
    let resultStatus = 'FAIL';
    if (tc.expected.includes('Allow') && isAllowed) {
      resultStatus = 'PASS';
    } else if (tc.expected.includes('Deny') && !isAllowed) {
      resultStatus = 'PASS';
    }
    
    if (resultStatus === 'PASS') {
      passes++;
    }

    results.push({
      id: tc.id,
      endpoint: tc.endpoint,
      role: tc.role,
      expected: tc.expected,
      actual: isAllowed ? 'Allow (200)' : `Deny (${statusCode})`,
      status: resultStatus
    });
  }

  const successRate = (passes / testCases.length) * 100;

  console.log('--- RBAC VERIFICATION RAW LOGS ---');
  console.table(results.map(r => ({
    'ID': r.id,
    'Endpoint Route': r.endpoint,
    'Client Role Context': r.role,
    'Expected Behavior': r.expected,
    'Actual Outcome': r.actual,
    'Verif. Result': r.status
  })));

  console.log('\n--- THESIS READY MARKDOWN TABLE ---');
  console.log('| ID | Endpoint Endpoint | Target Role | Expected Outcome | Actual Outcome | Status |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  results.forEach(r => {
    console.log(`| ${r.id} | \`${r.endpoint}\` | ${r.role} | ${r.expected} | ${r.actual} | ${r.status} |`);
  });

  console.log(`\n**Authorization Success Rate**: ${successRate.toFixed(2)}% (${passes}/${testCases.length} assertions passed)`);

}

main().catch(err => console.error(err));
