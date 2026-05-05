const inputBusca = document.querySelector("#busca");
const listaResultados = document.querySelector("#lista-resultados");
const mensagemStatus = document.querySelector("#mensagem-status");
const campoBusca = document.querySelector("#campo-busca");
const formBusca = campoBusca?.querySelector("form");
const botaoBusca = document.querySelector("#botao-busca");
const contadorStatus = document.querySelector("#contador-status");
const contadorDetalheTitulo = document.querySelector("#contador-detalhe-titulo");
const contadorDetalheValor = document.querySelector("#contador-detalhe-valor");
const horaBrasilia = document.querySelector("#hora-brasilia");

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});
const formatadorHoraBrasilia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const TAMANHO_MINIMO_BUSCA = 2;

const HORARIOS_FUNCIONAMENTO = {
  0: { dia: "domingo", abre: "11:00", fecha: "17:00" },
  1: { dia: "segunda-feira", abre: null, fecha: null },
  2: { dia: "terca-feira", abre: "14:00", fecha: "23:00" },
  3: { dia: "quarta-feira", abre: "14:00", fecha: "23:00" },
  4: { dia: "quinta-feira", abre: "14:00", fecha: "23:00" },
  5: { dia: "sexta-feira", abre: "14:00", fecha: "23:00" },
  6: { dia: "sabado", abre: "11:00", fecha: "23:00" }
};

let controladorRequisicao = null;
let ultimaBusca = "";

function converterHorarioParaSegundos(horario) {
  const [hora, minuto] = String(horario ?? "")
    .split(":")
    .map((valor) => Number(valor));
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) {
    return null;
  }

  return hora * 3600 + minuto * 60;
}

function formatarDuracao(segundosEntrada) {
  const totalSegundos = Math.max(0, Math.floor(Number(segundosEntrada) || 0));
  const horas = String(Math.floor(totalSegundos / 3600)).padStart(2, "0");
  const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0");
  const segundos = String(totalSegundos % 60).padStart(2, "0");
  return `${horas}:${minutos}:${segundos}`;
}

function criarDataComHorario(dataBase, horarioTexto) {
  const [hora, minuto] = String(horarioTexto ?? "")
    .split(":")
    .map((valor) => Number(valor));
  const data = new Date(dataBase);
  data.setHours(hora || 0, minuto || 0, 0, 0);
  return data;
}

function obterSegundosDiaAtual(agora) {
  return agora.getHours() * 3600 + agora.getMinutes() * 60 + agora.getSeconds();
}

function obterProximaAbertura(agora) {
  const diaAtual = agora.getDay();
  const segundosHoje = obterSegundosDiaAtual(agora);

  for (let deslocamento = 0; deslocamento <= 7; deslocamento += 1) {
    const diaBusca = (diaAtual + deslocamento) % 7;
    const horarioDia = HORARIOS_FUNCIONAMENTO[diaBusca];

    if (!horarioDia?.abre || !horarioDia?.fecha) {
      continue;
    }

    const segundosAbertura = converterHorarioParaSegundos(horarioDia.abre);
    const segundosFechamento = converterHorarioParaSegundos(horarioDia.fecha);

    if (deslocamento === 0) {
      if (segundosHoje < segundosAbertura) {
        return {
          deslocamento,
          diaBusca,
          horarioDia,
          alvo: criarDataComHorario(agora, horarioDia.abre)
        };
      }

      if (segundosHoje >= segundosAbertura && segundosHoje < segundosFechamento) {
        return null;
      }

      continue;
    }

    const base = new Date(agora);
    base.setDate(base.getDate() + deslocamento);
    return {
      deslocamento,
      diaBusca,
      horarioDia,
      alvo: criarDataComHorario(base, horarioDia.abre)
    };
  }

  return null;
}

function atualizarPainelFuncionamento() {
  if (!contadorStatus || !contadorDetalheTitulo || !contadorDetalheValor) {
    return;
  }

  const agora = new Date();
  const diaAtual = agora.getDay();
  const horarioDia = HORARIOS_FUNCIONAMENTO[diaAtual];
  const segundosHoje = obterSegundosDiaAtual(agora);

  if (horarioDia?.abre && horarioDia?.fecha) {
    const segundosAbertura = converterHorarioParaSegundos(horarioDia.abre);
    const segundosFechamento = converterHorarioParaSegundos(horarioDia.fecha);

    if (segundosHoje >= segundosAbertura && segundosHoje < segundosFechamento) {
      const faltamSegundos = segundosFechamento - segundosHoje;
      contadorStatus.textContent = `Fecha em: ${formatarDuracao(faltamSegundos)}`;
      contadorDetalheTitulo.textContent = "Horario de hoje:";
      contadorDetalheValor.textContent = `${horarioDia.abre}–${horarioDia.fecha}`;
      return;
    }
  }

  const proximaAbertura = obterProximaAbertura(agora);
  if (!proximaAbertura) {
    contadorStatus.textContent = "Loja fechada no momento.";
    contadorDetalheTitulo.textContent = "Proxima abertura:";
    contadorDetalheValor.textContent = "Indisponivel";
    return;
  }

  const faltamSegundos = Math.max(
    0,
    Math.floor((proximaAbertura.alvo.getTime() - agora.getTime()) / 1000)
  );
  const referenciaDia =
    proximaAbertura.deslocamento === 0 ? "hoje" : proximaAbertura.horarioDia.dia;

  contadorStatus.textContent = `Abre em: ${formatarDuracao(faltamSegundos)}`;
  contadorDetalheTitulo.textContent = "Proxima abertura:";
  contadorDetalheValor.textContent = `${referenciaDia} as ${proximaAbertura.horarioDia.abre}`;
}

function atualizarHoraBrasilia() {
  if (!horaBrasilia) {
    return;
  }

  horaBrasilia.textContent = formatadorHoraBrasilia.format(new Date());
}

function normalizarTexto(texto) {
  return String(texto ?? "").trim();
}

function definirMensagem(texto, tipo = "info") {
  if (!mensagemStatus) {
    return;
  }

  mensagemStatus.textContent = texto;
  mensagemStatus.style.color = "#EEEEEE";
}

function abrirDropdown() {
  listaResultados.classList.remove("hidden");
  inputBusca.setAttribute("aria-expanded", "true");
}

function fecharDropdown() {
  listaResultados.classList.add("hidden");
  inputBusca.setAttribute("aria-expanded", "false");
}

function limparResultados() {
  listaResultados.innerHTML = "";
  fecharDropdown();
}

function renderizarMensagemDropdown(texto) {
  listaResultados.innerHTML = `<li class="px-4 py-2.5 text-sm" style="color: #EEEEEE">${texto}</li>`;
  abrirDropdown();
}

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return "Preco indisponivel";
  }

  return formatadorMoeda.format(numero);
}

function renderizarResultados(lista) {
  const resultados = Array.isArray(lista) ? lista : [];

  if (resultados.length === 0) {
    renderizarMensagemDropdown("Nenhum produto encontrado para essa busca.");
    return;
  }

  const html = resultados
    .map((produto) => {
      const nome = String(produto.nome ?? "Produto sem nome");
      const preco = formatarPreco(produto.precoVenda);
      return `
        <li>
          <div class="flex w-full items-start justify-between gap-4 border-b px-4 py-2.5 text-left text-sm" style="color: #EEEEEE; border-color: #343434; background-color: #1A1A1A">
            <span class="whitespace-normal break-words leading-5" style="color: #EEEEEE">${nome}</span>
            <span class="shrink-0 self-center font-medium" style="color: #EEEEEE">${preco}</span>
          </div>
        </li>
      `;
    })
    .join("");

  listaResultados.innerHTML = html;
  abrirDropdown();
}

async function buscarProdutos(termo) {
  if (controladorRequisicao) {
    controladorRequisicao.abort();
  }

  controladorRequisicao = new AbortController();

  const resposta = await fetch(`/api/precos?termo=${encodeURIComponent(termo)}`, {
    method: "GET",
    signal: controladorRequisicao.signal
  });

  if (!resposta.ok) {
    const dadosErro = await resposta.json().catch(() => ({}));
    throw new Error(dadosErro.mensagem || "Falha ao consultar os produtos.");
  }

  const dados = await resposta.json();
  return Array.isArray(dados?.items) ? dados.items : [];
}

async function executarBusca(termoDigitado) {
  const termo = normalizarTexto(termoDigitado);
  ultimaBusca = termo;

  if (termo.length < TAMANHO_MINIMO_BUSCA) {
    limparResultados();
    definirMensagem(`Digite pelo menos ${TAMANHO_MINIMO_BUSCA} caracteres.`);
    return;
  }

  renderizarMensagemDropdown("Buscando produtos...");
  definirMensagem("Consultando preco atualizado...");

  try {
    const produtos = await buscarProdutos(termo);

    if (ultimaBusca !== termo) {
      return;
    }

    renderizarResultados(produtos);
    definirMensagem(`${produtos.length} resultado(s) encontrado(s).`);
  } catch (erro) {
    if (erro.name === "AbortError") {
      return;
    }

    limparResultados();
    definirMensagem(erro.message || "Erro ao consultar produtos.", "erro");
  }
}

formBusca?.addEventListener("submit", (evento) => {
  evento.preventDefault();
  executarBusca(inputBusca.value).finally(() => {
    botaoBusca?.blur();
  });
});

inputBusca.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    limparResultados();
  }
});

document.addEventListener("click", (evento) => {
  if (!campoBusca.contains(evento.target)) {
    fecharDropdown();
  }
});

definirMensagem(`Digite pelo menos ${TAMANHO_MINIMO_BUSCA} caracteres.`);
atualizarPainelFuncionamento();
atualizarHoraBrasilia();
setInterval(() => {
  atualizarPainelFuncionamento();
  atualizarHoraBrasilia();
}, 1000);
