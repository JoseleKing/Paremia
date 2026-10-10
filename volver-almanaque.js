/* Volver a Almanaque
   Muestra una franja con una mano ☜ en lo alto del juego para regresar a Almanaque.
   Sale siempre, se llegue desde Almanaque o se entre al juego directamente.
   Cuando el jugador termine la partida de hoy, el juego debe llamar a
     window.almanaqueHecho && window.almanaqueHecho();
   (también al abrir el juego con la partida de hoy ya terminada). Así la mano ☜ lleva
   a Almanaque el aviso y la hoja del juego se marca como «Hecho».
   Resultado de hoy: el juego puede pasarle a almanaqueHecho lo que ha sacado el jugador,
   y Almanaque lo muestra en la hoja del juego:
     window.almanaqueHecho({ aciertos: 2, total: 3 });          // ● ● ○
     window.almanaqueHecho({ aciertos: 2, total: 3, racha: 5 }); // ● ● ○ · racha 5
     window.almanaqueHecho({ texto: 'Resuelto' });               // texto libre y corto
   Se guarda en localStorage (todos los juegos comparten origen con Almanaque), así que
   llega aunque el jugador no vuelva con la mano ☜. También se apunta el día jugado, para
   la racha común que muestra la portada.
   Botón de volver junto a «Compartir resultado»: el juego pone en su pantalla final
     <a data-almanaque-volver hidden href="https://joseleking.github.io/Almanaque/">…</a>
   con el estilo que quiera. Este script lo muestra y le da el mismo destino que la
   mano ☜. Puede pintarse en cualquier momento: el script vigila la página.
   Siguiente juego: la franja ofrece siempre a la derecha «Siguiente: Periplo ☞», que lleva
   al siguiente juego de Almanaque que aún no se ha hecho hoy (en el orden de games.json,
   que se lee de Almanaque; sin conexión, o con todo hecho, no sale). Con la partida de hoy
   terminada, el script pone además, justo encima de cada botón de volver, un botón
   «Siguiente juego: Periplo ☞» con las mismas clases, así que toma el estilo del juego.
   Id del juego: Almanaque abre cada juego con ?desde=almanaque&juego=<id> y el id se
   recuerda mientras siga abierta la pestaña; si no, sale de la ruta (/Periplo/ → periplo).
   Copia de referencia: se guarda en el repo de Almanaque, en para-los-juegos/.
   Cada juego incluye su propia copia con:
   <script src="volver-almanaque.js" defer></script> */
(function () {
  'use strict';

  var WEB = 'https://joseleking.github.io/';
  // En local (todos los repos servidos desde el mismo puerto), los enlaces se quedan en local.
  var BASE = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? window.location.origin + '/' : WEB;
  var ALMANAQUE = BASE + 'Almanaque/';
  var CLAVE_JUEGO = 'almanaque:juego';
  var CLAVE_HECHO = 'almanaque:hecho';
  var CLAVE_HECHOS = 'almanaque:hechos';
  var CLAVE_RESULTADOS = 'almanaque:resultados';
  var CLAVE_DIAS = 'almanaque:dias';
  var juego = null;

  function leer(clave) {
    try { return window.sessionStorage.getItem(clave); } catch (e) { return null; }
  }

  function guardar(clave, valor) {
    try { window.sessionStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ }
  }

  try {
    var url = new URL(window.location.href);
    if (url.searchParams.get('desde') === 'almanaque') {
      juego = url.searchParams.get('juego');
      // Limpia la dirección para que no se comparta con los parámetros.
      url.searchParams.delete('desde');
      url.searchParams.delete('juego');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch (e) { /* navegador antiguo: se ignora */ }

  if (juego) guardar(CLAVE_JUEGO, juego);
  else juego = leer(CLAVE_JUEGO);

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // Misma forma de fecha que usa la portada (AAAA-MM-DD).
  function claveDeHoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Sin id de Almanaque, sale de la ruta: /Periplo/ → periplo.
  function idDelJuego() {
    if (juego) return juego;
    var partes = window.location.pathname.split('/').filter(Boolean);
    return partes.length ? partes[0].toLowerCase() : null;
  }

  function numero(n) {
    return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  // Solo se guardan los campos conocidos, ya comprobados.
  function limpiarResultado(r) {
    if (!r || typeof r !== 'object') return null;
    var limpio = {};
    var aciertos = numero(r.aciertos);
    var total = numero(r.total);
    if (aciertos !== null && total) {
      limpio.aciertos = Math.min(aciertos, total);
      limpio.total = total;
    }
    if (typeof r.texto === 'string' && r.texto.trim()) limpio.texto = r.texto.trim().slice(0, 40);
    var racha = numero(r.racha);
    if (racha) limpio.racha = racha;
    return Object.keys(limpio).length ? limpio : null;
  }

  function guardarResultado(resultado) {
    var id = idDelJuego();
    var limpio = limpiarResultado(resultado);
    if (!id || !limpio) return;
    try {
      var datos = null;
      try { datos = JSON.parse(window.localStorage.getItem(CLAVE_RESULTADOS) || 'null'); } catch (e) { /* corrupto */ }
      if (!datos || datos.fecha !== claveDeHoy() || typeof datos.juegos !== 'object' || !datos.juegos) {
        datos = { fecha: claveDeHoy(), juegos: {} };
      }
      datos.juegos[id] = limpio;
      window.localStorage.setItem(CLAVE_RESULTADOS, JSON.stringify(datos));
    } catch (e) { /* sin almacenamiento */ }
  }

  // Hojas hechas hoy: la misma lista que lleva la portada, que así marca la hoja aunque
  // no se vuelva con la mano ☜.
  function hechosHoy() {
    try {
      var datos = JSON.parse(window.localStorage.getItem(CLAVE_HECHOS) || 'null');
      if (datos && datos.fecha === claveDeHoy() && Array.isArray(datos.ids)) return datos.ids;
    } catch (e) { /* sin almacenamiento o datos corruptos */ }
    return [];
  }

  function apuntarHecho() {
    var id = idDelJuego();
    if (!id) return;
    var ids = hechosHoy();
    if (ids.indexOf(id) !== -1) return;
    ids.push(id);
    try {
      window.localStorage.setItem(CLAVE_HECHOS, JSON.stringify({ fecha: claveDeHoy(), ids: ids }));
    } catch (e) { /* sin almacenamiento */ }
  }

  // Juegos con resultado hoy: también cuentan como hechos.
  function conResultadoHoy() {
    try {
      var datos = JSON.parse(window.localStorage.getItem(CLAVE_RESULTADOS) || 'null');
      if (datos && datos.fecha === claveDeHoy() && datos.juegos && typeof datos.juegos === 'object') {
        return Object.keys(datos.juegos);
      }
    } catch (e) { /* sin almacenamiento o datos corruptos */ }
    return [];
  }

  // Días con alguna partida terminada (AAAA-MM-DD): de aquí sale la racha de la portada.
  function apuntarDia() {
    try {
      var dias = null;
      try { dias = JSON.parse(window.localStorage.getItem(CLAVE_DIAS) || '[]'); } catch (e) { /* corrupto */ }
      if (!Array.isArray(dias)) dias = [];
      if (dias.indexOf(claveDeHoy()) !== -1) return;
      dias.push(claveDeHoy());
      dias.sort();
      window.localStorage.setItem(CLAVE_DIAS, JSON.stringify(dias));
    } catch (e) { /* sin almacenamiento */ }
  }

  // El juego avisa de que la partida de hoy está terminada (y, si quiere, de cómo ha ido).
  window.almanaqueHecho = function (resultado) {
    guardar(CLAVE_HECHO, hoy());
    guardarResultado(resultado);
    apuntarHecho();
    apuntarDia();
    actualizarEnlace();
  };

  // Los botones de volver siguen ocultos hasta que este script los activa, aunque el estilo
  // del juego les dé display.
  var estiloOculto = document.createElement('style');
  estiloOculto.textContent = '[data-almanaque-volver][hidden],[data-almanaque-siguiente][hidden]{display:none!important}';
  document.head.appendChild(estiloOculto);

  // La mano lleva ?hecho=<id> solo si el juego ha avisado hoy en esta pestaña.
  function destino() {
    var id = idDelJuego();
    if (!id || leer(CLAVE_HECHO) !== hoy()) return ALMANAQUE;
    return ALMANAQUE + '?hecho=' + encodeURIComponent(id);
  }

  function actualizarEnlace() {
    var enlace = document.getElementById('almanaque-volver');
    if (enlace) enlace.href = destino();
    activarBotones();
    actualizarSiguiente();
  }

  /* Siguiente juego pendiente de hoy */

  var juegos = null; // lista de games.json, cuando llega

  function cargarJuegos() {
    if (!window.fetch) return;
    window.fetch(ALMANAQUE + 'games.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (lista) {
        if (!Array.isArray(lista)) return;
        juegos = lista.filter(function (j) {
          var estado = String(j && j.estado || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return j && j.id && j.nombre && j.url && estado !== 'proximamente';
        });
        actualizarSiguiente();
      })
      .catch(function () { /* sin conexión: no se ofrece */ });
  }

  // El primero sin hacer hoy tras este juego, en el orden de Almanaque (y vuelta al principio).
  function siguientePendiente() {
    var id = idDelJuego();
    if (!juegos || !id) return null;
    var hechos = hechosHoy().concat(conResultadoHoy(), [id]);
    var actual = -1;
    for (var i = 0; i < juegos.length; i++) if (juegos[i].id === id) actual = i;
    for (var paso = 1; paso <= juegos.length; paso++) {
      var j = juegos[(actual + paso) % juegos.length];
      if (hechos.indexOf(j.id) === -1) return j;
    }
    return null;
  }

  function direccionDe(j) {
    try {
      var url = new URL(j.url.indexOf(WEB) === 0 ? BASE + j.url.slice(WEB.length) : j.url, ALMANAQUE);
      url.searchParams.set('desde', 'almanaque');
      url.searchParams.set('juego', j.id);
      return url.href;
    } catch (e) {
      return j.url;
    }
  }

  // La franja lo ofrece siempre; los botones de la pantalla final, solo con la partida de
  // hoy terminada en esta pestaña.
  function actualizarSiguiente() {
    var j = siguientePendiente();
    var enlace = document.getElementById('almanaque-siguiente');
    if (enlace) {
      enlace.hidden = !j;
      var franja = document.getElementById('almanaque-franja');
      if (franja) franja.classList.toggle('almanaque-franja--siguiente', !!j);
      if (j) {
        enlace.href = direccionDe(j);
        // Solo si cambia: escribirlo otra vez despertaría al vigilante de la página sin fin.
        var nombre = enlace.querySelector('.almanaque-siguiente__nombre');
        if (nombre.textContent !== j.nombre) nombre.textContent = j.nombre;
        enlace.setAttribute('aria-label', 'Siguiente juego: ' + j.nombre);
      }
    }
    var hecho = leer(CLAVE_HECHO) === hoy();
    var botones = document.querySelectorAll('[data-almanaque-siguiente]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].hidden = !(j && hecho);
      if (j) {
        botones[i].href = direccionDe(j);
        // Con la mano ☞, como la ☜ del botón de volver.
        var texto = 'Siguiente juego: ' + j.nombre + ' ☞';
        if (botones[i].textContent !== texto) botones[i].textContent = texto;
        botones[i].setAttribute('aria-label', 'Siguiente juego: ' + j.nombre);
      }
    }
  }

  // Muestra los botones de volver que haya puesto el juego y les da destino.
  function activarBotones() {
    var botones = document.querySelectorAll('[data-almanaque-volver]');
    for (var i = 0; i < botones.length; i++) {
      var boton = botones[i];
      boton.href = destino();
      boton.hidden = false;
      if (!boton.almanaqueActivo) {
        boton.almanaqueActivo = true;
        boton.addEventListener('click', function () { this.href = destino(); });
      }
      if (!boton.almanaqueSiguiente || !boton.almanaqueSiguiente.isConnected) {
        boton.almanaqueSiguiente = crearBotonSiguiente(boton);
      }
    }
    actualizarSiguiente();
  }

  // Botón «Siguiente juego» de la pantalla final, con el mismo aspecto que el de volver.
  function crearBotonSiguiente(volver) {
    var boton = document.createElement('a');
    boton.className = volver.className;
    boton.setAttribute('data-almanaque-siguiente', '');
    boton.hidden = true;
    boton.addEventListener('click', function () { actualizarSiguiente(); });
    volver.parentNode.insertBefore(boton, volver);
    return boton;
  }

  function mostrar() {
    if (document.getElementById('almanaque-franja')) return;

    var estilo = document.createElement('style');
    estilo.textContent =
      '#almanaque-franja{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.4em 1em;' +
      'box-sizing:border-box;width:100%;margin:0;' +
      'padding:.55rem max(1rem,env(safe-area-inset-right)) .55rem max(1rem,env(safe-area-inset-left));' +
      'padding-top:max(.55rem,env(safe-area-inset-top));' +
      'font:inherit;font-size:1.05rem;line-height:1.2;letter-spacing:.06em;font-variant:small-caps;' +
      'color:inherit;position:relative;z-index:1;' +
      'border-bottom:1px solid currentColor;border-bottom-color:color-mix(in srgb,currentColor 18%,transparent)}' +
      '#almanaque-volver,#almanaque-siguiente{display:flex;align-items:center;gap:.45em;min-width:0;' +
      'white-space:nowrap;color:inherit;text-decoration:none;opacity:.78;-webkit-tap-highlight-color:transparent}' +
      '#almanaque-siguiente{margin-left:auto}' +
      '#almanaque-siguiente[hidden]{display:none}' +
      '#almanaque-volver:hover,#almanaque-volver:focus-visible,' +
      '#almanaque-siguiente:hover,#almanaque-siguiente:focus-visible{opacity:1}' +
      '#almanaque-volver:focus-visible,#almanaque-siguiente:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
      '#almanaque-franja .almanaque-volver__mano{font-size:1.8em;line-height:.8;font-variant:normal;' +
      'transition:transform .18s ease}' +
      '#almanaque-volver:hover .almanaque-volver__mano{transform:translateX(-3px)}' +
      '#almanaque-siguiente:hover .almanaque-volver__mano{transform:translateX(3px)}' +
      // En pantallas estrechas, con las dos manos, «Regresar al» se cae para que quepan.
      '@media (max-width:36rem){.almanaque-franja--siguiente .almanaque-volver__largo{display:none}}' +
      '@media (prefers-reduced-motion:reduce){#almanaque-franja .almanaque-volver__mano{transition:none}}';
    document.head.appendChild(estilo);

    var franja = document.createElement('div');
    franja.id = 'almanaque-franja';

    var enlace = document.createElement('a');
    enlace.id = 'almanaque-volver';
    enlace.href = destino();
    enlace.setAttribute('aria-label', 'Regresar al Almanaque');
    // Se recalcula al tocar por si la pestaña ha pasado la medianoche.
    enlace.addEventListener('click', function () { enlace.href = destino(); });

    var largo = document.createElement('span');
    largo.className = 'almanaque-volver__largo';
    largo.textContent = 'Regresar al ';

    enlace.appendChild(mano('☜'));
    enlace.appendChild(largo);
    enlace.appendChild(document.createTextNode('Almanaque'));

    var siguiente = document.createElement('a');
    siguiente.id = 'almanaque-siguiente';
    siguiente.hidden = true;
    var nombre = document.createElement('span');
    nombre.className = 'almanaque-siguiente__nombre';
    var texto = document.createElement('span');
    texto.appendChild(document.createTextNode('Siguiente: '));
    texto.appendChild(nombre);
    siguiente.appendChild(texto);
    siguiente.appendChild(mano('☞'));
    // Por si otro juego se ha terminado en otra pestaña o ha pasado la medianoche.
    siguiente.addEventListener('click', function () { actualizarSiguiente(); });

    franja.appendChild(enlace);
    franja.appendChild(siguiente);
    document.body.insertBefore(franja, document.body.firstChild);
  }

  function mano(signo) {
    var span = document.createElement('span');
    span.className = 'almanaque-volver__mano';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = signo;
    return span;
  }

  function empezar() {
    mostrar();
    activarBotones();
    cargarJuegos();
    // Al volver a la pestaña, otro juego puede haberse hecho entretanto.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') actualizarSiguiente();
    });
    // La pantalla final suele pintarse después: se activan los botones nuevos al aparecer.
    if (window.MutationObserver) {
      new MutationObserver(function (cambios) {
        for (var i = 0; i < cambios.length; i++) {
          if (cambios[i].addedNodes.length) { activarBotones(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) empezar();
  else document.addEventListener('DOMContentLoaded', empezar);
})();
