import { createHash } from "node:crypto";

import { LRUCache } from "lru-cache";

export class CacheApi {
  private readonly lru: LRUCache<string, object>;

  constructor(
    public readonly ttlSegundos = 60,
    maximo = 256,
  ) {
    this.lru = new LRUCache({
      max: maximo,
      ttl: ttlSegundos * 1000,
    });
  }

  async obtener<T extends object>(
    clave: string,
    calcular: () => Promise<T>,
  ): Promise<T> {
    const guardado = this.lru.get(clave);
    if (guardado !== undefined) return guardado as T;

    const valor = await calcular();
    this.lru.set(clave, valor);
    return valor;
  }

  limpiar(): void {
    this.lru.clear();
  }
}

export function claveCache(ruta: string, valor: unknown): string {
  const hash = createHash("sha1")
    .update(JSON.stringify([ruta, valor]))
    .digest("hex");
  return `${ruta}:${hash}`;
}

declare module "fastify" {
  interface FastifyInstance {
    cache: CacheApi;
  }
}
