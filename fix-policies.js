const fs = require('fs');
let text = fs.readFileSync('schema.sql', 'utf8');

// Find all CREATE POLICY statements and add DROP POLICY IF EXISTS before them
const policyRegex = /CREATE POLICY "([^"]+)"\s+ON\s+([a-zA-Z_]+)/g;

let match;
while ((match = policyRegex.exec(text)) !== null) {
  const policyName = match[1];
  const tableName = match[2];
  const dropStmt = `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n`;
  if (!text.includes(dropStmt)) {
    text = text.replace(match[0], dropStmt + match[0]);
  }
}

fs.writeFileSync('schema.sql', text);
console.log('Added DROP POLICY statements to schema.sql');
