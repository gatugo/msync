import { test, expect } from '@playwright/test';
import { buildPrompt, parseCoachResponse } from '../src/lib/coachLogic';

test('AI should not implicitly select time when none is provided', async () => {
  const request = {
    mode: 'schedule_assist',
    taskTitle: 'Buy groceries tomorrow',
    localDate: '2026-06-03',
    localTime: '15:00',
    tasks: [],
  };
  
  const prompt = buildPrompt(request);
  
  // The prompt should contain the instructions to NOT guess the time
  expect(prompt).toContain('If not mentioned, return an empty string "". Do NOT suggest or guess a time.');
});
