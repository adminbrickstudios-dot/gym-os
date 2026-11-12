"use client";
// Dispositivo nuevo o cookie borrada: el tema que la persona eligió (guardado en la base) se aplica sin que tenga que volver a elegirlo.
// Se consulta una sola vez por pestaña y solo si falta la cookie; la mayoría de las visitas no hacen nada.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sincronizarTema } from "./tema-acciones";

export function SincronizarTema() {
  const router = useRouter();
  useEffect(() => {
    try { if (sessionStorage.getItem("gymos_tema_sincronizado")) return; } catch { /* sin almacenamiento: se consulta igual */ }
    // La marca se pone recién cuando la base contestó: si la pantalla se cambia a mitad de camino, la próxima vuelve a intentar.
    void sincronizarTema()
      .then((t) => { try { sessionStorage.setItem("gymos_tema_sincronizado", "1"); } catch { /* idem */ } if (t) router.refresh(); })
      .catch(() => { /* sin conexión: queda el tema del gimnasio */ });
  }, [router]);
  return null;
}
