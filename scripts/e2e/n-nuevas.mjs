#!/usr/bin/env node
// Fase N · Las funciones nuevas apagadas por gimnasio (N5) y las que cuelgan de ellas, en el gimnasio DEMO (nunca Temple Gym):
//   APAGADAS: la dueña ve las 4 funciones apagadas; no aparece NADA de ellas en Novedades, en Interesados ni en la ficha; el alta con
//   ?o=instagram no deja origen; el aviso del débito automático no acredita. El encargado no puede prender.
//   PRENDIDAS: "Qué hay de nuevo" las cuenta; el alta con ?o=qr queda con su origen y el reporte de Interesados la cuenta; el resumen del
//   día coincide con la base; los aptos por vencer se listan; la entrada frena sin apto (lo dice la puerta); el débito automático acredita
//   un cobro avisado y firmado UNA vez (el reenvío no, la firma mala se rechaza, el monto distinto no se acredita).
//   node scripts/e2e/n-nuevas.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, PLATAFORMA, capturar, chequear, entrar, esperarAntiRobot, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const MP = `http://127.0.0.1:${process.env.PUERTO_MP ?? Number(process.env.PUERTO_SUPABASE ?? 54321) + 10}`;
const SECRETO = process.env.MP_SIMULADO_SECRETO ?? "secreto-del-simulador-de-mp-solo-local";
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [{ id: gim, zona_horaria: zona }] = await q(`select id, zona_horaria from public.gimnasios where slug = 'demo'`);
if ((await q(`select es_demo from public.gimnasios where id = $1`, [gim]))[0].es_demo === false) throw new Error("el gimnasio demo no está marcado como demo");
const socioId = async (nombre) => (await q(`select id from public.socios where gimnasio_id = $1 and (nombre || ' ' || apellido) = $2`, [gim, nombre]))[0]?.id;
const alDia = await socioId("Testigo Al Día");
if (!alDia) throw new Error("falta Testigo Al Día en el demo");
const s = Date.now().toString().slice(-6);
const numero = (t) => Number(String(t).replace(/[^\d,]/g, "").replace(",", ".") || 0);

// Estado de partida: sin funciones prendidas, el demo con el registro abierto y la página publicada, el apto sin pedir.
const limpiar = async () => {
  await q(`delete from public.origenes_alta where gimnasio_id = $1`, [gim]);
  await q(`delete from public.cobros_debito where gimnasio_id = $1`, [gim]);
  await q(`delete from public.debitos_automaticos where gimnasio_id = $1`, [gim]);
  await q(`delete from public.aptos_fisicos where gimnasio_id = $1`, [gim]);
  await q(`delete from public.funciones_nuevas_gimnasio where gimnasio_id = $1`, [gim]);
  await q(`update public.configuracion_gimnasio set pide_apto = false, apto_en_entrada = 'nada', apto_aviso_dias = 15 where gimnasio_id = $1`, [gim]);
};
await limpiar();
await q(`insert into public.reglamentos (gimnasio_id, version, texto) select g.id, 1, 'Reglamento de prueba del gimnasio demo para el e2e de la fase N.' from public.gimnasios g where g.id = $1 and not exists (select 1 from public.reglamentos r where r.gimnasio_id = g.id)`, [gim]);
await q(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = $1`, [gim]);
await q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [gim]);

const b = await navegador();
/** Se anota alguien desde la dirección del QR (con el origen que se pida) y devuelve su DNI. */
async function altaDesdeLink(origen, apellido) {
  const v = await pagina(b, CELU);
  await v.goto(`${PLATAFORMA}/g/demo/hacete-socio${origen ? `?o=${origen}` : ""}`);
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  const dni = `4${s}${origen === "qr" ? 1 : 0}`;
  await form.locator("[data-plan]").first().click();
  await form.locator('input[name="nombre"]').fill("Nora");
  await form.locator('input[name="apellido"]').fill(apellido);
  await form.locator('input[name="dni"]').fill(dni);
  await form.locator('input[name="telefono"]').fill(`000 ${s}${origen === "qr" ? 7 : 8}`);
  await form.locator('input[name="fecha_nacimiento"]').fill("1991-05-06");
  await form.locator('input[name="email"]').fill(`${apellido.toLowerCase()}${s}@ejemplo.invalid`);
  await form.locator('input[name="contrasena"]').fill("clave-de-prueba-1");
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has(input[value="mostrador"])').click();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  await v.locator("[data-alta-lista]").waitFor({ timeout: 45000 });
  if (v.errores.length) falla(`alta ${origen || "sin origen"}: ${v.errores.join(" | ")}`);
  await v.context().close();
  return dni;
}
const filaSocio = async (dni) => (await q(`select id from public.socios where gimnasio_id = $1 and dni = $2`, [gim, dni]))[0]?.id;
const aviso = () => `${GIMNASIO()}/api/webhooks/mercadopago-debito?g=${gim}`;

try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");

  // ═══ APAGADAS ═══
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-funcion]").count() === 4, "Configuración → Funciones nuevas: las 4 funciones", `hay ${await d.locator("[data-funcion]").count()} funciones`);
  chequear(await d.locator('[data-funcion][data-activa="si"]').count() === 0, "todas vienen apagadas", "alguna viene prendida");
  chequear(await d.locator("[data-sin-novedades]").count() === 1, "“Qué hay de nuevo” está vacío sin funciones prendidas", "“Qué hay de nuevo” muestra algo sin funciones prendidas");
  chequear(await d.locator("[data-apto-config], [data-debito]").count() === 0, "apagadas, no muestran su configuración", "una función apagada muestra su configuración");
  await capturar(d, "n-compu-apagadas");

  await d.goto(`${G}/panel/campana`);
  await d.locator("main").first().waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-funciones-nuevas-novedades], [data-resumen-noche], [data-aptos-por-vencer], [data-que-hay-de-nuevo-panel]").count() === 0,
    "apagadas: Novedades no muestra resumen, aptos ni “qué hay de nuevo”", "Novedades muestra algo de una función apagada");

  await d.goto(`${G}/panel/socios?vista=interesados`);
  await d.locator("[data-prospectos]").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-origen-altas]").count() === 0, "apagada: Interesados no muestra el reporte de origen", "Interesados muestra el reporte con la función apagada");

  // El alta con origen mientras está apagada: se anota, pero no queda origen.
  const dniApagada = await altaDesdeLink("instagram", `Apagada${s}`);
  const idApagada = await filaSocio(dniApagada);
  chequear(!!idApagada, "apagada: el alta con ?o=instagram igual se anota", "no se anotó el socio");
  chequear((await q(`select count(*)::int n from public.origenes_alta where gimnasio_id = $1`, [gim]))[0].n === 0, "apagada: no queda ningún origen guardado", "se guardó un origen con la función apagada");
  await d.goto(`${G}/panel/socios/${idApagada}`);
  await d.locator("[data-origen]").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-origen-canal]").count() === 0, "apagada: la ficha no dice por dónde llegó", "la ficha muestra el origen con la función apagada");

  // El encargado ve la lista pero no puede prender.
  const e = await pagina(b, COMPU);
  e.setDefaultNavigationTimeout(120000);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=funciones`);
  await e.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  chequear(await e.locator('[data-funcion] input[role="switch"]:not([disabled])').count() === 0, "el encargado ve las funciones pero no las puede prender", "el encargado puede tocar los interruptores");
  await e.context().close();

  // El aviso del débito con la función apagada no acredita nada (y no se pierde: queda abierto).
  const sub = await (await fetch(`${MP}/preapproval`, { method: "POST", headers: { authorization: "Bearer TEST-e2e00000000000000000000000000-gymos", "content-type": "application/json" },
    body: JSON.stringify({ reason: "Cuota mensual", external_reference: alDia, auto_recurring: { transaction_amount: 25000, currency_id: "ARS" }, notification_url: aviso() }) })).json();
  chequear(!!sub.id, `el simulador de MercadoPago crea la suscripción ${sub.id}`, `el simulador no creó la suscripción: ${JSON.stringify(sub)}`);

  // MercadoPago conectado en el demo (modo prueba, simulador local) y el aviso de un cobro con la función APAGADA: no acredita nada y no se pierde.
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  const mp = d.locator("[data-mercadopago]");
  await mp.waitFor({ timeout: 60000 });
  if (!(await d.locator('[data-mercadopago="conectado"]').count())) {
    await mp.getByRole("button", { name: /Conectar MercadoPago|Cambiar credenciales/ }).click();
    await mp.getByLabel("Access Token").fill("TEST-e2e00000000000000000000000000-gymos");
    await mp.getByLabel("Clave secreta del webhook").fill(SECRETO);
    await mp.locator("label", { hasText: /^\s*Prueba\s*$/ }).click();
    await mp.getByRole("button", { name: "Guardar y conectar" }).click();
    await d.locator('[data-mercadopago="conectado"]').waitFor({ timeout: 30000 });
  }
  ok("MercadoPago conectado en el demo (modo prueba, simulador local)");
  // La adhesión la deja el servidor cuando crea la suscripción en MercadoPago (🔌: ese paso no está conectado todavía); acá la deja la prueba por la base.
  const venceAntes = (await q(`select cubierto_hasta from public.socios where id = $1`, [alDia]))[0].cubierto_hasta;
  await q(`insert into public.debitos_automaticos (gimnasio_id, socio_id, mp_suscripcion_id, monto_acordado) values ($1,$2,$3,25000)`, [gim, alDia, sub.id]);
  const cobrar = async (monto, estado = "approved") => (await fetch(`${MP}/__debito/cobro?sub=${sub.id}&monto=${monto}&estado=${estado}&aviso=${encodeURIComponent(aviso())}`, { method: "POST" })).json();
  const cuerpo = (r) => { try { return JSON.parse(r.cuerpo); } catch { return {}; } };
  const apagado = await cobrar(25000);
  chequear(apagado.status === 200 && cuerpo(apagado).resultado === "funcion_apagada", "apagada: el aviso de un cobro no acredita nada (responde 200, MercadoPago no reintenta)", `aviso con la función apagada: ${JSON.stringify(apagado)}`);
  chequear((await q(`select count(*)::int n from public.cobros_debito where gimnasio_id = $1`, [gim]))[0].n === 0 && (await q(`select count(*)::int n from public.pagos where gimnasio_id = $1 and medio = 'debito_automatico'`, [gim]))[0].n === 0,
    "apagada: no queda ningún cobro ni pago", "se acreditó algo con la función apagada");

  // ═══ PRENDER ═══
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  for (const clave of ["origen_altas", "resumen_noche", "apto_vencimiento", "debito_automatico"]) {
    await d.locator(`[data-funcion="${clave}"] input[role="switch"]`).click();
    await d.locator(`[data-funcion="${clave}"][data-activa="si"]`).waitFor({ timeout: 30000 });
  }
  ok("la dueña prende las 4 funciones desde Configuración → Funciones nuevas");
  chequear(await d.locator("[data-que-hay-de-nuevo] [data-novedad-funcion]").count() === 4, "“Qué hay de nuevo” cuenta las 4 que prendió", `“Qué hay de nuevo” cuenta ${await d.locator("[data-que-hay-de-nuevo] [data-novedad-funcion]").count()}`);
  chequear((await q(`select count(*)::int n from public.historial_configuracion where gimnasio_id = $1 and campo like 'funcion_nueva.%'`, [gim]))[0].n === 4, "los 4 cambios quedan en el historial", "el historial no tiene los 4 cambios");
  await capturar(d, "n-compu-prendidas");

  // ═══ N4 · origen de las altas ═══
  const dniQr = await altaDesdeLink("qr", `Qr${s}`);
  const idQr = await filaSocio(dniQr);
  chequear((await q(`select canal from public.origenes_alta where gimnasio_id = $1 and socio_id = $2`, [gim, idQr]))[0]?.canal === "qr_cartel", "prendida: el alta con ?o=qr queda con origen “qr_cartel”", "el alta con ?o=qr no dejó origen");
  await d.goto(`${G}/panel/socios?vista=interesados`);
  await d.locator("[data-origen-altas]").waitFor({ timeout: 60000 });
  chequear((await d.locator('[data-origen-canal="qr_cartel"] [data-altas]').innerText()).trim() === "1", "Interesados cuenta 1 alta del QR del cartel", "el reporte no cuenta el alta del QR");
  chequear((await d.locator('[data-origen-canal="qr_cartel"] [data-pagaron]').innerText()).trim() === "0", "y 0 pagaron (todavía no pagó)", "el reporte dice que pagó");
  chequear((await d.locator('[data-origen-canal="instagram"] [data-altas]').innerText()).trim() === "0", "la de Instagram hecha con la función apagada no cuenta", "cuenta una alta hecha con la función apagada");
  chequear((await d.locator("[data-origen-links] [data-link-canal]").count()) === 4 && /hacete-socio\?o=qr/.test(await d.locator('[data-link-canal="qr_cartel"]').innerText()), "da los 4 links para copiar (el del QR lleva ?o=qr)", "faltan los links por canal");
  await capturar(d, "n-compu-origen");
  await d.goto(`${G}/panel/socios/${idQr}`);
  await d.locator("[data-origen]").waitFor({ timeout: 60000 });
  chequear(await d.locator('[data-origen-canal="qr_cartel"]').count() === 1, "la ficha dice que llegó por el QR del cartel", "la ficha no dice el origen");

  // ═══ N1 · débito automático ═══
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-debito="conectado"]').waitFor({ timeout: 60000 });
  ok("débito: con MercadoPago conectado, la función muestra sus adhesiones");
  const malMonto = await cobrar(20000);
  chequear(malMonto.status === 500 && /no se acredita/.test(malMonto.cuerpo), "un cobro por otro monto no se acredita (500, MercadoPago vuelve a avisar)", `monto distinto: ${JSON.stringify(malMonto)}`);
  // El aviso que quedó abierto con la función apagada se acredita ahora que está prendida (el mismo ID de MercadoPago, una sola vez).
  const buen = await (await fetch(`${MP}/__debito/reenviar/${apagado.id}`, { method: "POST" })).json();
  chequear(buen.status === 200 && cuerpo(buen).resultado === "acreditado", "prendida: el aviso que había quedado abierto se acredita ($25.000)", `cobro: ${JSON.stringify(buen)}`);
  const otra = await (await fetch(`${MP}/__debito/reenviar/${apagado.id}`, { method: "POST" })).json();
  chequear(otra.status === 200 && cuerpo(otra).ya === true, "el mismo aviso otra vez no acredita dos veces", `reenvío: ${JSON.stringify(otra)}`);
  const mala = await (await fetch(`${MP}/__debito/firma-mala/${apagado.id}`, { method: "POST" })).json();
  chequear(mala.status === 401, "aviso con firma inválida: 401, no toca nada", `firma mala: ${JSON.stringify(mala)}`);
  const hechos = (await q(`select (select count(*)::int from public.cobros_debito where gimnasio_id = $1 and estado = 'acreditado') as cobros,
      (select count(*)::int from public.pagos where gimnasio_id = $1 and medio = 'debito_automatico' and estado = 'aprobado') as pagos,
      (select cubierto_hasta from public.socios where id = $2) as hasta`, [gim, alDia]))[0];
  chequear(hechos.cobros === 1 && hechos.pagos === 1, "queda 1 cobro y 1 pago “débito automático” aprobado", `cobros ${hechos.cobros}, pagos ${hechos.pagos}`);
  chequear(new Date(hechos.hasta) > new Date(venceAntes), "el pago movió la cobertura del socio", "la cobertura no avanzó");
  chequear((await q(`select estado from public.debitos_automaticos where gimnasio_id = $1`, [gim]))[0].estado === "activa", "la adhesión pasa a activa con el primer cobro", "la adhesión no quedó activa");
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-debito="conectado"]').waitFor({ timeout: 60000 });
  chequear(await d.locator('[data-adhesion="activa"]').count() === 1 && await d.locator('[data-cobro-debito="acreditado"]').count() === 1, "la pantalla muestra la adhesión activa y el cobro acreditado", "la pantalla no muestra la adhesión y el cobro");
  await capturar(d, "n-compu-debito");
  await d.locator("[data-cancelar-adhesion]").click();
  await d.locator('[data-adhesion="cancelada"]').waitFor({ timeout: 30000 });
  ok("la dueña cancela la adhesión");
  const tarde = await cobrar(25000);
  chequear(cuerpo(tarde).resultado === "adhesion_cancelada", "un cobro que llega con la adhesión cancelada no se acredita (queda para devolver)", `cobro tarde: ${JSON.stringify(tarde)}`);
  chequear((await q(`select count(*)::int n from public.pagos where gimnasio_id = $1 and medio = 'debito_automatico'`, [gim]))[0].n === 1, "sigue habiendo 1 solo pago de débito automático", "se creó otro pago");

  // ═══ N2 · apto físico ═══
  await q(`update public.configuracion_gimnasio set pide_apto = true where gimnasio_id = $1`, [gim]);
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-apto-config]').waitFor({ timeout: 60000 });
  await d.locator('[data-apto-modo="frena"]').click();
  await d.locator('[data-apto-modo="frena"][aria-pressed="true"]').waitFor({ timeout: 30000 });
  ok("la dueña elige “la entrada frena” con el apto");
  const veredicto = async () => (await q(`select to_jsonb(privado.calcular_acceso($1, now(), (select id from public.sedes where gimnasio_id = $2 and es_principal))) v`, [alDia, gim]))[0].v;
  let v = await veredicto();
  chequear(v.puede === false && v.motivo === "apto_vencido" && /^Apto físico: no presentó el apto$/.test(v.texto), `sin apto, la puerta frena y lo dice: “${v.texto}”`, `la puerta dijo ${JSON.stringify(v)}`);
  const vence5 = (await q(`select to_char((now() at time zone $1)::date + 5, 'YYYY-MM-DD') d`, [zona]))[0].d;
  await q(`insert into public.aptos_fisicos (gimnasio_id, socio_id, vale_hasta) values ($1, $2, privado.medianoche($3::date + 1, $4))`, [gim, alDia, vence5, zona]);
  v = await veredicto();
  chequear(v.puede === true && v.motivo !== "apto_vencido" && (v.avisos ?? []).some((a) => /^Apto físico: vence el/.test(a)), "con el apto por vencer en 5 días la puerta deja pasar y avisa", `la puerta dijo ${JSON.stringify(v)}`);
  await d.goto(`${G}/panel/campana`);
  await d.locator("[data-aptos-por-vencer]").waitFor({ timeout: 60000 });
  chequear(await d.locator('[data-aptos="por-vencer"]').getByText("Testigo Al Día").count() === 1, "Novedades lista al socio con el apto por vencer", "Novedades no lista el apto por vencer");
  await capturar(d, "n-compu-aptos");

  // ═══ N3 · resumen de la noche (coincide con la base) y N6 en Novedades ═══
  const r = d.locator("[data-resumen-noche]");
  await r.waitFor({ timeout: 60000 });
  const hoy = `(momento at time zone '${zona}')::date = (now() at time zone '${zona}')::date`;
  const entradas = (await q(`select count(*)::int n from public.ingresos where gimnasio_id = $1 and anulado_en is null and resultado in ('entro','entro_modo_aviso','forzado') and ${hoy}`, [gim]))[0].n;
  const cobrado = (await q(`select coalesce(sum(monto), 0) m from public.pagos where gimnasio_id = $1 and estado = 'aprobado' and (aprobado_en at time zone '${zona}')::date = (now() at time zone '${zona}')::date`, [gim]))[0].m;
  const altas = (await q(`select count(*)::int n from public.socios where gimnasio_id = $1 and (creado_en at time zone '${zona}')::date = (now() at time zone '${zona}')::date`, [gim]))[0].n;
  chequear(Number((await r.locator('[data-resumen="entradas"] .numero').innerText()).trim()) === entradas, `el resumen cuenta ${entradas} entradas, como la base`, "las entradas del resumen no coinciden con la base");
  chequear(numero(await r.locator('[data-resumen="cobrado"] .numero').innerText()) === Number(cobrado), `el resumen cuenta lo cobrado ($${cobrado}), como la base (incluye el débito automático)`, "lo cobrado del resumen no coincide con la base");
  chequear(Number((await r.locator('[data-resumen="altas"] .numero').innerText()).trim()) === altas, `el resumen cuenta ${altas} altas, como la base`, "las altas del resumen no coinciden");
  chequear(/Débito automático/.test(await r.locator('[data-resumen="medios"]').innerText()), "el resumen separa el cobro por débito automático", "el resumen no muestra el débito automático");
  chequear(await d.locator("[data-que-hay-de-nuevo-panel] [data-novedad-funcion]").count() === 4, "Novedades también trae “Qué hay de nuevo” con las 4 funciones", "Novedades no trae las 4 novedades");
  await capturar(d, "n-compu-resumen");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  // Cada rol ve lo suyo: el encargado no ve el resumen (solo el dueño); la recepción ve los aptos pero no “qué hay de nuevo”.
  const enc = await pagina(b, COMPU);
  enc.setDefaultNavigationTimeout(120000);
  await entrar(enc, "encargado@ejemplo.invalid");
  await enc.goto(`${G}/panel/campana`);
  await enc.locator("[data-aptos-por-vencer]").waitFor({ timeout: 60000 });
  chequear(await enc.locator("[data-resumen-noche]").count() === 0 && await enc.locator("[data-que-hay-de-nuevo-panel]").count() === 1, "el encargado ve aptos y “qué hay de nuevo”, no el resumen", "el encargado ve el resumen o no ve las novedades");
  const rec = await pagina(b, COMPU);
  rec.setDefaultNavigationTimeout(120000);
  await entrar(rec, "recepcion@ejemplo.invalid");
  await rec.goto(`${G}/panel/campana`);
  await rec.locator("[data-aptos-por-vencer]").waitFor({ timeout: 60000 });
  chequear(await rec.locator("[data-resumen-noche], [data-que-hay-de-nuevo-panel]").count() === 0, "la recepción ve los aptos, no el resumen ni “qué hay de nuevo”", "la recepción ve algo del dueño");
  if (enc.errores.length || rec.errores.length) falla(`encargado/recepción: ${[...enc.errores, ...rec.errores].join(" | ")}`);

  // ═══ APAGAR OTRA VEZ: vuelve a no verse nada ═══
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  for (const clave of ["origen_altas", "resumen_noche", "apto_vencimiento", "debito_automatico"]) {
    await d.locator(`[data-funcion="${clave}"] input[role="switch"]`).click();
    await d.locator(`[data-funcion="${clave}"][data-activa="no"]`).waitFor({ timeout: 30000 });
  }
  await d.goto(`${G}/panel/campana`);
  await d.locator("main").first().waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-funciones-nuevas-novedades]").count() === 0, "apagadas otra vez: Novedades vuelve a estar como antes", "Novedades sigue mostrando funciones apagadas");
  v = await veredicto();
  chequear(v.motivo !== "apto_vencido", "apagada, la puerta ya no mira el apto (aunque quedó en “frena”)", "la puerta sigue frenando por el apto con la función apagada");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await limpiar().catch(() => {});
  await db.end();
}
await b.close();
resultado();
