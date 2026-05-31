import 'dotenv/config';
import { initDatabase } from './database/index.js';
import { startBot } from './bot/index.js';
import { startServer } from './server/index.js';
import { setupGracefulShutdown } from './shared/shutdown.js';
import { scheduleBackgroundJobs } from './shared/scheduler.js';

async function main(): Promise<void> {
  console.log('🎰 Starting The Method Casinos...\n');

  initDatabase();
  console.log('✅ Database initialized');

  setupGracefulShutdown();
  startServer();
  scheduleBackgroundJobs();

  try {
    await startBot();
  } catch (err) {
    console.error('❌ Bot failed to start:', err);
    console.log('⚠️  Server is still running — fix DISCORD_BOT_TOKEN to enable the bot');
  }
}

main().catch(console.error);
