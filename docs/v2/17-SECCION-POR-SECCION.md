# 17 · Sección por sección: qué tiene que andar, con qué opciones, y "che, me pasó esto"

Para la fase 3 del cierre (`CIERRE.md`). Cada sección se recorre **con sesión
real**, en compu y en celular, como el rol que la usa. Cada línea es algo
que se prueba; lo que no anda se arregla en el momento (o es un ítem nuevo
de la COLA si es grande). Al final de cada sección, los "che, me pasó esto":
mensajes que un dueño o una recepcionista le mandarían a Mateo. Cada uno se
reproduce y se responde con lo que hace el sistema; si el sistema no lo
resuelve, es un ítem.

Reglas para todas: cada botón tiene su opción y su motivo cuando importa;
nada se hace dos veces; Volver deja donde estabas; nada queda sin salida;
la base decide (nunca la pantalla).

---

## 1. Entrada (el corazón)

**Formas de entrar, todas probadas:**
- [ ] DNI en el teclado numérico **desde cualquier pantalla** abre la ventana
  flotante con el número; Enter busca; Enter anota. También con los números
  de arriba del teclado.
- [ ] Botón Entrada: grande en Inicio, flotante en el resto, centro de la
  barra en el celular; F2 / Ctrl+E.
- [ ] Barra fija (opción por compu) con las últimas entradas en vivo.
- [ ] **QR del socio** (cambia cada 30 s) leído con lector USB (escribe +
  Enter), con la cámara de la compu/tablet, y en el kiosco. Un QR viejo (más
  de 60 s) dice "QR vencido, abrí la app de nuevo" — no "no existe".
- [ ] **QR de la pared**: el socio lo escanea con su celular → entra → a la
  recepción le aparece el aviso en vivo en < 6 s.
- [ ] Llavero/tarjeta (si el gimnasio lo usa).
- [ ] Sin internet (SEG-5): con la copia; al volver, sincroniza y avisa
  conflictos.

**Lo que muestra y las opciones:** foto grande, nombre, plan, hasta cuándo,
cuántos días le faltan, lo que hay que decirle, chips (cumple, debe, falta
firmar, prometió pagar, menor, primer día, subió comprobante). Botones:
Anotar (Enter) · Cobrar (C) · Dejar pasar (D, con motivo y modo de fiado
D19) · Ficha (F) · Alta si no existe (A) · Prueba gratis (si el gimnasio la
tiene, D31) · Cerrar (Esc).

**Entrada y salida (D30):**
- [ ] Entrada dentro de la visita (5 h por defecto) = "ya entró a las 15:10",
  no cuenta otra ni gasta clase.
- [ ] Anti-préstamo: otra vía en < 60 min → amarillo con la foto.
- [ ] **Salida opcional**: si el gimnasio la prende, escanear o poner el DNI
  al irse muestra "Chau Juan, estuviste 1 h 20" y cierra la visita; "adentro
  ahora" es exacto. Si no la marca, la visita se cierra sola a las N horas.
  Una salida sin entrada abierta no rompe nada ("no tenía entrada abierta").
- [ ] "Adentro ahora" en Inicio: exacto con salida, aproximado sin salida
  (con la aclaración).

**Che, me pasó esto:**
- "Una chica dice que pagó por transferencia anoche y el sistema la tira en
  rojo." → chip "subió comprobante hace X", aprobar desde la misma ventana o
  dejarla pasar con motivo.
- "Un socio se olvidó el celular." → DNI en el teclado; la foto confirma.
- "Escaneé el QR de uno y me dice vencido pero pagó hoy." → ver que el cobro
  de hoy cubre desde hoy; si no, el veredicto dice por qué.
- "Entraron dos con el mismo QR." → anti-préstamo + alerta al dueño.
- "Se cortó la luz / internet." → modo sin internet.
- "Tipeo el DNI y no pasa nada." → diagnosticar: el foco estaba en un campo;
  el atajo F2 siempre funciona; la ventana dice "tocá acá para escribir".

## 2. Cobrar

- [ ] Se abre desde Entrada, ficha, Vencen, Retención, alta, Ctrl+K, y
  vuelve al origen.
- [ ] Qué debe y qué cubre (de la base), medios en botones, dos medios,
  descuento con motivo de lista y tope, recargo, cupón, convenio, comprobante
  de transferencia, "cobré otro día" (dueño/encargado con motivo), quién
  cobra (PIN), recibo por WhatsApp.
- [ ] **Efectivo sin caja abierta (D32)**: Cobrar ofrece "Abrir mi turno" con
  el fondo en la misma hoja y sigue; transferencia y tarjeta cobran sin caja.
- [ ] **Doble cobro (D29)**: si la misma cuota se cobró hace poco desde otra
  compu, frena: "Sofi ya cobró esta cuota hace 40 s" y solo sigue con
  confirmación y motivo.
- [ ] Doble clic = un cobro (clave de operación).
- [ ] Pago parcial: queda deuda, el período no se cubre (salvo la opción del
  gimnasio).

**Che:** "Le cobré dos veces a uno." → no debería poder; si pasó (dos
personas confirmaron), anular uno con motivo desde Control. · "Me pagó la
mitad." → pago parcial. · "Quiere pagar 3 meses." → elegir períodos. · "El
precio subió y él había pagado adelantado." → respeta lo pagado (VD-46D).

## 3. Caja (D20, D32)

- [ ] **Se abre a mano** cada día/turno con el fondo (sugerido: lo que dejó
  el turno anterior; aviso si no coincide, VD-9E).
- [ ] **Se cierra sola** a la hora de corte (o a las N horas de abierta):
  queda "cerrada sin contar" y el dueño la cuenta después; alerta una sola
  vez (VD-9B).
- [ ] Cerrar a mano: arqueo ciego por medio, SOBRA/FALTA en grande,
  calculadora de billetes opcional, reporte del turno para compartir.
- [ ] Movimientos con tipo (retiro para proveedor, pago a profe, gasto chico,
  ingreso extra) y foto del ticket; cada uno con quién y por qué.
- [ ] Cada cobro en efectivo cae en la caja abierta de quien cobra (con PIN,
  la de esa persona).
- [ ] La caja **cuadra**: esperado = fondo + efectivo cobrado − retiros; se
  prueba con una prueba de base con números fijos.

**Che:** "La caja de anoche quedó abierta." → sin contar, el dueño la
cuenta. · "Me falta plata." → reporte del turno con cada movimiento y quién.
· "Saqué plata para pagarle al de la limpieza." → movimiento con tipo y foto.

## 4. Inicio (dueño y recepción)

- [ ] Botón Entrada grande; 4 números configurables que llevan a su lista;
  Para hacer hoy como bloque principal (VD-13D); en vivo; alertas; ahora y lo
  que sigue; primeros pasos hasta completarse.
- [ ] Recepción: su turno (abrir/cerrar), lo suyo para hacer, en vivo.
- [ ] Celular 390 px sin desbordes; nada en blanco mientras carga.

## 5. Socios y ficha

- [ ] Lista con buscador, filtros, orden, selección múltiple, memoria al volver.
- [ ] Interesados (ex-Prospectos) → "Darlo de alta".
- [ ] Alta completa (datos → plan → cobro → listo) y alta rápida desde la
  Entrada; un error no borra nada; DNI repetido ofrece la ficha.
- [ ] Ficha: encabezado con Cobrar/Entrada/WhatsApp/Editar/Más, línea de
  tiempo única, pausas, baja con constancia, suspender con motivo, familia,
  documentos, foto con la cámara.
- [ ] Importar Excel (con duplicados detectados) y exportar.

**Che:** "Cargué a uno dos veces." → unir duplicados. · "Una clienta quiere
pausar un mes porque se va de viaje." → pausa con fechas; el vencimiento se
corre. · "Se quiere dar de baja." → baja con constancia, sin cobros después.
· "Una mamá quiere anotar a su hija de 15." → menor con responsable.

## 6. Vencen y cobrar · Para hacer hoy · Mensajes · Retención

- [ ] Vencen: pestañas con totales; día fijo con "día 4 de 10"; WhatsApp ya
  escrito (wa.me); prometió pagar.
- [ ] Para hacer hoy: automáticas que desaparecen al resolverse; manuales
  con repetición; checklist de apertura/cierre.
- [ ] Mensajes de socios con puntito rojo, respuesta, foto, respuestas
  rápidas.
- [ ] Retención y números: riesgo, posponer, churn 90 días, mapa de calor,
  exportar.

## 7. Planes, productos, eventos, rutinas, clases

- [ ] Planes: tipos, renovación por plan, día fijo con proporcional,
  servicios adicionales, orden, visibilidad, precios programados con aviso
  previo.
- [ ] **Prueba gratis (D31)**: 1 día o 1 clase, una vez por DNI, configurable;
  desde la Entrada y desde la página (clase de prueba para interesados).
- [ ] Productos y stock con foto, venta rápida, mínimo.
- [ ] Eventos completos; rutinas con video; clases con reservas, espera,
  lugares, TV.
- [ ] **Liquidación de profes (D33)**: regla por profe (por clase, por
  presente o por hora), resumen del mes, el profe ve el suyo, recalcula si
  se corrige la asistencia.

## 8. Configuración · Equipo · Mi cuenta

- [ ] Configuración con buscador, cada opción con su explicación y
  restablecer; todo lo nuevo (Entrada, salida, reingreso, fiado, caja,
  prueba gratis, liquidación).
- [ ] Equipo: alta con foto y acceso por WhatsApp, PIN, dar de baja en un
  botón, permisos por interruptor.
- [ ] Mi cuenta: cambiar contraseña, sesiones, 2FA (dueño y super admin).

## 9. App del socio

- [ ] Ingreso (celular o mail → método), registro (socio sin pagar),
  sesión recordada.
- [ ] 4 pestañas; Inicio con estado, QR grande, días que faltan, pagar.
- [ ] Reservar con motivo claro cuando no puede; lista de espera.
- [ ] Cambiar de plan y pagar; mensajes al gimnasio; rutina con video.
- [ ] QR: se ve grande, con brillo, cambia cada 30 s sin parpadear, y si no
  hay señal lo dice.

**Che:** "No me llega el código." → SMTP/SMS (🔌) y alternativa contraseña.
· "Quiero cambiar a plan libre." → cambio de plan con lo que le queda a
favor.

## 10. Página del gimnasio y super admin

- [ ] Página: prueba gratis arriba, precios, horarios en vivo, reseñas,
  WhatsApp, rápida en celular.
- [ ] Super admin: crear un gimnasio en 3 pasos y que quede listo para usar
  (`18-DOMINIO-Y-NEGOCIOS.md`), salud, soporte con motivo, ayuda.
