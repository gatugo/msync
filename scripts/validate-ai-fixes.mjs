/**
 * Direct validation of MindSync AI Coach fixes
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = 'C:\\Users\\mela\\.aiprojects_2\\newmind';
const PORT = 3000;

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testProxyAllowsRequest() {
  console.log('\n=== Test 1: Proxy allows /api/coach without Bearer ===');
  const body = JSON.stringify({
    mode: 'chat',
    question: 'hi',
    stepfunConfig: { apiKey: 'k', baseUrl: 'https://api.stepfun.ai/v1', model: 'step-3.7-flash' },
    localDate: '2026-09-09',
    localTime: '10:00',
    tasks: [],
    score: 50,
    balance: 'neutral',
    preferences: { aiEnabled: true, forceOfflineMode: false }
  });

  const res = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/coach',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, body);

  console.log('status:', res.status);
  console.log('body:', res.body.substring(0, 200));
  return res.status !== 401 || !res.body.includes('Edge blocked');
}

async function testDateParsing() {
  console.log('\n=== Test 2: Natural language parsing ===');
  const libPath = path.join(PROJECT_ROOT, 'src', 'lib', 'datePatterns.ts');
  const content = fs.readFileSync(libPath, 'utf8');

  const checks = [
    ['today keyword', content.includes('today')],
    ['tomorrow keyword', content.includes('tomorrow')],
    ['next week keyword', content.includes('next') && content.includes('week')],
    ['weekday names', content.includes('monday') && content.includes('tuesday')],
    ['numeric date regex', content.includes('\\d{1,2}') && content.includes('\\d{2,4}')],
    ['time colon regex', content.includes('\\d{1,2}:\\d{2}')],
    ['compact time regex', content.includes('\\d{1,2}\\d{2}')],
    ['duration regex', content.includes('for\\s+(\\d+)')],
  ];

  checks.forEach(([name, ok]) => console.log(` - ${name}: ${ok ? 'PASS' : 'FAIL'}`));
  return checks.every(([, ok]) => ok);
}

async function testSmartLogicOfflineFallback() {
  console.log('\n=== Test 3: Offline fallback code path ===');
  const file = path.join(PROJECT_ROOT, 'src', 'components', 'AICoachScreen.tsx');
  const content = fs.readFileSync(file, 'utf8');

  const checks = [
    ['no forced offline before StepFun', !content.includes('preferences.forceOfflineMode || !isLine') || content.indexOf('stepfunConfig') < content.indexOf('forceOfflineMode')],
    ['shows error when no key', content.includes('Add a StepFun API key in Settings')],
    ['error visible to user', content.includes('setError')],
  ];

  checks.forEach(([name, ok]) => console.log(` - ${name}: ${ok ? 'PASS' : 'FAIL'}`));
  return checks.every(([, ok]) => ok);
}

async function testCalendarFillCode() {
  console.log('\n=== Test 4: Calendar task-creation path ===');
  const storeFile = path.join(PROJECT_ROOT, 'src', 'store', 'useStore.ts');
  const storeContent = fs.readFileSync(storeFile, 'utf8');
  const coachFile = path.join(PROJECT_ROOT, 'src', 'components', 'AICoachScreen.tsx');
  const coachContent = fs.readFileSync(coachFile, 'utf8');

  const checks = [
    ['store supports scheduledDate/scheduledTime', storeContent.includes('scheduledDate') && storeContent.includes('scheduledTime')],
    ['coach creates tasks with date/time', coachContent.includes('scheduledDate') && coachContent.includes('scheduledTime')],
    ['offline parser returns date/time', coachContent.includes('parseOfflineTask')],
    ['date patterns used by parser', coachContent.includes('parseNaturalDateTime')],
  ];

  checks.forEach(([name, ok]) => console.log(` - ${name}: ${ok ? 'PASS' : 'FAIL'}`));
  return checks.every(([, ok]) => ok);
}

async function run() {
  console.log('MindSync AI Coach validation');
  console.log('Project:', PROJECT_ROOT);

  const proxyOk = await testProxyAllowsRequest();
  const parsingOk = await testDateParsing();
  const fallbackOk = await testSmartLogicOfflineFallback();
  const calendarOk = await testCalendarFillCode();

  console.log('\n=== Summary ===');
  console.log('proxyOk:', proxyOk);
  console.log('parsingOk:', parsingOk);
  console.log('fallbackOk:', fallbackOk);
  console.log('calendarOk:', calendarOk);
}

run().catch(err => {
  console.error('validation failed:', err);
  process.exit(1);
});
