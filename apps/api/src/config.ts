import { config as cargarEnv } from "dotenv";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const esquema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Config = {
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  appEnv: "development" | "test" | "production";
};

export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  cargarEnv({ path: path.resolve(AQUI, "../.env") });

  const resultado = esquema.safeParse(env);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuración inválida: ${detalle}`);
  }

  return {
    databaseUrl: resultado.data.DATABASE_URL,
    port: resultado.data.PORT,
    corsOrigins: resultado.data.CORS_ORIGINS.split(",")
      .map((origen) => origen.trim())
      .filter(Boolean),
    appEnv: resultado.data.APP_ENV,
  };
}
