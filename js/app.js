/* ── Estado ── */
let categoriaSelecionada = null;
let gpsAtual = { latitude: null, longitude: null, precisao: null };
let watchId = null;

/* ── Elementos ── */
const $ = id => document.getElementById(id);

const categoriasGrid   = $('categorias-grid');
const btnMaisUm        = $('btn-mais-um');
const inputQtd         = $('input-qtd');
const btnRegistrar     = $('btn-registrar');
const inputObs         = $('input-obs');
const totalNumero      = $('total-numero');
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
  return CORES[nome] || '#455a64';
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
      gpsDot.classList.add('ativo');
      gpsTexto.textContent = `GPS ±${gpsAtual.precisao}m`;
    },
    () => {
      gpsDot.classList.remove('ativo');
      gpsTexto.textContent = 'GPS inativo';
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

/* ── Faixas etárias UI ── */
function renderCategorias() {
  categoriasGrid.innerHTML = '';

  FAIXAS.forEach(nome => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
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
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('selecionado', b.dataset.cat === nome);
  });
  atualizarBotoes();
}

function atualizarBotoes() {
  const desabilitado = !categoriaSelecionada;
  btnMaisUm.disabled = desabilitado;
  btnRegistrar.disabled = desabilitado;
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
  const total = await totalDoDia(new Date());
  totalNumero.textContent = total;
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
      <button class="btn-deletar" data-id="${r.id}">&#10005;</button>
    `;
    listaRegistros.appendChild(li);
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

  $('btn-export-hoje').addEventListener('click', () => exportarCSV('hoje'));
  $('btn-export-semana').addEventListener('click', () => exportarCSV('semana'));
  $('btn-export-todos').addEventListener('click', () => exportarCSV('todos'));
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
