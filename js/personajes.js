/* ==========================================================
   ORBIX: OVERDRIVE — personajes.js
   Nombre, rol, descripción, modelo low poly de cada personaje
   y sus animaciones de ataque, súper y lanzamiento.
   Los números (vida, daño, alcance...) están en config.js.
   ========================================================== */

const Personajes = (() => {
  // Orden en el que aparecen en la pantalla de selección
  const lista = ['nova', 'kraag', 'zip', 'orbit', 'lumen', 'meteor'];

  const info = {
    nova: {
      nombre: 'Nova', rol: 'Tiradora', color: '#7ec8ff',
      desc: 'Astronauta que dispara proyectiles de energía desde lejos. Castiga los espacios abiertos, pero sufre de cerca.',
      superDesc: 'Dispara 5 proyectiles en abanico.'
    },
    kraag: {
      nombre: 'Kraag', rol: 'Tanque', color: '#b49cff',
      desc: 'Gorila alienígena con muchísima vida. Golpea fuerte de cerca y protege a su equipo, pero es lento.',
      superDesc: 'Salta hasta donde apuntes y, al caer, daña y empuja a los rivales.'
    },
    zip: {
      nombre: 'Zip', rol: 'Explorador', color: '#9dff6a',
      desc: 'El más rápido de la galaxia. Lanza ráfagas cortas y recupera balones, pero tiene muy poca vida.',
      superDesc: 'Corre y ataca mucho más rápido durante 3.5 segundos.'
    },
    orbit: {
      nombre: 'Orbit', rol: 'Control de zona', color: '#8fb3d9',
      desc: 'Robot que lanza bombas en arco por encima de las cajas. Obliga al rival a cambiar de ruta.',
      superDesc: 'Lanza una bomba gigante con una explosión enorme.'
    },
    lumen: {
      nombre: 'Lumen', rol: 'Apoyo', color: '#fff2a8',
      desc: 'Ser de luz que lanza pulsos de energía. Daña a los rivales y cura a sus compañeros.',
      superDesc: 'Escudo y curación para él y sus compañeros cercanos.'
    },
    meteor: {
      nombre: 'Meteor', rol: 'Especialista en área', color: '#ff8a3d',
      desc: 'Alien de roca y fuego. Su rayo atraviesa a todos los enemigos que estén en línea.',
      superDesc: 'Hace caer una lluvia de meteoritos sobre la zona que elijas.'
    }
  };

  // Material low poly (caras planas)
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, metalness: 0.1, ...extra });
  const brillo = (color, intensidad = 0.9) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad, flatShading: true });

  // Crea una pieza, la coloca y la añade al grupo
  function pieza(grupo, geo, material, x = 0, y = 0, z = 0, sombra = true) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = sombra;
    grupo.add(m);
    return m;
  }

  // Piernas sencillas (se animan al caminar)
  function piernas(g, color, separacion = 0.18, alto = 0.4, grosor = 0.18) {
    const p1 = pieza(g, new THREE.BoxGeometry(grosor, alto, grosor + 0.02), mat(color), -separacion, alto / 2, 0);
    const p2 = pieza(g, new THREE.BoxGeometry(grosor, alto, grosor + 0.02), mat(color), separacion, alto / 2, 0);
    return [p1, p2];
  }

  // ---------- Ayudas para animar ----------
  // Curva suave de 0 a 1
  const suave = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  // Sube rápido hasta 1 (en "pico") y baja despacio hasta 0. Vale 0 al inicio y al final.
  const pulso = (f, pico = 0.25) => (f < pico ? suave(f / pico) : 1 - suave((f - pico) / (1 - pico)));

  // ---------- Modelos ----------
  // Cada modelo puede definir c.pose(tipo, f, accion):
  //   tipo = 'ataque' | 'super' | 'tiro'   f = avance de 0 a 1
  //   accion = grupo que mueve todo el cuerpo (inclinarse, saltar, aplastarse)
  // Cuando f = 1 todo debe quedar en su posición normal.
  // Todos miran hacia +Z (hacia donde apuntan).

  function nova(c, colorEquipo) {
    const [p1, p2] = piernas(c.raiz, 0xd8deef);
    const torso = pieza(c.cuerpo, new THREE.CylinderGeometry(0.38, 0.45, 0.8, 8), mat(0xeef2ff), 0, 0.78, 0);
    pieza(c.cuerpo, new THREE.CylinderGeometry(0.46, 0.46, 0.12, 8), brillo(colorEquipo, 0.5), 0, 0.5, 0);
    pieza(c.cuerpo, new THREE.BoxGeometry(0.5, 0.6, 0.28), mat(0xb8c2dd), 0, 0.85, -0.38); // mochila
    pieza(c.cuerpo, new THREE.BoxGeometry(0.12, 0.12, 0.05), brillo(colorEquipo), 0, 1.0, -0.53);
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.46, 1), mat(0xffffff), 0, 1.55, 0); // casco
    pieza(c.cuerpo, new THREE.BoxGeometry(0.58, 0.28, 0.2), brillo(0x66e0ff, 0.8), 0, 1.57, 0.33); // visor
    // Cañón en la mano (en un grupo para poder moverlo al disparar)
    const cañon = new THREE.Group();
    cañon.position.set(0.45, 0.85, 0.25);
    c.cuerpo.add(cañon);
    pieza(cañon, new THREE.BoxGeometry(0.16, 0.16, 0.55), mat(0x4a5578), 0, 0, 0);
    pieza(cañon, new THREE.BoxGeometry(0.1, 0.1, 0.06), brillo(0x66e0ff), 0, 0, 0.3);
    // Fogonazo del disparo
    const fogonazo = pieza(cañon, new THREE.IcosahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.9 }), 0, 0, 0.48, false);
    fogonazo.visible = false;
    void torso;

    c.pose = (tipo, f, accion) => {
      // Retroceso del cañón: se va hacia atrás y hacia arriba, y vuelve
      let e = 0;
      if (tipo === 'ataque') e = pulso(f, 0.15);
      else if (tipo === 'super') e = Math.abs(Math.sin(f * Math.PI * 5)) * (1 - f * 0.4); // 5 disparos seguidos
      cañon.position.z = 0.25 - 0.2 * e;
      cañon.rotation.x = -0.45 * e;
      fogonazo.visible = tipo !== 'tiro' && e > 0.3;
      fogonazo.scale.setScalar(0.6 + e);
      accion.rotation.x = -0.1 * e;
      if (tipo === 'tiro') accion.position.y = 0.3 * pulso(f, 0.35);
    };
    return { pierna1: p1, pierna2: p2 };
  }

  function kraag(c, colorEquipo) {
    const piel = 0x5b4a7a;
    const [p1, p2] = piernas(c.raiz, 0x3e3256, 0.28, 0.35, 0.26);
    pieza(c.cuerpo, new THREE.BoxGeometry(1.1, 0.95, 0.8), mat(piel), 0, 0.95, 0); // torso
    pieza(c.cuerpo, new THREE.BoxGeometry(0.8, 0.5, 0.1), brillo(colorEquipo, 0.45), 0, 1.0, 0.42); // placa
    pieza(c.cuerpo, new THREE.BoxGeometry(0.55, 0.45, 0.5), mat(piel), 0, 1.6, 0.12); // cabeza
    pieza(c.cuerpo, new THREE.BoxGeometry(0.6, 0.12, 0.2), mat(0x2d2440), 0, 1.75, 0.35); // ceja
    pieza(c.cuerpo, new THREE.BoxGeometry(0.1, 0.08, 0.05), brillo(0xffd23f), -0.13, 1.63, 0.38); // ojos
    pieza(c.cuerpo, new THREE.BoxGeometry(0.1, 0.08, 0.05), brillo(0xffd23f), 0.13, 1.63, 0.38);
    // Brazos largos con puños grandes. Cada brazo gira desde el hombro.
    const brazos = [-1, 1].map((l) => {
      const hombro = new THREE.Group();
      hombro.position.set(l * 0.72, 1.3, 0.1);
      c.cuerpo.add(hombro);
      pieza(hombro, new THREE.BoxGeometry(0.3, 0.9, 0.3), mat(piel), 0, -0.45, 0);
      pieza(hombro, new THREE.DodecahedronGeometry(0.26, 0), mat(0x3e3256), 0, -0.95, 0.05);
      return hombro;
    });
    c.raiz.scale.setScalar(1.12);

    c.pose = (tipo, f, accion) => {
      // brazo: 0 = colgando | -1.5 = hacia adelante | -2.8 = arriba de la cabeza
      let brazo = 0, inclinar = 0, avance = 0, alto = 0;
      if (tipo === 'ataque') {
        // Levanta los dos puños y los estrella hacia adelante
        if (f < 0.18) { const k = suave(f / 0.18); brazo = -2.6 * k; inclinar = -0.18 * k; }
        else if (f < 0.4) { const k = suave((f - 0.18) / 0.22); brazo = -2.6 + 1.5 * k; inclinar = -0.18 + 0.5 * k; avance = 0.4 * k; }
        else { const k = suave((f - 0.4) / 0.6); brazo = -1.1 * (1 - k); inclinar = 0.32 * (1 - k); avance = 0.4 * (1 - k); }
      } else if (tipo === 'super') {
        // Salto: puños arriba todo el vuelo y golpe contra el piso al caer
        if (f < 0.8) brazo = -2.9 * suave(f / 0.15);
        else if (f < 0.88) { const k = suave((f - 0.8) / 0.08); brazo = -2.9 + 1.9 * k; inclinar = 0.4 * k; }
        else { const k = suave((f - 0.88) / 0.12); brazo = -1 * (1 - k); inclinar = 0.4 * (1 - k); }
      } else if (tipo === 'tiro') {
        const e = pulso(f, 0.35);
        brazo = -2.6 * e;
        alto = 0.3 * e;
      }
      brazos.forEach((b) => { b.rotation.x = brazo; });
      accion.rotation.x = inclinar;
      accion.position.z = avance;
      accion.position.y = alto;
    };
    return { pierna1: p1, pierna2: p2 };
  }

  function zip(c, colorEquipo) {
    const verde = 0x8cff5a;
    const [p1, p2] = piernas(c.raiz, 0x3f8f2a, 0.13, 0.32, 0.12);
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.33, 0), mat(verde), 0, 0.62, 0); // cuerpo
    pieza(c.cuerpo, new THREE.CylinderGeometry(0.34, 0.34, 0.1, 8), brillo(colorEquipo, 0.5), 0, 0.5, 0);
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.42, 1), mat(verde), 0, 1.2, 0); // cabeza grande
    // Ojos enormes
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.13, 0), mat(0x111122), -0.16, 1.25, 0.33, false);
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.13, 0), mat(0x111122), 0.16, 1.25, 0.33, false);
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.04, 0), brillo(0xffffff), -0.14, 1.29, 0.44, false);
    pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.04, 0), brillo(0xffffff), 0.18, 1.29, 0.44, false);
    // Antenas
    const antenas = [-1, 1].map((l) => {
      const g = new THREE.Group();
      g.position.set(l * 0.12, 1.5, -0.05);
      c.cuerpo.add(g);
      const a = pieza(g, new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), mat(0x3f8f2a), l * 0.06, 0.2, 0);
      a.rotation.z = -l * 0.35;
      pieza(g, new THREE.IcosahedronGeometry(0.07, 0), brillo(colorEquipo), l * 0.15, 0.42, 0);
      return g;
    });
    // Dos mini pistolas, una en cada mano
    const pistolas = [-1, 1].map((l) => {
      const g = new THREE.Group();
      g.position.set(l * 0.36, 0.68, 0.18);
      c.cuerpo.add(g);
      pieza(g, new THREE.IcosahedronGeometry(0.08, 0), mat(verde), 0, 0, -0.05);
      pieza(g, new THREE.BoxGeometry(0.09, 0.09, 0.26), mat(0x2d3448), 0, 0, 0.08);
      pieza(g, new THREE.BoxGeometry(0.06, 0.06, 0.04), brillo(0x9dff6a), 0, 0, 0.22, false);
      const flash = pieza(g, new THREE.IcosahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: 0xd8ffb0, transparent: true, opacity: 0.9 }), 0, 0, 0.32, false);
      flash.visible = false;
      g.userData.flash = flash;
      return g;
    });
    c.raiz.scale.setScalar(0.9);

    c.pose = (tipo, f, accion) => {
      if (tipo === 'ataque') {
        // Dispara con una pistola y luego con la otra
        pistolas.forEach((p, i) => {
          const e = pulso(Math.max(0, Math.min(1, (f - i * 0.4) / 0.6)), 0.2);
          p.position.z = 0.18 - 0.14 * e;
          p.rotation.x = -0.5 * e;
          p.userData.flash.visible = e > 0.4;
        });
        accion.scale.set(1, 1 - 0.1 * pulso(f, 0.2), 1);
      } else {
        pistolas.forEach((p) => { p.position.z = 0.18; p.rotation.x = 0; p.userData.flash.visible = false; });
        accion.scale.set(1, 1, 1);
      }
      if (tipo === 'super') {
        // Turbo: da una vuelta completa y se encoge para arrancar
        accion.rotation.y = suave(f) * Math.PI * 2;
        const e = pulso(f, 0.3);
        accion.scale.set(1 + 0.15 * e, 1 - 0.2 * e, 1 + 0.15 * e);
      } else {
        accion.rotation.y = 0;
      }
      if (tipo === 'tiro') accion.position.y = 0.4 * pulso(f, 0.35);
      // Las antenas se sacuden con cualquier acción
      const sacudir = Math.sin(f * Math.PI * 6) * (1 - f) * 0.5;
      antenas.forEach((a, i) => { a.rotation.z = sacudir * (i ? -1 : 1); });
    };
    return { pierna1: p1, pierna2: p2 };
  }

  function orbit(c, colorEquipo) {
    const metal = 0x8fa3c4;
    // Ruedas en lugar de piernas
    const p1 = pieza(c.raiz, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 8), mat(0x2d3448), -0.28, 0.2, 0);
    const p2 = pieza(c.raiz, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 8), mat(0x2d3448), 0.28, 0.2, 0);
    p1.rotation.z = p2.rotation.z = Math.PI / 2;
    pieza(c.cuerpo, new THREE.BoxGeometry(0.85, 0.8, 0.7), mat(metal, { metalness: 0.5 }), 0, 0.85, 0); // cuerpo
    pieza(c.cuerpo, new THREE.BoxGeometry(0.87, 0.14, 0.72), brillo(colorEquipo, 0.5), 0, 0.6, 0);
    pieza(c.cuerpo, new THREE.BoxGeometry(0.7, 0.5, 0.55), mat(0x5d6f8f, { metalness: 0.5 }), 0, 1.5, 0); // cabeza
    const pantalla = pieza(c.cuerpo, new THREE.BoxGeometry(0.55, 0.32, 0.05), brillo(0x66ffcc, 0.9), 0, 1.5, 0.29); // pantalla
    // Lanzabombas en el hombro (en un grupo para inclinarlo al disparar)
    const lanzador = new THREE.Group();
    lanzador.position.set(0.5, 1.25, 0);
    lanzador.rotation.x = Math.PI / 2.6;
    c.cuerpo.add(lanzador);
    const tubo = pieza(lanzador, new THREE.CylinderGeometry(0.14, 0.18, 0.5, 6), mat(0x2d3448), 0, 0, 0);
    const humo = pieza(lanzador, new THREE.IcosahedronGeometry(0.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85 }), 0, 0.38, 0, false);
    humo.visible = false;
    // Anillo que orbita
    const anillo = pieza(c.cuerpo, new THREE.TorusGeometry(0.75, 0.04, 4, 24), brillo(colorEquipo, 0.8), 0, 1.0, 0, false);
    anillo.rotation.x = Math.PI / 2.4;
    const luna = pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.1, 0), brillo(0x66ffcc), 0.75, 1.0, 0, false);
    c.animar = (t) => {
      anillo.rotation.z = t * 1.5;
      luna.position.set(Math.cos(t * 2.5) * 0.75, 1.0 + Math.sin(t * 2.5) * 0.25, Math.sin(t * 2.5) * 0.75);
    };

    c.pose = (tipo, f, accion) => {
      // El lanzador apunta hacia arriba, dispara (retrocede) y el robot se aplasta
      const fuerza = tipo === 'super' ? 1.6 : 1;
      const e = tipo === 'tiro' ? 0 : pulso(f, 0.2);
      lanzador.rotation.x = Math.PI / 2.6 - 0.55 * e * fuerza;
      tubo.position.y = -0.12 * e * fuerza;
      humo.visible = e > 0.35;
      humo.scale.setScalar(0.8 + e * fuerza);
      pantalla.material.emissiveIntensity = 0.9 + 1.8 * e;
      const aplastar = 0.13 * e * fuerza;
      accion.scale.set(1 + aplastar * 0.6, 1 - aplastar, 1 + aplastar * 0.6);
      accion.position.y = tipo === 'tiro' ? 0.3 * pulso(f, 0.35) : 0;
    };
    return { pierna1: p1, pierna2: p2 };
  }

  function lumen(c, colorEquipo) {
    // Flota: no tiene piernas (se usan objetos vacíos para la animación)
    const p1 = new THREE.Object3D(), p2 = new THREE.Object3D();
    const nucleo = pieza(c.cuerpo, new THREE.OctahedronGeometry(0.45, 0), brillo(0xfff2a8, 1.2), 0, 1.15, 0);
    const capa = pieza(c.cuerpo, new THREE.IcosahedronGeometry(0.72, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff7cc, wireframe: true, transparent: true, opacity: 0.55 }), 0, 1.15, 0, false);
    pieza(c.cuerpo, new THREE.TorusGeometry(0.42, 0.05, 4, 16), brillo(colorEquipo, 0.8), 0, 0.45, 0, false).rotation.x = Math.PI / 2;
    // Ojos
    pieza(c.cuerpo, new THREE.BoxGeometry(0.08, 0.14, 0.05), mat(0x332200), -0.11, 1.2, 0.38, false);
    pieza(c.cuerpo, new THREE.BoxGeometry(0.08, 0.14, 0.05), mat(0x332200), 0.11, 1.2, 0.38, false);
    // Chispas
    const chispas = [];
    for (let i = 0; i < 3; i++) {
      chispas.push(pieza(c.cuerpo, new THREE.OctahedronGeometry(0.08, 0), brillo(0xffffff), 0, 1.15, 0, false));
    }
    const luz = new THREE.PointLight(0xfff2a8, 0.6, 4);
    luz.position.y = 1.15;
    c.cuerpo.add(luz);
    c.animar = (t) => {
      c.cuerpo.position.y = 0.15 + Math.sin(t * 2) * 0.1;
      nucleo.rotation.y = t * 1.2;
      capa.rotation.y = -t * 0.6;
      capa.rotation.x = t * 0.4;
      chispas.forEach((ch, i) => {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        ch.position.set(Math.cos(a) * 0.85, 1.15 + Math.sin(a * 1.5) * 0.3, Math.sin(a) * 0.85);
      });
    };

    c.pose = (tipo, f, accion) => {
      // El núcleo late y la capa de luz se expande; en la súper da una vuelta
      const e = pulso(f, tipo === 'super' ? 0.3 : 0.2);
      const fuerza = tipo === 'super' ? 2.2 : tipo === 'tiro' ? 0.4 : 1;
      nucleo.scale.setScalar(1 + 0.6 * e * fuerza);
      capa.scale.setScalar(1 + 0.4 * e * fuerza);
      luz.intensity = 0.6 + 2 * e * fuerza;
      accion.position.z = tipo === 'ataque' ? 0.2 * e : 0;
      accion.position.y = tipo === 'tiro' ? 0.3 * pulso(f, 0.35) : 0;
      accion.rotation.y = tipo === 'super' ? suave(f) * Math.PI * 2 : 0;
    };
    return { pierna1: p1, pierna2: p2, flota: true };
  }

  function meteor(c, colorEquipo) {
    const roca = 0x5a2a1e;
    const [p1, p2] = piernas(c.raiz, 0x3a1a12, 0.22, 0.4, 0.22);
    pieza(c.cuerpo, new THREE.DodecahedronGeometry(0.55, 0), mat(roca), 0, 0.95, 0); // cuerpo de roca
    // Grietas de lava
    const grieta1 = pieza(c.cuerpo, new THREE.BoxGeometry(0.08, 0.6, 0.05), brillo(0xff6a00, 1.1), 0.12, 0.95, 0.5, false);
    const grieta2 = pieza(c.cuerpo, new THREE.BoxGeometry(0.4, 0.06, 0.05), brillo(0xff6a00, 1.1), -0.05, 1.05, 0.52, false);
    pieza(c.cuerpo, new THREE.CylinderGeometry(0.56, 0.56, 0.12, 7), brillo(colorEquipo, 0.5), 0, 0.55, 0);
    pieza(c.cuerpo, new THREE.DodecahedronGeometry(0.36, 0), mat(roca), 0, 1.65, 0); // cabeza
    pieza(c.cuerpo, new THREE.BoxGeometry(0.42, 0.09, 0.06), brillo(0xffd23f, 1.2), 0, 1.68, 0.32, false); // ojos
    // Llamas
    const llamas = [];
    [[0, 2.1, 0, 0.5], [-0.17, 1.98, -0.05, 0.35], [0.17, 1.98, -0.05, 0.35]].forEach(([x, y, z, h]) => {
      llamas.push(pieza(c.cuerpo, new THREE.ConeGeometry(0.14, h, 5), brillo(0xff7a1a, 1.3), x, y, z, false));
    });
    c.animar = (t) => {
      llamas.forEach((l, i) => { l.scale.y = 1 + Math.sin(t * 12 + i * 2) * 0.25; });
    };

    c.pose = (tipo, f, accion) => {
      let inclinar = 0, alto = 0, fuego = 0;
      if (tipo === 'ataque') {
        // Se echa hacia atrás para cargar y lanza el rayo inclinándose hacia adelante
        if (f < 0.25) { const k = suave(f / 0.25); inclinar = -0.3 * k; fuego = k; }
        else {
          const k = (f - 0.25) / 0.75;
          inclinar = k < 0.3 ? -0.3 + 0.75 * suave(k / 0.3) : 0.45 * (1 - suave((k - 0.3) / 0.7));
          fuego = 1 - suave(k);
        }
      } else if (tipo === 'super') {
        // Se eleva, sus llamas crecen y llama a los meteoritos
        const e = pulso(f, 0.35);
        alto = 0.5 * e;
        inclinar = -0.25 * e;
        fuego = e * 1.8;
      } else if (tipo === 'tiro') {
        alto = 0.3 * pulso(f, 0.35);
      }
      llamas.forEach((l) => { l.scale.y *= 1 + 1.2 * fuego; l.scale.x = l.scale.z = 1 + 0.4 * fuego; });
      grieta1.material.emissiveIntensity = grieta2.material.emissiveIntensity = 1.1 + 2 * fuego;
      accion.rotation.x = inclinar;
      accion.position.y = alto;
    };
    return { pierna1: p1, pierna2: p2 };
  }

  const constructores = { nova, kraag, zip, orbit, lumen, meteor };

  // Crea el modelo completo de un personaje con el color de su equipo
  // ---------- Skins: colores alternativos que se desbloquean con logros ----------
  const skins = [
    { id: 'normal', nombre: 'Normal' },
    { id: 'neon', nombre: 'Neón', logro: 'victoria' },
    { id: 'dorada', nombre: 'Dorada', logro: 'tresVictorias' },
    { id: 'galaxia', nombre: 'Galaxia', logro: 'turista' }
  ];
  function aplicarSkin(raiz, skin, colorEquipo, aro) {
    if (!skin || skin === 'normal') return;
    const equipo = new THREE.Color(colorEquipo).getHex();
    raiz.traverse((o) => {
      if (!o.isMesh || o === aro || !o.material || !o.material.color) return;
      const col = o.material.color;
      if (col.getHex() === equipo) return; // lo del color del equipo no cambia (así se sabe de qué equipo es)
      const luz = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
      if (luz > 0.88 || luz < 0.05) return; // ojos blancos o negros, igual
      const m = o.material.clone();
      o.material = m;
      if (skin === 'neon') {
        m.color.multiplyScalar(1.25);
        if (m.emissive) m.emissive.copy(m.color).multiplyScalar(0.55);
      } else if (skin === 'dorada') {
        m.color.lerp(new THREE.Color(0xffc83d), 0.7);
        if (m.emissive) m.emissive.setHex(0x3a2400);
        if ('metalness' in m) { m.metalness = 0.85; m.roughness = 0.28; }
      } else if (skin === 'galaxia') {
        m.color.lerp(new THREE.Color(0x3b1c86), 0.65);
        if (m.emissive) m.emissive.setHex(0x5a2ab0).multiplyScalar(0.45);
      }
    });
  }

  function crearModelo(id, colorEquipo, skin = 'normal') {
    const raiz = new THREE.Group();

    // Aro de equipo en el piso
    const aro = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.8, 24),
      new THREE.MeshBasicMaterial({ color: colorEquipo, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    aro.rotation.x = -Math.PI / 2;
    aro.position.y = 0.03;
    raiz.add(aro);

    // "accion" mueve todo el cuerpo en las animaciones de ataque;
    // "cuerpo" lo mueve la animación de caminar. Así no se pisan.
    const accion = new THREE.Group();
    raiz.add(accion);
    const cuerpo = new THREE.Group();
    accion.add(cuerpo);

    const c = { raiz, cuerpo, animar: null, pose: null };
    const extra = constructores[id](c, colorEquipo);
    aplicarSkin(raiz, skin, colorEquipo, aro);

    // Guardamos los materiales para poder hacer "parpadear" al personaje cuando recibe daño
    const materiales = [];
    raiz.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o !== aro) materiales.push(o.material); });

    raiz.userData = {
      cuerpo,
      pierna1: extra.pierna1,
      pierna2: extra.pierna2,
      flota: !!extra.flota,
      animar: c.animar,
      pose: c.pose,
      accion,
      anim: null,
      aro,
      materiales
    };
    return raiz;
  }

  // ---------- Animaciones de acción ----------
  // Duración (segundos) de cada animación
  const DURACION = { ataque: 0.35, super: 0.6, tiro: 0.4 };
  const DURACION_PJ = { kraag: { ataque: 0.42, super: 0.7 }, zip: { ataque: 0.28, super: 0.5 }, nova: { ataque: 0.25 } };

  // Empieza una animación: tipo = 'ataque' | 'super' | 'tiro'
  function animar(malla, tipo, idPersonaje) {
    const ud = malla.userData;
    if (!ud.pose) return;
    const propia = (idPersonaje && DURACION_PJ[idPersonaje]) || {};
    ud.anim = { tipo, t: 0, dur: propia[tipo] || DURACION[tipo] };
  }

  // Avanza la animación (llamar cada cuadro, después de la animación de caminar)
  function actualizarAnim(malla, dt) {
    const ud = malla.userData;
    if (!ud.anim) return;
    ud.anim.t += dt;
    const f = Math.min(1, ud.anim.t / ud.anim.dur);
    // El grupo "accion" vuelve a su posición normal y la pose lo mueve desde ahí
    ud.accion.position.set(0, 0, 0);
    ud.accion.rotation.set(0, 0, 0);
    ud.accion.scale.set(1, 1, 1);
    ud.pose(ud.anim.tipo, f, ud.accion);
    if (f >= 1) {
      ud.pose(ud.anim.tipo, 1, ud.accion);
      ud.accion.position.set(0, 0, 0);
      ud.accion.rotation.set(0, 0, 0);
      ud.accion.scale.set(1, 1, 1);
      ud.anim = null;
    }
  }

  return { skins, lista, info, crearModelo, animar, actualizarAnim };
})();
