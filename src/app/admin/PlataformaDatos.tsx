import { rpc } from "@/lib/panel/servidor";
import { Plataforma, type DatosPlataforma } from "./Plataforma";

/** Arma lo de la plataforma (SA-7, SA-8, SA-9) del lado del servidor. El deploy sale de las variables que pone Vercel. */
export async function PlataformaDatos() {
  const [estado, uso, mantenimientos, funciones, linkPago] = await Promise.all([
    rpc<DatosPlataforma["estado"]>("admin_plataforma_estado").catch(() => ({ migraciones: 0, ultima_migracion: null, tamano_base_mb: 0 })),
    rpc<DatosPlataforma["uso"]>("admin_uso_gimnasios").catch(() => []),
    rpc<DatosPlataforma["mantenimientos"]>("admin_mantenimientos").catch(() => []),
    rpc<DatosPlataforma["funciones"]>("admin_funciones_prueba").catch(() => []),
    rpc<string | null>("admin_link_pago").catch(() => null),
  ]);
  const deploy = { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, region: process.env.VERCEL_REGION ?? null, entorno: process.env.VERCEL_ENV ?? null };
  return <Plataforma d={{ estado, deploy, uso, mantenimientos, funciones, linkPago }} />;
}
