import { redirect } from "next/navigation";

// D41: puerta fija del rol "dueno". Muestra el ingreso con la marca del gimnasio y después lleva al panel de siempre (/panel).
export function GET() {
  redirect("/ingresar?rol=dueno&siguiente=%2Fpanel");
}
