import { redirect } from "next/navigation";

// VD-13: "Para hacer hoy" vive en /panel/tareas (la ruta de siempre); esta es la dirección corta.
export default function Hoy() {
  redirect("/panel/tareas");
}
