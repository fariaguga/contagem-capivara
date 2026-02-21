/* ── Geracao do Laudo (overlay no proprio app) ── */

function carregarImagemBase64(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
}

function fecharLaudo() {
  const overlay = document.getElementById('laudo-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}

async function gerarLaudo() {
  const visitas = await listarTodasVisitas();
  const fotos = await listarTodasFotos();
  const logoBase64 = await carregarImagemBase64('./icons/logo-aznunes.jpg');

  if (visitas.length === 0) {
    alert('Nenhum registro para gerar o laudo.');
    return;
  }

  // Agrupar visitas por dia
  const porDia = {};
  for (const v of visitas) {
    if (!porDia[v.data]) porDia[v.data] = [];
    porDia[v.data].push(v);
  }

  const diasOrdenados = Object.keys(porDia).sort();

  // Montar linhas da tabela de resultados
  let linhasResultados = '';
  let totalGeral = { adulto: 0, jovem: 0, filhote: 0, total: 0 };
  let numCampanha = 0;

  for (const dia of diasOrdenados) {
    numCampanha++;
    const visitasDoDia = porDia[dia];

    for (const v of visitasDoDia) {
      const area = await db.areas.get(v.areaId);
      const nomeArea = area ? area.nome : 'Area desconhecida';
      const totais = await totaisDaVisita(v.id);
      const total = totais.adulto + totais.jovem + totais.filhote;

      if (total === 0) continue;

      totalGeral.adulto += totais.adulto;
      totalGeral.jovem += totais.jovem;
      totalGeral.filhote += totais.filhote;
      totalGeral.total += total;

      const dataFmt = dia.split('-').reverse().join('/');
      const lat = v.latitude != null ? v.latitude.toFixed(5) : '\u2014';
      const lng = v.longitude != null ? v.longitude.toFixed(5) : '\u2014';

      linhasResultados += `
        <tr>
          <td>${numCampanha}</td>
          <td>${dataFmt}</td>
          <td>${nomeArea}</td>
          <td>${totais.adulto}</td>
          <td>${totais.jovem}</td>
          <td>${totais.filhote}</td>
          <td><strong>${total}</strong></td>
          <td>${lat}</td>
          <td>${lng}</td>
        </tr>`;
    }
  }

  if (totalGeral.total === 0) {
    alert('Nenhum registro para gerar o laudo.');
    return;
  }

  // Montar fotos agrupadas por area
  let fotosHtml = '';
  if (fotos.length > 0) {
    // Agrupar fotos por visitaId → area
    const fotosPorArea = {};
    for (const f of fotos) {
      const area = await obterAreaDaVisita(f.visitaId);
      const nomeArea = area ? area.nome : 'Sem area';
      if (!fotosPorArea[nomeArea]) fotosPorArea[nomeArea] = [];
      fotosPorArea[nomeArea].push(f);
    }

    fotosHtml = '<div class="laudo-secao"><h2>Registro Fotografico</h2>';
    for (const [nomeArea, fotosArea] of Object.entries(fotosPorArea)) {
      fotosHtml += `<p class="laudo-area-fotos-titulo">${nomeArea}</p>`;
      fotosHtml += '<div class="laudo-fotos-grid">';
      fotosArea.forEach(f => {
        fotosHtml += `
          <figure class="laudo-foto">
            <img src="${f.dataUrl}">
            ${f.legenda ? `<figcaption>${f.legenda}</figcaption>` : ''}
          </figure>
        `;
      });
      fotosHtml += '</div>';
    }
    fotosHtml += '</div>';
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR');

  // Remover overlay anterior se existir
  const anterior = document.getElementById('laudo-overlay');
  if (anterior) anterior.remove();

  // Criar overlay
  const overlay = document.createElement('div');
  overlay.id = 'laudo-overlay';
  overlay.innerHTML = `
    <div class="laudo-toolbar">
      <button class="laudo-btn-voltar" onclick="fecharLaudo()">Voltar</button>
      <span class="laudo-toolbar-titulo">Laudo</span>
      <button class="laudo-btn-print" onclick="window.print()">Salvar PDF</button>
    </div>
    <div class="laudo-conteudo">

      <!-- Capa -->
      <div class="laudo-capa">
        ${logoBase64 ? `<img class="laudo-logo" src="${logoBase64}" alt="AZ Nunes">` : ''}
        <h1>LEVANTAMENTO POPULACIONAL DE CAPIVARAS</h1>
        <p class="laudo-subtitulo">(<em>Hydrochoerus hydrochaeris</em>)</p>
        <p class="laudo-data">${dataHoje}</p>
      </div>

      <!-- Resultados -->
      <div class="laudo-secao">
        <h2>Resultado de Capivaras Avistadas</h2>
        <div class="laudo-tabela-wrapper">
          <table class="laudo-tabela">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Data</th>
                <th>Area</th>
                <th>Adultos</th>
                <th>Jovens</th>
                <th>Filhotes</th>
                <th>Total</th>
                <th>Lat</th>
                <th>Lng</th>
              </tr>
            </thead>
            <tbody>
              ${linhasResultados}
              <tr class="laudo-linha-total">
                <td colspan="3">TOTAL</td>
                <td>${totalGeral.adulto}</td>
                <td>${totalGeral.jovem}</td>
                <td>${totalGeral.filhote}</td>
                <td>${totalGeral.total}</td>
                <td colspan="2">\u2014</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Resumo -->
      <div class="laudo-secao">
        <h2>Resumo Populacional</h2>
        <p>Contabilizando todos os registros de individuos, podemos estimar uma populacao de <strong>${totalGeral.total} capivaras</strong>, sendo <strong>${totalGeral.adulto} adultos</strong>, <strong>${totalGeral.jovem} jovens</strong> e <strong>${totalGeral.filhote} filhotes</strong>.</p>
        <p>As contagens foram realizadas ao longo de <strong>${diasOrdenados.length} campanha(s)</strong>, entre ${diasOrdenados[0].split('-').reverse().join('/')} e ${diasOrdenados[diasOrdenados.length - 1].split('-').reverse().join('/')}.</p>
      </div>

      <!-- Fotos -->
      ${fotosHtml}

      <div class="laudo-rodape">
        Relatorio gerado automaticamente pelo app Contagem de Capivaras \u2014 ${dataHoje}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
