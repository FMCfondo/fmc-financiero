/* El nombre de la cookie, en un módulo sin `server-only` ni Node: lo importa el
   proxy (que corre antes que todo y con un runtime más estrecho) y también auth.ts. */
export const COOKIE_SESION = "fmc_sesion";
/** La contraseña recién generada para un usuario, visible UNA vez en /configuracion
 *  (cinco minutos, httpOnly). Vive aquí porque un módulo "use server" solo puede
 *  exportar funciones. */
export const COOKIE_CLAVE = "fmc_clave_nueva";
