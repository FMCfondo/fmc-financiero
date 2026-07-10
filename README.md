# FMC Financiero

Plataforma financiera del **Fondo Mutuo de Cobertura FMC S.A.S.** — visualización premium de estados financieros, ejecución presupuestal, indicadores y análisis, reemplazando el proceso de Excel.

> **Estado: v1 (construida en local).** Corre con los datos reales extraídos de los archivos actuales (`src/db/seed.json`) y **reproduce el ESF/ER al peso**. El siguiente paso es conectar la base de datos **Neon** (esquema y semilla ya listos en `db/`).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — tema premium oscuro
- **Recharts** — gráficos · **lucide-react** — íconos · **SheetJS (xlsx)** — ingesta
- **Datos:** v1 usa una semilla local; producción → **Neon** (Postgres) vía `DATABASE_URL`
- **Despliegue previsto:** Vercel · **Auth/borde:** Cloudflare Access (Google Workspace) · **Monitoreo:** Sentry

## Correr en local

```bash
npm install
npm run dev
# abre http://localhost:3000
```

Páginas: Dashboard, Situación Financiera (ESF), Estado de Resultados (ER), Ejecución Presupuestal, Provisión de Impuesto, Portafolio, Plan de Cuentas, Cargar Balance (ingesta con auto-reconocimiento de columnas).

## Reglas de negocio implementadas

Verificadas contra los datos reales (99,6% mecánico):

- **RN0** — Normalización de signo por naturaleza de la cuenta.
- **RN1** — Des-acumulación por clase (4/5/6/7 → movimiento del mes; 1/2/3 → saldo puntual).
- **RN2** — Impuesto de renta estimado (configurable en la página *Provisión de Impuesto*).
- **RN3** — Presentación neta del Estado de Resultados.

## Modelo de datos y migración (`db/`)

- `schema.sql` — esquema Postgres (portable Neon/Supabase).
- `dim_cuenta.csv`, `dim_periodo.csv`, `fact_saldo.csv`, `estado.csv`, `linea_estado.csv`, `map_cuenta_linea.csv` — semilla extraída de los archivos actuales.
- `load.sql` — carga de la semilla con `psql`.

### Conectar Neon (siguiente paso)

1. Crear un proyecto en Neon y copiar el connection string.
2. `psql "$DATABASE_URL" -f db/schema.sql` y luego `db/load.sql` (o vía Neon SQL editor).
3. Poner `DATABASE_URL` en `.env.local` (ver `.env.example`).
4. Cambiar la capa `src/lib/data.ts` de la semilla a consultas SQL (la lógica de estados y la UI no cambian).

## Estructura

```
src/app/        páginas (dashboard, esf, er, ejecucion, impuesto, portafolio, cuentas, ingesta)
src/components/  UI (Sidebar, tablas de estado, gráficos, ingesta)
src/lib/         data.ts · statements.ts (motor) · format.ts · periodos.ts
src/db/          seed.json (datos v1)
db/              esquema y semilla SQL para Neon
```

## Despliegue (cuando esté listo)

1. Subir a un repo **privado** en GitHub.
2. Importar en **Vercel**, definir `DATABASE_URL` (Neon) en las variables de entorno.
3. Proteger con **Cloudflare Access** (SSO Google Workspace) y dominio propio.
