/* ==========================================================
   ORBIX: OVERDRIVE — online.js
   ONLINE: cada persona juega en su propia pantalla.

   - ANFITRIÓN: crea la sala (usa la misma sala del Modo Fiesta,
     fiesta.js) y su equipo hace de "servidor": simula el partido
     y 20 veces por segundo manda una FOTO a los demás
     (dónde está cada uno, su vida, el balón, el marcador…)
     junto con los EVENTOS (ataques, súper, canastas, robos).
   - CLIENTE (el que se une): manda sus controles (como el celular
     del Modo Fiesta) y dibuja el partido con las fotos.
     game.js se encarga de dibujar (suavizado y predicción).
   ========================================================== */

function crearOnline(ctx) {
  const R = CONFIG.red;
  const r2 = (v) => Math.round((v || 0) * 100) / 100;

  // ==========================================================
  // 1. ANFITRIÓN
  // ==========================================================
  let eventos = [];        // lo que pasó desde la última foto
  let tFoto = 0;
  let numFoto = 0;
  let inicio = null;       // cómo empezó el partido (para los que se reconectan)

  // game.js y combate.js avisan de cada evento importante
  function emitir(ev) {
    if (ctx.fiesta.fase === 'juego') eventos.push(ev);
  }

  // Al empezar: cada personaje recibe un número (netId) y se manda la lista
  function alEmpezar() {
    const ents = ctx.combate.entidades;
    ents.forEach((e, i) => { e.netId = i; });
    inicio = {
      t: 'inicio',
      mapa: ctx.mapaId(),
      ents: ents.map((e) => ({
        nombre: e.nombre, personaje: e.personaje, equipo: e.equipo, skin: e.skin || 'normal',
        num: e.jugadorFiesta ? e.jugadorFiesta.num : 0,   // 0 = bot
        vm: e.vidaMax, ax: e.aparicion.x, az: e.aparicion.z
      }))
    };
    eventos = [];
    tFoto = 0;
    Red.enviarATodos(inicio);
  }

  function alReconectar(id) {
    if (inicio) Red.enviar(id, inicio);
  }

  // Cada cuadro del anfitrión: manda una foto cada 50 ms
  function actualizarHost(dt) {
    if (ctx.fiesta.fase !== 'juego') return;
    tFoto -= dt;
    if (tFoto > 0) return;
    tFoto = R.envioFoto / 1000;
    Red.enviarATodos(foto());
  }

  function foto() {
    const p = ctx.partido, b = ctx.balon;
    const st = { cuenta: 'c', jugando: 'j', canasta: 'k', pausa: 'p', fin: 'f' }[ctx.estado()] || 'j';
    // Por cada personaje (en el orden de netId):
    // [x, z, giro, vida, vivo, súper, escudo, altura, reaparece, protegido, orden, impulso, robo, turbo, fuego, imán, turboZip, tEscudo]
    const n = ctx.combate.entidades.map((e) => [
      r2(e.pos.x), r2(e.pos.z), r2(e.malla.rotation.y), Math.round(e.vida), e.vivo ? 1 : 0, r2(e.carga),
      Math.round(e.escudo || 0), r2(e.alturaExtra), r2(e.tReaparecer), e.proteccion > 0 ? 1 : 0,
      e.jugadorFiesta ? (e.jugadorFiesta.input.q || 0) : 0,
      r2(e.impulsoCd), r2(e.cdRobo), r2(e.tPoderTurbo), r2(e.tFuego), r2(e.tIman), r2(e.tTurbo), r2(e.tEscudo)
    ]);
    const dueño = b.portador || b.tiroDe;
    const fuego = dueño && dueño.tFuego > 0 && (b.portador || b.tLanzado < 2) ? 1 : 0;
    const msg = {
      t: 's', q: ++numFoto, st,
      ti: r2(p.tiempo), pr: p.prorroga ? 1 : 0, tc: r2(p.tCuenta),
      m: [p.marcador.azul, p.marcador.rojo],
      b: [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z), b.portador && b.portador.netId !== undefined ? b.portador.netId : -1, fuego],
      o: ctx.poderes.orbes.map((o) => [o.tipo, r2(o.x), r2(o.z)]),
      n
    };
    if (eventos.length) { msg.ev = eventos; eventos = []; }
    return msg;
  }

  // ==========================================================
  // 2. CLIENTE (el que se une)
  // ==========================================================
  let peer = null;
  let conn = null;
  let codigo = '';
  let yo = { num: 0, lider: false, listo: false };
  let alError = () => {};

  function dispositivo() {
    try {
      let d = localStorage.getItem('orbix_dispositivo');
      if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('orbix_dispositivo', d); }
      return d;
    } catch (e) { return 'pc-' + Math.random().toString(36).slice(2); }
  }

  function unirse(cod, nombre, error) {
    alError = error;
    codigo = String(cod || '').trim().toUpperCase();
    if (codigo.length !== 4) return error('Escribe el código de 4 letras de la sala.');
    if (CONFIG.red.enlaceFiesta) return error(`Aquí no se puede jugar online. Abre el juego en ${CONFIG.red.enlaceFiesta}`);
    if (typeof Peer === 'undefined') return error('No se pudo cargar la conexión. Revisa el internet y recarga.');
    salir();
    const op = { debug: 0, config: { iceServers: R.stun.map((u) => ({ urls: u })) } };
    if (R.servidor) Object.assign(op, R.servidor);
    peer = new Peer(op);
    const limite = setTimeout(() => {
      if (!conn || !conn.open) { error('No se encontró la sala. Revisa el código y que el anfitrión siga en la sala.'); salir(); }
    }, 12000);
    peer.on('open', () => {
      const c = peer.connect(R.prefijo + codigo, { reliable: true, serialization: 'json' });
      conn = c;
      c.on('open', () => {
        clearTimeout(limite);
        c.send({ t: 'hola', nombre: String(nombre || 'Jugador').slice(0, 10), dispositivo: dispositivo() });
      });
      c.on('data', recibir);
      const fin = () => { if (conn === c) { conn = null; ctx.alSalir('Se perdió la conexión con el anfitrión.'); } };
      c.on('close', fin);
      c.on('error', fin);
    });
    peer.on('error', (e) => {
      clearTimeout(limite);
      const textos = {
        'peer-unavailable': 'No existe una sala con ese código. Revisa las letras.',
        network: 'Sin conexión con el servidor de salas. Revisa el internet.',
        'browser-incompatible': 'Este navegador no sirve para jugar online. Usa Chrome, Edge o Safari actualizado.'
      };
      if (!conn || !conn.open) error(textos[e.type] || `No se pudo conectar (${e.type}).`);
    });
  }

  // Salir de la sala (sin avisar a game.js)
  function salir() {
    const c = conn;
    conn = null;
    try { if (c) c.close(); } catch (e) { /* nada */ }
    try { if (peer) peer.destroy(); } catch (e) { /* nada */ }
    peer = null;
  }

  function enviar(m) {
    if (conn && conn.open) conn.send(m);
  }

  function recibir(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'llena':
        alError('La sala está llena (máximo 6 jugadores).');
        salir();
        break;
      case 'bienvenido':
        if (m.modo && m.modo !== 'online') {
          alError('Ese código es de un Modo Fiesta: se entra escaneando el QR con el celular.');
          salir();
          return;
        }
        yo = { num: m.num, lider: m.lider, listo: !!m.listo };
        ctx.alBienvenido(codigo);
        break;
      case 'sala': {
        const mio = (m.jugadores || []).find((j) => j.num === yo.num);
        if (mio) { yo.lider = mio.lider; yo.listo = mio.listo; }
        ctx.alSala(m, yo.num);
        break;
      }
      case 'fase':
        if (m.f === 'sala') ctx.alVolverSala();
        break; // 'juego': se espera el mensaje 'inicio'
      case 'inicio': ctx.alInicio(m); break;
      case 's': ctx.alFoto(m); break;
      case 'fin': ctx.alFin(m); break;
      case 'aviso': ctx.pista(m.txt); break;
      case 'cerrada': { const c = conn; conn = null; ctx.alSalir('El anfitrión cerró la sala.'); try { if (c) c.close(); } catch (e) { /* nada */ } break; }
      case 'vibrar': if (navigator.vibrate) navigator.vibrate(m.ms || 60); break;
    }
  }

  // Latido: "sigo aquí" cada 2 s (la sala saca a los que no responden)
  setInterval(() => enviar({ t: 'ping' }), 2000);

  return {
    // anfitrión
    emitir, alEmpezar, alReconectar, actualizarHost,
    // cliente
    unirse, salir, enviar,
    accion: (m) => enviar({ t: 'accion', ...m }),
    get yo() { return yo; },
    get codigo() { return codigo; }
  };
}
