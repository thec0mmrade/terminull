// Post-switch checks: the site answers 200 and the BBS port speaks SSH.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Resolve if a GET of `url` returns 200 (redirects are not followed).
 * @param {string} url @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export function checkHttp(url, timeoutMs = 10000) {
  const client = new URL(url).protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, { agent: false, headers: { connection: 'close' } }, (res) => {
      res.resume();
      clearTimeout(timer);
      if (res.statusCode === 200) resolve();
      else reject(new Error(`${url} returned ${res.statusCode}`));
    });
    const timer = setTimeout(() => req.destroy(new Error(`${url} timed out after ${timeoutMs} ms`)), timeoutMs);
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`${url}: ${err.message}`));
    });
  });
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
