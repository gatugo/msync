import { test, expect } from '@playwright/test';

test.describe('MindSync API Security', () => {
  const API_URL = '/api/coach';

  test('should return 401 Unauthorized when no token is provided', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        mode: 'advice',
        tasks: [],
        score: 50,
        balance: 'neutral'
      }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  test('should return 401 Unauthorized when invalid token is provided', async ({ request }) => {
    const response = await request.post(API_URL, {
      headers: {
        'Authorization': 'Bearer invalid-token-123'
      },
      data: {
        mode: 'advice',
        tasks: [],
        score: 50,
        balance: 'neutral'
      }
    });
    
    expect(response.status()).toBe(401);
  });

  // Note: We cannot easily test the 403 Forbidden (Admin only) or 429 Rate Limiting in an automated E2E test without a valid auth token to mock the user.
  // We will trust the unit tests and manual verification for those paths.
});
