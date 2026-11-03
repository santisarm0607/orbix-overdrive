/* ==========================================================
   ORBIX: OVERDRIVE — arena.js
   Crea todo lo que se ve: cancha (según el mapa), aros,
   obstáculos, lava, fondo espacial y balón (estilo low poly).
   ========================================================== */

const Arena = (() => {
  const C = CONFIG.cancha;
  const COL = CONFIG.colores;

  // Material low poly: "flatShading" hace que se vean las caras planas
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.1, ...extra });

  // ---------- Textura del piso (dibujada con canvas) ----------
  function texturaCancha(mapa) {
    const MC = mapa.colores;
    const s = 40; // píxeles por unidad
    const W = C.mitadLargo * 2 * s;
    const H = C.mitadAncho * 2 * s;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');

    // Convertir coordenadas del mundo a píxeles
    const px = (x) => (x + C.mitadLargo) * s;
    const pz = (z) => (z + C.mitadAncho) * s;

    // Fondo
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, MC.izq);
    grad.addColorStop(0.5, MC.centro);
    grad.addColorStop(1, MC.der);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // Decoración según el mapa (cráteres, escarcha o grietas de lava)
    const azar = (a, b) => a + Math.random() * (b - a);
    if (MC.decoracion === 'crateres') {
      for (let i = 0; i < 26; i++) {
        const x = azar(0, W), y = azar(0, H), r = azar(0.4, 1.4) * s;
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 3;
        g.beginPath(); g.arc(x - 2, y - 2, r, Math.PI * 0.9, Math.PI * 1.8); g.stroke();
      }
    } else if (MC.decoracion === 'escarcha') {
      g.strokeStyle = 'rgba(230,250,255,0.18)'; g.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const x = azar(0, W), y = azar(0, H), l = azar(0.5, 1.5) * s;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3;
          g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
        }
      }
    } else if (MC.decoracion === 'grietas') {
      g.strokeStyle = 'rgba(255,110,30,0.45)'; g.lineWidth = 3; g.shadowColor = '#ff6a00'; g.shadowBlur = 10;
      for (let i = 0; i < 18; i++) {
        let x = azar(0, W), y = azar(0, H);
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += azar(-1, 1) * s; y += azar(-1, 1) * s; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
    }

    // Baldosas
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 2;
    for (let x = 0; x <= W; x += s * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += s * 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    // Zona pintada bajo cada aro
    const pintar = (signo, color) => {
      g.fillStyle = color;
      const x0 = signo < 0 ? 0 : px(C.mitadLargo - 5.8);
      g.fillRect(x0, pz(-2.45), 5.8 * s, 4.9 * s);
    };
    pintar(-1, 'rgba(47,139,255,0.22)');
    pintar(1, 'rgba(255,59,92,0.22)');

    g.lineWidth = 5;
    g.shadowBlur = 12;

    // Líneas generales (blanco neón)
    g.strokeStyle = '#bff8ff';
    g.shadowColor = '#7af0ff';
    g.strokeRect(4, 4, W - 8, H - 8);                         // borde
    g.beginPath(); g.moveTo(px(0), 0); g.lineTo(px(0), H); g.stroke(); // línea central
    g.beginPath(); g.arc(px(0), pz(0), 2 * s, 0, Math.PI * 2); g.stroke(); // círculo central

    // Zonas pintadas (contorno) y círculos de tiro libre
    [-1, 1].forEach((signo) => {
      const xFin = signo * (C.mitadLargo - 5.8);
      const x0 = signo < 0 ? 0 : px(xFin);
      g.strokeRect(x0, pz(-2.45), 5.8 * s, 4.9 * s);
      g.beginPath(); g.arc(px(xFin), pz(0), 1.8 * s, 0, Math.PI * 2); g.stroke();
    });

    // Líneas de triple (doradas para que se vean bien)
    g.strokeStyle = '#ffd23f';
    g.shadowColor = '#ffb000';
    g.lineWidth = 6;
    [-1, 1].forEach((signo) => {
      const cx = px(signo * C.aroX);
      const r = C.radioTriple * s;
      g.beginPath();
      if (signo < 0) g.arc(cx, pz(0), r, -Math.PI / 2, Math.PI / 2);
      else g.arc(cx, pz(0), r, Math.PI / 2, (Math.PI * 3) / 2);
      g.stroke();
      // Líneas rectas desde el arco hasta la línea de fondo
      const borde = signo < 0 ? 0 : W;
      g.beginPath(); g.moveTo(cx, pz(-C.radioTriple)); g.lineTo(borde, pz(-C.radioTriple)); g.stroke();
      g.beginPath(); g.moveTo(cx, pz(C.radioTriple)); g.lineTo(borde, pz(C.radioTriple)); g.stroke();
    });

    // Logo en el centro
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.font = `bold ${s * 1.1}px Orbitron, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ORBIX', px(0), pz(0));

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  // ---------- Escenario del mapa (todo lo que cambia entre mapas) ----------
  // Devuelve un grupo para poder quitarlo al cambiar de mapa.
  function crearEscenario(scene, mapa) {
    const L = C.mitadLargo, A = C.mitadAncho;
    const grupo = new THREE.Group();
    scene.add(grupo);
    const MC = mapa.colores;

    // Plataforma de abajo
    const base = new THREE.Mesh(new THREE.BoxGeometry(L * 2 + 6, 0.6, A * 2 + 6), mat(MC.base));
    base.position.y = -0.31;
    base.receiveShadow = true;
    grupo.add(base);

    // Piso de la cancha
    const tex = texturaCancha(mapa);
    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 2, A * 2),
      new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35,
        roughness: mapa.aceleracion < 1 ? 0.25 : 0.85, metalness: mapa.aceleracion < 1 ? 0.3 : 0
      })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    grupo.add(piso);

    // Muros bajos alrededor (con borde de neón)
    const muroMat = mat(MC.muro);
    const neonMat = new THREE.MeshBasicMaterial({ color: MC.neon });
    const muro = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), muroMat);
      m.position.set(x, 0.25, z);
      m.castShadow = true;
      m.receiveShadow = true;
      grupo.add(m);
      const n = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d * 0.4), neonMat);
      n.position.set(x, 0.52, z);
      grupo.add(n);
    };
    muro(L * 2 + 1.2, 0.6, 0, -A - 0.3);
    muro(L * 2 + 1.2, 0.6, 0, A + 0.3);
    muro(0.6, A * 2, -L - 0.3, 0);
    muro(0.6, A * 2, L + 0.3, 0);

    // Obstáculos
    CONFIG.obstaculos.forEach((o) => crearObstaculo(grupo, o));

    // Pozos de lava
    const lavas = [];
    (mapa.lava || []).forEach((l) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(l.w, 0.06, l.d),
        new THREE.MeshStandardMaterial({ color: 0xff5a00, emissive: 0xff4000, emissiveIntensity: 1.2, flatShading: true })
      );
      m.position.set(l.x, 0.06, l.z); // un poco más alto que el borde para que se vea bien
      grupo.add(m);
      const borde = new THREE.Mesh(new THREE.BoxGeometry(l.w + 0.3, 0.1, l.d + 0.3), mat(0x2a1010));
      borde.position.set(l.x, 0.0, l.z);
      grupo.add(borde);
      const luz = new THREE.PointLight(0xff6a00, 0.8, 4);
      luz.position.set(l.x, 0.8, l.z);
      grupo.add(luz);
      lavas.push(m);
    });

    const flotantes = crearFondo(grupo, mapa);
    return { grupo, flotantes, lavas };
  }

  // Quita el escenario anterior y libera su memoria
  function quitarEscenario(scene, esc) {
    scene.remove(esc.grupo);
    esc.grupo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  // ---------- Aros (no cambian entre mapas) ----------
  function crearAros(scene) {
    return [crearAro(scene, -1, 'azul'), crearAro(scene, 1, 'rojo')];
  }

  function crearObstaculo(padre, o) {
    const grupo = new THREE.Group();
    let cuerpo;
    if (o.tipo === 'caja') {
      cuerpo = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), mat(0xff7b3a));
      // Franjas de la caja
      const franja = new THREE.Mesh(new THREE.BoxGeometry(o.w * 1.02, o.h * 0.15, o.d * 1.02), mat(0x8a3418));
      franja.position.y = o.h * 0.25;
      grupo.add(franja);
      const franja2 = franja.clone();
      franja2.position.y = -o.h * 0.25;
      grupo.add(franja2);
    } else if (o.tipo === 'roca') {
      // Roca lunar: forma irregular (choca como una caja)
      cuerpo = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(o.w, o.d) * 0.62, 0), mat(0x8a8fa8));
      cuerpo.scale.set(o.w / Math.max(o.w, o.d), o.h / (Math.max(o.w, o.d) * 1.1), o.d / Math.max(o.w, o.d));
    } else if (o.tipo === 'cristal') {
      // Cristal de hielo: semitransparente y brillante
      cuerpo = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0xbff4ff, emissive: 0x3aa0d8, emissiveIntensity: 0.5, flatShading: true, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3 })
      );
      cuerpo.scale.set(o.w, o.h, o.d);
    } else if (o.tipo === 'basalto') {
      // Roca volcánica con vetas de lava
      cuerpo = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), mat(0x2a1a1a));
      const veta = new THREE.Mesh(
        new THREE.BoxGeometry(o.w * 1.01, 0.07, o.d * 1.01),
        new THREE.MeshBasicMaterial({ color: 0xff6a00 })
      );
      veta.position.y = o.h * 0.15;
      grupo.add(veta);
    } else {
      cuerpo = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), mat(0x4b3a8c, { metalness: 0.4 }));
      const tira = new THREE.Mesh(
        new THREE.BoxGeometry(o.w * 1.01, 0.08, o.d * 1.01),
        new THREE.MeshBasicMaterial({ color: 0xc77dff })
      );
      tira.position.y = o.h / 2 - 0.15;
      grupo.add(tira);
    }
    cuerpo.castShadow = true;
    cuerpo.receiveShadow = true;
    grupo.add(cuerpo);
    grupo.position.set(o.x, o.h / 2, o.z);
    padre.add(grupo);
  }

  // ---------- Aro ----------
  function crearAro(scene, signo, equipo) {
    const color = equipo === 'azul' ? COL.azul : COL.rojo;
    const grupo = new THREE.Group();

    // Poste
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 4.2, 6), mat(0x3a3f5c, { metalness: 0.5 }));
    poste.position.set(signo * (C.mitadLargo - 0.2), 2.1, 0);
    poste.castShadow = true;
    grupo.add(poste);

    // Brazo que sostiene el tablero
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.15), mat(0x3a3f5c));
    brazo.position.set(signo * (C.tableroX + 0.45), 3.9, 0);
    grupo.add(brazo);

    // Tablero (semitransparente con borde de color)
    const tablero = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.2, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.3 })
    );
    tablero.position.set(signo * C.tableroX, C.aroAltura + 0.55, 0);
    grupo.add(tablero);
    const marco = new THREE.LineSegments(
      new THREE.EdgesGeometry(tablero.geometry),
      new THREE.LineBasicMaterial({ color })
    );
    marco.position.copy(tablero.position);
    grupo.add(marco);

    // Aro (anillo)
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.tiro.radioAro, 0.06, 6, 22),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 })
    );
    anillo.rotation.x = Math.PI / 2;
    anillo.position.set(signo * C.aroX, C.aroAltura, 0);
    grupo.add(anillo);

    // Red (malla de alambre)
    const red = new THREE.Mesh(
      new THREE.CylinderGeometry(CONFIG.tiro.radioAro, CONFIG.tiro.radioAro * 0.6, 0.8, 14, 2, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 })
    );
    red.position.set(signo * C.aroX, C.aroAltura - 0.4, 0);
    grupo.add(red);

    // Luz del color del equipo
    const luz = new THREE.PointLight(color, 1.2, 9);
    luz.position.set(signo * C.aroX, C.aroAltura + 0.5, 0);
    grupo.add(luz);

    scene.add(grupo);
    return {
      equipo,
      signo,
      x: signo * C.aroX,
      z: 0,
      y: C.aroAltura,
      red,
      anillo,
      animRed: 0
    };
  }

  // ---------- Fondo espacial ----------
  function crearFondo(scene, mapa) {
    const flotantes = [];
    const PL = mapa.planeta;

    // Estrellas
    const n = CONFIG.graficos.estrellas;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 120 + Math.random() * 60;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.8 - 20;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true })));

    // Planeta con anillo
    const planeta = new THREE.Mesh(
      new THREE.IcosahedronGeometry(14, 2),
      mat(PL.color, { emissive: PL.brillo, emissiveIntensity: 0.6 })
    );
    planeta.position.set(-45, -10, -75);
    scene.add(planeta);
    if (PL.anillo) {
      const anillo = new THREE.Mesh(
        new THREE.TorusGeometry(22, 1.2, 4, 40),
        mat(PL.anillo, { emissive: PL.anillo, emissiveIntensity: 0.25 })
      );
      anillo.position.copy(planeta.position);
      anillo.rotation.set(1.2, 0.3, 0);
      scene.add(anillo);
    }
    flotantes.push({ obj: planeta, rot: 0.03 });

    // Luna
    const luna = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), mat(0x9fb4ff, { emissive: 0x223366, emissiveIntensity: 0.5 }));
    luna.position.set(55, 5, -70);
    scene.add(luna);
    flotantes.push({ obj: luna, rot: 0.05 });

    // Asteroides flotando
    for (let i = 0; i < 14; i++) {
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 1.4, 0), mat(0x6d6a8a));
      const ang = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 18;
      a.position.set(Math.cos(ang) * dist, -6 + Math.random() * 8, Math.sin(ang) * dist * 0.8 - 6);
      scene.add(a);
      flotantes.push({ obj: a, rot: 0.3 + Math.random() * 0.6, baseY: a.position.y, fase: Math.random() * 6 });
    }
    return flotantes;
  }

  // ---------- Balón ----------
  function crearBalon() {
    const g = new THREE.Group();
    const r = CONFIG.balon.radio;
    const esfera = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      mat(COL.balon, { emissive: 0xff5500, emissiveIntensity: 0.45 })
    );
    esfera.castShadow = true;
    g.add(esfera);
    // Costuras
    const costura = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.01, 0.02, 3, 20),
      new THREE.MeshBasicMaterial({ color: 0x221100 })
    );
    g.add(costura);
    const costura2 = costura.clone();
    costura2.rotation.y = Math.PI / 2;
    g.add(costura2);
    return g;
  }

  return { crearEscenario, quitarEscenario, crearAros, crearBalon };
})();
