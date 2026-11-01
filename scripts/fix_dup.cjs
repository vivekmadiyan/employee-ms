const fs = require('fs');
const path = 'src/components/other/TeamManagement.jsx';
let src = fs.readFileSync(path, 'utf8');
// Remove duplicate HelpIcon import
src = src.replace(
  "import { HelpIcon } from './Tooltip';\nimport { HelpIcon } from './Tooltip';",
  "import { HelpIcon } from './Tooltip';"
);
fs.writeFileSync(path, src, 'utf8');
console.log('Duplicate removed');

