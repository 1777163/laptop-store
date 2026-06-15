const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'inline.html'), 'utf-8');
console.log('HTML size:', (html.length / 1024).toFixed(0), 'KB');
console.log('Deploying via mcporter...\n');

const child = spawn('npx', [
    '-y', 'mcporter', 'call',
    'mcp-on-edge.edgeone.app/mcp-server.deploy-html',
    'value=' + html
], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') },
    cwd: __dirname
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
    stdout += data.toString();
    process.stdout.write(data);
});

child.stderr.on('data', (data) => {
    stderr += data.toString();
    process.stderr.write(data);
});

child.on('close', (code) => {
    console.log(`\nExit code: ${code}`);
    if (stdout) {
        // Look for URL in output
        const urlMatch = stdout.match(/https?:\/\/[^\s"'<>]+/g);
        if (urlMatch) {
            console.log('\n=== URLs found ===');
            urlMatch.forEach(u => {
                if (u.includes('edgeone') || u.includes('pages') || u.includes('app')) {
                    console.log('  ' + u);
                }
            });
        }
    }
});
