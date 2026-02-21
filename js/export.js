/* ── Exportacao CSV ── */

async function registrosParaCSV(registros) {
  const cabecalho = 'id,area,faixaEtaria,quantidade,latitude,longitude,precisaoGPS,dataHora,observacao';
  const linhas = [];

  for (const r of registros) {
    let nomeArea = '';
    let visita = null;
    if (r.visitaId) {
      visita = await obterVisita(r.visitaId);
      if (visita) {
        const area = await db.areas.get(visita.areaId);
        nomeArea = area ? area.nome : '';
      }
    }

    const obs = (r.observacao || '').replace(/"/g, '""');
    linhas.push([
      r.id,
      `"${nomeArea}"`,
      r.categoria,
      r.quantidade,
      visita?.latitude ?? '',
      visita?.longitude ?? '',
      visita?.precisaoGPS ?? '',
      r.dataHora,
      `"${obs}"`
    ].join(','));
  }

  return cabecalho + '\n' + linhas.join('\n');
}

function baixarCSV(conteudo, nomeArquivo) {
  const bom = '\uFEFF'; // BOM UTF-8 para Excel reconhecer acentos
  const blob = new Blob([bom + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportarCSV(filtro) {
  let registros;
  const agora = new Date();

  if (filtro === 'hoje') {
    registros = await listarRegistrosDoDia(agora);
  } else if (filtro === 'semana') {
    const seteDiasAtras = new Date(agora);
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const dataInicio = seteDiasAtras.toISOString().slice(0, 10);
    const dataFim = agora.toISOString().slice(0, 10);

    // Buscar todas visitas nos ultimos 7 dias
    const todasVisitas = await listarTodasVisitas();
    const visitasNoPeriodo = todasVisitas.filter(v => v.data >= dataInicio && v.data <= dataFim);
    const ids = visitasNoPeriodo.map(v => v.id);
    registros = ids.length > 0
      ? await db.registros.where('visitaId').anyOf(ids).toArray()
      : [];
  } else {
    registros = await listarTodosRegistros();
  }

  if (registros.length === 0) {
    alert('Nenhum registro para exportar.');
    return;
  }

  const csv = await registrosParaCSV(registros);
  const dataStr = agora.toISOString().slice(0, 10);
  baixarCSV(csv, `contagem-capivaras-${filtro}-${dataStr}.csv`);
}
