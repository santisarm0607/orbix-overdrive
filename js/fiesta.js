/* ==========================================================
   ORBIX: OVERDRIVE — fiesta.js
   MODO FIESTA: una sola pantalla (TV o computador) y los
   celulares son los controles.

   - La pantalla abre una sala con un código y un QR.
   - Cada celular entra (control.html), elige equipo y personaje.
   - En el partido, cada persona es un personaje "remoto":
     el celular manda el stick y los botones, la pantalla
     mueve al personaje y le devuelve su vida y su súper.
   ========================================================== */

function crearFiesta(ctx) {
  const { scene, combate, balon, aros, poderes } = ctx;
  const R = CONFIG.red;
  const F = CONFIG.fiesta;
  const C = CONFIG.cancha;
  const J = CONFIG.jugador;
  const T = CONFIG.tiro;
  const TC = CONFIG.tactil;
  const COL = CONFIG.colores;
  const $ = (id) => document.getElementById(id);

  // ==========================================================
  // 1. ESTADO DE LA SALA
  // ==========================================================
  // jugadores: id de conexión → datos de la persona
  const jugadores = new Map();
  let ordenLlegada = 0;
  const sala = { mapa: 'estacion', bots: true, cuenta: null, motivo: '' };
  let fase = 'cerrada';        // 'cerrada' | 'sala' | 'juego' | 'fin'
  // Las esperas de la sala usan el reloj real (no se frenan si el juego va lento)
  let finCuenta = 0;           // momento en que termina la cuenta regresiva de la sala
  let finVolver = 0;           // momento de volver a la sala tras el partido
  const ahora = () => performance.now() / 1000;
  let tEnvio = 0;
  let humanos = [];            // personajes de las personas durante el partido

  const lista = () => [...jugadores.values()].sort((a, b) => a.num - b.num);
  const conectados = () => lista().filter((j) => j.conectado);

  function numeroLibre() {
    for (let n = 1; n <= R.maxJugadores; n++) {
      if (![...jugadores.values()].some((j) => j.num === n)) return n;
    }
    return 0;
  }

  // El líder es el que llegó primero (elige mapa y bots desde su celular)
  function lider() {
    let l = null;
    for (const j of jugadores.values()) if (j.conectado && (!l || j.orden < l.orden)) l = j;
    return l;
  }

  // ==========================================================
  // 2. ABRIR Y CERRAR LA SALA
  // ==========================================================
  function abrir() {
    fase = 'sala';
    sala.cuenta = null;
    $('fiesta-codigo').textContent = '····';
    $('fiesta-qr').innerHTML = '';
    $('fiesta-url').textContent = '';
    estadoRed('Abriendo la sala…');
    dibujarSala();
    // En la versión de una sola página (artefacto) no se permiten conexiones
    if (CONFIG.red.enlaceFiesta) {
      $('fiesta-qr').textContent = '📱';
      estadoRed(`Aquí no se puede conectar. Abre el juego en ${CONFIG.red.enlaceFiesta} para jugar el Modo Fiesta.`, true);
      return;
    }
    if (typeof Peer === 'undefined') {
      estadoRed('No se pudo cargar la conexión (PeerJS). Revisa el internet y recarga.', true);
      return;
    }
    if (Red.abierta) { mostrarCodigo(Red.codigo); return; }
    Red.abrirSala(mostrarCodigo, (texto) => estadoRed(texto, true));
  }

  function mostrarCodigo(codigo) {
    const url = new URL('control.html', location.href);
    url.hash = codigo;
    $('fiesta-codigo').textContent = codigo;
    $('fiesta-url').textContent = url.href.replace(/^https?:\/\//, '');
    $('fiesta-qr').innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode($('fiesta-qr'), { text: url.href, width: 200, height: 200, colorDark: '#0b0820', colorLight: '#ffffff' });
    } else {
      $('fiesta-qr').textContent = 'Escribe la dirección de abajo en el celular';
    }
    // En una página sin dirección pública (archivo local) los celulares no pueden entrar
    if (location.protocol === 'file:') estadoRed('Abre el juego con Live Server o desde GitHub Pages para que los celulares puedan entrar.', true);
    else if (/^(localhost|127\.)/.test(location.hostname)) estadoRed('Ojo: en el celular cambia "localhost" por la IP de este computador.', true);
    else estadoRed('Escanea el código con la cámara del celular');
  }

  function estadoRed(texto, error = false) {
    const el = $('fiesta-estado');
    el.textContent = texto;
    el.classList.toggle('error', error);
  }

  // Salir del Modo Fiesta (vuelve al menú normal)
  function cerrar() {
    quitarHumanos();
    jugadores.clear();
    Red.cerrar();
    fase = 'cerrada';
  }

  // ==========================================================
  // 3. MENSAJES DE LOS CELULARES
  // ==========================================================
  Red.on('mensaje', (id, m) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hola') return hola(id, m);
    const j = jugadores.get(id);
    if (!j) return;
    j.visto = ahora();
    if (!j.conectado) { j.conectado = true; cambioSala(); } // volvió la señal
    switch (m.t) {
      case 'elegir': elegir(j, m); break;
      case 'listo':
        if (fase !== 'sala') break;
        j.listo = !!m.v && !!j.equipo && !!j.personaje;
        cambioSala();
        break;
      case 'config':
        if (fase !== 'sala' || lider() !== j) break;
        if (m.mapa && (CONFIG.mapas[m.mapa] || m.mapa === 'azar')) sala.mapa = m.mapa;
        if (typeof m.bots === 'boolean') sala.bots = m.bots;
        cambioSala();
        break;
      case 'in':
        j.input.mx = clamp(+m.mx || 0);
        j.input.mz = clamp(+m.mz || 0);
        j.input.ap = m.ap || null;
        j.input.sp = m.sp || null;
        j.input.t = performance.now();
        break;
      case 'accion':
        if (j.ent) accion(j, m);
        break;
    }
  });

  Red.on('desconectado', (id) => {
    const j = jugadores.get(id);
    if (!j) return;
    if (fase === 'sala') {
      jugadores.delete(id);
    } else {
      // En pleno partido se guarda su lugar por si vuelve a entrar
      j.conectado = false;
      j.input.mx = j.input.mz = 0;
      j.input.ap = j.input.sp = null;
    }
    cambioSala();
  });

  function hola(id, m) {
    const nombre = String(m.nombre || 'Jugador').slice(0, 10);
    const dispositivo = String(m.dispositivo || id);
    // ¿Es alguien que ya estaba y se le cayó la conexión?
    let j = [...jugadores.values()].find((x) => x.dispositivo === dispositivo);
    if (j) {
      jugadores.delete(j.id);
      j.id = id;
      j.conectado = true;
      j.nombre = nombre;
    } else {
      const num = numeroLibre();
      if (!num) { Red.enviar(id, { t: 'llena' }); return; }
      j = {
        id, num, nombre, dispositivo, orden: ordenLlegada++,
        equipo: null, personaje: null, listo: false, conectado: true,
        ent: null, input: { mx: 0, mz: 0, ap: null, sp: null, t: 0 }
      };
      // Le sugerimos el equipo con menos personas
      const az = lista().filter((x) => x.equipo === 'azul').length;
      const ro = lista().filter((x) => x.equipo === 'rojo').length;
      j.equipo = az <= ro ? 'azul' : 'rojo';
      if (lista().filter((x) => x.equipo === j.equipo).length >= 3) j.equipo = null;
    }
    j.visto = ahora();
    jugadores.set(id, j);
    Red.enviar(id, { t: 'bienvenido', num: j.num, lider: lider() === j, equipo: j.equipo, personaje: j.personaje, listo: j.listo });
    if (fase === 'juego' && j.ent) {
      Red.enviar(id, { t: 'fase', f: 'juego' });
    } else if (fase === 'juego' || fase === 'fin') {
      j.listo = false;
    }
    Sonido.sfx.recoger();
    cambioSala();
  }

  function elegir(j, m) {
    if (fase !== 'sala') return;
    if (m.equipo === 'azul' || m.equipo === 'rojo') {
      const llenos = lista().filter((x) => x !== j && x.equipo === m.equipo).length >= 3;
      if (!llenos) j.equipo = m.equipo;
      j.listo = false;
    }
    if (m.personaje && CONFIG.personajes[m.personaje]) {
      const tomado = lista().some((x) => x !== j && x.personaje === m.personaje);
      if (!tomado) j.personaje = m.personaje;
      j.listo = false;
    }
    cambioSala();
  }

  const clamp = (v) => Math.max(-1, Math.min(1, v));

  // ==========================================================
  // 4. SALA: quién está, si se puede empezar y cuenta regresiva
  // ==========================================================
  // Revisa si el partido puede empezar. Devuelve el motivo si no.
  function revisar(exigirListos) {
    const js = conectados();
    if (!js.length) return 'Esperando jugadores…';
    const sinElegir = js.filter((j) => !j.equipo || !j.personaje);
    if (sinElegir.length) return `${sinElegir.map((j) => j.nombre).join(', ')}: falta elegir equipo o personaje`;
    if (!sala.bots) {
      const az = js.some((j) => j.equipo === 'azul'), ro = js.some((j) => j.equipo === 'rojo');
      if (!az || !ro) return 'Sin bots, cada equipo necesita al menos una persona';
    }
    if (exigirListos) {
      const faltan = js.filter((j) => !j.listo);
      if (faltan.length) return `Esperando a: ${faltan.map((j) => j.nombre).join(', ')}`;
    }
    return '';
  }

  function cambioSala() {
    if (fase === 'sala') {
      const motivo = revisar(true);
      sala.motivo = motivo;
      if (motivo) {
        sala.cuenta = null;
      } else if (sala.cuenta == null) {
        finCuenta = ahora() + F.cuentaInicio;
        sala.cuenta = F.cuentaInicio;
        Sonido.sfx.tic();
      }
    }
    dibujarSala();
    enviarSala();
  }

  function enviarSala() {
    const l = lider();
    Red.enviarATodos({
      t: 'sala',
      jugadores: lista().filter((j) => j.conectado).map((j) => ({
        num: j.num, nombre: j.nombre, equipo: j.equipo, personaje: j.personaje, listo: j.listo, lider: j === l
      })),
      mapa: sala.mapa,
      bots: sala.bots,
      cuenta: sala.cuenta,
      motivo: fase === 'juego' ? 'Hay un partido en curso. Entras en el próximo.' : sala.motivo
    });
  }

  // Dibuja la sala en la pantalla grande
  function dibujarSala() {
    const l = lider();
    ['azul', 'rojo'].forEach((eq) => {
      const cont = $(`fiesta-${eq}`);
      const js = conectados().filter((j) => j.equipo === eq);
      let html = '';
      for (let i = 0; i < 3; i++) {
        const j = js[i];
        if (j) {
          const inf = j.personaje ? Personajes.info[j.personaje] : null;
          html += `<li class="ocupado${j.listo ? ' listo' : ''}" style="--c:${inf ? inf.color : '#888'}">
            <span class="num">P${j.num}</span>
            <span class="quien"><b>${escapar(j.nombre)}${j === l ? ' 👑' : ''}</b><small>${inf ? inf.nombre : 'eligiendo…'}</small></span>
            <span class="marca">${j.listo ? '✔' : '…'}</span></li>`;
        } else {
          html += `<li class="vacio">${sala.bots ? '🤖 Bot' : 'Libre'}</li>`;
        }
      }
      cont.innerHTML = html;
    });
    const sinEquipo = conectados().filter((j) => !j.equipo);
    $('fiesta-sin-equipo').textContent = sinEquipo.length ? `Eligiendo equipo: ${sinEquipo.map((j) => j.nombre).join(', ')}` : '';
    $('fiesta-mapa').value = sala.mapa;
    $('fiesta-bots-si').classList.toggle('activa', sala.bots);
    $('fiesta-bots-no').classList.toggle('activa', !sala.bots);
    const msg = sala.cuenta != null ? `¡Empieza en ${sala.cuenta}!` : sala.motivo || '';
    $('fiesta-msg').textContent = msg;
    $('fiesta-msg').classList.toggle('cuenta', sala.cuenta != null);
    $('fiesta-empezar').disabled = !!revisar(false);
  }

  const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Ajustes desde la pantalla (además del celular del líder)
  function cambiarAjuste(cambio) {
    if (fase !== 'sala') return;
    Object.assign(sala, cambio);
    cambioSala();
  }

  // ==========================================================
  // 5. EMPEZAR Y TERMINAR EL PARTIDO
  // ==========================================================
  function empezar() {
    if (fase !== 'sala' || revisar(false)) return;
    const js = conectados().filter((j) => j.equipo && j.personaje);
    // Los que no estaban listos igual juegan (la pantalla dio la orden)
    fase = 'juego';
    sala.cuenta = null;
    quitarHumanos();
    // Cada persona en un lugar de su equipo
    const usados = { azul: 0, rojo: 0 };
    humanos = js.map((j) => crearHumano(j, usados[j.equipo]++));
    const orden = CONFIG.mapas.orden;
    const mapaId = sala.mapa === 'azar' ? orden[Math.floor(Math.random() * orden.length)] : sala.mapa;
    ctx.iniciar({
      mapaId,
      ocupados: js.map((j) => ({ personaje: j.personaje, equipo: j.equipo })),
      rellenar: sala.bots,
      personas: js.length
    });
    Red.enviarATodos({ t: 'fase', f: 'juego' });
    enviarSala(); // los que no juegan ven "partido en curso"
  }

  // La llama game.js cuando el partido termina
  function alTerminar(ganador) {
    fase = 'fin';
    finVolver = ahora() + F.volverSala;
    const p = ctx.partido;
    const tabla = combate.entidades
      .filter((e) => e.esRemoto)
      .map((e) => ({ num: e.jugadorFiesta.num, nombre: e.jugadorFiesta.nombre, equipo: e.equipo, personaje: e.personaje, puntos: e.puntos || 0, elims: e.eliminaciones || 0 }))
      .sort((a, b) => b.puntos - a.puntos || b.elims - a.elims);
    Red.enviarATodos({ t: 'fin', ganador, az: p.marcador.azul, ro: p.marcador.rojo, tabla });
    return tabla;
  }

  function volverASala() {
    quitarHumanos();
    // Los que se fueron durante el partido ya no cuentan
    for (const [id, j] of jugadores) if (!j.conectado) jugadores.delete(id);
    jugadores.forEach((j) => { j.listo = false; j.ent = null; });
    fase = 'sala';
    sala.cuenta = null;
    Red.enviarATodos({ t: 'fase', f: 'sala' });
    ctx.mostrarSala();
    cambioSala();
  }

  // ==========================================================
  // 6. PERSONAJES DE LAS PERSONAS
  // ==========================================================
  // Anillos de colores para reconocer a cada persona (P1, P2…)
  const COLORES_P = [0x7af0ff, 0xffd23f, 0x9dff6a, 0xff8ad8, 0xff9b42, 0xc77dff];

  function crearHumano(j, lugar) {
    const s = CONFIG.personajes[j.personaje];
    const aparicion = (j.equipo === 'azul' ? C.aparicionesAzul : C.aparicionesRojo)[lugar];
    const h = {
      esHumano: true,
      esRemoto: true,
      jugadorFiesta: j,
      personaje: j.personaje,
      equipo: j.equipo,
      malla: Personajes.crearModelo(j.personaje, j.equipo === 'azul' ? COL.azul : COL.rojo),
      pos: new THREE.Vector3(aparicion.x, 0, aparicion.z),
      vel: new THREE.Vector3(),
      dir: new THREE.Vector3(j.equipo === 'azul' ? 1 : -1, 0, 0),
      impulsoT: 0,
      impulsoCd: 0,
      impulsoDir: new THREE.Vector3(),
      cdRobo: 0,
      animT: 0,
      tVibrar: 0
    };
    scene.add(h.malla);
    combate.registrar(h, { vida: s.vida, radio: J.radio, aparicion, nombre: `P${j.num} ${j.nombre}` });

    // Anillo de color bajo los pies
    const color = COLORES_P[(j.num - 1) % COLORES_P.length];
    h.anillo = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.8, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    h.anillo.rotation.x = -Math.PI / 2;
    h.anillo.position.y = 0.04;
    scene.add(h.anillo);
    // Indicadores de apuntado (se ven en la pantalla mientras apuntas con el celular)
    h.tira = new THREE.Mesh(geoTira, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    h.mira = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    h.mira.rotation.x = -Math.PI / 2;
    [h.tira, h.mira].forEach((m) => { m.visible = false; scene.add(m); });
    h.barra.style.setProperty('--p', '#' + color.toString(16).padStart(6, '0'));

    // El celular vibra con el daño
    h.alDaño = (cantidad, eliminado) => {
      if (eliminado) { vibrar(j, 400); avisar(j, '¡Te eliminaron!'); return; }
      if (h.tVibrar > 0) return;
      h.tVibrar = 0.15;
      vibrar(j, Math.min(90, 30 + cantidad / 25));
    };
    h.alSuperLista = () => { vibrar(j, 120); avisar(j, '¡Súper lista!'); };
    h.alAnotar = (puntos) => { vibrar(j, 160); avisar(j, puntos >= 3 ? '¡TRIPLE!' : `¡+${puntos}!`); };
    j.ent = h;
    return h;
  }

  const geoTira = new THREE.PlaneGeometry(1, 1);
  geoTira.translate(0, 0.5, 0);
  geoTira.rotateX(Math.PI / 2);

  function quitarHumanos() {
    humanos.forEach((h) => {
      combate.quitar(h);
      [h.malla, h.anillo, h.tira, h.mira].forEach((m) => scene.remove(m));
      if (balon.portador === h) balon.portador = null;
      if (h.jugadorFiesta) h.jugadorFiesta.ent = null;
    });
    humanos = [];
  }

  // Las personas a su lugar (inicio y tras cada canasta)
  function colocar() {
    humanos.forEach((h) => {
      h.pos.set(h.aparicion.x, 0, h.aparicion.z);
      h.vel.set(0, 0, 0);
      h.impulsoT = 0;
      h.dir.set(h.equipo === 'azul' ? 1 : -1, 0, 0);
      h.malla.rotation.y = Math.atan2(h.dir.x, h.dir.z);
      h.malla.position.copy(h.pos);
    });
  }

  const vibrar = (j, ms) => { if (j.conectado) Red.enviar(j.id, { t: 'vibrar', ms: Math.round(ms) }); };
  const avisar = (j, txt) => { if (j.conectado) Red.enviar(j.id, { t: 'aviso', txt }); };

  // ==========================================================
  // 7. MOVIMIENTO (igual que el del jugador, pero con el stick del celular)
  // ==========================================================
  function mover(h, dt) {
    const j = h.jugadorFiesta;
    h.impulsoCd = Math.max(0, h.impulsoCd - dt);
    h.cdRobo = Math.max(0, h.cdRobo - dt);
    h.tVibrar = Math.max(0, h.tVibrar - dt);
    const animar = h.malla.userData.animar;
    if (animar) animar(ctx.tiempo());
    if (!h.vivo) return;
    if (h.salto) {
      h.vel.set(0, 0, 0);
      h.malla.position.set(h.pos.x, h.alturaExtra, h.pos.z);
      return;
    }
    // Si el celular dejó de mandar datos (se cayó), el personaje se queda quieto
    const viejo = performance.now() - j.input.t > 600;
    const ix = viejo ? 0 : j.input.mx;
    const iz = viejo ? 0 : j.input.mz;
    const s = CONFIG.personajes[h.personaje];

    if (h.impulsoT > 0) {
      h.impulsoT -= dt;
      h.vel.set(h.impulsoDir.x * J.impulso.velocidad, 0, h.impulsoDir.z * J.impulso.velocidad);
      ctx.lanzarParticulas(h.pos.x, 0.5, h.pos.z, h.equipo === 'azul' ? COL.azul : COL.rojo, 2, 1, 0, 0.35);
    } else {
      const turbo = Math.max(h.tTurbo > 0 ? CONFIG.personajes.zip.super.velocidad : 1, poderes.multVelocidad(h));
      const vmax = s.velocidad * turbo * (balon.portador === h ? CONFIG.combate.multiplicadorConBalon : 1);
      const dx = ix * vmax - h.vel.x;
      const dz = iz * vmax - h.vel.z;
      const d = Math.hypot(dx, dz);
      const maxCambio = J.aceleracion * ctx.mapa().aceleracion * dt;
      const k = d > maxCambio ? maxCambio / d : 1;
      h.vel.x += dx * k;
      h.vel.z += dz * k;
    }
    h.pos.x += h.vel.x * dt;
    h.pos.z += h.vel.z * dt;
    ctx.resolverColisiones(h.pos, J.radio);
    for (const e of combate.entidades) {
      if (e === h || !e.vivo) continue;
      const ex = h.pos.x - e.pos.x, ez = h.pos.z - e.pos.z;
      const d = Math.hypot(ex, ez), min = J.radio + e.radio;
      if (d < min && d > 0.001) {
        h.pos.x = e.pos.x + (ex / d) * min;
        h.pos.z = e.pos.z + (ez / d) * min;
      }
    }
    // Mira hacia donde apunta; si no apunta, hacia donde camina
    const ap = !viejo && (j.input.sp || (j.input.ap && !j.input.ap.c ? j.input.ap : null));
    if (ap) h.dir.set(ap.x, 0, ap.z).normalize();
    else if (Math.hypot(h.vel.x, h.vel.z) > 0.5) h.dir.set(h.vel.x, 0, h.vel.z).normalize();
    h.malla.rotation.y = suavizarAngulo(h.malla.rotation.y, Math.atan2(h.dir.x, h.dir.z), 18 * dt);

    // Caminar
    const rapidez = Math.hypot(h.vel.x, h.vel.z);
    h.animT += rapidez * dt * 2.2;
    const { cuerpo, pierna1, pierna2, flota } = h.malla.userData;
    const paso = rapidez > 0.5 ? Math.sin(h.animT) : 0;
    pierna1.position.z = paso * 0.15;
    pierna2.position.z = -paso * 0.15;
    if (!flota) cuerpo.position.y = Math.abs(paso) * 0.06;
    cuerpo.rotation.x = Math.min(0.25, rapidez * 0.025);
    h.malla.position.copy(h.pos);
  }

  // ==========================================================
  // 8. ACCIONES DEL CELULAR
  // ==========================================================
  const enJuego = () => ctx.estado() === 'jugando' || ctx.estado() === 'canasta';
  const aroQueAtaca = (h) => aros.find((a) => a.equipo !== h.equipo);
  const distancia = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // Punto al que apunta el stick: (x, z) es la dirección y f (0 a 1) qué tan lejos
  function puntoApuntado(h, x, z, f) {
    const m = Math.hypot(x, z) || 1;
    let alcanceMax;
    if (balon.portador === h) {
      alcanceMax = Math.max(TC.alcanceMinimo, distancia(h.pos, aroQueAtaca(h)) + TC.margenAlcance);
    } else {
      alcanceMax = CONFIG.personajes[h.personaje].ataque.alcance;
    }
    const d = TC.distanciaMinima + Math.max(0, Math.min(1, f)) * (alcanceMax - TC.distanciaMinima);
    return { x: h.pos.x + (x / m) * d, z: h.pos.z + (z / m) * d };
  }

  function rivalMasCercano(h, maxDist) {
    let mejor = null, md = maxDist;
    for (const e of combate.entidades) {
      if (!e.vivo || e.equipo === h.equipo) continue;
      const d = distancia(e.pos, h.pos);
      if (d < md) { md = d; mejor = e; }
    }
    return mejor;
  }

  function accion(j, m) {
    const h = j.ent;
    if (!enJuego() || !h.vivo) return;
    const s = CONFIG.personajes[h.personaje];
    switch (m.a) {
      case 'principal': {
        let p;
        if (m.toque) {
          if (balon.portador === h) {
            p = { x: h.pos.x + h.dir.x * TC.distanciaToque, z: h.pos.z + h.dir.z * TC.distanciaToque };
          } else {
            const r = rivalMasCercano(h, s.ataque.alcance + 1);
            p = r ? { x: r.pos.x, z: r.pos.z } : { x: h.pos.x + h.dir.x * 4, z: h.pos.z + h.dir.z * 4 };
          }
        } else {
          p = puntoApuntado(h, +m.x || 0, +m.z || 0, +m.f || 0);
        }
        h.dir.set(p.x - h.pos.x, 0, p.z - h.pos.z);
        if (h.dir.lengthSq() < 0.001) h.dir.set(h.equipo === 'azul' ? 1 : -1, 0, 0);
        h.dir.normalize();
        if (balon.portador === h) tirar(h, p);
        else combate.atacar(h, s.ataque, p.x, p.z);
        break;
      }
      case 'secundaria': secundaria(h); break;
      case 'impulso': impulso(h); break;
      case 'super': {
        if (h.carga < 1) { avisar(j, `Súper al ${Math.floor(h.carga * 100)} %`); return; }
        const alcance = s.super.alcance || 4;
        let p;
        if (m.toque) {
          const r = rivalMasCercano(h, alcance + 2);
          p = r ? { x: r.pos.x, z: r.pos.z } : { x: h.pos.x + h.dir.x * alcance * 0.7, z: h.pos.z + h.dir.z * alcance * 0.7 };
        } else {
          const mm = Math.hypot(+m.x || 0, +m.z || 0) || 1;
          const d = Math.max(1, Math.min(1, +m.f || 0) * alcance);
          p = { x: h.pos.x + (m.x / mm) * d, z: h.pos.z + (m.z / mm) * d };
        }
        combate.usarSuper(h, p.x, p.z);
        break;
      }
    }
  }

  // Tiro con la misma puntería que el jugador del celular
  function tirar(h, p) {
    if (ctx.estado() !== 'jugando') return;
    const aro = aroQueAtaca(h);
    let ax = p.x - h.pos.x, az = p.z - h.pos.z;
    const al = Math.hypot(ax, az) || 1;
    ax /= al; az /= al;
    const d = Math.min(al, T.distanciaMaxLanzamiento);
    const ox = h.pos.x + ax * d, oz = h.pos.z + az * d;
    const alAro = Math.hypot(ox - aro.x, oz - aro.z) < T.radioIntentoTiro;
    const rapidez = Math.hypot(h.vel.x, h.vel.z);
    const error = T.errorBase
      + distancia(h.pos, aro) * T.errorPorDistancia
      + (rapidez > 1.5 ? T.errorEnMovimiento : 0)
      + (ctx.bajoPresion(h) ? T.errorPresion : 0);
    ctx.lanzarBalonA(h, ox, oz, error, alAro);
  }

  // Botón PASE / ROBO
  function secundaria(h) {
    const j = h.jugadorFiesta;
    if (balon.portador === h) {
      // Pasa al compañero que esté más hacia donde mira
      let mejor = null, mp = Infinity;
      for (const e of combate.entidades) {
        if (e === h || !e.vivo || e.equipo !== h.equipo) continue;
        const ex = e.pos.x - h.pos.x, ez = e.pos.z - h.pos.z;
        const d = Math.hypot(ex, ez);
        if (d > CONFIG.pase.distanciaMax) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (ex * h.dir.x + ez * h.dir.z) / (d || 1))));
        const pts = ang * 3 + d * 0.05;
        if (pts < mp) { mp = pts; mejor = e; }
      }
      if (mejor) ctx.pasar(h, mejor);
      else avisar(j, 'No hay compañeros cerca');
      return;
    }
    const p = balon.portador;
    if (p && p.equipo !== h.equipo && distancia(p.pos, h.pos) < CONFIG.robo.alcance + 0.5) {
      h.dir.set(p.pos.x - h.pos.x, 0, p.pos.z - h.pos.z).normalize();
    }
    if (h.cdRobo > 0) { avisar(j, `Robo listo en ${Math.ceil(h.cdRobo)} s`); return; }
    const ok = ctx.intentarRobo(h);
    avisar(j, ok ? '¡Robo!' : 'Robo fallido');
    if (ok) vibrar(j, 80);
  }

  function impulso(h) {
    if (h.impulsoCd > 0 || h.impulsoT > 0) { avisar(h.jugadorFiesta, `Impulso en ${Math.ceil(h.impulsoCd)} s`); return; }
    const v = Math.hypot(h.vel.x, h.vel.z);
    if (v > 0.5) h.impulsoDir.set(h.vel.x / v, 0, h.vel.z / v);
    else h.impulsoDir.copy(h.dir);
    h.impulsoT = J.impulso.duracion;
    h.impulsoCd = J.impulso.enfriamiento;
    Sonido.sfx.impulso();
  }

  // ==========================================================
  // 9. INDICADORES EN LA PANTALLA (mientras apuntas)
  // ==========================================================
  function indicadores(h) {
    const j = h.jugadorFiesta;
    h.anillo.visible = h.vivo;
    h.anillo.position.set(h.pos.x, 0.04, h.pos.z);
    h.tira.visible = h.mira.visible = false;
    if (!h.vivo || !enJuego()) return;
    const s = CONFIG.personajes[h.personaje];
    let p = null, r = 0.35, largo = 0;
    if (j.input.sp && h.carga >= 1) {
      const sp = j.input.sp;
      const alc = s.super.alcance || 4;
      const d = Math.max(1, sp.f * alc);
      p = { x: h.pos.x + sp.x * d, z: h.pos.z + sp.z * d };
      r = s.super.radio || s.super.radioExplosion || 1.2;
      h.mira.material.color.setHex(COL.dorado);
    } else if (j.input.ap && !j.input.ap.c) {
      const ap = j.input.ap;
      p = puntoApuntado(h, ap.x, ap.z, ap.f);
      r = balon.portador === h ? 0.5 : (s.ataque.radioExplosion || 0.45);
      h.mira.material.color.setHex(COLORES_P[(j.num - 1) % COLORES_P.length]);
    }
    if (!p) return;
    largo = Math.hypot(p.x - h.pos.x, p.z - h.pos.z);
    h.tira.visible = h.mira.visible = true;
    h.tira.position.set(h.pos.x, 0.06, h.pos.z);
    h.tira.rotation.y = Math.atan2(p.x - h.pos.x, p.z - h.pos.z);
    h.tira.scale.set(0.15, 1, largo);
    // Con el balón la mira va a la altura del aro (igual que al jugar solo)
    h.mira.position.set(p.x, balon.portador === h ? C.aroAltura + 0.02 : 0.07, p.z);
    h.mira.scale.setScalar(r);
  }

  // ==========================================================
  // 10. CADA CUADRO
  // ==========================================================
  function actualizar(dt, jugando) {
    // Cuenta regresiva de la sala
    if (fase === 'sala' && sala.cuenta != null) {
      const tCuenta = finCuenta - ahora();
      const n = Math.max(0, Math.ceil(tCuenta));
      if (n !== sala.cuenta) {
        sala.cuenta = n;
        if (n > 0) Sonido.sfx.tic();
        dibujarSala();
        enviarSala();
      }
      if (tCuenta <= 0) empezar();
    }
    // Tras el partido, vuelve sola a la sala
    if (fase === 'fin') {
      const tVolver = finVolver - ahora();
      $('fin-volver').textContent = `Volviendo a la sala en ${Math.max(0, Math.ceil(tVolver))}…`;
      if (tVolver <= 0) volverASala();
    }
    revisarSilencio();
    if (fase !== 'juego') return;

    for (const h of humanos) {
      if (jugando) mover(h, dt);
      else h.malla.position.copy(h.pos);
      indicadores(h);
    }
    // Estado para cada celular (vida, súper, marcador…)
    tEnvio -= dt;
    if (tEnvio <= 0) {
      tEnvio = R.envioEstado / 1000;
      const p = ctx.partido;
      for (const h of humanos) {
        const j = h.jugadorFiesta;
        if (!j.conectado) continue;
        Red.enviar(j.id, {
          t: 'estado',
          vida: Math.ceil(h.vida), vidaMax: h.vidaMax,
          carga: +h.carga.toFixed(2), vivo: h.vivo, tRe: +(h.tReaparecer || 0).toFixed(1),
          cdImp: +h.impulsoCd.toFixed(1), conBalon: balon.portador === h,
          escudo: Math.ceil(h.escudo || 0),
          az: p.marcador.azul, ro: p.marcador.rojo, tiempo: Math.ceil(p.tiempo), prorroga: p.prorroga,
          cuenta: ctx.estado() === 'cuenta' ? +p.tCuenta.toFixed(1) : 0
        });
      }
    }
  }

  // Si un celular lleva varios segundos sin mandar nada, se fue (o se le acabó la señal)
  let tRevision = 0;
  function revisarSilencio() {
    if (ahora() < tRevision) return;
    tRevision = ahora() + 1;
    let cambio = false;
    for (const [id, j] of jugadores) {
      if (!j.conectado || ahora() - (j.visto || 0) < 7) continue;
      if (fase === 'sala') {
        jugadores.delete(id);
        Red.expulsar(id);
      } else {
        j.conectado = false; // en el partido se guarda su lugar
        j.input.mx = j.input.mz = 0;
        j.input.ap = j.input.sp = null;
      }
      cambio = true;
    }
    if (cambio) cambioSala();
  }

  function suavizarAngulo(actual, objetivo, k) {
    let diff = objetivo - actual;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return actual + diff * Math.min(1, k);
  }

  // Para pruebas automáticas
  window.__fiesta = { get jugadores() { return lista(); }, get fase() { return fase; }, get humanos() { return humanos; }, sala };

  return {
    abrir, cerrar, empezar, alTerminar, volverASala, colocar, actualizar, cambiarAjuste,
    get fase() { return fase; },
    get activa() { return fase !== 'cerrada'; },
    get humanos() { return humanos; }
  };
}
