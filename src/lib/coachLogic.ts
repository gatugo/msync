
import { z } from 'zod';
import { Task, Goal, DailySnapshot, AIMemory, UserPreferences } from '../types';

// Re-defining schema/types here if needed, or moving them.
// Let's just create the helpers file and copy the necessary parts.

// Format Helper
export function format12h(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
}

// Local minimal task interface is fine for internal use if needed, 
// but we'll use the imported Task type where possible.

interface CoachRequestMinimal {
    mode: string;
    tasks?: Task[];
    score?: number;
    balance?: string;
    question?: string;
    taskTitle?: string;
    history?: DailySnapshot[];
    goals?: Goal[];
    preferences?: UserPreferences;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    localDate?: string;
    localTime?: string;
    aiMemory?: AIMemory[];
    summaryInterval?: string;
}

export function calculateFreeSlots(tasks: Task[] | undefined, targetDate: string | undefined, preferences: UserPreferences | undefined): string {
    if (!tasks || !targetDate) return 'Unknown';
    const todayTasks = tasks
        .filter((t: Task) => t.scheduledDate === targetDate && t.scheduledTime && t.status !== 'DONE')
        .sort((a: Task, b: Task) => ((a.scheduledTime || '') > (b.scheduledTime || '') ? 1 : -1));

    const sleepStart = preferences?.sleepStartTime || '23:00';
    const sleepEnd = preferences?.sleepEndTime || '06:00';
    const [sH, sM] = sleepEnd.split(':').map(Number);
    const [eH, eM] = sleepStart.split(':').map(Number);
    const awakeStart = sH * 60 + sM;
    const awakeEnd = eH * 60 + eM;

    if (todayTasks.length === 0) {
        return awakeEnd > awakeStart 
            ? `All day (${format12h(awakeStart)} - ${format12h(awakeEnd)})` 
            : `All day (${format12h(awakeStart)} - 11:59pm AND 12am - ${format12h(awakeEnd)})`;
    }

    let currentTime = awakeStart;
    const slots = [];

    for (const task of todayTasks) {
        if (!task.scheduledTime) continue;
        const [hh, mm] = task.scheduledTime.split(':').map(Number);
        const taskStart = hh * 60 + mm;
        const taskDuration = task.duration || 30;
        const taskEnd = taskStart + taskDuration;

        if (taskStart < currentTime) {
            currentTime = Math.max(currentTime, taskEnd);
            continue;
        }
        if (taskStart > currentTime + 15) {
            slots.push(`${format12h(currentTime)} - ${format12h(taskStart)}`);
        }
        currentTime = Math.max(currentTime, taskEnd);
    }
    if (currentTime < awakeEnd - 15) {
        slots.push(`${format12h(currentTime)} - ${format12h(awakeEnd)}`);
    }
    return slots.length > 0 ? slots.join(', ') : 'None (Busy)';
}

export function buildPrompt(request: CoachRequestMinimal): string {
    const { mode, tasks, score, balance, question, history, goals, preferences, taskTitle, conversationHistory, localDate, localTime, aiMemory, summaryInterval } = request;
    const now = new Date();
    const currentTimeStr = localTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDateKey = localDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentDateDisplay = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const availableSlots = calculateFreeSlots(tasks, currentDateKey, preferences);

    const prefsStr = preferences ? `
- Hobbies: ${preferences.hobbies?.join(', ') || 'None'}
- Interests: ${preferences.interests?.join(', ') || 'None'}
- Passions: ${preferences.passions?.join(', ') || 'None'}` : '';

    const memoryStr = aiMemory?.length ? `\nUser Memories / Facts:\n${aiMemory.map((m: AIMemory) => `- ${m.fact}`).join('\n')}` : '';

    const commonContext = `Current Context:
- Date: ${currentDateDisplay} (${currentDateKey})
- Time: ${currentTimeStr} (Local)
- Current Status:
    - Ego Score: ${score || 50}/100
    - Balance State: ${balance || 'neutral'}
    - Available Free Slots Today: ${availableSlots}
    ${tasks ? `- Completed Today: ${tasks.filter((t: Task) => t.status === 'DONE' && t.type === 'ADULT').length} Adult, ${tasks.filter((t: Task) => t.status === 'DONE' && t.type === 'CHILD').length} Child` : ''}
User Profile:${prefsStr}${memoryStr}`;

    switch (mode) {
        case 'advice': return `${commonContext}\nGive me a personalized recommendation based on my current balance using MindSync terminology. Keep it extremely concise (max 2 short sentences). Separate them with a double newline (\\n\\n) so they render as two distinct, highly readable lines.`;
        case 'chat': {
            const historyStr = conversationHistory?.length ? '\n\nPrevious conversation:\n' + conversationHistory.map((msg: { role: string; content: string }) => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`).join('\n') : '';
            const todayTasksList = tasks ? tasks.filter((t: Task) => t.scheduledDate === currentDateKey) : [];
            const tasksStr = todayTasksList.length > 0 ? `Today's Tasks (${currentDateKey}): ${todayTasksList.map((t: Task) => `${t.title} (${t.type}${t.scheduledTime ? ` at ${t.scheduledTime}` : ''})`).join(', ')}` : "No tasks scheduled for today.";
            const historySummary = (history || []).slice(-7).map((h: DailySnapshot) => `- ${h.date}: Score ${h.score}, Adult ${h.adultCompleted}, Child ${h.childCompleted}, Rest ${h.restCompleted || 0}`).join('\n');
            return `${commonContext}\n${tasksStr}\n${historySummary ? `\nPast 7 Days History:\n${historySummary}\n` : ''}${goals ? `Active Goals: ${goals.map((g: Goal) => `${g.title} (due ${g.targetDate})`).join(', ')}` : ''}${historyStr}

<user_input>
${question}
</user_input>
Answer helpfully as the "Ego" coach using specific MindSync insights.
Keep your response CONCISE, AUTHORITATIVE, and ACTIONABLE. Do not write long paragraphs or dense blocks of text. Use frequent line breaks and double newlines (\n\n) to keep each paragraph extremely short (maximum 1-2 sentences per paragraph). Structure your response with clear headings or bullet points for readability.

CRITICAL: Only output '[ACTION: CREATE_TASK ...]' blocks if the user explicitly asks to schedule, plan, fill in their schedule, or add/fix a task (including partial requests like "apply step 1" or "just do the second one"). 
If the user is just asking for general advice or diagnostics, do NOT output any action blocks. Instead, at the very end of your response, add a short, actionable prompt like: *"Reply 'apply these fixes' or 'apply step 1' to add these to your timeline."*
If the user asks to apply a specific step from a previous message (e.g., "apply step 1"), look at the conversation history, identify exactly what task that step refers to, and output ONLY the action block for that specific task.

// ACTION BLOCK FORMAT (Only suggest when explicitly asked to schedule/plan/add):
// [ACTION: CREATE_TASK | Title | Type (ADULT/CHILD/REST) | Duration in minutes | ScheduledDate (YYYY-MM-DD) | ScheduledTime (HH:MM)]
// IMPORTANT: Use 24-hour format for ScheduledTime (e.g., "17:00"). Use YYYY-MM-DD for dates. Action blocks must be strictly formatted.`; 
        }
        case 'summary': {
            const interval = summaryInterval || 'weekly';
            const intervalCapitalized = interval.charAt(0).toUpperCase() + interval.slice(1);
            return `${commonContext}
Provide a brief, beautifully formatted summary of my ${interval}'s patterns and one key insight from the MindSync system.
CRITICAL FORMATTING:
1. Use EXACTLY two clean headings: "### ${intervalCapitalized} Pattern Summary" and "### Key MindSync Insight".
2. Keep each section extremely concise (maximum 2-3 short sentences per section). 
3. Use frequent line breaks and double newlines (\\n\\n) to break up the text. Never output a dense paragraph of text. Keep paragraphs to 1-2 sentences.
4. Focus on my Triad Balance trends (Adult, Child, and Ego scores). Do NOT output action blocks.`;
        }
        case 'morning_brief': return `${commonContext}
Provide a motivating and focus-oriented Morning Briefing for my day ahead.
Focus on:
1. Review the tasks scheduled for today (if any) or guide me to schedule some if empty.
2. Analyze my starting Ego Score and Balance State, and suggest how to keep them optimal today (e.g. how many Adult vs Child tasks to balance).
3. Offer an actionable, positive focus intention for starting the day strong.
Keep it extremely concise (max 3-4 short sentences). Separate thoughts with double newlines (\\n\\n). Do NOT output action blocks.`;
        case 'evening_recap': return `${commonContext}
Provide a personalized, encouraging summary of my day.
Focus on:
1. Analyze the tasks I completed today vs. missed.
2. Evaluate my current Balance Score (Are my brains balanced?).
3. Suggest one specific focus area or correction for tomorrow based on what I accomplished or neglected today.
Keep it extremely concise (max 3-4 short sentences). Separate thoughts with double newlines (\\n\\n). Do NOT output action blocks.`;
        case 'night_reflection': return `${commonContext}
Provide a calming, mindful Night Reflection for winding down my day.
Focus on:
1. Guide me to let go of today's work and unfinished tasks, validating my efforts regardless of the score.
2. Offer a warm, gentle check-in on my recovery space and transition to rest.
3. Suggest one simple, mindful breathing or relaxation tip to prepare for high-quality sleep.
Keep it extremely comforting and concise (max 3-4 short sentences). Separate thoughts with double newlines (\\n\\n). Do NOT output action blocks.`;
        case 'predict': return `${commonContext}
PROPOSE A PERFECT PLAN for the next 24 hours. Identify 2-3 high-impact tasks and schedule them.
Keep your plan explanation extremely concise (max 2-3 short sentences total). Use frequent line breaks and double newlines (\\n\\n) to separate sentences so they render as separate paragraphs rather than dense block text. Place the [ACTION: CREATE_TASK ...] blocks at the very end of your response.`;
        case 'schedule_assist': {
            const title = taskTitle || 'Untitled Task';
            return `You are a scheduling assistant. Given the task title below, analyze it and return ONLY a JSON object (no markdown, no explanation) with your suggestions.

Task Title: "${title}"

Current Context:
- Date: ${currentDateDisplay} (${currentDateKey})
- Time: ${currentTimeStr} (Local)
- Available Slots: ${availableSlots}

Instructions:
1. **Analyze Title**: Extract Task Type, Date, Time, Duration. 
   - Use 'CHILD' for fun, play, creativity, or recharge (user calls this 'fun').
   - Use 'ADULT' for work, responsibilities, effort, and chores.
   - Use 'REST' for sleep, breaks, and recovery.
2. **Date**: If mentioned ("tomorrow"), return specific date. Else "${currentDateKey}".
3. **Time**: If mentioned, use it. Else suggest a slot based on balance: ADULT in morning/afternoon, CHILD/REST in evening.
4. **Duration**: Explicit or inferred (Gym=60, Call=30, Fun=varies). Default 30.

Respond with ONLY this JSON format:
{"suggestedType": "ADULT" | "CHILD" | "REST", "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:MM", "duration": 30}`;
        }
        default: return 'Give me general advice about maintaining mental balance.';
    }
}

export interface SuggestedAction {
    type: 'CREATE_TASK' | 'REMEMBER';
    title?: string;
    taskType?: 'ADULT' | 'CHILD' | 'REST';
    duration?: number;
    scheduledDate?: string;
    scheduledTime?: string;
    projectedScore?: number;
    fact?: string;
}

export function parseCoachResponse(text: string): { cleanText: string; actions: SuggestedAction[]; thought?: string } {
    let cleanText = text;
    let thought: string | undefined;

    // 1. Extract Thought (handles both closed and streaming unclosed tags)
    // We use case-insensitive regex to handle <THINK>, <Thought>, etc.
    const tagRegex = /<(thought|think)[^>]*>/i;
    
    let match = cleanText.match(tagRegex);
    while (match && match.index !== undefined) {
        const startIdx = match.index;
        const tagName = match[1].toLowerCase();
        const startTagEnd = cleanText.indexOf('>', startIdx);
        
        if (startTagEnd !== -1) {
            const closingTagRegex = new RegExp(`</${tagName}[^>]*>`, 'i');
            const closingMatch = cleanText.substring(startTagEnd + 1).match(closingTagRegex);
            
            if (closingMatch && closingMatch.index !== undefined) {
                const endIdx = startTagEnd + 1 + closingMatch.index;
                const endTagEnd = cleanText.indexOf('>', endIdx);
                if (endTagEnd !== -1) {
                    // Fully closed tag
                    const currentThought = cleanText.substring(startTagEnd + 1, endIdx).trim();
                    thought = thought ? thought + '\n\n' + currentThought : currentThought;
                    cleanText = cleanText.substring(0, startIdx) + cleanText.substring(endTagEnd + 1);
                    cleanText = cleanText.trim();
                } else {
                    // End tag started but not yet closed - treat as streaming
                    const currentThought = cleanText.substring(startTagEnd + 1, endIdx).trim();
                    thought = thought ? thought + '\n\n' + currentThought : currentThought;
                    cleanText = cleanText.substring(0, startIdx).trim();
                }
            } else {
                // Streaming/unclosed tag - extract the streaming thought, keep main content empty
                const currentThought = cleanText.substring(startTagEnd + 1).trim();
                thought = thought ? thought + '\n\n' + currentThought : currentThought;
                cleanText = cleanText.substring(0, startIdx).trim();
            }
        } else {
            // Found start tag but no closing > for the start tag yet. Treat as streaming from here.
            // Just strip the partial tag and treat the rest as thought
            const currentThought = cleanText.substring(startIdx + match[0].length).trim();
            thought = thought ? thought + '\n\n' + currentThought : currentThought;
            cleanText = cleanText.substring(0, startIdx).trim();
        }
        
        match = cleanText.match(tagRegex);
    }

    // Clean up any stray closing tags that might have been left behind
    cleanText = cleanText.replace(/<\/(thought|think)[^>]*>/gi, '').trim();

    // 2. Extract Actions
    const actions: SuggestedAction[] = [];
    const actionRegex = /\[ACTION:\s*(CREATE_TASK|REMEMBER)\s*\|\s*([^\]]+)\]/gi;
    cleanText = cleanText.replace(actionRegex, (match, actionType, content) => {
        const typeUpper = actionType.toUpperCase();
        
        if (typeUpper === 'REMEMBER') {
            const fact = content.trim();
            if (fact) {
                actions.push({ type: 'REMEMBER', fact });
            }
            return '';
        }

        const parts = content.split('|').map((p: string) => p.trim());
        if (parts.length >= 4) {
            let projectedScore: number | undefined;
            const lastPart = parts[parts.length - 1];
            if (/^[+-]\d+$/.test(lastPart)) {
                projectedScore = parseInt(lastPart);
                parts.pop();
            }

            // Skip template comments or instructions that get echoed back
            const isTemplate = parts[0].toLowerCase() === 'title' || parts[1]?.toLowerCase().includes('type');
            const isDuplicate = actions.some(a => a.type === 'CREATE_TASK' && a.title === parts[0] && a.scheduledTime === (parts.length >= 5 ? parts[4] : parts[3]));
            
            // Fault tolerance: Ensure time format is valid, otherwise don't schedule an invalid time
            let schedTime = parts.length >= 5 ? parts[4] : parts[3];
            if (schedTime && !/^\d{1,2}:\d{2}$/.test(schedTime)) {
                schedTime = undefined;
            }

            if (!isTemplate && !isDuplicate) {
                const taskType = parts[1].toUpperCase() as Task['type'];
                actions.push({
                    type: 'CREATE_TASK',
                    title: parts[0],
                    taskType: ['ADULT', 'CHILD', 'REST'].includes(taskType) ? taskType : 'ADULT',
                    duration: parseInt(parts[2]) || 30,
                    scheduledDate: parts.length >= 5 ? parts[3] : undefined,
                    scheduledTime: schedTime,
                    projectedScore,
                });
            }
        }
        return '';
    });

    return { cleanText, actions, thought };
}
