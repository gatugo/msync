import { describe, it, expect } from 'vitest';
import { generateSmartInsight, detectTaskType, parseOfflineTask } from '../src/lib/smartLogic';

describe('Smart Logic - Task Detection', () => {
    it('detects REST tasks correctly', () => {
        expect(detectTaskType('take a nap')).toBe('REST');
        expect(detectTaskType('do some yoga')).toBe('REST');
        expect(detectTaskType('meditate for 10 mins')).toBe('REST');
    });

    it('detects CHILD tasks correctly', () => {
        expect(detectTaskType('play video games')).toBe('CHILD');
        expect(detectTaskType('watch a movie')).toBe('CHILD');
        expect(detectTaskType('eat some ice cream')).toBe('CHILD');
    });

    it('detects ADULT tasks correctly', () => {
        expect(detectTaskType('pay the bills')).toBe('ADULT');
        expect(detectTaskType('meeting with boss')).toBe('ADULT');
        expect(detectTaskType('grocery shopping')).toBe('ADULT');
    });

    it('defaults to ADULT for unknown tasks', () => {
        expect(detectTaskType('do something obscure')).toBe('ADULT');
    });
});

describe('Smart Logic - Generate Insight', () => {
    it('warns about pure adult mode', () => {
        const insight = generateSmartInsight('neutral', 50, 5, 0, 0);
        expect(insight).toContain('pure Adult mode');
        expect(insight).toContain('MUST schedule something fun or restful');
    });

    it('warns about pure child mode', () => {
        const insight = generateSmartInsight('neutral', 50, 0, 5, 0);
        expect(insight).toContain('Child mode');
        expect(insight).toContain('Try to tackle one small productive task');
    });

    it('handles anxiety balance', () => {
        const insight = generateSmartInsight('anxiety', 60, 4, 1, 0);
        expect(insight).toContain('over-functioning');
        expect(insight).toContain('Permission granted to stop working');
    });

    it('handles depression balance', () => {
        const insight = generateSmartInsight('depression', 20, 1, 1, 1);
        expect(insight).toContain('activity level is low');
        expect(insight).toContain('Set a small goal');
    });

    it('handles optimal balance', () => {
        const insight = generateSmartInsight('optimal', 85, 3, 2, 1);
        expect(insight).toContain('Excellent balance!');
    });
});
