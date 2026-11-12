> Reemplazado por docs/base/SOCIO-FLUJO.md, docs/base/PLATAFORMA.md (login universal) y docs/base/AJUSTES-0911-NOCHE.md (U2: sin mails, la cuenta se crea con la contraseña que pone quien la crea; C1: clave nueva dada por la recepción) en el ingreso del socio y del equipo. Lo de códigos por mail o SMS y el SMTP queda como opcional para más adelante.

# 11 · Ingresar, registrarse y seguridad

Hoy (`/ingresar`): código por SMS, código por mail, mail + contraseña; el
socio crea su contraseña (APP-9); `/elegir` gimnasio; PIN de equipo
(CAJ-3). **Se queda todo.**

## Datos verificados (05/11/2026) que cambian decisiones

- **Supabase con el SMTP incluido manda solo 2 mails por hora en todo el
  proyecto.** Sin SMTP propio (Resend, Postmark) el código por mail, el
  magic link y "olvidé mi contraseña" **no sirven en producción** → 🔌
  configurar SMTP es lo primero (QUÉ CONFIGURÁS VOS).
- **Passkeys** (huella/Face ID) en Supabase: **beta** desde mayo 2026
  (`auth: { experimental: { passkey: true } }`, supabase-js ≥ 2.105). El
  dominio queda atado a las passkeys: **no activarlas hasta tener el dominio
  definitivo**. Nunca como único método.
- **2FA** en Supabase: TOTP (app autenticadora) y teléfono. Se exige con una
  política RLS restrictiva `auth.jwt()->>'aal' = 'aal2'` en lo sensible.
- **Cerrar sesión en todos lados** borra los refresh tokens pero el token ya
  emitido vale hasta que vence → JWT corto (10 min) **y** chequear en SQL que
  la persona del equipo siga activa (ya lo hace `exigir_equipo`: verificar).
- WhatsApp OTP: solo con Twilio/Twilio Verify. Límites: un código por
  usuario cada 60 s, 30 logins cada 5 min por IP.

## La pantalla de ingreso (más linda, igual de rápida)

- Con la **marca del gimnasio** (logo y color, de datos) cuando se entra
  desde su dirección o `/g/<slug>`; con la de Gym OS desde la plataforma.
- Animación corta y sobria: el logo aparece (200 ms), fondo con un
  degradé lento del color del gimnasio (CSS, se apaga con reduced-motion),
  la tarjeta de vidrio con el formulario. Nada pesado: carga en < 1 s.
- **Primero quién, después cómo**: un campo "Tu celular o tu mail"; según
  lo que escribe y la cuenta, ofrece: código por WhatsApp/SMS (celular),
  contraseña, código por mail, Google. Un solo lugar para entrar o
  registrarse.
- Código de 6 dígitos que se completa solo (`autocomplete="one-time-code"`,
  `inputmode="numeric"`, pegar, verificar al sexto dígito) y "Reenviar en
  0:59".
- Errores que no revelan quién tiene cuenta ("Si el mail está registrado,
  te llegó un código"); errores de red claros.
- "¿Olvidaste tu contraseña?" que funciona (con SMTP).
- Socio: sesión recordada en el celular. Equipo en la compu del mostrador:
  sesión del gimnasio + PIN por persona (ya existe).

## Registrarse (socio) — D26

Ver `05-SOCIO.md §2b`. Con CAPTCHA (Turnstile 🔌) solo en registro y envío
de códigos (los SMS cuestan). DNI sí (es la llave de la Entrada), salud no.

## Cuenta y seguridad (cada usuario)

- **Cambiar contraseña** (dueño, equipo, socio, super admin) desde "Mi
  cuenta"; **mis sesiones** (dispositivo, última actividad) y "cerrar las
  demás".
- **Dueño y super admin**: 2FA con app autenticadora (TOTP), obligatorio
  para super admin y recomendado (con recordatorio) para el dueño. Políticas
  `aal2` en lo sensible (plata, equipo, configuración, exportar).
- **Equipo**:
  - Agregar persona: nombre, rol, foto, celular, mail; se le crea la cuenta
    y se manda el WhatsApp con el acceso (ya existe "dar acceso").
  - **Dar de baja** en un botón: cuenta desactivada, sesiones cerradas, PIN
    borrado, turno cerrado; el historial queda.
  - Profes: qué clases da, horario, foto (se ve en la página y la app).
- **Alertas de seguridad** al dueño: ingreso desde un dispositivo nuevo del
  equipo, exportes grandes, muchos intentos fallidos de PIN.
