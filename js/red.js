/* ==========================================================
   ORBIX: OVERDRIVE — red.js
   Conexión entre la pantalla (computador) y los celulares
   con PeerJS (WebRTC). No necesita servidor propio.

   La pantalla abre una "sala" con un código de 4 letras.
   Cada celular se conecta a esa sala y se mandan mensajes JSON.
   ========================================================== */

const Red = (() => {
  const R = CONFIG.red;
  // Letras fáciles de leer (sin O, 0, I, 1...)
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  let peer = null;
  let codigo = '';
  const conexiones = new Map(); // id de conexión -> conexión
  const eventos = { conectado: null, mensaje: null, desconectado: null, error: null };

  function opcionesPeer() {
    const op = { debug: 0, config: { iceServers: R.stun.map((u) => ({ urls: u })) } };
    if (R.servidor) Object.assign(op, R.servidor);
    return op;
  }

  function codigoNuevo() {
    let c = '';
    for (let i = 0; i < 4; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)];
    return c;
  }

  // Abre la sala. alListo(codigo) se llama cuando ya se pueden conectar los celulares.
  function abrirSala(alListo, alError) {
    if (typeof Peer === 'undefined') {
      alError('No se pudo cargar PeerJS. Revisa la conexión a internet.');
      return;
    }
    cerrar();
    codigo = codigoNuevo();
    peer = new Peer(R.prefijo + codigo, opcionesPeer());

    peer.on('open', () => alListo(codigo));

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (conexiones.size >= R.maxJugadores) {
          conn.send({ t: 'llena' });
          setTimeout(() => conn.close(), 300);
          return;
        }
        conexiones.set(conn.peer, conn);
        if (eventos.conectado) eventos.conectado(conn.peer);
      });
      conn.on('data', (msg) => { if (eventos.mensaje) eventos.mensaje(conn.peer, msg); });
      const fin = () => {
        if (!conexiones.has(conn.peer)) return;
        conexiones.delete(conn.peer);
        if (eventos.desconectado) eventos.desconectado(conn.peer);
      };
      conn.on('close', fin);
      conn.on('error', fin);
    });

    peer.on('error', (e) => {
      // Si el código ya existe en el servidor, se prueba con otro
      if (e.type === 'unavailable-id') { abrirSala(alListo, alError); return; }
      if (e.type === 'peer-unavailable') return;
      const textos = {
        network: 'No hay conexión con el servidor de salas. Revisa el internet.',
        'server-error': 'El servidor de salas no responde. Intenta de nuevo en un momento.',
        'browser-incompatible': 'Este navegador no permite el Modo Fiesta. Usa Chrome, Edge o Firefox.'
      };
      if (alError) alError(textos[e.type] || `Error de conexión (${e.type}).`);
    });

    // Si se cae la conexión con el servidor, se intenta recuperar sin cerrar la sala
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* nada */ } });
  }

  function enviar(id, msg) {
    const c = conexiones.get(id);
    if (c && c.open) c.send(msg);
  }

  function enviarATodos(msg) {
    conexiones.forEach((c) => { if (c.open) c.send(msg); });
  }

  function cerrar() {
    conexiones.forEach((c) => c.close());
    conexiones.clear();
    if (peer) { peer.destroy(); peer = null; }
    codigo = '';
  }

  // Cierra la conexión de un celular (por ejemplo, si dejó de responder)
  function expulsar(id) {
    const c = conexiones.get(id);
    conexiones.delete(id);
    if (c) { try { c.close(); } catch (e) { /* nada */ } }
  }

  function on(nombre, fn) { eventos[nombre] = fn; }

  return {
    abrirSala, enviar, enviarATodos, cerrar, expulsar, on,
    get codigo() { return codigo; },
    get abierta() { return !!peer && !peer.destroyed; }
  };
})();
