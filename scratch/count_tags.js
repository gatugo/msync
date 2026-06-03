const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, '../src/components/SettingsTab.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const openDivs = (content.match(/<div(?!\s*\/>)/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;
const selfClosingDivs = (content.match(/<div[^>]*\/>/g) || []).length;
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`File: ${filePath}`);
console.log(`Open <div: ${openDivs}`);
console.log(`Close </div: ${closeDivs}`);
console.log(`Self-closing <div: ${selfClosingDivs}`);
console.log(`Total non-self-closing divs needed: ${openDivs}`);
console.log(`Total closing divs found: ${closeDivs}`);
console.log(`Balanced: ${openDivs === closeDivs}`);
console.log(`Braces: ${openBraces} open, ${closeBraces} close`);
console.log(`Parens: ${openParens} open, ${closeParens} close`);
