import { redirect } from "next/navigation";

// D41: puerta fija del rol "profe". Muestra el ingreso con la marca del gimnasio y después lleva al panel de siempre (/panel).
export function GET() {
  redirect("/ingresar?rol=profe&siguiente=%2Fpanel");
}
