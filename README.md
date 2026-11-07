# ORBIX: Overdrive 🏀🚀

Juego web 3D de baloncesto galáctico **3 contra 3**, inspirado en el modo Brawl Ball. Encesta, ataca a los rivales, usa tu súper y aprovecha los poderes en estaciones espaciales.

**Creado por SantiSarm.**

## Cómo se juega
- Elige uno de los **6 personajes** (Nova, Kraag, Zip, Orbit, Lumen y Meteor) y el **tamaño del partido**: 1 vs 1, 2 vs 2 o 3 vs 3. Los bots llenan los lugares que falten.
- Elige un **mapa**: Estación Orbital, Cráter Lunar (gravedad baja), Anillo de Hielo (piso resbaloso), Volcán Zeta (lava) o **al azar**.
- Encesta en el **aro rojo** poniendo la mira dentro del aro: **2 puntos** dentro de la línea dorada y **3** desde fuera.
- **Gana el primero en llegar a 11 puntos** o quien vaya arriba al acabar los **2:30**. Si hay empate: prórroga de 30 s y la primera canasta gana.
- Tras cada canasta, todos vuelven con la vida llena.
- En la cancha aparecen **poderes**: Turbo, Escudo, Balón de fuego (+1 punto), Imán y Recarga de súper.
- La dificultad de los rivales depende de cuántos jugadores reales hay (con 1 son suaves).

## 🌐 Online (cada uno en su pantalla)
1. Menú → **JUGAR** → **ONLINE** → escribe tu nombre.
2. Uno toca **CREAR SALA** y les pasa el código de 4 letras a los demás (también hay un QR).
3. Los demás tocan **UNIRSE** y escriben el código, desde su casa.
4. Cada uno elige su equipo y el anfitrión (👑) elige mapa, bots y tamaño. Cuando estén todos, el anfitrión toca **ELEGIR PERSONAJES**: todos ven los personajes en 3D, eligen el suyo y tocan **¡LISTO!**.
5. Cada uno juega con sus controles y su propia cámara. Hasta 6 personas; los lugares libres pueden ser bots.

> El anfitrión hace de servidor: conviene que sea el que tenga mejor internet.

## 📱 Modo Fiesta (una pantalla + celulares)
1. Abre el juego en el computador o TV y toca **JUGAR** → **MODO FIESTA**.
2. Cada persona escanea el **código QR** con su celular (hasta 6).
3. En el celular: nombre, equipo, personaje y **¡LISTO!**. El primero en entrar (👑) elige el mapa y si hay bots.
4. El celular es el control: stick para moverse, stick naranja para atacar, lanzar o pasar (apunta a un compañero), y botones de Súper e Impulso. Para robar, ataca pegado al que tiene el balón. Muestra tu vida y tu súper, y **vibra** cuando te golpean.

> Necesita internet y funciona desde la página publicada en GitHub Pages: https://santisarm0607.github.io/orbix-overdrive/

## Controles

### Computador
| Tecla | Acción |
|---|---|
| W A S D | Moverse |
| Mouse | Apuntar |
| Clic izquierdo | Atacar (sin balón) / Lanzar (con balón) |
| Clic derecho | Robar (sin balón) / Pasar (con balón) |
| Espacio | Impulso (luego esperas 5 s) |
| R | Súper: mantén para apuntar, suelta para usarla |
| Esc / P | Pausa |
| M | Música sí / no |
| F | Pantalla completa |

### Celular (solo en horizontal)
- **Stick izquierdo:** moverse (aparece donde toques).
- **Stick naranja:** arrastra hacia donde quieras tirar o atacar y suelta. Vuelve al centro para cancelar.
- **Botones:** Impulso, Pase/Robo, Súper (arrastra para apuntar) y Pausa.

## Ejecutar
1. Abre la carpeta en Visual Studio Code.
2. Clic derecho en `index.html` → **Open with Live Server**.
3. Necesita internet (Three.js, PeerJS y las fuentes se cargan desde CDN).
4. Modo Fiesta con Live Server: en el celular cambia `127.0.0.1` por la IP del computador (los dos en el mismo wifi).

## Estructura
```
index.html        pantallas y HUD
control.html      el celular como control (Modo Fiesta)
css/style.css     estilos
css/control.css   estilo del control
js/config.js      todos los números del juego
js/audio.js       música y sonidos (Web Audio)
js/arena.js       mapas, aros y balón
js/personajes.js  los 6 personajes
js/combate.js     ataques, súper, vida y reaparición
js/bots.js        inteligencia de los bots
js/poderes.js     poderes de la cancha
js/red.js         conexión con los celulares (PeerJS)
js/fiesta.js      sala (Modo Fiesta y online) y personajes de cada persona
js/online.js      online: fotos del partido y conexión del que se une
js/control.js     lógica del control en el celular
js/game.js        partido, controles, cámara, menús y logros
NOTAS.md          historial de versiones y decisiones
```

## Tecnologías
HTML, CSS y JavaScript sin frameworks · Three.js r128 (CDN) · PeerJS (WebRTC) · qrcode.js · Web Audio API · localStorage

Versión actual: **v1.4** — más detalles en [NOTAS.md](NOTAS.md).
