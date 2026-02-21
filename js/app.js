/* ── Estado ── */
let categoriaSelecionada = null;
let gpsAtual = { latitude: null, longitude: null, precisao: null };
let watchId = null;
let visitaAtiva = null;   // objeto visita completo
let areaAtiva = null;     // objeto area completo

/* ── Elementos ── */
const $ = id => document.getElementById(id);

const categoriasGrid   = $('categorias-grid');
const btnMaisUm        = $('btn-mais-um');
const plusLabel         = $('plus-label');
const inputQtd         = $('input-qtd');
const btnRegistrar     = $('btn-registrar');
const inputObs         = $('input-obs');
const totalNumero      = $('total-numero');
const gpsBadge         = $('gps-badge');
const gpsDot           = $('gps-dot');
const gpsTexto         = $('gps-texto');
const toastEl          = $('toast');
const inputData        = $('input-data');

/* ── Cores por faixa etaria ── */
const CORES = {
  'Adulto':  'var(--cor-adulto)',
  'Jovem':   'var(--cor-jovem)',
  'Filhote': 'var(--cor-filhote)'
};

function corCategoria(nome) {
  return CORES[nome] || '#6B7280';
}

/* ── Toast ── */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('mostrar');
  setTimeout(() => toastEl.classList.remove('mostrar'), 1500);
}

/* ── Vibracao ── */
function vibrar() {
  if (navigator.vibrate) navigator.vibrate(50);
}

/* ── GPS ── */
const coordsLat = $('coords-lat');
const coordsLng = $('coords-lng');
const coordsAcc = $('coords-accuracy');

function iniciarGPS() {
  if (!('geolocation' in navigator)) {
    gpsTexto.textContent = 'GPS indisponivel';
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    pos => {
      gpsAtual.latitude = pos.coords.latitude;
      gpsAtual.longitude = pos.coords.longitude;
      gpsAtual.precisao = Math.round(pos.coords.accuracy);
      gpsBadge.classList.remove('inativo');
      gpsBadge.classList.add('ativo');
      gpsTexto.textContent = 'Ativo';
      coordsLat.textContent = gpsAtual.latitude.toFixed(5);
      coordsLng.textContent = gpsAtual.longitude.toFixed(5);
      coordsAcc.textContent = `\u00b1${gpsAtual.precisao}m`;
    },
    () => {
      gpsBadge.classList.remove('ativo');
      gpsBadge.classList.add('inativo');
      gpsTexto.textContent = 'GPS inativo';
      coordsLat.textContent = '--';
      coordsLng.textContent = '--';
      coordsAcc.textContent = '';
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

/* ══════════════════════════════════════════
   ABA AREAS
   ══════════════════════════════════════════ */

async function renderAreasTab() {
  await renderVisitasHoje();
  await renderAreaChips();
}

async function renderVisitasHoje() {
  const container = $('visitas-hoje');
  const hoje = new Date().toISOString().slice(0, 10);
  const visitas = await listarVisitasDoDia(hoje);

  if (visitas.length === 0) {
    container.innerHTML = '<p class="sem-registros">Nenhuma visita hoje. Selecione uma area abaixo.</p>';
    return;
  }

  container.innerHTML = '';

  for (const v of visitas) {
    const area = await db.areas.get(v.areaId);
    if (!area) continue;
    const totais = await totaisDaVisita(v.id);
    const total = totais.adulto + totais.jovem + totais.filhote;
    const hora = v.horaInicio ? new Date(v.horaInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

    const card = document.createElement('div');
    card.className = 'visita-card';
    if (visitaAtiva && visitaAtiva.id === v.id) card.classList.add('ativa');

    card.innerHTML = `
      <div class="visita-card-header">
        <span class="visita-card-nome">${area.nome}</span>
        <span class="visita-card-hora">${hora}</span>
      </div>
      <div class="visita-card-totais">
        <span class="mini-badge adulto">${totais.adulto} Ad</span>
        <span class="mini-badge jovem">${totais.jovem} Jv</span>
        <span class="mini-badge filhote">${totais.filhote} Fl</span>
        <span class="mini-badge total">${total}</span>
      </div>
      <button class="btn-continuar" data-visita-id="${v.id}" data-area-id="${v.areaId}">Continuar</button>
    `;
    container.appendChild(card);
  }
}

async function renderAreaChips() {
  const container = $('area-chips');
  const areas = await listarAreas();

  if (areas.length === 0) {
    container.innerHTML = '<p class="sem-registros">Nenhuma area cadastrada.</p>';
    return;
  }

  container.innerHTML = '';

  areas.forEach(a => {
    const chip = document.createElement('button');
    chip.className = 'area-chip';
    chip.dataset.areaId = a.id;
    chip.innerHTML = `
      <span class="chip-nome">${a.nome}</span>
      <span class="chip-del" data-del-area="${a.id}">&times;</span>
    `;
    container.appendChild(chip);
  });
}

async function selecionarArea(areaId) {
  const area = await db.areas.get(areaId);
  if (!area) return;

  areaAtiva = area;
  visitaAtiva = await obterOuCriarVisitaHoje(areaId, gpsAtual);

  atualizarBannerArea();
  await atualizarTotal();
  await renderGaleria();
  irParaTab('contagem');
  await renderAreasTab();
}

async function continuarVisita(visitaId, areaId) {
  visitaAtiva = await obterVisita(visitaId);
  areaAtiva = await db.areas.get(areaId);

  atualizarBannerArea();
  await atualizarTotal();
  await renderGaleria();
  irParaTab('contagem');
}

/* ══════════════════════════════════════════
   ABA CONTAGEM
   ══════════════════════════════════════════ */

function atualizarBannerArea() {
  const banner = $('banner-area');
  const semArea = $('sem-area-ativa');
  const conteudo = $('contagem-conteudo');

  if (!visitaAtiva || !areaAtiva) {
    banner.style.display = 'none';
    semArea.style.display = '';
    conteudo.style.display = 'none';
    return;
  }

  banner.style.display = '';
  semArea.style.display = 'none';
  conteudo.style.display = '';

  $('banner-nome').textContent = areaAtiva.nome;
  const hora = visitaAtiva.horaInicio
    ? new Date(visitaAtiva.horaInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const gpsInfo = visitaAtiva.latitude
    ? `${visitaAtiva.latitude.toFixed(4)}, ${visitaAtiva.longitude.toFixed(4)}`
    : 'Sem GPS';
  $('banner-detalhe').textContent = `${hora} \u2022 ${gpsInfo}`;
}

/* ── Segment Control UI ── */
function renderCategorias() {
  categoriasGrid.innerHTML = '';

  FAIXAS.forEach(nome => {
    const btn = document.createElement('button');
    btn.className = 'seg-btn';
    btn.dataset.cat = nome;
    btn.textContent = nome;
    if (categoriaSelecionada === nome) btn.classList.add('selecionado');
    btn.addEventListener('click', () => selecionarCategoria(nome));
    categoriasGrid.appendChild(btn);
  });

  atualizarBotoes();
}

function selecionarCategoria(nome) {
  categoriaSelecionada = nome;
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('selecionado', b.dataset.cat === nome);
  });
  plusLabel.textContent = nome;
  atualizarBotoes();
}

function atualizarBotoes() {
  const desabilitado = !categoriaSelecionada || !visitaAtiva;
  btnMaisUm.disabled = desabilitado;
  btnRegistrar.disabled = desabilitado;
  if (!categoriaSelecionada) plusLabel.textContent = 'Selecione a faixa';
}

/* ── Registrar ── */
async function registrar(quantidade) {
  if (!categoriaSelecionada || !visitaAtiva || quantidade < 1) return;

  const registro = {
    visitaId: visitaAtiva.id,
    categoria: categoriaSelecionada,
    quantidade,
    dataHora: new Date().toISOString(),
    observacao: inputObs.value.trim()
  };

  await adicionarRegistro(registro);
  vibrar();
  toast(`+${quantidade} ${categoriaSelecionada}`);
  inputQtd.value = '';
  inputObs.value = '';
  await atualizarTotal();
  await renderAreasTab();
}

async function atualizarTotal() {
  if (!visitaAtiva) {
    $('cnt-adulto').textContent = '0';
    $('cnt-jovem').textContent = '0';
    $('cnt-filhote').textContent = '0';
    totalNumero.textContent = '0';
    return;
  }

  const totais = await totaisDaVisita(visitaAtiva.id);
  $('cnt-adulto').textContent = totais.adulto;
  $('cnt-jovem').textContent = totais.jovem;
  $('cnt-filhote').textContent = totais.filhote;
  totalNumero.textContent = totais.adulto + totais.jovem + totais.filhote;
}

/* ══════════════════════════════════════════
   FOTOS (embutidas na contagem)
   ══════════════════════════════════════════ */

function redimensionarImagem(dataUrl, maxLado) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxLado || h > maxLado) {
        if (w > h) { h = Math.round(h * maxLado / w); w = maxLado; }
        else       { w = Math.round(w * maxLado / h); h = maxLado; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

async function salvarFoto(file) {
  if (!visitaAtiva) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = await redimensionarImagem(e.target.result, 1200);
    const legenda = $('input-legenda-foto').value.trim();
    await adicionarFoto({
      visitaId: visitaAtiva.id,
      dataUrl,
      legenda,
      latitude: gpsAtual.latitude,
      longitude: gpsAtual.longitude,
      dataHora: new Date().toISOString()
    });
    $('input-legenda-foto').value = '';
    vibrar();
    toast('Foto salva');
    renderGaleria();
  };
  reader.readAsDataURL(file);
}

async function renderGaleria() {
  const galeria = $('galeria-fotos');
  const semFotos = $('sem-fotos');
  galeria.innerHTML = '';

  if (!visitaAtiva) {
    semFotos.style.display = '';
    return;
  }

  const fotos = await listarFotosDaVisita(visitaAtiva.id);

  if (fotos.length === 0) {
    semFotos.style.display = '';
    return;
  }
  semFotos.style.display = 'none';

  fotos.forEach(f => {
    const div = document.createElement('div');
    div.className = 'foto-card';
    const hora = new Date(f.dataHora).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    div.innerHTML = `
      <img src="${f.dataUrl}" alt="Foto">
      <div class="foto-info">
        ${f.legenda ? `<div class="foto-legenda">${f.legenda}</div>` : ''}
        <div class="foto-hora">${hora}</div>
      </div>
      <button class="btn-deletar-foto" data-id="${f.id}">Remover</button>
    `;
    galeria.appendChild(div);
  });
}

/* ══════════════════════════════════════════
   ABA HISTORICO
   ══════════════════════════════════════════ */

async function renderHistorico() {
  const data = inputData.value ? inputData.value : new Date().toISOString().slice(0, 10);
  const visitas = await listarVisitasDoDia(data);
  const container = $('historico-conteudo');
  container.innerHTML = '';

  if (visitas.length === 0) {
    container.innerHTML = '<p class="sem-registros">Nenhum registro neste dia.</p>';
    return;
  }

  for (const v of visitas) {
    const area = await db.areas.get(v.areaId);
    const nomeArea = area ? area.nome : 'Area desconhecida';
    const registros = await listarRegistrosDaVisita(v.id);
    const fotos = await listarFotosDaVisita(v.id);
    const totais = await totaisDaVisita(v.id);
    const total = totais.adulto + totais.jovem + totais.filhote;

    const bloco = document.createElement('div');
    bloco.className = 'historico-area-bloco';

    // Header da area
    let headerHtml = `
      <div class="historico-area-header">
        <span class="historico-area-nome">${nomeArea}</span>
        <span class="historico-area-total">${total} capivaras</span>
      </div>
      <div class="historico-area-totais">
        <span class="mini-badge adulto">${totais.adulto} Ad</span>
        <span class="mini-badge jovem">${totais.jovem} Jv</span>
        <span class="mini-badge filhote">${totais.filhote} Fl</span>
      </div>
    `;

    // Lista de registros
    let regsHtml = '';
    if (registros.length > 0) {
      regsHtml = '<ul class="lista-registros">';
      registros.forEach(r => {
        const hora = new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        regsHtml += `
          <li class="registro-item">
            <span class="cat-badge" style="background:${corCategoria(r.categoria)}">${r.categoria}</span>
            <div class="info">
              <span class="qtd">${r.quantidade}</span>
              <span class="hora">${hora}</span>
              ${r.observacao ? `<div class="obs-texto">${r.observacao}</div>` : ''}
            </div>
            <button class="btn-deletar" data-id="${r.id}">Remover</button>
          </li>
        `;
      });
      regsHtml += '</ul>';
    }

    // Thumbnails de fotos
    let fotosHtml = '';
    if (fotos.length > 0) {
      fotosHtml = '<div class="historico-fotos-strip">';
      fotos.forEach(f => {
        fotosHtml += `<img src="${f.dataUrl}" class="historico-thumb" alt="Foto">`;
      });
      fotosHtml += '</div>';
    }

    bloco.innerHTML = headerHtml + regsHtml + fotosHtml;
    container.appendChild(bloco);
  }
}

/* ══════════════════════════════════════════
   TABS
   ══════════════════════════════════════════ */

function irParaTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('visivel'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('ativo');
  document.getElementById(tabId).classList.add('visivel');
}

function iniciarTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      irParaTab(btn.dataset.tab);

      if (btn.dataset.tab === 'areas') renderAreasTab();
      if (btn.dataset.tab === 'historico') renderHistorico();
      if (btn.dataset.tab === 'contagem') {
        atualizarBannerArea();
        atualizarTotal();
        renderGaleria();
      }
    });
  });
}

/* ══════════════════════════════════════════
   EVENTOS
   ══════════════════════════════════════════ */

function iniciarEventos() {
  // +1
  btnMaisUm.addEventListener('click', () => registrar(1));

  // Registrar quantidade
  btnRegistrar.addEventListener('click', () => {
    const qtd = parseInt(inputQtd.value, 10);
    if (qtd > 0) registrar(qtd);
  });

  inputQtd.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const qtd = parseInt(inputQtd.value, 10);
      if (qtd > 0) registrar(qtd);
    }
  });

  // Filtro historico
  $('btn-filtrar-data').addEventListener('click', renderHistorico);

  // Deletar registro no historico
  $('historico-conteudo').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-deletar');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (confirm('Deletar este registro?')) {
      await deletarRegistro(id);
      await renderHistorico();
      await atualizarTotal();
      await renderAreasTab();
      toast('Registro deletado');
    }
  });

  // Criar area
  $('btn-criar-area').addEventListener('click', async () => {
    const nome = $('input-nova-area').value.trim();
    if (!nome) return;
    await criarArea(nome);
    $('input-nova-area').value = '';
    toast('Area criada');
    await renderAreasTab();
  });

  $('input-nova-area').addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const nome = $('input-nova-area').value.trim();
      if (!nome) return;
      await criarArea(nome);
      $('input-nova-area').value = '';
      toast('Area criada');
      await renderAreasTab();
    }
  });

  // Click em area chip → selecionar area
  $('area-chips').addEventListener('click', async e => {
    // Deletar area
    const delBtn = e.target.closest('.chip-del');
    if (delBtn) {
      e.stopPropagation();
      const areaId = Number(delBtn.dataset.delArea);
      if (confirm('Remover esta area e todas suas visitas?')) {
        await deletarArea(areaId);
        if (areaAtiva && areaAtiva.id === areaId) {
          areaAtiva = null;
          visitaAtiva = null;
          atualizarBannerArea();
        }
        toast('Area removida');
        await renderAreasTab();
      }
      return;
    }
    // Selecionar area
    const chip = e.target.closest('.area-chip');
    if (chip) {
      const areaId = Number(chip.dataset.areaId);
      await selecionarArea(areaId);
    }
  });

  // Click em visita card → continuar
  $('visitas-hoje').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-continuar');
    if (!btn) return;
    const visitaId = Number(btn.dataset.visitaId);
    const areaId = Number(btn.dataset.areaId);
    await continuarVisita(visitaId, areaId);
  });

  // Trocar area
  $('btn-trocar-area').addEventListener('click', () => {
    irParaTab('areas');
  });

  // Fotos
  $('input-foto').addEventListener('change', e => {
    if (e.target.files[0]) salvarFoto(e.target.files[0]);
    e.target.value = '';
  });

  $('galeria-fotos').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-deletar-foto');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (confirm('Remover esta foto?')) {
      await deletarFoto(id);
      renderGaleria();
      toast('Foto removida');
    }
  });

  // Exportacao
  $('btn-export-hoje').addEventListener('click', () => exportarCSV('hoje'));
  $('btn-export-semana').addEventListener('click', () => exportarCSV('semana'));
  $('btn-export-todos').addEventListener('click', () => exportarCSV('todos'));
  $('btn-gerar-laudo').addEventListener('click', gerarLaudo);
}

/* ── Service Worker ── */
function registrarSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
}

/* ── Init ── */
async function init() {
  registrarSW();
  iniciarGPS();
  iniciarTabs();
  renderCategorias();
  iniciarEventos();
  await renderAreasTab();
  atualizarBannerArea();

  inputData.value = new Date().toISOString().slice(0, 10);
}

document.addEventListener('DOMContentLoaded', init);
