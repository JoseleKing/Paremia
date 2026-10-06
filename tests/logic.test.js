// Pruebas de la lógica del juego. Ejecutar con: node --test tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../app.js');

const datos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'refranes.json'), 'utf8'));
const todos = datos.dias.flatMap((d) => d.refranes);
const buscar = (texto) => todos.find((r) => r.original === texto);

function almacenEnMemoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('refranes.json: 40 días × 3 refranes con todos los campos', () => {
  assert.equal(datos.dias.length, 40);
  for (const dia of datos.dias) {
    assert.equal(dia.refranes.length, 3);
    for (const r of dia.refranes) {
      for (const k of ['original', 'pedante', 'significado']) assert.ok(r[k] && typeof r[k] === 'string', `${r.original}: falta ${k}`);
      assert.ok(Array.isArray(r.variantes));
      if (r.equivalente) assert.ok(r.equivalente.idioma && r.equivalente.texto, r.original);
    }
  }
});

test('ciclo: tras el último día se vuelve al primero', () => {
  // 10 de noviembre de 2026 = día 40 (el último); el 11 vuelve a empezar.
  const n = L.numeroDia(new Date(2026, 10, 10, 12));
  assert.equal(n, 40);
  assert.equal(L.diaDeContenido(datos.dias, n), datos.dias[39]);
  assert.equal(L.diaDeContenido(datos.dias, n + 1), datos.dias[0]);
  const originales = datos.dias.flatMap(d => d.refranes.map(r => L.normalizar(r.original)));
  assert.equal(new Set(originales).size, originales.length, 'hay refranes repetidos');
});

test('normalizar quita mayúsculas, tildes, signos y espacios dobles', () => {
  assert.equal(L.normalizar('  ¡Perro   ladrador, POCO mordedor!  '), 'perro ladrador poco mordedor');
  assert.equal(L.normalizar('Más vale pájaro en mano'), 'mas vale pajaro en mano');
  assert.equal(L.normalizar('A caballo regalado…'), 'a caballo regalado');
});

test('acepta el canónico, las variantes y erratas pequeñas', () => {
  const caballo = buscar('A caballo regalado no le mires el diente');
  assert.equal(L.comprobarRespuesta('a caballo regalado no le mires el diente', caballo), 'exacto');
  assert.equal(L.comprobarRespuesta('A caballo regalado no se le mira el diente.', caballo), 'exacto');
  assert.equal(L.comprobarRespuesta('a cabayo regalao no le mires el diente', caballo), 'aproximado');

  const pajaro = buscar('Más vale pájaro en mano que ciento volando');
  assert.equal(L.comprobarRespuesta('mas vale pajaro en mano que cien volando', pajaro), 'aproximado');
  assert.equal(L.comprobarRespuesta('mas vale pajaro en mano', pajaro), 'mal');
});

test('«casi» entre el 15 % y el 30 %; vacío y lejano se distinguen', () => {
  const r = buscar('Ojos que no ven, corazón que no siente');
  // canónico normalizado: 36 letras → acierto ≤ 5,4; casi ≤ 10,8
  assert.equal(L.comprobarRespuesta('ojos que no ven corazon que no llora', r), 'casi');
  assert.equal(L.comprobarRespuesta('', r), 'vacio');
  assert.equal(L.comprobarRespuesta('   ¿?  ', r), 'vacio');
  assert.equal(L.comprobarRespuesta('perro ladrador poco mordedor', r), 'mal');
});

test('levenshtein', () => {
  assert.equal(L.levenshtein('gato', 'pato'), 1);
  assert.equal(L.levenshtein('', 'abc'), 3);
  assert.equal(L.levenshtein('refran', 'refran'), 0);
  assert.equal(L.levenshtein('kitten', 'sitting'), 3);
});

test('esqueleto separa palabras y signos', () => {
  const e = L.esqueleto('Perro ladrador, poco mordedor');
  assert.deepEqual(e.map((p) => p.letras), ['Perro', 'ladrador', 'poco', 'mordedor']);
  assert.equal(e[1].signo, ',');
});

test('repartirLetras llena los huecos por orden y salta solo de palabra', () => {
  const e = L.esqueleto('Perro ladrador, poco mordedor');
  const a = L.repartirLetras('perroladr', e, []);
  assert.deepEqual(a.letras, ['perro', 'ladr', '', '']);
  assert.equal(a.actual, 1);
  // Un espacio tras una palabra llena no se salta la siguiente.
  assert.deepEqual(L.repartirLetras('perro ladrador poco', e, []).letras, ['perro', 'ladrador', 'poco', '']);
  // Un espacio a medias deja huecos y pasa a la siguiente; uno de más no cuenta.
  assert.deepEqual(L.repartirLetras('per  lad', e, []).letras, ['per', 'lad', '', '']);
  // Con la palabra llena, el cursor ya está en la siguiente.
  assert.equal(L.repartirLetras('perro', e, []).actual, 1);
  // Lo que no cabe se descarta y ya no hay palabra en curso.
  const lleno = L.repartirLetras('perro ladrador poco mordedorxyz', e, []);
  assert.equal(lleno.letras[3], 'mordedor');
  assert.equal(lleno.actual, -1);
  // Signos ignorados; tildes y eñes cuentan como una letra.
  assert.deepEqual(L.repartirLetras('¡Pá-ja!', L.esqueleto('pájaro'), []).letras, ['Pája']);
  assert.deepEqual(L.repartirLetras('pa\u0301jaro', L.esqueleto('pájaro'), []).letras, ['pájaro']);
});

test('repartirLetras se salta las palabras destapadas', () => {
  const e = L.esqueleto('Perro ladrador, poco mordedor');
  const a = L.repartirLetras('perro poco', e, [1]);
  assert.deepEqual(a.letras, ['perro', '', 'poco', '']);
  assert.equal(a.actual, 3);
  assert.equal(L.textoDelEsqueleto(e, a.letras, [1]), 'perro ladrador poco');
});

test('repartirLetras admite que se teclee también la palabra destapada', () => {
  const e = L.esqueleto('Más vale tarde que nunca');
  assert.deepEqual(L.repartirLetras('mas vale tarde que nunca', e, [2]).letras, ['mas', 'vale', '', 'que', 'nunca']);
  // El comienzo de la destapada, al final del texto, no se cuela en la siguiente.
  assert.deepEqual(L.repartirLetras('mas vale tar', e, [2]).letras, ['mas', 'vale', '', '', '']);
  // Saltársela también vale.
  assert.deepEqual(L.repartirLetras('mas vale que', e, [2]).letras, ['mas', 'vale', '', 'que', '']);
  // Varias destapadas seguidas, también al principio.
  assert.deepEqual(L.repartirLetras('Más vale tarde que', e, [0, 1]).letras, ['', '', 'tarde', 'que', '']);
  // Una palabra que solo empieza como la destapada no se la come.
  assert.deepEqual(L.repartirLetras('no nos', L.esqueleto('no nos dejes'), [0]).letras, ['', 'nos', '']);
});

test('destapar una palabra conserva lo escrito en las demás', () => {
  const e = L.esqueleto('Perro ladrador, poco mordedor');
  const antes = L.repartirLetras('perro lad poco', e, []);
  const texto = L.textoEscrito(antes.letras, [1]);
  assert.deepEqual(L.repartirLetras(texto, e, [1]).letras, ['perro', '', 'poco', '']);
});

test('lo escrito en el esqueleto se da por bueno con la lógica de siempre', () => {
  for (const r of todos) {
    const e = L.esqueleto(r.original);
    const orden = L.ordenPistas(r.original);
    for (const n of [0, 1, 3]) {
      const destapadas = orden.slice(0, n);
      const tecleado = e.filter((_, i) => !destapadas.includes(i)).map((p) => L.normalizar(p.letras)).join('');
      const { letras } = L.repartirLetras(tecleado, e, destapadas);
      assert.equal(L.comprobarRespuesta(L.textoDelEsqueleto(e, letras, destapadas), r), 'exacto', r.original);
    }
  }
});

test('orden de pistas: estable, completo y nunca empieza por la primera palabra', () => {
  for (const r of todos) {
    const a = L.ordenPistas(r.original);
    const b = L.ordenPistas(r.original);
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort((x, y) => x - y), a.map((_, i) => i));
    assert.notEqual(a[0], 0, r.original);
  }
});

test('puntuación por refrán y por partida', () => {
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 0 }), 3);
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 1 }), 2);
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 2 }), 1);
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 5 }), 1);
  assert.equal(L.puntosRefran({ estado: 'rendido', pistas: 0 }), 0);
  // Los fallos restan igual que las pistas
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 0, fallos: 1 }), 2);
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 1, fallos: 1 }), 1);
  assert.equal(L.puntosRefran({ estado: 'resuelto', pistas: 0, fallos: 7 }), 1);
  assert.equal(L.puntosRefran({ estado: 'rendido', pistas: 0, fallos: 2 }), 0);
  assert.equal(L.valorRefran({ estado: 'jugando', pistas: 0, fallos: 0 }), 3);
});

test('al tercer fallo el refrán se da por perdido', () => {
  const r = { estado: 'jugando', pistas: 0, fallos: 0, intentos: 0 };
  assert.equal(L.registrarFallo(r), false);
  assert.equal(L.registrarFallo(r), false);
  assert.equal(r.estado, 'jugando');
  assert.equal(L.registrarFallo(r), true);
  assert.equal(r.estado, 'rendido');
  assert.equal(r.fallos, L.MAX_FALLOS);
  assert.equal(L.puntosRefran(r), 0);
});

test('texto para compartir', () => {
  const partida = { refranes: [
    { estado: 'resuelto', pistas: 0 },
    { estado: 'resuelto', pistas: 2 },
    { estado: 'rendido', pistas: 1 }
  ] };
  assert.equal(L.textoCompartir(4, partida, 'https://x.es/Paremia/'), 'Paremia · Día 4\n🟩🟨⬛  4/9\nhttps://x.es/Paremia/');
  partida.refranes[0].fallos = 1;
  assert.equal(L.textoCompartir(4, partida), 'Paremia · Día 4\n🟨🟨⬛  3/9');
});

test('días: FECHA_INICIO es el día 1 y ?dia=N lo fuerza', () => {
  const inicio = L.leerFechaISO(L.FECHA_INICIO);
  const mas = (n) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + n, 23, 59);
  assert.equal(L.numeroDia(mas(0)), 1);
  assert.equal(L.numeroDia(mas(9)), 10);
  assert.equal(L.numeroDia(mas(-1)), 0);
  assert.equal(L.numeroDia(new Date(2027, 2, 29, 0, 1), '2027-03-27'), 3); // cambio de hora
  assert.equal(L.diaForzado('?dia=4'), 4);
  assert.equal(L.diaForzado('?x=1&dia=12'), 12);
  assert.equal(L.diaForzado('?dia=0'), null);
  assert.equal(L.diaForzado(''), null);
});

test('estado: se guarda, se recupera y sobrevive a un almacén roto', () => {
  const almacen = almacenEnMemoria();
  const e = L.estadoVacio();
  const p = L.partidaDelDia(e, 1, 3);
  p.refranes[0].estado = 'resuelto';
  p.refranes[0].pistas = 1;
  L.guardarEstado(almacen, e);
  const leido = L.cargarEstado(almacen);
  assert.equal(L.refranActual(leido.partidas[1]), 1);
  assert.equal(L.puntosPartida(leido.partidas[1]), 2);

  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.deepEqual(L.cargarEstado(roto), L.estadoVacio());
  assert.doesNotThrow(() => L.guardarEstado(roto, e));
  const basura = almacenEnMemoria();
  basura.setItem(L.CLAVE_ALMACEN, '{no es json');
  assert.deepEqual(L.cargarEstado(basura), L.estadoVacio());
});

test('racha e historial', () => {
  const e = L.estadoVacio();
  const jugar = (dia, pistas) => {
    const p = L.partidaDelDia(e, dia, 3);
    p.refranes.forEach((r) => { r.estado = 'resuelto'; r.pistas = pistas; });
    return L.terminarPartida(e, dia);
  };
  assert.equal(jugar(1, 0), true);
  assert.equal(L.terminarPartida(e, 1), false); // no cuenta dos veces
  jugar(2, 1);
  assert.equal(e.racha.actual, 2);
  assert.equal(e.historial[1], 9);
  assert.equal(e.historial[2], 6);
  assert.equal(L.rachaVigente(e, 3), 2);
  assert.equal(L.rachaVigente(e, 4), 0);
  jugar(5, 0);
  assert.equal(e.racha.actual, 1);
  assert.equal(e.racha.maxima, 2);
});

test('cuenta atrás', () => {
  assert.equal(L.formatoCuentaAtras(3661000), '01:01:01');
  assert.equal(L.msHastaMedianoche(new Date(2026, 9, 2, 23, 59, 0)), 60000);
});
