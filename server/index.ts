import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
const config = loadConfig();
const { app, db } = await createApp(config);
const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`API SisMant: http://${config.HOST}:${config.PORT}/api/v1`);
  console.log(`Origen permitido: ${config.APP_ORIGIN}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  });
server.on('error', async error => {
  console.error(error.message);
  await db.close();
  process.exit(1);
});
