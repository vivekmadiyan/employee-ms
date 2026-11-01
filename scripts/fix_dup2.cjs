const fs = require('fs');
const path = 'src/components/other/TeamManagement.jsx';
let src = fs.readFileSync(path, 'utf8');

// Find the first exportCsv block and the second one, remove the first one
// The first was added manually (from the earlier edit_file that used the old pattern)
// Find both occurrences:
const firstIdx = src.indexOf('\n  const exportCsv = () => {');
const secondIdx = src.indexOf('\n  const exportCsv = () => {', firstIdx + 1);

if (secondIdx === -1) {
  console.log('Only one exportCsv found, nothing to remove');
  process.exit(0);
}

// Find the end of the first exportCsv block (closing brace + semicolon)
// Count braces from firstIdx
let depth = 0;
let i = firstIdx;
let started = false;
while (i < secondIdx) {
  if (src[i] === '{') { depth++; started = true; }
  if (src[i] === '}') { depth--; }
  if (started && depth === 0) break;
  i++;
}
// i is at the closing brace of the first exportCsv, skip to ';' 
while (i < src.length && src[i] !== ';') i++;
i++; // include the semicolon

// Remove from firstIdx (inclusive) to i (inclusive)
const firstBlock = src.slice(firstIdx, i);
console.log('Removing first exportCsv block (chars', firstIdx, 'to', i, ')');
src = src.slice(0, firstIdx) + src.slice(i);
fs.writeFileSync(path, src, 'utf8');
console.log('Done - removed duplicate exportCsv');

