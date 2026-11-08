/* ==========================================================
   ORBIX: OVERDRIVE — config.js
   Aquí están TODOS los números del juego.
   Si quieres cambiar velocidades, tiempos o dificultad,
   cámbialos aquí sin tocar el resto del código.
   ========================================================== */

const CONFIG = {
  version: 'v1.5',

  // ---------- Partido ----------
  partido: {
    duracion: 150,          // segundos (2 min 30 s)
    puntosParaGanar: 11,    // el primero en llegar gana al instante (si no, gana quien vaya arriba al final)
    prorroga: 30,           // segundos de tiempo extra si hay empate
    pausaTrasCanasta: 1.8,  // segundos de celebración antes de reiniciar
    cuentaRegresiva: 3      // 3, 2, 1, ¡YA! al empezar
  },

  // ---------- Cancha ----------
  // La cancha va de -mitadLargo a +mitadLargo en X (izquierda-derecha)
  // y de -mitadAncho a +mitadAncho en Z (arriba-abajo en pantalla).
  cancha: {
    mitadLargo: 15,
    mitadAncho: 9,
    aroX: 12.85,           // distancia del centro a cada aro
    aroAltura: 3.05,       // altura del aro
    tableroX: 13.75,       // posición del tablero (detrás del aro)
    radioTriple: 7,        // más lejos que esto = 3 puntos
    aparicionAzul: { x: -8, z: 0 },
    aparicionRojo: { x: 8, z: 0 },
    // Dónde empieza cada integrante (el primero del azul eres tú)
    // (los de los lados van detrás de las barreras: antes quedaban DENTRO de ellas)
    aparicionesAzul: [{ x: -8, z: 0 }, { x: -10.4, z: -4 }, { x: -10.4, z: 4 }],
    aparicionesRojo: [{ x: 8, z: 0 }, { x: 10.4, z: -4 }, { x: 10.4, z: 4 }]
  },

  // ---------- Obstáculos (cajas y barreras) ----------
  // x, z = centro | w = ancho en X | d = fondo en Z | h = altura
  // La arena es simétrica: lo que hay a la izquierda también está a la derecha.
  obstaculos: [
    { tipo: 'caja',    x: -5,   z: -5.5, w: 1.6, d: 1.6, h: 1.6 },
    { tipo: 'caja',    x:  5,   z:  5.5, w: 1.6, d: 1.6, h: 1.6 },
    { tipo: 'caja',    x: -5,   z:  5.5, w: 1.6, d: 1.6, h: 1.6 },
    { tipo: 'caja',    x:  5,   z: -5.5, w: 1.6, d: 1.6, h: 1.6 },
    { tipo: 'barrera', x:  0,   z: -6.3, w: 3.2, d: 0.6, h: 1.2 },
    { tipo: 'barrera', x:  0,   z:  6.3, w: 3.2, d: 0.6, h: 1.2 },
    { tipo: 'barrera', x: -9.3, z: -3.6, w: 0.6, d: 2.4, h: 1.2 },
    { tipo: 'barrera', x: -9.3, z:  3.6, w: 0.6, d: 2.4, h: 1.2 },
    { tipo: 'barrera', x:  9.3, z: -3.6, w: 0.6, d: 2.4, h: 1.2 },
    { tipo: 'barrera', x:  9.3, z:  3.6, w: 0.6, d: 2.4, h: 1.2 }
  ],

  // ---------- Mapas ----------
  // Cada mapa cambia los obstáculos, los colores y una regla especial.
  // Todos son simétricos (izquierda = derecha reflejada) para que sea justo.
  mapas: {
    orden: ['estacion', 'luna', 'hielo', 'volcan', 'asteroides'],

    estacion: {
      nombre: 'Estación Orbital', icono: '🛰️',
      efecto: 'Sin trucos: la cancha clásica.',
      gravedad: 18, aceleracion: 1, dañoLava: 0,
      colores: { izq: '#152a66', centro: '#1d1245', der: '#5a1438', base: 0x120c2a, muro: 0x2a1f5c, neon: 0x7af0ff, fondo: 0x070514, decoracion: 'ninguna' },
      planeta: { color: 0x7b3fe4, brillo: 0x2a0f66, anillo: 0xff9de2 },
      obstaculos: null, // usa los obstáculos de arriba (los originales)
      lava: []
    },

    luna: {
      nombre: 'Cráter Lunar', icono: '🌑',
      efecto: 'Gravedad baja: el balón flota y los tiros caen más lento.',
      gravedad: 10, aceleracion: 1, dañoLava: 0,
      colores: { izq: '#2b3f66', centro: '#3a3d55', der: '#5a3348', base: 0x22243a, muro: 0x4a4e6e, neon: 0xd8e4ff, fondo: 0x05060f, decoracion: 'crateres' },
      planeta: { color: 0x3a8ce4, brillo: 0x0f3a66, anillo: null },
      obstaculos: [
        { tipo: 'roca', x: -5, z: -3, w: 1.6, d: 1.6, h: 1.3 },
        { tipo: 'roca', x: 5, z: 3, w: 1.6, d: 1.6, h: 1.3 },
        { tipo: 'roca', x: -5, z: 3, w: 1.6, d: 1.6, h: 1.3 },
        { tipo: 'roca', x: 5, z: -3, w: 1.6, d: 1.6, h: 1.3 },
        { tipo: 'roca', x: 0, z: -5.6, w: 2.4, d: 1.4, h: 1.2 },
        { tipo: 'roca', x: 0, z: 5.6, w: 2.4, d: 1.4, h: 1.2 },
        { tipo: 'roca', x: -10, z: 0, w: 1.3, d: 1.3, h: 1.1 },
        { tipo: 'roca', x: 10, z: 0, w: 1.3, d: 1.3, h: 1.1 }
      ],
      lava: []
    },

    hielo: {
      nombre: 'Anillo de Hielo', icono: '❄️',
      efecto: 'El piso resbala: cuesta frenar y girar.',
      gravedad: 18, aceleracion: 0.2, dañoLava: 0,
      colores: { izq: '#1f5f8f', centro: '#2a6f8f', der: '#6a3f7f', base: 0x16304a, muro: 0x5aa8d8, neon: 0xe0fbff, fondo: 0x06101c, decoracion: 'escarcha' },
      planeta: { color: 0xbfe8ff, brillo: 0x3a6688, anillo: 0xe8f6ff },
      obstaculos: [
        { tipo: 'cristal', x: -4.5, z: -3.5, w: 1.4, d: 1.4, h: 1.8 },
        { tipo: 'cristal', x: 4.5, z: 3.5, w: 1.4, d: 1.4, h: 1.8 },
        { tipo: 'cristal', x: -4.5, z: 3.5, w: 1.4, d: 1.4, h: 1.8 },
        { tipo: 'cristal', x: 4.5, z: -3.5, w: 1.4, d: 1.4, h: 1.8 },
        { tipo: 'cristal', x: 0, z: -4.2, w: 1.2, d: 1.2, h: 1.6 },
        { tipo: 'cristal', x: 0, z: 4.2, w: 1.2, d: 1.2, h: 1.6 },
        { tipo: 'cristal', x: -9.6, z: -6.2, w: 1.2, d: 1.2, h: 1.5 },
        { tipo: 'cristal', x: 9.6, z: 6.2, w: 1.2, d: 1.2, h: 1.5 },
        { tipo: 'cristal', x: -9.6, z: 6.2, w: 1.2, d: 1.2, h: 1.5 },
        { tipo: 'cristal', x: 9.6, z: -6.2, w: 1.2, d: 1.2, h: 1.5 }
      ],
      lava: []
    },

    volcan: {
      nombre: 'Volcán Zeta', icono: '🌋',
      efecto: 'Pozos de lava que hacen daño, incluso bajo los aros.',
      gravedad: 18, aceleracion: 1, dañoLava: 600, // daño por segundo en la lava
      colores: { izq: '#3a1f2a', centro: '#2a1418', der: '#4a1a1a', base: 0x1a0c0c, muro: 0x3a2020, neon: 0xffa040, fondo: 0x120505, decoracion: 'grietas' },
      planeta: { color: 0xe4583f, brillo: 0x661a0f, anillo: 0xffb080 },
      obstaculos: [
        { tipo: 'basalto', x: -5.5, z: -5.8, w: 1.6, d: 1.4, h: 1.5 },
        { tipo: 'basalto', x: 5.5, z: 5.8, w: 1.6, d: 1.4, h: 1.5 },
        { tipo: 'basalto', x: -5.5, z: 5.8, w: 1.6, d: 1.4, h: 1.5 },
        { tipo: 'basalto', x: 5.5, z: -5.8, w: 1.6, d: 1.4, h: 1.5 },
        { tipo: 'basalto', x: 0, z: -6.4, w: 3, d: 0.8, h: 1.2 },
        { tipo: 'basalto', x: 0, z: 6.4, w: 3, d: 0.8, h: 1.2 }
      ],
      // Pozos de lava: x, z = centro | w = ancho | d = fondo
      lava: [
        { x: -3.5, z: -3.6, w: 1.8, d: 1.6 },
        { x: 3.5, z: 3.6, w: 1.8, d: 1.6 },
        { x: -3.5, z: 3.6, w: 1.8, d: 1.6 },
        { x: 3.5, z: -3.6, w: 1.8, d: 1.6 },
        { x: -10.4, z: 0, w: 1.4, d: 2.2 },
        { x: 10.4, z: 0, w: 1.4, d: 2.2 }
      ]
    },

    asteroides: {
      nombre: 'Cinturón de Asteroides', icono: '☄️',
      efecto: 'Caen meteoritos: si ves un círculo rojo, ¡aléjate!',
      gravedad: 18, aceleracion: 1, dañoLava: 0,
      colores: { izq: '#2a1f5c', centro: '#2b1838', der: '#5c2430', base: 0x150f24, muro: 0x4a2f6e, neon: 0xffa04a, fondo: 0x08040e, decoracion: 'crateres' },
      planeta: { color: 0xe4793f, brillo: 0x66260f, anillo: 0xffcf8a },
      obstaculos: [
        { tipo: 'roca', x: -5, z: 0, w: 1.4, d: 1.4, h: 1.2 },
        { tipo: 'roca', x: 5, z: 0, w: 1.4, d: 1.4, h: 1.2 },
        { tipo: 'roca', x: 0, z: -5.8, w: 2, d: 1.2, h: 1.1 },
        { tipo: 'roca', x: 0, z: 5.8, w: 2, d: 1.2, h: 1.1 },
        { tipo: 'roca', x: -9, z: -6, w: 1.2, d: 1.2, h: 1 },
        { tipo: 'roca', x: 9, z: 6, w: 1.2, d: 1.2, h: 1 }
      ],
      lava: [],
      // Lluvia de meteoritos: cada cuántos segundos (más o menos), aviso antes de caer, tamaño y daño
      meteoros: { cada: 6, aviso: 1.6, radio: 2.2, daño: 1100 }
    }
  },

  // Emotes del online (teclas 1 a 4)
  emotes: ['👍', '😂', '😡', '🔥'],

  // ---------- Jugador ----------
  jugador: {
    // La velocidad depende del personaje (ver "personajes")
    aceleracion: 45,           // qué tan rápido arranca y frena
    radio: 0.55,               // tamaño para chocar con cosas
    impulso: {
      velocidad: 20,
      duracion: 0.16,          // segundos
      enfriamiento: 5          // segundos que hay que esperar para volver a usarlo
    }
  },

  // ---------- Personajes ----------
  // vida: puntos de vida | velocidad: unidades por segundo
  // ataque.tipo: 'proyectil' (disparo recto), 'golpe' (cuerpo a cuerpo),
  //              'bomba' (cae en arco donde apuntas), 'rayo' (atraviesa enemigos)
  // ataque.enfriamiento: segundos entre un ataque y otro
  // super: la habilidad especial (ver "Súper habilidades" más abajo)
  personajes: {
    nova: {
      vida: 2800, velocidad: 7,
      ataque: { tipo: 'proyectil', daño: 750, alcance: 10, velocidad: 22, radio: 0.3, enfriamiento: 0.55 },
      super: { tipo: 'rafaga', nombre: 'Ráfaga estelar', daño: 400, cantidad: 5, abanico: 32, alcance: 11, velocidad: 24, radio: 0.35 }
    },
    kraag: {
      vida: 5200, velocidad: 5.8,
      ataque: { tipo: 'golpe', daño: 1200, alcance: 2.6, angulo: 110, enfriamiento: 0.75 },
      super: { tipo: 'salto', nombre: 'Salto sísmico', daño: 1400, alcance: 7, radio: 2.6, empuje: 9, duracion: 0.6 }
    },
    zip: {
      vida: 2200, velocidad: 8.6,
      ataque: { tipo: 'proyectil', daño: 330, alcance: 5.5, velocidad: 26, radio: 0.22, enfriamiento: 0.32, cantidad: 2, separacion: 0.09 },
      super: { tipo: 'turbo', nombre: 'Hipervelocidad', duracion: 3.5, velocidad: 1.7, ataqueMasRapido: 0.55 }
    },
    orbit: {
      vida: 3000, velocidad: 6.6,
      ataque: { tipo: 'bomba', daño: 950, alcance: 8, radioExplosion: 1.9, tiempoVuelo: 0.7, enfriamiento: 1.0 },
      super: { tipo: 'granBomba', nombre: 'Supernova', daño: 1600, alcance: 9, radioExplosion: 3.6, tiempoVuelo: 1.0 }
    },
    lumen: {
      vida: 3000, velocidad: 7,
      ataque: { tipo: 'proyectil', daño: 480, curacion: 400, alcance: 7.5, velocidad: 16, radio: 0.45, enfriamiento: 0.6 },
      super: { tipo: 'escudo', nombre: 'Aura protectora', radio: 5.5, escudo: 1200, duracion: 4, curacion: 500 }
    },
    meteor: {
      vida: 3300, velocidad: 6.8,
      ataque: { tipo: 'rayo', daño: 820, alcance: 8.5, velocidad: 18, radio: 0.4, enfriamiento: 0.85 },
      super: { tipo: 'lluvia', nombre: 'Lluvia de meteoritos', daño: 340, cantidad: 6, alcance: 9, radio: 3, duracion: 1.4, radioImpacto: 1.4 }
    }
  },

  // ---------- Súper habilidades ----------
  // La súper se carga haciendo cosas útiles. Cuando llega al 100 % se guarda hasta usarla.
  super: {
    dañoParaCargar: 4500,      // daño que hay que hacer para llenarla
    curaParaCargar: 2600,      // curación que hay que hacer para llenarla
    porCanasta: 0.3,           // encestar llena este tanto
    porRobo: 0.15              // robar el balón llena este tanto
  },

  // ---------- Combate ----------
  combate: {
    tiempoReaparicion: 3,      // segundos eliminado antes de volver
    proteccion: 1,             // segundos sin recibir daño al reaparecer
    esperaRegeneracion: 3,     // segundos sin pelear para empezar a curarse solo
    regeneracion: 0.13,        // parte de la vida que recupera por segundo
    multiplicadorConBalon: 0.9 // velocidad con el balón (90 %)
  },

  // ---------- Bots ----------
  // La dificultad depende de cuántos JUGADORES REALES hay en el partido.
  // Menos personas = rivales más suaves y compañeros bots que ayudan más.
  bots: {
    jugadoresReales: 1,        // por ahora siempre 1; con el online subirá solo (2 a 6)

    // Niveles de los bots RIVALES según los jugadores reales
    // reaccion: segundos para reaccionar | velocidad: multiplicador
    // errorTiro: error al tirar (más = fallan más) | desvioAtaque: puntería de ataques
    // daño: multiplicador de daño | probabilidadRobo: probabilidad de intentar robar
    // presion: qué tanto persiguen al que tiene el balón (1 = siempre)
    rivales: {
      1: { reaccion: 0.65, velocidad: 0.82, errorTiro: 0.46, desvioAtaque: 0.32, daño: 0.65, probabilidadRobo: 0.35, presion: 0.6 },
      2: { reaccion: 0.5,  velocidad: 0.88, errorTiro: 0.4,  desvioAtaque: 0.24, daño: 0.8,  probabilidadRobo: 0.55, presion: 0.75 },
      3: { reaccion: 0.35, velocidad: 0.94, errorTiro: 0.35, desvioAtaque: 0.16, daño: 0.95, probabilidadRobo: 0.75, presion: 0.9 },
      4: { reaccion: 0.28, velocidad: 0.97, errorTiro: 0.32, desvioAtaque: 0.12, daño: 1,    probabilidadRobo: 0.85, presion: 1 },
      5: { reaccion: 0.22, velocidad: 1,    errorTiro: 0.3,  desvioAtaque: 0.1,  daño: 1,    probabilidadRobo: 1,    presion: 1 }
    },
    // Tus compañeros bots: juegan bien para ayudarte, pero te dejan el protagonismo
    aliados: { reaccion: 0.3, velocidad: 0.95, errorTiro: 0.34, desvioAtaque: 0.14, daño: 0.9, probabilidadRobo: 0.8, presion: 0.9 },

    // Comunes a todos los bots
    errorTiroPorDistancia: 0.025,
    distanciaTiro: 5.5,        // desde aquí intentan tirar de 2
    esperaAntesDeTirar: 0.6,   // segundos con el balón antes de tirar (da tiempo a defender)
    probabilidadTriple: 0.25,  // probabilidad de intentar un triple si están solos
    distanciaPresion: 2.4      // si un rival está así de cerca, buscan pasar
  },

  // ---------- Poderes en la cancha ----------
  // Aparecen en pares (uno en cada mitad, en el mismo lugar reflejado) para que sea justo.
  poderes: {
    primeraAparicion: 8,       // segundos desde el inicio hasta los primeros poderes
    intervalo: 14,             // segundos entre cada par nuevo
    maxPares: 2,               // como mucho, 2 pares en la cancha a la vez
    radioRecogida: 1.0,
    // Lugares posibles (solo la mitad izquierda; la derecha se refleja sola)
    lugares: [
      { x: -3, z: 0 }, { x: -6.5, z: 0 }, { x: -3.5, z: 6.5 }, { x: -3.5, z: -6.5 },
      { x: -7.5, z: 4.5 }, { x: -7.5, z: -4.5 }
    ],
    tipos: {
      turbo:   { nombre: 'Turbo',          color: 0x5dff7a, duracion: 6, velocidad: 1.4 },
      escudo:  { nombre: 'Escudo',         color: 0x5ee7ff, duracion: 6, escudo: 1000 },
      fuego:   { nombre: 'Balón de fuego', color: 0xff7a1a, duracion: 20, puntosExtra: 1 },
      iman:    { nombre: 'Imán',           color: 0xc77dff, duracion: 8, radioRecogida: 2.6 },
      recarga: { nombre: 'Recarga',        color: 0xffd23f, carga: 0.5 }
    }
  },

  // ---------- Modo Fiesta (celulares como control) ----------
  red: {
    prefijo: 'orbix-overdrive-sala-', // nombre interno de la sala en el servidor PeerJS
    // null = servidor gratis de PeerJS en internet. Para un servidor propio:
    // { host: 'localhost', port: 9000, path: '/', secure: false }
    servidor: null,
    stun: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    envioControl: 50,          // ms entre cada envío de los botones del celular
    envioEstado: 120,          // ms entre cada envío de la vida y la súper al celular
    envioFoto: 50,             // online: ms entre cada "foto" del partido que manda el anfitrión (20 por segundo)
    retrasoDibujo: 100,        // online: ms de retraso para dibujar a los demás suavemente
    maxJugadores: 6
  },
  fiesta: {
    camara: { altura: 21, distancia: 14, seguirBalon: 0.15 }, // cámara que muestra toda la cancha
    cuentaInicio: 5,           // segundos de espera cuando todos están listos
    volverSala: 10             // segundos en el resultado antes de volver a la sala
  },

  // ---------- Pase y robo ----------
  pase: {
    velocidad: 15,             // qué tan rápido viaja el balón en un pase
    distanciaMax: 16
  },
  robo: {
    alcance: 1.9,              // qué tan cerca hay que estar del que tiene el balón
    angulo: 75,                // tienes que estar mirándolo (grados hacia cada lado)
    esperaFallo: 2,            // segundos de espera si fallas el robo
    esperaAcierto: 1,          // segundos de espera si lo logras
    inmunidad: 0.7             // tras recibir el balón, no te lo pueden robar durante este tiempo
  },

  // ---------- Balón ----------
  balon: {
    radio: 0.4,                // tamaño del balón (antes 0.24)
    gravedad: 18,
    rebote: 0.62,              // 1 = rebota perfecto, 0 = no rebota
    friccionSuelo: 0.25,       // cuánta velocidad conserva por segundo al rodar
    radioRecogida: 1.15,       // qué tan cerca hay que estar para recogerlo
    tiempoSinRecoger: 0.45     // tras lanzar, no se puede recoger durante este tiempo
  },

  // ---------- Tiro (apuntado manual, sin asistencia) ----------
  // El balón va exactamente a donde apuntas, a la altura del aro.
  // Para encestar tienes que poner la mira dentro del aro.
  tiro: {
    errorBase: 0.03,           // error mínimo de todo tiro
    errorPorDistancia: 0.015,  // más lejos = un poco más de error
    errorEnMovimiento: 0.1,    // tirar corriendo = más error
    errorPresion: 0.12,        // tirar con un rival encima = más error
    distanciaPresion: 2.5,
    radioCanasta: 0.32,        // si el balón cruza el aro así de cerca del centro, entra
    radioAro: 0.72,            // tamaño del aro (más grande porque el balón creció)
    radioIntentoTiro: 2.5,     // si apuntas así de cerca de un aro, cuenta como tiro
    tiempoBase: 0.5,           // tiempo de vuelo mínimo
    tiempoPorDistancia: 0.055, // tiempo de vuelo extra por unidad de distancia
    distanciaMaxLanzamiento: 20,
    trayectoriaVisible: 0.5    // qué parte del arco se dibuja (0.5 = la primera mitad)
  },

  // ---------- Cámara ----------
  camara: {
    altura: 14,                // más baja = más cerca (antes 21)
    distancia: 10,             // qué tan atrás está la cámara (antes 14)
    suavizado: 5,
    seguimientoX: 0.9,         // cuánto sigue al jugador en X (0 = nada, 1 = todo)
    seguimientoZ: 0.6,
    adelanto: 2.5              // mira un poco hacia donde apuntas, para ver lo que viene
  },

  // ---------- Teclas (PC) ----------
  teclas: {
    super: 'KeyR'              // tecla de la súper (mantén para apuntar, suelta para usarla)
  },

  // ---------- Controles táctiles (celular) ----------
  tactil: {
    radioJoystick: 60,         // píxeles que puede moverse la palanca de movimiento
    zonaMuerta: 0.15,          // movimientos más pequeños que esto se ignoran
    // Stick de ataque (estilo Brawl Stars)
    radioApuntado: 85,         // píxeles desde el centro hasta el alcance máximo del tiro
    zonaCancelar: 0.22,        // si sueltas con el dedo tan cerca del centro, se cancela
    distanciaMinima: 1,        // el tiro más corto posible
    margenAlcance: 5,          // el alcance máximo llega hasta el aro rival + esto
    alcanceMinimo: 9,          // aunque estés muy cerca del aro, el alcance máximo es al menos esto
    tiempoToque: 0.25,         // un toque más corto que esto = lanzamiento rápido hacia donde miras
    distanciaToque: 6          // distancia del lanzamiento rápido
  },

  // ---------- Gráficos ----------
  graficos: {
    sombras: true,
    estrellas: 1500,
    maxPixelRatio: 2
  },

  // ---------- Sonido ----------
  audio: {
    volumenGeneral: 0.6,
    volumenMusica: 0.32,
    volumenEfectos: 0.8,
    tempoMusica: 112
  },

  // ---------- Colores ----------
  colores: {
    azul: 0x2f8bff,
    rojo: 0xff3b5c,
    piso: 0x1a1240,
    neon: 0x7af0ff,
    dorado: 0xffd23f,
    balon: 0xff7a1a
  }
};
