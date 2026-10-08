/* ==========================================================================
   Paremia — refranes de siempre en lenguaje de ventanilla
   La primera parte (lógica) no toca el DOM y se puede probar con Node:
     node --test tests/logic.test.js
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuración
  // ---------------------------------------------------------------------------

  // Día n.º 1 del juego (fecha local, AAAA-MM-DD). Cada medianoche avanza un día.
  var FECHA_INICIO = '2026-10-02';

  var CLAVE_ALMACEN = 'paremia:v1';
  var URL_DATOS = 'data/refranes.json';

  // ---------------------------------------------------------------------------
  // Fechas y días
  // ---------------------------------------------------------------------------

  function leerFechaISO(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  // Número de día (1, 2, 3…) para una fecha local. Se cuenta en UTC para que
  // los cambios de horario de verano no descuadren la resta.
  function numeroDia(fecha, inicioISO) {
    var inicio = leerFechaISO(inicioISO || FECHA_INICIO);
    var a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    var b = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    return Math.floor((b - a) / 86400000) + 1;
  }

  // Contenido del día `dia`: al acabarse los días, el ciclo vuelve a empezar por el primero.
  function diaDeContenido(dias, dia) {
    return dias[(dia - 1) % dias.length];
  }

  // ?dia=N fuerza el día N (para probar el prototipo).
  function diaForzado(search) {
    var m = /[?&]dia=(\d+)/.exec(search || '');
    if (!m) return null;
    var n = parseInt(m[1], 10);
    return n >= 1 ? n : null;
  }

  function msHastaMedianoche(ahora) {
    var siguiente = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    return siguiente - ahora;
  }

  function formatoCuentaAtras(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
    return [h, m, s].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }

  // ---------------------------------------------------------------------------
  // Texto: normalización y comparación
  // ---------------------------------------------------------------------------

  // Minúsculas, sin tildes ni signos, espacios simples.
  function normalizar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var fila = [];
    for (var j = 0; j <= b.length; j++) fila[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var diagonal = fila[0];
      fila[0] = i;
      for (j = 1; j <= b.length; j++) {
        var arriba = fila[j];
        fila[j] = Math.min(
          fila[j] + 1,
          fila[j - 1] + 1,
          diagonal + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)
        );
        diagonal = arriba;
      }
    }
    return fila[b.length];
  }

  var UMBRAL_ACIERTO = 0.15;
  var UMBRAL_CASI = 0.30;
  // Al tercer fallo el refrán se da por perdido, como si te rindieras.
  var MAX_FALLOS = 3;

  // Devuelve 'exacto', 'aproximado', 'casi' o 'mal'.
  // Se compara con el texto canónico y con cada variante; el umbral se mide
  // sobre la longitud de la forma con la que se compara.
  function comprobarRespuesta(respuesta, refran) {
    var r = normalizar(respuesta);
    if (!r) return 'vacio';
    var formas = [refran.original].concat(refran.variantes || []).map(normalizar);
    if (formas.indexOf(r) !== -1) return 'exacto';
    var mejor = Infinity;
    formas.forEach(function (f) {
      var proporcion = levenshtein(r, f) / f.length;
      if (proporcion < mejor) mejor = proporcion;
    });
    if (mejor <= UMBRAL_ACIERTO) return 'aproximado';
    if (mejor <= UMBRAL_CASI) return 'casi';
    return 'mal';
  }

  // Palabras del esqueleto: { letras: 'ladrador', signo: ',' }.
  function esqueleto(original) {
    return original.split(/\s+/).filter(Boolean).map(function (token) {
      var m = /^([^\p{L}\p{N}]*)([\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*)([^\p{L}\p{N}]*)$/u.exec(token);
      if (!m) return { antes: '', letras: token, signo: '' };
      return { antes: m[1], letras: m[2], signo: m[3] };
    });
  }

  // Reparte lo tecleado entre los huecos del esqueleto. Las letras llenan las
  // palabras por orden, saltándose las destapadas; al completar una palabra se
  // pasa sola a la siguiente, y un espacio adelanta a la siguiente si la actual
  // ya tiene alguna letra. Si se teclea una palabra destapada (o su comienzo, al
  // final del texto), se da por escrita y no ocupa huecos. Lo que no cabe se descarta.
  // base (opcional): letras ya puestas, una lista de huecos por palabra ('' si está
  // vacío); lo tecleado las sobrescribe a partir de ancla ({ palabra, hueco }), que
  // es la casilla tocada (por omisión, la primera).
  // Devuelve { celdas: [huecos de cada palabra], letras: [texto de cada palabra],
  // actual: palabra en curso o -1, hueco: hueco en curso, consumido: lo que cupo }.
  function repartirLetras(texto, palabras, destapadas, base, ancla) {
    var huecos = palabras.map(function (p) { return Array.from(p.letras).length; });
    var libres = [];
    for (var i = 0; i < palabras.length; i++) if (destapadas.indexOf(i) === -1) libres.push(i);
    var celdas = palabras.map(function (p, i) {
      var previas = (base && base[i]) || [];
      var fila = [];
      for (var j = 0; j < huecos[i]; j++) fila.push(destapadas.indexOf(i) === -1 && previas[j] || '');
      return fila;
    });
    var c = Array.from(String(texto || '').normalize('NFC'));
    var esLetra = function (x) { return /[\p{L}\p{N}]/u.test(x); };

    // Posición tras la palabra destapada si el texto la deletrea desde pos; si no, -1.
    function saltarDestapada(pos, palabra) {
      var objetivo = Array.from(normalizar(palabra));
      var t = 0;
      while (pos < c.length && t < objetivo.length) {
        if (/\s/.test(c[pos])) break;
        if (esLetra(c[pos])) {
          if (normalizar(c[pos]) !== objetivo[t]) return -1;
          t++;
        }
        pos++;
      }
      if (pos >= c.length) return pos;
      return t === objetivo.length && !esLetra(c[pos]) ? pos : -1;
    }

    // Se empieza en la casilla del ancla, o en la siguiente palabra libre.
    var k = 0, h = 0;
    if (ancla) {
      if (ancla.palabra === -1) k = libres.length;
      else {
        while (k < libres.length && libres[k] < ancla.palabra) k++;
        if (libres[k] === ancla.palabra) h = Math.min(ancla.hueco | 0, huecos[ancla.palabra] - 1);
      }
    }
    var revisada = -1;
    for (var pos = 0; pos < c.length && k < libres.length; pos++) {
      if (/\s/.test(c[pos])) { if (h > 0) { k++; h = 0; } continue; }
      if (!esLetra(c[pos])) continue;
      if (h >= huecos[libres[k]]) { k++; h = 0; if (k >= libres.length) break; }
      if (h === 0 && revisada !== k) {
        // Al empezar palabra, las destapadas que la preceden se pueden teclear.
        revisada = k;
        var antes = k > 0 ? libres[k - 1] + 1 : 0;
        for (var d = antes; d < libres[k]; d++) {
          var tras = saltarDestapada(pos, palabras[d].letras);
          if (tras === -1) break;
          pos = tras;
          while (pos < c.length && !esLetra(c[pos])) pos++;
        }
        if (d > antes) { pos--; continue; }
      }
      celdas[libres[k]][h++] = c[pos];
    }
    // Si la palabra en curso está llena, la siguiente letra irá a la próxima.
    if (k < libres.length && h >= huecos[libres[k]]) { k++; h = 0; }
    return {
      celdas: celdas,
      letras: celdas.map(function (fila) { return fila.join(''); }),
      actual: k < libres.length ? libres[k] : -1,
      hueco: h,
      consumido: c.slice(0, pos).join('')
    };
  }

  // La casilla libre anterior (paso -1) o siguiente (paso 1) a la dada: null si no
  // hay anterior, { palabra: -1 } («después de la última») si no hay siguiente.
  function casillaVecina(palabras, destapadas, casilla, paso) {
    var lista = [];
    palabras.forEach(function (p, i) {
      if (destapadas.indexOf(i) !== -1) return;
      for (var j = 0; j < Array.from(p.letras).length; j++) lista.push({ palabra: i, hueco: j });
    });
    var n = lista.length;
    for (var k = 0; k < lista.length; k++) {
      var x = lista[k];
      if (casilla.palabra !== -1 && (x.palabra > casilla.palabra || (x.palabra === casilla.palabra && x.hueco >= casilla.hueco))) { n = k; break; }
    }
    var exacta = n < lista.length && lista[n].palabra === casilla.palabra && lista[n].hueco === casilla.hueco;
    var destino = paso > 0 ? (exacta ? n + 1 : n) : n - 1;
    if (destino < 0) return null;
    return destino < lista.length ? lista[destino] : { palabra: -1, hueco: 0 };
  }

  // El refrán tal como ha quedado en el esqueleto: lo escrito más lo destapado.
  function textoDelEsqueleto(palabras, letras, destapadas) {
    return palabras.map(function (p, i) {
      return destapadas.indexOf(i) !== -1 ? p.letras : letras[i];
    }).filter(Boolean).join(' ');
  }

  // ---------------------------------------------------------------------------
  // Pistas: orden aleatorio, pero fijo para cada refrán
  // ---------------------------------------------------------------------------

  function hashTexto(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32
  function aleatorioConSemilla(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Índices de las palabras en el orden en que se destapan. La primera pista
  // nunca es la primera palabra.
  function ordenPistas(original) {
    var n = esqueleto(original).length;
    var orden = [];
    for (var i = 0; i < n; i++) orden.push(i);
    var azar = aleatorioConSemilla(hashTexto(normalizar(original)));
    for (i = n - 1; i > 0; i--) {
      var j = Math.floor(azar() * (i + 1));
      var t = orden[i]; orden[i] = orden[j]; orden[j] = t;
    }
    if (n > 1 && orden[0] === 0) {
      var k = 1 + Math.floor(azar() * (n - 1));
      orden[0] = orden[k]; orden[k] = 0;
    }
    return orden;
  }

  // ---------------------------------------------------------------------------
  // Puntuación y compartir
  // ---------------------------------------------------------------------------

  // Cada pista y cada respuesta fallida restan un punto, hasta quedarse en 1.
  function tropiezos(r) {
    return (r.pistas || 0) + (r.fallos || 0);
  }

  function valorRefran(r) {
    return Math.max(1, 3 - tropiezos(r));
  }

  // Apunta una respuesta fallida. Al llegar a MAX_FALLOS el refrán queda
  // rendido (0 puntos); devuelve true en ese caso.
  function registrarFallo(r) {
    r.fallos = (r.fallos || 0) + 1;
    if (r.fallos < MAX_FALLOS) return false;
    r.estado = 'rendido';
    return true;
  }

  function puntosRefran(r) {
    if (!r || r.estado === 'rendido') return 0;
    return valorRefran(r);
  }

  function puntosPartida(partida) {
    return partida.refranes.reduce(function (s, r) {
      return s + (r.estado === 'jugando' ? 0 : puntosRefran(r));
    }, 0);
  }

  function emojiRefran(r) {
    if (r.estado === 'rendido') return '⬛';
    return tropiezos(r) === 0 ? '🟩' : '🟨';
  }

  // Una marca por refrán: ▰ adivinado, ▱ rendido. «Paremia nº 7 ▰▱▰ 2/3 aciertos» y el enlace.
  function textoCompartir(dia, partida) {
    var marcas = partida.refranes.map(function (r) { return r.estado === 'rendido' ? '▱' : '▰'; });
    var aciertos = marcas.filter(function (m) { return m === '▰'; }).length;
    return 'Paremia nº ' + dia + ' ' + marcas.join('') + ' ' + aciertos + '/' + marcas.length + ' aciertos\njoseleking.github.io/Paremia';
  }

  // ---------------------------------------------------------------------------
  // Estado guardado
  // ---------------------------------------------------------------------------

  function estadoVacio() {
    return {
      visto: false,          // ya vio la explicación inicial
      partidas: {},          // { [dia]: { refranes: [{ estado, pistas, intentos }], terminada } }
      historial: {},         // { [dia]: puntos }
      racha: { actual: 0, maxima: 0, ultimoDia: null }
    };
  }

  function cargarEstado(almacen) {
    var e = estadoVacio();
    try {
      var bruto = almacen && almacen.getItem(CLAVE_ALMACEN);
      if (!bruto) return e;
      var datos = JSON.parse(bruto);
      if (!datos || typeof datos !== 'object') return e;
      e.visto = !!datos.visto;
      if (datos.partidas && typeof datos.partidas === 'object') e.partidas = datos.partidas;
      if (datos.historial && typeof datos.historial === 'object') e.historial = datos.historial;
      if (datos.racha && typeof datos.racha === 'object') {
        e.racha.actual = datos.racha.actual | 0;
        e.racha.maxima = datos.racha.maxima | 0;
        e.racha.ultimoDia = typeof datos.racha.ultimoDia === 'number' ? datos.racha.ultimoDia : null;
      }
    } catch (err) { /* almacén ilegible: se empieza de cero */ }
    return e;
  }

  function guardarEstado(almacen, estado) {
    try {
      if (almacen) almacen.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch (err) { /* sin almacenamiento: se juega igual */ }
  }

  function partidaDelDia(estado, dia, cuantos) {
    var p = estado.partidas[dia];
    if (!p || !Array.isArray(p.refranes) || p.refranes.length !== cuantos) {
      p = { refranes: [], terminada: false };
      for (var i = 0; i < cuantos; i++) p.refranes.push({ estado: 'jugando', pistas: 0, fallos: 0, intentos: 0 });
      estado.partidas[dia] = p;
    }
    return p;
  }

  // Índice del refrán en juego, o -1 si ya están todos.
  function refranActual(partida) {
    for (var i = 0; i < partida.refranes.length; i++) {
      if (partida.refranes[i].estado === 'jugando') return i;
    }
    return -1;
  }

  function terminarPartida(estado, dia) {
    var p = estado.partidas[dia];
    if (!p || p.terminada) return false;
    p.terminada = true;
    estado.historial[dia] = puntosPartida(p);
    var r = estado.racha;
    r.actual = (r.ultimoDia === dia - 1) ? r.actual + 1 : 1;
    r.ultimoDia = dia;
    if (r.actual > r.maxima) r.maxima = r.actual;
    return true;
  }

  // Racha visible hoy: se pierde si ayer no se terminó la partida.
  function rachaVigente(estado, hoy) {
    var r = estado.racha;
    if (r.ultimoDia === null) return 0;
    return r.ultimoDia >= hoy - 1 ? r.actual : 0;
  }

  var Logica = {
    FECHA_INICIO: FECHA_INICIO,
    CLAVE_ALMACEN: CLAVE_ALMACEN,
    leerFechaISO: leerFechaISO,
    numeroDia: numeroDia,
    diaDeContenido: diaDeContenido,
    diaForzado: diaForzado,
    msHastaMedianoche: msHastaMedianoche,
    formatoCuentaAtras: formatoCuentaAtras,
    normalizar: normalizar,
    levenshtein: levenshtein,
    comprobarRespuesta: comprobarRespuesta,
    MAX_FALLOS: MAX_FALLOS,
    registrarFallo: registrarFallo,
    esqueleto: esqueleto,
    repartirLetras: repartirLetras,
    casillaVecina: casillaVecina,
    textoDelEsqueleto: textoDelEsqueleto,
    ordenPistas: ordenPistas,
    valorRefran: valorRefran,
    puntosRefran: puntosRefran,
    puntosPartida: puntosPartida,
    textoCompartir: textoCompartir,
    estadoVacio: estadoVacio,
    cargarEstado: cargarEstado,
    guardarEstado: guardarEstado,
    partidaDelDia: partidaDelDia,
    refranActual: refranActual,
    terminarPartida: terminarPartida,
    rachaVigente: rachaVigente
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logica;
  if (typeof document === 'undefined') return;

  // ---------------------------------------------------------------------------
  // Interfaz
  // ---------------------------------------------------------------------------

  var app = document.getElementById('app');
  var modal = document.getElementById('modal');
  var modalCuerpo = document.getElementById('modal-cuerpo');
  var avisoEl = document.getElementById('aviso');
  var almacen = (function () { try { return window.localStorage; } catch (e) { return null; } })();

  var estado = cargarEstado(almacen);
  var dias = null;          // array de días de refranes.json
  var hoy = 0;              // número de día que se juega
  var forzado = diaForzado(location.search);
  var temporizador = null;
  var temporizadorAviso = null;
  var NUMERALES = ['I', 'II', 'III', 'IV', 'V'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fechaLarga(d) {
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function fechaDelDia(n) {
    var inicio = leerFechaISO(FECHA_INICIO);
    return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + n - 1);
  }

  function guardar() { guardarEstado(almacen, estado); }

  // Con la partida de hoy terminada, la mano ☜ marca Paremia como «Hecho» en Almanaque,
  // y su hoja muestra un punto por refrán resuelto (vacío si te rendiste) y la racha:
  // «Hoy ● ● ○ · racha 3». Con ?dia=N no se manda el resultado: es un día de prueba.
  function avisarAlmanaque() {
    var partida = partidaHoy();
    function avisar() {
      if (!window.almanaqueHecho) return;
      if (forzado) { window.almanaqueHecho(); return; }
      window.almanaqueHecho({
        aciertos: partida.refranes.filter(function (r) { return r.estado !== 'rendido'; }).length,
        total: partida.refranes.length,
        racha: rachaVigente(estado, hoy)
      });
    }
    // Este script corre antes que volver-almanaque.js (que lleva defer): si aún no existe,
    // se espera a DOMContentLoaded, que llega después de los scripts con defer.
    if (window.almanaqueHecho) avisar();
    else document.addEventListener('DOMContentLoaded', avisar, { once: true });
  }

  function subtitulo(texto) { document.getElementById('subtitulo').textContent = texto; }

  function aviso(msg) {
    avisoEl.textContent = msg;
    avisoEl.classList.add('is-visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { avisoEl.classList.remove('is-visible'); }, 2400);
  }

  function pintar(html) {
    pararCuentaAtras();
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function partidaHoy() {
    return partidaDelDia(estado, hoy, diaDeContenido(dias, hoy).refranes.length);
  }

  // ---------- Piezas ----------

  // escrito (opcional): lo que devuelve repartirLetras, para pintar lo tecleado
  // en los huecos y marcar dónde irá la siguiente letra.
  function htmlEsqueleto(refran, destapadas, todo, escrito) {
    var palabras = esqueleto(refran.original);
    return '<p class="esqueleto" aria-label="Esqueleto del refrán: ' + palabras.length + ' palabras">' +
      palabras.map(function (p, i) {
        var visible = todo || destapadas.indexOf(i) !== -1;
        var letras = Array.from(p.letras);
        var puestas = escrito ? escrito.celdas[i] : [];
        var cursor = escrito && escrito.actual === i ? escrito.hueco : -1;
        var huecos = visible ? '<span class="destapada">' + esc(p.letras) + '</span>' :
          letras.map(function (x, j) {
            var clase = 'hueco' + (puestas[j] ? ' is-lleno' : '') + (j === cursor ? ' is-cursor' : '');
            return '<span class="' + clase + '" data-palabra="' + i + '" data-hueco="' + j + '">' + esc(puestas[j] || '') + '</span>';
          }).join('');
        return '<span class="palabra' + (visible ? ' palabra--vista' : '') + '" data-palabra="' + i + '"' +
          ' aria-label="' + (visible ? esc(p.letras) : letras.length + ' letras') + '">' +
          (p.antes ? '<span class="signo" aria-hidden="true">' + esc(p.antes) + '</span>' : '') +
          '<span class="casilla" aria-hidden="true">' + huecos + '</span>' +
          (p.signo ? '<span class="signo" aria-hidden="true">' + esc(p.signo) + '</span>' : '') +
          '</span>';
      }).join(' ') +
      '</p>';
  }

  function htmlDictamen(refran, i, total) {
    return '<figure class="dictamen">' +
      '<figcaption class="dictamen__cabecera">' +
      '<span>Expediente ' + hoy + '/' + NUMERALES[i] + '</span>' +
      '<span>Folio ' + (i + 1) + ' de ' + total + '</span>' +
      '</figcaption>' +
      '<blockquote class="dictamen__texto">' + esc(refran.pedante) + '</blockquote>' +
      '</figure>';
  }

  function htmlValor(r) {
    var puntos = valorRefran(r);
    var marcas = '';
    for (var k = 0; k < 3; k++) marcas += '<span class="valor__punto' + (k < puntos ? ' is-lleno' : '') + '"></span>';
    return '<p class="valor" aria-label="Este refrán vale ahora ' + puntos + (puntos === 1 ? ' punto' : ' puntos') + '">' +
      '<span class="valor__marcas" aria-hidden="true">' + marcas + '</span>' +
      'Vale ' + puntos + (puntos === 1 ? ' punto' : ' puntos') + '</p>';
  }

  var VEREDICTOS = {
    3: { sello: 'Descifrado', frase: 'A la primera y sin ayuda.' },
    2: { sello: 'Descifrado', frase: 'Con un tropiezo.' },
    1: { sello: 'Descifrado', frase: 'Con unos cuantos tropiezos.' },
    0: { sello: 'Archivado', frase: 'Te has rendido. Otra vez será.' }
  };

  function htmlRecompensa(refran, r) {
    var puntos = puntosRefran(r);
    var v = VEREDICTOS[puntos];
    if (puntos === 0 && (r.fallos || 0) >= MAX_FALLOS) v = { sello: v.sello, frase: 'Tres intentos fallidos. Otra vez será.' };
    var eq = refran.equivalente;
    return '<article class="recompensa' + (puntos === 0 ? ' recompensa--rendido' : '') + '">' +
      '<span class="sello" aria-hidden="true">' + v.sello + '</span>' +
      '<p class="recompensa__etiqueta">Dice el refranero</p>' +
      '<p class="recompensa__refran">' + esc(refran.original) + '</p>' +
      '<div class="floron" aria-hidden="true">❦</div>' +
      '<dl class="recompensa__glosa">' +
      '<dt>Significado</dt><dd>' + esc(refran.significado) + '</dd>' +
      (eq ? '<dt>En ' + esc(eq.idioma) + '</dt><dd lang="' + (eq.idioma === 'francés' ? 'fr' : 'en') + '"><i>' + esc(eq.texto) + '</i></dd>' : '') +
      '</dl>' +
      '<p class="recompensa__puntos">' + v.frase + ' <b>+' + puntos + '</b></p>' +
      '</article>';
  }

  function htmlEstadisticas() {
    var jugados = Object.keys(estado.historial);
    var total = jugados.reduce(function (s, d) { return s + estado.historial[d]; }, 0);
    var media = jugados.length ? (total / jugados.length).toFixed(1).replace('.', ',') : '–';
    return '<dl class="cifras">' +
      '<div><dt>Jugados</dt><dd>' + jugados.length + '</dd></div>' +
      '<div><dt>Media</dt><dd>' + media + '</dd></div>' +
      '<div><dt>Racha</dt><dd>' + rachaVigente(estado, hoy) + '</dd></div>' +
      '<div><dt>Mejor racha</dt><dd>' + estado.racha.maxima + '</dd></div>' +
      '</dl>';
  }

  // ---------- Pantallas ----------

  // Solo la primera vez: cómo se juega y botón «Jugar». Después se entra directo
  // al refrán en curso (o al resultado); las reglas quedan en el botón «?».
  function pantallaInicio() {
    subtitulo('Refranero para tiempos burocráticos');
    pintar(
      '<section class="pantalla pantalla--inicio">' +
      '<p class="kicker">Día ' + hoy + ' · ' + esc(fechaLarga(forzado ? fechaDelDia(hoy) : new Date())) + '</p>' +
      htmlComoSeJuega() +
      '<button class="btn btn--grande" id="btn-jugar" type="button">Jugar</button>' +
      '</section>'
    );
    document.getElementById('btn-jugar').addEventListener('click', function () {
      estado.visto = true;
      guardar();
      pantallaRefran();
    });
  }

  function htmlComoSeJuega() {
    return '<div class="reglas">' +
      '<p>Cada día, <b>tres refranes</b> reescritos de forma enrevesada. Tienes que adivinar el original.</p>' +
      '<div class="ejemplo">' +
      '<p class="ejemplo__pedante">«Resulta preferible un ave efectivamente bajo custodia manual que un centenar de ellas en régimen de vuelo libre.»</p>' +
      '<p class="ejemplo__flecha" aria-hidden="true">☟</p>' +
      '<p class="ejemplo__refran">Más vale pájaro en mano que ciento volando</p>' +
      '</div>' +
      '<ul class="reglas__lista">' +
      '<li>Bajo el texto verás el <b>esqueleto</b> del refrán: una casilla por palabra, con un hueco por letra.</li>' +
      '<li>Toca el esqueleto y escribe el refrán: las letras irán llenando los huecos y las palabras destapadas se saltan solas. Para corregir, toca cualquier hueco y escribe desde ahí. No importan las tildes, las mayúsculas ni alguna errata.</li>' +
      '<li><b>Pista: desvelar una palabra</b> te enseña una palabra del refrán, pero el refrán vale un punto menos.</li>' +
      '<li>Comprobar un refrán que no es el bueno también resta un punto. Al tercer fallo, el refrán se da por perdido (0 puntos).</li>' +
      '<li>Cada refrán vale 3 puntos y nunca baja de 1 si lo aciertas. Si te rindes, 0.</li>' +
      '</ul>' +
      '</div>';
  }

  function pantallaRefran() {
    var partida = partidaHoy();
    var i = refranActual(partida);
    if (i === -1) { pantallaResultado(); return; }
    var refran = diaDeContenido(dias, hoy).refranes[i];
    var r = partida.refranes[i];
    var orden = ordenPistas(refran.original);
    var total = partida.refranes.length;
    subtitulo('Día ' + hoy + ' · Refrán ' + NUMERALES[i] + ' de ' + NUMERALES[total - 1]);

    pintar(
      '<section class="pantalla pantalla--refran">' +
      htmlProgreso(partida, i) +
      htmlDictamen(refran, i, total) +
      '<form class="respuesta" id="form-respuesta" autocomplete="off" novalidate>' +
      // El campo de texto es invisible y cubre el esqueleto: al tocar los huecos
      // se abre el teclado y lo tecleado se pinta letra a letra en ellos.
      '<div class="tablero" id="tablero">' +
      '<div id="esqueleto"></div>' +
      '<input id="campo" class="tablero__campo" type="text" aria-label="Escribe el refrán original en los huecos" ' +
      'autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go">' +
      '</div>' +
      '<p class="respuesta__mensaje" id="mensaje" role="status" aria-live="polite">Toca los huecos y escribe el refrán.</p>' +
      '<button class="btn btn--grande" type="submit">Comprobar</button>' +
      '<div class="respuesta__ayudas">' +
      '<button class="btn btn--sec" id="btn-pista" type="button">Pista: desvelar una palabra</button>' +
      '<button class="btn btn--sec btn--rendirse" id="btn-rendirse" type="button">Me rindo</button>' +
      '</div>' +
      '<div id="valor">' + htmlValor(r) + '</div>' +
      '</form>' +
      '</section>'
    );

    var palabras = esqueleto(refran.original);
    var form = document.getElementById('form-respuesta');
    var tablero = document.getElementById('tablero');
    var campo = document.getElementById('campo');
    var mensaje = document.getElementById('mensaje');
    var btnPista = document.getElementById('btn-pista');
    var btnRendirse = document.getElementById('btn-rendirse');
    var confirmarRendicion = null;
    var escrito = null;
    // Lo ya fijado en los huecos y la casilla desde la que se escribe ahora; el campo
    // invisible guarda solo lo tecleado desde entonces, que se reparte a partir de ahí.
    var base = null;
    var ancla = null;

    function destapadas() { return orden.slice(0, r.pistas); }

    function pintarEsqueleto() {
      escrito = repartirLetras(campo.value, palabras, destapadas(), base, ancla);
      document.getElementById('esqueleto').innerHTML = htmlEsqueleto(refran, destapadas(), false, escrito);
    }

    // Da por puesto lo tecleado y sigue escribiendo desde la casilla indicada
    // (por omisión, donde está el cursor).
    function fijar(casilla) {
      base = escrito ? escrito.celdas : null;
      ancla = casilla || (escrito ? { palabra: escrito.actual, hueco: escrito.hueco } : null);
      campo.value = '';
      pintarEsqueleto();
    }

    function actualizarPistas() {
      pintarEsqueleto();
      document.getElementById('valor').innerHTML = htmlValor(r);
      btnPista.disabled = r.pistas >= orden.length;
    }
    actualizarPistas();

    // Se escribe siempre al final: el cursor del campo invisible no se puede mover
    // (para cambiar de sitio se toca una casilla o se usan las flechas).
    function cursorAlFinal() {
      var n = campo.value.length;
      if (campo.selectionStart !== n || campo.selectionEnd !== n) campo.setSelectionRange(n, n);
    }
    // Que el teclado no tape el esqueleto ni el botón «Comprobar».
    function mostrarTablero() {
      setTimeout(function () { form.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 300);
    }
    campo.addEventListener('input', function (ev) {
      pintarEsqueleto();
      // Lo que ya no cabe en los huecos se descarta, para que borrar actúe enseguida.
      if (!ev.isComposing && escrito.actual === -1 && campo.value !== escrito.consumido) campo.value = escrito.consumido;
      mensaje.textContent = '';
      mensaje.className = 'respuesta__mensaje';
    });
    campo.addEventListener('focus', function () { cursorAlFinal(); mostrarTablero(); });
    // El campo cubre el esqueleto: se mira qué casilla hay debajo del toque.
    campo.addEventListener('click', function (ev) {
      cursorAlFinal();
      var debajo = document.elementsFromPoint ? document.elementsFromPoint(ev.clientX, ev.clientY) : [];
      for (var k = 0; k < debajo.length; k++) {
        var el = debajo[k];
        if (el.classList.contains('hueco')) {
          fijar({ palabra: +el.dataset.palabra, hueco: +el.dataset.hueco });
          return;
        }
        if (el.classList.contains('palabra') && !el.classList.contains('palabra--vista')) {
          fijar({ palabra: +el.dataset.palabra, hueco: 0 });
          return;
        }
      }
    });
    campo.addEventListener('select', cursorAlFinal);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        if (document.activeElement === campo) mostrarTablero();
      });
    }
    campo.addEventListener('keydown', function (ev) {
      if (ev.isComposing) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        fijar();
        var otra = casillaVecina(palabras, destapadas(), ancla, ev.key === 'ArrowLeft' ? -1 : 1);
        if (otra) fijar(otra);
        return;
      }
      if (/^(Arrow|Home$|End$|Page)/.test(ev.key)) { ev.preventDefault(); return; }
      // Borrar sin nada recién tecleado: se borra la casilla del cursor si tiene
      // letra y, si no, la anterior, como en un crucigrama.
      if ((ev.key === 'Backspace' || ev.keyCode === 8) && campo.value === '') {
        ev.preventDefault();
        var aqui = { palabra: escrito.actual, hueco: escrito.hueco };
        if (aqui.palabra === -1 || !escrito.celdas[aqui.palabra][aqui.hueco]) aqui = casillaVecina(palabras, destapadas(), aqui, -1);
        if (!aqui) return;
        escrito.celdas[aqui.palabra][aqui.hueco] = '';
        fijar(aqui);
      }
    });
    // Con ratón y teclado se puede escribir nada más entrar.
    if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) campo.focus({ preventScroll: true });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var veredicto = comprobarRespuesta(textoDelEsqueleto(palabras, escrito.letras, destapadas()), refran);
      if (!escrito.letras.some(Boolean)) veredicto = 'vacio';
      if (veredicto === 'vacio') {
        mensaje.textContent = 'Toca los huecos y escribe primero el refrán.';
        mensaje.className = 'respuesta__mensaje';
        campo.focus();
        return;
      }
      r.intentos++;
      if (veredicto === 'exacto' || veredicto === 'aproximado') {
        r.estado = 'resuelto';
        guardar();
        pantallaRecompensa(i);
        return;
      }
      var perdido = registrarFallo(r);
      guardar();
      if (perdido) {
        clearTimeout(confirmarRendicion);
        pantallaRecompensa(i);
        return;
      }
      document.getElementById('valor').innerHTML = htmlValor(r);
      var quedan = MAX_FALLOS - r.fallos;
      mensaje.textContent = (veredicto === 'casi' ? '¡Casi! Revisa alguna palabra.' : 'No es ese.') +
        (quedan === 1 ? ' Te queda un intento.' : ' Te quedan ' + quedan + ' intentos.');
      mensaje.className = 'respuesta__mensaje ' + (veredicto === 'casi' ? 'is-casi' : 'is-mal');
      tablero.classList.remove('is-temblando');
      void tablero.offsetWidth;
      tablero.classList.add('is-temblando');
    });

    // Si se estaba escribiendo, tras destapar se sigue escribiendo (sin cerrar el teclado).
    var escribiendo = false;
    btnPista.addEventListener('pointerdown', function () { escribiendo = document.activeElement === campo; });
    btnPista.addEventListener('click', function () {
      if (escribiendo) campo.focus({ preventScroll: true });
      escribiendo = false;
      if (r.pistas >= orden.length) return;
      r.pistas++;
      guardar();
      // Lo ya escrito se conserva; solo se pierde lo de la palabra destapada, y si
      // el cursor estaba en ella pasa a la siguiente casilla libre.
      var ahora = { palabra: escrito.actual, hueco: escrito.hueco };
      if (ahora.palabra === orden[r.pistas - 1]) ahora = casillaVecina(palabras, destapadas(), { palabra: ahora.palabra, hueco: Infinity }, 1);
      fijar(ahora);
      actualizarPistas();
      var nueva = document.querySelectorAll('#esqueleto .palabra')[orden[r.pistas - 1]];
      if (nueva) nueva.classList.add('is-recien');
    });

    btnRendirse.addEventListener('click', function () {
      if (!confirmarRendicion) {
        btnRendirse.textContent = '¿Seguro? Toca otra vez';
        btnRendirse.classList.add('is-confirmando');
        confirmarRendicion = setTimeout(function () {
          confirmarRendicion = null;
          btnRendirse.textContent = 'Me rindo';
          btnRendirse.classList.remove('is-confirmando');
        }, 3000);
        return;
      }
      clearTimeout(confirmarRendicion);
      r.estado = 'rendido';
      guardar();
      pantallaRecompensa(i);
    });
  }

  function htmlProgreso(partida, actual) {
    return '<ol class="progreso" aria-label="Progreso del día">' + partida.refranes.map(function (r, k) {
      var clase = r.estado === 'jugando' ? (k === actual ? 'is-actual' : '') : (r.estado === 'rendido' ? 'is-rendido' : tropiezos(r) ? 'is-pistas' : 'is-limpio');
      return '<li class="' + clase + '"><span>' + NUMERALES[k] + '</span></li>';
    }).join('') + '</ol>';
  }

  function pantallaRecompensa(i) {
    var partida = partidaHoy();
    var refran = diaDeContenido(dias, hoy).refranes[i];
    var r = partida.refranes[i];
    var quedan = refranActual(partida) !== -1;
    if (!quedan && terminarPartida(estado, hoy)) guardar();
    if (!quedan) avisarAlmanaque();
    subtitulo('Día ' + hoy + ' · Refrán ' + NUMERALES[i] + ' de ' + NUMERALES[partida.refranes.length - 1]);

    pintar(
      '<section class="pantalla pantalla--recompensa">' +
      htmlProgreso(partida, -1) +
      htmlDictamen(refran, i, partida.refranes.length) +
      htmlEsqueleto(refran, [], true) +
      htmlRecompensa(refran, r) +
      '<button class="btn btn--grande" id="btn-seguir" type="button">' + (quedan ? 'Siguiente refrán' : 'Ver el resultado') + '</button>' +
      '</section>'
    );
    var seguir = document.getElementById('btn-seguir');
    seguir.addEventListener('click', function () { if (quedan) pantallaRefran(); else pantallaResultado(); });
    seguir.focus({ preventScroll: true });
  }

  var FRASES = [
    'Hoy el refranero te ha ganado la partida.',
    'Algo es algo, dijo el calvo.',
    'Algo es algo, dijo el calvo.',
    'Poco a poco se va lejos.',
    'Poco a poco se va lejos.',
    'No está nada mal: quien tuvo, retuvo.',
    'No está nada mal: quien tuvo, retuvo.',
    'Sabes latín. Bueno, refranes.',
    'Sabes latín. Bueno, refranes.',
    '¡Pleno! Hablas refranero de corrido.'
  ];

  function pantallaResultado() {
    var partida = partidaHoy();
    if (terminarPartida(estado, hoy)) guardar();
    avisarAlmanaque();
    var puntos = puntosPartida(partida);
    var maximo = partida.refranes.length * 3;
    subtitulo('Día ' + hoy + ' · Resultado');

    pintar(
      '<section class="pantalla pantalla--resultado">' +
      '<p class="kicker">Paremia · Día ' + hoy + '</p>' +
      '<div class="marcador">' +
      '<p class="marcador__cifra"><b>' + puntos + '</b><span>/' + maximo + '</span></p>' +
      '<p class="marcador__emojis" aria-hidden="true">' + partida.refranes.map(function (r) {
        return emojiRefran(r);
      }).join('') + '</p>' +
      '<p class="marcador__frase">' + FRASES[Math.round(puntos * 9 / maximo)] + '</p>' +
      '</div>' +
      '<div class="pila">' +
      '<button class="btn btn--grande" id="btn-compartir" type="button">Compartir</button>' +
      '<a class="btn btn--sec btn--enlace" data-almanaque-volver hidden href="https://joseleking.github.io/Almanaque/">☜ Regresar al Almanaque</a>' +
      '</div>' +
      '<ol class="repaso">' + diaDeContenido(dias, hoy).refranes.map(function (refran, k) {
        var r = partida.refranes[k];
        return '<li><details>' +
          '<summary><span class="repaso__marca repaso__marca--' + (r.estado === 'rendido' ? 'rendido' : tropiezos(r) ? 'pistas' : 'limpio') + '" aria-hidden="true"></span>' +
          '<span class="repaso__refran">' + esc(refran.original) + '</span><span class="repaso__puntos">+' + puntosRefran(r) + '</span></summary>' +
          '<div class="repaso__detalle">' +
          '<p class="repaso__pedante">«' + esc(refran.pedante) + '»</p>' +
          '<p>' + esc(refran.significado) + '</p>' +
          (refran.equivalente ? '<p class="repaso__eq">En ' + esc(refran.equivalente.idioma) + ': <i>' + esc(refran.equivalente.texto) + '</i></p>' : '') +
          '</div></details></li>';
      }).join('') + '</ol>' +
      htmlEstadisticas() +
      '<p class="cuenta-atras">Próximos refranes en' +
      ' <time id="cuenta-atras">--:--:--</time></p>' +
      '</section>'
    );

    document.getElementById('btn-compartir').addEventListener('click', function () {
      compartir(textoCompartir(hoy, partida));
    });
    empezarCuentaAtras();
  }

  function pantallaAntes() {
    subtitulo('Refranero para tiempos burocráticos');
    pintar(
      '<section class="pantalla pantalla--centro">' +
      '<p class="kicker">Próximamente</p>' +
      '<p class="lema">No por mucho madrugar amanece más temprano.</p>' +
      '<p>El primer día de <b>Paremia</b> se publicará el ' + esc(fechaLarga(leerFechaISO(FECHA_INICIO))) + '.</p>' +
      '</section>'
    );
  }

  function pantallaError() {
    pintar(
      '<section class="pantalla pantalla--centro">' +
      '<p class="kicker">Se ha traspapelado el expediente</p>' +
      '<p>No se han podido cargar los refranes. Si abriste el archivo directamente, sírvelo con un servidor local ' +
      '(consulta el README).</p>' +
      '</section>'
    );
  }

  // ---------- Ayuda ----------

  function abrirAyuda() {
    modalCuerpo.innerHTML = '<h2 id="modal-titulo">Cómo se juega</h2>' + htmlComoSeJuega() +
      '<p class="reglas__nota">Al compartir: 🟩 a la primera, 🟨 con pistas o fallos, ⬛ rendido. Cada medianoche hay tres refranes nuevos.</p>';
    if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
  }

  document.getElementById('btn-ayuda').addEventListener('click', abrirAyuda);
  document.getElementById('modal-cerrar').addEventListener('click', function () {
    if (modal.close) modal.close(); else modal.removeAttribute('open');
  });
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal && modal.close) modal.close();
  });

  // ---------- Compartir ----------

  function compartir(completo) {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      navigator.share({ text: completo }).catch(function (err) {
        if (err && err.name !== 'AbortError') copiar(completo);
      });
      return;
    }
    copiar(completo);
  }

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(
        function () { aviso('Resultado copiado al portapapeles'); },
        function () { copiarALaAntigua(texto); }
      );
    } else {
      copiarALaAntigua(texto);
    }
  }

  function copiarALaAntigua(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    aviso(ok ? 'Resultado copiado al portapapeles' : texto);
  }

  // ---------- Cuenta atrás y cambio de día ----------

  function empezarCuentaAtras() {
    var el = document.getElementById('cuenta-atras');
    function tic() {
      var ms = msHastaMedianoche(new Date());
      el.textContent = formatoCuentaAtras(ms);
      if (ms < 1000 && !forzado) setTimeout(function () { location.reload(); }, 1500);
    }
    tic();
    temporizador = setInterval(tic, 1000);
  }

  function pararCuentaAtras() {
    if (temporizador) { clearInterval(temporizador); temporizador = null; }
  }

  // Si la pestaña se queda abierta y pasa la medianoche, se recarga al volver.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !forzado && dias && numeroDia(new Date()) !== hoy) {
      location.reload();
    }
  });

  // ---------- Arranque ----------

  function arrancar() {
    fetch(URL_DATOS)
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (datos) {
        dias = datos.dias;
        hoy = forzado || numeroDia(new Date());
        if (hoy < 1) { pantallaAntes(); return; }
        if (!estado.visto) pantallaInicio();
        else pantallaRefran();   // con la partida terminada, muestra el resultado
      })
      .catch(pantallaError)
      .then(retirarPortada);
  }

  // La portada con el logo se ve al menos PORTADA_MS desde que se abre la página y luego se desvanece.
  function retirarPortada() {
    var PORTADA_MS = 900, FUNDIDO_MS = 400;
    var portada = document.getElementById('portada');
    if (!portada) return;
    setTimeout(function () {
      portada.classList.add('oculta');
      setTimeout(function () { portada.remove(); }, FUNDIDO_MS);
    }, Math.max(0, PORTADA_MS - performance.now()));
  }

  arrancar();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo offline */ });
    });
  }
})();
