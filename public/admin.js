const CHAVE_CONFIG_LOCAL = "carvalho_horarios_config";
const CHAVE_SENHA_LOCAL = "carvalho_senha_administracao";
const CHAVE_SENHA_LOCAL_ANTIGA = "carvalho_admin_password";
const SENHA_LOCAL_PADRAO = "1234";
const URL_API_ADMINISTRACAO = "/api/admin/horarios";

const DIAS_SEMANA = [
  { key: "0", label: "Domingo" },
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" }
];

const blocoLogin = document.querySelector("#bloco-login");
const blocoAdministracao = document.querySelector("#bloco-administracao");
const senhaInput = document.querySelector("#senha-administracao");
const statusLogin = document.querySelector("#status-login");
const statusModo = document.querySelector("#status-modo");
const statusSalvar = document.querySelector("#status-salvar");
const tabelaSemana = document.querySelector("#tabela-semana");
const listaSobrescritas = document.querySelector("#lista-sobrescritas");
const btnEntrar = document.querySelector("#btn-entrar");
const btnSair = document.querySelector("#btn-sair");
const btnSalvar = document.querySelector("#btn-salvar");
const btnAdicionarData = document.querySelector("#btn-adicionar-data");

let senhaAdministracaoAtual = "";
let modoAtual = "api";

function criarConfiguracaoPadrao() {
  return {
    weekly: {
      "0": { day: "domingo", closed: false, open: "11:00", close: "17:00" },
      "1": { day: "segunda", closed: true, open: null, close: null },
      "2": { day: "terça", closed: false, open: "14:00", close: "23:00" },
      "3": { day: "quarta", closed: false, open: "14:00", close: "23:00" },
      "4": { day: "quinta", closed: false, open: "14:00", close: "23:00" },
      "5": { day: "sexta", closed: false, open: "14:00", close: "23:00" },
      "6": { day: "sábado", closed: false, open: "11:00", close: "23:00" }
    },
    dateOverrides: []
  };
}

function formatarJson(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function obterSenhaLocal() {
  const salva = String(localStorage.getItem(CHAVE_SENHA_LOCAL) ?? "").trim();
  if (salva) {
    return salva;
  }

  const salvaAntiga = String(localStorage.getItem(CHAVE_SENHA_LOCAL_ANTIGA) ?? "").trim();
  if (salvaAntiga) {
    localStorage.setItem(CHAVE_SENHA_LOCAL, salvaAntiga);
    return salvaAntiga;
  }

  localStorage.setItem(CHAVE_SENHA_LOCAL, SENHA_LOCAL_PADRAO);
  return SENHA_LOCAL_PADRAO;
}

function obterConfigLocal() {
  try {
    const texto = localStorage.getItem(CHAVE_CONFIG_LOCAL);
    if (!texto) {
      return criarConfiguracaoPadrao();
    }

    const dados = JSON.parse(texto);
    return normalizarConfiguracao(dados);
  } catch {
    return criarConfiguracaoPadrao();
  }
}

function salvarConfigLocal(configuracao) {
  localStorage.setItem(CHAVE_CONFIG_LOCAL, JSON.stringify(normalizarConfiguracao(configuracao)));
}

function responderHoraValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora ?? ""));
}

function horaParaMinutos(hora) {
  if (!responderHoraValida(hora)) {
    return null;
  }

  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function dataValida(dataTexto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataTexto ?? ""))) {
    return false;
  }

  const [ano, mes, dia] = dataTexto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

function normalizarConfiguracao(entrada) {
  const base = criarConfiguracaoPadrao();
  const dados = entrada && typeof entrada === "object" ? entrada : {};
  const weeklyEntrada = dados.weekly && typeof dados.weekly === "object" ? dados.weekly : {};

  const weekly = {};
  DIAS_SEMANA.forEach(({ key }) => {
    const item = weeklyEntrada[key] && typeof weeklyEntrada[key] === "object" ? weeklyEntrada[key] : {};
    const baseDia = base.weekly[key];
    const closed = Boolean(item.closed);

    if (closed) {
      weekly[key] = {
        day: baseDia.day,
        closed: true,
        open: null,
        close: null
      };
      return;
    }

    const open = responderHoraValida(item.open) ? item.open : baseDia.open;
    const close = responderHoraValida(item.close) ? item.close : baseDia.close;

    if (!responderHoraValida(open) || !responderHoraValida(close) || horaParaMinutos(open) >= horaParaMinutos(close)) {
      weekly[key] = formatarJson(baseDia);
      return;
    }

    weekly[key] = {
      day: baseDia.day,
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
    if (!responderHoraValida(open) || !responderHoraValida(close)) {
      return;
    }

    if (horaParaMinutos(open) >= horaParaMinutos(close)) {
      return;
    }

    mapa.set(date, { date, closed: false, open, close });
  });

  return {
    weekly,
    dateOverrides: Array.from(mapa.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

function construirTabelaSemana() {
  tabelaSemana.innerHTML = DIAS_SEMANA.map(
    ({ key, label }) => `
      <tr id="linha-semana-${key}">
        <td class="celula-tabela-administracao celula-tabela-administracao--rotulo">${label}</td>
        <td class="celula-tabela-administracao">
          <input id="semana-${key}-closed" type="checkbox" class="caixa-selecao-administracao" />
        </td>
        <td class="celula-tabela-administracao">
          <input id="semana-${key}-open" type="time" class="entrada-hora-administracao" />
        </td>
        <td class="celula-tabela-administracao">
          <input id="semana-${key}-close" type="time" class="entrada-hora-administracao" />
        </td>
      </tr>
    `
  ).join("");

  DIAS_SEMANA.forEach(({ key }) => {
    const checkbox = document.querySelector(`#semana-${key}-closed`);
    checkbox?.addEventListener("change", () => {
      atualizarEstadoLinhaSemana(key);
    });
  });
}

function atualizarEstadoLinhaSemana(key) {
  const closed = document.querySelector(`#semana-${key}-closed`)?.checked;
  const openInput = document.querySelector(`#semana-${key}-open`);
  const closeInput = document.querySelector(`#semana-${key}-close`);
  const linha = document.querySelector(`#linha-semana-${key}`);

  if (!openInput || !closeInput) {
    return;
  }

  openInput.disabled = Boolean(closed);
  closeInput.disabled = Boolean(closed);

  if (linha) {
    linha.classList.toggle("linha-administracao--fechada", Boolean(closed));
  }
}

function criarLinhaSobrescrita(item = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="celula-tabela-administracao">
      <input type="date" class="campo-data entrada-data-administracao" value="${item.date ?? ""}" />
    </td>
    <td class="celula-tabela-administracao">
      <input type="checkbox" class="campo-closed caixa-selecao-administracao" ${item.closed ? "checked" : ""} />
    </td>
    <td class="celula-tabela-administracao">
      <input type="time" class="campo-open entrada-hora-administracao" value="${item.open ?? ""}" />
    </td>
    <td class="celula-tabela-administracao">
      <input type="time" class="campo-close entrada-hora-administracao" value="${item.close ?? ""}" />
    </td>
    <td class="celula-tabela-administracao">
      <button type="button" class="botao-remover-linha botao-remover-administracao">Remover</button>
    </td>
  `;

  const closedInput = tr.querySelector(".campo-closed");
  const removerBtn = tr.querySelector(".botao-remover-linha");

  closedInput?.addEventListener("change", () => {
    atualizarEstadoLinhaSobrescrita(tr);
  });

  removerBtn?.addEventListener("click", () => {
    tr.remove();
  });

  listaSobrescritas.appendChild(tr);
  atualizarEstadoLinhaSobrescrita(tr);
}

function atualizarEstadoLinhaSobrescrita(tr) {
  const closed = tr.querySelector(".campo-closed")?.checked;
  const openInput = tr.querySelector(".campo-open");
  const closeInput = tr.querySelector(".campo-close");

  if (!openInput || !closeInput) {
    return;
  }

  openInput.disabled = Boolean(closed);
  closeInput.disabled = Boolean(closed);
  tr.classList.toggle("linha-administracao--fechada", Boolean(closed));
}

function aplicarConfiguracaoNoFormulario(configuracao) {
  const config = normalizarConfiguracao(configuracao);

  DIAS_SEMANA.forEach(({ key }) => {
    const item = config.weekly[key];
    const closedInput = document.querySelector(`#semana-${key}-closed`);
    const openInput = document.querySelector(`#semana-${key}-open`);
    const closeInput = document.querySelector(`#semana-${key}-close`);

    if (!closedInput || !openInput || !closeInput) {
      return;
    }

    closedInput.checked = Boolean(item.closed);
    openInput.value = item.open ?? "";
    closeInput.value = item.close ?? "";
    atualizarEstadoLinhaSemana(key);
  });

  listaSobrescritas.innerHTML = "";
  if (!Array.isArray(config.dateOverrides) || config.dateOverrides.length === 0) {
    criarLinhaSobrescrita();
    return;
  }

  config.dateOverrides.forEach((item) => {
    criarLinhaSobrescrita(item);
  });
}

function coletarConfiguracaoFormulario() {
  const weekly = {};

  DIAS_SEMANA.forEach(({ key, label }) => {
    const closed = document.querySelector(`#semana-${key}-closed`)?.checked;
    const open = String(document.querySelector(`#semana-${key}-open`)?.value ?? "").trim();
    const close = String(document.querySelector(`#semana-${key}-close`)?.value ?? "").trim();

    if (closed) {
      weekly[key] = {
        day: label.toLowerCase(),
        closed: true,
        open: null,
        close: null
      };
      return;
    }

    if (!responderHoraValida(open) || !responderHoraValida(close)) {
      throw new Error(`Preencha horarios validos para ${label}.`);
    }

    if (horaParaMinutos(open) >= horaParaMinutos(close)) {
      throw new Error(`O horario de abertura deve ser menor que o de fechamento em ${label}.`);
    }

    weekly[key] = {
      day: label.toLowerCase(),
      closed: false,
      open,
      close
    };
  });

  const dateOverrides = [];
  const linhas = Array.from(listaSobrescritas.querySelectorAll("tr"));

  linhas.forEach((tr) => {
    const date = String(tr.querySelector(".campo-data")?.value ?? "").trim();
    const closed = Boolean(tr.querySelector(".campo-closed")?.checked);
    const open = String(tr.querySelector(".campo-open")?.value ?? "").trim();
    const close = String(tr.querySelector(".campo-close")?.value ?? "").trim();

    if (!date && !open && !close && !closed) {
      return;
    }

    if (!dataValida(date)) {
      throw new Error("Uma ou mais datas de sobrescrita estao invalidas.");
    }

    if (closed) {
      dateOverrides.push({ date, closed: true, open: null, close: null });
      return;
    }

    if (!responderHoraValida(open) || !responderHoraValida(close)) {
      throw new Error(`Preencha horario valido na data ${date}.`);
    }

    if (horaParaMinutos(open) >= horaParaMinutos(close)) {
      throw new Error(`Horario invalido na data ${date}.`);
    }

    dateOverrides.push({ date, closed: false, open, close });
  });

  const mapa = new Map();
  dateOverrides.forEach((item) => {
    mapa.set(item.date, item);
  });

  return {
    weekly,
    dateOverrides: Array.from(mapa.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

async function autenticarModoApi(senha) {
  const resposta = await fetch(URL_API_ADMINISTRACAO, {
    method: "GET",
    headers: {
      "x-admin-password": senha
    },
    cache: "no-store"
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.mensagem || "Nao foi possivel autenticar na administracao.");
  }

  const dados = await resposta.json();
  const config = normalizarConfiguracao(dados);
  salvarConfigLocal(config);
  return config;
}

function autenticarModoLocal(senha) {
  const senhaLocal = obterSenhaLocal();
  if (senha !== senhaLocal) {
    throw new Error("Senha invalida para modo local.");
  }

  const config = obterConfigLocal();
  return config;
}

function entrarNoPainel(configuracao, modo) {
  blocoLogin.classList.add("oculto");
  blocoAdministracao.classList.remove("oculto");
  modoAtual = modo;

  statusModo.textContent =
    modoAtual === "api"
      ? "Modo online: alteracoes salvas para todo o site."
      : "Modo local: alteracoes salvas apenas neste navegador.";

  statusSalvar.textContent = "";
  aplicarConfiguracaoNoFormulario(configuracao);
}

function sairDoPainel() {
  senhaAdministracaoAtual = "";
  modoAtual = "api";
  blocoAdministracao.classList.add("oculto");
  blocoLogin.classList.remove("oculto");
  statusLogin.textContent = "";
  statusSalvar.textContent = "";
  senhaInput.value = "";
}

async function salvarConfiguracao() {
  statusSalvar.textContent = "Salvando...";

  try {
    const config = coletarConfiguracaoFormulario();

    if (modoAtual === "api") {
      const resposta = await fetch(URL_API_ADMINISTRACAO, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": senhaAdministracaoAtual
        },
        body: JSON.stringify(config)
      });

      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(erro.mensagem || "Falha ao salvar no servidor.");
      }

      const salvo = await resposta.json();
      const normalizado = normalizarConfiguracao(salvo);
      salvarConfigLocal(normalizado);
      aplicarConfiguracaoNoFormulario(normalizado);
      statusSalvar.textContent = "Horarios salvos com sucesso.";
      return;
    }

    const normalizado = normalizarConfiguracao(config);
    salvarConfigLocal(normalizado);
    aplicarConfiguracaoNoFormulario(normalizado);
    statusSalvar.textContent = "Horarios salvos no navegador (modo local).";
  } catch (erro) {
    statusSalvar.textContent = erro.message || "Erro ao salvar horarios.";
  }
}

async function iniciarLogin() {
  const senha = String(senhaInput.value ?? "").trim();
  if (!senha) {
    statusLogin.textContent = "Informe a senha.";
    return;
  }

  statusLogin.textContent = "Entrando...";

  try {
    const config = await autenticarModoApi(senha);
    senhaAdministracaoAtual = senha;
    statusLogin.textContent = "";
    entrarNoPainel(config, "api");
  } catch (erroApi) {
    try {
      const configLocal = autenticarModoLocal(senha);
      senhaAdministracaoAtual = senha;
      statusLogin.textContent = "";
      entrarNoPainel(configLocal, "local");
    } catch (erroLocal) {
      statusLogin.textContent = erroApi.message || erroLocal.message || "Falha ao autenticar.";
    }
  }
}

construirTabelaSemana();
criarLinhaSobrescrita();

btnEntrar?.addEventListener("click", iniciarLogin);
senhaInput?.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    iniciarLogin();
  }
});
btnSair?.addEventListener("click", sairDoPainel);
btnSalvar?.addEventListener("click", salvarConfiguracao);
btnAdicionarData?.addEventListener("click", () => criarLinhaSobrescrita());
