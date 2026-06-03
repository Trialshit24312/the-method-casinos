import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase } from '../src/database/index.js';
import { analyzeUrlFromClientHtml } from '../src/discovery/engine.js';

describe('analyzeUrlFromClientHtml', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-browser-html-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('accepts sweepstakes HTML from client', () => {
    const html = `
      <html><head><title>Test Sweeps Casino</title>
      <meta name="description" content="Social casino with sweeps coins and gold coins. No purchase necessary."/>
      </head><body>
      Play for free with sweepstakes casino sweeps coins. Redeem sweeps cash prizes.
      </body></html>
    `;
    const result = analyzeUrlFromClientHtml('https://testsweepscasino.us', html, new Set());
    expect(result.raw?.name).toBeTruthy();
    expect(result.raw?.url).toContain('testsweepscasino.us');
  });
});
