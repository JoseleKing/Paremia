/* Volver a Almanaque
   Muestra una franja con una mano ☜ en lo alto del juego para regresar a Almanaque.
   Solo aparece si se llegó desde Almanaque (que añade ?desde=almanaque&juego=<id> al enlace)
   y se mantiene mientras siga abierta esa pestaña.
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
   llega aunque el jugador no vuelva con la mano ☜.
   Botón de volver junto a «Compartir resultado»: el juego pone en su pantalla final
     <a data-almanaque-volver hidden href="https://joseleking.github.io/Almanaque/">…</a>
   con el estilo que quiera. Si se llegó desde Almanaque, este script lo muestra y le da
   el mismo destino que la mano ☜; si no, sigue oculto. Puede pintarse en cualquier
   momento: el script vigila la página.
   Copia de referencia: se guarda en el repo de Almanaque, en para-los-juegos/.
   Cada juego incluye su propia copia con:
   <script src="volver-almanaque.js" defer></script> */
(function () {
  'use strict';

  var ALMANAQUE = 'https://joseleking.github.io/Almanaque/';
  var CLAVE = 'almanaque:volver';
  var CLAVE_JUEGO = 'almanaque:juego';
  var CLAVE_HECHO = 'almanaque:hecho';
  var CLAVE_RESULTADOS = 'almanaque:resultados';
  var desdeAlmanaque = false;
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
      desdeAlmanaque = true;
      juego = url.searchParams.get('juego');
      // Limpia la dirección para que no se comparta con los parámetros.
      url.searchParams.delete('desde');
      url.searchParams.delete('juego');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch (e) { /* navegador antiguo: se ignora */ }

  if (desdeAlmanaque) {
    guardar(CLAVE, '1');
    if (juego) guardar(CLAVE_JUEGO, juego);
  } else {
    desdeAlmanaque = leer(CLAVE) === '1';
    juego = leer(CLAVE_JUEGO);
  }

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // Misma forma de fecha que usa la portada (AAAA-MM-DD).
  function claveDeHoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Sin venir de Almanaque, el id sale de la ruta: /Periplo/ → periplo.
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

  // El juego avisa de que la partida de hoy está terminada (y, si quiere, de cómo ha ido).
  window.almanaqueHecho = function (resultado) {
    guardar(CLAVE_HECHO, hoy());
    guardarResultado(resultado);
    // Sin venir de Almanaque no hay mano ni botón de volver que actualizar.
    if (desdeAlmanaque) actualizarEnlace();
  };

  // Los botones de volver siguen ocultos aunque el estilo del juego les dé display.
  var estiloOculto = document.createElement('style');
  estiloOculto.textContent = '[data-almanaque-volver][hidden]{display:none!important}';
  document.head.appendChild(estiloOculto);

  if (!desdeAlmanaque) return;

  // La mano lleva ?hecho=<id> solo si el juego ha avisado hoy en esta pestaña.
  function destino() {
    if (!juego || leer(CLAVE_HECHO) !== hoy()) return ALMANAQUE;
    return ALMANAQUE + '?hecho=' + encodeURIComponent(juego);
  }

  function actualizarEnlace() {
    var enlace = document.getElementById('almanaque-volver');
    if (enlace) enlace.href = destino();
    activarBotones();
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
    }
  }

  function mostrar() {
    if (document.getElementById('almanaque-volver')) return;

    var estilo = document.createElement('style');
    estilo.textContent =
      '#almanaque-volver{display:flex;align-items:center;gap:.45em;box-sizing:border-box;width:100%;' +
      'margin:0;padding:.55rem max(1rem,env(safe-area-inset-right)) .55rem max(1rem,env(safe-area-inset-left));' +
      'padding-top:max(.55rem,env(safe-area-inset-top));' +
      'font:inherit;font-size:1.05rem;line-height:1.2;letter-spacing:.06em;font-variant:small-caps;' +
      'color:inherit;text-decoration:none;opacity:.78;position:relative;z-index:1;' +
      'border-bottom:1px solid currentColor;border-bottom-color:color-mix(in srgb,currentColor 18%,transparent);' +
      '-webkit-tap-highlight-color:transparent}' +
      '#almanaque-volver:hover,#almanaque-volver:focus-visible{opacity:1}' +
      '#almanaque-volver:focus-visible{outline:2px solid currentColor;outline-offset:-4px}' +
      '#almanaque-volver .almanaque-volver__mano{font-size:1.8em;line-height:.8;font-variant:normal;' +
      'transition:transform .18s ease}' +
      '#almanaque-volver:hover .almanaque-volver__mano{transform:translateX(-3px)}' +
      '@media (prefers-reduced-motion:reduce){#almanaque-volver .almanaque-volver__mano{transition:none}}';
    document.head.appendChild(estilo);

    var enlace = document.createElement('a');
    enlace.id = 'almanaque-volver';
    enlace.href = destino();
    enlace.setAttribute('aria-label', 'Regresar al Almanaque');
    // Se recalcula al tocar por si la pestaña ha pasado la medianoche.
    enlace.addEventListener('click', function () { enlace.href = destino(); });

    var mano = document.createElement('span');
    mano.className = 'almanaque-volver__mano';
    mano.setAttribute('aria-hidden', 'true');
    mano.textContent = '☜';

    enlace.appendChild(mano);
    enlace.appendChild(document.createTextNode('Regresar al Almanaque'));
    document.body.insertBefore(enlace, document.body.firstChild);
  }

  function empezar() {
    mostrar();
    activarBotones();
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
