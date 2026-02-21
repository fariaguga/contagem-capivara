/* ── Geração do Laudo (HTML para impressão/PDF) ── */

function carregarImagemBase64(url) {
  return new Promise((resolve, reject) => {
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

async function gerarLaudo() {
  const registros = await listarTodosRegistros();
  const fotos = await listarTodasFotos();
  const logoBase64 = await carregarImagemBase64('./icons/logo-aznunes.jpg');

  if (registros.length === 0) {
    alert('Nenhum registro para gerar o laudo.');
    return;
  }

  // Agrupar registros por dia
  const porDia = {};
  registros.forEach(r => {
    const dia = r.dataHora.slice(0, 10);
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(r);
  });

  const diasOrdenados = Object.keys(porDia).sort();

  // Montar linhas da tabela de resultados
  let linhasResultados = '';
  let totalGeral = { adulto: 0, jovem: 0, filhote: 0, total: 0 };
  let numCampanha = 0;

  diasOrdenados.forEach(dia => {
    numCampanha++;
    const regs = porDia[dia];
    const adultos = regs.filter(r => r.categoria === 'Adulto').reduce((s, r) => s + r.quantidade, 0);
    const jovens = regs.filter(r => r.categoria === 'Jovem').reduce((s, r) => s + r.quantidade, 0);
    const filhotes = regs.filter(r => r.categoria === 'Filhote').reduce((s, r) => s + r.quantidade, 0);
    const total = adultos + jovens + filhotes;

    totalGeral.adulto += adultos;
    totalGeral.jovem += jovens;
    totalGeral.filhote += filhotes;
    totalGeral.total += total;

    const dataFmt = dia.split('-').reverse().join('/');
    const ultimoComGPS = regs.find(r => r.latitude != null);
    const lat = ultimoComGPS ? ultimoComGPS.latitude.toFixed(5) : '—';
    const lng = ultimoComGPS ? ultimoComGPS.longitude.toFixed(5) : '—';

    linhasResultados += `
      <tr>
        <td>${numCampanha}</td>
        <td>${dataFmt}</td>
        <td>${adultos}</td>
        <td>${jovens}</td>
        <td>${filhotes}</td>
        <td><strong>${total}</strong></td>
        <td>${lat}</td>
        <td>${lng}</td>
      </tr>`;
  });

  // Montar grid de fotos
  let fotosHtml = '';
  if (fotos.length > 0) {
    fotosHtml = `
      <div class="secao-laudo">
        <h2>Registro Fotográfico</h2>
        <div class="fotos-grid">
          ${fotos.map(f => `
            <figure class="foto-laudo">
              <img src="${f.dataUrl}">
              ${f.legenda ? `<figcaption>${f.legenda}</figcaption>` : ''}
            </figure>
          `).join('')}
        </div>
      </div>`;
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Laudo — Levantamento Populacional de Capivaras</title>
  <style>
    @page { margin: 20mm 15mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Roboto, Arial, sans-serif;
      color: #212121;
      font-size: 11pt;
      line-height: 1.5;
    }

    /* ── Capa ── */
    .capa {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      text-align: center;
      page-break-after: always;
    }
    .capa h1 {
      font-size: 22pt;
      color: #2e7d32;
      margin-bottom: .3em;
    }
    .capa h2 {
      font-size: 14pt;
      font-weight: 400;
      font-style: italic;
      color: #555;
      margin-bottom: 2em;
    }
    .capa .local {
      font-size: 13pt;
      color: #333;
    }
    .capa .data-laudo {
      margin-top: 3em;
      font-size: 11pt;
      color: #757575;
    }
    .capa .logo-capivara {
      margin-bottom: 2em;
    }
    .capa .logo-capivara img {
      max-width: 320px;
      height: auto;
    }

    /* ── Seções ── */
    .secao-laudo {
      margin-bottom: 2em;
    }
    .secao-laudo h2 {
      font-size: 14pt;
      color: #2e7d32;
      border-bottom: 2px solid #2e7d32;
      padding-bottom: .3em;
      margin-bottom: .8em;
    }
    .secao-laudo p {
      margin-bottom: .6em;
      text-align: justify;
    }

    /* ── Tabela ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
      font-size: 10pt;
    }
    th {
      background: #2e7d32;
      color: #fff;
      padding: .5em .4em;
      text-align: center;
      font-weight: 600;
    }
    td {
      border: 1px solid #ccc;
      padding: .4em;
      text-align: center;
    }
    tr:nth-child(even) td { background: #f5f5f5; }
    .linha-total td {
      background: #e8f5e9 !important;
      font-weight: 700;
    }

    /* ── Fotos ── */
    .fotos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .foto-laudo img {
      width: 100%;
      border-radius: 6px;
      border: 1px solid #ddd;
    }
    .foto-laudo figcaption {
      font-size: 9pt;
      color: #555;
      text-align: center;
      margin-top: .3em;
    }

    /* ── Rodapé ── */
    .rodape {
      margin-top: 3em;
      text-align: center;
      font-size: 9pt;
      color: #999;
      border-top: 1px solid #ddd;
      padding-top: 1em;
    }

    @media print {
      .btn-imprimir { display: none; }
    }
    .btn-imprimir {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #2e7d32;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14pt;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
      z-index: 100;
    }
  </style>
</head>
<body>

  <button class="btn-imprimir" onclick="window.print()">Salvar como PDF</button>

  <!-- Capa -->
  <div class="capa">
    <div class="logo-capivara">${logoBase64 ? `<img src="${logoBase64}" alt="AZ Nunes">` : ''}</div>
    <h1>LEVANTAMENTO POPULACIONAL DE CAPIVARAS</h1>
    <h2>(<em>Hydrochoerus hydrochaeris</em>)</h2>
    <p class="data-laudo">${dataHoje}</p>
  </div>

  <!-- Resultados -->
  <div class="secao-laudo">
    <h2>Resultado de Capivaras Avistadas</h2>
    <table>
      <thead>
        <tr>
          <th>Dia</th>
          <th>Data</th>
          <th>Adultos</th>
          <th>Jovens</th>
          <th>Filhotes</th>
          <th>Total</th>
          <th>Latitude</th>
          <th>Longitude</th>
        </tr>
      </thead>
      <tbody>
        ${linhasResultados}
        <tr class="linha-total">
          <td colspan="2">TOTAL</td>
          <td>${totalGeral.adulto}</td>
          <td>${totalGeral.jovem}</td>
          <td>${totalGeral.filhote}</td>
          <td>${totalGeral.total}</td>
          <td colspan="2">—</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Resumo -->
  <div class="secao-laudo">
    <h2>Resumo Populacional</h2>
    <p>Contabilizando todos os registros de indivíduos, podemos estimar uma população de <strong>${totalGeral.total} capivaras</strong>, sendo <strong>${totalGeral.adulto} adultos</strong>, <strong>${totalGeral.jovem} jovens</strong> e <strong>${totalGeral.filhote} filhotes</strong>.</p>
    <p>As contagens foram realizadas ao longo de <strong>${diasOrdenados.length} campanha(s)</strong>, entre ${diasOrdenados[0].split('-').reverse().join('/')} e ${diasOrdenados[diasOrdenados.length - 1].split('-').reverse().join('/')}.</p>
  </div>

  <!-- Fotos -->
  ${fotosHtml}

  <div class="rodape">
    Relatório gerado automaticamente pelo app Contagem de Capivaras — ${dataHoje}
  </div>

</body>
</html>`;

  const janela = window.open('', '_blank');
  janela.document.write(html);
  janela.document.close();
}
