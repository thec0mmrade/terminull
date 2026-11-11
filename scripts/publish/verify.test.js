import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { checkHttp, checkSshBanner, withRetries } from './verify.js';

/** @param {import('node:net').Server} server @returns {Promise<number>} */
function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

/** @param {import('node:net').Server} server */
const close = (server) => new Promise((resolve) => server.close(resolve));

/** @param {number} status */
async function httpServer(status) {
  const server = http.createServer((req, res) => { res.writeHead(status); res.end('x'); });
  return { server, port: await listen(server) };
}

/** @param {string} banner */
async function bannerServer(banner) {
  const server = net.createServer((sock) => { sock.on('error', () => {}); sock.end(banner); });
  return { server, port: await listen(server) };
}

test('checkHttp resolves on 200', async () => {
  const { server, port } = await httpServer(200);
  try {
    await checkHttp(`http://127.0.0.1:${port}/`);
  } finally {
    await close(server);
  }
});

test('checkHttp rejects on 500', async () => {
  const { server, port } = await httpServer(500);
  try {
    await assert.rejects(checkHttp(`http://127.0.0.1:${port}/`), /500/);
  } finally {
    await close(server);
  }
});

test('checkSshBanner resolves on an SSH-2.0 banner', async () => {
  const { server, port } = await bannerServer('SSH-2.0-Go\r\n');
  try {
    await checkSshBanner('127.0.0.1', port);
  } finally {
    await close(server);
  }
});

test('checkSshBanner rejects a non-SSH banner', async () => {
  const { server, port } = await bannerServer('HTTP/1.1 400 Bad Request\r\n\r\n');
  try {
    await assert.rejects(checkSshBanner('127.0.0.1', port), /not an SSH banner/);
  } finally {
    await close(server);
  }
});

test('checkSshBanner rejects a closed port within the timeout', async () => {
  const server = net.createServer();
  const port = await listen(server);
  await close(server);
  const start = Date.now();
  await assert.rejects(checkSshBanner('127.0.0.1', port, 1000));
  assert.ok(Date.now() - start < 1000);
});

test('checkSshBanner times out on a silent server', async () => {
  const sockets = new Set();
  const server = net.createServer((sock) => sockets.add(sock));
  const port = await listen(server);
  try {
    await assert.rejects(checkSshBanner('127.0.0.1', port, 200), /timed out/);
  } finally {
    for (const s of sockets) s.destroy();
    await close(server);
  }
});

test('withRetries retries until success', async () => {
  let calls = 0;
  await withRetries(async () => { if (++calls < 3) throw new Error('not yet'); }, { attempts: 5, delayMs: 1 });
  assert.equal(calls, 3);
});

test('withRetries rethrows the last error after the final attempt', async () => {
  let calls = 0;
  await assert.rejects(
    withRetries(async () => { calls++; throw new Error(`fail ${calls}`); }, { attempts: 3, delayMs: 1 }),
    /fail 3/,
  );
  assert.equal(calls, 3);
});

test('withRetries stops when the signal aborts', async () => {
  const ac = new AbortController();
  let calls = 0;
  await assert.rejects(
    withRetries(async () => { calls++; ac.abort(); throw new Error('down'); }, { attempts: 10, delayMs: 10000, signal: ac.signal }),
    /interrupted/,
  );
  assert.equal(calls, 1);
});
