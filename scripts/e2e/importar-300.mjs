#!/usr/bin/env node
// C2 · Importar los socios de un gimnasio real: un CSV GENERADO de 300 filas
// (5 malas, 3 repetidas por DNI dentro del archivo), con las columnas en otro
// orden y con tildes y mayúsculas distintas. Se revisa (vista previa), se
// importa lo válido, se vuelve a subir el mismo archivo (no duplica: todo "ya
// está cargado") y se deshace para dejar la base como estaba.
//   node scripts/e2e/importar-300.mjs     (con scripts/local/levantar.sh corriendo)
// Datos ficticios: teléfonos +54 9 000…, mails @ejemplo.invalid.
import { COMPU, CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-4);
const TOTAL = 300, MALAS = 5, REPETIDAS = 3;

// Orden y títulos distintos a los del importador, a propósito.
const titulos = "PAGÓ HASTA;fecha de alta;Teléfono;E-mail;Documento;Membresía;Nombre y apellido";
const filas = [];
for (let i = 0; i < TOTAL; i++) {
  const dni = `8${s}${String(i).padStart(3, "0")}`; // 8 dígitos
  const vencido = i % 3 === 0; // un tercio ya venció: la puerta tiene que decir que debe
  filas.push({
    vence: vencido ? "15/03/2025" : "31/12/2030", alta: vencido ? "10/02/2025" : "05/01/2026",
    tel: `+54 9 000 ${String(2000000 + i)}`, mail: `socio${s}${i}@ejemplo.invalid`, dni, plan: i % 2 ? "Plan Full" : "plan full",
    nombre: `Importada${s} Numero${i}`,
  });
}
// 3 repetidas: mismo DNI que una fila anterior.
for (let k = 0; k < REPETIDAS; k++) filas[290 + k].dni = filas[10 + k].dni;
// 5 malas: sin nombre, DNI corto, plan que no existe, fecha imposible, mail roto.
filas[280].nombre = "";
filas[281].dni = "12";
filas[282].plan = "Plan Inventado";
filas[283].vence = "31/31/2026";
filas[284].mail = "no-es-un-mail";
const csv = [titulos, ...filas.map((f) => [f.vence, f.alta, f.tel, f.mail, f.dni, f.plan, f.nombre].join(";"))].join("\r\n");
const buenas = TOTAL - MALAS - REPETIDAS;

const b = await navegador();
try {
  for (const [nombre, vista] of [["compu", COMPU], ["celular", CELU]]) {
    const p = await pagina(b, vista);
    await entrar(p, "duena@ejemplo.invalid");
    await p.goto(`${G}/panel/socios/importar`);
    await p.locator("[data-importador]").waitFor({ timeout: 60000 });
    const subir = async () => {
      await p.setInputFiles('input[aria-label="Elegir archivo"]', { name: `socios-${s}-${nombre}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
      await p.locator("[data-columnas]").waitFor({ timeout: 30000 });
    };
    await subir();
    const mapa = await p.locator("[data-columnas] select").evaluateAll((xs) => xs.map((x) => x.value));
    chequear(mapa.join(",") === "vence,alta,telefono,email,dni,plan,nombre", `${nombre}: mapea las columnas por nombre aunque vengan en otro orden: ${mapa.join(", ")}`, `${nombre}: columnas ${mapa.join(",")}`);
    await p.locator('button:has-text("Revisar")').click();
    const rev = p.locator("[data-revision]");
    await rev.waitFor({ timeout: 60000 });
    const v = Number(await rev.getAttribute("data-validas")), e = Number(await rev.getAttribute("data-con-error"));
    chequear(v === buenas && e === MALAS + REPETIDAS, `${nombre}: vista previa ${v} listos y ${e} con error`, `${nombre}: ${v} listos / ${e} con error (se esperaban ${buenas} / ${MALAS + REPETIDAS})`);
    chequear(await rev.getAttribute("data-repetidas-archivo") === String(REPETIDAS), `${nombre}: informa las ${REPETIDAS} repetidas del archivo`, `${nombre}: repetidas ${await rev.getAttribute("data-repetidas-archivo")}`);
    const motivos = (await rev.locator("[data-fila-error]").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
    chequear(/Falta el nombre/.test(motivos) && /DNI “12”/.test(motivos) && /Plan “Plan Inventado”: no existe/.test(motivos) && /Pagó hasta “31\/31\/2026”/.test(motivos) && /Mail “no-es-un-mail”/.test(motivos) && /repetido en el archivo/.test(motivos),
      `${nombre}: cada fila mala dice el motivo en palabras`, `${nombre}: motivos ${motivos.slice(0, 300)}`);
    if (nombre === "compu") await capturar(p, "importar300-compu-revision");
    await rev.locator(`button:has-text("Importar ${buenas} socios")`).click();
    await p.locator(`[data-importados="${buenas}"]`).waitFor({ timeout: 180000 });
    ok(`${nombre}: importó ${buenas} socios en una sola vez`);

    // Volver a subir el mismo archivo no duplica: ya está todo cargado.
    await p.goto(`${G}/panel/socios/importar`);
    await p.locator("[data-importador]").waitFor({ timeout: 60000 });
    await subir();
    await p.locator('button:has-text("Revisar")').click();
    await rev.waitFor({ timeout: 60000 });
    chequear(await rev.getAttribute("data-validas") === "0" && Number(await rev.getAttribute("data-ya-existian")) >= buenas,
      `${nombre}: el mismo archivo otra vez: 0 para importar, ${await rev.getAttribute("data-ya-existian")} ya cargados`, `${nombre}: re-subir ${await rev.getAttribute("data-validas")} válidos`);

    // Se deshace para dejar la base limpia (y poder correr el otro tamaño de pantalla).
    await p.goto(`${G}/panel/socios/importar`);
    await p.locator('[data-importacion="activa"] button:has-text("Deshacer")').first().click();
    await p.locator('[data-importacion="deshecha"]').first().waitFor({ timeout: 120000 });
    ok(`${nombre}: deshecha`);
    if (p.errores.length) falla(`${nombre}: ${p.errores.join(" | ")}`);
    await p.context().close();
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
