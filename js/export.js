/* ── Exportação CSV ── */

function registrosParaCSV(registros) {
  const cabecalho = 'id,faixaEtaria,quantidade,latitude,longitude,precisaoGPS,dataHora,observacao';
  const linhas = registros.map(r => {
    const obs = (r.observacao || '').replace(/"/g, '""');
    return [
      r.id,
      r.categoria,
      r.quantidade,
      r.latitude ?? '',
      r.longitude ?? '',
      r.precisaoGPS ?? '',
      r.dataHora,
      `"${obs}"`
    ].join(',');
  });
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
    seteDiasAtras.setHours(0, 0, 0, 0);
    registros = await listarRegistrosPeriodo(seteDiasAtras.toISOString(), agora.toISOString());
  } else {
    registros = await listarTodosRegistros();
  }

  if (registros.length === 0) {
    alert('Nenhum registro para exportar.');
    return;
  }

  const csv = registrosParaCSV(registros);
  const dataStr = agora.toISOString().slice(0, 10);
  baixarCSV(csv, `contagem-capivaras-${filtro}-${dataStr}.csv`);
}
