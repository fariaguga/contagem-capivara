/* ── Geração do Laudo (overlay no próprio app) ── */

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
    const lat = ultimoComGPS ? ultimoComGPS.latitude.toFixed(5) : '\u2014';
    const lng = ultimoComGPS ? ultimoComGPS.longitude.toFixed(5) : '\u2014';

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
      <div class="laudo-secao">
        <h2>Registro Fotogr\u00e1fico</h2>
        <div class="laudo-fotos-grid">
          ${fotos.map(f => `
            <figure class="laudo-foto">
              <img src="${f.dataUrl}">
              ${f.legenda ? `<figcaption>${f.legenda}</figcaption>` : ''}
            </figure>
          `).join('')}
        </div>
      </div>`;
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
                <td colspan="2">TOTAL</td>
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
        <p>Contabilizando todos os registros de indiv\u00edduos, podemos estimar uma popula\u00e7\u00e3o de <strong>${totalGeral.total} capivaras</strong>, sendo <strong>${totalGeral.adulto} adultos</strong>, <strong>${totalGeral.jovem} jovens</strong> e <strong>${totalGeral.filhote} filhotes</strong>.</p>
        <p>As contagens foram realizadas ao longo de <strong>${diasOrdenados.length} campanha(s)</strong>, entre ${diasOrdenados[0].split('-').reverse().join('/')} e ${diasOrdenados[diasOrdenados.length - 1].split('-').reverse().join('/')}.</p>
      </div>

      <!-- Fotos -->
      ${fotosHtml}

      <div class="laudo-rodape">
        Relat\u00f3rio gerado automaticamente pelo app Contagem de Capivaras \u2014 ${dataHoje}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
