# Registro de despliegue y solución de problemas

## Incidente: 404 NOT_FOUND al abrir la app en Vercel (2026-07-11)

### Síntoma
Tras el primer despliegue, al abrir la URL de Vercel salía la página **`404: NOT_FOUND`** de Vercel
(`X-Vercel-Error: NOT_FOUND`), aunque el build reportaba **éxito** ("Deployment has completed").

### Causas encontradas (eran varias a la vez)
1. **URL equivocada.** `fmc-financiero.vercel.app` ya estaba tomada globalmente por otra cuenta de
   Vercel → **404**. La URL real del proyecto es **team-scoped**:
   `https://fmc-financiero-fmcfondos-projects.vercel.app`
   (y cada despliegue tiene además una URL con hash, p. ej. `...-1m3m9qi6y-...`).
2. **Protección de despliegue (Vercel Authentication) activa.** Las peticiones sin login recibían
   **302 → `vercel.com/sso-api`**; y los alias aún no vinculados mostraban 404 tras el login.
3. **`DATABASE_URL` agregada después del primer deploy.** Las variables de entorno solo aplican a
   despliegues **nuevos** → habría dado error 500 en runtime hasta un redeploy.

### Solución
1. Usar la **URL real** (team-scoped) o el botón **Visit** del despliegue. Nunca asumir
   `<proyecto>.vercel.app`.
2. Se agregó **`vercel.json`** forzando el framework (`"framework": "nextjs"`) y se **redeployó**
   (así toma la `DATABASE_URL`).
3. Se **desactivó temporalmente** la Protección de Vercel para verificar → confirmado: HTTP 200 con
   datos reales desde Neon (Total Activos MAY2026 = 1.664.227.363).

### Cómo encontrar la URL real del despliegue (sin entrar al panel)
```bash
gh api repos/FMCfondo/fmc-financiero/commits/main/status   # -> statuses[].target_url
# o el environment_url del deployment:
gh api repos/FMCfondo/fmc-financiero/deployments/<id>/statuses
```

### Pendiente de seguridad
- ⚠️ La app quedó **pública** al desactivar la protección → **re-proteger** con **Cloudflare Access**
  (SSO Google Workspace) y **dominio propio**. Mientras tanto, se puede re-activar la protección de
  Vercel.
- 🔒 **Rotar la contraseña de Neon** (se compartió en el chat durante la configuración).

### Señales para reconocer esto a futuro
- `404 NOT_FOUND` de Vercel (no de Next.js) = problema de **routing/alias/acceso**, no del código.
- `302 → sso-api` = protección activa, la app existe.
- Error **500 / "Application error"** = sí sería la app (p. ej. falta `DATABASE_URL`).
