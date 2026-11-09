# Hoy Vemos en televisores

Las apps de televisor no traen la app adentro: abren https://hoyvemos.migueblanco.com/?tv=1. Con `?tv=1` la web
entra en modo televisor (`src/lib/tv.ts`): todo más grande, navegación con las flechas del control, Atrás para
cerrar o volver, y entrar a la cuenta con un código desde el celular (`api/tv-link.ts`). El modo queda recordado en
el aparato; `?tv=0` lo apaga. También se activa solo en los navegadores de Samsung, LG y Android TV.

Para probarlo en el computador: abre la app con `?tv=1` y usa las flechas, Enter y Escape (hace de Atrás).

## Samsung (Tizen) — `tv/tizen`

`index.html` muestra la web dentro de un marco y hace de puente (`src/lib/tvShell.ts`): en la ficha, cada
plataforma de su suscripción tiene un botón «Abrir» que abre esa app del televisor (Netflix, Prime Video, Disney+,
Max, Apple TV+, Paramount+). Abre la app en su inicio: los servicios no dejan saltar a una película concreta
sin un acuerdo con ellos, así que la ficha deja el nombre a la vista para buscarlo. Atrás en la pantalla de
inicio cierra la app. Los identificadores de cada app están en `APPS` dentro de `index.html`.

Instalar en su propio televisor, sin tienda (desde el Mac):

1. Instalar Tizen Studio (o solo su CLI) y, desde el Package Manager, la extensión "Samsung TV Extension" y
   "Samsung Certificate Extension".
2. En el televisor: abrir Apps, marcar 1 2 3 4 5 con el control, activar Developer mode y poner la IP del Mac.
   Reiniciar el televisor.
3. Crear un certificado Samsung (Certificate Manager → Samsung, tipo TV) con la cuenta Samsung y el DUID del televisor.
4. `sdb connect <IP del televisor>`
5. `tizen package -t wgt -s <perfil del certificado> -- tv/tizen`
6. `tizen install -n HoyVemos.wgt -t <nombre del televisor en sdb devices>`

Para publicarla en la tienda de Samsung (Seller Office) se usa el mismo paquete firmado con un certificado de
distribución.
