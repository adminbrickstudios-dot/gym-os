#!/usr/bin/env node
// Hook PreToolUse (Bash) — bloquea lo que no se deshace.
// Exit 2 + mensaje en stderr = Claude Code bloquea el comando y le
// muestra el motivo al agente. Exit 0 = sigue el flujo normal de permisos.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function leerEntrada() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

const entrada = leerEntrada();
const comando = String(entrada?.tool_input?.command ?? "");
const raiz = process.env.CLAUDE_PROJECT_DIR || entrada?.cwd || process.cwd();

function bloquear(motivo) {
  process.stderr.write(`BLOQUEADO por .claude/hooks/bloquear-peligroso.mjs\n${motivo}\n`);
  process.exit(2);
}

function git(args) {
  return execSync(`git ${args}`, { cwd: raiz, stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
}

if (!comando) process.exit(0);
const c = comando.replace(/\s+/g, " ");

// ── 1. Deploy a producción con cambios sin commitear o sin pushear ──
if (/\bvercel\b.*(--prod\b|--production\b|\bpromote\b)/.test(c)) {
  let sucio, adelante;
  try {
    sucio = git("status --porcelain");
  } catch {
    bloquear("No es un repo git (o git falló). No se deploya a producción algo que no está en git.");
  }
  if (sucio) {
    bloquear(`Hay cambios sin commitear:\n${sucio}\nCommiteá y pusheá antes de vercel --prod.`);
  }
  try {
    adelante = git("rev-list --count @{u}..HEAD");
  } catch {
    bloquear("La rama no tiene upstream. Pusheá a GitHub antes de deployar a producción.");
  }
  if (adelante !== "0") {
    bloquear(`Hay ${adelante} commit(s) sin pushear. Pusheá antes de deployar a producción.`);
  }
}

// ── 2. Git que pisa historia o descarta trabajo ──
if (/\bgit push\b.*(\s-f\b|--force\b|--force-with-lease\b|\s\+\S)/.test(c)) {
  bloquear("git push forzado. Si de verdad hace falta, lo corre Mateo a mano.");
}
if (/\bgit reset\b.*--hard\b/.test(c)) bloquear("git reset --hard descarta trabajo sin vuelta atrás.");
if (/\bgit clean\b.*\s-\w*f/.test(c)) bloquear("git clean -f borra archivos sin seguimiento sin vuelta atrás.");
if (/\bgit (checkout|restore)\b.*\s(--\s+)?\.(\s|$)/.test(c)) {
  bloquear("Descartar todos los cambios del árbol (checkout/restore .) no se deshace.");
}
if (/\bgh repo delete\b/.test(c)) bloquear("Borrar el repo de GitHub: nunca desde el agente.");

// ── 3. Base de datos ──
if (/\bsupabase db reset\b.*(--linked|--db-url)/.test(c)) {
  bloquear("supabase db reset contra la base remota la vacía entera.");
}
if (/\b(drop\s+(schema|database|table|owned)|truncate\s)/i.test(c)) {
  bloquear("SQL destructivo en línea de comando (DROP / TRUNCATE). Si hace falta, va en una migración revisada.");
}
if (/\bdelete\s+from\b(?![^;]*\bwhere\b)/i.test(c)) {
  bloquear("DELETE sin WHERE.");
}

// Desde el primer gimnasio real, las migraciones las corre Mateo.
const conDatosReales = existsSync(join(raiz, ".claude", "BASE_CON_DATOS_REALES"));
if (conDatosReales && /(\bsupabase (db push|migration up)\b|\bnpm run db:(aplicar|migrar)\b)/.test(c)) {
  bloquear(
    "La base tiene gimnasios reales (.claude/BASE_CON_DATOS_REALES existe).\n" +
      "El agente escribe la migración y la entrega; Mateo la corre."
  );
}

// ── 4. Borrados recursivos fuera de carpetas regenerables ──
const rmRecursivo = c.match(/\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*|-r\s+-f|-f\s+-r|--recursive)\s+(.+?)(;|&&|\|\||$)/);
if (rmRecursivo) {
  const objetivos = rmRecursivo[2].split(" ").filter((t) => t && !t.startsWith("-"));
  const regenerable = /^(\.\/)?(node_modules|\.next|\.turbo|\.vercel\/output|coverage|dist|out|capturas\/tmp)(\/.*)?$/;
  const temporal = /^(\/tmp\/|\$TMPDIR|\/var\/folders\/)/;
  const peligrosos = objetivos.filter((t) => !regenerable.test(t) && !temporal.test(t));
  if (peligrosos.length) {
    bloquear(`rm -rf sobre: ${peligrosos.join(", ")}\nSolo se permite sobre carpetas regenerables (node_modules, .next, dist…).`);
  }
}

// ── 5. Secretos ──
if (/\b(cat|less|more|head|tail|bat|type|grep|rg|sed|awk)\b[^|;&]*\.env(\.local|\.production|\.development)?(\s|$)/.test(c)) {
  bloquear("Leer .env* expone secretos en la conversación. Los scripts leen las variables solos.");
}

// ── 6. Infraestructura ──
if (/\bvercel (remove|rm|project rm|domains rm)\b/.test(c)) {
  bloquear("Borrar proyectos o dominios en Vercel: lo hace Mateo desde el panel.");
}

process.exit(0);
