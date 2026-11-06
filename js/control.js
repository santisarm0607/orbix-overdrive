/* ==========================================================
   ORBIX: OVERDRIVE — control.js
   El celular como control del Modo Fiesta.
   Se conecta a la pantalla con el código de la sala, deja
   elegir equipo y personaje, y durante el partido manda los
   movimientos y botones. Recibe la vida, la súper y vibra.
   ========================================================== */

(() => {
  const R = CONFIG.red;
  const TC = CONFIG.tactil;
  const $ = (id) => document.getElementById(id);

  // ---------- Datos que se recuerdan en el celular ----------
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let dispositivo = leer('orbix_dispositivo');
  if (!dispositivo) {
    dispositivo = Math.random().toString(36).slice(2, 10);
    guardar('orbix_dispositivo', dispositivo);
  }

  // ---------- Estado ----------
  let peer = null;
  let conn = null;
  let codigo = '';
  let yo = { num: 0, lider: false };
  let sala = null;            // lo que manda la pantalla sobre la sala
  let miEquipo = null;
  let miPersonaje = null;
  let listo = false;
  let fase = 'conectar';      // conectar | sala | juego | fin
  let estado = null;          // vida, súper, etc. durante el partido

  // ==========================================================
  // VISTAS
  // ==========================================================
  // Vibrar: Android lo hace con navigator.vibrate. El iPhone no lo permite en páginas web;
  // en iOS 18 o más se usa un truco (un interruptor escondido que da un "toque" de vibración).
  const esIPhone = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let tToque = 0;
  function vibrar(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* nada */ } return; }
    const ahora = performance.now();
    if (ahora - tToque < 120) return;
    tToque = ahora;
    const l = document.getElementById('toque-ios');
    if (l) { try { l.click(); } catch (e) { /* nada */ } }
  }
  document.body.classList.toggle('ios', esIPhone);

  function mostrarVista(id) {
    document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === id));
    document.body.classList.toggle('en-juego', id === 'vista-juego');
  }

  // ==========================================================
  // 1. CONECTAR
  // ==========================================================
  $('in-nombre').value = leer('orbix_nombre') || '';
  const codigoUrl = (location.hash || '').replace('#', '').toUpperCase().slice(0, 4);
  $('in-codigo').value = codigoUrl;
  $('in-codigo').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  if (codigoUrl && !$('in-nombre').value) $('in-nombre').focus();

  $('btn-conectar').addEventListener('click', conectar);
  $('btn-reconectar').addEventListener('click', () => { $('perdida').hidden = true; conectar(); });

  function msgConectar(t, error = false) {
    $('msg-conectar').textContent = t;
    $('msg-conectar').classList.toggle('error', error);
  }

  function conectar() {
    const nombre = $('in-nombre').value.trim().slice(0, 10) || 'Jugador';
    codigo = $('in-codigo').value.trim().toUpperCase();
    if (codigo.length !== 4) { msgConectar('Escribe el código de 4 letras que aparece en la pantalla.', true); return; }
    if (typeof Peer === 'undefined') { msgConectar('No se pudo cargar la conexión. Revisa el internet y recarga.', true); return; }
    guardar('orbix_nombre', nombre);
    msgConectar('Conectando…');
    $('btn-conectar').disabled = true;

    if (peer) { try { peer.destroy(); } catch (e) { /* nada */ } }
    const op = { debug: 0, config: { iceServers: R.stun.map((u) => ({ urls: u })) } };
    if (R.servidor) Object.assign(op, R.servidor);
    peer = new Peer(op);

    const tiempoLimite = setTimeout(() => {
      if (!conn || !conn.open) {
        msgConectar('No se encontró la sala. Revisa el código y que la pantalla siga en la sala.', true);
        $('btn-conectar').disabled = false;
      }
    }, 12000);

    peer.on('open', () => {
      conn = peer.connect(R.prefijo + codigo, { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        clearTimeout(tiempoLimite);
        conn.send({ t: 'hola', nombre, dispositivo });
      });
      conn.on('data', recibir);
      conn.on('close', perdida);
      conn.on('error', perdida);
    });
    peer.on('error', (e) => {
      clearTimeout(tiempoLimite);
      $('btn-conectar').disabled = false;
      const textos = {
        'peer-unavailable': 'No existe una sala con ese código. Revisa las letras en la pantalla.',
        network: 'Sin conexión con el servidor de salas. Revisa el internet.',
        'browser-incompatible': 'Este navegador no sirve para el control. Usa Chrome o Safari actualizado.'
      };
      msgConectar(textos[e.type] || `No se pudo conectar (${e.type}).`, true);
    });
  }

  function perdida() {
    if (fase === 'conectar') return;
    $('perdida').hidden = false;
    $('btn-conectar').disabled = false;
    // Si la página está a la vista, intenta volver a entrar sola en 1 s
    if (document.visibilityState === 'visible') setTimeout(reconectarSolo, 1000);
  }
  let reconectando = false;
  function reconectarSolo() {
    if ($('perdida').hidden || reconectando) return;
    reconectando = true;
    $('perdida').hidden = true;
    conectar();
    setTimeout(() => { reconectando = false; }, 4000);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !$('perdida').hidden) reconectarSolo();
  });

  function enviar(msg) {
    if (conn && conn.open) conn.send(msg);
  }

  // ==========================================================
  // MENSAJES DE LA PANTALLA
  // ==========================================================
  function recibir(m) {
    switch (m.t) {
      case 'llena':
        msgConectar('La sala está llena (máximo 6 jugadores).', true);
        break;
      case 'bienvenido':
        yo = { num: m.num, lider: m.lider };
        $('perdida').hidden = true;
        if (m.equipo) miEquipo = m.equipo;
        if (m.personaje) miPersonaje = m.personaje;
        listo = !!m.listo;
        irASala();
        break;
      case 'sala':
        sala = m;
        actualizarSala();
        break;
      case 'fase':
        if (m.f === 'juego') irAJuego();
        else if (m.f === 'sala') irASala();
        break;
      case 'estado':
        estado = m;
        actualizarControl();
        break;
      case 'vibrar':
        vibrar(m.ms || 60);
        break;
      case 'fin':
        mostrarFin(m);
        break;
      case 'cerrada':
        msgConectar('La pantalla cerró la sala.', true);
        break;
      case 'aviso':
        if (fase === 'juego') aviso(m.txt);
        break;
    }
  }

  // ==========================================================
  // 2. SALA
  // ==========================================================
  // Personajes
  const grid = $('grid-pj');
  Personajes.lista.forEach((id) => {
    const inf = Personajes.info[id];
    const b = document.createElement('button');
    b.className = 'pj';
    b.dataset.id = id;
    b.style.setProperty('--c', inf.color);
    b.innerHTML = `<span class="ini">${inf.nombre[0]}</span><b>${inf.nombre}</b><small>${inf.rol}</small><em class="quien"></em>`;
    b.addEventListener('click', () => {
      if (b.classList.contains('ocupado')) return;
      miPersonaje = id;
      listo = false;
      enviar({ t: 'elegir', personaje: id });
      pintarSala();
    });
    grid.appendChild(b);
  });

  ['azul', 'rojo'].forEach((eq) => {
    $(`eq-${eq}`).addEventListener('click', () => {
      if ($(`eq-${eq}`).disabled) return;
      miEquipo = eq;
      listo = false;
      enviar({ t: 'elegir', equipo: eq });
      pintarSala();
    });
  });

  $('btn-listo').addEventListener('click', () => {
    if (!miEquipo || !miPersonaje) { $('msg-sala').textContent = 'Primero elige equipo y personaje.'; return; }
    listo = !listo;
    enviar({ t: 'listo', v: listo });
    pintarSala();
  });

  // Ajustes del líder
  [...CONFIG.mapas.orden, 'azar'].forEach((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id === 'azar' ? '🎲 Al azar' : `${CONFIG.mapas[id].icono} ${CONFIG.mapas[id].nombre}`;
    $('sel-mapa').appendChild(o);
  });
  $('sel-mapa').addEventListener('change', (e) => enviar({ t: 'config', mapa: e.target.value }));
  $('bots-si').addEventListener('click', () => enviar({ t: 'config', bots: true }));
  $('bots-no').addEventListener('click', () => enviar({ t: 'config', bots: false }));
  document.querySelectorAll('.opcion.tam').forEach((b) => b.addEventListener('click', () => enviar({ t: 'config', tamano: +b.dataset.tam })));

  function irASala() {
    fase = 'sala';
    mostrarVista('vista-sala');
    $('sala-codigo').textContent = codigo;
    $('sala-nombre').textContent = $('in-nombre').value.trim() || 'Jugador';
    $('chip-num').textContent = `P${yo.num}`;
    pintarSala();
  }

  function actualizarSala() {
    if (!sala) return;
    const mio = sala.jugadores.find((j) => j.num === yo.num);
    if (mio) {
      yo.lider = mio.lider;
      // La pantalla manda (por ejemplo, si otro tomó el personaje primero)
      miEquipo = mio.equipo;
      miPersonaje = mio.personaje;
      listo = mio.listo;
    }
    pintarSala();
  }

  function pintarSala() {
    const js = sala ? sala.jugadores : [];
    const tam = (sala && sala.tamano) || 3;
    // Equipos
    ['azul', 'rojo'].forEach((eq) => {
      const n = js.filter((j) => j.equipo === eq && j.num !== yo.num).length;
      const btn = $(`eq-${eq}`);
      $(`cnt-${eq}`).textContent = `${n + (miEquipo === eq ? 1 : 0)}/${tam}`;
      btn.disabled = n >= tam && miEquipo !== eq;
      btn.classList.toggle('activo', miEquipo === eq);
    });
    // Personajes: los que tomó otra persona quedan bloqueados
    document.querySelectorAll('.pj').forEach((b) => {
      const otro = js.find((j) => j.personaje === b.dataset.id && j.num !== yo.num);
      b.classList.toggle('ocupado', !!otro);
      b.classList.toggle('activo', miPersonaje === b.dataset.id);
      b.querySelector('.quien').textContent = otro ? otro.nombre : '';
    });
    if (miPersonaje) {
      const inf = Personajes.info[miPersonaje];
      $('pj-info').innerHTML = `<b style="color:${inf.color}">${inf.nombre}</b> · ${inf.desc} <br><span class="dorado">Súper:</span> ${inf.superDesc}`;
    } else {
      $('pj-info').textContent = 'Toca un personaje para ver qué hace.';
    }
    // Líder
    $('zona-lider').hidden = !yo.lider;
    if (sala) {
      $('sel-mapa').value = sala.mapa;
      $('bots-si').classList.toggle('activa', sala.bots);
      $('bots-no').classList.toggle('activa', !sala.bots);
      document.querySelectorAll('.opcion.tam').forEach((b) => b.classList.toggle('activa', +b.dataset.tam === tam));
    }
    // Listo
    const btn = $('btn-listo');
    btn.textContent = listo ? '✔ LISTO (toca para cambiar)' : '¡LISTO!';
    btn.classList.toggle('esta-listo', listo);
    btn.disabled = !miEquipo || !miPersonaje;
    // Mensaje
    let msg = '';
    if (!miEquipo || !miPersonaje) msg = 'Elige equipo y personaje.';
    else if (sala && sala.cuenta != null) msg = `¡El partido empieza en ${sala.cuenta}!`;
    else if (sala && sala.motivo) msg = sala.motivo;
    else if (listo) msg = 'Esperando a los demás…';
    $('msg-sala').textContent = msg;
  }

  // ==========================================================
  // 3. CONTROL DURANTE EL PARTIDO
  // ==========================================================
  function irAJuego() {
    fase = 'juego';
    mostrarVista('vista-juego');
    const inf = Personajes.info[miPersonaje] || { nombre: '', color: '#fff' };
    $('j-num').textContent = `P${yo.num}`;
    $('j-num').className = `chip ${miEquipo}`;
    $('j-nombre').textContent = `${$('in-nombre').value.trim() || 'Jugador'} · ${inf.nombre}`;
    $('j-nombre').style.color = inf.color;
    pedirPantallaDespierta();
  }

  // ---------- Sticks ----------
  // mover: aparece donde pongas el dedo (mitad izquierda)
  const mover = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
  // ataque y súper: arrastrar para apuntar, soltar para usar
  const ataque = { id: null, x0: 0, y0: 0, dx: 0, dy: 0, arrastrado: false, t0: 0 };
  const superS = { id: null, x0: 0, y0: 0, dx: 0, dy: 0, arrastrado: false };

  const zonaMover = $('zona-mover');
  const stickMover = $('stick-mover');
  const perillaMover = stickMover.querySelector('.perilla');
  const stickAtaque = $('stick-ataque');
  const perillaAtaque = stickAtaque.querySelector('.perilla');

  // En algunos iPhone "capturar el dedo" falla y antes eso dejaba el stick sin funcionar
  function capturar(el, id) {
    try { el.setPointerCapture(id); } catch (e) { /* el dedo igual se sigue por la pantalla */ }
  }

  // Dónde dibujar el stick: donde tocaste, corrido hacia adentro si estabas muy cerca de un borde.
  // Devuelve la posición relativa a la zona (antes se usaba la de la pantalla y quedaba más abajo del dedo).
  function centroStick(zona, stick, x, y) {
    const r = zona.getBoundingClientRect();
    const radio = stick.offsetWidth / 2 + 6;
    const izq = parseFloat(getComputedStyle(zona).paddingLeft) || 0; // muesca del iPhone
    const abajo = Math.min(r.bottom, window.innerHeight);
    const cx = Math.max(r.left + izq + radio, Math.min(r.right - radio, x));
    const cy = Math.max(r.top + radio, Math.min(abajo - radio, y));
    return { x: cx - r.left, y: cy - r.top };
  }

  function vector(s, radio) {
    let x = s.dx / radio, y = s.dy / radio;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }

  zonaMover.addEventListener('pointerdown', (e) => {
    if (mover.id !== null) return;
    e.preventDefault();
    capturar(zonaMover, e.pointerId);
    // El stick aparece donde tocas, pero siempre completo dentro de la zona (sin salirse de la pantalla)
    const c = centroStick(zonaMover, stickMover, e.clientX, e.clientY);
    Object.assign(mover, { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
    stickMover.style.left = `${c.x}px`;
    stickMover.style.top = `${c.y}px`;
    stickMover.classList.add('activo');
  });
  zonaMover.addEventListener('pointermove', (e) => {
    if (e.pointerId !== mover.id) return;
    mover.dx = e.clientX - mover.x0;
    mover.dy = e.clientY - mover.y0;
    const v = vector(mover, TC.radioJoystick);
    perillaMover.style.transform = `translate(${v.x * TC.radioJoystick}px, ${v.y * TC.radioJoystick}px)`;
  });
  const soltarMover = (e) => {
    if (e.pointerId !== mover.id) return;
    Object.assign(mover, { id: null, dx: 0, dy: 0 });
    perillaMover.style.transform = '';
    stickMover.classList.remove('activo');
  };
  zonaMover.addEventListener('pointerup', soltarMover);
  zonaMover.addEventListener('pointercancel', soltarMover);
  // Si el celular no "capturó" el dedo, se sigue en toda la pantalla
  document.addEventListener('pointermove', (e) => {
    if (e.target === zonaMover || zonaMover.contains(e.target)) return;
    if (e.pointerId === mover.id) zonaMover.dispatchEvent(new PointerEvent('pointermove', e));
  });
  document.addEventListener('pointerup', (e) => { if (e.pointerId === mover.id && !zonaMover.contains(e.target)) soltarMover(e); });

  // Stick de ataque / tiro
  function alcanceAtaque() { return Math.min(1, Math.hypot(ataque.dx, ataque.dy) / TC.radioApuntado); }
  stickAtaque.addEventListener('pointerdown', (e) => {
    if (ataque.id !== null) return;
    e.preventDefault();
    capturar(stickAtaque, e.pointerId);
    const r = stickAtaque.getBoundingClientRect();
    Object.assign(ataque, { id: e.pointerId, x0: r.left + r.width / 2, y0: r.top + r.height / 2, dx: 0, dy: 0, arrastrado: false, t0: performance.now() });
    stickAtaque.classList.add('activo');
  });
  stickAtaque.addEventListener('pointermove', (e) => {
    if (e.pointerId !== ataque.id) return;
    ataque.dx = e.clientX - ataque.x0;
    ataque.dy = e.clientY - ataque.y0;
    const f = alcanceAtaque();
    if (f > TC.zonaCancelar) ataque.arrastrado = true;
    const m = Math.hypot(ataque.dx, ataque.dy) || 1;
    perillaAtaque.style.transform = `translate(${(ataque.dx / m) * f * TC.radioApuntado}px, ${(ataque.dy / m) * f * TC.radioApuntado}px)`;
    stickAtaque.classList.toggle('cancelar', ataque.arrastrado && f < TC.zonaCancelar);
  });
  stickAtaque.addEventListener('pointerup', (e) => {
    if (e.pointerId !== ataque.id) return;
    const f = alcanceAtaque();
    const m = Math.hypot(ataque.dx, ataque.dy) || 1;
    if (ataque.arrastrado && f >= TC.zonaCancelar) {
      enviar({ t: 'accion', a: 'principal', x: ataque.dx / m, z: ataque.dy / m, f: (f - TC.zonaCancelar) / (1 - TC.zonaCancelar) });
    } else if (!ataque.arrastrado && performance.now() - ataque.t0 < TC.tiempoToque * 1000) {
      enviar({ t: 'accion', a: 'principal', toque: true });
    }
    soltarAtaque();
  });
  stickAtaque.addEventListener('pointercancel', (e) => { if (e.pointerId === ataque.id) soltarAtaque(); });
  function soltarAtaque() {
    Object.assign(ataque, { id: null, dx: 0, dy: 0, arrastrado: false });
    perillaAtaque.style.transform = '';
    stickAtaque.classList.remove('activo', 'cancelar');
  }

  // Botón súper (también es un stick)
  const bSuper = $('b-super');
  bSuper.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (superS.id !== null) return;
    if (!estado || estado.carga < 1) { aviso(`Súper al ${estado ? Math.floor(estado.carga * 100) : 0} %`); return; }
    capturar(bSuper, e.pointerId);
    const r = bSuper.getBoundingClientRect();
    Object.assign(superS, { id: e.pointerId, x0: r.left + r.width / 2, y0: r.top + r.height / 2, dx: 0, dy: 0, arrastrado: false });
    bSuper.classList.add('activo');
  });
  bSuper.addEventListener('pointermove', (e) => {
    if (e.pointerId !== superS.id) return;
    superS.dx = e.clientX - superS.x0;
    superS.dy = e.clientY - superS.y0;
    if (Math.hypot(superS.dx, superS.dy) > 18) superS.arrastrado = true;
  });
  bSuper.addEventListener('pointerup', (e) => {
    if (e.pointerId !== superS.id) return;
    const m = Math.hypot(superS.dx, superS.dy) || 1;
    if (superS.arrastrado) enviar({ t: 'accion', a: 'super', x: superS.dx / m, z: superS.dy / m, f: Math.min(1, m / TC.radioApuntado) });
    else enviar({ t: 'accion', a: 'super', toque: true });
    superS.id = null;
    superS.arrastrado = false;
    bSuper.classList.remove('activo');
  });
  bSuper.addEventListener('pointercancel', () => { superS.id = null; bSuper.classList.remove('activo'); });

  // Botones simples
  const boton = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); vibrar(15); });
  boton('b-impulso', () => enviar({ t: 'accion', a: 'impulso' }));

  // ---------- iPhone (Safari) ----------
  // Safari no respeta "sin zoom": usar los dos pulgares a la vez lo toma como pellizco (zoom),
  // y mantener el dedo quieto abre la lupa o selecciona texto. Aquí se bloquea todo eso
  // durante el partido. Los sticks y botones siguen funcionando porque usan "pointer".
  const bloquearToque = (e) => {
    if (fase !== 'juego') return;
    if (e.target.closest && e.target.closest('#btn-pantalla, #perdida, #gira')) return;
    e.preventDefault();
  };
  document.addEventListener('touchstart', bloquearToque, { passive: false });
  document.addEventListener('touchmove', bloquearToque, { passive: false });
  document.addEventListener('touchend', bloquearToque, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => { if (fase === 'juego') e.preventDefault(); });

  // ---------- Envío continuo de los sticks ----------
  setInterval(() => {
    if (fase !== 'juego') return;
    const v = vector(mover, TC.radioJoystick);
    let mx = 0, mz = 0;
    if (mover.id !== null && v.m > TC.zonaMuerta) {
      const fuerza = (v.m - TC.zonaMuerta) / (1 - TC.zonaMuerta);
      mx = (v.x / v.m) * fuerza;
      mz = (v.y / v.m) * fuerza;
    }
    const msg = { t: 'in', mx: +mx.toFixed(3), mz: +mz.toFixed(3) };
    // Para dibujar en la pantalla hacia dónde apuntas
    if (ataque.id !== null && ataque.arrastrado) {
      const f = alcanceAtaque();
      const m = Math.hypot(ataque.dx, ataque.dy) || 1;
      msg.ap = { x: +(ataque.dx / m).toFixed(3), z: +(ataque.dy / m).toFixed(3), f: +((f - TC.zonaCancelar) / (1 - TC.zonaCancelar)).toFixed(3), c: f < TC.zonaCancelar };
    }
    if (superS.id !== null && superS.arrastrado) {
      const m = Math.hypot(superS.dx, superS.dy) || 1;
      msg.sp = { x: +(superS.dx / m).toFixed(3), z: +(superS.dy / m).toFixed(3), f: +Math.min(1, m / TC.radioApuntado).toFixed(3) };
    }
    enviar(msg);
  }, R.envioControl);

  // Latido: cada 2 s le dice a la pantalla "sigo aquí" (así detecta celulares que se fueron)
  setInterval(() => { if (fase !== 'conectar') enviar({ t: 'ping' }); }, 2000);

  // ---------- Vida, súper y marcador ----------
  function formatoTiempo(seg) {
    const s = Math.max(0, Math.ceil(seg));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  let vidaAntes = null;
  function actualizarControl() {
    if (!estado) return;
    const e = estado;
    if (vidaAntes !== null && e.vivo && e.vida < vidaAntes - 1) {
      const g = $('golpe');
      g.classList.remove('activo');
      void g.offsetWidth; // reinicia la animación
      g.classList.add('activo');
    }
    vidaAntes = e.vivo ? e.vida : null;
    const fv = Math.max(0, e.vida / e.vidaMax);
    $('j-vida').style.width = `${fv * 100}%`;
    $('j-vida').classList.toggle('baja', fv < 0.35);
    $('j-vida-num').textContent = Math.ceil(e.vida);
    $('j-super').style.width = `${Math.min(1, e.carga) * 100}%`;
    $('j-super-num').textContent = e.carga >= 1 ? '¡LISTA!' : `${Math.floor(e.carga * 100)}%`;
    bSuper.classList.toggle('listo', e.carga >= 1);
    bSuper.style.setProperty('--carga', Math.min(1, e.carga));
    $('j-az').textContent = e.az;
    $('j-ro').textContent = e.ro;
    $('j-tiempo').textContent = e.prorroga ? 'PRÓRROGA' : formatoTiempo(e.tiempo);
    // Impulso con cuenta regresiva
    $('cd-impulso').textContent = e.cdImp > 0 ? Math.ceil(e.cdImp) : '';
    $('b-impulso').classList.toggle('listo', e.cdImp <= 0);
    // Con balón: el stick se ve dorado
    stickAtaque.classList.toggle('con-balon', !!e.conBalon);
    // Avisos
    let txt = '';
    if (!e.vivo) txt = `ELIMINADO · reapareces en ${Math.max(1, Math.ceil(e.tRe))}`;
    else if (e.cuenta > 0) txt = `¡Prepárate! ${Math.ceil(e.cuenta)}`;
    else if (e.escudo > 0) txt = `Escudo ${Math.ceil(e.escudo)}`;
    const av = $('aviso-estado');
    if (av.dataset.fijo !== txt) {
      av.dataset.fijo = txt;
      if (txt) { av.textContent = txt; av.classList.add('visible'); }
      else if (!av.dataset.temporal) av.classList.remove('visible');
    }
  }

  let timerAviso = null;
  function aviso(t) {
    const av = $('aviso-estado');
    av.textContent = t;
    av.dataset.temporal = '1';
    av.classList.add('visible');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => {
      av.dataset.temporal = '';
      if (!av.dataset.fijo) av.classList.remove('visible');
      else av.textContent = av.dataset.fijo;
    }, 1200);
  }

  // ==========================================================
  // 4. RESULTADO
  // ==========================================================
  function mostrarFin(m) {
    fase = 'fin';
    mostrarVista('vista-fin');
    const gano = m.ganador === miEquipo;
    const titulo = m.ganador ? (gano ? '¡GANÓ TU EQUIPO!' : 'Ganó el otro equipo') : '¡EMPATE!';
    $('fin-titulo').textContent = titulo;
    $('fin-titulo').className = m.ganador ? (gano ? 'gano' : 'perdio') : '';
    $('fin-marcador').innerHTML = `<span class="azul">${m.az}</span> - <span class="rojo">${m.ro}</span>`;
    const yoStats = (m.tabla || []).find((f) => f.num === yo.num);
    $('fin-yo').innerHTML = yoStats
      ? `<li><span>Puntos</span><b>${yoStats.puntos}</b></li><li><span>Eliminaciones</span><b>${yoStats.elims}</b></li>`
      : '';
    $('fin-msg').textContent = 'Volvemos a la sala en unos segundos…';
    vibrar(gano ? [80, 60, 80, 60, 200] : 200);
    listo = false;
  }

  // ==========================================================
  // Otros
  // ==========================================================
  // Pantalla completa (el iPhone no la permite en páginas web: el botón se esconde)
  if (!document.documentElement.requestFullscreen) $('btn-pantalla').hidden = true;
  $('btn-pantalla').addEventListener('click', () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Que la pantalla del celular no se apague mientras juegas
  let bloqueo = null;
  async function pedirPantallaDespierta() {
    try { if ('wakeLock' in navigator && !bloqueo) bloqueo = await navigator.wakeLock.request('screen'); } catch (e) { /* nada */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && fase === 'juego') { bloqueo = null; pedirPantallaDespierta(); } });

  // Aviso para girar el celular durante el partido
  function revisarGiro() {
    const vertical = window.innerHeight > window.innerWidth;
    $('gira').classList.toggle('visible', vertical && fase === 'juego');
  }
  window.addEventListener('resize', revisarGiro);
  setInterval(revisarGiro, 500);

  // Para pruebas automáticas
  window.__control = { enviar, get fase() { return fase; }, get estado() { return estado; }, get yo() { return yo; } };
})();
