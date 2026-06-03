import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { setupCommandHandler, registerSlashCommands } from './commands.js';
import { getStats } from '../database/index.js';
import { getPublicSiteUrl } from '../shared/site.js';
import { setBotClient, setBotReady } from './state.js';
import { registerBotForShutdown } from '../shared/shutdown.js';
import { BRAND_MOTTO } from './brand.js';

function buildActivities(): { name: string; type: ActivityType }[] {
  const stats = getStats();
  const site = getPublicSiteUrl();
  return [
    { name: `${stats.verifiedCasinos} verified casinos`, type: ActivityType.Watching },
    { name: '/similar · free web search', type: ActivityType.Listening },
    { name: `${stats.noPhoneCasinos} no-phone signups`, type: ActivityType.Watching },
    { name: BRAND_MOTTO.slice(0, 128), type: ActivityType.Playing },
    { name: site.replace(/^https?:\/\//, ''), type: ActivityType.Watching },
    { name: '/check · URL safety', type: ActivityType.Listening },
  ];
}

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

    const activities = buildActivities();
    let idx = 0;
    const setActivity = () => {
      const a = activities[idx % activities.length]!;
      client.user?.setActivity({ name: a.name.slice(0, 128), type: a.type });
      idx++;
    };
    setActivity();
    setInterval(setActivity, 45_000);

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
