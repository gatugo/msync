
import { buildPrompt, calculateFreeSlots } from '../src/lib/coachLogic';

// --- Mock Data ---
const mockTasks = [
    { id: '1', title: 'Morning Meeting', scheduledDate: '2026-01-26', scheduledTime: '09:00', duration: 60, status: 'TODO' as const, type: 'ADULT' as const, createdAt: new Date().toISOString() },
    { id: '2', title: 'Lunch', scheduledDate: '2026-01-26', scheduledTime: '12:00', duration: 30, status: 'TODO' as const, type: 'REST' as const, createdAt: new Date().toISOString() }
];

const mockRequest = {
    mode: 'chat',
    localDate: '2026-01-26',
    localTime: '10:00',
    tasks: mockTasks,
    score: 80,
    balance: 'optimal',
    question: 'What should I do?',
    preferences: { 
        hobbies: ['Reading'], 
        interests: ['Tech'], 
        passions: ['AI'], 
        work: ['Dev'], 
        sleepStartTime: '23:00', 
        sleepEndTime: '06:00' 
    }
};

// --- Tests ---
console.log('=== Testing AI Logic ===');
let passed = 0;
let total = 0;

function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
        console.log(`[PASS] ${desc}`);
        passed++;
    } else {
        console.error(`[FAIL] ${desc}`);
    }
}

// 1. Test Free Slots Calculation
const slots = calculateFreeSlots(mockTasks, '2026-01-26', mockRequest.preferences);
// 06:00 - 09:00 (3h), 09:00-10:00 (busy: 09-10), 10:00-12:00 (2h), 12:00-12:30 (busy), 12:30-23:00
// Note: buildPrompt logic might filter "past" slots if it was smart, but calculateFreeSlots just does simple math based on day.
// Actual output format: "6am - 9am, 10am - 12pm, 12:30pm - 11pm"
// Note: format12h returns "10am" not "10:00am" if minutes are 0.

assert(slots.includes('10am - 12pm'), 'Calculates free slots correctly (Morning gap)');
assert(slots.includes('12:30pm - 11pm'), 'Calculates free slots correctly (Afternoon block)');

// 2. Test Prompt Generation
const prompt = buildPrompt(mockRequest);
assert(prompt.includes('2026-01-26'), 'Prompt includes correct date');
assert(prompt.includes('Ego Score: 80/100'), 'Prompt includes correct score');
assert(prompt.includes('Morning Meeting (ADULT at 09:00)'), 'Prompt includes correct task list');

// 3. Test Response Parsing (Action Blocks)
import { parseCoachResponse } from '../src/lib/coachLogic';

const sampleResponse = `
I think you should take a break.
<thought>User needs rest.</thought>
[ACTION: CREATE_TASK | Stare at Wall | REST | 15 | 2026-01-26 | 14:00 | +5]
Also maybe do some work later.
[ACTION: CREATE_TASK | Deep Work | ADULT | 60 | 2026-01-26 | 15:00]
`;

const parsed = parseCoachResponse(sampleResponse);

assert(parsed.thought === 'User needs rest.', 'Parsed logic thought correctly');
assert(parsed.actions.length === 2, 'Parsed 2 actions from response');
assert(parsed.actions[0].title === 'Stare at Wall', 'Parsed Action 1 Title');
assert(parsed.actions[0].projectedScore === 5, 'Parsed Action 1 Score');
assert(parsed.actions[1].title === 'Deep Work', 'Parsed Action 2 Title');



// Summary
console.log(`\nPassed ${passed}/${total}`);
if (passed === total) process.exit(0);
else process.exit(1);
