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
  CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
  ADMIN_TOKEN: z.preprocess(
    (valor) =>
      typeof valor === "string" && valor.trim() === "" ? undefined : valor,
    z
      .string()
      .min(16, "ADMIN_TOKEN debe tener al menos 16 caracteres")
      .optional(),
  ),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(20),
});

export type Config = {
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  appEnv: "development" | "test" | "production";
  cacheTtlSeconds: number;
  rateLimitMax: number;
  adminToken: string | null;
  uploadMaxBytes: number;
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
    cacheTtlSeconds: resultado.data.CACHE_TTL_SECONDS,
    rateLimitMax: resultado.data.RATE_LIMIT_MAX,
    adminToken: resultado.data.ADMIN_TOKEN ?? null,
    uploadMaxBytes: resultado.data.UPLOAD_MAX_MB * 1024 * 1024,
  };
}
