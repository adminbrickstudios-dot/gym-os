// El color del semáforo de acceso, siempre con su texto al lado: nunca solo color.
const VAR: Record<string, string> = {
  verde: "var(--verde)", amarillo: "var(--amarillo)", naranja: "var(--naranja)", rojo: "var(--rojo)", azul: "var(--azul)", gris: "var(--texto-tenue)",
};
const NOMBRE: Record<string, string> = { verde: "Puede entrar", amarillo: "Puede entrar, con aviso", naranja: "Atención", rojo: "No puede entrar", gris: "Sin plan" };

export function PuntoEstado({ color, grande = false }: { color: string; grande?: boolean }) {
  return (
    <span role="img" aria-label={NOMBRE[color] ?? color}
      className={`${grande ? "size-4" : "size-3"} rounded-full flex-none`}
      style={{ background: VAR[color] ?? VAR.gris, boxShadow: `0 0 0 4px color-mix(in oklab, ${VAR[color] ?? VAR.gris}, transparent 80%)` }} />
  );
}

export function PildoraEstado({ color, children }: { color: string; children: React.ReactNode }) {
  const clase = color === "gris" ? "pildora" : `pildora pildora-${color}`;
  return <span className={clase}><PuntoEstado color={color} />{children}</span>;
}

export const colorVar = (color: string) => VAR[color] ?? VAR.gris;
