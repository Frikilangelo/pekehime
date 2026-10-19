# Sprites de personajes

El juego busca sprites en estas rutas:

- `assets/sprites/player1/`
- `assets/sprites/player2/`

Estados reconocidos (mismo patrón para ambos jugadores):

- `idle`
- `walk`
- `jump`
- `block`
- `punch`
- `kick`
- `special`
- `hurt`

Extensión compatible: `png`.

## Animaciones por archivos separados

Cada estado se arma leyendo archivos con numeración ascendente:

- `<estado>_01.png`
- `<estado>_02.png`
- `<estado>_03.png`
- ...

El cargador toma todos los frames en orden y se detiene en el primer faltante.

Ejemplo para idle con 5 frames:

- `idle_01.png`
- `idle_02.png`
- `idle_03.png`
- `idle_04.png`
- `idle_05.png`

Si falta `idle_06.png`, la animación queda con 5 frames.

Sprite del proyectil especial:

- Debe existir `special_01.png` en cada personaje.
- Ruta ejemplo P1: `assets/sprites/player1/special_01.png`
- Ruta ejemplo P2: `assets/sprites/player2/special_01.png`

Bloqueo:

- `block` bloquea ataques de `punch` y `kick`.

Para usar tus propios sprites, sustituye los archivos de ejemplo manteniendo el mismo nombre base.
