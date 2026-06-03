import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, it, expect } from 'vitest';

describe('data path resolution', () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(async () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    const { resetDataDirCacheForTests } = await import('../src/shared/data-path.js');
    resetDataDirCacheForTests();
  });

  function saveEnv(keys: string[]): void {
    for (const k of keys) prev[k] = process.env[k];
  }

  it('uses DATA_DIR when set', async () => {
    saveEnv(['DATA_DIR', 'RENDER', 'NODE_ENV']);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-data-dir-'));
    process.env.DATA_DIR = dir;
    delete process.env.RENDER;

    const { resolveDataDir } = await import('../src/shared/data-path.js');
    expect(resolveDataDir()).toBe(path.resolve(dir));
  });

  it('falls back to cwd/data on Render when /var/data is not writable', async () => {
    saveEnv(['DATA_DIR', 'RENDER', 'NODE_ENV']);
    delete process.env.DATA_DIR;
    process.env.RENDER = 'true';

    const { resolveDataDir } = await import('../src/shared/data-path.js');
    const dir = resolveDataDir();
    expect(dir).toBe(path.resolve(path.join(process.cwd(), 'data')));
  });

  it('ignores non-writable DATA_DIR', async () => {
    saveEnv(['DATA_DIR', 'RENDER', 'NODE_ENV']);
    process.env.DATA_DIR = '/var/data';
    process.env.RENDER = 'true';

    const { resolveDataDir } = await import('../src/shared/data-path.js');
    const dir = resolveDataDir();
    expect(dir).not.toBe('/var/data');
  });
});
