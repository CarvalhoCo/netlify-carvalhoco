const inputBusca = document.querySelector("#busca");
const listaResultados = document.querySelector("#lista-resultados");
const campoBusca = document.querySelector("#campo-busca");
const formBusca = campoBusca?.querySelector("form");
const botaoBusca = document.querySelector("#botao-busca");
const contadorStatus = document.querySelector("#contador-status");
const contadorDetalheTitulo = document.querySelector("#contador-detalhe-titulo");
const contadorDetalheValor = document.querySelector("#contador-detalhe-valor");
const horaBrasilia = document.querySelector("#hora-brasilia");
const marcaTopo = document.querySelector(".marca-inicial, .marca-busca");
const painelFuncionamentoAtivo = Boolean(
  contadorStatus && contadorDetalheTitulo && contadorDetalheValor
);

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
const CHAVE_CONFIG_HORARIOS_LOCAL = "carvalho_horarios_config";
const CARACTERES_RUIDO_MARCA = "!@#$%&*+-=<>?/\\|[]{}~^0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROTACAO_TEXTO_MARCA = ["Carvalho&Co.", "Adega & Tabacaria"];
const INTERVALO_ROTACAO_MARCA_MS = 10000;
const INTERVALO_QUADRO_SCRAMBLE_MARCA_MS = 34;
const PASSO_SCRAMBLE_MARCA = 1.15;
const ATRASO_CARREGAR_HORARIOS_MS = 400;

const HORARIOS_SEMANA_PADRAO = {
  0: { day: "domingo", closed: false, open: "11:00", close: "17:00" },
  1: { day: "segunda", closed: true, open: null, close: null },
  2: { day: "terça", closed: false, open: "14:00", close: "23:00" },
  3: { day: "quarta", closed: false, open: "14:00", close: "23:00" },
  4: { day: "quinta", closed: false, open: "14:00", close: "23:00" },
  5: { day: "sexta", closed: false, open: "14:00", close: "23:00" },
  6: { day: "sábado", closed: false, open: "11:00", close: "23:00" }
};

let controladorRequisicao = null;
let ultimaBusca = "";
let configuracaoHorarios = criarConfiguracaoPadraoHorarios();

function criarConfiguracaoPadraoHorarios() {
  return {
    weekly: JSON.parse(JSON.stringify(HORARIOS_SEMANA_PADRAO)),
    dateOverrides: []
  };
}

function obterChaveDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function horarioValido(horario) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(horario ?? ""));
}

function dataValida(dataTexto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataTexto ?? ""))) {
    return false;
  }

  const [ano, mes, dia] = dataTexto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

function normalizarConfiguracaoHorarios(entrada) {
  const base = criarConfiguracaoPadraoHorarios();
  const dados = entrada && typeof entrada === "object" ? entrada : {};
  const weeklyEntrada = dados.weekly && typeof dados.weekly === "object" ? dados.weekly : {};

  const weekly = {};
  Object.keys(base.weekly).forEach((chaveDia) => {
    const padraoDia = base.weekly[chaveDia];
    const item = weeklyEntrada[chaveDia] && typeof weeklyEntrada[chaveDia] === "object"
      ? weeklyEntrada[chaveDia]
      : {};

    const fechado = Boolean(item.closed);
    if (fechado) {
      weekly[chaveDia] = {
        day: padraoDia.day,
        closed: true,
        open: null,
        close: null
      };
      return;
    }

    const open = horarioValido(item.open) ? item.open : padraoDia.open;
    const close = horarioValido(item.close) ? item.close : padraoDia.close;

    if (!horarioValido(open) || !horarioValido(close)) {
      weekly[chaveDia] = JSON.parse(JSON.stringify(padraoDia));
      return;
    }

    if (converterHorarioParaSegundos(open) >= converterHorarioParaSegundos(close)) {
      weekly[chaveDia] = JSON.parse(JSON.stringify(padraoDia));
      return;
    }

    weekly[chaveDia] = {
      day: padraoDia.day,
      closed: false,
      open,
      close
    };
  });

  const overridesEntrada = Array.isArray(dados.dateOverrides) ? dados.dateOverrides : [];
  const mapa = new Map();

  overridesEntrada.forEach((item) => {
    const date = String(item?.date ?? "").trim();
    if (!dataValida(date)) {
      return;
    }

    const closed = Boolean(item?.closed);
    if (closed) {
      mapa.set(date, { date, closed: true, open: null, close: null });
      return;
    }

    const open = String(item?.open ?? "").trim();
    const close = String(item?.close ?? "").trim();
    if (!horarioValido(open) || !horarioValido(close)) {
      return;
    }

    if (converterHorarioParaSegundos(open) >= converterHorarioParaSegundos(close)) {
      return;
    }

    mapa.set(date, { date, closed: false, open, close });
  });

  return {
    weekly,
    dateOverrides: Array.from(mapa.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

function aplicarConfiguracaoHorarios(entrada) {
  configuracaoHorarios = normalizarConfiguracaoHorarios(entrada);
}

function lerConfigHorariosLocalCache() {
  try {
    const texto = localStorage.getItem(CHAVE_CONFIG_HORARIOS_LOCAL);
    if (!texto) {
      return null;
    }

    const dados = JSON.parse(texto);
    return normalizarConfiguracaoHorarios(dados);
  } catch {
    return null;
  }
}

function salvarConfigHorariosLocalCache(config) {
  try {
    localStorage.setItem(CHAVE_CONFIG_HORARIOS_LOCAL, JSON.stringify(config));
  } catch {
    // Ignora falhas de storage no navegador.
  }
}

async function carregarConfiguracaoHorarios() {
  if (!painelFuncionamentoAtivo) {
    return;
  }

  const cacheLocal = lerConfigHorariosLocalCache();
  if (cacheLocal) {
    aplicarConfiguracaoHorarios(cacheLocal);
  }

  try {
    const resposta = await fetch("/api/horarios", {
      method: "GET"
    });

    if (!resposta.ok) {
      return;
    }

    const dados = await resposta.json().catch(() => null);
    if (!dados || typeof dados !== "object") {
      return;
    }

    const normalizada = normalizarConfiguracaoHorarios(dados);
    aplicarConfiguracaoHorarios(normalizada);
    salvarConfigHorariosLocalCache(normalizada);
  } catch {
    // Em desenvolvimento sem function (ex.: Live Server), mantem config local/padrao.
  }
}

function obterHorarioEfetivoData(dataReferencia) {
  const diaSemana = dataReferencia.getDay();
  const chaveData = obterChaveDataLocal(dataReferencia);
  const semanal = configuracaoHorarios.weekly[String(diaSemana)];
  const sobrescrita = configuracaoHorarios.dateOverrides.find((item) => item.date === chaveData);

  if (sobrescrita) {
    if (sobrescrita.closed) {
      return {
        day: semanal?.day ?? "",
        open: null,
        close: null
      };
    }

    return {
      day: semanal?.day ?? "",
      open: sobrescrita.open,
      close: sobrescrita.close
    };
  }

  if (!semanal || semanal.closed) {
    return {
      day: semanal?.day ?? "",
      open: null,
      close: null
    };
  }

  return {
    day: semanal.day,
    open: semanal.open,
    close: semanal.close
  };
}

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
  const segundosHoje = obterSegundosDiaAtual(agora);

  for (let deslocamento = 0; deslocamento <= 7; deslocamento += 1) {
    const dataBusca = new Date(agora);
    dataBusca.setDate(dataBusca.getDate() + deslocamento);
    const horarioDia = obterHorarioEfetivoData(dataBusca);

    if (!horarioDia?.open || !horarioDia?.close) {
      continue;
    }

    const segundosAbertura = converterHorarioParaSegundos(horarioDia.open);
    const segundosFechamento = converterHorarioParaSegundos(horarioDia.close);

    if (deslocamento === 0) {
      if (segundosHoje < segundosAbertura) {
        return {
          deslocamento,
          horarioDia,
          alvo: criarDataComHorario(agora, horarioDia.open)
        };
      }

      if (segundosHoje >= segundosAbertura && segundosHoje < segundosFechamento) {
        return null;
      }

      continue;
    }

    return {
      deslocamento,
      horarioDia,
      alvo: criarDataComHorario(dataBusca, horarioDia.open)
    };
  }

  return null;
}

function atualizarPainelFuncionamento() {
  if (!contadorStatus || !contadorDetalheTitulo || !contadorDetalheValor) {
    return;
  }

  const agora = new Date();
  const horarioDia = obterHorarioEfetivoData(agora);
  const segundosHoje = obterSegundosDiaAtual(agora);

  if (horarioDia?.open && horarioDia?.close) {
    const segundosAbertura = converterHorarioParaSegundos(horarioDia.open);
    const segundosFechamento = converterHorarioParaSegundos(horarioDia.close);

    if (segundosHoje >= segundosAbertura && segundosHoje < segundosFechamento) {
      const faltamSegundos = segundosFechamento - segundosHoje;
      contadorStatus.textContent = `Fecha em: ${formatarDuracao(faltamSegundos)}`;
      contadorDetalheTitulo.textContent = "Horário de hoje:";
      contadorDetalheValor.textContent = `${horarioDia.open}–${horarioDia.close}`;
      return;
    }
  }

  const proximaAbertura = obterProximaAbertura(agora);
  if (!proximaAbertura) {
    contadorStatus.textContent = "Loja fechada no momento.";
    contadorDetalheTitulo.textContent = "Próxima abertura:";
    contadorDetalheValor.textContent = "Indisponível";
    return;
  }

  const faltamSegundos = Math.max(
    0,
    Math.floor((proximaAbertura.alvo.getTime() - agora.getTime()) / 1000)
  );
  const referenciaDia =
    proximaAbertura.deslocamento === 0 ? "hoje" : proximaAbertura.horarioDia.day;

  contadorStatus.textContent = `Abre em: ${formatarDuracao(faltamSegundos)}`;
  contadorDetalheTitulo.textContent = "Próxima abertura:";
  contadorDetalheValor.textContent = `${referenciaDia} às ${proximaAbertura.horarioDia.open}`;
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

function sortearCaractereRuidoMarca() {
  const indice = Math.floor(Math.random() * CARACTERES_RUIDO_MARCA.length);
  return CARACTERES_RUIDO_MARCA[indice] || "#";
}

function montarQuadroScrambleMarca(textoOrigem, textoDestino, progresso) {
  const tamanhoMaximo = Math.max(textoOrigem.length, textoDestino.length);
  const limite = Math.max(0, Math.min(tamanhoMaximo, Math.floor(progresso)));

  return Array.from({ length: tamanhoMaximo }, (_, indice) => {
    const caractereDestino = textoDestino[indice] || "";
    const caractereOrigem = textoOrigem[indice] || "";
    const caractereBase = caractereDestino || caractereOrigem;

    if (caractereBase === " ") {
      return " ";
    }

    if (indice < limite) {
      return caractereDestino;
    }

    if (!caractereBase) {
      return "";
    }

    if (Math.random() < 0.16) {
      return caractereBase;
    }

    return sortearCaractereRuidoMarca();
  }).join("");
}

function animarTransicaoScrambleMarca(textoOrigem, textoDestino) {
  if (!marcaTopo) {
    return Promise.resolve();
  }

  const tamanhoMaximo = Math.max(textoOrigem.length, textoDestino.length);
  if (tamanhoMaximo === 0) {
    marcaTopo.textContent = "";
    return Promise.resolve();
  }

  return new Promise((resolver) => {
    let progresso = 0;

    const idIntervalo = setInterval(() => {
      progresso += PASSO_SCRAMBLE_MARCA;
      if (progresso >= tamanhoMaximo) {
        clearInterval(idIntervalo);
        marcaTopo.textContent = textoDestino;
        resolver();
        return;
      }
      marcaTopo.textContent = montarQuadroScrambleMarca(textoOrigem, textoDestino, progresso);
    }, INTERVALO_QUADRO_SCRAMBLE_MARCA_MS);
  });
}

function iniciarAnimacaoMarcaAgressiva() {
  if (!marcaTopo) {
    return;
  }

  const textosRotacao = ROTACAO_TEXTO_MARCA
    .map((item) => normalizarTexto(item))
    .filter(Boolean);

  if (textosRotacao.length === 0) {
    return;
  }

  let indiceAtual = 0;
  let animando = false;

  marcaTopo.textContent = textosRotacao[indiceAtual];
  marcaTopo.setAttribute("aria-label", textosRotacao[indiceAtual]);

  const executarProximaTroca = async () => {
    if (animando) {
      return;
    }

    animando = true;
    const textoOrigem = textosRotacao[indiceAtual];
    const proximoIndice = (indiceAtual + 1) % textosRotacao.length;
    const textoDestino = textosRotacao[proximoIndice];

    await animarTransicaoScrambleMarca(textoOrigem, textoDestino);
    indiceAtual = proximoIndice;
    marcaTopo.setAttribute("aria-label", textoDestino);
    animando = false;
  };

  const idRotacao = setInterval(() => {
    executarProximaTroca();
  }, INTERVALO_ROTACAO_MARCA_MS);

  const limparTimers = () => {
    clearInterval(idRotacao);
  };

  window.addEventListener("beforeunload", limparTimers, { once: true });
}

function abrirDropdown() {
  if (!listaResultados || !inputBusca) {
    return;
  }

  listaResultados.classList.remove("oculto");
  inputBusca.setAttribute("aria-expanded", "true");
}

function limparResultados() {
  if (!listaResultados) {
    return;
  }

  listaResultados.innerHTML = "";
  abrirDropdown();
}

function renderizarMensagemDropdown(texto) {
  if (!listaResultados) {
    return;
  }

  listaResultados.innerHTML = `<li class="mensagem-resultados-busca">${texto}</li>`;
  abrirDropdown();
}

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return "Preco indisponivel";
  }

  return formatadorMoeda.format(numero);
}

function normalizarProduto(item) {
  const nome = String(item?.nome ?? "").trim();
  const precoVenda = Number(item?.precoVenda);

  if (!nome || !Number.isFinite(precoVenda)) {
    return null;
  }

  return {
    nome,
    precoVenda
  };
}

function filtrarProdutosPorTermo(lista, termo) {
  const termoNormalizado = String(termo ?? "").trim().toLowerCase();

  return lista
    .map(normalizarProduto)
    .filter(Boolean)
    .filter((item) => item.nome.toLowerCase().includes(termoNormalizado));
}

function renderizarResultados(lista) {
  if (!listaResultados) {
    return;
  }

  const resultados = Array.isArray(lista) ? lista : [];

  if (resultados.length === 0) {
    renderizarMensagemDropdown("Nenhum produto encontrado para essa busca.");
    return;
  }

  const html = resultados
    .map((produto, index) => {
      const nome = String(produto.nome ?? "Produto sem nome");
      const preco = formatarPreco(produto.precoVenda);
      const classeBorda = index === resultados.length - 1 ? "" : " linha-resultado-busca--divisor";
      return `
        <li>
          <div class="linha-resultado-busca${classeBorda}">
            <span class="nome-resultado-busca">${nome}</span>
            <span class="preco-resultado-busca">${preco}</span>
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

  let resposta = null;

  try {
    resposta = await fetch(`/api/precos?termo=${encodeURIComponent(termo)}`, {
      method: "GET",
      signal: controladorRequisicao.signal
    });
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw erro;
    }
    throw new Error("Nao foi possivel consultar os produtos agora.");
  }

  if (!resposta.ok) {
    const dadosErro = await resposta.json().catch(() => ({}));
    throw new Error(dadosErro.mensagem || "Falha ao consultar os produtos.");
  }

  const dados = await resposta.json();
  const lista = Array.isArray(dados?.items) ? dados.items : [];
  return filtrarProdutosPorTermo(lista, termo);
}

async function executarBusca(termoDigitado) {
  const termo = normalizarTexto(termoDigitado);
  ultimaBusca = termo;

  if (termo.length < TAMANHO_MINIMO_BUSCA) {
    renderizarMensagemDropdown("Digite o nome do produto.");
    return;
  }

  renderizarMensagemDropdown("Buscando produtos...");

  try {
    const produtos = await buscarProdutos(termo);

    if (ultimaBusca !== termo) {
      return;
    }

    renderizarResultados(produtos);
  } catch (erro) {
    if (erro.name === "AbortError") {
      return;
    }

    renderizarMensagemDropdown(erro.message || "Erro ao consultar produtos.");
  }
}

formBusca?.addEventListener("submit", (evento) => {
  evento.preventDefault();
  executarBusca(inputBusca?.value || "").finally(() => {
    botaoBusca?.blur();
  });
});

if (listaResultados && inputBusca && listaResultados.children.length === 0) {
  renderizarMensagemDropdown("Digite o nome do produto.");
}

if (horaBrasilia) {
  atualizarHoraBrasilia();
}

if (painelFuncionamentoAtivo) {
  // Mostra o estado imediatamente com base no padrao/local, sem esperar rede.
  atualizarPainelFuncionamento();

  // Adia a requisicao da API para tirar esse fetch do caminho critico de render.
  setTimeout(() => {
    carregarConfiguracaoHorarios().finally(() => {
      atualizarPainelFuncionamento();
    });
  }, ATRASO_CARREGAR_HORARIOS_MS);
}

iniciarAnimacaoMarcaAgressiva();
setInterval(() => {
  if (painelFuncionamentoAtivo) {
    atualizarPainelFuncionamento();
  }
  if (horaBrasilia) {
    atualizarHoraBrasilia();
  }
}, 1000);
