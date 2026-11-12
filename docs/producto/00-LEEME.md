> Reemplazado por docs/base/00-LEEME.md en qué manda: donde esta especificación choque con docs/base/ (nombre del producto, diseño sin emojis, ingreso sin mails, app del socio), gana docs/base/. Lo que no choca sigue valiendo.

# Gym OS — Especificación del producto

Lo que Gym OS **tiene que ser**: cada panel, cada botón, cómo se conecta todo.
La hoja de ruta (`docs/HOJA-DE-RUTA.md`) dice **en qué orden** se construye;
esta carpeta dice **qué** se construye. Cuando una pantalla se toca, se lee
primero su archivo acá.

| Archivo | Qué define |
|---|---|
| `01-VISION-Y-MVP.md` | Para quién es, qué automatiza, qué tiene que estar sí o sí para vender |
| `02-DISENO.md` | El lenguaje visual, los componentes, las animaciones y cómo se arma cada pantalla |
| `03-ROLES.md` | Quién ve y hace qué (matriz completa) |
| `04-ACCESO.md` | Todas las formas de entrar al gimnasio y cuál conviene a cada tipo |
| `05-ALTA-Y-PAGOS.md` | El socio se registra y paga solo: web, MercadoPago, transferencia, efectivo, débito |
| `06-CAJA-Y-CONTROL.md` | Caja, arqueo y cómo el sistema hace que nadie pueda quedarse con plata |
| `07-AVISOS-Y-AUTOMATIZACIONES.md` | Qué hace el sistema solo y cómo avisa (app, WhatsApp, mail) |
| `08-TIPOS-DE-GIMNASIO.md` | Qué se prende en cada tipo de gimnasio, desde el barrio hasta la cadena |
| `09-PREGUNTAS.md` | Lo que todavía decide Mateo, con la opción que usa el agente mientras tanto |
| `10-DIA-A-DIA-Y-CASOS-RAROS.md` | El día del gimnasio minuto a minuto y todo lo raro que va a pasar: lo que nadie se acuerda de pedir |
| `11-IDEAS.md` | Lo que hace a Gym OS "wow": ahora y después |
| `paneles/` | Un archivo por panel: inicio, menú, cada pantalla y cada botón |

## Cómo se lee un archivo de panel

Cada botón tiene una fila: **qué hace · con qué se conecta · estado**.
Estado: ✅ ya existe y anda · 🔧 existe pero cambia · 🆕 hay que hacerlo ·
🔌 necesita una cuenta externa (Mateo la conecta).
Cuando un ítem de la hoja de ruta se termina, el agente actualiza el estado en
la fila correspondiente.

## Diez principios que no se negocian

1. **Nadie se tiene que mover**: lo que el sistema puede hacer solo, lo hace solo
   (avisos, recordatorios, cobros recurrentes, listas del día).
2. **Un toque para lo de todos los días**: entrar, cobrar, reservar, abrir y
   cerrar caja. Lo raro puede estar a dos toques; lo diario no.
3. **Siempre dice por qué**: cada rojo, cada amarillo, cada error trae el motivo
   y qué hacer.
4. **La plata no se puede esconder**: todo cobro queda en una caja con nombre y
   hora, el socio recibe su comprobante y el dueño lo ve en el momento.
5. **El estado se calcula, nunca se guarda** (regla central de `CLAUDE.md`).
6. **Cada gimnasio lo configura a su manera**: textos, colores, planes, reglas,
   qué se ve y qué no. Nada de un gimnasio está escrito en el código.
7. **Lo apagado desaparece**: un gimnasio sin clases no ve la palabra "clase"
   en ningún lado.
8. **Celular primero** para el dueño, el profe y el socio; compu y tablet para
   la recepción.
9. **Nada roto, nada colgado**: cada botón probado haciendo clic, cada error
   con salida, nunca una pantalla en blanco.
10. **Rápido**: menos de 100 ms entre el toque y el primer cambio en pantalla.
