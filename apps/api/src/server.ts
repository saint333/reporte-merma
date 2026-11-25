import { buildApp } from "./app.js";
import { cargarConfig } from "./config.js";
import { crearPool } from "./db.js";

const config = cargarConfig();
const pool = crearPool(config.databaseUrl);
const app = await buildApp({
  pool,
  corsOrigins: config.corsOrigins,
  cacheTtlSeconds: config.cacheTtlSeconds,
  rateLimitMax: config.rateLimitMax,
  adminToken: config.adminToken,
  uploadMaxBytes: config.uploadMaxBytes,
});

const cerrar = async (senal: string) => {
  app.log.info(`Cerrando por ${senal}`);
  await app.close();
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void cerrar("SIGINT"));
process.once("SIGTERM", () => void cerrar("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: config.port });
