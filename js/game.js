/* ==========================================================
   ORBIX: OVERDRIVE — game.js
   Lógica principal: menús, partido, movimiento, balón,
   tiros con asistencia, canastas, cámara, HUD y logros.
   ========================================================== */

(() => {
  const C = CONFIG.cancha;
  const J = CONFIG.jugador;
  const B = CONFIG.balon;
  const T = CONFIG.tiro;
  const COL = CONFIG.colores;

  // ==========================================================
  // 1. ESCENA 3D
  // ==========================================================
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.graficos.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = CONFIG.graficos.sombras;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('juego').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070514);
  scene.fog = new THREE.Fog(0x070514, 70, 220);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 18, 26);

  // Luces
  scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x2a0033, 0.75));
  const sol = new THREE.DirectionalLight(0xffffff, 0.85);
  sol.position.set(8, 25, 12);
  sol.castShadow = CONFIG.graficos.sombras;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -18, right: 18, top: 12, bottom: -12, near: 1, far: 60 });
  scene.add(sol);

  // Aros (iguales en todos los mapas)
  const aros = Arena.crearAros(scene);

  // ---------- Mapas ----------
  // El mapa "estacion" usa los obstáculos originales del config
  CONFIG.mapas.estacion.obstaculos = CONFIG.obstaculos.map((o) => ({ ...o }));
  let escenario = null;
  let flotantes = [];
  let mapa = CONFIG.mapas.estacion;
  const hemi = scene.children.find((o) => o.isHemisphereLight);

  function cambiarMapa(id) {
    mapa = CONFIG.mapas[id];
    CONFIG.mapaActual = mapa;
    // Los obstáculos se cambian "en el mismo arreglo" para que todo el juego los vea
    CONFIG.obstaculos.length = 0;
    mapa.obstaculos.forEach((o) => CONFIG.obstaculos.push({ ...o }));
    CONFIG.balon.gravedad = mapa.gravedad;
    if (escenario) Arena.quitarEscenario(scene, escenario);
    escenario = Arena.crearEscenario(scene, mapa);
    flotantes = escenario.flotantes;
    scene.background.setHex(mapa.colores.fondo);
    scene.fog.color.setHex(mapa.colores.fondo);
    if (hemi) hemi.color.setHex(id === 'volcan' ? 0xffb090 : id === 'hielo' ? 0xc8ecff : 0x9aa8ff);
  }
  cambiarMapa('estacion');

  // ¿Está este punto dentro de un pozo de lava?
  function enLava(x, z, margen = 0) {
    for (const l of mapa.lava) {
      if (Math.abs(x - l.x) < l.w / 2 + margen && Math.abs(z - l.z) < l.d / 2 + margen) return true;
    }
    return false;
  }

  // La lava hace daño a cualquiera que la pise (cada cuarto de segundo)
  function actualizarLava(dt) {
    if (!mapa.lava.length) return;
    for (const m of escenario.lavas) m.material.emissiveIntensity = 1 + Math.sin(tiempoTotal * 3 + m.position.x) * 0.3;
    if (Math.random() < 0.15) {
      const l = mapa.lava[Math.floor(Math.random() * mapa.lava.length)];
      lanzarParticulas(l.x + (Math.random() - 0.5) * l.w, 0.2, l.z + (Math.random() - 0.5) * l.d, 0xff7a1a, 1, 1.5, -2, 0.6);
    }
    for (const e of combate.entidades) {
      if (!e.vivo || e.salto) continue;
      if (enLava(e.pos.x, e.pos.z)) {
        e.tLava = (e.tLava || 0) + dt;
        if (e.tLava >= 0.25) {
          combate.hacerDaño(e, mapa.dañoLava * e.tLava, null);
          if (e === jugador && e.vivo) mostrarPista('¡Cuidado, lava!');
          e.tLava = 0;
        }
      } else {
        e.tLava = 0;
      }
    }
  }
  const aroRival = aros.find((a) => a.equipo === 'rojo'); // el jugador (azul) ataca este aro
  // Cada equipo ataca el aro del otro
  const aroQueAtaca = (ent) => aros.find((a) => a.equipo !== ent.equipo);

  // ==========================================================
  // 2. JUGADOR Y BALÓN
  // ==========================================================
  // Personaje elegido (se recuerda el último que usaste)
  let personajeId = 'nova';

  const jugador = {
    malla: Personajes.crearModelo('nova', COL.azul),
    esJugador: true,
    personaje: 'nova',
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(1, 0, 0),   // hacia dónde mira
    equipo: 'azul',
    impulsoT: 0,                        // tiempo restante del impulso
    impulsoCd: 0,                       // enfriamiento del impulso
    impulsoDir: new THREE.Vector3(),
    cdRobo: 0,
    animT: 0
  };
  scene.add(jugador.malla);

  const balon = {
    malla: Arena.crearBalon(),
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    portador: null,       // quién lo tiene (null = libre)
    tLanzado: 99,         // segundos desde que se soltó
    origen: new THREE.Vector3(), // desde dónde se lanzó (para 2 o 3 puntos)
    tiroActivo: false,    // true mientras un tiro va hacia el aro
    tiroDe: null,
    tPosesion: 0,         // segundos que lleva el portador con el balón
    yAnterior: 0
  };
  scene.add(balon.malla);

  // Sombra redonda del balón (ayuda mucho a ver su altura desde arriba)
  const sombraBalon = new THREE.Mesh(
    new THREE.CircleGeometry(B.radio * 1.3, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
  );
  sombraBalon.rotation.x = -Math.PI / 2;
  sombraBalon.position.y = 0.02;
  scene.add(sombraBalon);

  // Anillo naranja que late bajo el balón cuando está libre (para encontrarlo rápido)
  const marcaBalon = new THREE.Mesh(
    new THREE.RingGeometry(B.radio * 1.6, B.radio * 2.0, 24),
    new THREE.MeshBasicMaterial({ color: COL.balon, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  marcaBalon.rotation.x = -Math.PI / 2;
  marcaBalon.position.y = 0.03;
  scene.add(marcaBalon);

  // Mira (del tamaño de la zona de canasta: si cabe dentro del aro, entra)
  const mira = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.32, 24),
    new THREE.MeshBasicMaterial({ color: COL.neon, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false })
  );
  mira.renderOrder = 10; // siempre se dibuja encima para que no se pierda
  // Punto central de la mira
  const puntoCentral = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
  );
  puntoCentral.renderOrder = 11;
  mira.add(puntoCentral);
  mira.rotation.x = -Math.PI / 2;
  mira.position.y = 0.04;
  scene.add(mira);
  // Línea vertical que une la mira con el piso (ayuda a ver dónde estás apuntando)
  const guiaMira = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, C.aroAltura, 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
  );
  guiaMira.visible = false;
  scene.add(guiaMira);

  // Línea punteada que muestra la trayectoria del tiro
  const PUNTOS_TRAYECTORIA = 28;
  const geoTray = new THREE.BufferGeometry();
  geoTray.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUNTOS_TRAYECTORIA * 3), 3));
  const matTray = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.85 });
  const trayectoria = new THREE.Line(geoTray, matTray);
  trayectoria.frustumCulled = false;
  scene.add(trayectoria);

  // Indicador del alcance del ataque (se ve en el piso al apuntar sin balón)
  const matIndicador = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const geoTira = new THREE.PlaneGeometry(1, 1);
  geoTira.translate(0, 0.5, 0);
  geoTira.rotateX(Math.PI / 2); // queda acostada, empezando en el personaje y hacia +Z
  const indicadorTira = new THREE.Mesh(geoTira, matIndicador);
  const indicadorArea = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28), matIndicador);
  indicadorArea.rotation.x = -Math.PI / 2;
  let indicadorSector = new THREE.Mesh(new THREE.BufferGeometry(), matIndicador);
  [indicadorTira, indicadorArea, indicadorSector].forEach((m) => { m.visible = false; m.position.y = 0.06; scene.add(m); });

  // Indicador dorado de la súper y anillo que avisa que está lista
  const matSuper = new THREE.MeshBasicMaterial({ color: COL.dorado, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const superTira = new THREE.Mesh(geoTira, matSuper);
  const superArea = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), matSuper);
  superArea.rotation.x = -Math.PI / 2;
  const superCentro = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: COL.dorado, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  superCentro.rotation.x = -Math.PI / 2;
  [superTira, superArea, superCentro].forEach((m) => { m.visible = false; m.position.y = 0.07; scene.add(m); });
  const anilloSuperListo = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.0, 28),
    new THREE.MeshBasicMaterial({ color: COL.dorado, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
  );
  anilloSuperListo.rotation.x = -Math.PI / 2;
  anilloSuperListo.position.y = 0.05;
  anilloSuperListo.visible = false;
  scene.add(anilloSuperListo);

  // Prepara el indicador según el ataque del personaje
  function prepararIndicador(a) {
    if (a.tipo === 'golpe') {
      const mitad = THREE.MathUtils.degToRad(a.angulo / 2);
      const geo = new THREE.CircleGeometry(a.alcance, 20, Math.PI / 2 - mitad, mitad * 2);
      geo.rotateX(Math.PI / 2);
      indicadorSector.geometry.dispose();
      indicadorSector.geometry = geo;
    }
  }

  // ==========================================================
  // 3. PARTÍCULAS (para canastas e impulso)
  // ==========================================================
  const particulas = [];
  const geoParticula = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  for (let i = 0; i < 160; i++) {
    const m = new THREE.Mesh(geoParticula, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false;
    scene.add(m);
    particulas.push({ m, vel: new THREE.Vector3(), vida: 0, vidaMax: 1, gravedad: 9 });
  }

  function lanzarParticulas(x, y, z, color, cantidad, fuerza = 5, gravedad = 9, vida = 1) {
    let creadas = 0;
    for (const p of particulas) {
      if (p.vida > 0) continue;
      p.m.visible = true;
      p.m.material.color.setHex(color);
      p.m.position.set(x, y, z);
      p.vel.set((Math.random() - 0.5) * fuerza, Math.random() * fuerza, (Math.random() - 0.5) * fuerza);
      p.vida = p.vidaMax = vida * (0.6 + Math.random() * 0.4);
      p.gravedad = gravedad;
      if (++creadas >= cantidad) break;
    }
  }

  function actualizarParticulas(dt) {
    for (const p of particulas) {
      if (p.vida <= 0) continue;
      p.vida -= dt;
      p.vel.y -= p.gravedad * dt;
      p.m.position.addScaledVector(p.vel, dt);
      p.m.rotation.x += dt * 6;
      p.m.rotation.y += dt * 4;
      p.m.scale.setScalar(Math.max(0.01, p.vida / p.vidaMax));
      if (p.vida <= 0) p.m.visible = false;
    }
  }

  // ==========================================================
  // 3b. COMBATE (vida, ataques, drones de práctica)
  // ==========================================================
  const combate = crearCombate({
    scene, camera, lanzarParticulas, resolverColisiones,
    alEliminar: alEliminarEntidad,
    alReaparecer: alReaparecerEntidad,
    sacudir: sacudirCamara,
    alUsarSuper: alUsarSuperEntidad
  });

  // Cuando alguien usa su súper
  function alUsarSuperEntidad(ent, su) {
    if (ent === jugador) {
      desbloquear('super');
      mostrarPista(`¡${su.nombre}!`);
    } else if (ent.equipo !== jugador.equipo && Math.hypot(ent.pos.x - jugador.pos.x, ent.pos.z - jugador.pos.z) < 12) {
      mostrarPista(`¡${ent.nombre} usó ${su.nombre}!`);
    }
  }
  combate.registrar(jugador, {
    vida: CONFIG.personajes.nova.vida, radio: J.radio, aparicion: C.aparicionAzul, nombre: 'Nova'
  });

  // Bots: los 5 personajes que no elegiste (2 compañeros y 3 rivales)
  const bots = crearBots({
    scene, combate, balon, aros, resolverColisiones,
    tiempoPosesion: () => balon.tPosesion,
    tirarBot, pasar, intentarRobo,
    orbes: () => poderes.orbes
  });

  // Poderes que aparecen en la cancha
  const poderes = crearPoderes({ scene, combate, lanzarParticulas, alRecoger: alRecogerPoder });

  function alRecogerPoder(ent, tipo, d) {
    if (ent === jugador) {
      Sonido.sfx.poder();
      mostrarPista(`¡${d.nombre}!`);
      partido.stats.poderes++;
      desbloquear('poder');
    }
  }

  // Datos del personaje actual (vida, velocidad, ataque)
  const stats = () => CONFIG.personajes[jugador.personaje];

  // Cambia el personaje del jugador
  function aplicarPersonaje(id) {
    personajeId = id;
    jugador.personaje = id;
    const s = CONFIG.personajes[id];
    jugador.vidaMax = jugador.vida = s.vida;
    combate.cambiarMalla(jugador, Personajes.crearModelo(id, COL.azul));
    jugador.barra.querySelector('.nombre').textContent = Personajes.info[id].nombre;
    prepararIndicador(s.ataque);
    progreso.ultimoPersonaje = id;
    guardarProgreso();
  }

  // Cuando alguien es eliminado
  function alEliminarEntidad(ent, atacante, esSuper) {
    if (atacante === jugador && esSuper) desbloquear('superElim');
    poderes.quitarA(ent);
    // Si llevaba el balón, lo suelta
    if (balon.portador === ent) {
      balon.portador = null;
      balon.pos.set(ent.pos.x, 1.2, ent.pos.z);
      balon.vel.set((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3);
      balon.tLanzado = 0.2;
      balon.tiroActivo = false;
    }
    if (atacante === jugador) {
      partido.stats.eliminaciones++;
      desbloquear('derribo');
      mostrarPista(`¡Eliminaste a ${ent.nombre}!`);
    }
    if (ent === jugador) {
      jugador.vel.set(0, 0, 0);
      jugador.impulsoT = 0;
      mostrarAviso('¡ELIMINADO!', '', 'rojo');
    }
  }

  function alReaparecerEntidad(ent) {
    if (ent === jugador) {
      Sonido.sfx.reaparecer();
      jugador.malla.rotation.y = Math.PI / 2;
    }
  }

  // ==========================================================
  // 4. ESTADO DEL PARTIDO
  // ==========================================================
  // estados: 'menu' | 'jugando' | 'canasta' | 'pausa' | 'fin'
  let estado = 'menu';
  let estadoAntesPausa = 'jugando';
  let tiempoTotal = 0;

  const partido = {
    tiempo: 0,
    prorroga: false,
    marcador: { azul: 0, rojo: 0 },
    tCanasta: 0,
    stats: { tiros: 0, canastas: 0, triples: 0, puntos: 0, eliminaciones: 0, poderes: 0 },
    racha: 0
  };

  // ==========================================================
  // 5. LOGROS (se guardan en el navegador con localStorage)
  // ==========================================================
  const LOGROS = [
    { id: 'primera',  nombre: 'Primera canasta',        desc: 'Anota tu primera canasta.' },
    { id: 'triple',   nombre: 'Francotirador galáctico', desc: 'Anota un triple.' },
    { id: 'racha',    nombre: 'En llamas',              desc: 'Anota 5 tiros seguidos sin fallar.' },
    { id: 'nueve',    nombre: 'Lluvia de meteoritos',   desc: 'Haz 9 puntos tú solo en un partido.' },
    { id: 'victoria', nombre: 'Primera victoria',       desc: 'Gana un partido.' },
    { id: 'derribo',  nombre: 'Primer derribo',         desc: 'Elimina a un rival.' },
    { id: 'super',    nombre: 'Poder estelar',          desc: 'Usa tu súper habilidad.' },
    { id: 'poder',    nombre: 'Energizado',             desc: 'Recoge un poder de la cancha.' },
    { id: 'fuego',    nombre: 'Canasta en llamas',      desc: 'Anota con el Balón de fuego.' },
    { id: 'turista',  nombre: 'Turista galáctico',      desc: 'Juega en los 4 mapas.' },
    { id: 'tresVictorias', nombre: 'Leyenda de la arena', desc: 'Gana 3 partidos.' },
    { id: 'invicto',  nombre: 'Muralla galáctica',      desc: 'Gana un partido sin que el rival anote.' },
    { id: 'remontada', nombre: 'Remontada épica',       desc: 'Gana un partido en el que ibas perdiendo por 4 o más.' },
    { id: 'ladron',   nombre: 'Manos rápidas',          desc: 'Roba 3 balones en un partido.' },
    { id: 'asistente', nombre: 'Pase perfecto',         desc: 'Da un pase que termine en canasta.' },
    { id: 'superElim', nombre: 'Golpe final',           desc: 'Elimina a un rival con tu súper.' }
  ];
  const CLAVE_GUARDADO = 'orbix_overdrive_progreso';

  function cargarProgreso() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_GUARDADO)) || { logros: {}, mejorPuntaje: 0 };
    } catch (e) {
      return { logros: {}, mejorPuntaje: 0 };
    }
  }
  const progreso = cargarProgreso();
  if (!progreso.logros) progreso.logros = {};

  function guardarProgreso() {
    try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(progreso)); } catch (e) { /* sin guardado */ }
  }

  function desbloquear(id) {
    if (progreso.logros[id]) return;
    progreso.logros[id] = true;
    guardarProgreso();
    const l = LOGROS.find((x) => x.id === id);
    mostrarLogro(l.nombre);
    Sonido.sfx.logro();
  }

  // ==========================================================
  // 6. CONTROLES (teclado y mouse)
  // ==========================================================
  const teclas = {};
  const raton = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planoAro = new THREE.Plane(new THREE.Vector3(0, 1, 0), -C.aroAltura); // para apuntar al aro
  const puntoMira = new THREE.Vector3(5, 0, 0);

  window.addEventListener('keydown', (e) => {
    teclas[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (estado === 'jugando' || estado === 'canasta') impulso();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') alternarPausa();
    if (e.code === 'KeyM') alternarMusica();
    if (e.code === CONFIG.teclas.super && !e.repeat && (estado === 'jugando' || estado === 'canasta')) {
      if (jugador.carga >= 1) apuntandoSuperPC = true;
      else mostrarPista(`Súper cargada al ${Math.floor(jugador.carga * 100)} %`);
    }
    if (e.code === 'KeyF') alternarPantallaCompleta();
  });
  window.addEventListener('keyup', (e) => {
    teclas[e.code] = false;
    // Al soltar la tecla de la súper (R) se lanza hacia la mira
    if (e.code === CONFIG.teclas.super && apuntandoSuperPC) {
      apuntandoSuperPC = false;
      if (estado === 'jugando' || estado === 'canasta') usarSuperJugador(puntoMira.x, puntoMira.z);
    }
  });
  let apuntandoSuperPC = false;

  function usarSuperJugador(tx, tz) {
    if (!combate.usarSuper(jugador, tx, tz)) Sonido.sfx.error();
  }

  // Mouse (solo cuenta si de verdad es un mouse, no un dedo)
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (tactil.activo) activarModoTactil(false);
    raton.x = (e.clientX / window.innerWidth) * 2 - 1;
    raton.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (estado !== 'jugando' && estado !== 'canasta') return;
    if (e.button === 0) accionPrincipal();
    if (e.button === 2) accionSecundaria();
  });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // ==========================================================
  // 6b. CONTROLES TÁCTILES (celular)
  // ==========================================================
  // Stick izquierdo: aparece donde pongas el dedo en la mitad izquierda.
  // Stick derecho (botón de ataque): arrastra para apuntar y suelta para lanzar.
  // Un toque rápido con el balón = tiro directo al aro.
  const TC = CONFIG.tactil;
  const tactil = {
    activo: false,
    mover: { id: null, x0: 0, y0: 0, dx: 0, dy: 0 },
    apuntar: { id: null, x0: 0, y0: 0, dx: 0, dy: 0, t0: 0, arrastrado: false }
  };
  const elTactil = document.getElementById('tactil');
  const elZonaMover = document.getElementById('zona-mover');
  const elStickMover = document.getElementById('stick-mover');
  const elPerillaMover = document.getElementById('perilla-mover');
  const elStickAtaque = document.getElementById('stick-ataque');
  const elPerillaAtaque = document.getElementById('perilla-ataque');

  function activarModoTactil(si) {
    tactil.activo = si;
    document.body.classList.toggle('tactil', si);
  }
  // Si el primer toque es con el dedo, se activa el modo celular
  window.addEventListener('touchstart', () => { if (!tactil.activo) activarModoTactil(true); }, { passive: true });
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) activarModoTactil(true);

  // Convierte el arrastre en un vector de -1 a 1 (limitado al círculo)
  function vectorStick(s) {
    let x = s.dx / TC.radioJoystick, y = s.dy / TC.radioJoystick;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }

  function moverPerilla(perilla, s) {
    const v = vectorStick(s);
    perilla.style.transform = `translate(${v.x * TC.radioJoystick}px, ${v.y * TC.radioJoystick}px)`;
  }

  // --- Stick de movimiento ---
  elZonaMover.addEventListener('pointerdown', (e) => {
    if (tactil.mover.id !== null) return;
    e.preventDefault();
    elZonaMover.setPointerCapture(e.pointerId);
    Object.assign(tactil.mover, { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
    elStickMover.style.left = `${e.clientX}px`;
    elStickMover.style.top = `${e.clientY}px`;
    elStickMover.classList.add('activo');
    moverPerilla(elPerillaMover, tactil.mover);
  });
  elZonaMover.addEventListener('pointermove', (e) => {
    if (e.pointerId !== tactil.mover.id) return;
    tactil.mover.dx = e.clientX - tactil.mover.x0;
    tactil.mover.dy = e.clientY - tactil.mover.y0;
    moverPerilla(elPerillaMover, tactil.mover);
  });
  const soltarMover = (e) => {
    if (e.pointerId !== tactil.mover.id) return;
    Object.assign(tactil.mover, { id: null, dx: 0, dy: 0 });
    elStickMover.classList.remove('activo');
  };
  elZonaMover.addEventListener('pointerup', soltarMover);
  elZonaMover.addEventListener('pointercancel', soltarMover);

  // --- Stick de ataque / lanzamiento (estilo Brawl Stars) ---
  // La dirección del dedo = dirección del tiro. Qué tan lejos lo llevas = qué tan lejos lanzas.
  // Si vuelves el dedo al centro y sueltas, el tiro se CANCELA.
  elStickAtaque.addEventListener('pointerdown', (e) => {
    if (tactil.apuntar.id !== null) return;
    e.preventDefault();
    elStickAtaque.setPointerCapture(e.pointerId);
    const r = elStickAtaque.getBoundingClientRect();
    Object.assign(tactil.apuntar, {
      id: e.pointerId, x0: r.left + r.width / 2, y0: r.top + r.height / 2,
      dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2),
      t0: tiempoTotal, arrastrado: false, enCancelar: true
    });
    elStickAtaque.classList.add('activo');
    moverPerillaAtaque();
  });
  elStickAtaque.addEventListener('pointermove', (e) => {
    const s = tactil.apuntar;
    if (e.pointerId !== s.id) return;
    s.dx = e.clientX - s.x0;
    s.dy = e.clientY - s.y0;
    s.enCancelar = alcanceStick() < TC.zonaCancelar;
    if (!s.enCancelar) s.arrastrado = true; // ya salió del centro: está apuntando
    moverPerillaAtaque();
  });
  elStickAtaque.addEventListener('pointerup', (e) => {
    const s = tactil.apuntar;
    if (e.pointerId !== s.id) return;
    const jugando = estado === 'jugando' || estado === 'canasta';
    if (jugando) {
      if (s.arrastrado && !s.enCancelar) {
        // Lanza hacia donde quedó la mira
        apuntarTactil();
        accionPrincipal();
      } else if (s.arrastrado && s.enCancelar) {
        // Volvió al centro: tiro cancelado
        mostrarPista('Tiro cancelado');
      } else if (tiempoTotal - s.t0 < TC.tiempoToque) {
        if (balon.portador === jugador) {
          // Toque rápido con balón: lanzamiento corto hacia donde mira el personaje
          puntoMira.set(
            jugador.pos.x + jugador.dir.x * TC.distanciaToque, 0,
            jugador.pos.z + jugador.dir.z * TC.distanciaToque
          );
        } else {
          // Toque rápido sin balón: ataca al rival más cercano (como en Brawl Stars)
          const r = rivalMasCercano(stats().ataque.alcance + 1);
          if (r) puntoMira.set(r.pos.x, 0, r.pos.z);
          else puntoMira.set(jugador.pos.x + jugador.dir.x * 4, 0, jugador.pos.z + jugador.dir.z * 4);
        }
        accionPrincipal();
      }
    }
    soltarAtaque();
  });
  elStickAtaque.addEventListener('pointercancel', (e) => {
    if (e.pointerId === tactil.apuntar.id) soltarAtaque();
  });
  function soltarAtaque() {
    Object.assign(tactil.apuntar, { id: null, dx: 0, dy: 0, arrastrado: false, enCancelar: false });
    elStickAtaque.classList.remove('activo', 'cancelar');
    elPerillaAtaque.style.transform = '';
  }

  // Qué tan lejos del centro está el dedo (0 = centro, 1 = borde o más allá)
  function alcanceStick() {
    const s = tactil.apuntar;
    return Math.min(1, Math.hypot(s.dx, s.dy) / TC.radioApuntado);
  }

  function moverPerillaAtaque() {
    const s = tactil.apuntar;
    const m = Math.hypot(s.dx, s.dy) || 1;
    const a = alcanceStick() * TC.radioApuntado;
    elPerillaAtaque.style.transform = `translate(${(s.dx / m) * a}px, ${(s.dy / m) * a}px)`;
    elStickAtaque.classList.toggle('cancelar', s.arrastrado && s.enCancelar);
  }

  // Convierte la posición del dedo en un punto de la cancha.
  // La dirección es 100 % tuya. El alcance máximo se ajusta a la distancia del aro rival
  // (más un margen), así hay precisión tanto de cerca como de lejos.
  function apuntarTactil() {
    const s = tactil.apuntar;
    const m = Math.hypot(s.dx, s.dy) || 1;
    const f = (alcanceStick() - TC.zonaCancelar) / (1 - TC.zonaCancelar); // 0..1
    let alcanceMax;
    if (balon.portador === jugador) {
      // Con balón: el tiro más largo llega hasta el aro rival + un margen
      const distAro = Math.hypot(aroRival.x - jugador.pos.x, aroRival.z - jugador.pos.z);
      alcanceMax = Math.max(TC.alcanceMinimo, distAro + TC.margenAlcance);
    } else {
      // Sin balón: el alcance es el del ataque del personaje
      alcanceMax = stats().ataque.alcance;
    }
    const d = TC.distanciaMinima + Math.max(0, f) * (alcanceMax - TC.distanciaMinima);
    puntoMira.set(jugador.pos.x + (s.dx / m) * d, 0, jugador.pos.z + (s.dy / m) * d);
  }

  // --- Botones ---
  const botonTactil = (id, fn) => {
    document.getElementById(id).addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  };
  botonTactil('btn-impulso', () => { if (estado === 'jugando' || estado === 'canasta') impulso(); });
  botonTactil('btn-pase', () => { if (estado === 'jugando' || estado === 'canasta') accionSecundaria(); });
  // --- Botón SÚPER (también es un stick: arrastra para apuntar, suelta para usar) ---
  const elSuper = document.getElementById('btn-super');
  const superTactil = { id: null, x0: 0, y0: 0, dx: 0, dy: 0, arrastrado: false };
  elSuper.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (superTactil.id !== null) return;
    if (jugador.carga < 1) { mostrarPista(`Súper cargada al ${Math.floor(jugador.carga * 100)} %`); return; }
    elSuper.setPointerCapture(e.pointerId);
    const r = elSuper.getBoundingClientRect();
    Object.assign(superTactil, { id: e.pointerId, x0: r.left + r.width / 2, y0: r.top + r.height / 2, dx: 0, dy: 0, arrastrado: false });
    elSuper.classList.add('activo');
  });
  elSuper.addEventListener('pointermove', (e) => {
    if (e.pointerId !== superTactil.id) return;
    superTactil.dx = e.clientX - superTactil.x0;
    superTactil.dy = e.clientY - superTactil.y0;
    if (Math.hypot(superTactil.dx, superTactil.dy) > 18) superTactil.arrastrado = true;
  });
  const soltarSuper = (e, usar) => {
    if (e.pointerId !== superTactil.id) return;
    if (usar && (estado === 'jugando' || estado === 'canasta')) {
      const p = puntoSuperTactil();
      usarSuperJugador(p.x, p.z);
    }
    superTactil.id = null;
    superTactil.arrastrado = false;
    elSuper.classList.remove('activo');
  };
  elSuper.addEventListener('pointerup', (e) => soltarSuper(e, true));
  elSuper.addEventListener('pointercancel', (e) => soltarSuper(e, false));

  // A dónde apunta la súper en el celular
  function puntoSuperTactil() {
    const su = stats().super;
    const alcance = su.alcance || 4;
    if (superTactil.arrastrado) {
      const m = Math.hypot(superTactil.dx, superTactil.dy) || 1;
      const f = Math.min(1, m / TC.radioApuntado);
      const d = Math.max(1, f * alcance);
      return { x: jugador.pos.x + (superTactil.dx / m) * d, z: jugador.pos.z + (superTactil.dy / m) * d };
    }
    // Toque rápido: al rival más cercano (o hacia donde miras)
    const r = rivalMasCercano(alcance + 2);
    if (r) return { x: r.pos.x, z: r.pos.z };
    return { x: jugador.pos.x + jugador.dir.x * alcance * 0.7, z: jugador.pos.z + jugador.dir.z * alcance * 0.7 };
  }
  botonTactil('btn-pausa', () => alternarPausa());

  // Evita que el navegador haga zoom o scroll mientras juegas
  elTactil.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // Si el jugador cambia de pestaña, el juego se pausa solo
  window.addEventListener('blur', () => {
    if (estado === 'jugando' || estado === 'canasta' || estado === 'cuenta') alternarPausa();
  });

  function actualizarApuntado() {
    if (!tactil.activo) {
      raycaster.setFromCamera(raton, camera);
      // Con el balón apuntas a la altura del aro: lo que ves bajo el mouse es a donde va
      const plano = balon.portador === jugador ? planoAro : planoSuelo;
      raycaster.ray.intersectPlane(plano, puntoMira);
      return;
    }
    // Celular: si estás arrastrando el stick derecho, apuntas con él
    if (tactil.apuntar.id !== null && tactil.apuntar.arrastrado && !tactil.apuntar.enCancelar) {
      apuntarTactil();
      return;
    }
    // Si no, el personaje mira hacia donde camina
    const rapidez = Math.hypot(jugador.vel.x, jugador.vel.z);
    const dx = rapidez > 0.5 ? jugador.vel.x / rapidez : jugador.dir.x;
    const dz = rapidez > 0.5 ? jugador.vel.z / rapidez : jugador.dir.z;
    puntoMira.set(jugador.pos.x + dx * 4, 0, jugador.pos.z + dz * 4);
  }

  // ¿Se debe mostrar la mira y la trayectoria?
  function apuntandoAhora() {
    if (!tactil.activo) return true;
    return tactil.apuntar.id !== null && tactil.apuntar.arrastrado && !tactil.apuntar.enCancelar;
  }

  // ==========================================================
  // 7. MOVIMIENTO DEL JUGADOR
  // ==========================================================
  function moverJugador(dt) {
    jugador.impulsoCd = Math.max(0, jugador.impulsoCd - dt);
    jugador.cdRobo = Math.max(0, jugador.cdRobo - dt);
    const animar = jugador.malla.userData.animar;
    if (animar) animar(tiempoTotal);
    if (!jugador.vivo) return; // eliminado: espera a reaparecer
    if (jugador.salto) {
      // Durante el salto de Kraag el movimiento lo controla la súper
      jugador.vel.set(0, 0, 0);
      jugador.malla.position.set(jugador.pos.x, jugador.alturaExtra, jugador.pos.z);
      return;
    }

    let ix = 0, iz = 0;
    if (teclas.KeyW || teclas.ArrowUp) iz -= 1;
    if (teclas.KeyS || teclas.ArrowDown) iz += 1;
    if (teclas.KeyA || teclas.ArrowLeft) ix -= 1;
    if (teclas.KeyD || teclas.ArrowRight) ix += 1;
    const largo = Math.hypot(ix, iz);
    if (largo > 0) { ix /= largo; iz /= largo; }

    // Stick izquierdo (celular): analógico, empujar poco = caminar lento
    if (tactil.mover.id !== null) {
      const v = vectorStick(tactil.mover);
      if (v.m > TC.zonaMuerta) {
        const fuerza = (v.m - TC.zonaMuerta) / (1 - TC.zonaMuerta);
        ix = (v.x / v.m) * fuerza;
        iz = (v.y / v.m) * fuerza;
      }
    }

    if (jugador.impulsoT > 0) {
      // Durante el impulso se mueve rápido en línea recta
      jugador.impulsoT -= dt;
      jugador.vel.set(jugador.impulsoDir.x * J.impulso.velocidad, 0, jugador.impulsoDir.z * J.impulso.velocidad);
      lanzarParticulas(jugador.pos.x, 0.5, jugador.pos.z, COL.azul, 2, 1, 0, 0.35);
    } else {
      // Aceleración suave hacia la velocidad deseada
      const turbo = Math.max(jugador.tTurbo > 0 ? CONFIG.personajes.zip.super.velocidad : 1, poderes.multVelocidad(jugador));
      const vmax = stats().velocidad * turbo * (balon.portador === jugador ? CONFIG.combate.multiplicadorConBalon : 1);
      const dx = ix * vmax - jugador.vel.x;
      const dz = iz * vmax - jugador.vel.z;
      const d = Math.hypot(dx, dz);
      const maxCambio = J.aceleracion * mapa.aceleracion * dt; // en el hielo cuesta frenar
      const k = d > maxCambio ? maxCambio / d : 1;
      jugador.vel.x += dx * k;
      jugador.vel.z += dz * k;
    }

    jugador.pos.x += jugador.vel.x * dt;
    jugador.pos.z += jugador.vel.z * dt;
    resolverColisiones(jugador.pos, J.radio);
    // No atravesar a los rivales
    for (const e of combate.entidades) {
      if (e === jugador || !e.vivo) continue;
      const ex = jugador.pos.x - e.pos.x, ez = jugador.pos.z - e.pos.z;
      const d = Math.hypot(ex, ez), min = J.radio + e.radio;
      if (d < min && d > 0.001) {
        jugador.pos.x = e.pos.x + (ex / d) * min;
        jugador.pos.z = e.pos.z + (ez / d) * min;
      }
    }

    // Mirar hacia la mira
    const mx = puntoMira.x - jugador.pos.x;
    const mz = puntoMira.z - jugador.pos.z;
    if (Math.hypot(mx, mz) > 0.2) jugador.dir.set(mx, 0, mz).normalize();
    const anguloObjetivo = Math.atan2(jugador.dir.x, jugador.dir.z);
    jugador.malla.rotation.y = suavizarAngulo(jugador.malla.rotation.y, anguloObjetivo, 18 * dt);

    // Animación sencilla de caminar
    const rapidez = Math.hypot(jugador.vel.x, jugador.vel.z);
    jugador.animT += rapidez * dt * 2.2;
    const { cuerpo, pierna1, pierna2, flota } = jugador.malla.userData;
    const paso = rapidez > 0.5 ? Math.sin(jugador.animT) : 0;
    pierna1.position.z = paso * 0.15;
    pierna2.position.z = -paso * 0.15;
    if (!flota) cuerpo.position.y = Math.abs(paso) * 0.06;
    cuerpo.rotation.x = Math.min(0.25, rapidez * 0.025); // se inclina al correr

    jugador.malla.position.copy(jugador.pos);
  }

  function impulso() {
    if (!jugador.vivo) return;
    if (jugador.impulsoCd > 0 || jugador.impulsoT > 0) {
      mostrarPista(`Impulso listo en ${Math.ceil(jugador.impulsoCd)} s`);
      return;
    }
    // Va hacia donde te mueves; si estás quieto, hacia donde miras
    const v = Math.hypot(jugador.vel.x, jugador.vel.z);
    if (v > 0.5) jugador.impulsoDir.set(jugador.vel.x / v, 0, jugador.vel.z / v);
    else jugador.impulsoDir.copy(jugador.dir);
    jugador.impulsoT = J.impulso.duracion;
    jugador.impulsoCd = J.impulso.enfriamiento;
    Sonido.sfx.impulso();
  }

  // Empuja un círculo (jugador o balón) fuera de las cajas, postes y bordes
  function resolverColisiones(pos, radio, vel = null, rebote = 0, altura = 0) {
    for (const o of CONFIG.obstaculos) {
      if (altura - radio > o.h) continue; // va por encima del obstáculo
      const nx = Math.max(o.x - o.w / 2, Math.min(pos.x, o.x + o.w / 2));
      const nz = Math.max(o.z - o.d / 2, Math.min(pos.z, o.z + o.d / 2));
      let dx = pos.x - nx, dz = pos.z - nz;
      let dist = Math.hypot(dx, dz);
      if (dist < radio) {
        if (dist < 0.0001) { dx = pos.x < o.x ? -1 : 1; dz = 0; dist = 1; }
        const ux = dx / dist, uz = dz / dist;
        pos.x = nx + ux * radio;
        pos.z = nz + uz * radio;
        if (vel) {
          const vn = vel.x * ux + vel.z * uz;
          if (vn < 0) { vel.x -= (1 + rebote) * vn * ux; vel.z -= (1 + rebote) * vn * uz; }
        }
      }
    }
    // Postes de los aros
    for (const a of aros) {
      const px = a.signo * (C.mitadLargo - 0.2);
      const dx = pos.x - px, dz = pos.z;
      const dist = Math.hypot(dx, dz);
      const min = radio + 0.2;
      if (dist < min && dist > 0.0001) {
        pos.x = px + (dx / dist) * min;
        pos.z = (dz / dist) * min;
      }
    }
    // Bordes de la cancha
    const lx = C.mitadLargo - radio, lz = C.mitadAncho - radio;
    if (pos.x < -lx) { pos.x = -lx; if (vel && vel.x < 0) vel.x = -vel.x * rebote; }
    if (pos.x > lx)  { pos.x = lx;  if (vel && vel.x > 0) vel.x = -vel.x * rebote; }
    if (pos.z < -lz) { pos.z = -lz; if (vel && vel.z < 0) vel.z = -vel.z * rebote; }
    if (pos.z > lz)  { pos.z = lz;  if (vel && vel.z > 0) vel.z = -vel.z * rebote; }
  }

  // ==========================================================
  // 8. BALÓN: física, recogida y canastas
  // ==========================================================
  function actualizarBalon(dt) {
    balon.tLanzado += dt;
    balon.yAnterior = balon.pos.y;

    if (balon.portador) {
      // Drible automático: el balón rebota al lado del jugador
      const p = balon.portador;
      const ladoX = -p.dir.z, ladoZ = p.dir.x; // costado derecho
      balon.pos.x = p.pos.x + p.dir.x * 0.6 + ladoX * 0.55;
      balon.pos.z = p.pos.z + p.dir.z * 0.6 + ladoZ * 0.55;
      balon.pos.y = B.radio + Math.abs(Math.sin(tiempoTotal * 7)) * 0.75;
      balon.vel.set(0, 0, 0);
    } else {
      fisicaBalon(dt);
    }

    balon.malla.position.copy(balon.pos);
    balon.malla.rotation.x += balon.vel.z * dt * 3;
    balon.malla.rotation.z -= balon.vel.x * dt * 3;

    // Sombra
    sombraBalon.position.x = balon.pos.x;
    sombraBalon.position.z = balon.pos.z;
    const alt = Math.max(0, balon.pos.y - B.radio);
    sombraBalon.material.opacity = Math.max(0.1, 0.45 - alt * 0.06);
    sombraBalon.scale.setScalar(1 + alt * 0.12);
    marcaBalon.visible = !balon.portador;
    marcaBalon.position.x = balon.pos.x;
    marcaBalon.position.z = balon.pos.z;
    marcaBalon.scale.setScalar(1 + Math.sin(tiempoTotal * 6) * 0.15);

    // Balón de fuego: si lo lleva (o lo acaba de lanzar) alguien con ese poder
    const dueño = balon.portador || balon.tiroDe;
    const enLlamas = dueño && dueño.tFuego > 0 && (balon.portador || balon.tLanzado < 2);
    if (enLlamas) lanzarParticulas(balon.pos.x, balon.pos.y + 0.2, balon.pos.z, Math.random() < 0.5 ? 0xff7a1a : 0xffd23f, 1, 1.5, -3, 0.35);

    balon.tPosesion += dt;

    // Recogida automática: lo toma el que esté más cerca (cualquiera de los 6)
    if (!balon.portador && estado === 'jugando' && balon.pos.y < 1.8) {
      let quien = null, mejor = Infinity;
      for (const e of combate.entidades) {
        if (!e.vivo) continue;
        // El que acaba de lanzar no lo puede recoger enseguida
        if (e === balon.tiroDe && balon.tLanzado < B.tiempoSinRecoger) continue;
        const d = Math.hypot(balon.pos.x - e.pos.x, balon.pos.z - e.pos.z);
        // Con el poder Imán se recoge desde más lejos
        if (d < poderes.radioBalon(e, B.radioRecogida) && d < mejor) { mejor = d; quien = e; }
      }
      if (quien) {
        if (balon.tiroActivo) registrarFallo();
        darBalon(quien);
        if (quien === jugador) Sonido.sfx.recoger();
      }
    }
  }

  function darBalon(ent) {
    // Si lo recibe de un pase de un compañero, ese compañero puede ganar una asistencia
    balon.asistente = balon.esPase && balon.tiroDe && balon.tiroDe !== ent && balon.tiroDe.equipo === ent.equipo ? balon.tiroDe : null;
    balon.esPase = false;
    balon.portador = ent;
    balon.tiroActivo = false;
    balon.tPosesion = 0;
    if (ent.esBot) bots.alRecoger(ent);
  }

  function fisicaBalon(dt) {
    const v = balon.vel;
    const xAnt = balon.pos.x, zAnt = balon.pos.z; // posición antes de moverse
    // Movimiento exacto con gravedad (igual a 30 o a 144 FPS)
    balon.pos.x += v.x * dt;
    balon.pos.z += v.z * dt;
    balon.pos.y += v.y * dt - 0.5 * B.gravedad * dt * dt;
    v.y -= B.gravedad * dt;

    // Aros y tableros
    for (const a of aros) {
      // Tablero
      const bordeTablero = C.tableroX - B.radio - 0.05;
      if (Math.abs(balon.pos.z) < 0.9 && balon.pos.y > C.aroAltura - 0.1 && balon.pos.y < C.aroAltura + 1.2) {
        if (a.signo * balon.pos.x > bordeTablero && a.signo * v.x > 0 && a.signo * balon.pos.x < C.tableroX + 0.3) {
          balon.pos.x = a.signo * bordeTablero;
          v.x = -v.x * 0.55;
          Sonido.sfx.tablero();
        }
      }

      // ¿Cruzó la altura del aro bajando?
      if (balon.yAnterior > a.y && balon.pos.y <= a.y && v.y < 0) {
        // Calcula el punto exacto donde cruzó (así funciona aunque el juego vaya lento)
        const f = (balon.yAnterior - a.y) / (balon.yAnterior - balon.pos.y);
        const cx = xAnt + (balon.pos.x - xAnt) * f;
        const cz = zAnt + (balon.pos.z - zAnt) * f;
        const d = Math.hypot(cx - a.x, cz - a.z);
        if (d < T.radioCanasta) {
          anotar(a);
        } else if (d < T.radioAro + B.radio * 0.8) {
          // Rebota en el borde del aro
          const nx = (cx - a.x) / (d || 1);
          const nz = (cz - a.z) / (d || 1);
          balon.pos.x = cx;
          balon.pos.z = cz;
          const vn = v.x * nx + v.z * nz;
          v.x = (v.x - 2 * Math.min(0, vn) * nx) * 0.5 + nx * 1.2;
          v.z = (v.z - 2 * Math.min(0, vn) * nz) * 0.5 + nz * 1.2;
          v.y = Math.abs(v.y) * 0.45;
          balon.pos.y = a.y + 0.01;
          Sonido.sfx.aro();
        }
      }
    }

    // Piso
    if (balon.pos.y < B.radio) {
      balon.pos.y = B.radio;
      if (v.y < -1.5) {
        Sonido.sfx.bote(-v.y);
        v.y = -v.y * B.rebote;
      } else {
        v.y = 0;
      }
      // Si un tiro toca el piso sin entrar, fue un fallo
      if (balon.tiroActivo) registrarFallo();
    }
    // Fricción al rodar
    if (balon.pos.y <= B.radio + 0.01) {
      const f = Math.pow(B.friccionSuelo, dt);
      v.x *= f;
      v.z *= f;
    }

    // Obstáculos (el balón pasa por encima si va alto) y bordes
    resolverColisiones(balon.pos, B.radio, v, 0.6, balon.pos.y);
  }

  function registrarFallo() {
    balon.tiroActivo = false;
    if (balon.tiroDe === jugador) partido.racha = 0;
  }

  // Calcula la velocidad para ir de "desde" a "hasta" en "t" segundos
  function balistica(desde, hasta, t) {
    return new THREE.Vector3(
      (hasta.x - desde.x) / t,
      (hasta.y - desde.y + 0.5 * B.gravedad * t * t) / t,
      (hasta.z - desde.z) / t
    );
  }

  // Decide qué pasaría si lanzas ahora (se usa para tirar y para dibujar la trayectoria).
  // Apuntado manual: el balón va exactamente a la mira, a la altura del aro.
  function planDeTiro() {
    const p = jugador.pos;
    let ax = puntoMira.x - p.x, az = puntoMira.z - p.z;
    let al = Math.hypot(ax, az);
    if (al < 0.01) { ax = jugador.dir.x; az = jugador.dir.z; al = 1; }
    ax /= al; az /= al;

    const d = Math.min(al, T.distanciaMaxLanzamiento);
    const salida = new THREE.Vector3(p.x + ax * 0.6, 2.1, p.z + az * 0.6);
    const objetivo = new THREE.Vector3(p.x + ax * d, C.aroAltura + 0.02, p.z + az * d);

    // ¿La mira está cerca del aro rival? Entonces cuenta como intento de tiro
    const distMiraAro = Math.hypot(objetivo.x - aroRival.x, objetivo.z - aroRival.z);
    const distJugadorAro = Math.hypot(p.x - aroRival.x, p.z - aroRival.z);
    return {
      alAro: distMiraAro < T.radioIntentoTiro,
      salida,
      objetivo,
      tVuelo: T.tiempoBase + d * T.tiempoPorDistancia,
      distancia: distJugadorAro
    };
  }

  // ¿Hay un rival encima? (tirar presionado es menos preciso)
  function bajoPresion(ent) {
    for (const e of combate.entidades) {
      if (e.vivo && e.equipo !== ent.equipo && Math.hypot(e.pos.x - ent.pos.x, e.pos.z - ent.pos.z) < T.distanciaPresion) return true;
    }
    return false;
  }

  // Lanza el balón de "ent" hacia (tx, tz) a la altura del aro, con un error aleatorio
  function lanzarBalonA(ent, tx, tz, error, esTiro) {
    let dx = tx - ent.pos.x, dz = tz - ent.pos.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = ent.dir.x; dz = ent.dir.z; d = 1; }
    const salida = new THREE.Vector3(ent.pos.x + (dx / d) * 0.6, 2.1, ent.pos.z + (dz / d) * 0.6);
    const r = error * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const objetivo = new THREE.Vector3(tx + Math.cos(a) * r, C.aroAltura + 0.02, tz + Math.sin(a) * r);
    const tVuelo = T.tiempoBase + Math.min(d, T.distanciaMaxLanzamiento) * T.tiempoPorDistancia;

    balon.vel.copy(balistica(salida, objetivo, tVuelo));
    balon.pos.copy(salida);
    balon.portador = null;
    balon.tLanzado = 0;
    balon.tiroDe = ent;
    balon.tiroActivo = esTiro;
    balon.origen.set(ent.pos.x, 0, ent.pos.z);
    Personajes.animar(ent.malla, 'tiro', ent.personaje);
    Sonido.sfx.tiro();
  }

  // Tiro del jugador: va a la mira, con un pequeño error natural
  function lanzar() {
    const plan = planDeTiro();
    const rapidez = Math.hypot(jugador.vel.x, jugador.vel.z);
    const error = T.errorBase
      + plan.distancia * T.errorPorDistancia
      + (rapidez > 1.5 ? T.errorEnMovimiento : 0)
      + (bajoPresion(jugador) ? T.errorPresion : 0);
    if (plan.alAro) partido.stats.tiros++;
    lanzarBalonA(jugador, plan.objetivo.x, plan.objetivo.z, error, plan.alAro);
  }

  // Tiro de un bot: apunta al centro del aro con su propio error
  function tirarBot(b, presion) {
    const aro = aroQueAtaca(b);
    const d = Math.hypot(aro.x - b.pos.x, aro.z - b.pos.z);
    const error = b.nivel.errorTiro + d * CONFIG.bots.errorTiroPorDistancia + (presion ? T.errorPresion : 0);
    lanzarBalonA(b, aro.x, aro.z, error, true);
  }

  // Pase: el balón viaja bajito hacia donde va a estar el compañero
  function pasar(ent, receptor) {
    if (balon.portador !== ent || !receptor) return;
    const P = CONFIG.pase;
    let tx = receptor.pos.x, tz = receptor.pos.z;
    const d0 = Math.hypot(tx - ent.pos.x, tz - ent.pos.z);
    const t = Math.max(0.25, Math.min(d0, P.distanciaMax) / P.velocidad);
    if (receptor.vel) { tx += receptor.vel.x * t; tz += receptor.vel.z * t; }
    const salida = new THREE.Vector3(ent.pos.x + ent.dir.x * 0.6, 1.3, ent.pos.z + ent.dir.z * 0.6);
    const objetivo = new THREE.Vector3(tx, 1.0, tz);
    balon.vel.copy(balistica(salida, objetivo, t));
    balon.pos.copy(salida);
    balon.portador = null;
    balon.tLanzado = 0;
    balon.tiroDe = ent;
    balon.tiroActivo = false;
    balon.esPase = true;
    balon.origen.set(ent.pos.x, 0, ent.pos.z);
    Personajes.animar(ent.malla, 'tiro', ent.personaje);
    Sonido.sfx.pase();
  }

  // Robo fijo: si estás cerca del que tiene el balón y lo miras, se lo quitas
  function intentarRobo(ent) {
    const R = CONFIG.robo;
    if (!ent.vivo || ent.cdRobo > 0) return false;
    const p = balon.portador;
    let exito = false;
    if (p && p.equipo !== ent.equipo && balon.tPosesion > R.inmunidad) {
      const dx = p.pos.x - ent.pos.x, dz = p.pos.z - ent.pos.z;
      const d = Math.hypot(dx, dz);
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * ent.dir.x + dz * ent.dir.z) / (d || 1))));
      exito = d < R.alcance && ang < THREE.MathUtils.degToRad(R.angulo);
    }
    if (exito) {
      darBalon(ent);
      ent.cdRobo = R.esperaAcierto;
      combate.cargarSuper(ent, CONFIG.super.porRobo);
      lanzarParticulas(ent.pos.x, 1, ent.pos.z, COL.dorado, 12, 4, 6, 0.5);
      Sonido.sfx.robo();
      if (p === jugador) mostrarPista(`¡${ent.nombre} te robó el balón!`);
      if (ent === jugador) {
        mostrarPista('¡Robo!');
        partido.stats.robos++;
        if (partido.stats.robos >= 3) desbloquear('ladron');
      }
    } else {
      ent.cdRobo = R.esperaFallo;
      if (ent === jugador) { mostrarPista('Robo fallido'); Sonido.sfx.error(); }
    }
    return exito;
  }

  function anotar(aro) {
    balon.tiroActivo = false;
    if (estado !== 'jugando') return;

    // El aro rojo es del equipo rojo: si entra ahí, anota el azul
    const equipoQueAnota = aro.equipo === 'azul' ? 'rojo' : 'azul';
    const distancia = Math.hypot(balon.origen.x - aro.x, balon.origen.z - aro.z);
    let puntos = distancia > C.radioTriple ? 3 : 2;
    // Balón de fuego: +1 punto
    let conFuego = false;
    if (balon.tiroDe && balon.tiroDe.equipo === equipoQueAnota && balon.tiroDe.tFuego > 0) {
      puntos += CONFIG.poderes.tipos.fuego.puntosExtra;
      balon.tiroDe.tFuego = 0;
      conFuego = true;
      if (balon.tiroDe === jugador) desbloquear('fuego');
    }
    partido.marcador[equipoQueAnota] += puntos;
    partido.peorDiferencia = Math.max(partido.peorDiferencia || 0, partido.marcador.rojo - partido.marcador.azul);
    if (balon.asistente === jugador && balon.tiroDe !== jugador && equipoQueAnota === jugador.equipo) {
      partido.stats.asistencias++;
      desbloquear('asistente');
      mostrarPista('¡Asistencia!');
    }
    balon.asistente = null;
    if (balon.tiroDe && balon.tiroDe.equipo === equipoQueAnota) combate.cargarSuper(balon.tiroDe, CONFIG.super.porCanasta);

    // El balón cae por la red
    balon.vel.set(0, -2, 0);
    balon.pos.x = aro.x;
    balon.pos.z = aro.z;

    // Estadísticas y logros del jugador
    if (equipoQueAnota === jugador.equipo && balon.tiroDe === jugador) {
      const s = partido.stats;
      s.canastas++;
      s.puntos += puntos;
      if (distancia > C.radioTriple) s.triples++;
      partido.racha++;
      desbloquear('primera');
      if (distancia > C.radioTriple) desbloquear('triple');
      if (partido.racha >= 5) desbloquear('racha');
      if (s.puntos >= 9) desbloquear('nueve');
    }

    // Celebración
    aro.animRed = 1;
    const color = equipoQueAnota === 'azul' ? COL.azul : COL.rojo;
    lanzarParticulas(aro.x, aro.y, aro.z, color, 40, 7);
    lanzarParticulas(aro.x, aro.y, aro.z, COL.dorado, puntos === 3 ? 30 : 10, 6);
    Sonido.sfx.canasta(puntos === 3);
    const texto = conFuego ? `+${puntos} ¡EN LLAMAS!` : puntos === 3 ? '+3 ¡TRIPLE!' : `+${puntos}`;
    mostrarAviso(texto, equipoQueAnota === 'azul' ? 'Canasta del equipo azul' : 'Canasta del equipo rojo', equipoQueAnota);
    if (conFuego) lanzarParticulas(aro.x, aro.y, aro.z, 0xff7a1a, 40, 8);
    actualizarHUD();

    // Límite de puntos: el primero en llegar gana
    if (partido.marcador[equipoQueAnota] >= CONFIG.partido.puntosParaGanar) {
      finPartido();
      return;
    }
    // En la prórroga, la primera canasta gana
    if (partido.prorroga) {
      finPartido();
      return;
    }
    estado = 'canasta';
    partido.tCanasta = CONFIG.partido.pausaTrasCanasta;
  }

  function reiniciarPosesion() {
    // Tras cada canasta, los 6 vuelven con la vida llena (los eliminados reviven)
    combate.restaurarTodos();
    colocarEnInicio();
    estado = 'jugando';
    Sonido.sfx.silbato();
  }

  // Jugador a su lado y balón cayendo en el centro
  function colocarEnInicio() {
    bots.colocar();
    jugador.pos.set(C.aparicionesAzul[0].x, 0, C.aparicionesAzul[0].z);
    jugador.malla.position.copy(jugador.pos);
    jugador.vel.set(0, 0, 0);
    jugador.impulsoT = 0;
    jugador.dir.set(1, 0, 0);
    jugador.malla.rotation.y = Math.PI / 2;
    balon.portador = null;
    balon.pos.set(0, 4, 0);
    balon.vel.set(0, 0, 0);
    balon.tLanzado = 0;
    balon.tiroActivo = false;
    balon.tiroDe = null;
  }

  function animarAros(dt) {
    for (const a of aros) {
      if (a.animRed > 0) {
        a.animRed = Math.max(0, a.animRed - dt * 2);
        const s = 1 + Math.sin(a.animRed * Math.PI * 4) * 0.15 * a.animRed;
        a.red.scale.set(1 / s, s, 1 / s);
        a.anillo.material.emissiveIntensity = 0.9 + a.animRed * 2;
      }
    }
  }

  // ==========================================================
  // 9. ACCIONES (clic izquierdo / derecho)
  // ==========================================================
  let ultimoAvisoAccion = 0;

  function accionPrincipal() {
    if (!jugador.vivo) return;
    if (balon.portador === jugador) {
      if (estado === 'jugando') lanzar();
    } else {
      // Sin balón: atacar hacia la mira
      combate.atacar(jugador, stats().ataque, puntoMira.x, puntoMira.z);
    }
  }

  function rivalMasCercano(maxDist) {
    let mejor = null, mejorD = maxDist;
    for (const e of combate.entidades) {
      if (!e.vivo || e.equipo === jugador.equipo) continue;
      const d = Math.hypot(e.pos.x - jugador.pos.x, e.pos.z - jugador.pos.z);
      if (d < mejorD) { mejor = e; mejorD = d; }
    }
    return mejor;
  }

  function accionSecundaria() {
    if (!jugador.vivo) return;
    if (balon.portador === jugador) {
      const receptor = elegirReceptor();
      if (receptor) pasar(jugador, receptor);
      else mostrarPista('No hay compañeros para pasar');
    } else {
      // Robar: mira hacia el que tiene el balón si está cerca
      const p = balon.portador;
      if (p && p.equipo !== jugador.equipo) {
        const d = Math.hypot(p.pos.x - jugador.pos.x, p.pos.z - jugador.pos.z);
        if (d < CONFIG.robo.alcance + 0.5) jugador.dir.set(p.pos.x - jugador.pos.x, 0, p.pos.z - jugador.pos.z).normalize();
      }
      if (jugador.cdRobo > 0) { mostrarPista(`Robo listo en ${Math.ceil(jugador.cdRobo)} s`); return; }
      intentarRobo(jugador);
    }
  }

  // Elige a qué compañero pasar: el que esté más cerca de hacia donde apuntas
  function elegirReceptor() {
    let dx = puntoMira.x - jugador.pos.x, dz = puntoMira.z - jugador.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    let mejor = null, mejorPuntos = Infinity;
    for (const e of combate.entidades) {
      if (e === jugador || !e.vivo || e.equipo !== jugador.equipo) continue;
      const ex = e.pos.x - jugador.pos.x, ez = e.pos.z - jugador.pos.z;
      const d = Math.hypot(ex, ez);
      if (d > CONFIG.pase.distanciaMax) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (ex * dx + ez * dz) / (d || 1))));
      const puntos = ang * 3 + d * 0.05;
      if (puntos < mejorPuntos) { mejorPuntos = puntos; mejor = e; }
    }
    return mejor;
  }

  // ==========================================================
  // 10. CÁMARA
  // ==========================================================
  const camMira = new THREE.Vector3();

  function actualizarCamara(dt) {
    const k = 1 - Math.exp(-CONFIG.camara.suavizado * dt);
    // La cámara sigue al jugador y se adelanta un poco hacia donde mira
    const ad = CONFIG.camara.adelanto;
    const tx = (jugador.pos.x + jugador.dir.x * ad) * CONFIG.camara.seguimientoX;
    const tz = (jugador.pos.z + jugador.dir.z * ad) * CONFIG.camara.seguimientoZ;
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (CONFIG.camara.altura - camera.position.y) * k;
    camera.position.z += (tz + CONFIG.camara.distancia - camera.position.z) * k;
    camMira.x += (tx - camMira.x) * k;
    camMira.y += (0 - camMira.y) * k;
    camMira.z += (tz - camMira.z) * k;
    camera.lookAt(camMira);
    // Sacudida (súper de impacto, explosiones grandes)
    if (sacudida > 0.01) {
      camera.position.x += (Math.random() - 0.5) * sacudida;
      camera.position.y += (Math.random() - 0.5) * sacudida;
      sacudida *= Math.pow(0.02, dt);
    }
  }

  let sacudida = 0;
  function sacudirCamara(fuerza) {
    sacudida = Math.max(sacudida, fuerza);
  }

  function camaraMenu() {
    const a = tiempoTotal * 0.08;
    camera.position.set(Math.sin(a) * 28, 15, Math.cos(a) * 22);
    camMira.set(0, 0, 0);
    camera.lookAt(camMira);
  }

  // ==========================================================
  // 11. AYUDAS VISUALES (mira y trayectoria)
  // ==========================================================
  function actualizarAyudasVisuales() {
    const jugando = (estado === 'jugando' || estado === 'canasta') && apuntandoAhora();
    const conBalon = jugando && balon.portador === jugador;
    mira.visible = jugando;
    mira.position.x = puntoMira.x;
    mira.position.z = puntoMira.z;
    // Con el balón la mira flota a la altura del aro (y una línea la une al piso)
    mira.position.y = conBalon ? C.aroAltura + 0.02 : 0.04;
    mira.rotation.z += 0.03;
    guiaMira.visible = conBalon;
    if (conBalon) {
      guiaMira.position.set(puntoMira.x, C.aroAltura / 2, puntoMira.z);
    }

    actualizarIndicadorAtaque();
    actualizarIndicadorSuper();

    trayectoria.visible = conBalon;
    if (!conBalon) return;

    const plan = planDeTiro();
    const v = balistica(plan.salida, plan.objetivo, plan.tVuelo);
    const arr = geoTray.attributes.position.array;
    for (let i = 0; i < PUNTOS_TRAYECTORIA; i++) {
      const t = (i / (PUNTOS_TRAYECTORIA - 1)) * plan.tVuelo * T.trayectoriaVisible;
      arr[i * 3] = plan.salida.x + v.x * t;
      arr[i * 3 + 1] = plan.salida.y + v.y * t - 0.5 * B.gravedad * t * t;
      arr[i * 3 + 2] = plan.salida.z + v.z * t;
    }
    geoTray.attributes.position.needsUpdate = true;
    geoTray.computeBoundingSphere();
    trayectoria.computeLineDistances();

    // Color: dorado = triple, blanco = doble, gris = no vas al aro
    if (!plan.alAro) matTray.color.setHex(0x8888aa);
    else if (plan.distancia > C.radioTriple) matTray.color.setHex(COL.dorado);
    else matTray.color.setHex(0xffffff);
  }

  function actualizarIndicadorSuper() {
    const enPartido = estado === 'jugando' || estado === 'canasta';
    // Anillo dorado bajo el jugador cuando la súper está lista
    anilloSuperListo.visible = enPartido && jugador.vivo && jugador.carga >= 1;
    if (anilloSuperListo.visible) {
      anilloSuperListo.position.set(jugador.pos.x, 0.05, jugador.pos.z);
      anilloSuperListo.scale.setScalar(1 + Math.sin(tiempoTotal * 6) * 0.08);
    }
    superTira.visible = superArea.visible = superCentro.visible = false;
    const apuntando = tactil.activo ? superTactil.id !== null : apuntandoSuperPC;
    if (!enPartido || !jugador.vivo || !apuntando || jugador.carga < 1) return;

    const su = stats().super;
    const objetivo = tactil.activo ? puntoSuperTactil() : { x: puntoMira.x, z: puntoMira.z };
    let dx = objetivo.x - jugador.pos.x, dz = objetivo.z - jugador.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const dist = Math.min(d, su.alcance || 0);
    const angulo = Math.atan2(dx, dz);
    const conTira = (ancho, largo) => {
      superTira.visible = true;
      superTira.position.set(jugador.pos.x, 0.07, jugador.pos.z);
      superTira.rotation.y = angulo;
      superTira.scale.set(ancho, 1, largo);
    };
    const conArea = (x, z, r) => {
      superArea.visible = superCentro.visible = true;
      superArea.position.set(x, 0.08, z);
      superCentro.position.set(x, 0.07, z);
      superArea.scale.setScalar(r);
      superCentro.scale.setScalar(r);
    };
    if (su.tipo === 'rafaga') conTira(2 * Math.tan(THREE.MathUtils.degToRad(su.abanico / 2)) * su.alcance * 0.5 + 0.6, su.alcance);
    else if (su.tipo === 'salto') { conTira(0.15, dist); conArea(jugador.pos.x + dx * dist, jugador.pos.z + dz * dist, su.radio); }
    else if (su.tipo === 'granBomba') { conTira(0.15, dist); conArea(jugador.pos.x + dx * dist, jugador.pos.z + dz * dist, su.radioExplosion); }
    else if (su.tipo === 'lluvia') { conTira(0.15, dist); conArea(jugador.pos.x + dx * dist, jugador.pos.z + dz * dist, su.radio); }
    else if (su.tipo === 'escudo') conArea(jugador.pos.x, jugador.pos.z, su.radio);
    else if (su.tipo === 'turbo') conArea(jugador.pos.x, jugador.pos.z, 1.2);
  }

  function actualizarIndicadorAtaque() {
    const enPartido = estado === 'jugando' || estado === 'canasta';
    const sinBalon = balon.portador !== jugador;
    const ver = enPartido && jugador.vivo && sinBalon && apuntandoAhora();
    indicadorTira.visible = indicadorArea.visible = indicadorSector.visible = false;
    if (!ver) return;

    const a = stats().ataque;
    let dx = puntoMira.x - jugador.pos.x, dz = puntoMira.z - jugador.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist; dz /= dist;
    const angulo = Math.atan2(dx, dz);
    // Más visible en celular mientras apuntas; gris si el ataque aún no está listo
    matIndicador.opacity = tactil.activo ? 0.35 : 0.18;
    matIndicador.color.setHex(jugador.cdAtaque > 0 ? 0x888899 : 0xffffff);

    if (a.tipo === 'golpe') {
      indicadorSector.visible = true;
      indicadorSector.position.set(jugador.pos.x, 0.06, jugador.pos.z);
      indicadorSector.rotation.y = angulo;
    } else if (a.tipo === 'bomba') {
      const d = Math.min(dist, a.alcance);
      indicadorTira.visible = true;
      indicadorTira.position.set(jugador.pos.x, 0.06, jugador.pos.z);
      indicadorTira.rotation.y = angulo;
      indicadorTira.scale.set(0.12, 1, d);
      indicadorArea.visible = true;
      indicadorArea.position.set(jugador.pos.x + dx * d, 0.07, jugador.pos.z + dz * d);
      indicadorArea.scale.setScalar(a.radioExplosion);
    } else {
      indicadorTira.visible = true;
      indicadorTira.position.set(jugador.pos.x, 0.06, jugador.pos.z);
      indicadorTira.rotation.y = angulo;
      indicadorTira.scale.set(Math.max(0.4, a.radio * 2), 1, a.alcance);
    }
  }

  // ==========================================================
  // 12. INTERFAZ (HUD y pantallas)
  // ==========================================================
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'),
    azul: $('marcador-azul'),
    rojo: $('marcador-rojo'),
    reloj: $('reloj'),
    prorroga: $('etiqueta-prorroga'),
    zona: $('zona-tiro'),
    pista: $('pista-accion'),
    barraImpulso: $('barra-impulso-relleno'),
    aviso: $('aviso'),
    avisoTitulo: $('aviso-titulo'),
    avisoSub: $('aviso-sub'),
    logro: $('logro-toast'),
    pistaTemporal: $('pista-temporal'),
    btnImpulso: $('btn-impulso'),
    stickAtaque: $('stick-ataque'),
    girar: $('aviso-girar'),
    cdImpulso: $('cd-impulso'),
    textoImpulso: $('texto-impulso'),
    reaparicion: $('reaparicion'),
    reaparicionNum: $('reaparicion-num'),
    btnPase: $('btn-pase'),
    btnSuper: $('btn-super'),
    barraSuper: $('barra-super-relleno'),
    panelSuper: $('panel-super'),
    textoSuper: $('texto-super'),
    meta: $('meta-puntos'),
    buffs: $('buffs')
  };

  function formatoTiempo(seg) {
    const s = Math.max(0, Math.ceil(seg));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function actualizarHUD() {
    ui.azul.textContent = partido.marcador.azul;
    ui.rojo.textContent = partido.marcador.rojo;
    ui.reloj.textContent = formatoTiempo(partido.tiempo);
    ui.reloj.classList.toggle('urgente', partido.tiempo <= 10);
    ui.prorroga.style.display = partido.prorroga ? 'block' : 'none';
    ui.meta.style.display = partido.prorroga ? 'none' : 'block';

    const conBalon = balon.portador === jugador;
    if (conBalon) {
      const d = Math.hypot(jugador.pos.x - aroRival.x, jugador.pos.z - aroRival.z);
      const triple = d > C.radioTriple;
      ui.zona.textContent = triple ? 'ZONA DE 3' : 'ZONA DE 2';
      ui.zona.className = triple ? 'visible triple' : 'visible';
      ponerPista(tactil.activo
        ? (tactil.apuntar.arrastrado && tactil.apuntar.enCancelar
          ? 'Suelta aquí para <b>cancelar</b>'
          : '<b>Arrastra</b> hacia el aro y <b>suelta</b> · al centro = cancelar')
        : 'Mira <b>dentro del aro</b> · <b>Clic izq</b> Lanzar · <b>Clic der</b> Pasar');
    } else {
      ui.zona.className = '';
      const rivalTiene = balon.portador && balon.portador.equipo !== jugador.equipo;
      const companeroTiene = balon.portador && balon.portador.equipo === jugador.equipo;
      const situacion = rivalTiene ? '¡Defiende! Quítale el balón' : companeroTiene ? 'Ábrete para recibir el pase' : '¡Ve por el balón!';
      ponerPista(tactil.activo
        ? `${situacion} · <b>Stick naranja</b> atacar · <b>ROBO</b>`
        : `${situacion} · <b>Clic izq</b> Atacar · <b>Clic der</b> Robar`);
    }

    // Impulso: barra (PC) y botón con cuenta regresiva (celular)
    const carga = 1 - jugador.impulsoCd / J.impulso.enfriamiento;
    ui.barraImpulso.style.width = `${carga * 100}%`;
    ui.btnImpulso.style.setProperty('--carga', carga);
    ui.btnImpulso.classList.toggle('listo', carga >= 1);
    const seg = jugador.impulsoCd > 0 ? String(Math.ceil(jugador.impulsoCd)) : '';
    if (ui.cdImpulso.textContent !== seg) ui.cdImpulso.textContent = seg;
    const txtImpulso = seg ? `Impulso en ${seg} s` : 'Impulso listo · Espacio';
    if (ui.textoImpulso.textContent !== txtImpulso) ui.textoImpulso.textContent = txtImpulso;
    ui.stickAtaque.classList.toggle('con-balon', conBalon);
    // Súper: barra (PC) y botón que se llena (celular)
    const cargaSuper = Math.min(1, jugador.carga);
    ui.barraSuper.style.width = `${cargaSuper * 100}%`;
    ui.panelSuper.classList.toggle('lista', cargaSuper >= 1);
    const txtSuper = cargaSuper >= 1 ? `¡${stats().super.nombre} lista! · Mantén R` : `Súper ${Math.floor(cargaSuper * 100)} %`;
    if (ui.textoSuper.textContent !== txtSuper) ui.textoSuper.textContent = txtSuper;
    ui.btnSuper.style.setProperty('--carga', cargaSuper);
    ui.btnSuper.classList.toggle('listo', cargaSuper >= 1);
    ui.btnPase.classList.toggle('espera', !conBalon && jugador.cdRobo > 0);

    actualizarBuffs();

    // Cuenta regresiva de reaparición
    const muerto = !jugador.vivo;
    ui.reaparicion.classList.toggle('visible', muerto);
    if (muerto) {
      const t = String(Math.max(1, Math.ceil(jugador.tReaparecer)));
      if (ui.reaparicionNum.textContent !== t) ui.reaparicionNum.textContent = t;
    }
  }

  // Lista de poderes activos del jugador (esquina de la pantalla)
  let buffsActual = '';
  function actualizarBuffs() {
    const T2 = CONFIG.poderes.tipos;
    const activos = [];
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    if (jugador.tPoderTurbo > 0) activos.push([T2.turbo.nombre, jugador.tPoderTurbo, T2.turbo.color]);
    if (jugador.escudo > 0 && jugador.tEscudo > 0) activos.push([`Escudo ${Math.ceil(jugador.escudo)}`, jugador.tEscudo, T2.escudo.color]);
    if (jugador.tFuego > 0) activos.push([T2.fuego.nombre, jugador.tFuego, T2.fuego.color]);
    if (jugador.tIman > 0) activos.push([T2.iman.nombre, jugador.tIman, T2.iman.color]);
    if (jugador.tTurbo > 0) activos.push([stats().super.nombre, jugador.tTurbo, 0x9dff6a]);
    const html = activos.map(([n, t, c]) => `<span class="buff" style="--c:${hex(c)}">${n} <b>${Math.ceil(t)}s</b></span>`).join('');
    if (html !== buffsActual) { buffsActual = html; ui.buffs.innerHTML = html; }
  }

  let pistaActual = '';
  function ponerPista(html) {
    if (html === pistaActual) return;
    pistaActual = html;
    ui.pista.innerHTML = html;
  }

  let timerAviso = null;
  function mostrarAviso(titulo, sub = '', equipo = '') {
    ui.avisoTitulo.textContent = titulo;
    ui.avisoSub.textContent = sub;
    ui.aviso.className = `visible ${equipo}`;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { ui.aviso.className = ''; }, 1600);
  }

  let timerLogro = null;
  function mostrarLogro(nombre) {
    ui.logro.innerHTML = `🏆 Logro desbloqueado<br><b>${nombre}</b>`;
    ui.logro.classList.add('visible');
    clearTimeout(timerLogro);
    timerLogro = setTimeout(() => ui.logro.classList.remove('visible'), 3000);
  }

  let timerPista = null;
  function mostrarPista(texto) {
    ui.pistaTemporal.textContent = texto;
    ui.pistaTemporal.classList.add('visible');
    clearTimeout(timerPista);
    timerPista = setTimeout(() => ui.pistaTemporal.classList.remove('visible'), 1500);
  }

  // Muestra una pantalla y oculta las demás
  function mostrarPantalla(id) {
    document.querySelectorAll('.pantalla').forEach((p) => p.classList.remove('activa'));
    if (id) $(id).classList.add('activa');
  }

  function dibujarLogros() {
    const lista = $('lista-logros');
    lista.innerHTML = '';
    LOGROS.forEach((l) => {
      const ok = !!progreso.logros[l.id];
      const li = document.createElement('li');
      li.className = ok ? 'desbloqueado' : '';
      li.innerHTML = `<span class="icono">${ok ? '🏆' : '🔒'}</span><div><b>${l.nombre}</b><small>${l.desc}</small></div>`;
      lista.appendChild(li);
    });
    $('mejor-puntaje').textContent = progreso.mejorPuntaje || 0;
    const conseguidos = LOGROS.filter((l) => progreso.logros[l.id]).length;
    $('contador-logros').textContent = `${conseguidos} de ${LOGROS.length} conseguidos`;
  }

  // ==========================================================
  // 13. FLUJO DEL PARTIDO
  // ==========================================================
  function iniciarPartido() {
    partido.tiempo = CONFIG.partido.duracion;
    partido.prorroga = false;
    partido.marcador.azul = 0;
    partido.marcador.rojo = 0;
    partido.stats = { tiros: 0, canastas: 0, triples: 0, puntos: 0, eliminaciones: 0, poderes: 0, robos: 0, asistencias: 0 };
    partido.peorDiferencia = 0;
    partido.racha = 0;
    bots.preparar(jugador.personaje);
    combate.reiniciarTodos();
    poderes.reiniciar();
    jugador.impulsoCd = 0;
    jugador.cdRobo = 0;
    colocarEnInicio();
    camera.position.set(0, CONFIG.camara.altura, CONFIG.camara.distancia);
    camMira.set(0, 0, 0);
    // Empieza con la cuenta regresiva 3, 2, 1, ¡YA!
    estado = 'cuenta';
    partido.tCuenta = CONFIG.partido.cuentaRegresiva;
    partido.numeroCuenta = 0;
    partido.ultimoSegundo = 0;
    mostrarPantalla(null);
    ui.hud.classList.add('visible');
    elTactil.classList.add('visible');
    const companeros = bots.lista.filter((b) => b.equipo === 'azul').map((b) => b.nombre).join(' y ');
    partido.infoInicio = `Tus compañeros: ${companeros} · Primero a ${CONFIG.partido.puntosParaGanar}`;
    const reales = CONFIG.bots.jugadoresReales;
    mostrarPista(`${mapa.icono} ${mapa.nombre}: ${mapa.efecto} · rivales nivel ${nombreNivel(reales)}`);
    actualizarHUD();
  }

  function nombreNivel(n) {
    return ['', 'suave', 'medio', 'normal', 'difícil', 'máximo'][Math.max(1, Math.min(5, n))];
  }

  function finTiempo() {
    partido.tiempo = 0;
    if (!partido.prorroga && partido.marcador.azul === partido.marcador.rojo) {
      partido.prorroga = true;
      partido.tiempo = CONFIG.partido.prorroga;
      Sonido.sfx.bocina();
      mostrarAviso('¡PRÓRROGA!', 'La primera canasta gana');
    } else {
      finPartido();
    }
  }

  function finPartido() {
    estado = 'fin';
    Sonido.sfx.bocina();
    const { azul, rojo } = partido.marcador;
    const s = partido.stats;
    let titulo = '¡EMPATE!';
    let clase = '';
    if (azul > rojo) {
      titulo = '¡GANA EL EQUIPO AZUL!';
      clase = 'azul';
      desbloquear('victoria');
      progreso.victorias = (progreso.victorias || 0) + 1;
      guardarProgreso();
      if (progreso.victorias >= 3) desbloquear('tresVictorias');
      if (rojo === 0) desbloquear('invicto');
      if (partido.peorDiferencia >= 4) desbloquear('remontada');
    }
    else if (rojo > azul) { titulo = 'GANA EL EQUIPO ROJO'; clase = 'rojo'; }

    if (s.puntos > (progreso.mejorPuntaje || 0)) {
      progreso.mejorPuntaje = s.puntos;
      guardarProgreso();
    }

    $('fin-titulo').textContent = titulo;
    $('fin-titulo').className = clase;
    $('fin-marcador').innerHTML = `<span class="azul">${azul}</span> - <span class="rojo">${rojo}</span>`;
    $('fin-info').textContent = `${Personajes.info[jugador.personaje].nombre} · ${mapa.icono} ${mapa.nombre} · Victorias totales: ${progreso.victorias || 0}`;
    const precision = s.tiros ? Math.round((s.canastas / s.tiros) * 100) : 0;
    $('fin-stats').innerHTML = `
      <li><span>Puntos</span><b>${s.puntos}</b></li>
      <li><span>Canastas</span><b>${s.canastas}</b></li>
      <li><span>Triples</span><b>${s.triples}</b></li>
      <li><span>Tiros</span><b>${s.tiros}</b></li>
      <li><span>Precisión</span><b>${precision}%</b></li>
      <li><span>Eliminaciones</span><b>${s.eliminaciones}</b></li>
      <li><span>Poderes</span><b>${s.poderes}</b></li>
      <li><span>Robos</span><b>${s.robos}</b></li>
      <li><span>Asistencias</span><b>${s.asistencias}</b></li>
      <li><span>Mejor puntaje</span><b>${progreso.mejorPuntaje || 0}</b></li>`;
    setTimeout(() => {
      ui.hud.classList.remove('visible');
      elTactil.classList.remove('visible');
      mostrarPantalla('pantalla-fin');
    }, 1200);
  }

  function alternarPausa() {
    if (estado === 'jugando' || estado === 'canasta' || estado === 'cuenta') {
      estadoAntesPausa = estado;
      estado = 'pausa';
      mostrarPantalla('pantalla-pausa');
    } else if (estado === 'pausa') {
      estado = estadoAntesPausa;
      mostrarPantalla(null);
      clock.getDelta(); // evita un salto de tiempo al volver
    }
  }

  function alternarMusica() {
    Sonido.iniciar();
    const on = Sonido.alternarMusica();
    document.querySelectorAll('.btn-musica').forEach((b) => { b.textContent = `Música: ${on ? 'SÍ' : 'NO'}`; });
  }

  // ---- Pantalla completa ----
  // Funciona en computador y en Android. En iPhone, Safari no lo permite (el botón se oculta).
  const soportaPantallaCompleta = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (!soportaPantallaCompleta) document.body.classList.add('sin-pantalla-completa');

  function enPantallaCompleta() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function alternarPantallaCompleta() {
    if (!soportaPantallaCompleta) return;
    Sonido.iniciar();
    if (!enPantallaCompleta()) {
      const el = document.documentElement;
      const pedir = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
      Promise.resolve(pedir)
        .then(() => {
          // En Android, ya en pantalla completa, se puede fijar la pantalla en horizontal
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        })
        .catch(() => mostrarPista('Este navegador no deja usar pantalla completa aquí'));
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }

  function actualizarBotonesPantalla() {
    const dentro = enPantallaCompleta();
    document.querySelectorAll('.btn-pantalla-completa').forEach((b) => {
      b.title = dentro ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)';
    });
    document.body.classList.toggle('pantalla-completa', dentro);
  }
  document.addEventListener('fullscreenchange', actualizarBotonesPantalla);
  document.addEventListener('webkitfullscreenchange', actualizarBotonesPantalla);
  botonTactil('btn-pantalla', () => alternarPantallaCompleta());

  function irAlMenu() {
    estado = 'menu';
    ui.hud.classList.remove('visible');
    elTactil.classList.remove('visible');
    mostrarPantalla('pantalla-titulo');
  }

  // ==========================================================
  // 13b. PANTALLA DE ELEGIR PERSONAJE
  // ==========================================================
  let seleccionActual = 'nova';
  let vistaPrevia = null; // se crea la primera vez que se abre

  // Valores máximos para dibujar las barras de estadísticas
  const MAXIMOS = { vida: 5200, velocidad: 8.6, daño: 1200, alcance: 10 };

  function abrirSeleccion() {
    // Si venimos del final de un partido, volvemos al modo menú (si no, la vista previa no se dibuja)
    estado = 'menu';
    ui.hud.classList.remove('visible');
    elTactil.classList.remove('visible');
    seleccionActual = progreso.ultimoPersonaje || personajeId;
    const lista = $('lista-personajes');
    lista.innerHTML = '';
    Personajes.lista.forEach((id) => {
      const inf = Personajes.info[id];
      const b = document.createElement('button');
      b.className = 'tarjeta-personaje';
      b.dataset.id = id;
      b.style.setProperty('--color-pj', inf.color);
      b.innerHTML = `<b>${inf.nombre}</b><small>${inf.rol}</small>`;
      b.addEventListener('click', () => { Sonido.sfx.elegir(); elegir(id); });
      lista.appendChild(b);
    });
    mostrarPantalla('pantalla-personajes');
    if (!vistaPrevia) vistaPrevia = crearVistaPrevia($('vista-previa'));
    vistaPrevia.ajustar();
    elegir(seleccionActual);
  }

  function elegir(id) {
    seleccionActual = id;
    document.querySelectorAll('.tarjeta-personaje').forEach((b) => b.classList.toggle('activa', b.dataset.id === id));
    const inf = Personajes.info[id];
    const st = CONFIG.personajes[id];
    $('pj-nombre').textContent = inf.nombre;
    $('pj-nombre').style.color = inf.color;
    $('pj-rol').textContent = inf.rol;
    $('pj-desc').textContent = inf.desc;
    $('pj-super-nombre').textContent = `Súper: ${st.super.nombre}.`;
    $('pj-super-desc').textContent = inf.superDesc;
    const dañoTotal = st.ataque.daño * (st.ataque.cantidad || 1);
    const filas = [
      ['Vida', st.vida, st.vida / MAXIMOS.vida],
      ['Velocidad', st.velocidad, st.velocidad / MAXIMOS.velocidad],
      ['Daño', dañoTotal, dañoTotal / MAXIMOS.daño],
      ['Alcance', st.ataque.alcance, st.ataque.alcance / MAXIMOS.alcance]
    ];
    $('pj-stats').innerHTML = filas.map(([n, v, f]) =>
      `<li><span>${n}</span><div class="barra-stat"><i style="width:${Math.min(100, f * 100)}%"></i></div><b>${v}</b></li>`).join('');
    vistaPrevia.mostrar(id);
  }

  // Un pequeño visor 3D que muestra al personaje girando
  function crearVistaPrevia(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const esc = new THREE.Scene();
    esc.add(new THREE.HemisphereLight(0xb8c4ff, 0x2a0033, 0.9));
    const luz = new THREE.DirectionalLight(0xffffff, 0.9);
    luz.position.set(3, 5, 4);
    esc.add(luz);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 0.15, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a1f5c, flatShading: true })
    );
    base.position.y = -0.08;
    esc.add(base);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    cam.position.set(0, 1.7, 5.2);
    cam.lookAt(0, 1, 0);
    let modelo = null;
    let idActual = null;
    let tAnterior = 0;
    let tSiguiente = 1;
    let contador = 0;
    return {
      ajustar() {
        const w = canvas.clientWidth || 200, h = canvas.clientHeight || 200;
        r.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      },
      mostrar(id) {
        if (modelo) esc.remove(modelo);
        modelo = Personajes.crearModelo(id, COL.azul);
        idActual = id;
        esc.add(modelo);
        tSiguiente = 0.4; // al elegirlo, enseguida muestra su ataque
        contador = 0;
      },
      dibujar(t) {
        if (!modelo) return;
        const dt = Math.min(0.05, Math.max(0, t - tAnterior));
        tAnterior = t;
        // Gira despacio, pero se queda de frente mientras ataca para que se vea bien
        if (!modelo.userData.anim) modelo.rotation.y += dt * 0.8;
        const anim = modelo.userData.animar;
        if (anim) anim(t);
        // Cada 2 segundos muestra su ataque (y cada tercera vez, su súper)
        tSiguiente -= dt;
        if (tSiguiente <= 0) {
          contador++;
          modelo.rotation.y = 0.5;
          Personajes.animar(modelo, contador % 3 === 0 ? 'super' : 'ataque', idActual);
          tSiguiente = 2;
        }
        Personajes.actualizarAnim(modelo, dt);
        r.render(esc, cam);
      }
    };
  }

  // ==========================================================
  // 13c. PANTALLA DE ELEGIR MAPA
  // ==========================================================
  let seleccionMapa = 'estacion';

  function abrirMapas() {
    seleccionMapa = progreso.ultimoMapa || 'estacion';
    const lista = $('lista-mapas');
    lista.innerHTML = '';
    [...CONFIG.mapas.orden, 'azar'].forEach((id) => {
      const m = CONFIG.mapas[id];
      const b = document.createElement('button');
      b.className = 'tarjeta-mapa';
      b.dataset.id = id;
      const nombre = id === 'azar' ? '🎲 Al azar' : `${m.icono} ${m.nombre}`;
      const efecto = id === 'azar' ? 'Un mapa sorpresa en cada partido.' : m.efecto;
      b.innerHTML = `<canvas width="180" height="108"></canvas><b>${nombre}</b><small>${efecto}</small>`;
      dibujarMiniMapa(b.querySelector('canvas'), id);
      b.addEventListener('click', () => { Sonido.sfx.elegir(); elegirMapa(id); });
      lista.appendChild(b);
    });
    mostrarPantalla('pantalla-mapas');
    elegirMapa(seleccionMapa);
  }

  function elegirMapa(id) {
    seleccionMapa = id;
    document.querySelectorAll('.tarjeta-mapa').forEach((b) => b.classList.toggle('activa', b.dataset.id === id));
    // De fondo se ve el mapa elegido
    if (id !== 'azar' && mapa !== CONFIG.mapas[id]) cambiarMapa(id);
  }

  function prepararMapaYJugar() {
    const elegido = progreso.ultimoMapa || 'estacion';
    const orden = CONFIG.mapas.orden;
    const id = elegido === 'azar' ? orden[Math.floor(Math.random() * orden.length)] : elegido;
    cambiarMapa(id);
    // Logro: jugar en todos los mapas
    progreso.mapasJugados = progreso.mapasJugados || {};
    progreso.mapasJugados[id] = true;
    guardarProgreso();
    if (orden.every((m) => progreso.mapasJugados[m])) desbloquear('turista');
    iniciarPartido();
  }

  // Dibuja un plano pequeño del mapa (vista desde arriba)
  function dibujarMiniMapa(cv, id) {
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    if (id === 'azar') {
      const gr = g.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, '#2f8bff'); gr.addColorStop(1, '#c77dff');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = 'bold 64px Orbitron, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', W / 2, H / 2 + 4);
      return;
    }
    const m = CONFIG.mapas[id];
    const sx = W / (C.mitadLargo * 2), sz = H / (C.mitadAncho * 2);
    const px = (x) => (x + C.mitadLargo) * sx, pz = (z) => (z + C.mitadAncho) * sz;
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, m.colores.izq); gr.addColorStop(0.5, m.colores.centro); gr.addColorStop(1, m.colores.der);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 2 * sx, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffd23f';
    g.beginPath(); g.arc(px(-C.aroX), H / 2, C.radioTriple * sx, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.beginPath(); g.arc(px(C.aroX), H / 2, C.radioTriple * sx, Math.PI / 2, Math.PI * 1.5); g.stroke();
    // Lava
    g.fillStyle = '#ff6a00';
    (m.lava || []).forEach((l) => g.fillRect(px(l.x - l.w / 2), pz(l.z - l.d / 2), l.w * sx, l.d * sz));
    // Obstáculos
    const colorObs = { caja: '#ff7b3a', barrera: '#8a6cff', roca: '#b8bdd6', cristal: '#bff4ff', basalto: '#5a3a3a' };
    m.obstaculos.forEach((o) => {
      g.fillStyle = colorObs[o.tipo] || '#ccc';
      g.fillRect(px(o.x - o.w / 2), pz(o.z - o.d / 2), o.w * sx, o.d * sz);
    });
    // Aros
    g.fillStyle = '#2f8bff'; g.beginPath(); g.arc(px(-C.aroX), H / 2, 3.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff3b5c'; g.beginPath(); g.arc(px(C.aroX), H / 2, 3.5, 0, Math.PI * 2); g.fill();
  }

  // ==========================================================
  // 13d. AJUSTES (volumen y calidad gráfica, se guardan en el navegador)
  // ==========================================================
  let ajustesDesde = 'pantalla-titulo';
  const ajustes = Object.assign({
    musica: Math.round(CONFIG.audio.volumenMusica * 100),
    efectos: Math.round(CONFIG.audio.volumenEfectos * 100),
    calidad: tactil.activo ? 'baja' : 'alta' // en celular empieza en baja para ir más fluido
  }, progreso.ajustes || {});

  function aplicarAjustes() {
    Sonido.volumenMusica(ajustes.musica / 100);
    Sonido.volumenEfectos(ajustes.efectos / 100);
    const alta = ajustes.calidad === 'alta';
    renderer.setPixelRatio(alta ? Math.min(window.devicePixelRatio, CONFIG.graficos.maxPixelRatio) : 1);
    renderer.shadowMap.enabled = alta && CONFIG.graficos.sombras;
    sol.castShadow = alta && CONFIG.graficos.sombras;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    $('aj-musica').value = ajustes.musica;
    $('aj-efectos').value = ajustes.efectos;
    $('aj-alta').classList.toggle('activa', alta);
    $('aj-baja').classList.toggle('activa', !alta);
  }

  function guardarAjustes() {
    progreso.ajustes = { ...ajustes };
    guardarProgreso();
  }

  function abrirAjustes(desde) {
    ajustesDesde = desde;
    aplicarAjustes();
    mostrarPantalla('pantalla-ajustes');
  }

  $('aj-musica').addEventListener('input', (e) => { ajustes.musica = Number(e.target.value); aplicarAjustes(); guardarAjustes(); });
  $('aj-efectos').addEventListener('input', (e) => { ajustes.efectos = Number(e.target.value); aplicarAjustes(); guardarAjustes(); });
  $('aj-efectos').addEventListener('change', () => Sonido.sfx.recoger());
  $('aj-alta').addEventListener('click', () => { ajustes.calidad = 'alta'; aplicarAjustes(); guardarAjustes(); Sonido.sfx.click(); });
  $('aj-baja').addEventListener('click', () => { ajustes.calidad = 'baja'; aplicarAjustes(); guardarAjustes(); Sonido.sfx.click(); });
  aplicarAjustes();

  // Botones del HTML (usan data-accion="...")
  document.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Sonido.iniciar();
      Sonido.iniciarMusica();
      Sonido.sfx.click();
      switch (btn.dataset.accion) {
        case 'jugar': abrirSeleccion(); break;
        case 'confirmar-personaje': aplicarPersonaje(seleccionActual); abrirMapas(); break;
        case 'volver-personajes': abrirSeleccion(); break;
        case 'confirmar-mapa':
          progreso.ultimoMapa = seleccionMapa;
          guardarProgreso();
          prepararMapaYJugar();
          break;
        case 'cambiar-personaje': abrirSeleccion(); break;
        case 'controles': mostrarPantalla('pantalla-controles'); break;
        case 'logros': dibujarLogros(); mostrarPantalla('pantalla-logros'); break;
        case 'creditos': mostrarPantalla('pantalla-creditos'); break;
        case 'volver': mostrarPantalla('pantalla-titulo'); break;
        case 'reanudar': alternarPausa(); break;
        case 'musica': alternarMusica(); break;
        case 'pantalla-completa': alternarPantallaCompleta(); break;
        case 'ajustes': abrirAjustes(estado === 'pausa' ? 'pantalla-pausa' : 'pantalla-titulo'); break;
        case 'volver-ajustes': mostrarPantalla(ajustesDesde); break;
        case 'abandonar': irAlMenu(); break;
        case 'otra-vez': prepararMapaYJugar(); break;
        case 'menu': irAlMenu(); break;
      }
    });
  });

  $('version').textContent = CONFIG.version;
  $('meta-puntos').textContent = `PRIMERO A ${CONFIG.partido.puntosParaGanar}`;

  // ==========================================================
  // 14. BUCLE PRINCIPAL
  // ==========================================================
  const clock = new THREE.Clock();

  function animarFondo(dt) {
    for (const f of flotantes) {
      f.obj.rotation.y += f.rot * dt;
      f.obj.rotation.x += f.rot * dt * 0.5;
      if (f.baseY !== undefined) f.obj.position.y = f.baseY + Math.sin(tiempoTotal * 0.5 + f.fase) * 0.8;
    }
  }

  function bucle() {
    requestAnimationFrame(bucle);
    const dt = Math.min(clock.getDelta(), 0.05); // máximo 50 ms para evitar saltos
    tiempoTotal += dt;

    animarFondo(dt);

    // En celular vertical se pide girar la pantalla (y el partido espera)
    // En celular el juego solo funciona en horizontal (menús incluidos)
    const vertical = tactil.activo && window.innerHeight > window.innerWidth;
    const enPartido = estado === 'jugando' || estado === 'canasta' || estado === 'cuenta';
    ui.girar.classList.toggle('visible', vertical);
    if (enPartido !== document.body.classList.contains('en-partido')) {
      document.body.classList.toggle('en-partido', enPartido); // oculta el botón de la esquina al jugar
    }

    if (enPartido && !vertical) {
      if (estado === 'cuenta') {
        // 3, 2, 1, ¡YA!
        partido.tCuenta -= dt;
        const n = Math.ceil(partido.tCuenta);
        if (n > 0 && n !== partido.numeroCuenta) {
          partido.numeroCuenta = n;
          mostrarAviso(String(n), partido.infoInicio, 'azul');
          Sonido.sfx.tic();
        }
        if (partido.tCuenta <= 0) {
          estado = 'jugando';
          mostrarAviso('¡YA!', partido.infoInicio);
          Sonido.sfx.silbato();
        }
      } else if (estado === 'jugando') {
        partido.tiempo -= dt;
        // "Tic" en los últimos 5 segundos
        const seg = Math.ceil(partido.tiempo);
        if (seg !== partido.ultimoSegundo) {
          partido.ultimoSegundo = seg;
          if (seg <= 5 && seg > 0) Sonido.sfx.tic();
        }
        if (partido.tiempo <= 0) finTiempo();
      } else {
        partido.tCanasta -= dt;
        if (partido.tCanasta <= 0) reiniciarPosesion();
      }
      actualizarApuntado();
      if (estado !== 'cuenta') moverJugador(dt);
      bots.actualizar(dt, estado === 'jugando');
      combate.actualizar(dt);
      actualizarLava(dt);
      poderes.actualizar(dt, estado === 'jugando', tiempoTotal);
      actualizarBalon(dt);
      animarAros(dt);
      actualizarCamara(dt);
      actualizarAyudasVisuales();
      actualizarHUD();
    } else if (estado === 'menu') {
      camaraMenu();
      actualizarAyudasVisuales();
    } else if (estado === 'fin') {
      bots.actualizar(dt, false);
      actualizarBalon(dt);
      animarAros(dt);
    }

    // Vista previa 3D en la pantalla de elegir personaje
    if (vistaPrevia && $('pantalla-personajes').classList.contains('activa')) vistaPrevia.dibujar(tiempoTotal);

    if (estado !== 'pausa') actualizarParticulas(dt);
    combate.actualizarBarras((enPartido || estado === 'pausa') && !vertical);
    renderer.render(scene, camera);
  }

  // Mapa del menú: el último elegido (si era "al azar", la estación)
  if (progreso.ultimoMapa && CONFIG.mapas[progreso.ultimoMapa] && progreso.ultimoMapa !== 'azar') cambiarMapa(progreso.ultimoMapa);

  // Personaje inicial: el último que usaste (y los bots con los demás)
  aplicarPersonaje(Personajes.lista.includes(progreso.ultimoPersonaje) ? progreso.ultimoPersonaje : 'nova');
  bots.preparar(jugador.personaje);

  // En el menú, el balón descansa en el centro
  colocarEnInicio();
  jugador.malla.position.copy(jugador.pos);
  balon.pos.set(0, B.radio, 0);
  balon.malla.position.copy(balon.pos);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (vistaPrevia) vistaPrevia.ajustar();
  });

  // ---- Utilidades ----
  function suavizarAngulo(actual, objetivo, k) {
    let diff = objetivo - actual;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return actual + diff * Math.min(1, k);
  }

  bucle();
})();
