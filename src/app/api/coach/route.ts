import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { COACH_SYSTEM_PROMPT, getSystemPrompt } from '@/lib/aiPrompts';
import { z } from 'zod';
import { buildPrompt } from '@/lib/coachLogic';
import { supabase } from '@/lib/supabase';

// ============ SECURITY: Rate Limiting ============
const REQUESTS_PER_MINUTE = 15; // Increased for StepFun free tier
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId) || { count: 0, resetTime: now + 60 * 1000 };

    if (userLimit.resetTime < now) {
        userLimit.count = 0;
        userLimit.resetTime = now + 60 * 1000;
    }

    if (userLimit.count >= REQUESTS_PER_MINUTE) return true;

    userLimit.count++;
    rateLimitMap.set(userId, userLimit);
    return false;
}

// ============ SECURITY: Input Validation ============
const CoachRequestSchema = z.object({
    mode: z.string().max(30),
    tasks: z.array(z.any()).optional(),
    score: z.number().optional(),
    balance: z.string().max(30).optional(),
    question: z.string().max(1000).optional(), // Protect against prompt injection / massive tokens
    taskTitle: z.string().max(150).optional(),
    history: z.array(z.any()).optional(),
    goals: z.array(z.any()).optional(),
    preferences: z.any().optional(),
    conversationHistory: z.array(z.any()).optional(),
    localDate: z.string().max(20).optional(),
    localTime: z.string().max(20).optional(),
    summaryInterval: z.string().max(30).optional()
});

type CoachRequest = z.infer<typeof CoachRequestSchema>;

// ============ PROVIDER 0: STEPFUN STREAM (PRIMARY) ============
async function callStepFunStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.STEPFUN_API_KEY;
    const apiUrl = process.env.STEPFUN_API_URL || 'https://api.stepfun.ai/v1/chat/completions';
    const model = process.env.STEPFUN_MODEL || 'step-3.7-flash';

    if (!apiKey) throw new Error('STEPFUN_API_KEY not set');

    console.log(`🤖 Calling StepFun Stream (${model})...`);

    // StepFun Reasoning / Plan specific configuration
    const isReasoningModel = model.includes('step-3.7') || model.includes('step-2');
    const isStepPlanUrl = apiUrl.includes('step-plan');

    const body: any = {
        model: model,
        messages: [
            { role: 'system', content: getSystemPrompt('stepfun') },
            { role: 'user', content: prompt }
        ],
        stream: true,
        temperature: isStepPlanUrl ? 0 : 0.7, // Planning typically needs lower temperature
        max_tokens: 4096,
    };

    // Add reasoning effort only for compatible models
    if (isReasoningModel) {
        body.reasoning_effort = process.env.STEPFUN_REASONING_EFFORT || 'low';
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('❌ StepFun API Error:', response.status, error);
        throw new Error(`StepFun API error: ${response.status} - ${error}`);
    }

    console.log('✅ StepFun Stream started');
    return response.body!;
}

// ============ PROVIDER 0: STEPFUN JSON ============
async function callStepFunJSON(prompt: string): Promise<string> {
    const apiKey = process.env.STEPFUN_API_KEY;
    const apiUrl = process.env.STEPFUN_API_URL || 'https://api.stepfun.ai/v1/chat/completions';

    if (!apiKey) throw new Error('STEPFUN_API_KEY not set');

    console.log('🤖 Calling StepFun JSON...');

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: process.env.STEPFUN_MODEL || 'step-3.5-flash',
            messages: [
                { role: 'system', content: `${getSystemPrompt('stepfun')}\n\nRespond with valid JSON only.` },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4096,
            reasoning_effort: process.env.STEPFUN_REASONING_EFFORT || 'low',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('❌ StepFun API Error:', response.status, error);
        throw new Error(`StepFun API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('✅ StepFun JSON response received');
    return data.choices[0]?.message?.content || '{}';
}

// ============ PROVIDER 1: GEMINI STREAM ============
async function callGeminiStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: getSystemPrompt('gemini')
    });

    const result = await model.generateContentStream(prompt);

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        controller.enqueue(encoder.encode(chunkText));
                    }
                }
                controller.close();
            } catch (err) {
                console.error('[Gemini] Stream Error:', err);
                controller.error(err);
            }
        },
    });
    return stream;
}

// ============ PROVIDER 2: GROQ STREAM (BACKUP) ============
async function callGroqStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: getSystemPrompt('groq') }, { role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
    });

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) controller.enqueue(encoder.encode(content));
            }
            controller.close();
        },
    });
    return stream;
}

// ============ JSON HANDLERS ============
async function callGeminiJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent([getSystemPrompt('gemini'), "Respond with valid JSON.", prompt]);
    return result.response.text();
}

async function callGroqJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: getSystemPrompt('groq') }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500
    });
    return completion.choices[0]?.message?.content || '{}';
}


// ============ STEPFUN STREAM TRANSFORMER ============
// StepFun returns reasoning tokens separately from content
// This transforms the stream to pass through content as plain text, injecting <thought> and </thought> tags for the UI to parse.
async function transformStepFunStream(originalStream: ReadableStream): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
        async start(controller) {
            const reader = originalStream.getReader();
            let buffer = '';
            let inReasoning = false;

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        if (inReasoning) {
                            controller.enqueue(encoder.encode('</thought>'));
                        }
                        controller.close();
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; 

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

                        try {
                            const jsonStr = trimmedLine.slice(6);
                            if (jsonStr === '[DONE]') {
                                if (inReasoning) {
                                    controller.enqueue(encoder.encode('</thought>'));
                                    inReasoning = false;
                                }
                                continue;
                            }

                            const data = JSON.parse(jsonStr);
                            const delta = data.choices?.[0]?.delta;
                            if (!delta) continue;

                            const content = delta.content || '';
                            const reasoning = delta.reasoning || '';

                            if (reasoning) {
                                if (!inReasoning) {
                                    controller.enqueue(encoder.encode('<thought>'));
                                    inReasoning = true;
                                }
                                controller.enqueue(encoder.encode(reasoning));
                            } else if (content) {
                                if (inReasoning) {
                                    controller.enqueue(encoder.encode('</thought>'));
                                    inReasoning = false;
                                }
                                controller.enqueue(encoder.encode(content));
                            }
                        } catch (err) {
                            console.error('Error parsing SSE in transformer:', err);
                        }
                    }
                }
            } catch (err) {
                console.error('Stream transformation error:', err);
                controller.error(err);
            }
        }
    });
}

// ============ MAIN HANDLER with HYBRID LOGIC ============
export async function POST(req: NextRequest) {
    // 1. Authentication Check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 2. Admin Authorization (Only you can use the AI)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && user.email !== adminEmail) {
        console.warn(`Unauthorized AI access attempt by non-admin: ${user.email}`);
        return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
    }

    // 3. Rate Limit by Authenticated User ID
    if (isRateLimited(user.id)) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    try {
        const rawBody = await req.json();

        // MOCK MODE Check
        if (process.env.MOCK_AI === 'true') {
             // ... Mock Logic (Simplified for brevity, or kept if needed. For now assuming real)
        }

        const body = CoachRequestSchema.parse(rawBody);
        const prompt = buildPrompt(body);
        const aiProvider = process.env.AI_PROVIDER || 'stepfun';

        // --- JSON MODE (Schedule Assist) ---
        if (body.mode === 'schedule_assist') {
            try {
                let json: string;

                // Try primary provider first
                if (aiProvider === 'stepfun') {
                    try {
                        json = await callStepFunJSON(prompt);
                    } catch (err) {
                        console.error('⚠️ StepFun JSON Failed:', err);
                        // Fallback to Gemini
                        json = await callGeminiJSON(prompt);
                    }
                } else if (aiProvider === 'gemini') {
                    json = await callGeminiJSON(prompt);
                } else {
                    json = await callGroqJSON(prompt);
                }

                return NextResponse.json({ success: true, response: json });
            } catch (err) {
                console.error('All AI services failed:', err);
                return NextResponse.json({ success: false, error: 'All AI services busy' }, { status: 503 });
            }
        }

        // --- STREAMING MODE (Chat/Advice) ---
        else {
            try {
                let stream: ReadableStream;

                // Try primary provider first
                if (aiProvider === 'stepfun') {
                    try {
                        const stepfunStream = await callStepFunStream(prompt);
                        stream = await transformStepFunStream(stepfunStream);
                    } catch (err) {
                        console.error('⚠️ StepFun Stream Failed:', err);
                        // Fallback to Gemini
                        stream = await callGeminiStream(prompt);
                    }
                } else if (aiProvider === 'gemini') {
                    stream = await callGeminiStream(prompt);
                } else {
                    stream = await callGroqStream(prompt);
                }

                return new NextResponse(stream);
            } catch (err) {
                console.error('All AI services failed:', err);
                return NextResponse.json({ error: 'All AI services busy.' }, { status: 503 });
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
