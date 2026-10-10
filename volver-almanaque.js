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
   Siguiente juego: la franja ofrece siempre a la derecha «Periplo ☞», que lleva
   al siguiente juego de Almanaque que aún no se ha hecho hoy (en el orden de games.json,
   que se lee de Almanaque; sin conexión no sale). Con la partida de hoy terminada, el
   script pone además, justo encima de cada botón de volver, un botón
   «Siguiente juego: Periplo ☞» con las mismas clases, así que toma el estilo del juego.
   Almanaque completo: con todas las hojas de hoy hechas (también la de este juego), la
   franja dice en su lugar «✓ Almanaque completo» y lleva a la portada, donde espera el
   sello del día; en la pantalla final no sale botón de siguiente, sino el mismo sello
   «Almanaque completo» de la portada, debajo de cada botón de volver (sin botón, al final
   de la página), que también lleva a la portada. En el juego que acaba el almanaque, al
   llamar a almanaqueHecho, se abre por encima de todo (también de la pantalla final del
   juego, aunque se abra después) una pantalla de almanaque completo: el sello se estampa
   en ella, cae confeti con los colores de los juegos y «Ver la partida» la cierra (una
   vez al día, apuntado en almanaque:confeti; con movimiento reducido, sin confeti y con
   el sello quieto).
   Id del juego: Almanaque abre cada juego con ?desde=almanaque&juego=<id> y el id se
   recuerda en la pestaña para la ruta de ese juego; si no, sale de la ruta (/Periplo/ → periplo).
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
  var CLAVE_HECHOS = 'almanaque:hechos';
  var CLAVE_RESULTADOS = 'almanaque:resultados';
  var CLAVE_DIAS = 'almanaque:dias';
  var CLAVE_CONFETI = 'almanaque:confeti';
  var juego = null;
  var terminadoAqui = false; // el juego ha llamado a almanaqueHecho en esta página

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

  // El id se recuerda en la pestaña junto con la ruta del juego que lo recibió: si luego se
  // entra en otro juego sin ?juego=, no se toma por el anterior.
  function ruta() {
    var partes = window.location.pathname.split('/').filter(Boolean);
    return partes.length ? partes[0].toLowerCase() : '';
  }

  if (juego) {
    guardar(CLAVE_JUEGO, JSON.stringify({ ruta: ruta(), id: juego }));
  } else {
    try {
      var recordado = JSON.parse(leer(CLAVE_JUEGO) || 'null');
      if (recordado && recordado.ruta === ruta() && typeof recordado.id === 'string') juego = recordado.id;
    } catch (e) { /* valor antiguo o corrupto: se ignora */ }
  }

  // Misma forma de fecha que usa la portada (AAAA-MM-DD).
  function claveDeHoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function romano(n) {
    var tabla = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var s = '';
    for (var i = 0; i < tabla.length; i++) {
      while (n >= tabla[i][0]) { s += tabla[i][1]; n -= tabla[i][0]; }
    }
    return s;
  }

  // Sin id de Almanaque, sale de la ruta: /Periplo/ → periplo.
  function idDelJuego() {
    return juego || ruta() || null;
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
    terminadoAqui = true;
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

  // Partida de hoy terminada en este juego: avisó en esta página, o su hoja ya consta como
  // hecha hoy. Que se haya terminado otro juego en la pestaña no cuenta.
  function hechoHoy() {
    var id = idDelJuego();
    return !!id && (terminadoAqui || hechosHoy().indexOf(id) !== -1);
  }

  // La mano lleva ?hecho=<id> solo con la partida de hoy terminada en este juego.
  function destino() {
    var id = idDelJuego();
    if (!hechoHoy()) return ALMANAQUE;
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

  // Con games.json cargado y ningún juego pendiente, contando este como hecho solo si lo está
  // de verdad (siguientePendiente lo da por hecho para no ofrecerlo a sí mismo).
  function almanaqueCompleto() {
    return !!juegos && !!idDelJuego() && hechoHoy() && !siguientePendiente();
  }

  // La franja lo ofrece siempre; los botones de la pantalla final, solo con la partida de
  // hoy terminada en este juego. Con todo hecho, los dos llevan a la portada.
  // Los textos se escriben solo si cambian: escribirlos otra vez despertaría al vigilante
  // de la página sin fin.
  function actualizarSiguiente() {
    var j = siguientePendiente();
    var completo = !j && almanaqueCompleto();
    var enlace = document.getElementById('almanaque-siguiente');
    if (enlace) {
      enlace.hidden = !j && !completo;
      var franja = document.getElementById('almanaque-franja');
      if (franja) franja.classList.toggle('almanaque-franja--siguiente', !!j || completo);
      enlace.classList.toggle('almanaque-siguiente--completo', completo);
      if (j) {
        enlace.href = direccionDe(j);
        var nombre = enlace.querySelector('.almanaque-siguiente__nombre');
        if (nombre.textContent !== j.nombre) nombre.textContent = j.nombre;
        enlace.setAttribute('aria-label', 'Siguiente juego: ' + j.nombre);
      } else if (completo) {
        enlace.href = destino();
        enlace.setAttribute('aria-label', 'Almanaque completo: volver a la portada');
      }
    }
    var hecho = hechoHoy();
    pintarSello(completo && hecho);
    // El almanaque se ha completado con la partida de esta página: se celebra.
    if (completo && terminadoAqui) celebrar();
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

  /* Sello de almanaque completo */

  var selloSuelto = null; // al final de la página, para los juegos sin botón de volver

  // El sello de la portada, debajo de cada botón de volver de la pantalla final (o al final
  // de la página si el juego no tiene ninguno). Se crean una vez y solo se mueven si hace
  // falta: cada inserción despierta al vigilante de la página.
  function pintarSello(mostrarlo) {
    var volver = document.querySelectorAll('[data-almanaque-volver]');
    var cajas = [];
    for (var i = 0; i < volver.length; i++) {
      if (mostrarlo && !volver[i].almanaqueSello) volver[i].almanaqueSello = crearSello();
      var caja = volver[i].almanaqueSello;
      if (!caja) continue;
      if (volver[i].nextSibling !== caja) volver[i].parentNode.insertBefore(caja, volver[i].nextSibling);
      cajas.push(caja);
    }
    if (mostrarlo && !volver.length) {
      if (!selloSuelto) selloSuelto = crearSello();
      if (selloSuelto.parentNode !== document.body || selloSuelto.nextSibling) document.body.appendChild(selloSuelto);
    }
    if (selloSuelto) {
      // En cuanto el juego pone su botón de volver, el sello suelto sobra.
      if (volver.length && selloSuelto.parentNode) selloSuelto.parentNode.removeChild(selloSuelto);
      else cajas.push(selloSuelto);
    }
    var fecha = fechaDeHoy();
    for (var c = 0; c < cajas.length; c++) {
      cajas[c].hidden = !mostrarlo;
      if (!mostrarlo) continue;
      var sello = cajas[c].firstChild;
      sello.href = destino();
      var linea = sello.querySelector('.almanaque-sello__fecha');
      if (linea.textContent !== fecha) linea.textContent = fecha;
    }
  }

  function fechaDeHoy() {
    var hoy = new Date();
    return hoy.getDate() + ' · ' + romano(hoy.getMonth() + 1) + ' · ' + romano(hoy.getFullYear());
  }

  function crearSello() {
    var caja = document.createElement('div');
    caja.className = 'almanaque-sello-caja';
    var sello = document.createElement('a');
    sello.className = 'almanaque-sello';
    sello.setAttribute('aria-label', 'Almanaque completo: todas las hojas de hoy hechas. Volver a la portada');
    sello.addEventListener('click', function () { sello.href = destino(); });
    sello.appendChild(trozo('almanaque-sello__titulo', 'Almanaque completo'));
    sello.appendChild(trozo('almanaque-sello__fecha', ''));
    caja.appendChild(sello);
    return caja;
  }

  /* Pantalla de almanaque completo */

  var pantalla = null; // el diálogo, mientras está en la página
  var vigiaDialogos = null;

  // Una hoja sobre la partida con el sello, que se estampa y lleva a la portada, y un botón
  // para cerrarla y ver la partida. Es un diálogo modal: así va en la capa de encima, como
  // las pantallas finales de los juegos.
  function abrirPantalla(conMovimiento) {
    pantalla = document.createElement('dialog');
    pantalla.id = 'almanaque-completo';
    pantalla.setAttribute('aria-labelledby', 'almanaque-completo-titulo');

    var hoja = document.createElement('div');
    hoja.className = 'almanaque-completo__hoja';
    // El papel y la tinta del juego: el diálogo trae los suyos del navegador.
    var cuerpo = window.getComputedStyle(document.body);
    var papel = cuerpo.backgroundColor;
    if (/^(transparent|rgba\(0, 0, 0, 0\))$/.test(papel)) papel = window.getComputedStyle(document.documentElement).backgroundColor;
    if (/^(transparent|rgba\(0, 0, 0, 0\))$/.test(papel)) papel = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1d1916' : '#fbf7ef';
    hoja.style.backgroundColor = papel;
    hoja.style.color = cuerpo.color;

    var titulo = trozo('almanaque-completo__titulo', '¡Enhorabuena!');
    titulo.id = 'almanaque-completo-titulo';
    hoja.appendChild(titulo);

    var caja = crearSello();
    var sello = caja.firstChild;
    sello.classList.add('almanaque-sello--grande');
    sello.href = destino();
    sello.querySelector('.almanaque-sello__fecha').textContent = fechaDeHoy();
    if (conMovimiento) sello.classList.add('almanaque-sello--estampar');
    hoja.appendChild(caja);

    var texto = document.createElement('p');
    texto.className = 'almanaque-completo__texto';
    texto.textContent = 'Has hecho las ' + juegos.length + ' hojas de hoy. Toca el sello para volver a la portada.';
    hoja.appendChild(texto);

    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'almanaque-completo__cerrar';
    cerrar.textContent = 'Ver la partida';
    cerrar.addEventListener('click', cerrarPantalla);
    hoja.appendChild(cerrar);

    pantalla.appendChild(hoja);
    // Tocar fuera de la hoja también la cierra.
    pantalla.addEventListener('click', function (e) { if (e.target === pantalla) cerrarPantalla(); });
    pantalla.addEventListener('close', function () {
      // subirPantalla la cierra y la vuelve a abrir: el aviso de cierre llega ya abierta.
      if (pantalla && !pantalla.open) quitarPantalla();
    });
    document.body.appendChild(pantalla);
    if (pantalla.showModal) pantalla.showModal();
    else pantalla.setAttribute('open', '');
    vigilarDialogos();
  }

  function cerrarPantalla() {
    if (!pantalla) return;
    if (pantalla.close) pantalla.close();
    else quitarPantalla();
  }

  function quitarPantalla() {
    if (!pantalla) return;
    if (pantalla.parentNode) pantalla.parentNode.removeChild(pantalla);
    pantalla = null;
    if (vigiaDialogos) { vigiaDialogos.disconnect(); vigiaDialogos = null; }
  }

  // Muchos juegos abren su pantalla final un poco después de avisar, y el último diálogo
  // abierto queda encima: en cuanto se abre otro, la pantalla vuelve a subir. Sin repetir
  // la entrada ni el golpe del sello.
  function vigilarDialogos() {
    if (!window.MutationObserver || !pantalla.showModal) return;
    vigiaDialogos = new MutationObserver(function (cambios) {
      if (!pantalla || !pantalla.open) return;
      for (var i = 0; i < cambios.length; i++) {
        var otro = cambios[i].target;
        if (otro !== pantalla && otro.tagName === 'DIALOG' && otro.open) { subirPantalla(); return; }
      }
    });
    vigiaDialogos.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
  }

  function subirPantalla() {
    pantalla.classList.add('almanaque-completo--quieta');
    pantalla.close();
    pantalla.showModal();
  }

  /* Confeti de almanaque completo */

  // Una vez al día: el juego vuelve a llamar a almanaqueHecho al abrirlo ya terminado.
  function celebrar() {
    try {
      if (window.localStorage.getItem(CLAVE_CONFETI) === claveDeHoy()) return;
      window.localStorage.setItem(CLAVE_CONFETI, claveDeHoy());
    } catch (e) { return; /* sin almacenamiento no se sabría si ya se ha celebrado */ }
    var quieto = !window.requestAnimationFrame ||
      !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    abrirPantalla(!quieto);
    if (quieto) return;
    var colores = [];
    for (var c = 0; c < juegos.length; c++) {
      if (/^#[0-9a-f]{3,8}$/i.test(juegos[c].color || '')) colores.push(juegos[c].color);
    }
    if (!colores.length) colores = ['#a33a2a', '#2b2420', '#c9a227', '#2e7d8c'];
    // Dentro de la pantalla, para que caiga por encima de ella.
    lanzarConfeti(colores, pantalla);
  }

  // Papelitos disparados desde las dos esquinas de abajo, que suben, se frenan y caen
  // revoloteando. Un lienzo encima de todo que no recibe toques y se retira al acabar.
  function lanzarConfeti(colores, contenedor) {
    var lienzo = document.createElement('canvas');
    var ctx = lienzo.getContext && lienzo.getContext('2d');
    if (!ctx) return;
    lienzo.setAttribute('aria-hidden', 'true');
    lienzo.style.cssText = 'position:fixed;inset:0;left:0;top:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:2147483000';
    contenedor.appendChild(lienzo);

    var ancho, alto, escala = window.devicePixelRatio || 1;
    function medir() {
      ancho = window.innerWidth;
      alto = window.innerHeight;
      lienzo.width = Math.round(ancho * escala);
      lienzo.height = Math.round(alto * escala);
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
    }
    medir();
    window.addEventListener('resize', medir);

    var fuerza = Math.max(0.75, Math.min(1.3, alto / 800));
    var papeles = [];
    for (var i = 0; i < 150; i++) {
      var izquierda = i % 2 === 0;
      papeles.push({
        x: izquierda ? -10 : ancho + 10,
        y: alto * (0.75 + Math.random() * 0.2),
        vx: (izquierda ? 1 : -1) * (3 + Math.random() * 7) * fuerza,
        vy: -(11 + Math.random() * 9) * fuerza,
        giro: Math.random() * Math.PI * 2,
        vgiro: (Math.random() - 0.5) * 0.35,
        vaiven: Math.random() * Math.PI * 2,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        redondo: Math.random() < 0.2,
        color: colores[Math.floor(Math.random() * colores.length)],
        retraso: Math.random() * 260
      });
    }

    var DURACION = 3600;
    var inicio = null, anterior = null;
    function paso(ahora) {
      if (inicio === null) inicio = anterior = ahora;
      var t = ahora - inicio;
      var k = Math.min(3, (ahora - anterior) / 16.7);
      anterior = ahora;
      ctx.clearRect(0, 0, ancho, alto);
      // Se desvanece en el último medio segundo.
      ctx.globalAlpha = t > DURACION - 500 ? Math.max(0, (DURACION - t) / 500) : 1;
      for (var i = 0; i < papeles.length; i++) {
        var p = papeles[i];
        if (t < p.retraso) continue;
        p.vx *= Math.pow(0.97, k);
        p.vy = p.vy * Math.pow(0.97, k) + 0.32 * fuerza * k;
        if (p.vy > 3.2 * fuerza) p.vy = 3.2 * fuerza;
        p.vaiven += 0.08 * k;
        p.x += (p.vx + Math.sin(p.vaiven) * 0.9) * k;
        p.y += p.vy * k;
        p.giro += p.vgiro * k;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        // Al girar en el aire, el papelito se ve de canto y de cara.
        ctx.scale(1, Math.cos(p.vaiven * 1.7));
        ctx.fillStyle = p.color;
        if (p.redondo) {
          ctx.beginPath();
          ctx.arc(0, 0, p.h, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (t < DURACION) {
        window.requestAnimationFrame(paso);
      } else {
        window.removeEventListener('resize', medir);
        lienzo.remove();
      }
    }
    window.requestAnimationFrame(paso);
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
      // Con todo hecho no hay siguiente al que señalar: sin mano ☞ y con «✓ Almanaque completo»
      // (en pantallas muy estrechas, «✓ Completo») en lugar del nombre.
      '.almanaque-siguiente--completo .almanaque-volver__mano,.almanaque-siguiente--completo .almanaque-siguiente__nombre,' +
      '#almanaque-siguiente:not(.almanaque-siguiente--completo) .almanaque-completo,.almanaque-completo__corto{display:none}' +
      '@media (max-width:25rem){.almanaque-completo__largo{display:none}.almanaque-completo__corto{display:inline}}' +
      '#almanaque-volver:hover,#almanaque-volver:focus-visible,' +
      '#almanaque-siguiente:hover,#almanaque-siguiente:focus-visible{opacity:1}' +
      '#almanaque-volver:focus-visible,#almanaque-siguiente:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
      '#almanaque-franja .almanaque-volver__mano{font-size:1.8em;line-height:.8;font-variant:normal;' +
      'transition:transform .18s ease}' +
      '#almanaque-volver:hover .almanaque-volver__mano{transform:translateX(-3px)}' +
      '#almanaque-siguiente:hover .almanaque-volver__mano{transform:translateX(3px)}' +
      // En pantallas estrechas, con las dos manos, «Regresar al» se cae para que quepan.
      '@media (max-width:36rem){.almanaque-franja--siguiente .almanaque-volver__largo{display:none}}' +
      // Sello de almanaque completo: el de la portada, con el rojo de tinta del logo.
      // Al caer, el sello es más ancho que un móvil: lo que sobra no debe dar scroll lateral.
      '.almanaque-sello-caja{display:flex;justify-content:center;width:100%;margin:1.4rem 0 1rem;overflow-x:clip}' +
      '.almanaque-sello-caja[hidden]{display:none}' +
      '.almanaque-sello{display:inline-flex;flex-direction:column;align-items:center;gap:.15rem;' +
      'padding:.45rem 1.1rem .5rem;border:5px double #a33a2a;border-radius:3px;color:#a33a2a;' +
      'font:inherit;line-height:1.1;text-decoration:none;transform:rotate(-4deg);opacity:.92;' +
      '-webkit-tap-highlight-color:transparent;transition:opacity .18s ease}' +
      ':root[data-theme="dark"] .almanaque-sello{color:#e58a76;border-color:#e58a76}' +
      '.almanaque-sello:hover{opacity:1}' +
      '.almanaque-sello:focus-visible{outline:2px solid currentColor;outline-offset:4px}' +
      '.almanaque-sello__titulo{font-variant:small-caps;font-size:1.3rem;letter-spacing:.14em}' +
      '.almanaque-sello__fecha{font-size:.85rem;letter-spacing:.12em;line-height:1}' +
      // El mismo golpe que en la portada: cae grande, se aplasta y se asienta.
      '.almanaque-sello--estampar{animation:almanaque-sello-golpe .6s cubic-bezier(.5,0,.75,0) both}' +
      '@keyframes almanaque-sello-golpe{' +
      '0%{opacity:0;transform:rotate(-4deg) scale(1.6)}20%{opacity:.55}' +
      '60%{opacity:.92;transform:rotate(-4deg);animation-timing-function:ease-out}' +
      '72%{transform:rotate(-4deg) scale(1.07,.9)}86%{transform:rotate(-4deg) scale(.98,1.02)}' +
      '100%{opacity:.92;transform:rotate(-4deg)}}' +
      // Pantalla de almanaque completo: la partida se oscurece y encima va una hoja del juego.
      '#almanaque-completo{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;' +
      'margin:0;padding:1rem;box-sizing:border-box;border:0;background:rgba(20,14,10,.6);color:inherit;' +
      'font:inherit;overflow:auto;z-index:2147482000}' +
      '#almanaque-completo[open]{display:flex;align-items:center;justify-content:center;' +
      'animation:almanaque-completo-entrar .3s ease-out both}' +
      '#almanaque-completo::backdrop{background:transparent}' +
      '.almanaque-completo__hoja{box-sizing:border-box;width:100%;max-width:23rem;margin:auto;' +
      'padding:1.8rem 1.4rem 1.5rem;border-radius:6px;text-align:center;line-height:1.4;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.35);animation:almanaque-completo-hoja .4s cubic-bezier(.2,.8,.3,1) both}' +
      '.almanaque-completo__titulo{display:block;font-variant:small-caps;font-size:1.15rem;letter-spacing:.12em;opacity:.8}' +
      '.almanaque-completo__hoja .almanaque-sello-caja{margin:1.3rem 0 1.2rem}' +
      '.almanaque-completo__hoja .almanaque-sello--estampar{animation-delay:.2s}' +
      // Girado, el sello ocupa algo más que su caja: se deja margen a los lados.
      '.almanaque-sello--grande{max-width:calc(100% - 2.5rem);box-sizing:border-box;padding:.55rem 1.2rem .6rem;border-width:6px}' +
      '.almanaque-sello--grande .almanaque-sello__titulo{font-size:1.5rem}' +
      '.almanaque-sello--grande .almanaque-sello__fecha{font-size:.95rem}' +
      '.almanaque-completo__texto{margin:0 0 1.2rem;font-size:.95rem;opacity:.8}' +
      '.almanaque-completo__cerrar{font:inherit;font-variant:small-caps;letter-spacing:.08em;font-size:1rem;' +
      'color:inherit;background:none;border:1px solid currentColor;border-radius:999px;padding:.45rem 1.3rem;' +
      'cursor:pointer;opacity:.75;-webkit-tap-highlight-color:transparent}' +
      '.almanaque-completo__cerrar:hover,.almanaque-completo__cerrar:focus-visible{opacity:1}' +
      '.almanaque-completo__cerrar:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
      // Al volver a subirla por encima de otro diálogo, ni entrada ni golpe otra vez.
      '.almanaque-completo--quieta,.almanaque-completo--quieta *{animation:none!important}' +
      '@keyframes almanaque-completo-entrar{from{opacity:0}to{opacity:1}}' +
      '@keyframes almanaque-completo-hoja{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){#almanaque-franja .almanaque-volver__mano{transition:none}' +
      '.almanaque-sello--estampar,#almanaque-completo[open],.almanaque-completo__hoja{animation:none}}';
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
    texto.appendChild(nombre);
    // Fijo desde el principio: así cambiar a «completo» no reescribe ningún texto.
    var completo = document.createElement('span');
    completo.className = 'almanaque-completo';
    completo.appendChild(trozo('almanaque-completo__largo', '✓ Almanaque completo'));
    completo.appendChild(trozo('almanaque-completo__corto', '✓ Completo'));
    texto.appendChild(completo);
    siguiente.appendChild(texto);
    siguiente.appendChild(mano('☞'));
    // Por si otro juego se ha terminado en otra pestaña o ha pasado la medianoche.
    siguiente.addEventListener('click', function () { actualizarSiguiente(); });

    franja.appendChild(enlace);
    franja.appendChild(siguiente);
    document.body.insertBefore(franja, document.body.firstChild);
  }

  function trozo(clase, contenido) {
    var span = document.createElement('span');
    span.className = clase;
    span.textContent = contenido;
    return span;
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
