import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, clearDiscoverySession, saveDiscoverySession, loadDiscoverySession } from '../src/database/index.js';
import {
  startClientDiscovery,
  submitClientSerpResults,
  cancelClientDiscovery,
  type DiscoverySessionState,
} from '../src/discovery/step-engine.js';

describe('client browser serp ingest', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-serp-ingest-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('queues operator links from browser SERP results', async () => {
    cancelClientDiscovery();
    clearDiscoverySession();
    startClientDiscovery(false);

    const state = loadDiscoverySession() as DiscoverySessionState;
    state.phase = 'search';
    state.queryIndex = 0;
    state.pendingClientSearch = { queries: ['sweepstakes casino usa'], searchPages: 1 };
    saveDiscoverySession(state);

    const { queued } = await submitClientSerpResults([
      {
        query: 'sweepstakes casino usa',
        engine: 'duckduckgo',
        links: [
          'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fspinblitz.com',
          'https://bonus.com/deals',
        ],
      },
    ]);

    expect(queued).toBeGreaterThanOrEqual(1);
    cancelClientDiscovery();
  }, 30_000);
});
