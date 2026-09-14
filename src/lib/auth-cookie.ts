/* El nombre de la cookie, en un módulo sin `server-only` ni Node: lo importa el
   proxy (que corre antes que todo y con un runtime más estrecho) y también auth.ts. */
export const COOKIE_SESION = "fmc_sesion";
