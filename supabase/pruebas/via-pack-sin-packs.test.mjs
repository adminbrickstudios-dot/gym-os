// F1.6 · REGLA DURA: la salida rápida de privado.via_pack (socio sin packs) no cambia ningún veredicto.
// Compara, con momentos FIJOS (nunca now()), la función vigente contra una COPIA de la de antes (la de 20261104009500, creada acá en pg_temp
// y que se va con la transacción), para los casos testigo y para socios con packs armados a propósito (vigente, agotado, vencido con clases,
// futuro, anulado, de otra sede, que se descuenta en la clase). Falla si difiere UNA columna de UN socio en UN momento.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, socios = [];
const VIEJA = `
create function pg_temp.via_pack_vieja(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid, p_zona text, p_cfg public.configuracion_gimnasio)
returns public.veredicto_acceso language plpgsql stable set search_path = '' as $f$
declare
  v public.veredicto_acceso; pk record; ultimo record; consumio_hoy boolean; hay_otra_sede boolean := false;
begin
  for pk in
    select p.*, pl.consume_en, pl.todas_las_sedes,
           p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) - privado.faltas_pack(p.id, p_momento) as restantes,
           (p_sede_id is null or pl.todas_las_sedes
            or exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = p_sede_id)) as vale_aca
      from public.packs p join public.planes pl on pl.id = p.plan_id
     where p.socio_id = p_socio_id and p.anulado_en is null
       and p.desde <= p_momento and (p.vence_en is null or p.vence_en > p_momento)
     order by p.vence_en nulls last, p.desde
  loop
    continue when pk.restantes <= 0;
    if not pk.vale_aca then hay_otra_sede := true; continue; end if;
    v.via := 'pack'; v.puede := true; v.color := 'verde';
    if pk.consume_en = 'asistencia' then
      v.motivo := 'pack'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
      v.texto := 'Tiene pack · le quedan ' || pk.restantes || ' · se descuenta en la clase';
      return v;
    end if;
    select exists (
      select 1 from public.consumos_pack c
       where c.socio_id = p_socio_id and c.anulado_en is null and c.ingreso_id is not null
         and privado.dia_local(c.momento, p_zona) = privado.dia_local(p_momento, p_zona)
    ) into consumio_hoy;
    if consumio_hoy and not p_cfg.reingreso_mismo_dia_consume then
      v.motivo := 'pack_reingreso'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
      v.texto := 'Reingreso de hoy · el pack no se descuenta · le quedan ' || pk.restantes;
    else
      v.motivo := 'pack'; v.consume := 'pack'; v.consume_id := pk.id; v.pack_restantes := pk.restantes - 1;
      v.texto := 'Entra con el pack · le quedan ' || (pk.restantes - 1);
    end if;
    return v;
  end loop;
  v.puede := false; v.color := 'rojo'; v.via := 'pack'; v.consume := 'nada';
  if hay_otra_sede then
    v.motivo := 'fuera_de_sede'; v.texto := 'El pack no incluye esta sede';
    return v;
  end if;
  select p.*, p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) - privado.faltas_pack(p.id, p_momento) as restantes
    into ultimo
    from public.packs p
   where p.socio_id = p_socio_id and p.anulado_en is null and p.desde <= p_momento
   order by p.desde desc limit 1;
  if not found then return null; end if;
  v.pack_restantes := greatest(ultimo.restantes, 0);
  if ultimo.vence_en is not null and ultimo.vence_en <= p_momento and ultimo.restantes > 0 then
    v.motivo := 'pack_vencido';
    v.texto := 'El pack venció el ' || privado.ultimo_dia(ultimo.vence_en, p_zona) || ' con ' || ultimo.restantes || ' clases sin usar';
  else
    v.motivo := 'pack_agotado';
    v.texto := 'Usó las ' || ultimo.cantidad || ' clases del pack';
  end if;
  return v;
end $f$`;

before(async () => {
  t = await abrir("prueba-via-pack");
  await t.q(VIEJA);
  const dia = async (n, hora = "00:00:00") => (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, n), t.ctx.zona, hora]))[0].m;
  const [{ id: sede2 }] = await t.q(`insert into public.sedes (gimnasio_id, nombre) values ($1, 'Otra sede') returning id`, [t.g]);
  const plan = async (nombre, consume, todas = true, sedes = []) => {
    const [{ id }] = await t.q(`insert into public.planes (gimnasio_id, tipo, nombre, cantidad_clases, validez_dias, consume_en, todas_las_sedes)
      values ($1,'pack',$2,4,60,$3,$4) returning id`, [t.g, nombre, consume, todas]);
    for (const s of sedes) await t.q(`insert into public.plan_sedes (gimnasio_id, plan_id, sede_id) values ($1,$2,$3)`, [t.g, id, s]);
    return id;
  };
  const pIngreso = await plan("Pack ingreso", "ingreso");
  const pClase = await plan("Pack clase", "asistencia");
  const pOtra = await plan("Pack otra sede", "ingreso", false, [sede2]);
  let k = 0;
  const socio = async (nombre, packs = []) => {
    k++;
    const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,$2,'Pack',$3) returning id`, [t.g, nombre, `+5490000700${String(k).padStart(3, "0")}`]);
    for (const p of packs) {
      await t.q(`insert into public.packs (gimnasio_id, socio_id, plan_id, cantidad, desde, vence_en, anulado_en) values ($1,$2,$3,$4,$5,$6,$7)`,
        [t.g, id, p.plan, p.cantidad ?? 4, await dia(p.desde ?? -10), p.vence === null ? null : await dia(p.vence ?? 30), p.anulado ? await dia(-5) : null]);
    }
    return id;
  };
  await socio("Sin packs");
  await socio("Vigente", [{ plan: pIngreso }]);
  await socio("Sin vencimiento", [{ plan: pIngreso, vence: null }]);
  await socio("Se descuenta en la clase", [{ plan: pClase }]);
  await socio("Vencido con clases", [{ plan: pIngreso, desde: -60, vence: -3 }]);
  await socio("Futuro", [{ plan: pIngreso, desde: 5, vence: 40 }]);
  await socio("Anulado", [{ plan: pIngreso, anulado: true }]);
  await socio("Otra sede", [{ plan: pOtra }]);
  await socio("Dos packs", [{ plan: pIngreso, desde: -50, vence: -20 }, { plan: pClase }]);
  const ids = await t.q(`select id from public.socios where gimnasio_id = $1`, [t.g]);
  socios = ids.map((x) => x.id);
});
after(async () => t && t.cerrar());

const MOMENTOS = [-70, -45, -20, -10, -3, 0, 1, 5, 20, 45];   // días respecto de HOY, a las 19:00 y a las 00:00

test("via_pack nueva == via_pack de antes: todos los socios, 20 momentos fijos, con y sin sede", async () => {
  const [{ cfg }] = await t.q(`select c as cfg from public.configuracion_gimnasio c where gimnasio_id = $1`, [t.g]);
  void cfg;
  let comparados = 0;
  for (const n of MOMENTOS) for (const hora of ["00:00:00", "19:00:00"]) {
    const m = (await t.q(`select privado.medianoche($1::date, $2) + $3::interval as m`, [sumarDias(HOY, n), t.ctx.zona, hora]))[0].m;
    for (const sede of [null, t.sede]) {
      const { rows } = await t.db.query(`
        with c as (select * from public.configuracion_gimnasio where gimnasio_id = $1)
        select s.id, s.nombre,
               (privado.via_pack(s.id, $2, $3, $4, c)) as nuevo,
               (pg_temp.via_pack_vieja(s.id, $2, $3, $4, c)) as viejo
          from public.socios s cross join c where s.gimnasio_id = $1`, [t.g, m, sede, t.ctx.zona]);
      for (const r of rows) {
        comparados++;
        assert.equal(r.nuevo, r.viejo, `${r.nombre} · día ${n} ${hora} · sede ${sede ? "dada" : "ninguna"}: ${r.nuevo} != ${r.viejo}`);
      }
    }
  }
  assert.ok(comparados >= socios.length * 40, `se compararon ${comparados} veredictos`);
  console.log(`  via_pack: ${comparados} veredictos comparados (nueva == vieja)`);
});

test("calcular_acceso completo de cada socio no cambió: el color y el texto salen de la misma vía", async () => {
  // Con packs en juego el veredicto de la puerta pasa por via_pack: se ve que sigue dando lo esperado.
  const v = async (nombre) => (await t.q(`select (privado.calcular_acceso(s.id, $2, $3)).texto as texto, (privado.calcular_acceso(s.id, $2, $3)).motivo as motivo
      from public.socios s where s.gimnasio_id = $1 and s.nombre = $4`, [t.g, (await t.q(`select privado.medianoche($1::date, $2) + interval '19 hours' m`, [HOY, t.ctx.zona]))[0].m, t.sede, nombre]))[0];
  assert.match((await v("Vigente")).texto, /pack/i);
  assert.equal((await v("Sin packs")).motivo !== "pack", true);
});
