import { randomUUID } from "node:crypto";
import { traducirErrorSupabase } from "@/lib/admin/errores-supabase";
import { chequearEntorno } from "@/lib/admin/entorno";
import { clienteServicio } from "@/lib/supabase/servicio";
import { dominioBase, dominioPlataforma, subdominiosFuncionan } from "@/lib/dominios";

type Chequeo = { ok: boolean; titulo: string; detalle?: string; aviso?: boolean };

/**
 * Lo que tiene que estar bien configurado para que el super admin funcione.
 * Nunca muestra una clave: solo si está y si responde.
 */
async function chequear(): Promise<Chequeo[]> {
  const crudoBase = process.env.NEXT_PUBLIC_DOMINIO_BASE ?? "";
  const crudoPlataforma = process.env.NEXT_PUBLIC_DOMINIO_PLATAFORMA ?? "";
  const base = dominioBase();
  const lista: Chequeo[] = [];

  lista.push(base
    ? { ok: crudoBase.trim() === base, titulo: `Dominio de los gimnasios: ${base}`,
        detalle: crudoBase.trim() === base ? undefined : `En Vercel dice "${crudoBase}". Funciona igual, pero conviene dejarlo sin https:// ni barra.` }
    : { ok: false, titulo: "Falta NEXT_PUBLIC_DOMINIO_BASE", detalle: "Cargala en Vercel → Settings → Environment Variables y redeployá." });
  if (!dominioPlataforma()) lista.push({ ok: false, titulo: "Falta NEXT_PUBLIC_DOMINIO_PLATAFORMA", detalle: "Cargala en Vercel y redeployá." });
  else if (crudoPlataforma.trim() !== dominioPlataforma()) {
    lista.push({ ok: false, titulo: `Dirección de la plataforma: ${dominioPlataforma()}`, detalle: `En Vercel dice "${crudoPlataforma}". Dejala sin https:// ni barra.` });
  }

  if (base && !subdominiosFuncionan(base)) {
    lista.push({ ok: true, titulo: "Sin dominio propio todavía",
      detalle: `Vercel no da subdominios de ${base}: cada gimnasio se abre desde acá (Entrar al panel, Ver su página → /g/nombre). Con un dominio comprado, cada uno tiene su dirección.` });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    lista.push({ ok: false, titulo: "Falta SUPABASE_SERVICE_ROLE_KEY",
      detalle: traducirErrorSupabase("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY") });
  } else {
    const r = await probarClaveDeServicio();
    lista.push(r.ok
      ? { ok: true, titulo: "Clave de servicio funcionando: se crea y se borra una cuenta de prueba sin problemas" }
      : { ok: false, titulo: "La clave de servicio no funciona: no se pueden crear cuentas", detalle: r.detalle });
  }
  // PLAT-06: producción y vista previa contra el Supabase correcto, claves del mismo proyecto y variables que faltan (sin mostrar ninguna clave).
  for (const c of chequearEntorno(process.env)) lista.push({ ok: c.nivel !== "falta", aviso: c.nivel === "aviso", titulo: c.titulo, detalle: c.detalle });
  return lista;
}

// Se prueba de verdad (crear y borrar un usuario de prueba, sin mail): leer una función no alcanza, porque una clave "anon"
// también lee. Solo se repite cada 10 minutos cuando anda; si falla, se vuelve a probar en cada visita.
let ultimaPruebaOk = 0;
async function probarClaveDeServicio(): Promise<{ ok: true } | { ok: false; detalle: string }> {
  if (Date.now() - ultimaPruebaOk < 10 * 60_000) return { ok: true };
  try {
    const servicio = clienteServicio();
    const { data, error } = await servicio.auth.admin.createUser({ email: `chequeo-${randomUUID()}@ejemplo.invalid`, password: randomUUID(), email_confirm: true });
    if (error || !data.user) return { ok: false, detalle: traducirErrorSupabase(error?.message ?? "no devolvió la cuenta de prueba") };
    const { error: errBorra } = await servicio.auth.admin.deleteUser(data.user.id);
    if (errBorra) return { ok: false, detalle: `Se pudo crear la cuenta de prueba pero no borrarla: ${traducirErrorSupabase(errBorra.message)}` };
    ultimaPruebaOk = Date.now();
    return { ok: true };
  } catch (e) { return { ok: false, detalle: traducirErrorSupabase((e as Error).message) }; }
}

export async function EstadoPlataforma() {
  const lista = await chequear();
  const problemas = lista.filter((c) => !c.ok).length;
  return (
    <details className="tarjeta p-5" open={problemas > 0}>
      <summary className="cursor-pointer titulo text-xl">
        {problemas ? `⚠️ ${problemas === 1 ? "Hay 1 cosa" : `Hay ${problemas} cosas`} para configurar` : "✅ Plataforma bien configurada"}
      </summary>
      <ul className="mt-4 space-y-3">
        {lista.map((c) => (
          <li key={c.titulo} className="flex gap-3">
            <span aria-hidden>{c.ok && !c.aviso ? "✅" : "⚠️"}</span>
            <span><span className="font-semibold">{c.titulo}</span>{c.detalle && <span className="block texto-suave text-sm">{c.detalle}</span>}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
