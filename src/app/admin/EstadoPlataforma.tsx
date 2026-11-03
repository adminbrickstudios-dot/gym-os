import { clienteServicio } from "@/lib/supabase/servicio";
import { dominioBase, dominioPlataforma, subdominiosFuncionan } from "@/lib/dominios";

type Chequeo = { ok: boolean; titulo: string; detalle?: string };

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
      detalle: "Sin ella no se pueden crear cuentas ni contraseñas. Cargala en Vercel (Production) y redeployá." });
  } else {
    const { error } = await clienteServicio().rpc("usuario_por_mail", { p_email: "chequeo@ejemplo.invalid" });
    lista.push(error
      ? { ok: false, titulo: "La clave de servicio no responde", detalle: `Supabase dice: ${error.message}. Revisá que sea la service_role (o la secret) del mismo proyecto.` }
      : { ok: true, titulo: "Clave de servicio funcionando: se pueden crear cuentas y contraseñas" });
  }
  return lista;
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
            <span aria-hidden>{c.ok ? "✅" : "⚠️"}</span>
            <span><span className="font-semibold">{c.titulo}</span>{c.detalle && <span className="block texto-suave text-sm">{c.detalle}</span>}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
