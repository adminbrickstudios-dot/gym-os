// VD-2 (0137): una prueba por cada fila de la tabla de situaciones de docs/v2/01-ENTRADA.md §3.
// Casos testigo y momento fijo (sábado 14/11/2026, 19:00): nada depende de now().
// El color y el motivo los sigue decidiendo calcular_acceso; guia_entrada suma lo que hay
// que decirle, cuánto le falta, el botón principal y los chips.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, momento, dueno, recepcion, profe;
const guia = async (clave, m = momento) => (await t.q(`select privado.guia_entrada($1, $2, $3) g`, [t.ctx.socios[clave], m, t.sede]))[0].g;
const chip = (g, clave) => g.chips.find((c) => c.clave === clave);
async function aparte(fn) {
  await t.db.query("savepoint aparte");
  try { return await fn(); } finally { await t.db.query("rollback to savepoint aparte"); }
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
before(async () => {
  t = await abrir("prueba-guia-entrada");
  momento = await t.en(HOY, "19:00:00");
  const crear = async (rol) => {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, id, rol, rol]);
    return id;
  };
  dueno = await crear("dueno"); recepcion = await crear("recepcion"); profe = await crear("profe");
});
after(async () => t && t.cerrar());

test("la guía no cambia lo que dice calcular_acceso: mismo color y mismo motivo para cada caso testigo", async () => {
  for (const [clave, id] of Object.entries(t.ctx.socios)) {
    const [v] = await t.q(`select (privado.calcular_acceso($1, $2, $3)).*`, [id, momento, t.sede]);
    const g = await guia(clave);
    assert.deepEqual([g.situacion, g.color, g.puede], [v.motivo, v.color, v.puede], clave);
    assert.ok(g.boton && g.boton_texto && g.decile, `${clave}: siempre hay botón y algo para decirle`);
  }
});

test("Al día: verde, anotar, cuánto le falta", async () => {
  const g = await guia("al_dia");
  assert.deepEqual([g.situacion, g.boton], ["al_dia", "anotar"]);
  assert.equal(g.falta, "Vence en 10 días (el 24/11)");
  assert.equal(g.decile, "Todo en orden: anotale la entrada.");
  assert.equal(g.segundo, null);
});

test("Vence pronto: se anota y se le dice que vuelva a pagar", async () => {
  const g = await guia("por_vencer");
  assert.deepEqual([g.situacion, g.boton, g.segundo], ["por_vencer", "anotar", "cobrar"]);
  assert.equal(g.falta, "Vence en 2 días (el 16/11)");
  assert.equal(g.decile, "Decile que en 2 días vuelve a pagar.");
});

test("Vence hoy: el botón principal es cobrar (y puede anotar)", async () => {
  const g = await guia("vence_hoy");
  assert.deepEqual([g.situacion, g.puede, g.boton, g.segundo], ["por_vencer", true, "cobrar", "anotar"]);
  assert.equal(g.falta, "Vence hoy");
  assert.match(g.decile, /Vence hoy: cobrale/);
});

test("En días de gracia: cobrar, y le quedan días", async () => {
  const g = await guia("en_tolerancia");
  assert.deepEqual([g.situacion, g.puede, g.boton, g.segundo], ["en_tolerancia", true, "cobrar", "anotar"]);
  assert.equal(g.falta, "Venció hace 3 días (el 11/11)");
  assert.match(g.decile, /Le quedan 2 días de gracia/);
});

test("Vencido: cobrar, con cuánto", async () => {
  const g = await guia("vencida");
  assert.deepEqual([g.situacion, g.puede, g.boton], ["vencida", false, "cobrar"]);
  assert.equal(g.falta, "Venció hace 21 días (el 24/10)");
  assert.equal(g.decile, "Cobrale $25.000 antes de pasar.");
  const tres = await guia("vencida_tres_meses");
  assert.equal(tres.decile, "Cobrale $75.000 antes de pasar.", "las cuotas que debe, sumadas");
});

test("Nuevo, sin pagar todavía: cobrar el primer pago", async () => {
  const g = await guia("sin_pago");
  assert.deepEqual([g.situacion, g.boton], ["sin_pago", "cobrar"]);
  assert.match(g.decile, /Todavía no pagó nada: cobrale el primer pago \(\$25\.000\)/);
});

test("Primer día: chip de bienvenida solo si puede entrar y nunca entró", async () => {
  const g = await guia("al_dia");
  assert.ok(chip(g, "primer_dia"), "al día y sin entradas: primer día");
  assert.equal(chip(g, "primer_dia").emoji, "🎉");
  assert.equal(chip(await guia("vencida"), "primer_dia"), undefined, "si no puede entrar no se le da la bienvenida");
  await aparte(async () => {
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               values ($1,$2,$3, $4::timestamptz - interval '3 days', 'recepcion', 'entro', 'membresia', 'verde', 'al_dia', 'Al día')`, [t.g, t.sede, t.ctx.socios.al_dia, momento]);
    assert.equal(chip(await guia("al_dia"), "primer_dia"), undefined, "ya entró antes");
    assert.equal((await guia("al_dia")).entradas_mes, 1, "lleva 1 este mes");
  });
});

test("Entrada número 100: chip", async () => {
  await aparte(async () => {
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               select $1,$2,$3, $4::timestamptz - (n || ' hours')::interval, 'recepcion', 'entro', 'membresia', 'verde', 'al_dia', 'Al día' from generate_series(1, 99) n`,
      [t.g, t.sede, t.ctx.socios.al_dia, momento]);
    assert.match(chip(await guia("al_dia"), "entradas_redondas").texto, /número 100/);
  });
});

test("Pausado: volvió antes", async () => {
  const g = await guia("congelada");
  assert.deepEqual([g.situacion, g.puede, g.boton], ["congelada", false, "volver_antes"]);
});

test("Suspendido: dejar pasar, solo el dueño o el encargado", async () => {
  const g = await guia("suspendido");
  assert.deepEqual([g.situacion, g.boton, g.solo_encargado], ["suspendido", "dejar_pasar", true]);
});

test("Dado de baja: volver a dar de alta", async () => {
  const g = await guia("se_fue");
  assert.deepEqual([g.situacion, g.boton, g.boton_texto], ["se_fue", "volver_alta", "↩️ Volver a dar de alta"]);
});

test("Pack sin clases (agotado o vencido): cobrar un pack", async () => {
  for (const clave of ["pack_agotado", "pack_vencido"]) {
    const g = await guia(clave);
    assert.deepEqual([g.puede, g.boton], [false, "cobrar_pack"], clave);
  }
  const con = await guia("pack_con_clases");
  assert.deepEqual([con.boton, con.falta], ["anotar", "Le quedan 6 clases"]);
});

test("Pase diario: anotar; usado y sin reingreso: cobrar otro", async () => {
  const g = await guia("pase_hoy");
  assert.deepEqual([g.situacion, g.boton], ["pase_de_hoy", "anotar"]);
  await aparte(async () => {
    // Ya entró con el pase y el gimnasio cobra el reingreso: "Ya usó el pase de hoy".
    const [{ id }] = await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
      values ($1,$2,$3, $4::timestamptz - interval '2 hours', 'recepcion', 'entro', 'pase', 'verde', 'pase_de_hoy', 'Pase') returning id`, [t.g, t.sede, t.ctx.socios.pase_hoy, momento]);
    await t.q(`update public.pases_diarios set usado_en_ingreso_id = $2 where socio_id = $1`, [t.ctx.socios.pase_hoy, id]);
    const reingreso = await guia("pase_hoy");
    assert.deepEqual([reingreso.situacion, reingreso.boton], ["pase_reingreso", "anotar"], "reingreso sin costo: anotar");
    await t.q(`update public.configuracion_gimnasio set reingreso_mismo_dia_consume = true where gimnasio_id = $1`, [t.g]);
    const usado = await guia("pase_hoy");
    assert.deepEqual([usado.situacion, usado.puede, usado.boton], ["pase_usado", false, "cobrar"]);
  });
});

test("Fuera del horario del plan y veces por semana agotadas: dejar pasar", async () => {
  const f = await guia("fuera_de_franja");
  assert.deepEqual([f.situacion, f.boton, f.segundo], ["fuera_de_franja", "dejar_pasar", "cobrar"]);
  const s = await guia("tope_semanal");
  assert.deepEqual([s.situacion, s.boton], ["tope_semanal", "dejar_pasar"]);
});

test("Sede equivocada (el plan es de otra sede): dejar pasar", async () => {
  await aparte(async () => {
    await t.q(`update public.planes set todas_las_sedes = false where id = $1`, [t.ctx.planes.full]);
    const g = await guia("al_dia");
    assert.deepEqual([g.situacion, g.puede, g.boton], ["fuera_de_sede", false, "dejar_pasar"]);
  });
});

test("Sin plan: cobrar", async () => {
  const g = await guia("sin_plan");
  assert.deepEqual([g.situacion, g.boton], ["sin_plan", "cobrar"]);
});

test("Debe plata a cuenta: chip, y se puede anotar o cobrar", async () => {
  await aparte(async () => {
    const [{ id: venta }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en)
      values ($1,$2,$3,'confirmada','recepcion',$4,$4) returning id`, [t.g, t.sede, t.ctx.socios.al_dia, momento]);
    await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, precio_unitario) values ($1,$2,'pase',$3,'Pase fiado',12000)`, [t.g, venta, t.ctx.planes.pase]);
    await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en) values ($1,$2,'cuenta_corriente',12000,'aprobado',$3,$3)`, [t.g, venta, momento]);
    const g = await guia("al_dia");
    assert.equal(chip(g, "debe").texto, "Debe $12.000 a cuenta");
    assert.deepEqual([g.boton, g.segundo], ["anotar", "cobrar"]);
    assert.match(g.decile, /Debe \$12\.000 a cuenta: cobrale o anotalo igual/);
  });
});

test("Prometió pagar y no pagó: chip con lo que dijeron ayer", async () => {
  await aparte(async () => {
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto, forzado_motivo)
               values ($1,$2,$3, $4::timestamptz - interval '1 day', 'recepcion', 'forzado', 'rojo', 'vencida', 'Venció', 'Paga mañana')`, [t.g, t.sede, t.ctx.socios.vencida, momento]);
    const g = await guia("vencida");
    assert.equal(chip(g, "prometio").texto, "Ayer lo dejaron pasar: Paga mañana");
    assert.equal(g.boton, "cobrar");
  });
});

test("Falta firmar: chip con el documento", async () => {
  await aparte(async () => {
    const [{ id: equipo }] = await t.q(`select id from public.equipo where usuario_id = $1`, [dueno]);
    await t.q(`insert into public.documentos (gimnasio_id, clave, version, titulo, texto, creado_por)
               values ($1, 'reglamento', 1, 'Reglamento interno', 'Texto del reglamento del gimnasio de prueba.', $2)`, [t.g, equipo]);
    assert.equal(chip(await guia("al_dia"), "firmar").texto, "Falta firmar: Reglamento interno");
  });
  assert.equal(chip(await guia("al_dia"), "firmar"), undefined, "sin documentos no hay chip");
});

test("Menor: con responsable se nombra; sin responsable se avisa", async () => {
  await aparte(async () => {
    await t.q(`update public.socios set fecha_nacimiento = date '2011-03-03' where id = $1`, [t.ctx.socios.al_dia]);
    const sin = await guia("al_dia");
    assert.equal(chip(sin, "menor_sin_responsable").texto, "Es menor y falta cargar al adulto responsable");
    await t.q(`update public.socios set responsable_nombre = 'Marta Prueba', responsable_telefono = '+5490001234567' where id = $1`, [t.ctx.socios.al_dia]);
    assert.equal(chip(await guia("al_dia"), "menor").texto, "Menor · responsable: Marta Prueba");
  });
});

test("Cumpleaños: chip", async () => {
  assert.equal(chip(await guia("cumple"), "cumple").emoji, "🎂");
  assert.equal(chip(await guia("al_dia"), "cumple"), undefined);
});

test("Gimnasio cerrado (fuera de horario o feriado): se avisa, no se bloquea", async () => {
  await aparte(async () => {
    await t.q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,6,'07:00','13:00')`, [t.g, t.sede]);
    const g = await guia("al_dia");
    assert.match(chip(g, "cerrado").texto, /^El gimnasio está cerrado ahora: Cerrado/);
    assert.deepEqual([g.puede, g.boton], [true, "anotar"], "no bloquea");
    const abierto = await guia("al_dia", await t.en(HOY, "10:00:00"));
    assert.equal(chip(abierto, "cerrado"), undefined);
  });
});

test("Modo aviso (primera semana): pasa, y se le dice que lo regularice", async () => {
  await aparte(async () => {
    await t.q(`update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = $2::timestamptz + interval '3 days' where gimnasio_id = $1`, [t.g, momento]);
    const g = await guia("vencida");
    assert.deepEqual([g.puede, g.boton, g.segundo], [true, "anotar", "cobrar"]);
    assert.match(g.decile, /primera semana/);
  });
});

test("Permisos: el mostrador la pide; la profe y otro gimnasio no", async () => {
  const socio = t.ctx.socios.al_dia;
  const g = await como(recepcion, async () => (await t.q(`select public.guia_entrada($1, $2) g`, [socio, t.sede]))[0].g);
  assert.equal(g.situacion, "al_dia");
  await como(profe, () => t.falla(() => t.q(`select public.guia_entrada($1, $2)`, [socio, t.sede]), /permiso/i));
  const [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-guia-2', 'Otro') returning id`);
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ('ajeno@ejemplo.invalid') returning id`);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'ajeno','dueno')`, [otro, usuario]);
  await como(usuario, () => t.falla(() => t.q(`select public.guia_entrada($1, $2)`, [socio, t.sede]), /permiso/i));
});
