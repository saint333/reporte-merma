import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export type Sesion = { usuario: string; expira: number };

type Carga = { sub: string; exp: number; iat: number };

const DURACION_SEGUNDOS = 8 * 60 * 60;

function base64url(entrada: Buffer | string): string {
  return Buffer.from(entrada).toString("base64url");
}

function firmar(cuerpo: string, secreto: string): string {
  return createHmac("sha256", secreto).update(cuerpo).digest("base64url");
}

export function emitirToken(
  usuario: string,
  secreto: string,
  ahora = Math.floor(Date.now() / 1000),
): { token: string; expira: number } {
  const exp = ahora + DURACION_SEGUNDOS;
  const payload: Carga = { sub: usuario, iat: ahora, exp };
  const cuerpo = base64url(JSON.stringify(payload));
  return { token: `${cuerpo}.${firmar(cuerpo, secreto)}`, expira: exp };
}

export function verificarToken(
  token: unknown,
  secreto: string,
  ahora = Math.floor(Date.now() / 1000),
): Sesion | null {
  if (typeof token !== "string") return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes as [string, string];

  const esperada = Buffer.from(firmar(cuerpo, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return null;
  if (!timingSafeEqual(esperada, recibida)) return null;

  let carga: Carga;
  try {
    carga = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as Carga;
  } catch {
    return null;
  }

  if (typeof carga.sub !== "string" || typeof carga.exp !== "number") return null;
  if (carga.exp <= ahora) return null;

  return { usuario: carga.sub, expira: carga.exp };
}

/** Genera un hash scrypt en formato `scrypt$<sal>$<hash>` (ambos en base64url). */
export async function hashPassword(password: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(password, sal, 64);
  return `scrypt$${base64url(sal)}$${base64url(hash)}`;
}

export async function verificarPassword(
  password: string,
  almacenado: string,
): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;

  const sal = Buffer.from(partes[1] ?? "", "base64url");
  const esperado = Buffer.from(partes[2] ?? "", "base64url");
  const calculado = await scryptAsync(password, sal, esperado.length);

  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
