/* ── Banco de dados (Dexie.js / IndexedDB) ── */

const db = new Dexie('ContagemAnimaisDB');

db.version(1).stores({
  registros: '++id, categoria, dataHora, sincronizado',
  fotos: '++id, dataHora'
});

/* ── Faixas etárias fixas ── */
const FAIXAS = ['Adulto', 'Jovem', 'Filhote'];

/* ── Registros ── */

async function adicionarRegistro(registro) {
  return db.registros.add(registro);
}

async function listarRegistrosDoDia(data) {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(data);
  fim.setHours(23, 59, 59, 999);
  return db.registros
    .where('dataHora')
    .between(inicio.toISOString(), fim.toISOString(), true, true)
    .reverse()
    .toArray();
}

async function listarRegistrosPeriodo(de, ate) {
  return db.registros
    .where('dataHora')
    .between(de, ate, true, true)
    .toArray();
}

async function listarTodosRegistros() {
  return db.registros.orderBy('dataHora').reverse().toArray();
}

async function deletarRegistro(id) {
  return db.registros.delete(id);
}

async function totalDoDia(data) {
  const registros = await listarRegistrosDoDia(data);
  return registros.reduce((soma, r) => soma + r.quantidade, 0);
}

/* ── Fotos ── */

async function adicionarFoto(foto) {
  return db.fotos.add(foto);
}

async function listarTodasFotos() {
  return db.fotos.orderBy('dataHora').reverse().toArray();
}

async function deletarFoto(id) {
  return db.fotos.delete(id);
}
