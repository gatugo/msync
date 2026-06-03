import { parseNaturalDateTime } from './src/lib/datePatterns';

const tests = [
  "What should I do today?",
  "What should I do today",
  "Card game tomorrow",
];

for (const t of tests) {
  const result = parseNaturalDateTime(t);
  console.log(`"${t}" -> Date: ${result.date}, Time: ${result.time}, Remaining: "${result.remainingText}"`);
}
