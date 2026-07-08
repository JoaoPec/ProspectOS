const listaLeads = document.getElementById("lista-leads");
const contador = document.getElementById("contador");
const dashboard = document.getElementById("dashboard");
const faixaErro = document.getElementById("faixa-erro");
const filtroBusca = document.getElementById("filtro-busca");
const filtroStatus = document.getElementById("filtro-status");
const filtroNicho = document.getElementById("filtro-nicho");
const filtroNota = document.getElementById("filtro-nota");

let leadAtual = null;
let filtrosEmUso = false;

function labelBadge(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function mostrarErro(mensagem) {
  faixaErro.textContent = mensagem;
  faixaErro.classList.remove("escondido");
  setTimeout(() => faixaErro.classList.add("escondido"), 6000);
}

async function chamarApi(url, opcoes) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch (erro) {
    mostrarErro("Não foi possível falar com o servidor. Confira se o `py app.py` ainda está rodando.");
    throw erro;
  }

  if (!resposta.ok) {
    let mensagem = `Erro do servidor (${resposta.status}).`;
    try {
      const dados = await resposta.clone().json();
      if (dados.erro) mensagem = dados.erro;
    } catch {
      // resposta não era JSON (ex: erro cru do servidor) - mantém mensagem genérica
    }
    mostrarErro(mensagem);
  }

  return resposta;
}

async function carregarNichos() {
  const resposta = await chamarApi("/api/nichos");
  if (!resposta.ok) return;
  const nichos = await resposta.json();
  filtroNicho.innerHTML = '<option value="">Todos os nichos</option>' +
    nichos.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
}

async function carregarMetricas() {
  const resposta = await chamarApi("/api/metricas");
  if (!resposta.ok) return;
  const m = await resposta.json();

  const porStatus = m.por_status || {};
  dashboard.innerHTML = `
    <div class="stat-tile">
      <div class="valor">${m.total}</div>
      <div class="rotulo">Leads ativos</div>
    </div>
    <div class="stat-tile">
      <div class="valor">${porStatus.contatado || 0}</div>
      <div class="rotulo">Contatados</div>
    </div>
    <div class="stat-tile">
      <div class="valor">${porStatus.respondeu || 0}</div>
      <div class="rotulo">Responderam</div>
    </div>
    <div class="stat-tile destaque">
      <div class="valor">${porStatus.fechou || 0}</div>
      <div class="rotulo">Fechados</div>
    </div>
    <div class="stat-tile destaque">
      <div class="valor">${m.taxa_conversao}%</div>
      <div class="rotulo">Taxa de conversão</div>
    </div>
    <div class="stat-tile ${m.lembretes_hoje > 0 ? "alerta" : ""}">
      <div class="valor">${m.lembretes_hoje}</div>
      <div class="rotulo">Follow-ups p/ hoje</div>
    </div>
  `;
}

async function carregarLeads() {
  const parametros = new URLSearchParams();
  if (filtroBusca.value) parametros.set("busca", filtroBusca.value);
  if (filtroStatus.value) parametros.set("status", filtroStatus.value);
  if (filtroNicho.value) parametros.set("nicho", filtroNicho.value);
  if (filtroNota.value) parametros.set("nota_min", filtroNota.value);

  filtrosEmUso = Boolean(filtroBusca.value || filtroStatus.value || filtroNicho.value || filtroNota.value);

  listaLeads.innerHTML = '<div class="carregando">Carregando...</div>';

  const resposta = await chamarApi(`/api/leads?${parametros.toString()}`);
  if (!resposta.ok) {
    listaLeads.innerHTML = '<div class="vazio">Não foi possível carregar os leads agora.</div>';
    return;
  }
  const leads = await resposta.json();

  contador.textContent = `${leads.length} lead(s) encontrado(s)`;

  if (leads.length === 0) {
    if (filtrosEmUso) {
      listaLeads.innerHTML = `
        <div class="vazio">
          Nenhum lead bate com esse filtro.
          <br><button id="btn-limpar-filtros-vazio" class="botao">Limpar filtros</button>
        </div>`;
      document.getElementById("btn-limpar-filtros-vazio").addEventListener("click", limparFiltros);
    } else {
      listaLeads.innerHTML = '<div class="vazio">Você ainda não fez nenhuma busca. Clique em "+ Nova busca" para começar.</div>';
    }
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);

  listaLeads.innerHTML = leads.map((lead) => {
    const vencido = lead.proximo_followup && lead.proximo_followup <= hoje;
    const tags = (lead.tags || "").split(",").map((t) => t.trim()).filter(Boolean);

    return `
    <div class="card-lead ${vencido ? "followup-vencido" : ""}" data-place-id="${escapeHtml(lead.place_id)}">
      <h3>${escapeHtml(lead.nome)}</h3>
      <div class="categoria">${escapeHtml(lead.categoria || "Sem categoria")}</div>
      <div class="endereco">${escapeHtml(lead.endereco || "")}</div>
      ${tags.length ? `<div class="chips">${tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      ${vencido ? '<div class="lembrete-badge">⏰ Follow-up para hoje</div>' : ""}
      <div class="rodape">
        <span class="nota">★ ${lead.nota?.toFixed(1) ?? "-"} (${lead.num_avaliacoes ?? 0})</span>
        <span class="badge badge-${lead.status}">${labelBadge(lead.status)}</span>
      </div>
    </div>
  `;
  }).join("");

  listaLeads.querySelectorAll(".card-lead").forEach((card) => {
    card.addEventListener("click", () => abrirLead(card.dataset.placeId, leads));
  });
}

function limparFiltros() {
  filtroBusca.value = "";
  filtroStatus.value = "";
  filtroNicho.value = "";
  filtroNota.value = "";
  carregarLeads();
}

document.getElementById("btn-limpar-filtros").addEventListener("click", limparFiltros);

async function abrirLead(placeId, leads) {
  const lead = leads.find((l) => l.place_id === placeId);
  if (!lead) return;

  leadAtual = lead;

  document.getElementById("lead-nome").textContent = lead.nome;
  document.getElementById("lead-info").textContent =
    `${lead.categoria || "Sem categoria"} · ${lead.endereco || "sem endereço"} · nota ${lead.nota?.toFixed(1) ?? "-"}`;

  const selectStatus = document.getElementById("lead-status");
  selectStatus.innerHTML = Array.from(filtroStatus.options)
    .filter((o) => o.value)
    .map((o) => `<option value="${o.value}" ${o.value === lead.status ? "selected" : ""}>${labelBadge(o.value)}</option>`)
    .join("");

  document.getElementById("lead-tags").value = lead.tags || "";
  document.getElementById("lead-followup").value = lead.proximo_followup || "";
  document.getElementById("lead-observacoes").value = lead.observacoes || "";
  document.getElementById("lead-mensagem").value = lead.mensagem_gerada || "";

  document.getElementById("modal-lead").classList.remove("escondido");

  carregarHistorico(placeId);
}

async function carregarHistorico(placeId) {
  const historicoDiv = document.getElementById("lead-historico");
  historicoDiv.innerHTML = "Carregando...";

  const resposta = await chamarApi(`/api/leads/${encodeURIComponent(placeId)}/historico`);
  if (!resposta.ok) {
    historicoDiv.innerHTML = "Não foi possível carregar o histórico.";
    return;
  }
  const itens = await resposta.json();

  if (itens.length === 0) {
    historicoDiv.innerHTML = "Nenhuma mudança de status registrada ainda.";
    return;
  }

  historicoDiv.innerHTML = itens.map((item) => `
    <div class="historico-item">
      ${escapeHtml(item.status_anterior || "—")} → ${escapeHtml(item.status_novo)}
      <br><small>${escapeHtml(item.alterado_em)}</small>
    </div>
  `).join("");
}

document.getElementById("btn-fechar-lead").addEventListener("click", () => {
  document.getElementById("modal-lead").classList.add("escondido");
  carregarLeads();
  carregarMetricas();
});

document.getElementById("lead-status").addEventListener("change", async (evento) => {
  await chamarApi(`/api/leads/${encodeURIComponent(leadAtual.place_id)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: evento.target.value }),
  });
});

document.getElementById("btn-salvar-tags-followup").addEventListener("click", async () => {
  const tags = document.getElementById("lead-tags").value;
  const followup = document.getElementById("lead-followup").value;

  await chamarApi(`/api/leads/${encodeURIComponent(leadAtual.place_id)}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  await chamarApi(`/api/leads/${encodeURIComponent(leadAtual.place_id)}/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proximo_followup: followup || null }),
  });
});

document.getElementById("btn-salvar-observacoes").addEventListener("click", async () => {
  const texto = document.getElementById("lead-observacoes").value;
  await chamarApi(`/api/leads/${encodeURIComponent(leadAtual.place_id)}/observacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observacoes: texto }),
  });
});

document.getElementById("btn-gerar-mensagem").addEventListener("click", async () => {
  const botao = document.getElementById("btn-gerar-mensagem");
  const campoMensagem = document.getElementById("lead-mensagem");
  const jaTinhaMensagem = campoMensagem.value.trim().length > 0;

  botao.disabled = true;
  botao.textContent = "Gerando...";

  try {
    const resposta = await chamarApi(`/api/leads/${encodeURIComponent(leadAtual.place_id)}/gerar-mensagem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forcar_nova: jaTinhaMensagem }),
    });
    const dados = await resposta.json();

    if (dados.erro) {
      mostrarErro(dados.erro);
    } else {
      campoMensagem.value = dados.mensagem;
      if (dados.avisos && dados.avisos.length > 0) {
        // um ou mais provedores falharam antes de conseguir gerar com outro
        mostrarErro(`${dados.avisos.join(" ")} Mensagem gerada com ${dados.provedor}.`);
      }
    }
  } finally {
    botao.disabled = false;
    botao.textContent = "✨ Gerar mensagem";
  }
});

document.getElementById("btn-copiar-mensagem").addEventListener("click", async () => {
  const texto = document.getElementById("lead-mensagem").value;
  if (!texto) return;
  await navigator.clipboard.writeText(texto);
  const botao = document.getElementById("btn-copiar-mensagem");
  const textoOriginal = botao.textContent;
  botao.textContent = "Copiado!";
  setTimeout(() => (botao.textContent = textoOriginal), 1500);
});

document.getElementById("btn-copiar-whatsapp").addEventListener("click", async () => {
  const telefone = leadAtual?.telefone;
  if (!telefone) return;
  await navigator.clipboard.writeText(telefone);
  const botao = document.getElementById("btn-copiar-whatsapp");
  const textoOriginal = botao.textContent;
  botao.textContent = "Copiado!";
  setTimeout(() => (botao.textContent = textoOriginal), 1500);
});

document.getElementById("btn-excluir-lead").addEventListener("click", async () => {
  const confirmado = confirm(
    `Excluir "${leadAtual.nome}"? Ele não vai mais aparecer na sua lista, nem em buscas futuras do mesmo nicho/cidade.`
  );
  if (!confirmado) return;

  await chamarApi(`/api/leads/${encodeURIComponent(leadAtual.place_id)}/ignorar`, {
    method: "POST",
  });

  document.getElementById("modal-lead").classList.add("escondido");
  carregarLeads();
  carregarMetricas();
});

// --- Nova busca ---

const modalBusca = document.getElementById("modal-busca");
const btnNovaBusca = document.getElementById("btn-nova-busca");
const btnCancelarBusca = document.getElementById("btn-cancelar-busca");
const btnMinimizarBusca = document.getElementById("btn-minimizar-busca");
const indicadorFlutuante = document.getElementById("indicador-busca-flutuante");
const indicadorFlutuanteTexto = document.getElementById("indicador-busca-texto");

btnNovaBusca.addEventListener("click", () => {
  modalBusca.classList.remove("escondido");
});

btnCancelarBusca.addEventListener("click", () => {
  modalBusca.classList.add("escondido");
});

btnMinimizarBusca.addEventListener("click", () => {
  // só esconde o modal - a busca continua rodando no servidor normalmente
  modalBusca.classList.add("escondido");
  indicadorFlutuante.classList.remove("escondido");
});

indicadorFlutuante.addEventListener("click", () => {
  // reabre o modal pra ver o progresso completo de novo
  indicadorFlutuante.classList.add("escondido");
  modalBusca.classList.remove("escondido");
});

document.getElementById("btn-confirmar-busca").addEventListener("click", async () => {
  const queries = document.getElementById("texto-queries").value.trim();
  const statusBusca = document.getElementById("status-busca");

  if (!queries) {
    statusBusca.textContent = "Escreva ao menos um nicho + cidade.";
    return;
  }

  const resposta = await chamarApi("/api/buscar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  const dados = await resposta.json();

  if (dados.erro) {
    statusBusca.textContent = dados.erro;
    return;
  }

  statusBusca.textContent = "Busca iniciada, isso pode levar alguns minutos...";
  btnNovaBusca.disabled = true;
  btnNovaBusca.textContent = "Buscando...";
  btnCancelarBusca.classList.add("escondido");
  btnMinimizarBusca.classList.remove("escondido");
  document.getElementById("progresso-busca").classList.remove("escondido");
  acompanharBusca();
});

function acompanharBusca() {
  const statusBusca = document.getElementById("status-busca");
  const progressoTexto = document.getElementById("progresso-texto");
  const progressoBarra = document.getElementById("progresso-barra");

  const intervalo = setInterval(async () => {
    const resposta = await chamarApi("/api/buscar/status");
    if (!resposta.ok) {
      clearInterval(intervalo);
      return;
    }
    const estado = await resposta.json();

    statusBusca.textContent = estado.mensagem;
    if (!indicadorFlutuante.classList.contains("escondido")) {
      indicadorFlutuanteTexto.textContent = estado.mensagem;
    }

    if (estado.etapa === "scraping") {
      progressoTexto.textContent =
        `Encontradas ${estado.empresas_encontradas} · Processadas ${estado.empresas_processadas}`;
      progressoBarra.classList.add("indeterminada");
      progressoBarra.style.width = "";
    } else if (estado.etapa === "verificando_sites") {
      progressoBarra.classList.remove("indeterminada");
      const total = estado.empresas_encontradas || 1;
      const pct = Math.min(100, Math.round((estado.empresas_processadas / total) * 100));
      progressoBarra.style.width = `${pct}%`;
      progressoTexto.textContent =
        `Verificando site: ${estado.empresas_processadas} de ${estado.empresas_encontradas}`;
    } else {
      progressoTexto.textContent = "";
      progressoBarra.classList.remove("indeterminada");
      progressoBarra.style.width = "0%";
    }

    if (!estado.rodando) {
      clearInterval(intervalo);
      btnNovaBusca.disabled = false;
      btnNovaBusca.textContent = "+ Nova busca";
      btnCancelarBusca.classList.remove("escondido");
      btnMinimizarBusca.classList.add("escondido");
      indicadorFlutuante.classList.add("escondido");
      document.getElementById("progresso-busca").classList.add("escondido");
      setTimeout(() => {
        modalBusca.classList.add("escondido");
        document.getElementById("texto-queries").value = "";
        carregarNichos();
        carregarLeads();
        carregarMetricas();
      }, 1500);
    }
  }, 2000);
}

// --- filtros ---

[filtroBusca, filtroStatus, filtroNicho, filtroNota].forEach((elemento) => {
  elemento.addEventListener("input", carregarLeads);
  elemento.addEventListener("change", carregarLeads);
});

carregarNichos();
carregarLeads();
carregarMetricas();
