/* ==========================================================
   ORBIX: OVERDRIVE — bots.js
   Inteligencia de los bots (dificultad Normal).
   Son los personajes que tú no elegiste: 2 compañeros (azul)
   y 3 rivales (rojo). Buscan el balón, atacan, defienden,
   roban, pasan y tiran al aro.
   ========================================================== */

// Se crea desde game.js pasándole lo que necesita del juego.
function crearBots(ctx) {
  const { scene, combate, balon, aros, resolverColisiones } = ctx;
  const C = CONFIG.cancha;
  const BOT = CONFIG.bots;
  const COL = CONFIG.colores;

  let lista = [];
  let tiempo = 0;

  const aroDe = (equipo) => aros.find((a) => a.equipo === equipo);
  // Cada equipo ataca el aro del otro
  const aroAtaque = (b) => aroDe(b.equipo === 'azul' ? 'rojo' : 'azul');
  const aroPropio = (b) => aroDe(b.equipo);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // ==========================================================
  // CREAR LOS BOTS
  // ==========================================================
  // Reparte al azar los personajes que el jugador no eligió (sin repetir)
  // Carril de cada lugar de aparición (0 = centro, -1 = arriba, 1 = abajo)
  const CARRILES = [0, -1, 1];
  let nivelFiesta = null; // en el Modo Fiesta todos los bots usan el mismo nivel

  // Un jugador: preparar('nova') → 2 compañeros y 3 rivales con los demás personajes.
  // Modo Fiesta: preparar({ ocupados: [{ personaje, equipo }], rellenar, personas })
  //   → los bots solo llenan los lugares libres (o ninguno si rellenar = false).
  // tamano: personas por equipo (1 = 1 vs 1, 2 = 2 vs 2, 3 = 3 vs 3)
  function preparar(opciones, tamano = 3) {
    lista.forEach((b) => { combate.quitar(b); scene.remove(b.malla); });
    lista = [];
    const fiesta = typeof opciones === 'object';
    const ocupados = fiesta ? opciones.ocupados : [{ personaje: opciones, equipo: 'azul' }];
    const tam = Math.max(1, Math.min(3, (fiesta ? opciones.tamano : tamano) || 3));
    nivelFiesta = fiesta ? BOT.rivales[Math.max(1, Math.min(5, opciones.personas || 1))] : null;
    if (fiesta && !opciones.rellenar) return lista;

    const resto = Personajes.lista.filter((id) => !ocupados.some((o) => o.personaje === id));
    for (let i = resto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [resto[i], resto[j]] = [resto[j], resto[i]];
    }
    // Cada equipo tiene "tam" lugares: las personas toman los primeros, los bots el resto
    ['azul', 'rojo'].forEach((eq) => {
      const apariciones = eq === 'azul' ? C.aparicionesAzul : C.aparicionesRojo;
      const personas = ocupados.filter((o) => o.equipo === eq).length;
      for (let i = personas; i < tam && resto.length; i++) crear(resto.shift(), eq, apariciones[i], CARRILES[i]);
    });
    return lista;
  }

  // Un jugador: los rivales (rojo) dependen de cuántos jugadores reales hay.
  // Modo Fiesta: todos los bots usan el nivel según las personas conectadas.
  function nivelPara(equipo) {
    if (nivelFiesta) return nivelFiesta;
    if (equipo === 'azul') return BOT.aliados;
    const n = Math.max(1, Math.min(5, BOT.jugadoresReales));
    return BOT.rivales[n];
  }

  function crear(id, equipo, aparicion, carril) {
    const b = {
      esBot: true,
      personaje: id,
      equipo,
      carril,
      malla: Personajes.crearModelo(id, equipo === 'azul' ? COL.azul : COL.rojo),
      pos: new THREE.Vector3(aparicion.x, 0, aparicion.z),
      vel: new THREE.Vector3(),
      dir: new THREE.Vector3(equipo === 'azul' ? 1 : -1, 0, 0),
      destino: new THREE.Vector3(aparicion.x, 0, aparicion.z),
      objetivoAtaque: null,
      tViendo: 0,          // cuánto lleva viendo al mismo objetivo (tiempo de reacción)
      tDecision: Math.random() * 0.2,
      cdRobo: 0,
      animT: Math.random() * 6,
      ladoEsquive: 1,
      tEsquive: 0,
      intentaraTriple: false
    };
    // Nivel según el equipo y los jugadores reales (ver CONFIG.bots)
    b.nivel = nivelPara(equipo);
    const base = CONFIG.personajes[id].ataque;
    b.ataque = { ...base, daño: Math.round(base.daño * b.nivel.daño) };
    scene.add(b.malla);
    const nombre = Personajes.info[id].nombre;
    combate.registrar(b, { vida: CONFIG.personajes[id].vida, radio: 0.55, aparicion, nombre, multDaño: b.nivel.daño });
    lista.push(b);
    return b;
  }

  // ==========================================================
  // DECIDIR QUÉ HACER (unas 6 veces por segundo)
  // ==========================================================
  function decidir(b) {
    const portador = balon.portador;
    const aroA = aroAtaque(b);
    const signo = aroA.signo; // hacia dónde ataca (+1 derecha, -1 izquierda)
    const enemigos = combate.entidades.filter((e) => e.vivo && e.equipo !== b.equipo);
    const aliados = combate.entidades.filter((e) => e.vivo && e.equipo === b.equipo && e !== b);
    const masCercano = (lista, punto) => {
      let mejor = null, md = Infinity;
      for (const e of lista) { const d = dist(e.pos, punto); if (d < md) { md = d; mejor = e; } }
      return { e: mejor, d: md };
    };
    const enemigoCerca = masCercano(enemigos, b.pos);
    const ataque = b.ataque;
    const alcance = ataque.tipo === 'golpe' ? ataque.alcance + 0.4 : ataque.alcance * 0.92;

    b.objetivoAtaque = null;

    if (portador === b) {
      // ---------- TENGO EL BALÓN ----------
      const d = dist(b.pos, aroA);
      const presion = enemigoCerca.e && enemigoCerca.d < BOT.distanciaPresion;
      const tiempoConBalon = ctx.tiempoPosesion();

      const listo = tiempoConBalon > BOT.esperaAntesDeTirar;
      if (listo && d < BOT.distanciaTiro) {
        ctx.tirarBot(b, presion);
        return;
      }
      if (listo && b.intentaraTriple && !presion && d > C.radioTriple + 0.3 && d < C.radioTriple + 1.6) {
        ctx.tirarBot(b, false);
        return;
      }
      if (presion && tiempoConBalon > 0.6) {
        const receptor = mejorReceptor(b, aliados, enemigos);
        if (receptor) { ctx.pasar(b, receptor); return; }
      }
      // Avanzar hacia el aro, esquivando al enemigo más cercano
      const objetivoD = b.intentaraTriple ? C.radioTriple + 0.8 : BOT.distanciaTiro - 1;
      let tx = aroA.x - signo * objetivoD;
      let tz = b.carril * 2.5;
      if (enemigoCerca.e && enemigoCerca.d < 4) {
        tz += (b.pos.z >= enemigoCerca.e.pos.z ? 1 : -1) * 2.5;
      }
      b.destino.set(tx, 0, Math.max(-C.mitadAncho + 1, Math.min(C.mitadAncho - 1, tz)));
      return;
    }

    if (!portador) {
      // ---------- BALÓN LIBRE ----------
      const puntoBalon = { x: balon.pos.x + balon.vel.x * 0.25, z: balon.pos.z + balon.vel.z * 0.25 };
      const miD = dist(b.pos, puntoBalon);
      // Voy por él si soy el más cercano de mi equipo (el jugador cuenta)
      const companeroMasCerca = masCercano(aliados, puntoBalon);
      if (!companeroMasCerca.e || miD < companeroMasCerca.d * 1.1 || (companeroMasCerca.e.esHumano && miD < 4)) {
        b.destino.set(puntoBalon.x, 0, puntoBalon.z);
      } else {
        // Apoyo: entre el balón y mi aro, por mi carril
        const ap = aroPropio(b);
        b.destino.set(ap.x * 0.35 + puntoBalon.x * 0.65, 0, b.carril * 3.5);
      }
    } else if (portador.equipo === b.equipo) {
      // ---------- MI EQUIPO TIENE EL BALÓN: ABRIRME ----------
      b.destino.set(aroA.x - signo * 5.5, 0, b.carril * 4.2);
    } else {
      // ---------- EL RIVAL TIENE EL BALÓN: DEFENDER ----------
      const defensorMasCerca = masCercano([b, ...aliados.filter((a) => !a.esHumano)], portador.pos);
      // Con menos presión, a veces no persiguen y solo cubren su aro
      if (defensorMasCerca.e === b && b.persigue) {
        b.destino.set(portador.pos.x, 0, portador.pos.z);
        // Intentar robar si está cerca (no siempre se animan)
        if (dist(b.pos, portador.pos) < CONFIG.robo.alcance && b.cdRobo <= 0 && b.tViendo > b.nivel.reaccion) {
          if (Math.random() < b.nivel.probabilidadRobo) ctx.intentarRobo(b);
          else b.cdRobo = 1.2;
        }
      } else {
        const ap = aroPropio(b);
        b.destino.set(ap.x * 0.6 + portador.pos.x * 0.4, 0, portador.pos.z * 0.4 + b.carril * 2.5);
      }
      // Prioridad: atacar al que tiene el balón
      if (dist(b.pos, portador.pos) < alcance) b.objetivoAtaque = portador;
    }

    // Si hay un poder cerca y no tengo el balón ni lo persigo, voy por él
    if (portador !== b && !(portador && portador.equipo !== b.equipo && b.persigue)) {
      const orbes = ctx.orbes ? ctx.orbes() : [];
      let cercano = null, dmin = 4.5;
      for (const o of orbes) {
        const d = Math.hypot(o.x - b.pos.x, o.z - b.pos.z);
        if (d < dmin) { dmin = d; cercano = o; }
      }
      const vaPorBalon = !portador && dist(b.destino, balon.pos) < 1.5;
      if (cercano && !vaPorBalon) b.destino.set(cercano.x, 0, cercano.z);
    }

    // Atacar al enemigo más cercano si está en alcance
    if (!b.objetivoAtaque && enemigoCerca.e && enemigoCerca.d < alcance && enemigoCerca.e.proteccion <= 0) {
      b.objetivoAtaque = enemigoCerca.e;
    }
    // Lumen: si no hay a quién atacar, cura a un compañero herido
    if (!b.objetivoAtaque && ataque.curacion) {
      const herido = aliados.find((a) => a.vida < a.vidaMax * 0.6 && dist(a.pos, b.pos) < ataque.alcance * 0.9);
      if (herido) b.objetivoAtaque = herido;
    }
  }

  // ¿Uso mi súper ahora? (cada personaje tiene su momento ideal)
  function pensarSuper(b) {
    if (b.carga < 1) return;
    const su = CONFIG.personajes[b.personaje].super;
    const enemigos = combate.entidades.filter((e) => e.vivo && e.equipo !== b.equipo && e.proteccion <= 0);
    const aliados = combate.entidades.filter((e) => e.vivo && e.equipo === b.equipo);
    const cerca = (lista, r) => lista.filter((e) => dist(e.pos, b.pos) < r);
    // No siempre la usan al instante (más humano)
    if (Math.random() > 0.35) return;

    if (su.tipo === 'turbo') {
      // Zip: con el balón para escapar, o para alcanzar un balón lejano
      const lejosDelBalon = !balon.portador && dist(balon.pos, b.pos) > 5;
      if (balon.portador === b || lejosDelBalon) combate.usarSuper(b, b.pos.x + b.dir.x, b.pos.z + b.dir.z);
      return;
    }
    if (su.tipo === 'escudo') {
      // Lumen: si hay compañeros cerca peleando o alguien está herido
      const juntos = cerca(aliados, su.radio);
      const herido = juntos.some((a) => a.vida < a.vidaMax * 0.55);
      const pelea = cerca(enemigos, 6).length > 0;
      if ((juntos.length >= 2 && pelea) || herido) combate.usarSuper(b, b.pos.x, b.pos.z);
      return;
    }
    // Súper de daño: al enemigo que esté en alcance (prefiere al del balón)
    const alcance = (su.alcance || 6) * 0.95;
    let objetivo = null;
    if (balon.portador && balon.portador.equipo !== b.equipo && dist(balon.portador.pos, b.pos) < alcance) objetivo = balon.portador;
    if (!objetivo) {
      const enRango = cerca(enemigos, alcance);
      if (su.tipo === 'lluvia' || su.tipo === 'granBomba') {
        // Mejor si hay varios juntos
        let mejor = null, mejorN = 0;
        for (const e of enRango) {
          const n = enemigos.filter((o) => dist(o.pos, e.pos) < (su.radio || su.radioExplosion)).length;
          if (n > mejorN) { mejorN = n; mejor = e; }
        }
        objetivo = mejor;
      } else {
        objetivo = enRango[0] || null;
      }
    }
    if (objetivo) {
      const adelanto = su.tipo === 'lluvia' ? 0.6 : su.tipo === 'granBomba' ? 0.7 : 0.15;
      combate.usarSuper(b, objetivo.pos.x + (objetivo.vel ? objetivo.vel.x : 0) * adelanto,
        objetivo.pos.z + (objetivo.vel ? objetivo.vel.z : 0) * adelanto);
    }
  }

  // Elige al compañero más libre y adelantado para pasarle
  function mejorReceptor(b, aliados, enemigos) {
    const signo = aroAtaque(b).signo;
    let mejor = null, mejorPuntos = -Infinity;
    for (const a of aliados) {
      const d = dist(a.pos, b.pos);
      if (d > CONFIG.pase.distanciaMax || d < 2) continue;
      let libre = 99;
      for (const e of enemigos) libre = Math.min(libre, dist(e.pos, a.pos));
      if (libre < 1.8) continue;
      const adelante = (a.pos.x - b.pos.x) * signo;
      const puntos = adelante * 0.6 + libre - d * 0.15;
      if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = a; }
    }
    return mejor;
  }

  // ==========================================================
  // MOVERSE (con un esquive simple de obstáculos)
  // ==========================================================
  function bloqueado(x, z, radio) {
    for (const o of CONFIG.obstaculos) {
      if (Math.abs(x - o.x) < o.w / 2 + radio && Math.abs(z - o.z) < o.d / 2 + radio) return true;
    }
    // Los bots también esquivan la lava
    const lava = CONFIG.mapaActual ? CONFIG.mapaActual.lava : [];
    for (const l of lava) {
      if (Math.abs(x - l.x) < l.w / 2 + radio && Math.abs(z - l.z) < l.d / 2 + radio) return true;
    }
    return Math.abs(x) > C.mitadLargo - radio || Math.abs(z) > C.mitadAncho - radio;
  }

  function mover(b, dt) {
    const st = CONFIG.personajes[b.personaje];
    let dx = b.destino.x - b.pos.x, dz = b.destino.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (d > 0.35) {
      dx /= d; dz /= d;
      // Si hay un obstáculo delante, rodearlo
      b.tEsquive -= dt;
      if (bloqueado(b.pos.x + dx * 1.2, b.pos.z + dz * 1.2, 0.5)) {
        if (b.tEsquive <= 0) { b.ladoEsquive = Math.random() < 0.5 ? 1 : -1; b.tEsquive = 0.6; }
        const ang = b.ladoEsquive * 1.1;
        const c = Math.cos(ang), s = Math.sin(ang);
        let rx = dx * c - dz * s, rz = dx * s + dz * c;
        if (bloqueado(b.pos.x + rx * 1.2, b.pos.z + rz * 1.2, 0.5)) {
          b.ladoEsquive *= -1;
          const c2 = Math.cos(-ang), s2 = Math.sin(-ang);
          rx = dx * c2 - dz * s2; rz = dx * s2 + dz * c2;
        }
        dx = rx; dz = rz;
      }
      // Separarse un poco de los compañeros
      for (const e of combate.entidades) {
        if (e === b || !e.vivo || e.equipo !== b.equipo) continue;
        const ex = b.pos.x - e.pos.x, ez = b.pos.z - e.pos.z;
        const ed = Math.hypot(ex, ez);
        if (ed < 1.6 && ed > 0.01) { dx += (ex / ed) * 0.6; dz += (ez / ed) * 0.6; }
      }
      const dl = Math.hypot(dx, dz) || 1;
      const conBalon = balon.portador === b ? CONFIG.combate.multiplicadorConBalon : 1;
      const turbo = Math.max(b.tTurbo > 0 ? CONFIG.personajes.zip.super.velocidad : 1, b.tPoderTurbo > 0 ? CONFIG.poderes.tipos.turbo.velocidad : 1);
      const v = st.velocidad * b.nivel.velocidad * conBalon * turbo * Math.min(1, d / 1.2);
      vx = (dx / dl) * v;
      vz = (dz / dl) * v;
    }
    // Aceleración suave
    const deslizar = CONFIG.mapaActual ? CONFIG.mapaActual.aceleracion : 1; // en el hielo cuesta frenar
    const k = Math.min(1, 12 * deslizar * dt);
    b.vel.x += (vx - b.vel.x) * k;
    b.vel.z += (vz - b.vel.z) * k;
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
    resolverColisiones(b.pos, 0.55);
    // No atravesar a nadie
    for (const e of combate.entidades) {
      if (e === b || !e.vivo) continue;
      const ex = b.pos.x - e.pos.x, ez = b.pos.z - e.pos.z;
      const ed = Math.hypot(ex, ez), min = 0.55 + e.radio;
      if (ed < min && ed > 0.001) {
        b.pos.x = e.pos.x + (ex / ed) * min;
        b.pos.z = e.pos.z + (ez / ed) * min;
      }
    }
    // Al separarse de otro personaje no puede quedar dentro de una caja
    resolverColisiones(b.pos, 0.55);
  }

  // ==========================================================
  // ATACAR (con tiempo de reacción y puntería imperfecta)
  // ==========================================================
  function atacarSiPuede(b, dt) {
    const o = b.objetivoAtaque;
    if (!o || !o.vivo || balon.portador === b) { b.tViendo = 0; return; }
    b.tViendo += dt;
    if (b.tViendo < b.nivel.reaccion || b.cdAtaque > 0) return;
    const a = b.ataque;
    // Apunta adelantándose un poco a donde va el objetivo
    let tx = o.pos.x, tz = o.pos.z;
    if (a.velocidad) {
      const t = dist(b.pos, o.pos) / a.velocidad;
      tx += (o.vel ? o.vel.x : 0) * t;
      tz += (o.vel ? o.vel.z : 0) * t;
    } else if (a.tipo === 'bomba') {
      tx += (o.vel ? o.vel.x : 0) * a.tiempoVuelo * 0.7;
      tz += (o.vel ? o.vel.z : 0) * a.tiempoVuelo * 0.7;
    }
    // Desvío aleatorio
    const ang = (Math.random() - 0.5) * 2 * b.nivel.desvioAtaque;
    const rx = tx - b.pos.x, rz = tz - b.pos.z;
    const c = Math.cos(ang), s = Math.sin(ang);
    combate.atacar(b, a, b.pos.x + rx * c - rz * s, b.pos.z + rx * s + rz * c);
  }

  // ==========================================================
  // ACTUALIZAR TODOS LOS BOTS
  // ==========================================================
  function actualizar(dt, jugando) {
    tiempo += dt;
    for (const b of lista) {
      const ud = b.malla.userData;
      if (ud.animar) ud.animar(tiempo + b.animT);
      b.cdRobo = Math.max(0, b.cdRobo - dt);
      if (!b.vivo) continue;

      if (b.salto) {
        // Saltando (súper de Kraag): la súper controla la posición
        b.malla.position.set(b.pos.x, b.alturaExtra, b.pos.z);
        continue;
      }
      if (jugando) {
        b.tDecision -= dt;
        if (b.tDecision <= 0) {
          b.tPersigue = (b.tPersigue || 0) - 0.2;
          if (b.tPersigue <= 0) { b.persigue = Math.random() < b.nivel.presion; b.tPersigue = 1.5; }
          decidir(b);
          pensarSuper(b);
          b.tDecision = 0.15 + Math.random() * 0.1;
        }
        mover(b, dt);
        atacarSiPuede(b, dt);
      } else {
        b.vel.multiplyScalar(0.8);
      }

      // Mirar hacia el objetivo de ataque o hacia donde camina
      let mx = b.vel.x, mz = b.vel.z;
      if (b.objetivoAtaque && b.objetivoAtaque.vivo) {
        mx = b.objetivoAtaque.pos.x - b.pos.x;
        mz = b.objetivoAtaque.pos.z - b.pos.z;
      } else if (balon.portador === b) {
        const aro = aroAtaque(b);
        mx = aro.x - b.pos.x;
        mz = aro.z - b.pos.z;
      }
      if (Math.hypot(mx, mz) > 0.3) b.dir.set(mx, 0, mz).normalize();
      const objetivo = Math.atan2(b.dir.x, b.dir.z);
      let diff = objetivo - b.malla.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      b.malla.rotation.y += diff * Math.min(1, 12 * dt);

      // Caminar
      const rapidez = Math.hypot(b.vel.x, b.vel.z);
      b.animT += rapidez * dt * 2.2;
      const paso = rapidez > 0.5 ? Math.sin(b.animT) : 0;
      ud.pierna1.position.z = paso * 0.15;
      ud.pierna2.position.z = -paso * 0.15;
      if (!ud.flota) ud.cuerpo.position.y = Math.abs(paso) * 0.06;
      b.malla.position.copy(b.pos);
    }
  }

  // Al empezar o tras una canasta: cada bot a su lugar
  function colocar() {
    for (const b of lista) {
      b.pos.set(b.aparicion.x, 0, b.aparicion.z);
      b.vel.set(0, 0, 0);
      b.destino.copy(b.pos);
      b.dir.set(b.equipo === 'azul' ? 1 : -1, 0, 0);
      b.malla.rotation.y = Math.atan2(b.dir.x, b.dir.z);
      b.malla.position.copy(b.pos);
      b.objetivoAtaque = null;
      b.tViendo = 0;
    }
  }

  // Cuando un bot recoge el balón decide si intentará un triple
  function alRecoger(b) {
    b.intentaraTriple = Math.random() < BOT.probabilidadTriple;
  }

  return { preparar, actualizar, colocar, alRecoger, get lista() { return lista; } };
}
