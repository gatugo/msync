import http from 'http';

const postData = JSON.stringify({
  prompt: "Hello, Coach! Are you working?",
  history: [],
  mode: "advice",
  tasks: [],
  goals: [],
  balance: 50,
  score: 100
});

const req = http.request(
  'http://localhost:3001/api/coach',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  },
  (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    
    let fullResponse = '';
    res.on('data', (chunk) => {
      process.stdout.write(chunk);
      fullResponse += chunk;
    });
    
    res.on('end', () => {
      console.log('\n\n--- END OF STREAM ---');
    });
  }
);

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
