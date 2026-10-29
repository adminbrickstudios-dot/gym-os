// ═══════════════════════════════════════════════════════════════════
// Casos testigo: un socio por cada respuesta posible de "¿puede entrar?".
// ÚNICA fuente: la usan el seed del gimnasio demo y las pruebas.
// Los nombres no se tipean en ningún otro lado.
//
// Las fechas son días relativos a "hoy" (0 = hoy). Una cobertura
// { desde: -20, hasta: 11 } cubre desde hace 20 días hasta el día +10
// inclusive: "hasta" es exclusivo, la medianoche del día siguiente.
// Datos obviamente ficticios: teléfonos +549000..., mails @ejemplo.invalid.
// ═══════════════════════════════════════════════════════════════════

export const PLANES_TESTIGO = [
  { clave: "full", tipo: "membresia", nombre: "Plan Full", duracion_meses: 1, renovacion: "continua", precio: 25000 },
  { clave: "manana", tipo: "membresia", nombre: "Plan Mañana", duracion_meses: 1, renovacion: "continua",
    hora_desde: "07:00", hora_hasta: "12:00", precio: 18000 },
  { clave: "tres", tipo: "membresia", nombre: "Plan 3 veces", duracion_meses: 1, renovacion: "continua",
    max_ingresos_semana: 3, precio: 20000 },
  { clave: "pase", tipo: "pase_diario", nombre: "Pase diario", precio: 5000 },
  { clave: "pack10", tipo: "pack", nombre: "Pack 10 clases", cantidad_clases: 10, validez_dias: 60,
    consume_en: "ingreso", precio: 40000 },
  { clave: "pack5", tipo: "pack", nombre: "Pack 5 clases", cantidad_clases: 5, validez_dias: 30,
    consume_en: "ingreso", precio: 22000 },
];

// Hora del día a la que se evalúan los casos (hora local del gimnasio).
export const HORA_TESTIGO = "19:00";

export const CASOS_TESTIGO = [
  { clave: "al_dia", nombre: "Testigo", apellido: "Al Día",
    suscripcion: "full", coberturas: [{ desde: -20, hasta: 11 }],
    esperado: { puede: true, color: "verde", motivo: "al_dia" } },

  { clave: "por_vencer", nombre: "Testigo", apellido: "Por Vencer",
    suscripcion: "full", coberturas: [{ desde: -27, hasta: 3 }],
    esperado: { puede: true, color: "amarillo", motivo: "por_vencer" } },

  { clave: "vence_hoy", nombre: "Testigo", apellido: "Vence Hoy",
    suscripcion: "full", coberturas: [{ desde: -29, hasta: 1 }],
    esperado: { puede: true, color: "amarillo", motivo: "por_vencer", texto: /^Vence hoy/ } },

  { clave: "en_tolerancia", nombre: "Testigo", apellido: "En Tolerancia",
    suscripcion: "full", coberturas: [{ desde: -32, hasta: -2 }],
    esperado: { puede: true, color: "naranja", motivo: "en_tolerancia", tolerancia_usada: 3, tolerancia_total: 5 } },

  { clave: "vencida", nombre: "Testigo", apellido: "Vencida",
    suscripcion: "full", coberturas: [{ desde: -50, hasta: -20 }],
    esperado: { puede: false, color: "rojo", motivo: "vencida", para_regularizar: 25000 } },

  { clave: "vencida_tres_meses", nombre: "Testigo", apellido: "Debe Tres",
    suscripcion: "full", coberturas: [{ desde: -116, hasta: -86 }],
    // con hoy = 14/11: venció el 19/08; períodos 20/08, 20/09, 20/10 → 3 cuotas
    esperado: { puede: false, color: "rojo", motivo: "vencida", para_regularizar: 75000 }, soloConHoyFijo: true },

  { clave: "sin_pago", nombre: "Testigo", apellido: "Sin Pago",
    suscripcion: "full", coberturas: [],
    esperado: { puede: false, color: "rojo", motivo: "sin_pago", para_regularizar: 25000 } },

  { clave: "congelada", nombre: "Testigo", apellido: "Congelada",
    suscripcion: "full", coberturas: [{ desde: -10, hasta: 20 }],
    congelamiento: { desde: -2, hasta: 10, categoria: "viaje" },
    esperado: { puede: false, color: "rojo", motivo: "congelada" } },

  { clave: "suspendido", nombre: "Testigo", apellido: "Suspendido",
    suscripcion: "full", coberturas: [{ desde: -10, hasta: 20 }],
    suspension: { desde: -1, motivo: "Conducta en el vestuario" },
    esperado: { puede: false, color: "rojo", motivo: "suspendido" } },

  { clave: "pase_hoy", nombre: "Testigo", apellido: "Pase Hoy",
    pases: [{ dia: 0 }],
    esperado: { puede: true, color: "verde", motivo: "pase_de_hoy", via: "pase", consume: "pase" } },

  { clave: "pack_con_clases", nombre: "Testigo", apellido: "Con Pack",
    packs: [{ plan: "pack10", desde: -10, consumidas: 3 }],
    esperado: { puede: true, color: "verde", motivo: "pack", via: "pack", consume: "pack", pack_restantes: 6 } },

  { clave: "pack_agotado", nombre: "Testigo", apellido: "Pack Agotado",
    packs: [{ plan: "pack5", desde: -10, consumidas: 5 }],
    esperado: { puede: false, color: "rojo", motivo: "pack_agotado" } },

  { clave: "pack_vencido", nombre: "Testigo", apellido: "Pack Vencido",
    packs: [{ plan: "pack5", desde: -40, vence: -1, consumidas: 2 }],
    esperado: { puede: false, color: "rojo", motivo: "pack_vencido" } },

  { clave: "vencida_con_pack", nombre: "Testigo", apellido: "Vencida Con Pack",
    suscripcion: "full", coberturas: [{ desde: -50, hasta: -20 }],
    packs: [{ plan: "pack10", desde: -5, consumidas: 0 }],
    esperado: { puede: true, color: "verde", via: "pack", consume: "pack", aviso: /^Venció/ } },

  { clave: "tolerancia_con_pack", nombre: "Testigo", apellido: "Tolerancia Con Pack",
    suscripcion: "full", coberturas: [{ desde: -32, hasta: -2 }],
    packs: [{ plan: "pack10", desde: -5, consumidas: 0 }],
    esperado: { puede: true, color: "naranja", via: "membresia", consume: "nada" } },

  { clave: "congelada_con_pase", nombre: "Testigo", apellido: "Congelada Con Pase",
    suscripcion: "full", coberturas: [{ desde: -10, hasta: 20 }],
    congelamiento: { desde: -2, hasta: 10, categoria: "personal" },
    pases: [{ dia: 0 }],
    esperado: { puede: true, color: "verde", via: "pase", aviso: /^Congelada/ } },

  { clave: "fuera_de_franja", nombre: "Testigo", apellido: "Fuera De Franja",
    suscripcion: "manana", coberturas: [{ desde: -10, hasta: 20 }],
    esperado: { puede: false, color: "rojo", motivo: "fuera_de_franja" } },

  { clave: "tope_semanal", nombre: "Testigo", apellido: "Tope Semanal",
    suscripcion: "tres", coberturas: [{ desde: -10, hasta: 20 }],
    // con hoy = sábado 14/11, la semana empezó el lunes 9/11
    ingresosPrevios: [-5, -4, -3],
    esperado: { puede: false, color: "rojo", motivo: "tope_semanal" }, soloConHoyFijo: true },

  { clave: "sin_plan", nombre: "Testigo", apellido: "Sin Plan",
    esperado: { puede: false, color: "gris", motivo: "sin_plan" } },

  { clave: "se_fue", nombre: "Testigo", apellido: "Se Fue",
    baja: { dia: -30, motivo: "mudanza" },
    esperado: { puede: false, color: "gris", motivo: "se_fue" } },

  { clave: "cumple", nombre: "Testigo", apellido: "Cumpleañero",
    suscripcion: "full", coberturas: [{ desde: -20, hasta: 11 }], cumpleHoy: true,
    esperado: { puede: true, color: "verde", aviso: /Cumple años hoy/ } },
];

// ── Utilidades de fechas (días calendario, sin zona) ─────────────────
export function sumarDias(isoDia, n) {
  const d = new Date(`${isoDia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Siembra ─────────────────────────────────────────────────────────
// Crea los planes testigo (si no existen) y un socio por caso.
// `db` es un pg.Client conectado como dueño de la base (sin RLS).
// Devuelve { planes: {clave: id}, socios: {clave: id} }.
export async function sembrarCasos(db, { gimnasioId, sedeId, hoy, telefonoBase = 5490000100000 }) {
  const { rows: [{ zona }] } = await db.query("select zona_horaria as zona from public.gimnasios where id = $1", [gimnasioId]);
  const medianoche = async (dia) =>
    (await db.query("select privado.medianoche($1::date, $2) as t", [dia, zona])).rows[0].t;

  const planes = {};
  for (const p of PLANES_TESTIGO) {
    const { rows } = await db.query(
      `insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion, hora_desde, hora_hasta,
                                  max_ingresos_semana, cantidad_clases, validez_dias, consume_en)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (gimnasio_id, nombre) do update set nombre = excluded.nombre
       returning id`,
      [gimnasioId, p.tipo, p.nombre, p.duracion_meses ?? null, p.renovacion ?? null, p.hora_desde ?? null,
       p.hora_hasta ?? null, p.max_ingresos_semana ?? null, p.cantidad_clases ?? null, p.validez_dias ?? null,
       p.consume_en ?? null]
    );
    planes[p.clave] = rows[0].id;
    await db.query(
      `insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde)
       values ($1, $2, $3, '2020-01-01T00:00:00Z') on conflict do nothing`,
      [gimnasioId, planes[p.clave], p.precio]
    );
  }

  const ventaPagada = async (socioId, planClave, descripcion, momento) => {
    const plan = PLANES_TESTIGO.find((p) => p.clave === planClave);
    const { rows: [v] } = await db.query(
      `insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, confirmada_en, creado_en)
       values ($1,$2,$3,'confirmada','recepcion',$4,$4) returning id`,
      [gimnasioId, sedeId, socioId, momento]);
    const tipo = plan.tipo === "membresia" ? "cuota" : plan.tipo === "pack" ? "pack" : "pase";
    const { rows: [it] } = await db.query(
      `insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, descripcion, precio_unitario)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [gimnasioId, v.id, tipo, planes[planClave], descripcion, plan.precio]);
    await db.query(
      `insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, creado_en)
       values ($1,$2,'transferencia',$3,'aprobado',$4,$4)`,
      [gimnasioId, v.id, plan.precio, momento]);
    return it.id;
  };

  const socios = {};
  let i = 0;
  for (const c of CASOS_TESTIGO) {
    i++;
    if (c.soloConHoyFijo && hoy !== "2026-11-14") continue;
    const nacimiento = c.cumpleHoy ? `1990-${hoy.slice(5)}` : `1990-0${(i % 9) + 1}-1${i % 10}`;
    const { rows: [s] } = await db.query(
      `insert into public.socios (gimnasio_id, nombre, apellido, telefono, email, fecha_nacimiento, notas)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [gimnasioId, c.nombre, c.apellido, `+${telefonoBase + i}`, `testigo.${c.clave}@ejemplo.invalid`,
       nacimiento, `Caso testigo: ${c.clave}`]);
    socios[c.clave] = s.id;

    if (c.suscripcion) {
      const inicio = await medianoche(sumarDias(hoy, -200));
      const { rows: [su] } = await db.query(
        `insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3,$4) returning id`,
        [gimnasioId, s.id, planes[c.suscripcion], inicio]);
      for (const cb of c.coberturas ?? []) {
        const desde = await medianoche(sumarDias(hoy, cb.desde));
        const hasta = await medianoche(sumarDias(hoy, cb.hasta));
        const item = await ventaPagada(s.id, c.suscripcion, "Cuota", desde);
        await db.query(
          `insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, venta_item_id)
           values ($1,$2,$3,$4,$5,'pago',$6)`,
          [gimnasioId, su.id, s.id, desde, hasta, item]);
      }
      if (c.congelamiento) {
        await db.query("select privado.congelar($1, $2::date, $3::date, $4, null, null)",
          [su.id, sumarDias(hoy, c.congelamiento.desde), sumarDias(hoy, c.congelamiento.hasta), c.congelamiento.categoria]);
      }
    }

    if (c.suspension) {
      await db.query(
        `insert into public.suspensiones (gimnasio_id, socio_id, desde, motivo) values ($1,$2,$3,$4)`,
        [gimnasioId, s.id, await medianoche(sumarDias(hoy, c.suspension.desde)), c.suspension.motivo]);
    }

    for (const p of c.pases ?? []) {
      const desde = await medianoche(sumarDias(hoy, p.dia));
      const hasta = await medianoche(sumarDias(hoy, p.dia + 1));
      const item = await ventaPagada(s.id, "pase", "Pase diario", desde);
      await db.query(
        `insert into public.pases_diarios (gimnasio_id, socio_id, plan_id, desde, hasta, venta_item_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [gimnasioId, s.id, planes.pase, desde, hasta, item]);
    }

    for (const pk of c.packs ?? []) {
      const plan = PLANES_TESTIGO.find((p) => p.clave === pk.plan);
      const desde = await medianoche(sumarDias(hoy, pk.desde));
      const vence = await medianoche(sumarDias(hoy, pk.vence ?? pk.desde + plan.validez_dias));
      const item = await ventaPagada(s.id, pk.plan, plan.nombre, desde);
      const { rows: [paq] } = await db.query(
        `insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en, venta_item_id)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [gimnasioId, s.id, planes[pk.plan], plan.cantidad_clases, desde, vence, item]);
      for (let k = 0; k < pk.consumidas; k++) {
        const dia = sumarDias(hoy, pk.desde + k);
        const momento = (await db.query(
          "select privado.medianoche($1::date, $2) + interval '19 hours' as t", [dia, zona])).rows[0].t;
        const { rows: [ing] } = await db.query(
          `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado,
                                        via_habilitante, color, motivo, texto)
           values ($1,$2,$3,$4,'recepcion','entro','pack','verde','pack','Entra con el pack') returning id`,
          [gimnasioId, sedeId, s.id, momento]);
        await db.query(
          `insert into public.consumos_pack (gimnasio_id, pack_id, socio_id, momento, ingreso_id)
           values ($1,$2,$3,$4,$5)`, [gimnasioId, paq.id, s.id, momento, ing.id]);
      }
    }

    for (const d of c.ingresosPrevios ?? []) {
      const momento = (await db.query(
        "select privado.medianoche($1::date, $2) + interval '19 hours' as t", [sumarDias(hoy, d), zona])).rows[0].t;
      await db.query(
        `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado,
                                      via_habilitante, color, motivo, texto)
         values ($1,$2,$3,$4,'recepcion','entro','membresia','verde','al_dia','Al día')`,
        [gimnasioId, sedeId, s.id, momento]);
    }

    if (c.baja) {
      await db.query(`update public.socios set dado_de_baja_en = $2, motivo_baja = $3 where id = $1`,
        [s.id, await medianoche(sumarDias(hoy, c.baja.dia)), c.baja.motivo]);
    }
  }
  return { planes, socios, zona };
}
