// D42: quien crea la cuenta elige: "la escribo yo" (este campo) o dejarlo vacío y que se genere una provisoria.
export function CampoContrasena({ className = "campo" }: { className?: string }) {
  return (
    <input name="contrasena_elegida" type="text" autoComplete="off" minLength={8} className={className} data-contrasena-elegida
      placeholder="Contraseña (opcional, 8 o más)" aria-label="Contraseña que escribís vos (si la dejás vacía, se genera una)" title="Si la dejás vacía, se genera una provisoria" />
  );
}
