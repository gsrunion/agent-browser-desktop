// Keep arbitrary Playwright code execution out of the default tool surface.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const blocked = new Set(['browser_run_code', 'browser_run_code_unsafe']);
const child = spawn(process.execPath, [
  '/opt/mcp/node_modules/@playwright/mcp/cli.js',
  '--cdp-endpoint', 'http://127.0.0.1:9222',
  '--output-dir', '/downloads', '--file-paths', 'relative',
], { stdio: ['pipe', 'pipe', 'inherit'] });

createInterface({ input: process.stdin }).on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.method === 'tools/call' && blocked.has(message.params?.name)) {
    if (message.id !== undefined) process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', id: message.id,
      error: { code: -32602, message: 'Arbitrary code execution is disabled.' },
    }) + '\n');
    return;
  }
  child.stdin.write(line + '\n');
}).on('close', () => child.stdin.end());

createInterface({ input: child.stdout }).on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.result?.tools) {
    message.result.tools = message.result.tools.filter(tool => !blocked.has(tool.name));
  }
  process.stdout.write(JSON.stringify(message) + '\n');
});
child.on('error', error => { console.error(error.message); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}
