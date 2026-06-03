import { afterEach, describe, it, expect } from 'vitest';
import { isRemoteDbSyncEnabled } from '../src/shared/remote-db-sync.js';

describe('remote db sync config', () => {
  const keys = ['REMOTE_DB_SYNC', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT'];
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('is enabled when REMOTE_DB_SYNC and S3 credentials are set', () => {
    for (const k of keys) prev[k] = process.env[k];
    process.env.REMOTE_DB_SYNC = 'true';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_ACCESS_KEY_ID = 'key';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';
    process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(isRemoteDbSyncEnabled()).toBe(true);
  });

  it('is disabled without bucket', () => {
    for (const k of keys) prev[k] = process.env[k];
    process.env.REMOTE_DB_SYNC = '1';
    delete process.env.S3_BUCKET;
    expect(isRemoteDbSyncEnabled()).toBe(false);
  });
});
