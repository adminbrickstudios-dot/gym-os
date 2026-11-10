# Pensar antes de cada bloque (pedido de Mateo, 09/11)

Antes de construir cada ítem, el agente escribe acá un bloque de **15 líneas
como máximo**. Los bloques nuevos van arriba.

1. **Qué pidió Mateo y qué quiso decir.** No es un técnico: se lee la
   intención, no la letra.
2. **Cómo lo resuelve un producto profesional**: Vercel Platforms
   (github.com/vercel/platforms), Cal.com, Shopify, Mindbody, Glofox. Se busca
   en internet o en GitHub cuando hace falta.
3. **Abogado del diablo: 5 formas en que se rompe.** Se eligen de esta lista:
   - otro dominio o subdominio
   - otro rol
   - celular
   - internet lento
   - datos vacíos
   - 1.000 gimnasios
   - doble clic
   - sesión vencida
   - mail con mayúsculas o espacios
   - vista previa contra producción
   - variables de entorno distintas
4. **Lo que Mateo no pidió pero necesita.**
5. **La decisión, y cómo se va a probar.**

Después de construir, se prueban esas 5 formas. Si una falla, no está
terminado.

---

## U0.1 · El login roto (09/11 noche)
1. **Qué pidió y qué quiso decir.** Mateo crea un gimnasio con su dueño, entra por `/g/template-gym/ingresar` con el mail y la contraseña que puso, y lo manda al `/ingresar` genérico con "mail o contraseña incorrectos". Quiere: entrar a su gimnasio, con su marca, o un mensaje que diga exactamente qué pasa.
2. **Cómo lo hace un producto profesional.** Vercel Platforms / Cal.com / Shopify: una sola pantalla de ingreso, la dirección del gimnasio muestra su marca y usa el mismo login; los errores distinguen "no existe", "contraseña", "sin confirmar", "sin gimnasio", y nunca caen a un gimnasio por defecto.
3. **5 formas en que se rompe.**
   - **Cuenta ya existente:** el mail ya tenía cuenta (el de Mateo, por ejemplo) y la contraseña que escribió al crear NO se aplica (no se pisa la de una cuenta existente): el ingreso dice "incorrectos". Es la causa más probable junto con "Invalid API key" (la cuenta nunca se creó).
   - **Mayúsculas o espacios** en el mail: se normaliza (minúsculas, sin espacios) al crear y al entrar. Probado.
   - **Redirect que pierde el gimnasio:** `/g/<slug>/ingresar` rebotaba a `/ingresar` sin marca. Ahora se queda en esa dirección (reescritura) y comprueba que la cuenta sea de ese gimnasio.
   - **Sin confirmar o desactivada:** antes se veía como "incorrectos"; ahora cada una dice lo suyo.
   - **Cero, uno o varios gimnasios** y **doble clic / sesión vencida**: 0 → mensaje con salida; 1 → panel; varios → elegir.
4. **Lo que no pidió pero necesita.** Que el alta diga en palabras cuando el mail YA tenía cuenta y que la contraseña escrita no se aplicó (pedido a B), y la prueba permanente en producción (U0.3).
5. **Decisión y prueba.** Reescritura en el proxy, mensajes por motivo, vitest de `motivoDeEntrada`, e2e de las tres puertas (`fase-u0-login.mjs`) en Actions.

---
