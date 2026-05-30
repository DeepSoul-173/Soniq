const fs = require('fs');
const path = require('path');

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let originalContent = fs.readFileSync(fullPath, 'utf8');
      
      const regex = /(import\s+.*?from\s+['"])(\.\.?\/[^'"]+)(['"])/g;
      const newContent = originalContent.replace(regex, (match, prefix, relPath, suffix) => {
        const absolutePath = path.resolve(path.dirname(fullPath), relPath);
        const appRoot = path.resolve('.'); // script will be run in app directory
        
        // If the resolved path falls under the `src` directory
        if (absolutePath.startsWith(path.join(appRoot, 'src'))) {
           // Convert Windows backslashes to forward slashes
           const aliasPath = '@' + absolutePath.substring(appRoot.length).replace(/\\/g, '/');
           return `${prefix}${aliasPath}${suffix}`;
        }
        return match;
      });
      
      if (originalContent !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('./app');
processDir('./src');
console.log('Done fixing imports.');
