import { buildApp } from "./app.js";
import { cargarConfig } from "./config.js";
import { crearPool } from "./db.js";

const config = cargarConfig();
if (config.appEnv === "production" && !config.sesion) {
  throw new Error(
    "En producción define ADMIN_USER, ADMIN_PASSWORD_HASH y SESSION_SECRET para proteger las escrituras",
  );
}
const pool = crearPool(config.databaseUrl);
const app = await buildApp({
  pool,
  corsOrigins: config.corsOrigins,
  cacheTtlSeconds: config.cacheTtlSeconds,
  rateLimitMax: config.rateLimitMax,
  uploadMaxBytes: config.uploadMaxBytes,
  sesion: config.sesion,
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
