/* ==========================================================
   ORBIX: OVERDRIVE — audio.js
   Todos los sonidos y la música se crean con código (Web Audio).
   No hace falta ningún archivo .mp3.
   ========================================================== */

const Sonido = (() => {
  let ctx = null;
  let master, sfxGain, musicGain;
  let musicaActiva = true;
  let musicTimer = null;
  let nextNoteTime = 0;
  let paso = 0;

  // El navegador solo deja sonar audio después de un clic del jugador.
  function iniciar() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = CONFIG.audio.volumenGeneral;
    master.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = CONFIG.audio.volumenEfectos;
    sfxGain.connect(master);

    musicGain = ctx.createGain();
    musicGain.gain.value = musicaActiva ? CONFIG.audio.volumenMusica : 0;
    musicGain.connect(master);
  }

  // ---- Bloques básicos ----

  // Un tono simple (oscilador) con volumen que se apaga solo
  function tono(freq, t0, dur, tipo = 'sine', vol = 0.3, destino = sfxGain, freqFinal = null) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    if (freqFinal) o.frequency.exponentialRampToValueAtTime(freqFinal, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(destino);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // Ruido (para golpes, red, platillos)
  let bufferRuido = null;
  function ruido(t0, dur, vol = 0.2, filtroFreq = 1000, tipoFiltro = 'highpass', destino = sfxGain) {
    if (!ctx) return;
    if (!bufferRuido) {
      bufferRuido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = bufferRuido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = bufferRuido;
    const f = ctx.createBiquadFilter();
    f.type = tipoFiltro;
    f.frequency.value = filtroFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(destino);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  const ahora = () => (ctx ? ctx.currentTime : 0);

  // ---- Efectos de sonido ----
  const sfx = {
    bote(fuerza = 1) {
      const v = Math.min(0.5, 0.15 + fuerza * 0.05);
      tono(140, ahora(), 0.12, 'sine', v, sfxGain, 55);
    },
    tiro() {
      ruido(ahora(), 0.15, 0.18, 900, 'bandpass');
      tono(260, ahora(), 0.12, 'triangle', 0.12, sfxGain, 520);
    },
    recoger() {
      tono(520, ahora(), 0.07, 'triangle', 0.18, sfxGain, 820);
    },
    aro() {
      tono(880, ahora(), 0.3, 'square', 0.05, sfxGain, 700);
      tono(1320, ahora(), 0.25, 'sine', 0.08);
    },
    tablero() {
      tono(200, ahora(), 0.1, 'square', 0.1, sfxGain, 120);
      ruido(ahora(), 0.08, 0.12, 400, 'lowpass');
    },
    canasta(triple = false) {
      const t = ahora();
      ruido(t, 0.35, 0.22, 2500, 'highpass'); // "swish" de la red
      const notas = triple ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
      notas.forEach((n, i) => tono(n, t + 0.08 + i * 0.07, 0.25, 'triangle', 0.2));
    },
    impulso() {
      ruido(ahora(), 0.2, 0.18, 600, 'lowpass');
      tono(180, ahora(), 0.18, 'sawtooth', 0.06, sfxGain, 420);
    },
    click() {
      tono(700, ahora(), 0.05, 'square', 0.06);
    },
    silbato() {
      const t = ahora();
      tono(2100, t, 0.18, 'sine', 0.2);
      tono(2100, t + 0.22, 0.4, 'sine', 0.2);
    },
    bocina() {
      const t = ahora();
      tono(180, t, 1.0, 'sawtooth', 0.15);
      tono(184, t, 1.0, 'square', 0.08);
    },
    logro() {
      const t = ahora();
      [784, 988, 1175, 1568].forEach((n, i) => tono(n, t + i * 0.09, 0.3, 'sine', 0.18));
    },
    disparo(tipo = 'proyectil') {
      const t = ahora();
      if (tipo === 'bomba') {
        tono(220, t, 0.18, 'square', 0.08, sfxGain, 110);
        ruido(t, 0.12, 0.12, 600, 'lowpass');
      } else if (tipo === 'rayo') {
        tono(900, t, 0.25, 'sawtooth', 0.07, sfxGain, 200);
        ruido(t, 0.2, 0.1, 1500, 'bandpass');
      } else {
        tono(1100, t, 0.1, 'square', 0.06, sfxGain, 400);
      }
    },
    golpe() {
      ruido(ahora(), 0.15, 0.3, 300, 'lowpass');
      tono(90, ahora(), 0.15, 'sine', 0.35, sfxGain, 50);
    },
    impacto() {
      tono(600, ahora(), 0.06, 'square', 0.05, sfxGain, 300);
    },
    dañoRecibido() {
      tono(180, ahora(), 0.15, 'sawtooth', 0.12, sfxGain, 90);
    },
    explosion() {
      ruido(ahora(), 0.5, 0.35, 500, 'lowpass');
      tono(70, ahora(), 0.4, 'sine', 0.4, sfxGain, 35);
    },
    eliminado() {
      const t = ahora();
      tono(500, t, 0.4, 'sawtooth', 0.1, sfxGain, 80);
      ruido(t, 0.3, 0.2, 900, 'bandpass');
    },
    reaparecer() {
      const t = ahora();
      [392, 523, 659].forEach((n, i) => tono(n, t + i * 0.06, 0.2, 'sine', 0.14));
    },
    pase() {
      tono(500, ahora(), 0.1, 'triangle', 0.15, sfxGain, 700);
      ruido(ahora(), 0.08, 0.08, 1200, 'bandpass');
    },
    robo() {
      const t = ahora();
      tono(400, t, 0.08, 'square', 0.08, sfxGain, 900);
      tono(900, t + 0.07, 0.12, 'triangle', 0.15);
    },
    superLista() {
      const t = ahora();
      [659, 880, 1175].forEach((n, i) => tono(n, t + i * 0.07, 0.25, 'triangle', 0.16));
    },
    superNova() {
      const t = ahora();
      for (let i = 0; i < 5; i++) tono(1400 - i * 120, t + i * 0.03, 0.12, 'square', 0.05, sfxGain, 500);
    },
    salto() {
      tono(150, ahora(), 0.5, 'sawtooth', 0.12, sfxGain, 600);
    },
    turbo() {
      tono(300, ahora(), 0.4, 'sawtooth', 0.1, sfxGain, 1500);
      ruido(ahora(), 0.35, 0.12, 2000, 'highpass');
    },
    escudo() {
      const t = ahora();
      [523, 784, 1047, 1568].forEach((n, i) => tono(n, t + i * 0.05, 0.4, 'sine', 0.13));
    },
    superMeteor() {
      tono(1200, ahora(), 0.6, 'sawtooth', 0.08, sfxGain, 150);
    },
    poderAparece() {
      const t = ahora();
      tono(880, t, 0.15, 'sine', 0.1);
      tono(1320, t + 0.1, 0.2, 'sine', 0.1);
    },
    poder() {
      const t = ahora();
      [523, 659, 784, 1047].forEach((n, i) => tono(n, t + i * 0.04, 0.18, 'triangle', 0.15));
    },
    tic() {
      tono(1000, ahora(), 0.08, 'square', 0.08);
    },
    elegir() {
      const t = ahora();
      tono(660, t, 0.08, 'triangle', 0.15);
      tono(990, t + 0.06, 0.12, 'triangle', 0.15);
    },
    error() {
      tono(220, ahora(), 0.15, 'square', 0.06, sfxGain, 160);
    }
  };

  // ---- Música (sintetizada en vivo) ----
  // Progresión: La menor - Fa - Do - Sol (sonido espacial y con energía)
  const progresion = [
    [220.0, 261.6, 329.6],  // Am
    [174.6, 220.0, 261.6],  // F
    [261.6, 329.6, 392.0],  // C
    [196.0, 246.9, 293.7]   // G
  ];

  function tocarPaso(p, t) {
    const acorde = progresion[Math.floor(p / 16) % 4];
    const sem = 60 / CONFIG.audio.tempoMusica / 4; // duración de una semicorchea

    // Bombo
    if (p % 8 === 0) tono(110, t, 0.25, 'sine', 0.5, musicGain, 40);
    // Caja
    if (p % 16 === 8) ruido(t, 0.15, 0.18, 1500, 'bandpass', musicGain);
    // Platillo
    if (p % 2 === 1) ruido(t, 0.04, 0.05, 7000, 'highpass', musicGain);
    // Bajo
    if (p % 4 === 0 || p % 16 === 6) tono(acorde[0] / 2, t, sem * 3, 'triangle', 0.28, musicGain);
    // Arpegio
    if (p % 2 === 0) {
      const nota = acorde[(p / 2) % 3] * (p % 8 < 4 ? 2 : 1);
      tono(nota, t, sem * 1.6, 'square', 0.035, musicGain);
    }
  }

  function programarMusica() {
    if (!ctx) return;
    const sem = 60 / CONFIG.audio.tempoMusica / 4;
    while (nextNoteTime < ctx.currentTime + 0.15) {
      tocarPaso(paso, nextNoteTime);
      nextNoteTime += sem;
      paso = (paso + 1) % 64;
    }
  }

  function iniciarMusica() {
    if (!ctx || musicTimer) return;
    nextNoteTime = ctx.currentTime + 0.05;
    paso = 0;
    musicTimer = setInterval(programarMusica, 25);
  }

  function detenerMusica() {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  function alternarMusica() {
    musicaActiva = !musicaActiva;
    if (musicGain) {
      musicGain.gain.setTargetAtTime(musicaActiva ? CONFIG.audio.volumenMusica : 0, ctx.currentTime, 0.05);
    }
    return musicaActiva;
  }

  // Cambiar volúmenes desde la pantalla de Ajustes (0 a 1)
  function volumenEfectos(v) {
    CONFIG.audio.volumenEfectos = v;
    if (sfxGain) sfxGain.gain.value = v;
  }
  function volumenMusica(v) {
    CONFIG.audio.volumenMusica = v;
    if (musicGain && musicaActiva) musicGain.gain.value = v;
  }

  return {
    iniciar,
    volumenEfectos,
    volumenMusica,
    sfx,
    iniciarMusica,
    detenerMusica,
    alternarMusica,
    get musicaActiva() { return musicaActiva; }
  };
})();
