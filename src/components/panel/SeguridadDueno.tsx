import Link from "next/link";
import { Mensaje } from "@/components/ui/Mensaje";
import { rpcLectura } from "@/lib/panel/servidor";
import { AlertasSeguridad, type AlertaSeguridad } from "./AlertasSeguridad";

type Seguridad = { dos_pasos: boolean; confirmada: boolean; obligatoria: boolean; sin_ver: number; alertas: AlertaSeguridad[] };

/** VD-42, en Inicio del dueño: la verificación en dos pasos recomendada y las alertas de seguridad sin ver. */
export async function SeguridadDueno({ gimnasioId, zona }: { gimnasioId: string; zona: string }) {
  let s: Seguridad;
  try {
    s = await rpcLectura<Seguridad>("seguridad_dueno", { p_gimnasio_id: gimnasioId });
  } catch (e) {
    return <Mensaje tipo="error">No pudimos revisar la seguridad de tu cuenta: {(e as Error).message}</Mensaje>;
  }
  return (
    <>
      {!s.dos_pasos && (
        <Mensaje tipo="aviso" accion={<Link href="/panel/cuenta#dos-pasos" className="boton boton-chico" data-activar-2fa>Activar</Link>}>
          <p data-recomendar-2fa><strong>Protegé tu cuenta con la verificación en dos pasos.</strong> Con ella, nadie exporta tus datos ni toca tu equipo y tus cobros solo con tu contraseña.</p>
        </Mensaje>
      )}
      {s.dos_pasos && !s.confirmada && (
        <Mensaje tipo="info" accion={<Link href="/panel/cuenta#dos-pasos" className="boton boton-chico">Confirmar</Link>}>
          <p data-confirmar-2fa>Para exportar datos, tocar el equipo o cambiar los cobros, confirmá tu código de la app.</p>
        </Mensaje>
      )}
      <AlertasSeguridad alertas={s.alertas} zona={zona} />
    </>
  );
}
