import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/coach/route';
import { getSystemPrompt } from '../src/lib/aiPrompts';

// Mock supabase to bypass auth
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user', email: 'test@example.com' } },
                error: null
            })
        }
    }
}));

// Mock google generative AI at top level
vi.mock('@google/generative-ai', () => {
    class MockGoogleGenerativeAI {
        getGenerativeModel() {
            return {
                generateContent: async () => ({
                    response: { text: () => '{"fallbackToGemini": true}' }
                })
            };
        }
    }
    return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

describe('AI Persona Constraints', () => {
    it('should include Ego constraints in system prompt', () => {
        const prompt = getSystemPrompt('gemini');
        expect(prompt).toContain('I am prescribing...');
        expect(prompt).toContain('You MUST output concrete tasks using the Action Block syntax.');
        expect(prompt).toContain('[ACTION: CREATE_TASK');
        expect(prompt).toContain('<thought>');
    });

    it('stepfun prompt should omit thought tags natively', () => {
        const prompt = getSystemPrompt('stepfun');
        expect(prompt).not.toContain('<thought>');
        expect(prompt).toContain('I am prescribing...');
    });
});

describe('Hybrid Engine Fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.STEPFUN_API_KEY = 'test-key';
        process.env.GEMINI_API_KEY = 'test-gemini';
        process.env.GROQ_API_KEY = 'test-groq';
        process.env.AI_PROVIDER = 'stepfun';
    });

    it('should fallback to Gemini if StepFun JSON fails', async () => {
        // We will mock global fetch
        const mockFetch = vi.fn().mockImplementation((url) => {
            if (typeof url === 'string' && url.includes('stepfun')) {
                return Promise.resolve({
                    ok: false,
                    status: 503,
                    text: () => Promise.resolve('Service Unavailable')
                });
            }
            return Promise.resolve({ ok: true });
        });
        global.fetch = mockFetch;

        const req = new NextRequest('http://localhost:3000/api/coach', {
            method: 'POST',
            headers: {
                'authorization': 'Bearer fake-token',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                mode: 'schedule_assist',
                taskTitle: 'Test Task'
            })
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.response).toBe('{"fallbackToGemini": true}');
    });
});
