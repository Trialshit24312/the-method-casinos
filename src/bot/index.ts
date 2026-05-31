import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { setupCommandHandler, registerSlashCommands } from './commands.js';
import { getStats } from '../database/index.js';
import { getPublicSiteUrl } from '../shared/site.js';
import { setBotClient, setBotReady } from './state.js';
import { registerBotForShutdown } from '../shared/shutdown.js';

export async function startBot(): Promise<Client> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is required');

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  setBotClient(client);
  registerBotForShutdown(client);

  setupCommandHandler(client);

  client.once('clientReady', async () => {
    setBotReady(true);
    console.log(`🤖 Bot logged in as ${client.user?.tag}`);

    const stats = getStats();
    const siteUrl = process.env.PUBLIC_SITE_URL || process.env.DASHBOARD_URL;
    const activityName = siteUrl
      ? `${stats.totalCasinos} casinos | ${getPublicSiteUrl()}`
      : `${stats.totalCasinos} casinos | /help`;
    client.user?.setActivity({
      name: activityName.slice(0, 128),
      type: ActivityType.Watching,
    });

    if (process.env.DISCORD_CLIENT_ID) {
      try {
        await registerSlashCommands(process.env.DISCORD_CLIENT_ID, token);
      } catch (err) {
        console.warn('Could not auto-register commands:', err);
      }
    }
  });

  await client.login(token);
  return client;
}
