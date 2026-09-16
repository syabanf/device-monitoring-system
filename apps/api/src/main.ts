import { buildApp } from './app';
import { disconnect, prisma } from './db/client';
import { loadEnv } from './env';
import { outboxDispatcher } from './jobs/dispatch';
import { createQueue } from './jobs/queue';
import { noopNotifier } from './notify/notifier';

const env = loadEnv();
const db = prisma();
const queue = createQueue(env);
const app = await buildApp({ env, db, queue });
queue.setHandler(outboxDispatcher(db, noopNotifier(app.log), app.log));

app.addHook('onClose', async () => {
  await queue.close();
  await disconnect();
});

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err, 'failed to start');
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    void app.close().then(() => process.exit(0));
  });
}
