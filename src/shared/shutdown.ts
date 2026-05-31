import type { Server } from 'http';
import type { Client } from 'discord.js';
import { cancelDiscoveryRun } from '../discovery/run-state.js';

let httpServer: Server | null = null;
let botClient: Client | null = null;
let shuttingDown = false;

export function registerHttpServer(server: Server): void {
  httpServer = server;
}

export function registerBotForShutdown(client: Client): void {
  botClient = client;
}

export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — shutting down gracefully…`);

    cancelDiscoveryRun();

    if (botClient?.isReady()) {
      try {
        botClient.destroy();
      } catch {
        /* ignore */
      }
    }

    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer!.close(() => resolve());
        setTimeout(resolve, 5000);
      });
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
