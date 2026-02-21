/* ── Banco de dados (Dexie.js / IndexedDB) ── */

const db = new Dexie('ContagemAnimaisDB');

/* v1 (legado) */
db.version(1).stores({
  registros: '++id, categoria, dataHora, sincronizado',
  fotos: '++id, dataHora'
});

/* v2 — modelo por áreas */
db.version(2).stores({
  areas:     '++id, nome',
  visitas:   '++id, areaId, data',
  registros: '++id, visitaId, categoria, dataHora',
  fotos:     '++id, visitaId, dataHora'
}).upgrade(async tx => {
  // Migrar registros antigos (v1) para nova estrutura
  const regAntigos = await tx.table('registros').toArray();
  if (regAntigos.length === 0) return;

  // Criar área padrão para dados legados
  const areaId = await tx.table('areas').add({ nome: 'Área Geral' });

  // Agrupar registros antigos por dia
  const porDia = {};
  regAntigos.forEach(r => {
    if (!r.dataHora) return;
    const dia = r.dataHora.slice(0, 10);
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(r);
  });

  // Criar visitas e re-vincular registros
  for (const [dia, regs] of Object.entries(porDia)) {
    const primeiro = regs.find(r => r.latitude != null) || regs[0];
    const visitaId = await tx.table('visitas').add({
      areaId,
      data: dia,
      latitude: primeiro.latitude ?? null,
      longitude: primeiro.longitude ?? null,
      precisaoGPS: primeiro.precisaoGPS ?? null,
      horaInicio: primeiro.dataHora
    });

    for (const r of regs) {
      await tx.table('registros').update(r.id, {
        visitaId,
        // manter campos existentes
      });
    }
  }

  // Migrar fotos soltas → vincular à visita mais recente do dia
  const fotosAntigas = await tx.table('fotos').toArray();
  const visitas = await tx.table('visitas').toArray();
  for (const f of fotosAntigas) {
    if (!f.dataHora) continue;
    const dia = f.dataHora.slice(0, 10);
    const visita = visitas.find(v => v.data === dia);
    if (visita) {
      await tx.table('fotos').update(f.id, { visitaId: visita.id });
    }
  }
});

/* ── Faixas etárias fixas ── */
const FAIXAS = ['Adulto', 'Jovem', 'Filhote'];

/* ══════════ ÁREAS ══════════ */

async function criarArea(nome) {
  const nomeNorm = nome.trim();
  if (!nomeNorm) return null;
  // Evitar duplicatas (case-insensitive)
  const existente = await db.areas
    .filter(a => a.nome.toLowerCase() === nomeNorm.toLowerCase())
    .first();
  if (existente) return existente.id;
  return db.areas.add({ nome: nomeNorm });
}

async function listarAreas() {
  return db.areas.toArray();
}

async function deletarArea(id) {
  // Deletar visitas, registros e fotos da área
  const visitas = await db.visitas.where('areaId').equals(id).toArray();
  for (const v of visitas) {
    await db.registros.where('visitaId').equals(v.id).delete();
    await db.fotos.where('visitaId').equals(v.id).delete();
  }
  await db.visitas.where('areaId').equals(id).delete();
  return db.areas.delete(id);
}

/* ══════════ VISITAS ══════════ */

async function obterOuCriarVisitaHoje(areaId, gps) {
  const hoje = new Date().toISOString().slice(0, 10);
  let visita = await db.visitas
    .where({ areaId, data: hoje })
    .first();

  if (visita) return visita;

  const id = await db.visitas.add({
    areaId,
    data: hoje,
    latitude: gps?.latitude ?? null,
    longitude: gps?.longitude ?? null,
    precisaoGPS: gps?.precisao ?? null,
    horaInicio: new Date().toISOString()
  });

  return db.visitas.get(id);
}

async function listarVisitasDoDia(data) {
  const dia = typeof data === 'string' ? data : data.toISOString().slice(0, 10);
  return db.visitas.where('data').equals(dia).toArray();
}

async function listarTodasVisitas() {
  return db.visitas.orderBy('data').reverse().toArray();
}

async function obterVisita(id) {
  return db.visitas.get(id);
}

/* ══════════ REGISTROS ══════════ */

async function adicionarRegistro(registro) {
  return db.registros.add(registro);
}

async function listarRegistrosDaVisita(visitaId) {
  return db.registros.where('visitaId').equals(visitaId).toArray();
}

async function listarRegistrosDoDia(data) {
  const dia = typeof data === 'string' ? data : data.toISOString().slice(0, 10);
  const visitas = await db.visitas.where('data').equals(dia).toArray();
  const ids = visitas.map(v => v.id);
  if (ids.length === 0) return [];
  return db.registros.where('visitaId').anyOf(ids).toArray();
}

async function listarTodosRegistros() {
  return db.registros.orderBy('dataHora').reverse().toArray();
}

async function deletarRegistro(id) {
  return db.registros.delete(id);
}

/* ══════════ FOTOS ══════════ */

async function adicionarFoto(foto) {
  return db.fotos.add(foto);
}

async function listarFotosDaVisita(visitaId) {
  return db.fotos.where('visitaId').equals(visitaId).toArray();
}

async function listarTodasFotos() {
  return db.fotos.orderBy('dataHora').reverse().toArray();
}

async function deletarFoto(id) {
  return db.fotos.delete(id);
}

/* ══════════ HELPERS ══════════ */

async function totaisDaVisita(visitaId) {
  const regs = await listarRegistrosDaVisita(visitaId);
  return {
    adulto:  regs.filter(r => r.categoria === 'Adulto').reduce((s, r) => s + r.quantidade, 0),
    jovem:   regs.filter(r => r.categoria === 'Jovem').reduce((s, r) => s + r.quantidade, 0),
    filhote: regs.filter(r => r.categoria === 'Filhote').reduce((s, r) => s + r.quantidade, 0)
  };
}

async function obterAreaDaVisita(visitaId) {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return null;
  return db.areas.get(visita.areaId);
}
