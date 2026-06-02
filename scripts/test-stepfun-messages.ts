import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const STEPFUN_API_KEY = envContent.match(/STEPFUN_API_KEY=(.*)/)?.[1]?.trim();

async function testMessagesApi() {
    console.log('🧪 Testing StepFun Messages API (Anthropic Format)');
    
    const response = await fetch('https://api.stepfun.ai/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': STEPFUN_API_KEY as string,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'step-3.7-flash',
            max_tokens: 1024,
            messages: [
                { role: 'user', content: 'Hi, who are you?' }
            ]
        })
    });

    if (!response.ok) {
        console.error('❌ Failed:', response.status, await response.text());
        return;
    }

    const data = await response.json();
    console.log('✅ Success:', JSON.stringify(data, null, 2));
}

testMessagesApi();
