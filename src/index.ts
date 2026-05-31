import 'dotenv/config';
import { initDatabase } from './database/index.js';
import { startBot } from './bot/index.js';
import { startServer } from './server/index.js';

async function main(): Promise<void> {
  console.log('🎰 Starting The Method Casinos...\n');

  initDatabase();
  console.log('✅ Database initialized');

  startServer();

  try {
    await startBot();
  } catch (err) {
    console.error('❌ Bot failed to start:', err);
    console.log('⚠️  Server is still running — fix DISCORD_BOT_TOKEN to enable the bot');
  }
}

main().catch(console.error);
