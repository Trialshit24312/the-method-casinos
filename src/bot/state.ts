import type { Client } from 'discord.js';

let botClient: Client | null = null;
let botReady = false;

export function setBotClient(client: Client): void {
  botClient = client;
}

export function setBotReady(ready: boolean): void {
  botReady = ready;
}

export function getBotClient(): Client | null {
  return botClient;
}

export function getBotHealth(): { connected: boolean; tag: string | null } {
  return {
    connected: botReady && Boolean(botClient?.isReady()),
    tag: botClient?.user?.tag ?? null,
  };
}
