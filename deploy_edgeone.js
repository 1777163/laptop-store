const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'inline.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

console.log('HTML size:', (html.length / 1024).toFixed(0), 'KB');

// Use mcporter to deploy
const cmd = `npx -y mcporter call mcp-on-edge.edgeone.app/mcp-server.deploy-html value="${html.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

console.log('Deploying via EdgeOne Pages...');
try {
  const result = execSync(cmd, { 
    encoding: 'utf-8', 
    maxBuffer: 50 * 1024 * 1024, // 50MB
    timeout: 120000 
  });
  console.log('Result:', result);
} catch (e) {
  console.log('Stdout:', e.stdout);
  console.log('Stderr:', e.stderr);
}
