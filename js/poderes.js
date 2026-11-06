/* ==========================================================
   ORBIX: OVERDRIVE — poderes.js
   Orbes de poder que aparecen en la cancha:
   Turbo, Escudo, Balón de fuego, Imán y Recarga de súper.
   Siempre salen en pares (uno en cada mitad) para que sea justo.
   ========================================================== */

function crearPoderes(ctx) {
  const { scene, combate, lanzarParticulas, alRecoger } = ctx;
  const P = CONFIG.poderes;
  const tipos = Object.keys(P.tipos);

  const orbes = [];       // orbes que están en la cancha
  let tSiguiente = P.primeraAparicion;

  // ---------- Modelo del orbe ----------
  function crearMalla(tipo) {
    const color = P.tipos[tipo].color;
    const g = new THREE.Group();
    const nucleo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, flatShading: true })
    );
    nucleo.position.y = 1.0;
    g.add(nucleo);
    const capa = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.5 })
    );
    capa.position.y = 1.0;
    g.add(capa);
    // Haz de luz para verlo de lejos
    const haz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.45, 2.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    haz.position.y = 1.1;
    g.add(haz);
    const aro = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.75, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    aro.rotation.x = -Math.PI / 2;
    aro.position.y = 0.04;
    g.add(aro);
    g.userData = { nucleo, capa, aro };
    return g;
  }

  // ---------- Aparecer un par ----------
  function aparecerPar() {
    const pares = orbes.length / 2;
    if (pares >= P.maxPares) return;
    // Lugares libres (que no tengan ya un orbe)
    const libres = P.lugares.filter((l) => !orbes.some((o) => Math.abs(Math.abs(o.x) - Math.abs(l.x)) < 0.1 && Math.abs(o.z - l.z) < 0.1));
    if (!libres.length) return;
    const lugar = libres[Math.floor(Math.random() * libres.length)];
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    [lugar.x, -lugar.x].forEach((x) => {
      const malla = crearMalla(tipo);
      malla.position.set(x, 0, lugar.z);
      malla.scale.setScalar(0.01);
      scene.add(malla);
      orbes.push({ tipo, x, z: lugar.z, malla, t: Math.random() * 6, nacer: 0 });
      lanzarParticulas(x, 1, lugar.z, P.tipos[tipo].color, 14, 4, 3, 0.6);
    });
    Sonido.sfx.poderAparece();
  }

  // ---------- Dar el poder a quien lo recoge ----------
  function dar(ent, tipo) {
    const d = P.tipos[tipo];
    if (tipo === 'turbo') ent.tPoderTurbo = d.duracion;
    else if (tipo === 'escudo') { ent.escudo = Math.max(ent.escudo, d.escudo); ent.tEscudo = Math.max(ent.tEscudo, d.duracion); }
    else if (tipo === 'fuego') ent.tFuego = d.duracion;
    else if (tipo === 'iman') ent.tIman = d.duracion;
    else if (tipo === 'recarga') combate.cargarSuper(ent, d.carga);
    lanzarParticulas(ent.pos.x, 1.2, ent.pos.z, d.color, 20, 5, 4, 0.7);
    if (alRecoger) alRecoger(ent, tipo, d);
  }

  // ---------- Actualizar ----------
  function actualizar(dt, jugando, t) {
    // Animación de los orbes
    for (const o of orbes) {
      o.t += dt;
      o.nacer = Math.min(1, o.nacer + dt * 3);
      const ud = o.malla.userData;
      o.malla.scale.setScalar(o.nacer);
      ud.nucleo.position.y = 1.0 + Math.sin(o.t * 2.5) * 0.15;
      ud.nucleo.rotation.y += dt * 2;
      ud.capa.position.y = ud.nucleo.position.y;
      ud.capa.rotation.y -= dt;
      ud.capa.rotation.x += dt * 0.7;
      ud.aro.scale.setScalar(1 + Math.sin(o.t * 4) * 0.08);
    }
    // Los tiempos de los poderes activos bajan
    for (const e of combate.entidades) {
      if (e.tPoderTurbo > 0) {
        e.tPoderTurbo -= dt;
        if (Math.random() < 0.3) lanzarParticulas(e.pos.x, 0.3, e.pos.z, P.tipos.turbo.color, 1, 1, 0, 0.3);
      }
      if (e.tIman > 0) e.tIman -= dt;
      if (e.tFuego > 0) e.tFuego -= dt;
    }
    if (!jugando) return;

    // Aparecer nuevos
    tSiguiente -= dt;
    if (tSiguiente <= 0) {
      aparecerPar();
      tSiguiente = P.intervalo;
    }

    // Recoger
    for (let i = orbes.length - 1; i >= 0; i--) {
      const o = orbes[i];
      if (o.nacer < 1) continue;
      for (const e of combate.entidades) {
        if (!e.vivo || e.salto) continue;
        if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < P.radioRecogida + 0.3) {
          dar(e, o.tipo);
          scene.remove(o.malla);
          orbes.splice(i, 1);
          break;
        }
      }
    }
  }

  // Quita todos los orbes (al empezar un partido)
  function reiniciar() {
    orbes.forEach((o) => scene.remove(o.malla));
    orbes.length = 0;
    tSiguiente = P.primeraAparicion;
    for (const e of combate.entidades) {
      e.tPoderTurbo = 0;
      e.tIman = 0;
      e.tFuego = 0;
    }
  }

  // Al ser eliminado se pierden los poderes
  function quitarA(ent) {
    ent.tPoderTurbo = 0;
    ent.tIman = 0;
    ent.tFuego = 0;
  }

  // Multiplicador de velocidad por el poder Turbo
  const multVelocidad = (ent) => (ent.tPoderTurbo > 0 ? P.tipos.turbo.velocidad : 1);
  // Distancia para recoger el balón (más grande con Imán)
  const radioBalon = (ent, base) => (ent.tIman > 0 ? P.tipos.iman.radioRecogida : base);

  // Online (el que se unió): deja en la cancha exactamente los orbes que manda el anfitrión
  // lista = [[tipo, x, z], ...]
  function sincronizar(lista) {
    const igual = (o, l) => o.tipo === l[0] && Math.abs(o.x - l[1]) < 0.01 && Math.abs(o.z - l[2]) < 0.01;
    for (let i = orbes.length - 1; i >= 0; i--) {
      if (!lista.some((l) => igual(orbes[i], l))) { scene.remove(orbes[i].malla); orbes.splice(i, 1); }
    }
    for (const l of lista) {
      if (orbes.some((o) => igual(o, l)) || !P.tipos[l[0]]) continue;
      const malla = crearMalla(l[0]);
      malla.position.set(l[1], 0, l[2]);
      scene.add(malla);
      orbes.push({ tipo: l[0], x: l[1], z: l[2], malla, t: Math.random() * 6, nacer: 0 });
    }
  }

  return { actualizar, reiniciar, quitarA, multVelocidad, radioBalon, orbes, sincronizar };
}
