/* ==========================================================
   ORBIX: OVERDRIVE — combate.js
   Ataques (proyectil, golpe, bomba, rayo), súper habilidades,
   vida, escudos, daño, eliminación, reaparición con protección,
   barras de vida y números de daño.
   ========================================================== */

// Se crea desde game.js pasándole lo que necesita del juego.
function crearCombate(ctx) {
  const { scene, camera, lanzarParticulas, resolverColisiones, alEliminar, alReaparecer, sacudir, alUsarSuper } = ctx;
  // MODO ESPEJO (online, en el equipo del que se unió): el combate solo dibuja efectos.
  // La vida, las eliminaciones y la súper las manda el anfitrión.
  let espejo = false;
  // Avisa al online de cada ataque, súper o impacto (el anfitrión se los manda a los demás)
  const avisarAccion = (...datos) => { if (ctx.alAccion && !espejo) ctx.alAccion(...datos); };
  // Números al azar con semilla: así la lluvia de meteoritos cae igual en todas las pantallas
  function aleatorio(semilla) {
    if (!semilla) return Math.random;
    let a = semilla >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const SP = CONFIG.super;
  const CB = CONFIG.combate;
  const COL = CONFIG.colores;

  // Todos los que pueden recibir daño (el jugador y los bots)
  const entidades = [];

  const capaBarras = document.getElementById('capa-barras');
  const capaNumeros = document.getElementById('capa-numeros');

  // ==========================================================
  // ENTIDADES
  // ==========================================================
  // Prepara una entidad para el combate (le pone vida, barra, etc.)
  function registrar(ent, opciones) {
    Object.assign(ent, {
      vidaMax: opciones.vida,
      vida: opciones.vida,
      vivo: true,
      proteccion: 0,
      tReaparecer: 0,
      tSinCombate: 99,
      cdAtaque: 0,
      tFlash: 0,
      radio: opciones.radio || 0.6,
      aparicion: opciones.aparicion,
      tiempoReaparicion: opciones.tiempoReaparicion || CB.tiempoReaparicion,
      nombre: opciones.nombre || '',
      eliminaciones: 0,
      puntos: 0,           // puntos anotados (tabla del Modo Fiesta)
      carga: 0,            // súper: 0 a 1
      escudo: 0,           // vida extra del escudo de Lumen
      tEscudo: 0,
      tTurbo: 0,           // súper de Zip
      salto: null,         // súper de Kraag
      alturaExtra: 0,
      empuje: new THREE.Vector3(),
      multDaño: opciones.multDaño || 1
    });
    // Barra de vida (HTML) que flota sobre la cabeza
    const barra = document.createElement('div');
    barra.className = `barra-ent ${ent.equipo}${ent.esJugador ? ' jugador' : ''}${ent.esRemoto ? ' humano' : ''}`;
    barra.innerHTML = `<span class="emote"></span><span class="nombre">${ent.nombre}</span><div class="vida"><i></i></div><span class="num"></span>`;
    capaBarras.appendChild(barra);
    ent.barra = barra;
    ent.barraRelleno = barra.querySelector('i');
    ent.barraNum = barra.querySelector('.num');
    // Burbuja de protección
    const burbuja = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.25, wireframe: true })
    );
    burbuja.position.y = 0.9;
    burbuja.visible = false;
    ent.malla.add(burbuja);
    ent.burbuja = burbuja;
    // Escudo dorado (súper de Lumen)
    const escudo = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.25, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.3, wireframe: true })
    );
    escudo.position.y = 0.9;
    escudo.visible = false;
    ent.malla.add(escudo);
    ent.mallaEscudo = escudo;
    entidades.push(ent);
    return ent;
  }

  function quitar(ent) {
    const i = entidades.indexOf(ent);
    if (i >= 0) entidades.splice(i, 1);
    if (ent.barra) ent.barra.remove();
  }

  // Saca a alguien del partido sin borrarlo (Modo Fiesta: el jugador local no juega)
  function sacar(ent) {
    const i = entidades.indexOf(ent);
    if (i >= 0) entidades.splice(i, 1);
    if (ent.barra) ent.barra.style.display = 'none';
    ent.malla.visible = false;
  }

  // Lo vuelve a meter (al salir del Modo Fiesta)
  function meter(ent) {
    if (!entidades.includes(ent)) entidades.push(ent);
    ent.malla.visible = true;
  }

  // Cambia la malla de una entidad (por ejemplo al elegir otro personaje)
  function cambiarMalla(ent, malla) {
    if (ent.malla) {
      if (ent.burbuja) ent.malla.remove(ent.burbuja);
      if (ent.mallaEscudo) ent.malla.remove(ent.mallaEscudo);
      scene.remove(ent.malla);
    }
    ent.malla = malla;
    scene.add(malla);
    if (ent.burbuja) malla.add(ent.burbuja);
    if (ent.mallaEscudo) malla.add(ent.mallaEscudo);
  }

  // ==========================================================
  // DAÑO, CURACIÓN, ELIMINACIÓN Y REAPARICIÓN
  // ==========================================================
  // Carga la súper de "ent" (no se carga con el daño de otra súper)
  function cargarSuper(ent, fraccion) {
    if (espejo || !ent || !ent.vivo) return;
    const antes = ent.carga;
    ent.carga = Math.min(1, ent.carga + fraccion);
    if (antes < 1 && ent.carga >= 1) {
      if (ent.esJugador) Sonido.sfx.superLista();
      if (ent.alSuperLista) ent.alSuperLista(); // Modo Fiesta: avisa al celular
    }
  }

  function hacerDaño(objetivo, cantidad, atacante, esSuper = false) {
    if (espejo || !objetivo.vivo || objetivo.proteccion > 0) return;
    if (atacante && !esSuper) cargarSuper(atacante, cantidad / SP.dañoParaCargar);
    // El escudo absorbe primero
    if (objetivo.escudo > 0) {
      const absorbe = Math.min(objetivo.escudo, cantidad);
      objetivo.escudo -= absorbe;
      cantidad -= absorbe;
      if (cantidad <= 0) {
        lanzarParticulas(objetivo.pos.x, 1, objetivo.pos.z, 0xffe066, 4, 3, 6, 0.3);
        return;
      }
    }
    objetivo.vida -= cantidad;
    objetivo.tSinCombate = 0;
    if (atacante) atacante.tSinCombate = 0;
    objetivo.tFlash = 0.12;
    // Números flotantes solo para personas (no entre bots)
    if (objetivo.esHumano || (atacante && atacante.esHumano)) {
      numero(objetivo, cantidad, objetivo.esHumano ? 'recibido' : 'daño');
    }
    // Modo Fiesta: el celular de esa persona vibra
    if (objetivo.alDaño) objetivo.alDaño(cantidad, objetivo.vida <= 0);
    lanzarParticulas(objetivo.pos.x, 1, objetivo.pos.z, 0xffffff, 6, 4, 9, 0.4);
    if (objetivo.esJugador) Sonido.sfx.dañoRecibido();
    else if (atacante && atacante.esJugador) Sonido.sfx.impacto();
    if (ctx.alDañar) ctx.alDañar(objetivo, cantidad, atacante, objetivo.vida <= 0);
    if (objetivo.vida <= 0) eliminar(objetivo, atacante, esSuper);
  }

  function curar(objetivo, cantidad, curador, esSuper = false) {
    if (espejo || !objetivo.vivo || objetivo.vida >= objetivo.vidaMax) return;
    const real = Math.min(cantidad, objetivo.vidaMax - objetivo.vida);
    objetivo.vida += real;
    if (curador && !esSuper) cargarSuper(curador, real / SP.curaParaCargar);
    if (objetivo.esHumano || (curador && curador.esHumano)) numero(objetivo, real, 'cura');
  }

  function eliminar(ent, atacante, esSuper = false) {
    ent.vivo = false;
    ent.vida = 0;
    ent.escudo = 0;
    ent.tTurbo = 0;
    ent.salto = null;
    ent.alturaExtra = 0;
    ent.empuje.set(0, 0, 0);
    ent.tReaparecer = ent.tiempoReaparicion;
    ent.malla.visible = false;
    const color = ent.equipo === 'azul' ? COL.azul : COL.rojo;
    lanzarParticulas(ent.pos.x, 1, ent.pos.z, color, 30, 7, 9, 1);
    lanzarParticulas(ent.pos.x, 1, ent.pos.z, 0xffffff, 12, 5, 9, 0.8);
    Sonido.sfx.eliminado();
    if (atacante) atacante.eliminaciones++;
    alEliminar(ent, atacante, esSuper);
  }

  // ---- Efectos para el modo espejo (los llama el online cuando llega el estado del anfitrión) ----
  function efectoGolpe(ent, cantidad, tipo) {
    ent.tFlash = 0.12;
    if (tipo) numero(ent, cantidad, tipo);
    if (tipo !== 'cura') lanzarParticulas(ent.pos.x, 1, ent.pos.z, 0xffffff, 6, 4, 9, 0.4);
  }
  function efectoEliminar(ent) {
    ent.malla.visible = false;
    const color = ent.equipo === 'azul' ? COL.azul : COL.rojo;
    lanzarParticulas(ent.pos.x, 1, ent.pos.z, color, 30, 7, 9, 1);
    lanzarParticulas(ent.pos.x, 1, ent.pos.z, 0xffffff, 12, 5, 9, 0.8);
    Sonido.sfx.eliminado();
  }
  function efectoReaparecer(ent) {
    ent.malla.visible = true;
    lanzarParticulas(ent.pos.x, 0.5, ent.pos.z, 0x9ff4ff, 20, 4, 2, 0.8);
    alReaparecer(ent);
  }

  function reaparecer(ent) {
    ent.vivo = true;
    ent.vida = ent.vidaMax;
    ent.pos.set(ent.aparicion.x, 0, ent.aparicion.z);
    if (ent.vel) ent.vel.set(0, 0, 0);
    ent.malla.visible = true;
    ent.malla.position.copy(ent.pos);
    ent.proteccion = CB.proteccion;
    ent.tSinCombate = 99;
    lanzarParticulas(ent.pos.x, 0.5, ent.pos.z, 0x9ff4ff, 20, 4, 2, 0.8);
    alReaparecer(ent);
  }

  // Después de una canasta: todos vuelven con la vida llena (y los eliminados reviven).
  // La carga de la súper se conserva.
  function restaurarTodos() {
    proyectiles.forEach((p) => desactivar(p));
    meteoros.forEach((m) => { if (m.malla) scene.remove(m.malla); });
    meteoros.length = 0;
    entidades.forEach((e) => {
      e.vivo = true;
      e.vida = e.vidaMax;
      e.tReaparecer = 0;
      e.proteccion = 0;
      e.cdAtaque = 0;
      e.escudo = 0;
      e.tEscudo = 0;
      e.tTurbo = 0;
      e.salto = null;
      e.alturaExtra = 0;
      e.empuje.set(0, 0, 0);
      e.tSinCombate = 99;
      e.malla.visible = true;
      if (e.aparicion) {
        e.pos.set(e.aparicion.x, 0, e.aparicion.z);
        lanzarParticulas(e.pos.x, 0.6, e.pos.z, 0x7dff9a, 10, 3, 2, 0.6);
      }
    });
  }

  // Reinicia a todos (al empezar un partido)
  function reiniciarTodos() {
    proyectiles.forEach((p) => desactivar(p));
    meteoros.length = 0;
    entidades.forEach((e) => {
      e.vida = e.vidaMax;
      e.vivo = true;
      e.proteccion = 0;
      e.cdAtaque = 0;
      e.tSinCombate = 99;
      e.eliminaciones = 0;
      e.puntos = 0;
      e.carga = 0;
      e.escudo = 0;
      e.tTurbo = 0;
      e.salto = null;
      e.alturaExtra = 0;
      e.empuje.set(0, 0, 0);
      e.malla.visible = true;
      if (e.aparicion) e.pos.set(e.aparicion.x, 0, e.aparicion.z);
    });
  }

  // ==========================================================
  // PROYECTILES (balas, rayos y bombas)
  // ==========================================================
  const proyectiles = [];
  const geoBala = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(geoBala, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false;
    scene.add(m);
    // Círculo de aviso para las bombas (los ataques peligrosos se anuncian)
    const aviso = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 28),
      new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    aviso.rotation.x = -Math.PI / 2;
    aviso.position.y = 0.05;
    aviso.visible = false;
    scene.add(aviso);
    proyectiles.push({ activo: false, m, aviso, pos: new THREE.Vector3(), vel: new THREE.Vector3(), golpeados: new Set() });
  }

  function nuevoProyectil() {
    return proyectiles.find((p) => !p.activo) || null;
  }

  function desactivar(p) {
    p.activo = false;
    p.m.visible = false;
    p.aviso.visible = false;
  }

  const colorDe = (ent) => (ent.equipo === 'azul' ? 0x7fe0ff : 0xff6a6a);

  // Dispara un proyectil recto
  function disparar(atacante, dx, dz, a, color, esSuper = false) {
    const p = nuevoProyectil();
    if (!p) return;
    Object.assign(p, {
      activo: true, tipo: a.tipo === 'rayo' ? 'rayo' : 'bala', atacante,
      daño: a.daño, curacion: a.curacion || 0, radio: a.radio, restante: a.alcance,
      atraviesa: a.tipo === 'rayo', esSuper
    });
    p.golpeados.clear();
    p.pos.set(atacante.pos.x + dx * 0.6, 1.0, atacante.pos.z + dz * 0.6);
    p.vel.set(dx * a.velocidad, 0, dz * a.velocidad);
    p.m.visible = true;
    p.m.material.color.setHex(color);
    if (p.tipo === 'rayo') p.m.scale.set(a.radio, a.radio * 0.6, a.radio * 2.6);
    else p.m.scale.setScalar(a.radio);
    p.m.rotation.set(0, Math.atan2(dx, dz), 0);
    p.m.position.copy(p.pos);
  }

  // Lanza una bomba en arco hacia un punto
  function lanzarBomba(atacante, tx, tz, a, esSuper = false) {
    const p = nuevoProyectil();
    if (!p) return;
    const t = a.tiempoVuelo;
    const g = 18;
    Object.assign(p, {
      activo: true, tipo: 'bomba', atacante, daño: a.daño, radioExplosion: a.radioExplosion,
      tVuelo: t, tTotal: t, objetivoX: tx, objetivoZ: tz, esSuper
    });
    p.pos.set(atacante.pos.x, 1.6, atacante.pos.z);
    p.vel.set((tx - p.pos.x) / t, (0.3 - 1.6 + 0.5 * g * t * t) / t, (tz - p.pos.z) / t);
    p.m.visible = true;
    p.m.material.color.setHex(0x3a3f55);
    p.m.scale.setScalar(esSuper ? 0.6 : 0.3);
    p.aviso.visible = true;
    p.aviso.position.set(tx, 0.05, tz);
    p.aviso.scale.setScalar(a.radioExplosion);
    p.aviso.material.color.setHex(atacante.equipo === 'azul' ? 0x66ddff : 0xff5555);
  }

  function explotar(p) {
    const grande = p.esSuper;
    lanzarParticulas(p.pos.x, 0.4, p.pos.z, 0xffa040, grande ? 70 : 30, grande ? 13 : 8, 9, grande ? 1 : 0.7);
    lanzarParticulas(p.pos.x, 0.4, p.pos.z, 0xffffff, 10, 6, 9, 0.5);
    Sonido.sfx.explosion();
    if (grande) { onda(p.pos.x, p.pos.z, p.radioExplosion, 0xffa040); sacudir(0.5); }
    for (const e of entidades) {
      if (!e.vivo || e.equipo === p.atacante.equipo) continue;
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < p.radioExplosion + e.radio * 0.5) {
        hacerDaño(e, p.daño, p.atacante, p.esSuper);
      }
    }
    desactivar(p);
  }

  function actualizarProyectiles(dt) {
    for (const p of proyectiles) {
      if (!p.activo) continue;

      if (p.tipo === 'bomba') {
        p.pos.addScaledVector(p.vel, dt);
        p.pos.y -= 0.5 * 18 * dt * dt;
        p.vel.y -= 18 * dt;
        p.m.position.copy(p.pos);
        p.m.rotation.x += dt * 8;
        p.aviso.material.opacity = 0.4 + Math.sin(p.tVuelo * 30) * 0.3;
        p.tVuelo -= dt;
        if (p.tVuelo <= 0 || p.pos.y <= 0.3) explotar(p);
        continue;
      }

      // Balas y rayos
      const paso = p.vel.length() * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.restante -= paso;
      p.m.position.copy(p.pos);
      if (p.tipo === 'rayo') lanzarParticulas(p.pos.x, p.pos.y, p.pos.z, 0xff7a1a, 1, 1, 0, 0.3);

      // Choca con cajas y barreras
      let choco = false;
      for (const o of CONFIG.obstaculos) {
        if (p.pos.y > o.h) continue;
        if (Math.abs(p.pos.x - o.x) < o.w / 2 + p.radio * 0.5 && Math.abs(p.pos.z - o.z) < o.d / 2 + p.radio * 0.5) {
          choco = true;
          break;
        }
      }
      // Bordes de la cancha
      if (Math.abs(p.pos.x) > CONFIG.cancha.mitadLargo || Math.abs(p.pos.z) > CONFIG.cancha.mitadAncho) choco = true;

      // Choca con entidades
      for (const e of entidades) {
        if (!e.vivo || e === p.atacante || p.golpeados.has(e)) continue;
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > e.radio + p.radio) continue;
        if (e.equipo === p.atacante.equipo) {
          // Lumen cura a sus compañeros
          if (p.curacion > 0) { curar(e, p.curacion, p.atacante, p.esSuper); p.golpeados.add(e); if (!p.atraviesa) choco = true; }
          continue;
        }
        hacerDaño(e, p.daño, p.atacante, p.esSuper);
        p.golpeados.add(e);
        if (!p.atraviesa) { choco = true; break; }
      }

      if (choco || p.restante <= 0) {
        lanzarParticulas(p.pos.x, p.pos.y, p.pos.z, p.m.material.color.getHex(), 5, 3, 6, 0.3);
        desactivar(p);
      }
    }
  }

  // ==========================================================
  // ATACAR
  // ==========================================================
  // objetivo = punto de la cancha hacia donde se ataca
  function atacar(ent, a, objetivoX, objetivoZ) {
    if (!ent.vivo || ent.cdAtaque > 0) return false;
    let dx = objetivoX - ent.pos.x, dz = objetivoZ - ent.pos.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = ent.dir.x; dz = ent.dir.z; d = 1; }
    dx /= d; dz /= d;

    // Con el turbo de Zip se ataca más seguido
    const turbo = ent.tTurbo > 0 ? CONFIG.personajes.zip.super.ataqueMasRapido : 1;
    ent.cdAtaque = a.enfriamiento * turbo;
    ent.tSinCombate = 0;
    avisarAccion('atacar', ent, objetivoX, objetivoZ);
    ent.proteccion = 0; // atacar quita la protección de reaparición
    Personajes.animar(ent.malla, 'ataque', ent.personaje);
    const color = colorDe(ent);

    if (a.tipo === 'proyectil' || a.tipo === 'rayo') {
      const n = a.cantidad || 1;
      for (let i = 0; i < n; i++) {
        if (i === 0) disparar(ent, dx, dz, a, color);
        else setTimeout(() => { if (ent.vivo) disparar(ent, dx, dz, a, color); }, i * (a.separacion || 0.1) * 1000);
      }
      Sonido.sfx.disparo(a.tipo);
    } else if (a.tipo === 'golpe') {
      golpear(ent, dx, dz, a);
    } else if (a.tipo === 'bomba') {
      const dist = Math.min(d, a.alcance);
      lanzarBomba(ent, ent.pos.x + dx * dist, ent.pos.z + dz * dist, a);
      Sonido.sfx.disparo('bomba');
    }
    return true;
  }

  // Golpe cuerpo a cuerpo en forma de abanico
  const geoAbanico = new THREE.CircleGeometry(1, 20, 0, 1);
  const abanico = new THREE.Mesh(geoAbanico, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  abanico.rotation.x = -Math.PI / 2;
  scene.add(abanico);
  let tAbanico = 0;

  function golpear(ent, dx, dz, a) {
    const mitad = THREE.MathUtils.degToRad(a.angulo / 2);
    for (const e of entidades) {
      if (!e.vivo || e.equipo === ent.equipo) continue;
      const ex = e.pos.x - ent.pos.x, ez = e.pos.z - ent.pos.z;
      const d = Math.hypot(ex, ez);
      if (d > a.alcance + e.radio) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (ex * dx + ez * dz) / (d || 1))));
      if (ang <= mitad || d < e.radio) hacerDaño(e, a.daño, ent);
    }
    // Efecto visual
    abanico.geometry.dispose();
    abanico.geometry = new THREE.CircleGeometry(a.alcance, 20, -mitad, mitad * 2);
    abanico.position.set(ent.pos.x, 0.08, ent.pos.z);
    abanico.rotation.z = Math.atan2(-dz, dx); // gira el abanico en el plano del piso
    abanico.material.color.setHex(colorDe(ent));
    tAbanico = 0.25;
    // Polvo y chispas en el borde del golpe
    const ang0 = Math.atan2(dz, dx);
    const borde = a.alcance * 0.85;
    for (let i = 0; i <= 6; i++) {
      const ang = ang0 - mitad + (mitad * 2 * i) / 6;
      lanzarParticulas(ent.pos.x + Math.cos(ang) * borde, 0.3, ent.pos.z + Math.sin(ang) * borde, i % 2 ? 0xffffff : colorDe(ent), 2, 3, 9, 0.4);
    }
    Sonido.sfx.golpe();
  }

  // ==========================================================
  // SÚPER HABILIDADES
  // ==========================================================
  // Ondas expansivas (anillos que crecen en el piso)
  const ondas = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.08;
    m.visible = false;
    scene.add(m);
    ondas.push({ m, t: 0, radio: 1 });
  }
  function onda(x, z, radio, color) {
    const o = ondas.find((w) => w.t <= 0) || ondas[0];
    o.t = 0.45;
    o.radio = radio;
    o.m.position.set(x, 0.08, z);
    o.m.material.color.setHex(color);
    o.m.visible = true;
  }

  // Meteoritos que van a caer (súper de Meteor)
  const meteoros = [];
  const geoMeteoro = new THREE.DodecahedronGeometry(0.45, 0);
  const matMeteoro = new THREE.MeshStandardMaterial({ color: 0x5a2a1e, emissive: 0xff5a00, emissiveIntensity: 0.9, flatShading: true });
  const avisoMeteoro = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  avisoMeteoro.rotation.x = -Math.PI / 2;
  avisoMeteoro.position.y = 0.06;
  avisoMeteoro.visible = false;
  scene.add(avisoMeteoro);
  let tAvisoMeteoro = 0;

  // Usa la súper hacia el punto (tx, tz). Devuelve true si se usó.
  function usarSuper(ent, tx, tz, semilla) {
    if (!ent.vivo || (!espejo && ent.carga < 1) || ent.salto) return false;
    if (!semilla) semilla = 1 + Math.floor(Math.random() * 1e9);
    const rnd = aleatorio(semilla);
    avisarAccion('super', ent, tx, tz, semilla);
    const su = CONFIG.personajes[ent.personaje].super;
    const mult = ent.multDaño || 1;
    ent.carga = 0;
    Personajes.animar(ent.malla, 'super', ent.personaje);
    ent.proteccion = 0;
    ent.tSinCombate = 0;
    let dx = tx - ent.pos.x, dz = tz - ent.pos.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = ent.dir.x; dz = ent.dir.z; d = 1; }
    dx /= d; dz /= d;
    const dist = Math.min(d, su.alcance || 0);
    // El destino siempre queda dentro de la cancha (antes Kraag podía saltar por encima del borde)
    const CA = CONFIG.cancha;
    const destX = Math.max(-CA.mitadLargo + 0.6, Math.min(CA.mitadLargo - 0.6, ent.pos.x + dx * dist));
    const destZ = Math.max(-CA.mitadAncho + 0.6, Math.min(CA.mitadAncho - 0.6, ent.pos.z + dz * dist));
    const color = ent.equipo === 'azul' ? 0x7fe0ff : 0xff6a6a;

    if (su.tipo === 'rafaga') {
      // Nova: 5 disparos en abanico
      const n = su.cantidad;
      const total = THREE.MathUtils.degToRad(su.abanico);
      for (let i = 0; i < n; i++) {
        const ang = -total / 2 + (total * i) / (n - 1);
        const c = Math.cos(ang), s2 = Math.sin(ang);
        const rx = dx * c - dz * s2, rz = dx * s2 + dz * c;
        disparar(ent, rx, rz, { ...su, tipo: 'proyectil', daño: su.daño * mult }, 0xffffff, true);
      }
      Sonido.sfx.superNova();
    } else if (su.tipo === 'salto') {
      // Kraag: salta y cae con fuerza
      // En el espejo el salto lo mueve el anfitrión (llega con la posición y la altura)
      if (!espejo) ent.salto = { t: 0, dur: su.duracion, x0: ent.pos.x, z0: ent.pos.z, x1: destX, z1: destZ, daño: su.daño * mult, radio: su.radio, empuje: su.empuje };
      Sonido.sfx.salto();
    } else if (su.tipo === 'turbo') {
      // Zip: corre y ataca más rápido
      ent.tTurbo = su.duracion;
      lanzarParticulas(ent.pos.x, 0.6, ent.pos.z, 0x9dff6a, 25, 5, 2, 0.6);
      Sonido.sfx.turbo();
    } else if (su.tipo === 'granBomba') {
      // Orbit: bomba gigante
      lanzarBomba(ent, destX, destZ, { ...su, daño: su.daño * mult }, true);
      Sonido.sfx.disparo('bomba');
    } else if (su.tipo === 'escudo') {
      // Lumen: escudo y curación para él y sus compañeros cercanos
      for (const e of entidades) {
        if (!e.vivo || e.equipo !== ent.equipo) continue;
        if (Math.hypot(e.pos.x - ent.pos.x, e.pos.z - ent.pos.z) > su.radio) continue;
        e.escudo = su.escudo;
        e.tEscudo = su.duracion;
        curar(e, su.curacion, ent, true);
        lanzarParticulas(e.pos.x, 1, e.pos.z, 0xffe066, 14, 4, 3, 0.7);
      }
      onda(ent.pos.x, ent.pos.z, su.radio, 0xffe066);
      Sonido.sfx.escudo();
    } else if (su.tipo === 'lluvia') {
      // Meteor: varios meteoritos caen en la zona (se anuncian con un círculo)
      for (let i = 0; i < su.cantidad; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * su.radio * 0.85;
        meteoros.push({
          x: destX + Math.cos(a) * r, z: destZ + Math.sin(a) * r,
          t: 0.35 + (su.duracion * i) / su.cantidad, // cuándo cae
          caida: 0.5, atacante: ent, daño: su.daño * mult, radio: su.radioImpacto, malla: null
        });
      }
      avisoMeteoro.position.set(destX, 0.06, destZ);
      avisoMeteoro.scale.setScalar(su.radio);
      avisoMeteoro.visible = true;
      tAvisoMeteoro = su.duracion + 0.9;
      Sonido.sfx.superMeteor();
    }
    if (alUsarSuper) alUsarSuper(ent, su);
    return true;
  }

  function actualizarSupers(dt) {
    for (const e of entidades) {
      if (!e.vivo) continue;
      // Escudo
      if (e.tEscudo > 0) { e.tEscudo -= dt; if (e.tEscudo <= 0) e.escudo = 0; }
      e.mallaEscudo.visible = e.escudo > 0;
      if (e.escudo > 0) e.mallaEscudo.rotation.y += dt * 2;
      // Turbo
      if (e.tTurbo > 0) {
        e.tTurbo -= dt;
        if (Math.random() < 0.5) lanzarParticulas(e.pos.x, 0.4, e.pos.z, 0x9dff6a, 1, 1, 0, 0.35);
      }
      // Empuje (lo producen las súper de impacto)
      if (e.empuje.lengthSq() > 0.01) {
        e.pos.addScaledVector(e.empuje, dt);
        e.empuje.multiplyScalar(Math.pow(0.02, dt));
        resolverColisiones(e.pos, e.radio);
      }
      // Salto de Kraag
      if (e.salto) {
        const sa = e.salto;
        sa.t += dt;
        const f = Math.min(1, sa.t / sa.dur);
        e.pos.x = sa.x0 + (sa.x1 - sa.x0) * f;
        e.pos.z = sa.z0 + (sa.z1 - sa.z0) * f;
        e.alturaExtra = Math.sin(f * Math.PI) * 3;
        if (f >= 1) {
          e.salto = null;
          e.alturaExtra = 0;
          resolverColisiones(e.pos, e.radio);
          impacto(e, sa);
        }
      }
    }
    // Meteoritos
    for (let i = meteoros.length - 1; i >= 0; i--) {
      const m = meteoros[i];
      m.t -= dt;
      if (m.t <= m.caida && !m.malla) {
        m.malla = new THREE.Mesh(geoMeteoro, matMeteoro);
        scene.add(m.malla);
      }
      if (m.malla) {
        const f = 1 - Math.max(0, m.t) / m.caida; // 0 arriba, 1 en el piso
        m.malla.position.set(m.x - 3 * (1 - f), 12 * (1 - f) + 0.3, m.z);
        m.malla.rotation.x += dt * 8;
        lanzarParticulas(m.malla.position.x, m.malla.position.y, m.malla.position.z, 0xff7a1a, 1, 1, 0, 0.3);
      }
      if (m.t <= 0) {
        if (m.malla) scene.remove(m.malla);
        lanzarParticulas(m.x, 0.3, m.z, 0xff7a1a, 16, 6, 9, 0.6);
        onda(m.x, m.z, m.radio, 0xff7a1a);
        Sonido.sfx.explosion();
        sacudir(0.15);
        if (m.atacante.vivo || true) {
          for (const e of entidades) {
            if (!e.vivo || e.equipo === m.atacante.equipo) continue;
            if (Math.hypot(e.pos.x - m.x, e.pos.z - m.z) < m.radio + e.radio * 0.5) hacerDaño(e, m.daño, m.atacante, true);
          }
        }
        meteoros.splice(i, 1);
      }
    }
    if (tAvisoMeteoro > 0) {
      tAvisoMeteoro -= dt;
      avisoMeteoro.material.opacity = 0.35 + Math.sin(tAvisoMeteoro * 20) * 0.25;
      if (tAvisoMeteoro <= 0) avisoMeteoro.visible = false;
    }
    // Ondas
    for (const o of ondas) {
      if (o.t <= 0) continue;
      o.t -= dt;
      const f = 1 - o.t / 0.45;
      o.m.scale.setScalar(o.radio * (0.3 + 0.7 * f));
      o.m.material.opacity = (1 - f) * 0.8;
      if (o.t <= 0) o.m.visible = false;
    }
  }

  // Kraag cae: daña y empuja a los rivales cercanos
  function impacto(e, sa) {
    avisarAccion('impacto', e, e.pos.x, e.pos.z, sa.radio);
    efectoImpacto(e.pos.x, e.pos.z, sa.radio);
    if (espejo) return;
    for (const o of entidades) {
      if (!o.vivo || o.equipo === e.equipo) continue;
      const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > sa.radio + o.radio * 0.5) continue;
      hacerDaño(o, sa.daño, e, true);
      const k = sa.empuje / (d || 1);
      o.empuje.set(dx * k || sa.empuje, 0, dz * k);
    }
  }
  // Lo que se ve cuando Kraag cae (también lo usa el espejo)
  function efectoImpacto(x, z, radio) {
    onda(x, z, radio, 0xb49cff);
    lanzarParticulas(x, 0.3, z, 0xb49cff, 40, 9, 9, 0.8);
    Sonido.sfx.golpe();
    Sonido.sfx.explosion();
    sacudir(0.6);
  }

  // ==========================================================
  // ACTUALIZAR TODO
  // ==========================================================
  function actualizar(dt) {
    for (const e of entidades) {
      Personajes.actualizarAnim(e.malla, dt); // animaciones de ataque, súper y tiro
      e.cdAtaque = Math.max(0, e.cdAtaque - dt);
      if (e.proteccion > 0) e.proteccion = Math.max(0, e.proteccion - dt);
      if (e.burbuja) e.burbuja.visible = e.vivo && e.proteccion > 0;

      if (!e.vivo) {
        if (espejo) continue; // en el espejo lo revive el anfitrión
        e.tReaparecer -= dt;
        if (e.tReaparecer <= 0) reaparecer(e);
        continue;
      }
      // Regeneración tras unos segundos sin pelear
      e.tSinCombate += dt;
      if (espejo) e.tSinCombate = 0;
      if (e.tSinCombate > CB.esperaRegeneracion && e.vida < e.vidaMax) {
        e.vida = Math.min(e.vidaMax, e.vida + e.vidaMax * CB.regeneracion * dt);
      }
      // Parpadeo blanco al recibir daño
      if (e.tFlash > 0) {
        e.tFlash -= dt;
        parpadeo(e, e.tFlash > 0);
      }
    }
    actualizarProyectiles(dt);
    actualizarSupers(dt);
    if (tAbanico > 0) {
      tAbanico -= dt;
      abanico.material.opacity = Math.max(0, tAbanico / 0.25) * 0.75;
    }
  }

  function parpadeo(e, encendido) {
    const mats = e.malla.userData.materiales || [];
    for (const m of mats) {
      if (m.userData.emisivoOriginal === undefined) {
        m.userData.emisivoOriginal = m.emissive.getHex();
        m.userData.intensidadOriginal = m.emissiveIntensity;
      }
      if (encendido) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.7;
      } else {
        m.emissive.setHex(m.userData.emisivoOriginal);
        m.emissiveIntensity = m.userData.intensidadOriginal;
      }
    }
  }

  // ==========================================================
  // BARRAS DE VIDA Y NÚMEROS (HTML sobre el 3D)
  // ==========================================================
  const v3 = new THREE.Vector3();
  function aPantalla(x, y, z) {
    v3.set(x, y, z).project(camera);
    return { x: (v3.x + 1) / 2 * window.innerWidth, y: (1 - v3.y) / 2 * window.innerHeight, delante: v3.z < 1 };
  }

  function actualizarBarras(visible) {
    for (const e of entidades) {
      const mostrar = visible && e.vivo;
      e.barra.style.display = mostrar ? '' : 'none';
      if (!mostrar) continue;
      const p = aPantalla(e.pos.x, 2.6, e.pos.z);
      e.barra.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      const f = Math.max(0, e.vida / e.vidaMax);
      e.barraRelleno.style.width = `${f * 100}%`;
      e.barra.classList.toggle('baja', f < 0.35);
      e.barra.classList.toggle('protegido', e.proteccion > 0);
      if (e.esHumano) e.barraNum.textContent = Math.ceil(e.vida);
      e.barra.classList.toggle('con-escudo', e.escudo > 0);
      e.barra.classList.toggle('super-lista', e.carga >= 1);
    }
  }

  function numero(ent, cantidad, tipo) {
    const p = aPantalla(ent.pos.x, 2.2, ent.pos.z);
    const el = document.createElement('div');
    el.className = `numero-flotante ${tipo}`;
    el.textContent = tipo === 'cura' ? `+${Math.round(cantidad)}` : Math.round(cantidad);
    el.style.left = `${p.x + (Math.random() - 0.5) * 30}px`;
    el.style.top = `${p.y}px`;
    capaNumeros.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  return {
    get espejo() { return espejo; }, set espejo(v) { espejo = !!v; },
    efectoGolpe, efectoEliminar, efectoReaparecer, efectoImpacto,
    entidades, registrar, quitar, sacar, meter, cambiarMalla, atacar, actualizar, usarSuper, cargarSuper, restaurarTodos,
    actualizarBarras, reiniciarTodos, hacerDaño, curar, proyectiles
  };
}
