# Backup y restauración

El backup es un volcado lógico de la base completa con `pg_dump` en formato
`custom`. Incluye el esquema `merma`, los catálogos, los 1,795 hechos y el
historial de cargas. Los archivos viven en `backups/`, que está en `.gitignore`:
**nunca se commitean** porque contienen los datos de producción.

> El proyecto de Neon corre **PostgreSQL 18**. Usa un `pg_dump` de la misma
> versión mayor o superior: un cliente 16 falla con
> `aborting because of server version mismatch`.

## 1. Generar el backup

Con Docker, sin instalar PostgreSQL en la máquina:

```bash
mkdir -p backups
docker run --rm \
  -v "$PWD/backups:/backups" \
  postgres:18-alpine \
  pg_dump "postgresql://<usuario>:<clave>@<host>/<db>?sslmode=require" \
    -Fc --no-owner --no-privileges \
    -f /backups/merma-$(date +%Y-%m-%d).dump
```

Si tienes `pg_dump` 18 instalado, el comando equivalente es:

```bash
pg_dump "$DATABASE_URL" -Fc --no-owner --no-privileges \
  -f backups/merma-$(date +%Y-%m-%d).dump
```

Usa la cadena **directa** de Neon (sin `-pooler`). El pooler sirve para la API,
no para volcados.

## 2. Verificar que el archivo restaura

Nunca des por bueno un backup que no se ha restaurado. Prueba en una base
desechable:

```bash
docker run --rm -d --name merma-restore-test \
  -e POSTGRES_PASSWORD=merma -e POSTGRES_DB=merma_restore \
  -v "$PWD/backups:/backups" postgres:18-alpine

docker exec merma-restore-test pg_restore -U postgres -d merma_restore \
  --no-owner /backups/merma-<fecha>.dump

docker exec merma-restore-test psql -U postgres -d merma_restore -c \
  "select count(*) as hechos, round(sum(costo_total), 4) as costo
     from merma.fact_merma;"

docker rm -f merma-restore-test
```

En Git Bash de Windows hay que anteponer `MSYS_NO_PATHCONV=1` a los `docker
exec` para que no traduzca `/backups/...` a una ruta de Windows.

### Resultado de la verificación del 25/11/2026

| Comprobación | Resultado |
|---|---|
| Archivo | `backups/merma-2026-11-25.dump` · 127 KB |
| Restauración en Postgres 18 desechable | sin errores |
| `count(*)` de `fact_merma` | 1,795 |
| `sum(costo_total)` | `20383.7525` |
| SKUs con merma | 82 |
| Cargas | 1 `completada` |

## 3. Restaurar en producción

Restaurar sobre la base viva sobrescribe datos. El camino seguro es restaurar en
una rama nueva de Neon y cambiar la cadena:

1. Neon → **Branches** → crear una rama desde el estado actual (respaldo del
   respaldo).
2. Restaurar el volcado en la rama con `pg_restore` usando su cadena directa.
3. Verificar los totales con `npm run db:quality` apuntando a esa rama.
4. Cambiar `DATABASE_URL` en Render y redesplegar; comprobar `/api/v1/salud` y
   `/api/v1/kpis`.

Para recuperar solo una tabla o un rango, usa `pg_restore -t merma.fact_merma
--data-only` sobre una base vacía y copia con `insert ... select`.

## 4. Frecuencia

- Antes de cada `replace` masivo o migración de esquema.
- Semanal mientras el tablero esté en uso.
- Conserva al menos el backup anterior a la última carga válida.

## 5. Rollback de la aplicación (sin datos)

| Plataforma | Procedimiento |
|---|---|
| Render | **Deploys** → deploy anterior → **Rollback**. |
| Netlify | **Deploys** → deploy anterior → **Publish deploy**. |

El rollback de la app no toca la base. Si el problema es de datos, restaura el
backup como en el punto 3.
