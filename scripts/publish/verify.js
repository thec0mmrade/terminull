// Post-switch checks: the site answers 200 and serves the new release, and the BBS port speaks SSH.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * GET `url` (redirects are not followed); resolve with the body (first 64 KiB) if it returns 200.
 * @param {string} url @param {number} timeoutMs
 * @returns {Promise<string>}
 */
function get200(url, timeoutMs) {
  const client = new URL(url).protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, { agent: false, headers: { connection: 'close' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        clearTimeout(timer);
        reject(new Error(`${url} returned ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { if (body.length < 65536) body += d; });
      res.on('end', () => { clearTimeout(timer); resolve(body); });
      res.on('error', (err) => { clearTimeout(timer); reject(new Error(`${url}: ${err.message}`)); });
    });
    const timer = setTimeout(() => req.destroy(new Error(`${url} timed out after ${timeoutMs} ms`)), timeoutMs);
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`${url}: ${err.message}`));
    });
  });
}

/**
 * Resolve if a GET of `url` returns 200 (redirects are not followed).
 * @param {string} url @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function checkHttp(url, timeoutMs = 10000) {
  await get200(url, timeoutMs);
}

/**
 * Resolve if a GET of `url` returns 200 with exactly `expected` as the body.
 * @param {string} url @param {string} expected @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function checkHttpBody(url, expected, timeoutMs = 10000) {
  const body = await get200(url, timeoutMs);
  if (body !== expected) {
    throw new Error(`${url} serves ${JSON.stringify(body.slice(0, 80))}, expected ${JSON.stringify(expected)}`);
  }
}

/**
 * Resolve if the server's first line starts with `SSH-2.0-`.
 * @param {string} host @param {number} port @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export function checkSshBanner(host, port, timeoutMs = 10000) {
  const where = `ssh ${host} port ${port}`;
  return new Promise((resolve, reject) => {
    let buf = '';
    let done = false;
    /** @param {Error} [err] */
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.destroy();
      if (err) reject(err);
      else resolve();
    };
    const sock = net.connect({ host, port });
    const timer = setTimeout(() => finish(new Error(`${where} timed out after ${timeoutMs} ms`)), timeoutMs);
    sock.setEncoding('latin1');
    sock.on('data', (chunk) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl === -1 && buf.length < 255) return;
      const line = (nl === -1 ? buf : buf.slice(0, nl)).replace(/\r$/, '');
      if (line.startsWith('SSH-2.0-')) finish();
      else finish(new Error(`${where}: not an SSH banner: ${JSON.stringify(line.slice(0, 40))}`));
    });
    sock.on('end', () => finish(new Error(`${where}: closed before sending a banner`)));
    sock.on('error', (err) => finish(new Error(`${where}: ${err.message}`)));
  });
}

/**
 * Run `fn` until it resolves, up to `attempts` times, `delayMs` apart. Rethrows the last
 * error; stops early (with an "interrupted" error) once `signal` aborts.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{attempts?: number, delayMs?: number, signal?: AbortSignal}} [opts]
 * @returns {Promise<T>}
 */
export async function withRetries(fn, { attempts = 10, delayMs = 3000, signal } = {}) {
  for (let i = 1; ; i++) {
    if (signal?.aborted) throw new Error('interrupted');
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted) throw new Error('interrupted');
      if (i >= attempts) throw err;
      try {
        await sleep(delayMs, undefined, { signal });
      } catch {
        throw new Error('interrupted');
      }
    }
  }
}
