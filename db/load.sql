-- Carga de la semilla en Postgres/Neon. Ejecutar tras schema.sql.
-- Con psql:  \i load.sql   (o usar \copy desde la carpeta de los CSV)
-- Nota: se cargan las columnas de datos; los *_id de identidad se respetan
--       usando OVERRIDING SYSTEM VALUE cuando aplique.

\copy dim_cuenta       (cuenta_id,codigo_puc,nombre,clase,longitud,nivel,codigo_padre,naturaleza,es_hoja) from 'dim_cuenta.csv'      with (format csv, header true);
\copy dim_periodo      (periodo_id,anio,mes,fecha_cierre,etiqueta)                                        from 'dim_periodo.csv'     with (format csv, header true);
\copy estado           (estado_id,codigo,nombre)                                                          from 'estado.csv'          with (format csv, header true);
\copy linea_estado     (linea_id,estado_id,orden,etiqueta,nivel_indent,tipo)                              from 'linea_estado.csv'    with (format csv, header true);
\copy map_cuenta_linea (linea_id,cuenta_id)                                                               from 'map_cuenta_linea.csv' with (format csv, header true);
\copy fact_saldo       (periodo_id,cuenta_id,saldo_acumulado,movimiento_mes)                              from 'fact_saldo.csv'      with (format csv, header true);

-- Sincronizar las secuencias de identidad tras la carga con IDs explícitos:
select setval(pg_get_serial_sequence('dim_cuenta','cuenta_id'),   (select max(cuenta_id)  from dim_cuenta));
select setval(pg_get_serial_sequence('dim_periodo','periodo_id'), (select max(periodo_id) from dim_periodo));
select setval(pg_get_serial_sequence('estado','estado_id'),       (select max(estado_id)  from estado));
select setval(pg_get_serial_sequence('linea_estado','linea_id'),  (select max(linea_id)   from linea_estado));
