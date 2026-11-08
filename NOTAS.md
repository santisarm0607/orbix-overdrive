# ORBIX: Overdrive — Notas de desarrollo

Juego web 3D de baloncesto galáctico 3 vs 3, inspirado en el modo Brawl Ball.
Creado por **SantiSarm**.

## Cómo abrirlo
1. Abre la carpeta `orbix-overdrive` en Visual Studio Code.
2. Clic derecho en `index.html` → **Open with Live Server**.
3. Necesita internet (Three.js y las fuentes se cargan desde CDN).

## Estructura
```
orbix-overdrive/
├── index.html      → pantallas, HUD y orden de los scripts
├── control.html    → el celular como control (Modo Fiesta)
├── css/style.css   → estilo neón de menús y HUD
├── css/control.css → estilo del control del celular
├── js/config.js    → TODOS los números del juego (velocidades, tiempos, precisión…)
├── js/audio.js     → efectos y música generados con Web Audio
├── js/arena.js     → escenario de cada mapa (piso, obstáculos, lava, fondo), aros y balón
├── js/personajes.js → nombre, rol, descripción, modelo 3D y animaciones de los 6 personajes
├── js/combate.js   → ataques, súper habilidades, vida, escudos, eliminación y reaparición
├── js/bots.js      → inteligencia de los bots (compañeros y rivales)
├── js/poderes.js   → orbes de poder que aparecen en la cancha
├── js/red.js       → conexión de la pantalla con los celulares (PeerJS)
├── js/fiesta.js    → sala (Modo Fiesta y online), personajes de cada persona y datos al celular
├── js/online.js    → online: fotos del partido del anfitrión y conexión del que se une
├── js/control.js   → lógica del control en el celular
├── js/game.js      → lógica del partido, controles, cámara, HUD, menús y logros
└── NOTAS.md        → este archivo
```

---

## v0.1 — Cancha, movimiento y tiro (27 oct 2026)

### Qué incluye
- Pantalla de título con **Jugar, Controles, Logros y Créditos**.
- Cancha 3D low poly en el espacio: líneas de neón, línea de triple dorada, cajas y barreras simétricas, planeta, luna y asteroides.
- Personaje del equipo azul que se mueve con **WASD** y mira hacia el **mouse**.
- **Impulso** con Espacio (barra de recarga abajo).
- Balón con física: rebota, rueda y choca con cajas, muros, tablero y aro.
- **Recogida automática** y drible automático.
- **Tiro con asistencia**: si apuntas cerca del aro rojo, el tiro va al aro; si no, el balón se lanza hacia donde apuntas.
- **Precisión**: más lejos, peor apuntado o corriendo = más error.
- Línea punteada de trayectoria: dorada = triple, blanca = doble, gris = no va al aro.
- Indicador **ZONA DE 2 / ZONA DE 3**.
- Canastas de **2 y 3 puntos**, celebración con partículas y reinicio desde el centro.
- Reloj de **2:30**, **prórroga de 30 s** si hay empate (la primera canasta gana).
- Pantalla de **pausa** (Esc o P) y pantalla de **resultado** con estadísticas.
- **5 logros** y mejor puntaje guardados en el navegador (localStorage).
- Música y efectos generados con código (tecla M para la música).

### Todavía NO incluía (llegó después)
- Ataques, vida y los 6 personajes llegaron en la v0.2. Rivales, compañeros, pase y robo llegan en la v0.3.

### Números para ajustar (en `js/config.js`)
| Qué | Dónde | Valor |
|---|---|---|
| Duración del partido | `partido.duracion` | 150 |
| Velocidad del jugador | `personajes.<nombre>.velocidad` | 5.8 a 8.6 |
| Distancia del triple | `cancha.radioTriple` | 7 |
| Error por distancia | `tiro.errorPorDistancia` | 0.015 |
| Tamaño del balón | `balon.radio` | 0.4 |
| Tamaño del aro | `tiro.radioAro` | 0.72 |

Desde la v0.1.2 el tiro es manual: si la mira queda bien dentro del aro, entra; si te desvías medio aro, falla.

### Decisiones de diseño tomadas
- No se repiten personajes en el partido; los bots se reparten los que sobran al azar.
- Estilo **low poly** (formas hechas con código).
- **Robo fijo**: si estás cerca y de frente, roba siempre; si falla, esperas 2 segundos.
- Por ahora el balón solo se pierde por **eliminación** o **robo** (sin desarme por súper).
- Tras cada canasta, todos vuelven a su lado con la vida llena y el balón cae en el centro.

---

## v0.1.1 — Controles táctiles (27 oct 2026)

Se adelantaron los controles de celular (estaban planeados para la v0.5).

- **Stick izquierdo**: aparece donde pongas el dedo en la mitad izquierda. Es analógico: si empujas poco, caminas lento.
- **Stick de ataque** (abajo a la derecha, con el balón): arrastra para apuntar y suelta para lanzar. Mientras apuntas ves la mira y la trayectoria.
- **Toque rápido** en el stick de ataque con el balón: tiro directo al aro rival (con la misma precisión que en PC).
- **Botones**: Impulso (se llena mientras recarga), Pase/Robo y Súper (estos dos se activan en versiones siguientes).
- **Botón II** arriba a la izquierda para pausar.
- Si el celular está vertical, aparece "Gira el celular para jugar" y el partido espera.
- El juego detecta solo si usas dedo o mouse y cambia los controles.
- Números de los controles táctiles en `CONFIG.tactil`.

---

## v0.1.2 — Correcciones de SantiSarm (27 oct 2026)

- **Balón más grande** (radio 0.24 → 0.4), más brillante y con un **anillo naranja** que late debajo cuando está libre.
- **Aro y red más grandes** para que el balón quepa.
- **Sin asistencia de tiro**: el balón va exactamente a donde apuntas. Hay que poner la mira dentro del aro.
- La **mira flota a la altura del aro** cuando tienes el balón (con una línea al piso) para que apuntar sea justo.
- La trayectoria solo muestra **la primera mitad del arco**: te dice la dirección, pero el final lo calculas tú.
- En celular, el **toque rápido** ya no apunta solo: hace un lanzamiento corto hacia donde miras.
- Se quitaron del config `conoAsistencia` y `errorPorAngulo`; se agregaron `radioIntentoTiro` y `trayectoriaVisible`.

## v0.1.3 — Cámara más cerca (27 oct 2026)

- La cámara bajó (altura 21 → 14) y se acercó (distancia 14 → 10): todo se ve más grande, estilo Brawl Stars.
- Ahora sigue más al jugador y **se adelanta un poco hacia donde apuntas** (`camara.adelanto`), para ver el aro cuando vas a tirar.
- Si quieres la cámara más lejos o más cerca, cambia `camara.altura` y `camara.distancia` en `config.js`.

## v0.1.4 — Solo horizontal y pantalla completa (27 oct 2026)

- En celular el juego **solo funciona en horizontal**, menús incluidos. En vertical aparece "Gira el celular" y el partido espera.
- **Pantalla completa** con un ícono discreto: en la esquina superior derecha de los menús, junto a la pausa en el partido (celular) y en el aviso de girar. En PC también con la tecla **F**.
- En **Android**, al entrar en pantalla completa el juego intenta **fijar la pantalla en horizontal**.
- En **iPhone**, Safari no permite pantalla completa en páginas web, así que el botón se oculta solo.
- El menú de título se acomoda en dos columnas en pantallas bajitas.

## v0.1.5 — Apuntado táctil preciso (27 oct 2026)

- **Problema:** en celular, la mira no podía quedar a menos de ~6 unidades del personaje, así que **de cerca no se podía encestar**.
- **Solución:** el stick de ataque ahora funciona **como un mouse**. Al tocarlo, la mira aparece 3 unidades delante del personaje y **se desliza con el dedo**. Movimientos pequeños = ajustes finos, así que se puede apuntar bien de cerca y de lejos.
- Ajustes en `CONFIG.tactil`: `sensibilidadApuntado` (0.06; súbelo si la mira se mueve muy lento) y `distanciaInicialMira` (3).

## v0.1.6 — Stick de tiro estilo Brawl Stars (27 oct 2026)

- **Problemas:** con el sistema de deslizar, para tiros largos no alcanzaba el dedo, y no había forma de cancelar un tiro.
- **Nuevo stick de ataque:** la **dirección** del dedo es la dirección del tiro y **qué tan lejos lo llevas** es qué tan lejos lanzas. El dedo puede salirse un poco del círculo.
- El **alcance máximo** se ajusta a la distancia del aro rival (+5 unidades). La dirección sigue siendo 100 % manual; no hay autoapuntado.
- **Cancelar:** si vuelves el dedo al **centro** (círculo punteado) y sueltas, el tiro se cancela. El stick se pone rojo y dice "Suelta aquí para cancelar".
- Ajustes en `CONFIG.tactil`: `radioApuntado` (85 px), `zonaCancelar` (0.22), `margenAlcance` (5), `alcanceMinimo` (9).

## v0.2 — Personajes y combate (27 oct 2026)

### Pantalla de elegir personaje
- Título → **Jugar** → **Elige tu personaje** → partido.
- Lista de los 6, **vista previa 3D girando**, rol, descripción y barras de Vida, Velocidad, Daño y Alcance.
- El juego recuerda el último personaje que usaste. Al terminar puedes **cambiar de personaje**.

### Los 6 personajes (números en `CONFIG.personajes`)
| Personaje | Rol | Vida | Velocidad | Ataque |
|---|---|---|---|---|
| Nova | Tiradora | 2800 | 7 | Proyectil largo (750, alcance 10) |
| Kraag | Tanque | 5200 | 5.8 | Golpe en abanico (1200, alcance 2.6) |
| Zip | Explorador | 2200 | 8.6 | Ráfaga de 2 disparos (330 c/u, alcance 5.5) |
| Orbit | Control de zona | 3000 | 6.6 | Bomba en arco por encima de las cajas (950 en área) |
| Lumen | Apoyo | 3000 | 7 | Pulso (480) que cura 400 a compañeros |
| Meteor | Especialista en área | 3300 | 6.8 | Rayo que atraviesa enemigos (820) |

### Combate
- **Atacar:** clic izquierdo sin balón (PC). En celular, el stick naranja sin balón: arrastra para apuntar y suelta; un **toque rápido** ataca al rival más cercano.
- **Indicador de alcance** en el piso: tira (disparos), abanico (Kraag) o círculo (bomba de Orbit). Se pone gris si el ataque está recargando.
- **Vida** con barra sobre la cabeza y **números de daño** flotantes.
- **Eliminación:** el personaje suelta el balón. **Reaparece a los 3 s** en su lado con **1 s de protección** (burbuja). Atacar quita la protección.
- **Regeneración:** tras 3 s sin pelear, recuperas vida poco a poco.
- Las bombas muestran un **círculo de aviso** antes de explotar.
- Los proyectiles chocan con cajas y barreras.

### Drones de práctica (se quitaron en la v0.3)
- 3 drones rojos que pasean por su mitad, te disparan si estás cerca y se pueden eliminar. Reaparecen a los 4 s.
- Sirven para probar los ataques. En la v0.3 se reemplazan por bots de verdad. Números en `CONFIG.drones`.

### Otros cambios
- **Impulso por tiempo:** después de usarlo esperas **5 segundos**. En celular el botón muestra la cuenta regresiva; en PC aparece "Impulso en X s".
- Nuevo logro: **Primer derribo**. Nueva estadística al final: **Eliminaciones**.

## v0.3 — Bots, pase, robo y límite de puntos (27 oct 2026)

### Bots con los personajes
- Los **drones de práctica desaparecen**. Ahora los **5 personajes que no elegiste** juegan como bots: **2 compañeros (azul)** y **3 rivales (rojo)**, repartidos al azar y sin repetir. Cambian en cada partido.
- Qué hacen los bots (dificultad Normal):
  - **Balón libre:** el más cercano de cada equipo va por él; los demás se acomodan.
  - **Con el balón:** avanzan al aro esquivando rivales, tiran de 2 desde cerca y a veces se arriesgan con un triple si están solos. Si los presionan, **pasan** al compañero más libre.
  - **Su equipo tiene el balón:** se abren por su carril para recibir.
  - **El rival tiene el balón:** el más cercano lo persigue, lo **ataca** y le intenta **robar**; los demás cubren su aro.
  - **Atacan** al rival más cercano con su propio ataque, adelantándose un poco a su movimiento. Lumen cura a compañeros heridos.
  - Rodean cajas y barreras.
- Números en `CONFIG.bots`: reacción, velocidad, error de tiro, distancia de tiro, probabilidad de triple.

### Pase y robo
- **Pase:** clic derecho con el balón (o botón PASE en celular). Va al compañero que esté más cerca de hacia donde apuntas. El balón viaja bajito y **se puede interceptar**.
- **Robo fijo:** clic derecho sin balón (o botón ROBO). Si estás a menos de 1.9 del que tiene el balón y lo miras, **se lo quitas siempre**. Si fallas, esperas **2 s**. Quien recibe el balón tiene 0.7 s en que no se lo pueden robar.
- **Presión defensiva:** tirar con un rival encima tiene más error (para ti y para los bots).

### Reglas
- **Límite de puntos: el primero en llegar a 11 gana** al instante. Si nadie llega, gana quien vaya arriba al acabar el tiempo. Se cambia en `partido.puntosParaGanar`.
- Tras cada canasta, **los 6 vuelven a su lugar** y el balón cae en el centro.
- El logro "Lluvia de meteoritos" ahora pide **9 puntos tuyos en un partido** (antes 20, imposible con el límite de 11).

## v0.3.1 — Dificultad según jugadores reales (27 oct 2026)

- Idea de SantiSarm: **la dificultad depende de cuántos jugadores reales hay**.
- Con **1 jugador real** (como ahora), los **rivales bots son suaves**: reaccionan más lento, corren un poco menos, fallan más tiros, apuntan peor sus ataques, hacen 65 % del daño, no siempre persiguen y casi no intentan robar.
- Tus **compañeros bots** juegan bien para ayudarte, pero sin quitarte el protagonismo.
- Cuando llegue el **online**, al haber más personas la dificultad sube sola (niveles 1 a 5 en `CONFIG.bots.rivales`).
- Al empezar el partido aparece el nivel: "1 jugador real · rivales nivel suave".
- Para probar otro nivel ahora mismo, cambia `CONFIG.bots.jugadoresReales` (1 a 5).

## v0.4 — Súper habilidades (27 oct 2026)

### Las 6 súper (números en `CONFIG.personajes.<nombre>.super`)
| Personaje | Súper | Qué hace |
|---|---|---|
| Nova | Ráfaga estelar | 5 proyectiles en abanico (400 c/u) |
| Kraag | Salto sísmico | Salta hasta 7 unidades; al caer hace 1400 en área y **empuja** a los rivales |
| Zip | Hipervelocidad | 3.5 s corriendo ×1.7 y atacando casi el doble de rápido |
| Orbit | Supernova | Bomba gigante: 1600 en un radio enorme |
| Lumen | Aura protectora | Escudo de 1200 por 4 s y cura 500 a él y a sus compañeros cercanos |
| Meteor | Lluvia de meteoritos | 6 meteoritos (340 c/u) caen en la zona marcada |

Ninguna súper elimina sola a alguien con la vida llena (regla del documento de diseño).

### Cómo se carga
- Haciendo daño (4500 = súper llena), curando (2600), encestando (+30 %) y robando (+15 %).
- El daño de una súper **no** carga la súper.
- Una vez llena, se guarda hasta que la uses.

### Cómo se usa
- **PC:** mantén **Q** para ver el indicador dorado de a dónde va y suéltala para lanzarla.
- **Celular:** el botón **SÚPER** se llena en dorado. Arrástralo para apuntar y suéltalo; un toque rápido la lanza al rival más cercano.
- Cuando está lista: anillo dorado bajo tu personaje, botón que late y aviso en el HUD.

### Detalles
- Los bots también usan su súper en el momento adecuado (Lumen cuando hay compañeros heridos, Zip para escapar con el balón o alcanzarlo, Meteor y Orbit donde hay varios rivales juntos).
- Efectos: ondas expansivas, sacudida de cámara, meteoritos que caen con estela, escudo dorado.
- La pantalla de elegir personaje muestra la súper de cada uno.
- Nuevo logro: **Poder estelar** (usa tu súper).

## v0.4.1 — Vida llena tras cada canasta (27 oct 2026)

- Idea de SantiSarm: después de **cada canasta**, los 6 personajes vuelven a su lugar **con la vida llena**, y los que estaban eliminados **reviven al instante**.
- Se limpian los proyectiles, bombas, meteoritos, escudos y turbos que quedaban en la cancha.
- La **carga de la súper se conserva** (como dice el documento de diseño).
- Al **reaparecer** tras una eliminación también vuelves con la vida llena (eso ya funcionaba así).

## v0.5 — Poderes en la cancha (27 oct 2026)

### Cómo aparecen
- A los **8 s** de empezar y luego cada **14 s** aparece un **par de orbes iguales**: uno en cada mitad, en el mismo lugar reflejado, para que sea justo.
- Como mucho hay **2 pares** a la vez. Tienen un haz de luz para verlos de lejos.
- Se recogen **pasando por encima**. Los bots también van por ellos si están cerca y no tienen algo más urgente.

### Los 5 poderes (números en `CONFIG.poderes`)
| Poder | Color | Efecto |
|---|---|---|
| Turbo | Verde | Corres ×1.4 durante 6 s |
| Escudo | Cian | Absorbe 1000 de daño durante 6 s |
| Balón de fuego | Naranja | Tu próxima canasta vale **+1** (dura 20 s). El balón suelta llamas |
| Imán | Morado | Recoges el balón desde 2.6 de distancia durante 8 s |
| Recarga | Dorado | +50 % de súper al instante |

### Otros detalles
- Si te eliminan, **pierdes** los poderes activos.
- Tus poderes activos se ven con su tiempo en la **esquina superior izquierda**.
- Nuevos logros: **Energizado** (recoge un poder) y **Canasta en llamas** (anota con el Balón de fuego).
- Nueva estadística al final: **Poderes** recogidos.

## v0.6 — Mapas (27 oct 2026)

### Nuevo orden de pantallas
Título → Jugar → **Elige tu personaje** → **Elige el mapa** → Partido.

### Los 4 mapas (todos simétricos, en `CONFIG.mapas`)
| Mapa | Regla especial | Obstáculos |
|---|---|---|
| 🛰️ Estación Orbital | Ninguna: la cancha clásica | Cajas y barreras |
| 🌑 Cráter Lunar | **Gravedad baja** (18 → 10): el balón flota y los tiros caen más lento | Rocas |
| ❄️ Anillo de Hielo | **Piso resbaloso**: aceleración al 20 %, cuesta frenar y girar (también a los bots) | Cristales de hielo |
| 🌋 Volcán Zeta | **Pozos de lava** que hacen 600 de daño por segundo, incluso bajo los aros | Basalto con vetas de lava |

- **🎲 Al azar:** elige un mapa sorpresa en cada partido (también al darle "Jugar otra vez").
- Cada mapa tiene sus colores, decoración del piso (cráteres, escarcha o grietas), planeta de fondo y luz.
- Cada tarjeta muestra un **mini plano** con obstáculos, lava y aros.
- Los bots **esquivan la lava** y también resbalan en el hielo.
- El juego recuerda el último mapa elegido.
- Nuevo logro: **Turista galáctico** (juega en los 4 mapas).

### Cómo crear un mapa nuevo
1. Copia uno de los mapas en `CONFIG.mapas` y cámbiale el nombre (por ejemplo `desierto`).
2. Agrégalo a `CONFIG.mapas.orden`.
3. Cambia colores, `gravedad`, `aceleracion`, `obstaculos` y `lava`. Mantén la simetría (si pones algo en `x: -5`, pon lo mismo en `x: 5`).

## v0.6.1 — Súper con la tecla R (27 oct 2026)

- La súper en PC pasa de **Q** a **R** (mantén para apuntar, suelta para usarla).
- La tecla se puede cambiar en `CONFIG.teclas.super` (por ejemplo `'KeyE'` para la E).

## v0.7 — Pulido final para la entrega (27 oct 2026)

### Nuevo
- **Cuenta regresiva 3, 2, 1, ¡YA!** al empezar cada partido (nadie se mueve hasta el ¡YA!). Duración en `partido.cuentaRegresiva`.
- **"Tic"** en los últimos 5 segundos del reloj.
- **Pantalla de Ajustes** (desde el título o la pausa):
  - Volumen de la música y de los efectos.
  - **Calidad gráfica Alta o Baja** (Baja = sin sombras y menos resolución). En celular empieza en Baja.
  - Todo se guarda en el navegador.
- **6 logros nuevos** (ahora son 16) y un contador "X de 16 conseguidos":
  - Leyenda de la arena (gana 3 partidos), Muralla galáctica (gana sin que el rival anote), Remontada épica (gana tras ir perdiendo por 4 o más), Manos rápidas (3 robos en un partido), Pase perfecto (asistencia) y Golpe final (elimina con tu súper).
- **Estadísticas nuevas** al final: robos y asistencias. También muestra tu personaje, el mapa y tus victorias totales.
- **Ícono** del juego en la pestaña del navegador.

### Limpieza
- Se quitó código que ya no se usaba (el modelo de personaje viejo de la v0.1).
- La pantalla de logros se muestra en dos columnas.

## v0.7.1 — Correcciones de SantiSarm (28 oct 2026)

- **No salía el personaje en "Elige tu personaje"** al entrar desde el final de un partido ("Cambiar personaje o mapa"). La vista previa 3D solo se dibujaba en el menú principal. Ahora se dibuja siempre que esa pantalla está abierta, y al abrirla el juego vuelve al modo menú.
- **El jugador aparecía en el centro de la cancha** durante la cuenta regresiva y luego saltaba a su lugar. El modelo 3D no se movía a su punto de salida hasta el ¡YA!. Ahora aparece directo en su lado de la cancha.

## v0.8 — Animaciones de ataque (31 oct 2026)

Idea de SantiSarm: los personajes no hacían ningún movimiento al atacar ("el mono no sé qué hace").

### Animación de cada personaje
| Personaje | Ataque | Súper |
|---|---|---|
| Nova | El cañón retrocede y sale un fogonazo | 5 retrocesos seguidos (uno por disparo) |
| Kraag | Levanta los dos puños y los estrella hacia adelante, inclinándose | Puños arriba durante el salto y golpe al caer |
| Zip | Dispara con una mini pistola y luego con la otra (nuevas en sus manos) | Da una vuelta completa antes de salir corriendo |
| Orbit | El lanzador se inclina, retrocede y suelta humo; el robot se aplasta | Igual pero más fuerte |
| Lumen | El núcleo late y la capa de luz se expande | Pulso enorme y una vuelta completa |
| Meteor | Se echa hacia atrás y lanza el rayo inclinándose; las llamas crecen | Se eleva y sus llamas se agrandan |

- **Al lanzar o pasar el balón**, todos dan un saltito (Kraag además levanta los brazos).
- Los **bots** también se animan.
- El **golpe de Kraag** ahora se ve más: abanico más brillante y polvo en el borde.
- En **Elige tu personaje**, el personaje muestra su ataque cada 2 segundos y su súper cada tercera vez, para que sepas qué hace antes de elegirlo.

### Cómo funciona (para el código)
- Cada modelo tiene un grupo `accion` (lo mueve el ataque) dentro del cual está `cuerpo` (lo mueve la animación de caminar), así no se pisan.
- `Personajes.animar(malla, 'ataque' | 'super' | 'tiro')` empieza una animación y `Personajes.actualizarAnim(malla, dt)` la avanza.
- Cada personaje define su `pose(tipo, f, accion)` en `personajes.js`. Las duraciones están en `DURACION` y `DURACION_PJ`.

---

## v0.9 — Modo Fiesta: una pantalla y los celulares como control (3 nov 2026)

### Cómo se juega
1. En el computador (o TV) toca **📱 MODO FIESTA**. Aparece un **código QR** y un **código de 4 letras**.
2. Cada persona escanea el QR con la cámara del celular (o abre `control.html` y escribe el código).
3. En el celular: escribe tu nombre, elige **equipo** (máximo 3 por equipo) y **personaje** (no se repiten), y toca **¡LISTO!**.
4. Cuando todos están listos empieza una cuenta de 5 segundos. La pantalla también tiene **EMPEZAR YA**.
5. El computador solo muestra el partido: nadie juega con el teclado.

### Decisiones (de SantiSarm)
- **Solo pantalla:** el computador no juega, hasta 6 celulares.
- **Cada uno elige** equipo y personaje en su celular.
- **Bots sí o no:** con bots, los lugares libres se llenan con bots; sin bots, juegan solo las personas (cada equipo necesita al menos una).
- **El celular muestra** botones, vida, súper, marcador y tiempo, y **vibra** al recibir daño.

### Detalles
- El primero que entra es el **líder 👑**: elige el mapa y los bots desde su celular (también se puede desde la pantalla).
- Con bots, el nivel de **todos** los bots depende de cuántas personas juegan (`CONFIG.bots.rivales[personas]`).
- Cada persona tiene un **anillo de color** bajo los pies y su nombre (P1, P2…) sobre la cabeza.
- Mientras apuntas con el celular, en la pantalla se ve la línea y la mira de tu tiro, ataque o súper.
- Al terminar: tabla con puntos y eliminaciones de cada persona (⭐ al mejor) y vuelve sola a la sala en 10 s.
- Si a alguien se le cae la conexión en pleno partido, su personaje se queda quieto y puede **volver a entrar** con el mismo celular.
- El celular manda un "latido" cada 2 s: si deja de responder 7 s, sale de la sala.

### Cómo funciona (para el código)
- Usa **PeerJS** (WebRTC): la pantalla abre una sala `orbix-overdrive-sala-CÓDIGO` y cada celular se conecta directo a ella. El servidor gratuito de PeerJS solo presenta a los dos, los datos van de celular a pantalla.
- El celular manda el stick 20 veces por segundo (`in`) y las acciones (`accion`). La pantalla le manda su `estado` 8 veces por segundo.
- Números en `CONFIG.red` y `CONFIG.fiesta` (cámara, cuenta regresiva, espera para volver a la sala).
- **Importante:** funciona desde **GitHub Pages** (o Live Server con la IP del computador). **No funciona dentro del artefacto** de Claude, porque ahí están bloqueadas las conexiones.
- Probado con un servidor PeerJS local, una pantalla y dos celulares simulados: sala, QR, personajes bloqueados, líder, cuenta regresiva, movimiento, ataques, resultado, vuelta a la sala y salida de un celular.

---

## v0.9.1 — Control más simple y mejor puntería en la TV (3 nov 2026)
Correcciones de SantiSarm después de probar con una amiga:
- **Se quitó el botón PASE/ROBO** del celular (cambiaba de nombre y sobraba). Ahora todo va en el stick naranja:
  - **Pase:** con el balón, apunta a un compañero y suelta (el arco se pone **verde**). Un toque rápido también le pasa al compañero que tengas al frente.
  - **Robo:** sin balón, ataca pegado al rival que tiene el balón y se lo quitas.
- **La puntería en la pantalla se ve como en el modo de un jugador:**
  - Con balón: un arco de **bolitas** que avanzan hacia donde va el tiro, mira a la altura del aro y sombra en el piso. Colores: blanco = 2 puntos, dorado = triple, gris = no va al aro, verde = pase.
  - Sin balón: la forma real del ataque de tu personaje (cono de Kraag, línea de Nova, área de Meteor…) en tu color.
  - Súper: la zona en dorado.
- El celular quedó con 3 cosas a la derecha: stick naranja, Súper e Impulso.

---

## v0.9.2 — Errores encontrados con pruebas automáticas (3 nov 2026)
Se jugaron muchos partidos automáticos con el reloj acelerado: 10 partidos de un jugador (los 6 personajes, los 4 mapas, de 1 a 5 jugadores reales) y 3 de Modo Fiesta con hasta 6 celulares simulados que se mueven, disparan y usan la súper al azar. En cada cuadro se revisó: errores de JavaScript, posiciones raras (NaN), personajes fuera de la cancha o dentro de obstáculos, vida y súper fuera de rango, balón atascado y partidos que no terminan.

Errores corregidos:
- **Aparición dentro de las barreras (Estación Orbital):** los dos lugares de los lados de cada equipo (±9.5, ±4) estaban DENTRO de las barreras; ahora son (±10.4, ±4), detrás de ellas.
- **Personajes metidos en las cajas:** si el centro de un personaje quedaba dentro de una caja (por un impulso rápido o empujado por otro), solo se movía un poco y podía quedarse adentro. Ahora sale por el lado más cercano. También se revisan los obstáculos después de separarse de otro personaje.
- **Kraag saltaba fuera de la cancha** con su súper: el punto de caída ahora siempre queda dentro.
- **El jugador siempre se llamaba "Nova"** en los avisos (por ejemplo, "¡Nova usó…!") aunque eligieras otro personaje.

Lo que se probó y funciona: pausa, abandonar, jugar otra vez, cambiar de personaje y mapa; en el Modo Fiesta: 7º celular rechazado (sala llena), celular que se cae y vuelve a entrar con su personaje, celulares que se van, mensajes dañados, pausa y abandonar (vuelve a la sala), salir del Modo Fiesta.

---

## v1.0 — ONLINE: cada uno en su pantalla (3 nov 2026)

### Cómo se juega
1. Menú → **🌐 ONLINE** → escribe tu nombre.
2. **Crear sala:** eres el anfitrión. Sale un código de 4 letras (y un QR). Tú también juegas.
3. **Unirse:** los demás escriben el código (o abren el enlace `…/index.html#sala=CÓDIGO`, que ya trae el código puesto).
4. En la sala cada uno elige **equipo** y **personaje** en su pantalla y toca **¡LISTO!**. El anfitrión (👑) elige el mapa y si hay bots. Cuando todos están listos, empieza solo; el anfitrión también puede tocar EMPEZAR YA.
5. Cada uno juega con sus controles de siempre (teclado y mouse o táctil) y su cámara sigue a su personaje.
6. Al terminar se ve la tabla de todos y vuelven a la sala para jugar otra.

### Cómo funciona (para el código)
- **El anfitrión manda.** Su juego simula todo (movimiento, golpes, vida, balón, bots, poderes). Es la misma sala del Modo Fiesta (`fiesta.js`), pero el anfitrión también juega con su personaje normal.
- **20 fotos por segundo.** El anfitrión manda una "foto" (`online.js`) con la posición, giro, vida, súper y poderes de cada personaje, el balón, el marcador y los orbes, junto con los **eventos** (ataques, súper, tiros, pases, robos, canastas).
- **El que se une** manda sus controles (como el celular del Modo Fiesta) y dibuja el partido:
  - A los demás los dibuja **100 ms en el pasado**, mezclando dos fotos, para que se vean suaves.
  - A **su propio personaje** lo mueve **al instante** (predicción) y lo va corrigiendo si se separa de donde dice el anfitrión.
  - Los ataques y súper se repiten en su pantalla solo como efecto (**modo espejo** de `combate.js`); el daño lo decide el anfitrión.
  - La lluvia de meteoritos usa una **semilla** para caer igual en todas las pantallas.
- Si alguien se desconecta, su personaje se queda quieto y puede volver a entrar con el mismo equipo. Si el anfitrión cierra, a los demás les sale "El anfitrión cerró la sala".
- Si entras con un partido en curso, lo ves como espectador y juegas en el siguiente.

### Pruebas
Con un servidor PeerJS local, un anfitrión y dos jugadores en navegadores distintos: sala, bloqueo de personajes, líder, partido completo con jugadores al azar (marcador y tiempo iguales en las 3 pantallas, la posición predicha a menos de 0,4 m de la real), resultado, vuelta a la sala, salir y cerrar la sala.

### A tener en cuenta
- Se conecta directo entre los equipos (WebRTC). En algunas redes de datos móviles o de colegios puede que no conecte; con wifi de casa normalmente sí.
- El que tenga mejor internet debería ser el anfitrión.

---

## v1.1 — Menú más simple (6 nov 2026)
Idea de SantiSarm: que el menú principal no tenga tantas opciones.
- **Menú principal:** JUGAR, Controles, Logros, Créditos y Ajustes. Sin la barra blanca para bajar (v1.0.1).
- **El orden ahora es:** JUGAR → **¿Cómo quieres jugar?** (Solo, Online o Modo Fiesta) → personaje → mapa → partido.
  - **Solo:** eliges personaje y luego mapa.
  - **Online y Modo Fiesta:** cada uno elige su personaje en la sala, y el anfitrión (o la pantalla) elige el mapa.
- Los botones VOLVER y SALIR regresan a "¿Cómo quieres jugar?".

---

## v1.2 — Control del celular en iPhone (6 nov 2026)
SantiSarm probó el Modo Fiesta: en Android el control funcionaba bien, en iPhone no. Safari del iPhone tiene varias diferencias:
- **Zoom con los dos pulgares:** Safari ignora "sin zoom" y toma los dos pulgares (uno en cada stick) como un pellizco. Ahora se bloquean los gestos de zoom y el toque por defecto durante el partido; los sticks usan "pointer" y siguen funcionando.
- **Lupa, menú y selección de texto** al mantener el dedo quieto: bloqueados (`-webkit-touch-callout`, `user-select`).
- **"Capturar el dedo" (setPointerCapture) puede fallar** y dejaba el stick sin responder: ahora se intenta con cuidado y, si falla, el dedo se sigue en toda la pantalla.
- **No hay vibración** en páginas web del iPhone: ahora hay un **destello rojo** en los bordes al recibir daño (en todos los celulares) y, en iOS 18 o más, un "toque" de vibración con un interruptor escondido.
- **No hay pantalla completa:** el botón se esconde en iPhone y la pantalla de conectar explica cómo hacerlo con *Compartir → Agregar a inicio*.
- **La muesca** del iPhone en horizontal ya no tapa el stick izquierdo.
- **Al bloquear la pantalla o cambiar de app** el iPhone corta la conexión: ahora el control vuelve a entrar solo al regresar.
- Lo mismo (zoom, lupa, captura) se arregló en los controles táctiles del juego principal (Solo y Online).

---

## v1.2.1 — El stick ya no se sale de la pantalla (6 nov 2026)
- El stick de moverse sigue apareciendo donde pones el dedo, pero si tocas cerca de un borde se corre hacia adentro para que siempre se vea completo.
- Se arregló que el stick se dibujaba más abajo del dedo (se medía desde la pantalla y no desde su zona). Pasaba en el control del celular y en los controles táctiles del juego.

---

## v1.3 — Elegir el tamaño del partido (6 nov 2026)
Idea de SantiSarm: poder escoger con cuántos bots jugar. Se eligió por **tamaño del partido**:
- **1 vs 1, 2 vs 2 o 3 vs 3.** Los bots llenan los lugares que falten.
- **Solo:** se elige en la pantalla del mapa (debajo de los mapas). Se recuerda para la próxima vez.
- **Online y Modo Fiesta:** en la sala, junto a Mapa y Bots, aparece "Equipos". Lo cambia el anfitrión, la pantalla o el líder 👑 desde su celular. Cada equipo admite solo esa cantidad de personas; si alguien baja el tamaño y sobran personas en un equipo, la sala avisa que alguien debe cambiarse.
- Probado: partidos completos 1 vs 1 (2 personajes), 2 vs 2 (4) y 3 vs 3 (6), y una sala del Modo Fiesta en 2 vs 2.

---

## v1.3.1 — Que el celular no mezcle archivos viejos y nuevos (6 nov 2026)
- En el celular el 1 vs 1 no funcionaba aunque el código estaba bien: GitHub Pages deja que el navegador guarde los archivos hasta 10 minutos, y el celular cargó el `index.html` nuevo (con los botones) con el `game.js` viejo (que no los conocía).
- Ahora `index.html` y `control.html` piden cada archivo con la versión (`js/game.js?v=1.3.1`). Al subir una versión nueva se cambia ese número y el celular descarga todo junto.

---

## v1.3.2 — Botones de la sala ordenados (6 nov 2026)
- En la sala (Online y Modo Fiesta) los botones "2 vs 2" y "3 vs 3" se partían en dos líneas. Ahora van en una sola línea y del mismo tamaño.

---

## v1.3.3 — QR también para los que se unen (7 nov 2026)
- En la sala online, el que se une ahora también ve el código QR (antes solo el anfitrión). Así cualquiera en la sala puede invitar a más amigos: el QR abre el juego con el código ya puesto.
- El botón EMPEZAR YA sigue siendo solo del anfitrión.

---

## v1.4 — Online por etapas: primero conectarse, luego personajes con vista 3D (7 nov 2026)
Idea de SantiSarm: que primero se conecten todos y después se elijan los personajes, para poder verlos antes.
1. **Sala (conectarse):** QR, código, equipos, mapa, bots y tamaño. Aquí solo se elige el equipo. El anfitrión toca **ELEGIR PERSONAJES →** cuando estén todos.
2. **Personajes:** todos pasan a la pantalla de personajes con la **vista 3D** (la misma del modo Solo). Tocar un personaje lo muestra y, si está libre, lo elige. Los que ya tiene otro se ven apagados con su nombre (se pueden ver, no elegir). Abajo se ve qué eligió cada uno y quién está listo.
   - Cuando todos tocan **¡LISTO!**, empieza en 5 s. El anfitrión también tiene **EMPEZAR YA** y **VOLVER A LA SALA** (por si falta alguien o hay que cambiar equipos).
3. Al terminar el partido vuelven a la sala (etapa de conectarse).
- El **Modo Fiesta** sigue igual (todo en una sala), porque el celular no muestra 3D.

---

## v1.5 — Seis mejoras (8 nov 2026)
1. **Tutorial:** la primera vez que juegas Solo salen 5 pasos (moverse, recoger, lanzar, golpear, súper). Se puede saltar y repetir desde *Controles → VER TUTORIAL*.
2. **Game feel (solo):** cámara lenta en la canasta que gana el partido y en las tuyas, el juego se congela un instante cuando golpeas (más si eliminas) y golpes con mejor sonido.
3. **Ranking de la sala (Rival League):** después de cada partido la sala muestra victorias, puntos y partidos de cada uno. Además tus estadísticas online se guardan en tu dispositivo (se ven en *Logros*).
4. **Emotes:** 👍 😂 😡 🔥 con las teclas 1 a 4 (o el botón 😀 en el celular). Se ven sobre tu personaje en todas las pantallas.
5. **Mapa nuevo: Cinturón de Asteroides ☄️.** Caen meteoritos: primero sale un círculo rojo y a los 1,6 s cae y hace daño a todos los que estén dentro. En el online los manda el anfitrión, así caen igual para todos.
6. **Skins:** Neón (gana un partido), Dorada (gana 3 partidos) y Galaxia (juega en todos los mapas). Se eligen debajo del personaje y en el online los demás la ven.
- Se arregló una línea repetida en *Controles*.

---

## Plan de versiones
- [x] **v0.1** — Cancha, movimiento, balón, tiro de 2 y 3, marcador y tiempo.
- [x] **v0.1.1** — Controles táctiles (adelantados).
- [x] **v0.1.2** — Balón más grande y tiro manual sin asistencia.
- [x] **v0.1.3** — Cámara más cerca.
- [x] **v0.1.4** — Solo horizontal en celular y pantalla completa.
- [x] **v0.1.5** — Apuntado táctil preciso (también de cerca).
- [x] **v0.1.6** — Stick de tiro estilo Brawl Stars con cancelar.
- [x] **v0.2** — Selección de personaje y los 6 personajes con ataque, vida, eliminación y reaparición.
- [x] **v0.3** — Bots aliados y rivales (Normal), pase, robo y límite de 11 puntos.
- [x] **v0.3.1** — Dificultad automática según jugadores reales (reemplaza la pantalla de dificultad).
- [x] **v0.4** — Súper habilidades, carga de súper y pulido de combate.
- [x] **v0.4.1** — Vida llena para todos después de cada canasta.
- [x] **v0.5** — **Poderes** que aparecen en la cancha (Turbo, Escudo, Balón de fuego, Imán, Recarga de súper).
- [x] **v0.6** — **Nuevos mapas** y pantalla para elegir mapa (Cráter Lunar, Anillo de Hielo, Volcán Zeta) con opción Al azar.
- [x] **v0.7** — Más logros, ajustes, cuenta regresiva y pulido final para la entrega.
- [x] **v0.7.1** — Correcciones: vista previa del personaje y lugar de salida.
- [x] **v0.8** — Animaciones de ataque, súper y lanzamiento para los 6 personajes.
- [x] **v0.9** — **Modo Fiesta**: una pantalla y hasta 6 celulares como control (QR, equipos, bots opcionales, vibración).
- [x] **v0.9.1** — Sin botón Pase/Robo en el celular, puntería visible en la TV.
- [x] **v0.9.2** — Correcciones de las pruebas automáticas (apariciones, colisiones, salto de Kraag, nombre del jugador).
- [x] **v1.0** — **Online**: cada uno en su pantalla, con sala, código y anfitrión.
- [x] **v1.1** — Menú más simple: JUGAR → modo → personaje → mapa.
- [x] **v1.2** — Control del celular funcionando en iPhone.
- [x] **v1.3** — Tamaño del partido: 1 vs 1, 2 vs 2 o 3 vs 3.
- [x] **v1.4** — Online por etapas: conectarse y luego elegir personajes con vista 3D.
- [x] **v1.5** — Tutorial, cámara lenta, ranking de la sala, emotes, mapa de meteoritos y skins.
- [ ] **Futuro** — Ranking mundial (necesita un servidor) (ranking), servidor TURN para redes difíciles.
