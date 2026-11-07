// VD-61 · ¿Supabase Auth manda mails con un SMTP propio? Es una configuración del panel de Supabase que la app no puede leer:
// quien la configura lo avisa con SMTP_CONFIGURADO=1. Sin la variable se asume que NO (lo más prudente): el ingreso lo dice
// y ofrece el código por celular o pedírselo a la recepción. Con el SMTP incluido de Supabase salen solo 2 mails por hora en todo el proyecto.

export const smtpActivo = (env: Record<string, string | undefined> = process.env) => env.SMTP_CONFIGURADO === "1";
