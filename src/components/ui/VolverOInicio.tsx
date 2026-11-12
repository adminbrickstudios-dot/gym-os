"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** Salida de un error de pantalla: volver a donde estaba, o ir al inicio de la zona (panel, app del socio o super admin). */
export function VolverOInicio() {
  const router = useRouter();
  const ruta = usePathname() ?? "";
  const inicio = ruta.startsWith("/app") ? "/app" : ruta.startsWith("/admin") ? "/admin" : "/panel";
  return (
    <div className="flex flex-wrap gap-2 mt-6" data-volver-o-inicio>
      <button type="button" className="boton" onClick={() => router.back()}>Volver</button>
      <Link href={inicio} className="boton">Ir al inicio</Link>
    </div>
  );
}
