// F3.2 · Arma la tabla pantalla × regla de docs/base/FLUIDEZ-PANTALLAS.md mirando el código de cada carpeta de pantalla (heurísticas simples:
// carpeta con loading.tsx, borrador, confirmación, inputMode, autoFocus, imágenes con tamaño…). No reemplaza a los e2e; marca dónde mirar.
//   node scripts/fluidez-tabla.mjs > .local/tabla.md   (los motivos de cada 🟡 salen por la salida de error)
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
const APP = "src/app";
const lista = (d, o = []) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? lista(p, o) : o.push(p.replaceAll("\\", "/")); } return o; };
const todos = lista(APP);
const paginas = todos.filter((p) => p.endsWith("/page.tsx")).map((p) => p.slice(0, -9));
// Una pantalla "posee" los archivos de su carpeta que no están dentro de otra pantalla.
const dePantalla = (dir) => todos.filter((f) => f.startsWith(dir + "/") && !paginas.some((q) => q !== dir && q.startsWith(dir + "/") && f.startsWith(q + "/")) && /\.(tsx|ts)$/.test(f) && !/test|loading|error/.test(f));
const ZONAS = ["panel", "admin", "app"];
const filas = [];
const EN_VIVO_GLOBAL = new Set(["panel"]);   // la campana y los pendientes del menú se renuevan cada 60 s en todas las pantallas del panel
const E2E_RED = new Set(["panel", "panel/socios", "panel/vender", "panel/caja", "panel/clases", "panel/planes", "panel/configuracion", "panel/rutinas", "panel/eventos", "panel/retencion", "panel/equipo", "panel/resultado"]);
for (const d of paginas.sort()) {
  const r = relative(APP, d).replaceAll("\\", "/") || "";
  const zona = r.split("/")[0];
  if (!ZONAS.includes(zona) && r !== "hacete-socio") continue;
  const arch = dePantalla(d);
  const t = arch.map((f) => readFileSync(f, "utf8")).join("\n");
  const redirige = /^\s*redirect\(/m.test(readFileSync(d + "/page.tsx", "utf8")) && arch.length === 1 && readFileSync(d + "/page.tsx", "utf8").length < 600;
  const campos = (t.match(/<input\b|<textarea\b|<select\b|className="campo|<Campo\b/g) ?? []).length;
  const hayForm = campos >= 1;
  const maxForm = Math.max(0, ...arch.map((f) => { const x = readFileSync(f, "utf8"); return x.split(/<form/).slice(1).reduce((m, ch) => Math.max(m, (ch.split("</form>")[0].match(/<input|<textarea|<select|className="campo|<Campo/g) ?? []).length), 0); }));
  const largo = maxForm >= 6;
  const acciones = /"use server"|useTransition|useActionState|action=\{/.test(t) || arch.some((f) => /acciones/.test(f));
  const peligro = /anular|dar de baja|\bbaja\b|borrar|eliminar|archivar|quitar|revocar|pausar|desactivar|cerrar caja|cobrar/i.test(t.replace(/\/\/.*$/gm, ""));
  const confirma = /useConfirmar|confirm\(|Confirmar|confirmar|¿Seguro|Estás seguro|data-confirmar|\bdialog\b/.test(t);
  const reaccion = /revalidatePath|router\.refresh|router\.push|redirect\(|setState|useOptimistic|useRouter/.test(t);
  const imgs = (t.match(/<img\b/g) ?? []).length;
  const imgOk = imgs === 0 || /next\/image|Foto\b|LogoImagen|aspect-|size-\d|h-\d+ |w-full h-full|width=/.test(t);
  const borrador = /BorradorAutomatico|BorradorDeEstado|useCambiosSinGuardar/.test(t) || /FormSocio/.test(t);
  const vivo = /setInterval|ActualizarSola|RefrescarAlEntrar|visibilitychange|channel\(|useRouter/.test(t) && /setInterval|ActualizarSola|RefrescarAlEntrar|visibilitychange|channel\(/.test(t);
  const autoFoco = /autoFocus/.test(t);
  const numerico = /inputMode|type="tel"|type="number"/.test(t);
  const pideNumero = /name="(dni|telefono|monto|precio)"|dni|telefono|monto/.test(t) && hayForm;
  const teclado = /Buscador|Ctrl|F2|tabIndex|onKeyDown|Escape|autoFocus/.test(t);
  const c = {};
  c.r4 = redirige ? "—" : !acciones ? "—" : reaccion ? "✅" : "🟡 no cambia la pantalla sola";
  c.r7 = !hayForm ? "—" : borrador ? "✅" : largo ? "🟡 formulario largo sin borrador" : "—";
  c.r8 = !hayForm ? "—" : (pideNumero && !numerico) ? "🟡 teclado" : autoFoco || campos < 3 ? "✅" : "🟡 foco";
  c.r9 = redirige ? "—" : existsSync(d + "/loading.tsx") ? "✅" : "🟡";
  c.r10 = !acciones || !peligro ? "—" : confirma ? "✅" : "🟡 sin confirmación con nombre";
  c.r14 = EN_VIVO_GLOBAL.has(zona) || vivo ? "✅" : "—";
  c.r16 = redirige ? "—" : E2E_RED.has(r) ? "✅ e2e" : "✅ loading";
  c.r17 = imgs === 0 ? "—" : imgOk ? "✅" : "🟡 imagen sin lugar";
  c.r18 = hayForm ? "✅ viewport" : "—";
  filas.push([r || "/", c]);
}
const cols = ["r4", "r7", "r8", "r9", "r10", "r14", "r16", "r17", "r18"];
console.log("| Pantalla | 4 | 7 | 8 | 9 | 10 | 14 | 16 | 17 | 18 |\n|---|---|---|---|---|---|---|---|---|---|");
for (const [r, c] of filas) console.log(`| \`/${r}\` | ${cols.map((k) => c[k]).join(" | ")} |`);
const flat = filas.flatMap(([r, c]) => cols.filter((k) => c[k].startsWith("🟡")).map((k) => `${r} ${k}: ${c[k]}`));
console.error(flat.length + " amarillas de " + filas.length * cols.length);
console.error(flat.join("\n"));
