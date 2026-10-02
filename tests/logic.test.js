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

test('refranes.json: 10 días × 3 refranes con todos los campos', () => {
  assert.equal(datos.dias.length, 10);
  for (const dia of datos.dias) {
    assert.equal(dia.refranes.length, 3);
    for (const r of dia.refranes) {
      for (const k of ['original', 'pedante', 'significado']) assert.ok(r[k] && typeof r[k] === 'string', `${r.original}: falta ${k}`);
      assert.ok(Array.isArray(r.variantes));
      if (r.equivalente) assert.ok(r.equivalente.idioma && r.equivalente.texto, r.original);
    }
  }
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
});

test('texto para compartir', () => {
  const partida = { refranes: [
    { estado: 'resuelto', pistas: 0 },
    { estado: 'resuelto', pistas: 2 },
    { estado: 'rendido', pistas: 1 }
  ] };
  assert.equal(L.textoCompartir(4, partida, 'https://x.es/Paremia/'), 'Paremia · Día 4\n🟩🟨⬛  4/9\nhttps://x.es/Paremia/');
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
