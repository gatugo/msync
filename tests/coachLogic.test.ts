import { describe, it, expect } from 'vitest';
import { parseCoachResponse } from '../src/lib/coachLogic';

describe('coachLogic - parseCoachResponse', () => {
    it('should parse CREATE_TASK', () => {
        const result = parseCoachResponse('Hello [ACTION: CREATE_TASK | My Task | ADULT | 30 | 2026-06-04 | 12:00]');
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].type).toBe('CREATE_TASK');
        expect(result.actions[0].title).toBe('My Task');
    });

    it('should parse RESCHEDULE_TASK', () => {
        const result = parseCoachResponse('Hello [ACTION: RESCHEDULE_TASK | 12345 | 2026-06-04 | 15:00 | 45]');
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].type).toBe('RESCHEDULE_TASK');
        expect(result.actions[0].taskId).toBe('12345');
        expect(result.actions[0].scheduledDate).toBe('2026-06-04');
        expect(result.actions[0].scheduledTime).toBe('15:00');
        expect(result.actions[0].duration).toBe(45);
    });

    it('should parse SORT_TASKS', () => {
        const result = parseCoachResponse('Sorting... [ACTION: SORT_TASKS | id1, id2, id3]');
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].type).toBe('SORT_TASKS');
        expect(result.actions[0].taskIds).toEqual(['id1', 'id2', 'id3']);
    });

    it('should parse LEARN_PATTERN', () => {
        const result = parseCoachResponse('Learning... [ACTION: LEARN_PATTERN | User likes to read | 0.95]');
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].type).toBe('LEARN_PATTERN');
        expect(result.actions[0].pattern).toBe('User likes to read');
        expect(result.actions[0].confidence).toBe(0.95);
    });
});
