#!/usr/bin/env bash
# D4 (PREVENCION.md): no se aplican migraciones ni se publica entre las 16:00 y las 21:59 (hora de Argentina),
# cuando hay gente en la fila de la recepción. Solo pasa con URGENTE=URGENTE (un arreglo de algo roto, dicho a propósito).
# Uso: scripts/base/hora-pico.sh            (usa la hora de ahora; HORA_FALSA=17 para probar)
# Sale con 0 si se puede y con 1 si es hora pico.
set -euo pipefail
hora="${HORA_FALSA:-$(TZ=America/Argentina/Buenos_Aires date +%H)}"
hora=$((10#$hora))
if [ "$hora" -ge 16 ] && [ "$hora" -lt 22 ]; then
  if [ "${URGENTE:-}" = "URGENTE" ]; then
    echo "::warning::Hora pico (${hora} h en Argentina), se sigue porque se marcó urgente. Que sea un arreglo de algo roto."
    exit 0
  fi
  echo "::error::Son las ${hora} h en Argentina: entre las 16 y las 22 h hay gente entrando al gimnasio y no se aplica ni se publica nada. Esperá a las 22 h, o si es un arreglo urgente de algo roto, corré de nuevo con el campo urgente = URGENTE."
  exit 1
fi
echo "Fuera de hora pico (${hora} h en Argentina): se puede."
