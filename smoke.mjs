import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'container-smoke-check', version: '1.0.0' });
const timeout = setTimeout(() => { console.error('MCP check timed out'); process.exit(1); }, 15000);
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8000/mcp')));
  const { tools } = await client.listTools();
  assert(tools.some(t => t.name === 'browser_navigate'));
  assert(!tools.some(t => ['browser_run_code', 'browser_run_code_unsafe'].includes(t.name)));
  if (process.argv.includes('--verify-session')) {
    const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    assert(!snapshot.isError);
    assert(JSON.stringify(snapshot).includes('Shared browser works'), 'Browser tab was not restored');
    console.log('PASS: browser tab restored after recreation');
  } else if (process.argv.includes('--verify-vnc')) {
    const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    assert(!snapshot.isError);
    assert(JSON.stringify(snapshot).includes('vnc-control'), 'VNC typing did not reach the browser');
    console.log('PASS: VNC keyboard input visible through MCP');
  } else if (!process.argv.includes('--health')) {
    const result = await client.callTool({ name: 'browser_navigate', arguments: {
      url: 'data:text/html,<title>Browser smoke test</title><h1>Shared browser works</h1><label>VNC test<input autofocus></label>',
    } });
    assert(!result.isError, JSON.stringify(result));
    const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    assert(!snapshot.isError);
    assert(JSON.stringify(snapshot).includes('Shared browser works'));
    const click = await client.callTool({ name: 'browser_click', arguments: { target: 'input' } });
    assert(!click.isError, JSON.stringify(click));
    await assert.rejects(client.callTool({ name: 'browser_run_code_unsafe', arguments: { code: '() => 1' } }));
    console.log('PASS: MCP initialization, tool filter, navigation, snapshot, input focus, blocked code call');
  }
} finally {
  await client.close();
  clearTimeout(timeout);
}
