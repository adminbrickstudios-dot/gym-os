import "server-only";
import type { ReactNode } from "react";
import { Aviso } from "@/components/panel/Marco";
import { ErrorDatos } from "@/lib/panel/servidor";
import { Reintentar } from "@/components/ui/Reintentar";
import { SalidaError } from "@/components/ui/SalidaError";
import { PaginaHidratada } from "@/components/Hidratado";

/**
 * Corre una pantalla y, si la base dijo que no (sin permiso, dato inválido),
 * muestra ESE mensaje. En producción Next oculta el texto de los errores del
 * servidor, así que no se puede dejar que lleguen a error.tsx: el usuario
 * vería "algo salió mal" en vez de "no tenés acceso".
 * Lo que no es de la base (redirect, notFound, fallas de red) sigue su curso.
 */
export async function intentar(pantalla: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return <>{await pantalla()}<PaginaHidratada /></>;
  } catch (e) {
    if (!(e instanceof ErrorDatos)) throw e;
    if (e.codigo === "apagada") return <Aviso icono="grilla" titulo="Esta sección está apagada"><p>{e.message}</p><SalidaError /></Aviso>;
    if (e.codigo === "demora") return <Aviso icono="reloj-arena" titulo="La base está tardando"><p>{e.message}</p><Reintentar /></Aviso>;
    return e.sinPermiso
      ? <Aviso icono="candado" titulo="No tenés acceso a esta pantalla"><p>{e.message}</p><SalidaError /></Aviso>
      : <Aviso titulo="No se pudo cargar esta pantalla"><p>{e.message}</p><SalidaError /></Aviso>;
  }
}
