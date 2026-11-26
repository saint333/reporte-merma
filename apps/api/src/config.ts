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
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(20),
  ADMIN_USER: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    z.string().min(1).optional(),
  ),
  ADMIN_PASSWORD_HASH: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    z.string().startsWith("scrypt$", "ADMIN_PASSWORD_HASH debe ser un hash scrypt").optional(),
  ),
  SESSION_SECRET: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    z
      .string()
      .min(32, "SESSION_SECRET debe tener al menos 32 caracteres")
      .optional(),
  ),
});

export type Config = {
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  appEnv: "development" | "test" | "production";
  cacheTtlSeconds: number;
  rateLimitMax: number;
  uploadMaxBytes: number;
  sesion: {
    usuario: string;
    passwordHash: string;
    secreto: string;
  } | null;
};

function sesionDesde(datos: z.infer<typeof esquema>): Config["sesion"] {
  const { ADMIN_USER, ADMIN_PASSWORD_HASH, SESSION_SECRET } = datos;
  if (!ADMIN_USER && !ADMIN_PASSWORD_HASH && !SESSION_SECRET) return null;

  if (!ADMIN_USER || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
    throw new Error(
      "Configuración inválida: ADMIN_USER, ADMIN_PASSWORD_HASH y SESSION_SECRET deben definirse juntos",
    );
  }

  return {
    usuario: ADMIN_USER,
    passwordHash: ADMIN_PASSWORD_HASH,
    secreto: SESSION_SECRET,
  };
}

function corsDesde(
  valor: string,
  appEnv: Config["appEnv"],
): string[] {
  const origenes = valor
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);

  if (appEnv !== "production") return origenes;

  if (origenes.length === 0) {
    throw new Error("Configuración inválida: CORS_ORIGINS es obligatoria en producción");
  }

  for (const origen of origenes) {
    if (!origen.startsWith("https://") || /localhost|127\.0\.0\.1/.test(origen)) {
      throw new Error(
        `Configuración inválida: CORS_ORIGINS debe listar orígenes https:// públicos en producción (recibido: ${origen})`,
      );
    }
  }

  return origenes;
}

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
    corsOrigins: corsDesde(resultado.data.CORS_ORIGINS, resultado.data.APP_ENV),
    appEnv: resultado.data.APP_ENV,
    cacheTtlSeconds: resultado.data.CACHE_TTL_SECONDS,
    rateLimitMax: resultado.data.RATE_LIMIT_MAX,
    uploadMaxBytes: resultado.data.UPLOAD_MAX_MB * 1024 * 1024,
    sesion: sesionDesde(resultado.data),
  };
}
