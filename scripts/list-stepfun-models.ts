import fs from 'fs';
import path from 'path';

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) {
            console.error('⚠️ .env.local not found');
            return;
        }
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const index = trimmed.indexOf('=');
            if (index === -1) return;
            const key = trimmed.substring(0, index).trim();
            const value = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = value;
        });
    } catch (err) {
        console.error('Failed to load env variables:', err);
    }
}

loadEnv();

const STEPFUN_API_KEY = process.env.STEPFUN_API_KEY;
if (!STEPFUN_API_KEY) {
    console.error('❌ Error: STEPFUN_API_KEY is not defined in .env.local');
    process.exit(1);
}

async function listModels() {
    console.log('🤖 Fetching StepFun models list...');
    try {
        const response = await fetch('https://api.stepfun.ai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${STEPFUN_API_KEY}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP error ${response.status}: ${errorText}`);
            process.exit(1);
        }

        const data = await response.json();
        console.log('\n✅ StepFun Models Available:');
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Failed to fetch models:', err);
    }
}

listModels();
