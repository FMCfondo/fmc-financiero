-- ============================================================================
-- FMC S.A.S. - Plataforma financiera - Esquema de datos (Postgres / Neon)
-- Fase 1. Postgres puro y portable. Generado 2026-07-10.
-- ============================================================================

-- ===== DIMENSIONES =====
create table dim_cuenta (
  cuenta_id     bigint generated always as identity primary key,
  codigo_puc    text    not null unique,
  nombre        text    not null,
  clase         smallint not null,               -- 1..9 (primer dígito PUC)
  longitud      smallint not null,               -- nº de dígitos
  nivel         text    not null,                -- Clase/Grupo/Cuenta/Subcuenta/Auxiliar
  codigo_padre  text,                            -- prefijo inmediato existente
  naturaleza    text    not null,                -- 'debito' | 'credito'
  es_hoja       boolean not null default false,
  activa        boolean not null default true
);

create table dim_periodo (
  periodo_id    int generated always as identity primary key,
  anio          smallint not null,
  mes           smallint not null,               -- 1..12
  fecha_cierre  date    not null,
  etiqueta      text    not null,                -- 'ENE2026'
  unique (anio, mes)
);

create table estado (
  estado_id     int generated always as identity primary key,
  codigo        text not null unique,            -- 'ESF','ER','EJECUCION','FLUJO','PATRIMONIO'
  nombre        text not null
);

create table linea_estado (
  linea_id      bigint generated always as identity primary key,
  estado_id     int  not null references estado,
  orden         int  not null,
  etiqueta      text not null,
  nivel_indent  smallint not null default 0,
  tipo          text not null,                   -- 'detalle'|'subtotal'|'encabezado'|'total'
  linea_padre_id bigint references linea_estado,
  signo         smallint not null default 1,     -- +1 / -1 (presentación)
  metodo        text,                            -- 'mapeo'|'suma_lineas'|'formula'
  definicion    jsonb,
  unique (estado_id, orden)
);

create table map_cuenta_linea (                  -- reemplaza los rangos SUM manuales
  linea_id      bigint not null references linea_estado,
  cuenta_id     bigint not null references dim_cuenta,
  primary key (linea_id, cuenta_id)
);

-- ===== HECHOS =====
create table ingesta (
  ingesta_id    bigint generated always as identity primary key,
  periodo_id    int  not null references dim_periodo,
  archivo_nombre text not null,
  archivo_hash  text,
  filas_leidas  int,
  cargada_por   uuid,
  cargada_en    timestamptz not null default now(),
  estado_valid  text not null default 'pendiente'
);

-- Saldo por cuenta y periodo (crudo procesado). Regla:
--   saldo_acumulado : saldo final YTD tal cual Siigo (magnitud normalizada, ver RN0)
--   movimiento_mes  : derivado (RN1 des-acumulación por clase)
create table fact_saldo (
  periodo_id      int    not null references dim_periodo,
  cuenta_id       bigint not null references dim_cuenta,
  saldo_acumulado numeric(18,2),
  movimiento_mes  numeric(18,2) not null,
  ingesta_id      bigint references ingesta,
  primary key (periodo_id, cuenta_id)
);

-- Ajustes / reclasificaciones explícitos y auditables (lo que hace "AJUSTADO").
-- movimiento_ajustado = movimiento_mes + Σ ajustes.  Ej.: neutralizar impuesto
-- contabilizado para estimarlo (RN2), o reclasificar entre cuentas.
create table fact_ajuste (
  ajuste_id     bigint generated always as identity primary key,
  periodo_id    int    not null references dim_periodo,
  cuenta_id     bigint not null references dim_cuenta,
  monto         numeric(18,2) not null,
  motivo        text not null,                   -- 'impuesto_estimado'|'reclasificacion'|...
  creado_por    uuid,
  creado_en     timestamptz not null default now()
);

create table fact_presupuesto (
  periodo_id    int    not null references dim_periodo,
  linea_id      bigint not null references linea_estado,
  monto         numeric(18,2) not null,
  primary key (periodo_id, linea_id)
);

-- Presupuesto anual cargado TAL CUAL de la hoja "PPTO N" del Excel de la Junta
-- (estructura EBITDA propia, autocontenida). `cuentas`/`formula` mapean cada
-- línea al ER real para la ejecución presupuestal. Ver scripts/migrate-ppto.mjs.
create table ppto (
  id       bigint generated always as identity primary key,
  anio     int  not null,
  orden    int  not null,
  etiqueta text not null,
  tipo     text not null default 'detalle',   -- 'detalle' | 'total' (subtotal en negrita)
  clase    text not null default 'gasto',      -- 'ingreso' | 'gasto' | 'resultado' (semaforo)
  nota     text,
  meses    numeric(18,2)[] not null,           -- 12 valores ENE..DIC
  total    numeric(18,2) not null,
  cuentas  text[] not null default '{}',       -- codigos PUC mapeados -> Real
  formula  text,                               -- totales computados del ER real
  unique (anio, orden)
);

create table fact_inversion (
  inversion_id  bigint generated always as identity primary key,
  periodo_id    int    not null references dim_periodo,
  cuenta_id     bigint references dim_cuenta,      -- vínculo por CUENTA, no por celda
  entidad text, tipo text,
  monto numeric(18,2), tasa_ea numeric(9,6),
  fecha_apertura date, fecha_venc date
);

-- ===== SOPORTE =====
create table parametro (clave text primary key, valor jsonb not null, descripcion text);
create table perfil (user_id uuid primary key, rol text not null default 'editor');
create table auditoria (
  id bigint generated always as identity primary key,
  usuario uuid, accion text not null, entidad text, registro_id text,
  antes jsonb, despues jsonb, ts timestamptz not null default now()
);

-- Movimiento ajustado (crudo + ajustes) que consumen los estados
create view v_movimiento_ajustado as
  select fs.periodo_id, fs.cuenta_id,
         fs.movimiento_mes + coalesce(a.aj,0) as movimiento_ajustado,
         fs.saldo_acumulado
  from fact_saldo fs
  left join (select periodo_id, cuenta_id, sum(monto) aj
             from fact_ajuste group by periodo_id, cuenta_id) a
    on a.periodo_id=fs.periodo_id and a.cuenta_id=fs.cuenta_id;

-- Parámetros iniciales
insert into parametro (clave, valor, descripcion) values
  ('tasa_imporenta', '0.35', 'Tasa estimada de impuesto de renta (RN2)'),
  ('impuesto_modo', '"estimado"', 'estimado | contabilizado (RN2)');
