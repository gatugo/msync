import { NextRequest, NextResponse } from 'next/server';
import { COACH_SYSTEM_PROMPT, getSystemPrompt } from '@/lib/aiPrompts';
import { z } from 'zod';
import { buildPrompt } from '@/lib/coachLogic';

// Lightweight in-memory rate limiter: per IP, per endpoint
type RateLimitEntry = { count: number; resetAt: number };
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per minute per IP
const rateLimits = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  const xfwd = req.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') // remove control chars
    .slice(0, maxLength)
    .trim();
}

function enforceRateLimit(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (entry && now < entry.resetAt) {
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }
  } else {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  return null;
}

const CoachRequestSchema = z.object({
  mode: z.string().max(30),
  tasks: z.array(z.any()).max(1000).optional(),
  score: z.number().optional(),
  balance: z.string().max(30).optional(),
  question: z
    .string()
    .max(1000)
    .transform((val) => sanitizeText(val, 1000))
    .optional(),
  taskTitle: z.string().max(150).optional(),
  history: z.array(z.any()).max(1000).optional(),
  goals: z.array(z.any()).max(1000).optional(),
  preferences: z.any().optional(),
  conversationHistory: z.array(z.any()).max(50).optional(),
  localDate: z.string().max(20).optional(),
  localTime: z.string().max(20).optional(),
  summaryInterval: z.string().max(30).optional(),
  stepfunConfig: z
    .object({
      apiKey: z.string().min(1),
      baseUrl: z.string().url().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

type CoachRequest = z.infer<typeof CoachRequestSchema>;

async function callStepFunStream(prompt: string, config: NonNullable<CoachRequest['stepfunConfig']>): Promise<ReadableStream> {
  const apiKey = config.apiKey;
  const rawBaseUrl = (config.baseUrl || 'https://api.stepfun.ai/v1').trim();
  const baseUrl = rawBaseUrl
    .replace(/^@url:\s*/, '')
    .replace(/`/g, '')
    .replace(/\/$/, '');
  const apiUrl = `${baseUrl}/chat/completions`;
  const model = config.model || 'step-3.7-flash';

  const isReasoningModel = model.includes('step-3.7') || model.includes('step-2');
  const isStepPlanUrl = baseUrl.includes('step-plan');

  const body: any = {
    model,
    messages: [
      { role: 'system', content: getSystemPrompt('stepfun') },
      { role: 'user', content: prompt },
    ],
    stream: true,
    temperature: isStepPlanUrl ? 0 : 0.5,
    max_tokens: 4096,
  };

  if (isReasoningModel) {
    body.reasoning_effort = 'low';
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
    throw new Error(`StepFun API error: ${response.status} - ${error}`);
  }

  return response.body!;
}

async function callStepFunJSON(prompt: string, config: NonNullable<CoachRequest['stepfunConfig']>): Promise<string> {
  const apiKey = config.apiKey;
  const baseUrl = (config.baseUrl || 'https://api.stepfun.ai/v1').replace(/\/$/, '');
  const apiUrl = `${baseUrl}/chat/completions`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'step-3.7-flash',
      messages: [
        { role: 'system', content: `${getSystemPrompt('stepfun')}\n\nRespond with valid JSON only.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 4096,
      reasoning_effort: 'low',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`StepFun API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '{}';
}

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
        controller.error(err);
      }
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const body = CoachRequestSchema.parse(rawBody);
    const prompt = buildPrompt(body);

    if (!body.stepfunConfig?.apiKey) {
      return NextResponse.json({ error: 'Missing StepFun API key. Please configure in Settings.' }, { status: 400 });
    }

    if (body.mode === 'schedule_assist') {
      try {
        const json = await callStepFunJSON(prompt, body.stepfunConfig);
        return NextResponse.json({ success: true, response: json });
      } catch (err) {
        console.error('AI service failed:', err);
        return NextResponse.json({ success: false, error: 'AI service busy' }, { status: 503 });
      }
    } else {
      try {
        const stepfunStream = await callStepFunStream(prompt, body.stepfunConfig);
        const stream = await transformStepFunStream(stepfunStream);
        return new NextResponse(stream);
      } catch (err) {
        console.error('AI service failed:', err);
        return NextResponse.json({ error: 'AI service busy.' }, { status: 503 });
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
