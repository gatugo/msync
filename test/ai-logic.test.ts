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


