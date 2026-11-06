# 10 · Super admin (BRIK)

Hoy (`/admin`): estado de la plataforma, alta de gimnasio con plantillas por
tipo (ADM-1), salud de cada gimnasio (ADM-4), entrar como "Soporte BRIK",
equipo y claves (nueva contraseña, dar acceso), direcciones, abono a BRIK
con suspensión gradual (ADM-2/3), novedades para dueños (ADM-6), exportar.
**Se queda todo.** Lo nuevo lo vuelve un tablero de verdad para manejar
muchos gimnasios.

## Inicio del super admin

```
Gym OS · BRIK                                   🔔 3    Mateo
[ ➕ Nuevo gimnasio ]   [ 📣 Novedad a dueños ]   [ 🩺 Estado ]

  12            9            $824.000         2
  gimnasios     activos hoy  cobrado a BRIK   por vencer
                (usaron el   este mes          (abono)
                 panel)

Gimnasios                                        [buscar…] [filtro: todos ▾]
● Olympo        Salta     312 socios   activo hoy   abono al día   [Entrar]
● Box Norte     Tucumán    88 socios   hace 3 días  vence en 5 d   [Entrar]
○ mi-gym        —           0 socios   nunca        sin dueño      [Terminar alta]
```

- **Salud** de cada gimnasio con un color: verde (usa el panel, cobra,
  entra gente), amarillo (sin uso hace 3+ días, onboarding sin terminar),
  rojo (abono vencido, errores, nadie entró en una semana). Ordenar por
  "los que necesitan atención".
- **Ficha del gimnasio**: datos, dueño y equipo (último ingreso de cada uno),
  plan de BRIK y pagos, uso (entradas, cobros y socios por semana), primeros
  pasos (qué le falta configurar), direcciones, secciones prendidas,
  notas internas de BRIK, historial de lo que hizo Soporte BRIK adentro.
- **Alta de gimnasio en 3 pasos**: tipo (plantilla) → datos y marca (logo,
  colores, con vista previa) → dueño (mail y celular; se le crea la cuenta y
  se genera el WhatsApp de bienvenida con link y contraseña). Al final:
  "Entrar a terminar de configurarlo".
- **Entrar como soporte**: ya existe; se suma **motivo obligatorio**
  ("me pidió ayuda con los planes"), vence a los 60 min, un marco de color
  en toda la pantalla con "Estás dentro de Olympo como Soporte BRIK ·
  Salir", y el dueño lo ve en su Control y en su campana ("BRIK entró a
  ayudarte: motivo"). Solo lectura por defecto queda para cuando exista el
  rol de solo lectura (ver ADM-5).
- **Avisos a dueños** (ya existen novedades) con segmento (todos, por plan,
  por ciudad), desde/hasta y si se pueden cerrar.
- **Ayuda**: botón "¿Necesitás ayuda?" en el panel del dueño que manda un
  mensaje a BRIK **con contexto** (gimnasio, usuario, pantalla y el último
  error) y llega acá con número de pendientes.
- **Métricas de BRIK**: ingreso mensual por abonos, gimnasios nuevos y
  bajas, entradas por día en toda la plataforma, errores.
- **Funciones por gimnasio**: prender/apagar módulos (ya están las
  secciones; desde el super admin se ven y se cambian juntas).
- **Plataforma**: estado (base, Storage, último deploy, errores de las
  últimas 24 h si Sentry está), migraciones aplicadas, cuentas de super
  admin.
- **Seguridad**: segundo factor obligatorio para super admin (si Supabase
  MFA está disponible), registro de cada entrada a un gimnasio.
