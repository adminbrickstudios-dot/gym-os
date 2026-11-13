#!/usr/bin/env node
// F8.3 · El humo de las puertas contra la app local: prueba el mismo script que corre en producción (scripts/medir/humo-puertas.mjs),
// con los usuarios del demo local (contraseña demo-gymos; solo existen en la base de prueba), en compu y celular, con capturas en .local/humo.
//   node scripts/e2e/humo-puertas.mjs     (con scripts/local/levantar.sh corriendo)
import { spawnSync } from "node:child_process";

const clave = "demo-gymos";
const r = spawnSync("node", ["scripts/medir/humo-puertas.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    BASE_URL: `http://localhost:${process.env.PUERTO_APP ?? "3123"}`,
    GIMNASIO_SLUG: "demo",
    BRIK_ADMIN_MAIL: "admin@ejemplo.invalid", BRIK_ADMIN_CLAVE: clave,
    CLAVE_PRUEBA: clave,
    MAIL_DUENO: "duena@ejemplo.invalid", MAIL_RECEPCION: "recepcion@ejemplo.invalid", MAIL_PROFE: "profe@ejemplo.invalid", MAIL_SOCIO: "socio@ejemplo.invalid",
  },
});
process.exit(r.status ?? 1);
