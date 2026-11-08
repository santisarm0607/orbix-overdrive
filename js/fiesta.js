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

// ==========================================================
// Dibuja la sala en la pantalla a partir de los datos de la sala
// (los mismos que se mandan a los celulares). La usan el Modo Fiesta,
// el anfitrión online y los que se unen online.
//   datos = { jugadores: [{ num, nombre, equipo, personaje, listo, lider }], mapa, bots, cuenta, motivo }
//   op = { yoNum, puedeEmpezar, soyAnfitrion }
// ==========================================================
function pintarSala(datos, op = {}) {
  const $ = (id) => document.getElementById(id);
  const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const js = datos.jugadores || [];
  const tam = datos.tamano || 3;
  ['azul', 'rojo'].forEach((eq) => {
    const del = js.filter((j) => j.equipo === eq);
    let html = '';
    for (let i = 0; i < Math.max(tam, del.length); i++) {
      const j = del[i];
      if (j) {
        const inf = j.personaje ? Personajes.info[j.personaje] : null;
        html += `<li class="ocupado${j.listo ? ' listo' : ''}${j.num === op.yoNum ? ' yo' : ''}" style="--c:${inf ? inf.color : '#888'}">
          <span class="num">P${j.num}</span>
          <span class="quien"><b>${escapar(j.nombre)}${j.lider ? ' 👑' : ''}${j.num === op.yoNum ? ' (tú)' : ''}</b><small>${inf ? inf.nombre : datos.etapa === 'conectar' ? 'conectado' : 'eligiendo…'}</small></span>
          <span class="marca">${j.listo ? '✔' : '…'}</span></li>`;
      } else {
        html += `<li class="vacio">${datos.bots ? '🤖 Bot' : 'Libre'}</li>`;
      }
    }
    $(`fiesta-${eq}`).innerHTML = html;
  });
  const sinEquipo = js.filter((j) => !j.equipo);
  $('fiesta-sin-equipo').textContent = sinEquipo.length ? `Eligiendo equipo: ${sinEquipo.map((j) => j.nombre).join(', ')}` : '';
  $('fiesta-mapa').value = datos.mapa;
  $('fiesta-bots-si').classList.toggle('activa', !!datos.bots);
  $('fiesta-bots-no').classList.toggle('activa', !datos.bots);
  // Solo el líder (o la pantalla del Modo Fiesta) cambia el mapa y los bots
  const yo = js.find((j) => j.num === op.yoNum);
  const mandaAjustes = !op.yoNum || (yo && yo.lider);
  $('fiesta-mapa').disabled = !mandaAjustes;
  $('fiesta-bots-si').disabled = $('fiesta-bots-no').disabled = !mandaAjustes;
  document.querySelectorAll('#fiesta-tam [data-tam]').forEach((b) => {
    b.classList.toggle('activa', +b.dataset.tam === tam);
    b.disabled = !mandaAjustes;
  });
  const msg = datos.cuenta != null ? `¡Empieza en ${datos.cuenta}!` : datos.motivo || '';
  $('fiesta-msg').textContent = msg;
  $('fiesta-msg').classList.toggle('cuenta', datos.cuenta != null);
  $('fiesta-empezar').disabled = !op.puedeEmpezar;
  // Ranking de la sala (aparece después del primer partido)
  const rk = datos.ranking || [];
  $('sala-ranking').hidden = !rk.length;
  $('sala-ranking-lista').innerHTML = rk.map((r, i) =>
    `<li><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'}</span><b>${escapar(r.nombre)}</b><small>${r.victorias} V · ${r.puntos} pts · ${r.partidos} PJ</small></li>`).join('');
  // Panel "tu elección" (solo online: tú también juegas)
  const panel = $('sala-yo');
  panel.hidden = !op.yoNum;
  if (!op.yoNum || !yo) return;
  ['azul', 'rojo'].forEach((eq) => {
    const b = $(`yo-${eq}`);
    const n = js.filter((j) => j.equipo === eq && j.num !== yo.num).length;
    b.classList.toggle('activa', yo.equipo === eq);
    b.disabled = n >= tam && yo.equipo !== eq;
    b.querySelector('small').textContent = `${n + (yo.equipo === eq ? 1 : 0)}/${tam}`;
  });
  document.querySelectorAll('#yo-pj button').forEach((b) => {
    const otro = js.find((j) => j.personaje === b.dataset.id && j.num !== yo.num);
    b.classList.toggle('ocupado', !!otro);
    b.classList.toggle('activa', yo.personaje === b.dataset.id);
    b.disabled = !!otro;
    b.title = otro ? `Lo tiene ${otro.nombre}` : Personajes.info[b.dataset.id].rol;
  });
  const listo = $('yo-listo');
  listo.textContent = yo.listo ? '✔ LISTO' : '¡LISTO!';
  listo.classList.toggle('esta-listo', !!yo.listo);
  listo.disabled = !yo.equipo || !yo.personaje;
}

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
  // Ranking de la sala (Rival League): se suma partido a partido mientras la sala siga abierta
  const ranking = new Map(); // dispositivo → { nombre, partidos, victorias, puntos, elims }
  let ordenLlegada = 0;
  // tamano: personas por equipo
  // etapa (online): 'conectar' = entran y eligen equipo · 'personajes' = cada uno elige personaje con la vista 3D
  const sala = { mapa: 'estacion', bots: true, tamano: 3, cuenta: null, motivo: '', etapa: 'personajes' };
  let fase = 'cerrada';        // 'cerrada' | 'sala' | 'juego' | 'fin'
  // Las esperas de la sala usan el reloj real (no se frenan si el juego va lento)
  let finCuenta = 0;           // momento en que termina la cuenta regresiva de la sala
  let finVolver = 0;           // momento de volver a la sala tras el partido
  const ahora = () => performance.now() / 1000;
  let tEnvio = 0;
  let humanos = [];            // personajes de las personas durante el partido (sin el anfitrión)
  // 'fiesta' = la pantalla solo muestra; 'online' = el anfitrión también juega (con el personaje "jugador")
  let modo = 'fiesta';
  let local = null;            // el anfitrión como jugador (solo online)

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
  // nombreLocal: si viene, es una sala ONLINE y el anfitrión también juega
  function abrir(nombreLocal) {
    modo = nombreLocal ? 'online' : 'fiesta';
    fase = 'sala';
    sala.cuenta = null;
    sala.etapa = modo === 'online' ? 'conectar' : 'personajes'; // el Modo Fiesta lo hace todo en una sola sala
    if (modo === 'online' && !local) {
      local = {
        id: 'local', num: 1, nombre: String(nombreLocal).slice(0, 10), dispositivo: 'local', orden: -1, esLocal: true,
        equipo: 'azul', personaje: ctx.jugadorLocal.personaje, listo: false, conectado: true, visto: Infinity,
        ent: null, input: { mx: 0, mz: 0, ap: null, sp: null, t: 0 }
      };
      jugadores.set('local', local);
    }
    $('fiesta-codigo').textContent = '····';
    $('fiesta-qr').innerHTML = '';
    $('fiesta-url').textContent = '';
    estadoRed('Abriendo la sala…');
    dibujarSala();
    // En la versión de una sola página (artefacto) no se permiten conexiones
    if (CONFIG.red.enlaceFiesta) {
      $('fiesta-qr').textContent = '📱';
      estadoRed(`Aquí no se puede conectar. Abre el juego en ${CONFIG.red.enlaceFiesta} para jugar ${modo === 'online' ? 'online' : 'el Modo Fiesta'}.`, true);
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
    // Fiesta: el QR abre el control. Online: abre el juego y entra solo a la sala.
    const url = new URL(modo === 'online' ? 'index.html' : 'control.html', location.href);
    url.hash = modo === 'online' ? 'sala=' + codigo : codigo;
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
    else estadoRed(modo === 'online' ? 'Pásales el código: entran con ONLINE → Unirse (o escaneando el QR)' : 'Escanea el código con la cámara del celular');
  }

  function estadoRed(texto, error = false) {
    const el = $('fiesta-estado');
    el.textContent = texto;
    el.classList.toggle('error', error);
  }

  // Salir del Modo Fiesta (vuelve al menú normal)
  function cerrar() {
    Red.enviarATodos({ t: 'cerrada' }); // avisa a todos que la sala se cerró
    quitarHumanos();
    jugadores.clear();
    ranking.clear();
    local = null;
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
        if (fase !== 'sala' || sala.etapa !== 'personajes') break;
        j.listo = !!m.v && !!j.equipo && !!j.personaje;
        cambioSala();
        break;
      case 'config':
        if (fase !== 'sala' || lider() !== j) break;
        if (m.mapa && (CONFIG.mapas[m.mapa] || m.mapa === 'azar')) sala.mapa = m.mapa;
        if (typeof m.bots === 'boolean') sala.bots = m.bots;
        if ([1, 2, 3].includes(m.tamano)) sala.tamano = m.tamano;
        cambioSala();
        break;
      case 'in':
        j.input.mx = clamp(+m.mx || 0);
        j.input.mz = clamp(+m.mz || 0);
        j.input.ap = m.ap || null;
        j.input.sp = m.sp || null;
        // Online desde computador: hacia dónde mira (el mouse)
        j.input.dir = m.dir && Number.isFinite(+m.dir.x) && Number.isFinite(+m.dir.z) ? { x: +m.dir.x, z: +m.dir.z } : null;
        j.input.q = +m.q || 0; // número de la orden (online: el que se unió corrige su posición con esto)
        j.input.t = performance.now();
        break;
      case 'accion':
        if (j.ent) accion(j, m);
        break;
      case 'emote': {
        const k = +m.k;
        if (!j.ent || !(k >= 0 && k < CONFIG.emotes.length)) break;
        if (performance.now() - (j.tEmote || 0) < 1400) break;
        j.tEmote = performance.now();
        if (ctx.alEmote) ctx.alEmote(j.ent, k);
        break;
      }
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
      if (lista().filter((x) => x.equipo === j.equipo).length >= sala.tamano) j.equipo = null;
    }
    j.visto = ahora();
    jugadores.set(id, j);
    Red.enviar(id, { t: 'bienvenido', modo, num: j.num, lider: lider() === j, equipo: j.equipo, personaje: j.personaje, listo: j.listo });
    if (fase === 'juego' && j.ent) {
      Red.enviar(id, { t: 'fase', f: 'juego' });
      if (ctx.alReconectar) ctx.alReconectar(id); // online: le manda el partido en curso
    } else if (fase === 'juego' || fase === 'fin') {
      j.listo = false;
    }
    Sonido.sfx.recoger();
    cambioSala();
  }

  // El anfitrión online elige desde su pantalla
  function elegirLocal(m) { if (local) elegir(local, m); }
  function listoLocal(v) {
    if (!local || fase !== 'sala' || sala.etapa !== 'personajes') return;
    local.listo = !!v && !!local.equipo && !!local.personaje;
    cambioSala();
  }

  function elegir(j, m) {
    if (fase !== 'sala') return;
    if (m.equipo === 'azul' || m.equipo === 'rojo') {
      const llenos = lista().filter((x) => x !== j && x.equipo === m.equipo).length >= sala.tamano;
      if (!llenos) j.equipo = m.equipo;
      j.listo = false;
    }
    if (typeof m.skin === 'string' && Personajes.skins.some((s) => s.id === m.skin)) j.skin = m.skin;
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
    const sinEquipo = js.filter((j) => !j.equipo);
    if (sinEquipo.length) return `${sinEquipo.map((j) => j.nombre).join(', ')}: falta elegir equipo`;
    const enConectar = sala.etapa === 'conectar';
    const sinElegir = enConectar ? [] : js.filter((j) => !j.personaje);
    if (sinElegir.length) return `${sinElegir.map((j) => j.nombre).join(', ')}: falta elegir personaje`;
    // Si bajaron el tamaño, puede haber un equipo con más personas de las que caben
    for (const eq of ['azul', 'rojo']) {
      if (js.filter((j) => j.equipo === eq).length > sala.tamano) return `El equipo ${eq} tiene más de ${sala.tamano}: alguien debe cambiarse`;
    }
    if (!sala.bots) {
      const az = js.some((j) => j.equipo === 'azul'), ro = js.some((j) => j.equipo === 'rojo');
      if (!az || !ro) return 'Sin bots, cada equipo necesita al menos una persona';
    }
    if (enConectar) return '';
    if (exigirListos) {
      const faltan = js.filter((j) => !j.listo);
      if (faltan.length) return `Esperando a: ${faltan.map((j) => j.nombre).join(', ')}`;
    }
    return '';
  }

  function cambioSala() {
    if (fase === 'sala') {
      const motivo = revisar(true);
      sala.motivo = motivo || (sala.etapa === 'conectar' ? (modo === 'online' ? 'Cuando estén todos, el anfitrión pasa a elegir personajes' : '') : '');
      if (motivo || sala.etapa === 'conectar') {
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
    Red.enviarATodos({ t: 'sala', ...datosSala() });
  }

  // Los datos de la sala (los mismos que reciben los celulares)
  function datosSala() {
    const l = lider();
    return {
      jugadores: lista().filter((j) => j.conectado).map((j) => ({
        num: j.num, nombre: j.nombre, equipo: j.equipo, personaje: j.personaje, skin: j.skin || 'normal', listo: j.listo, lider: j === l
      })),
      mapa: sala.mapa, bots: sala.bots, tamano: sala.tamano, cuenta: sala.cuenta, etapa: sala.etapa,
      ranking: [...ranking.values()].sort((a, b) => b.victorias - a.victorias || b.puntos - a.puntos).slice(0, 6),
      motivo: fase === 'juego' ? 'Hay un partido en curso. Entras en el próximo.' : sala.motivo
    };
  }

  // Dibuja la sala en la pantalla (la de la TV o la del anfitrión online)
  function dibujarSala() {
    const op = { yoNum: local ? local.num : 0, puedeEmpezar: !revisar(false) };
    if (modo === 'online' && ctx.alSalaOnline) ctx.alSalaOnline(datosSala(), op);
    else pintarSala(datosSala(), op);
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
  // Online: el anfitrión pasa de "conectarse" a "elegir personajes" (y puede volver)
  function irAPersonajes() {
    if (fase !== 'sala' || sala.etapa !== 'conectar' || revisar(false)) return;
    sala.etapa = 'personajes';
    jugadores.forEach((j) => { j.listo = false; });
    Sonido.sfx.elegir();
    cambioSala();
  }
  function volverAEquipos() {
    if (fase !== 'sala' || modo !== 'online') return;
    sala.etapa = 'conectar';
    sala.cuenta = null;
    jugadores.forEach((j) => { j.listo = false; });
    cambioSala();
  }

  function empezar() {
    if (fase === 'sala' && sala.etapa === 'conectar') { irAPersonajes(); return; }
    if (fase !== 'sala' || revisar(false)) return;
    const js = conectados().filter((j) => j.equipo && j.personaje);
    // Los que no estaban listos igual juegan (la pantalla dio la orden)
    fase = 'juego';
    sala.cuenta = null;
    quitarHumanos();
    // Cada persona en un lugar de su equipo
    const usados = { azul: 0, rojo: 0 };
    humanos = [];
    js.forEach((j) => {
      const lugar = usados[j.equipo]++;
      if (j.esLocal) j.ent = ctx.prepararLocal(j, lugar); // el anfitrión juega con su personaje de siempre
      else humanos.push(crearHumano(j, lugar));
    });
    const orden = CONFIG.mapas.orden;
    const mapaId = sala.mapa === 'azar' ? orden[Math.floor(Math.random() * orden.length)] : sala.mapa;
    ctx.iniciar({
      mapaId,
      ocupados: js.map((j) => ({ personaje: j.personaje, equipo: j.equipo })),
      rellenar: sala.bots,
      tamano: sala.tamano,
      personas: js.length
    });
    Red.enviarATodos({ t: 'fase', f: 'juego' });
    if (ctx.alEmpezar) ctx.alEmpezar(); // online: manda a todos cómo empieza el partido
    enviarSala(); // los que no juegan ven "partido en curso"
  }

  // La llama game.js cuando el partido termina
  function alTerminar(ganador) {
    fase = 'fin';
    finVolver = ahora() + F.volverSala;
    const p = ctx.partido;
    const tabla = combate.entidades
      .filter((e) => e.jugadorFiesta)
      .map((e) => ({ num: e.jugadorFiesta.num, nombre: e.jugadorFiesta.nombre, equipo: e.equipo, personaje: e.personaje, puntos: e.puntos || 0, elims: e.eliminaciones || 0 }))
      .sort((a, b) => b.puntos - a.puntos || b.elims - a.elims);
    combate.entidades.filter((e) => e.jugadorFiesta).forEach((e) => {
      const j = e.jugadorFiesta;
      const r = ranking.get(j.dispositivo) || { nombre: j.nombre, partidos: 0, victorias: 0, puntos: 0, elims: 0 };
      r.nombre = j.nombre;
      r.partidos++;
      if (e.equipo === ganador) r.victorias++;
      r.puntos += e.puntos || 0;
      r.elims += e.eliminaciones || 0;
      ranking.set(j.dispositivo, r);
    });
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
    if (modo === 'online') sala.etapa = 'conectar';
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
      malla: Personajes.crearModelo(j.personaje, j.equipo === 'azul' ? COL.azul : COL.rojo, j.skin || 'normal'),
      skin: j.skin || 'normal',
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
    h.ind = crearIndicadores(s.ataque);
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

  // Indicadores de cada persona (iguales a los del modo de un jugador):
  // - con balón: arco punteado del tiro + mira a la altura del aro + sombra en el piso
  // - sin balón: la forma real del ataque (cono, línea o área)
  // - súper: lo mismo en dorado
  const PUNTOS_ARCO = 16;
  const geoPunto = new THREE.SphereGeometry(0.15, 8, 6);
  function crearIndicadores(ataque) {
    const mat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
    const ind = {};
    ind.matZona = mat(0xffffff, 0.3);
    ind.tira = new THREE.Mesh(geoTira, ind.matZona);
    ind.area = new THREE.Mesh(new THREE.CircleGeometry(1, 32), ind.matZona);
    ind.area.rotation.x = -Math.PI / 2;
    ind.borde = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), mat(0xffffff, 0.8));
    ind.borde.rotation.x = -Math.PI / 2;
    ind.sector = new THREE.Mesh(new THREE.BufferGeometry(), ind.matZona);
    if (ataque.tipo === 'golpe') {
      const mitad = THREE.MathUtils.degToRad(ataque.angulo / 2);
      const geo = new THREE.CircleGeometry(ataque.alcance, 20, Math.PI / 2 - mitad, mitad * 2);
      geo.rotateX(Math.PI / 2);
      ind.sector.geometry = geo;
    }
    // Arco del tiro: bolitas gruesas (una línea de 1 píxel casi no se ve en una TV)
    ind.matArco = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    ind.puntos = [];
    for (let i = 0; i < PUNTOS_ARCO; i++) ind.puntos.push(new THREE.Mesh(geoPunto, ind.matArco));
    // Mira del tiro (se dibuja encima de todo para que no se pierda)
    ind.mira = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, transparent: true }));
    ind.mira.rotation.x = -Math.PI / 2;
    ind.mira.renderOrder = 10;
    ind.sombra = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), mat(0x000000, 0.35));
    ind.sombra.rotation.x = -Math.PI / 2;
    ind.todos = [ind.tira, ind.area, ind.borde, ind.sector, ...ind.puntos, ind.mira, ind.sombra];
    ind.todos.forEach((m) => { m.visible = false; scene.add(m); });
    return ind;
  }

  function quitarHumanos() {
    humanos.forEach((h) => {
      combate.quitar(h);
      [h.malla, h.anillo, ...h.ind.todos].forEach((m) => scene.remove(m));
      if (balon.portador === h) balon.portador = null;
      if (h.jugadorFiesta) h.jugadorFiesta.ent = null;
    });
    humanos = [];
    if (local) { local.ent = null; if (ctx.soltarLocal) ctx.soltarLocal(); }
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

  const vibrar = (j, ms) => {
    if (j.esLocal) { if (navigator.vibrate) navigator.vibrate(Math.round(ms)); return; }
    if (j.conectado) Red.enviar(j.id, { t: 'vibrar', ms: Math.round(ms) });
  };
  const avisar = (j, txt) => {
    if (j.esLocal) { if (ctx.pista) ctx.pista(txt); return; }
    if (j.conectado) Red.enviar(j.id, { t: 'aviso', txt });
  };

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
    ctx.resolverColisiones(h.pos, J.radio); // los obstáculos mandan
    // Mira hacia donde apunta; si no apunta, hacia donde camina
    const ap = !viejo && (j.input.dir || j.input.sp || (j.input.ap && !j.input.ap.c ? j.input.ap : null));
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
        } else if (Number.isFinite(+m.px) && Number.isFinite(+m.pz) && m.px !== null) {
          p = { x: +m.px, z: +m.pz }; // online desde computador: el punto exacto del mouse
        } else {
          p = puntoApuntado(h, +m.x || 0, +m.z || 0, +m.f || 0);
        }
        const conBalon = balon.portador === h;
        // Toque rápido con balón y con compañeros: pase al que esté más hacia donde miras
        if (conBalon && m.toque) {
          const c = mejorCompanero(h, h.dir.x, h.dir.z);
          if (c) { ctx.pasar(h, c); break; }
        }
        h.dir.set(p.x - h.pos.x, 0, p.z - h.pos.z);
        if (h.dir.lengthSq() < 0.001) h.dir.set(h.equipo === 'azul' ? 1 : -1, 0, 0);
        h.dir.normalize();
        if (conBalon) {
          // Si apuntas a un compañero (y no al aro), es un pase
          const c = companeroEn(h, p);
          if (c) ctx.pasar(h, c);
          else tirar(h, p);
        } else {
          // Robo automático: si atacas al que tiene el balón estando pegado a él
          if (roboAutomatico(h)) break;
          combate.atacar(h, s.ataque, p.x, p.z);
        }
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
        } else if (Number.isFinite(+m.px) && Number.isFinite(+m.pz) && m.px !== null) {
          p = { x: +m.px, z: +m.pz };
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

  // ¿Hay un compañero cerca del punto al que apuntas? (y no estás apuntando al aro)
  function companeroEn(h, p) {
    const aro = aroQueAtaca(h);
    if (Math.hypot(p.x - aro.x, p.z - aro.z) < T.radioIntentoTiro) return null;
    let mejor = null, md = 2.5;
    for (const e of combate.entidades) {
      if (e === h || !e.vivo || e.equipo !== h.equipo) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d < md && distancia(e.pos, h.pos) <= CONFIG.pase.distanciaMax) { md = d; mejor = e; }
    }
    return mejor;
  }

  // Compañero más hacia una dirección (para el pase con toque rápido)
  function mejorCompanero(h, dx, dz) {
    let mejor = null, mp = Infinity;
    for (const e of combate.entidades) {
      if (e === h || !e.vivo || e.equipo !== h.equipo) continue;
      const ex = e.pos.x - h.pos.x, ez = e.pos.z - h.pos.z;
      const d = Math.hypot(ex, ez);
      if (d > CONFIG.pase.distanciaMax) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (ex * dx + ez * dz) / (d || 1))));
      const pts = ang * 3 + d * 0.05;
      if (pts < mp) { mp = pts; mejor = e; }
    }
    return mejor;
  }

  // Robo sin botón: atacar pegado al rival que tiene el balón intenta quitárselo
  function roboAutomatico(h) {
    const p = balon.portador;
    if (!p || p.equipo === h.equipo || h.cdRobo > 0) return false;
    if (distancia(p.pos, h.pos) > CONFIG.robo.alcance + 0.5) return false;
    h.dir.set(p.pos.x - h.pos.x, 0, p.pos.z - h.pos.z).normalize();
    const ok = ctx.intentarRobo(h);
    if (ok) { avisar(h.jugadorFiesta, '¡Robo!'); vibrar(h.jugadorFiesta, 80); }
    return ok;
  }

  // (Antes era el botón PASE / ROBO; se deja por si un control viejo lo manda)
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
    const ind = h.ind;
    h.anillo.visible = h.vivo;
    h.anillo.position.set(h.pos.x, 0.04, h.pos.z);
    ind.todos.forEach((m) => { m.visible = false; });
    if (!h.vivo || !enJuego()) return;
    const s = CONFIG.personajes[h.personaje];
    const colorP = COLORES_P[(j.num - 1) % COLORES_P.length];

    // Pone una franja desde el personaje (ancho, largo) y un área (x, z, radio)
    const tira = (ang, ancho, largo) => {
      ind.tira.visible = true;
      ind.tira.position.set(h.pos.x, 0.06, h.pos.z);
      ind.tira.rotation.y = ang;
      ind.tira.scale.set(ancho, 1, Math.max(0.1, largo));
    };
    const area = (x, z, r) => {
      ind.area.visible = ind.borde.visible = true;
      ind.area.position.set(x, 0.07, z);
      ind.borde.position.set(x, 0.08, z);
      ind.area.scale.setScalar(r);
      ind.borde.scale.setScalar(r);
    };

    // ---- Súper (dorado) ----
    if (j.input.sp && h.carga >= 1) {
      const sp = j.input.sp, su = s.super;
      const alc = su.alcance || 0;
      const d = Math.max(1, sp.f * (alc || 4));
      const dist = Math.min(d, alc);
      const ang = Math.atan2(sp.x, sp.z);
      const x = h.pos.x + sp.x * dist, z = h.pos.z + sp.z * dist;
      ind.matZona.color.setHex(COL.dorado);
      ind.borde.material.color.setHex(COL.dorado);
      if (su.tipo === 'rafaga') tira(ang, 2 * Math.tan(THREE.MathUtils.degToRad(su.abanico / 2)) * alc * 0.5 + 0.6, alc);
      else if (su.tipo === 'salto' || su.tipo === 'lluvia') { tira(ang, 0.15, dist); area(x, z, su.radio); }
      else if (su.tipo === 'granBomba') { tira(ang, 0.15, dist); area(x, z, su.radioExplosion); }
      else if (su.tipo === 'escudo') area(h.pos.x, h.pos.z, su.radio);
      else area(h.pos.x, h.pos.z, 1.2);
      return;
    }

    const ap = j.input.ap;
    if (!ap || ap.c) return;
    const p = puntoApuntado(h, ap.x, ap.z, ap.f);
    const ang = Math.atan2(p.x - h.pos.x, p.z - h.pos.z);
    let dx = p.x - h.pos.x, dz = p.z - h.pos.z;
    const largo = Math.hypot(dx, dz) || 1;
    dx /= largo; dz /= largo;

    // ---- Con balón: arco del tiro (o del pase) ----
    if (balon.portador === h) {
      const companero = companeroEn(h, p);
      const aro = aroQueAtaca(h);
      const d = Math.min(largo, T.distanciaMaxLanzamiento);
      const salida = { x: h.pos.x + dx * 0.6, y: 2.1, z: h.pos.z + dz * 0.6 };
      let obj, tVuelo;
      if (companero) {
        obj = { x: companero.pos.x, y: 1.0, z: companero.pos.z };
        tVuelo = Math.max(0.25, Math.min(distancia(companero.pos, h.pos), CONFIG.pase.distanciaMax) / CONFIG.pase.velocidad);
        salida.y = 1.3;
      } else {
        obj = { x: h.pos.x + dx * d, y: C.aroAltura + 0.02, z: h.pos.z + dz * d };
        tVuelo = T.tiempoBase + d * T.tiempoPorDistancia;
      }
      const g = CONFIG.balon.gravedad;
      const vx = (obj.x - salida.x) / tVuelo, vz = (obj.z - salida.z) / tVuelo;
      const vy = (obj.y - salida.y + 0.5 * g * tVuelo * tVuelo) / tVuelo;
      // Las bolitas avanzan despacio por el arco para que se note hacia dónde va
      const corrida = (ctx.tiempo() * 1.5) % 1;
      ind.puntos.forEach((m, i) => {
        const t = ((i + corrida) / PUNTOS_ARCO) * tVuelo;
        m.position.set(salida.x + vx * t, salida.y + vy * t - 0.5 * g * t * t, salida.z + vz * t);
        m.scale.setScalar(1 - (i / PUNTOS_ARCO) * 0.35);
        m.visible = true;
      });
      // Color: verde = pase, dorado = triple, blanco = doble, gris = no va al aro
      const alAro = Math.hypot(obj.x - aro.x, obj.z - aro.z) < T.radioIntentoTiro;
      const triple = distancia(h.pos, aro) > C.radioTriple;
      const color = companero ? 0x7dff9a : !alAro ? 0x8888aa : triple ? COL.dorado : 0xffffff;
      ind.matArco.color.setHex(color);
      ind.mira.material.color.setHex(color);
      ind.mira.visible = ind.sombra.visible = true;
      ind.mira.position.set(obj.x, obj.y + 0.02, obj.z);
      ind.mira.rotation.z += 0.03;
      ind.sombra.position.set(obj.x, 0.05, obj.z);
      return;
    }

    // ---- Sin balón: forma del ataque ----
    const a = s.ataque;
    ind.matZona.color.setHex(h.cdAtaque > 0 ? 0x888899 : colorP);
    ind.borde.material.color.setHex(colorP);
    if (a.tipo === 'golpe') {
      ind.sector.visible = true;
      ind.sector.position.set(h.pos.x, 0.06, h.pos.z);
      ind.sector.rotation.y = ang;
    } else if (a.tipo === 'bomba') {
      const d = Math.min(largo, a.alcance);
      tira(ang, 0.12, d);
      area(h.pos.x + dx * d, h.pos.z + dz * d, a.radioExplosion);
    } else {
      tira(ang, Math.max(0.4, (a.radio || 0.2) * 2), a.alcance);
    }
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
      if (modo === 'fiesta') indicadores(h);
    }
    if (modo === 'online') return; // online: el estado va en las fotos del partido (online.js)
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
  window.__fiesta = { get balon() { return balon; }, get jugadores() { return lista(); }, get fase() { return fase; }, get humanos() { return humanos; }, sala };

  return {
    abrir, cerrar, empezar, irAPersonajes, volverAEquipos, alTerminar, volverASala, colocar, actualizar, cambiarAjuste, elegirLocal, listoLocal, datosSala,
    get modo() { return modo; },
    get local() { return local; },
    get fase() { return fase; },
    get activa() { return fase !== 'cerrada'; },
    get humanos() { return humanos; }
  };
}
