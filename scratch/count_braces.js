const fs = require('fs');
const content = fs.readFileSync('src/app/user/page.tsx', 'utf8');

function count(char, str) {
  let count = 0;
  for (let c of str) if (c === char) count++;
  return count;
}

console.log('Braces {}:', count('{', content), count('}', content));
console.log('Parens ():', count('(', content), count(')', content));
console.log('Brackets []:', count('[', content), count(']', content));
console.log('Angle Brackets <>:', count('<', content), count('>', content));
