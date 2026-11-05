# Ingresar, elegir gimnasio, super admin · inventario (AUD-15)

Probado con `npm run e2e:acceso` y `npm run e2e:admin` (el recorrido completo del super admin).

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con |
|---|---|---|---|---|
| Ingresar (equipo) | Mail y contraseña; error claro si no coinciden; lleva al panel, a elegir o al super admin. | ✅ | Recuperar contraseña sola (hoy la da el dueño o BRIK) | Supabase Auth, `mi_sesion` |
| Ingresar (socio) | Celular, mail (código) o contraseña (APP-9). | ✅ | — | `vincular_socios_por_telefono` / `_por_email` |
| Elegir gimnasio | Para quien trabaja en varios; el admin ve el super admin. Ahora también los gimnasios donde es **socio**, con link a su app (antes decía "no tiene ningún gimnasio"). | ✅ (arreglado) | — | `mi_sesion` |
| Super admin | Crear gimnasio con dueño, entrar como soporte, claves, direcciones, estado de la plataforma. Otro usuario: "Sin acceso". | ✅ | Salud por gimnasio (ADM-4) | `admin_gimnasios` |
| Gimnasio no encontrado | La dirección escrita y qué revisar. | ✅ | — | middleware |
| Cargando | `loading.tsx` en Ingresar y Elegir (faltaban). | ✅ (nuevo) | — | — |
