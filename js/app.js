/* ── Estado ── */
let categoriaSelecionada = null;
let gpsAtual = { latitude: null, longitude: null, precisao: null };
let watchId = null;

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
const listaRegistros   = $('lista-registros');
const inputData        = $('input-data');

/* ── Cores por faixa etária ── */
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

/* ── Vibração ── */
function vibrar() {
  if (navigator.vibrate) navigator.vibrate(50);
}

/* ── GPS ── */
function iniciarGPS() {
  if (!('geolocation' in navigator)) {
    gpsTexto.textContent = 'GPS indisponível';
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    pos => {
      gpsAtual.latitude = pos.coords.latitude;
      gpsAtual.longitude = pos.coords.longitude;
      gpsAtual.precisao = Math.round(pos.coords.accuracy);
      gpsBadge.classList.remove('inativo');
      gpsBadge.classList.add('ativo');
      gpsTexto.textContent = `GPS ±${gpsAtual.precisao}m`;
    },
    () => {
      gpsBadge.classList.remove('ativo');
      gpsBadge.classList.add('inativo');
      gpsTexto.textContent = 'GPS inativo';
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
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
  const desabilitado = !categoriaSelecionada;
  btnMaisUm.disabled = desabilitado;
  btnRegistrar.disabled = desabilitado;
  if (desabilitado) plusLabel.textContent = 'Selecione a faixa';
}

/* ── Registrar ── */
async function registrar(quantidade) {
  if (!categoriaSelecionada || quantidade < 1) return;

  const registro = {
    categoria: categoriaSelecionada,
    quantidade,
    latitude: gpsAtual.latitude,
    longitude: gpsAtual.longitude,
    precisaoGPS: gpsAtual.precisao,
    dataHora: new Date().toISOString(),
    observacao: inputObs.value.trim(),
    sincronizado: false
  };

  await adicionarRegistro(registro);
  vibrar();
  toast(`+${quantidade} ${categoriaSelecionada}`);
  inputQtd.value = '';
  inputObs.value = '';
  await atualizarTotal();
}

async function atualizarTotal() {
  const registros = await listarRegistrosDoDia(new Date());
  const adultos  = registros.filter(r => r.categoria === 'Adulto').reduce((s, r) => s + r.quantidade, 0);
  const jovens   = registros.filter(r => r.categoria === 'Jovem').reduce((s, r) => s + r.quantidade, 0);
  const filhotes = registros.filter(r => r.categoria === 'Filhote').reduce((s, r) => s + r.quantidade, 0);

  $('cnt-adulto').textContent = adultos;
  $('cnt-jovem').textContent = jovens;
  $('cnt-filhote').textContent = filhotes;
  totalNumero.textContent = adultos + jovens + filhotes;
}

/* ── Histórico ── */
async function renderHistorico() {
  const data = inputData.value ? new Date(inputData.value + 'T00:00:00') : new Date();
  const registros = await listarRegistrosDoDia(data);
  listaRegistros.innerHTML = '';

  if (registros.length === 0) {
    listaRegistros.innerHTML = '<li class="sem-registros">Nenhum registro neste dia.</li>';
    return;
  }

  registros.forEach(r => {
    const li = document.createElement('li');
    li.className = 'registro-item';

    const hora = new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    li.innerHTML = `
      <span class="cat-badge" style="background:${corCategoria(r.categoria)}">${r.categoria}</span>
      <div class="info">
        <span class="qtd">${r.quantidade}</span>
        <span class="hora">${hora}</span>
        ${r.observacao ? `<div class="obs-texto">${r.observacao}</div>` : ''}
      </div>
      <button class="btn-deletar" data-id="${r.id}">Remover</button>
    `;
    listaRegistros.appendChild(li);
  });
}

/* ── Fotos ── */
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
  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = await redimensionarImagem(e.target.result, 1200);
    const legenda = $('input-legenda-foto').value.trim();
    await adicionarFoto({
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
  const fotos = await listarTodasFotos();
  const galeria = $('galeria-fotos');
  const semFotos = $('sem-fotos');
  galeria.innerHTML = '';

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

/* ── Tabs ── */
function iniciarTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
      document.querySelectorAll('.secao').forEach(s => s.classList.remove('visivel'));
      btn.classList.add('ativo');
      document.getElementById(btn.dataset.tab).classList.add('visivel');

      if (btn.dataset.tab === 'historico') renderHistorico();
      if (btn.dataset.tab === 'fotos') renderGaleria();
    });
  });
}

/* ── Eventos ── */
function iniciarEventos() {
  btnMaisUm.addEventListener('click', () => registrar(1));

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

  $('btn-filtrar-data').addEventListener('click', renderHistorico);

  listaRegistros.addEventListener('click', async e => {
    const btn = e.target.closest('.btn-deletar');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (confirm('Deletar este registro?')) {
      await deletarRegistro(id);
      await renderHistorico();
      await atualizarTotal();
      toast('Registro deletado');
    }
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

  // Exportação
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
  await atualizarTotal();
  iniciarEventos();

  inputData.value = new Date().toISOString().slice(0, 10);
}

document.addEventListener('DOMContentLoaded', init);
