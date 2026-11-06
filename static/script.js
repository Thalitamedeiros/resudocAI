const $ = (id) => document.getElementById(id);
const entrada = $("entrada"), botao = $("botao"), zona = $("zona");
const MAX_MB = 500;
const TIPOS = {
  pdf: ["PDF", "#e5483b", "Documento PDF"],
  docx: ["W", "#2b6bd6", "Documento Word"],
  pptx: ["P", "#e8742a", "Apresentação"],
  xlsx: ["X", "#1f9d61", "Planilha"],
  csv: ["CSV", "#1f9d61", "Planilha"],
  txt: ["T", "#3b82f6", "Documento de texto"],
  md: ["M", "#3b82f6", "Documento Markdown"],
};
const IMAGENS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff"];
let arquivo = null;

function tamanho(bytes) {
  return bytes < 1048576 ? (bytes / 1024).toFixed(0) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
}

function mostrarErro(msg) { $("erro").textContent = msg; $("erro").style.display = "block"; }

async function lerJson(r) {
  try { return await r.json(); }
  catch { throw new Error("O servidor respondeu com erro (" + r.status + "). Veja o terminal."); }
}

function escolher(f) {
  arquivo = f;
  const ext = f.name.split(".").pop().toLowerCase();
  const [letra, cor, rotulo] = TIPOS[ext] ||
    (IMAGENS.includes(ext) ? ["IMG", "#8b5cf6", "Imagem"] : [ext.slice(0, 3).toUpperCase(), "#6b7a95", "Arquivo"]);

  const li = document.createElement("li");
  li.className = "item";
  const icone = document.createElement("div");
  icone.className = "icone"; icone.style.background = cor; icone.textContent = letra;
  const info = document.createElement("div");
  info.className = "info";
  const nome = document.createElement("div");
  nome.className = "nome"; nome.textContent = f.name;
  const tipo = document.createElement("div");
  tipo.className = "tipo"; tipo.textContent = rotulo + " · " + tamanho(f.size);
  const ok = document.createElement("div");
  ok.className = "ok"; ok.id = "ok"; ok.textContent = "✓";
  info.append(nome, tipo);
  li.append(icone, info, ok);
  $("lista").replaceChildren(li);

  $("origem").textContent = "1";
  if (f.size > MAX_MB * 1048576) {
    mostrarErro("O arquivo passa de " + MAX_MB + " MB.");
    botao.disabled = true;
    return;
  }
  $("erro").style.display = "none";
  botao.disabled = false;
}

$("adicionar").addEventListener("click", () => entrada.click());
zona.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); entrada.click(); } });
zona.addEventListener("click", (e) => { e.preventDefault(); entrada.click(); });
entrada.addEventListener("change", () => entrada.files[0] && escolher(entrada.files[0]));
["dragover", "dragenter"].forEach((e) => zona.addEventListener(e, (ev) => { ev.preventDefault(); zona.classList.add("sobre"); }));
["dragleave", "drop"].forEach((e) => zona.addEventListener(e, () => zona.classList.remove("sobre")));
zona.addEventListener("drop", (ev) => {
  ev.preventDefault();
  if (ev.dataTransfer.files[0]) escolher(ev.dataTransfer.files[0]);
});

function andamento(s) {
  if (s.estado === "resumindo" && s.total > 1) return "Analisando parte " + Math.min(s.feito + 1, s.total) + " de " + s.total + "…";
  if (s.estado === "finalizando") return "Montando o resumo final…";
  return "Lendo o documento…";
}

botao.addEventListener("click", async () => {
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  dados.append("tamanho", $("tamanho").value);
  botao.disabled = true;
  botao.textContent = "Enviando…";
  $("erro").style.display = "none";

  try {
    const r = await fetch("/resumir", { method: "POST", body: dados });
    const json = await lerJson(r);
    if (!r.ok) throw new Error(json.erro || "Erro ao resumir.");

    while (true) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const s = await lerJson(await fetch("/status/" + json.job));
      if (s.erro) throw new Error(s.erro);
      if (s.estado === "pronto") { mostrar(s.resultado); break; }
      botao.textContent = andamento(s);
    }
  } catch (e) {
    mostrarErro(e.message);
  } finally {
    botao.disabled = false;
    botao.textContent = "✦ Processar";
  }
});

function mostrar(d) {
  $("vazio").hidden = true;
  $("resultado").hidden = false;
  $("copiar").disabled = false;
  $("baixar").disabled = false;
  $("ok").classList.add("ativo");
  $("resumo").textContent = d.resumo || "";
  $("pontos").replaceChildren(...(d.pontos_chave || []).map((p) => {
    const li = document.createElement("li"); li.textContent = p; return li;
  }));
  $("topicos").replaceChildren(...(d.topicos || []).map((t) => {
    const s = document.createElement("span"); s.className = "chip"; s.textContent = t; return s;
  }));
  const palavras = textoDoResumo().split(/\s+/).length;
  $("tempo").textContent = Math.max(1, Math.round(palavras / 200)) + " min";
}

function textoDoResumo() {
  const pontos = [...$("pontos").children].map((li) => "- " + li.textContent).join("\n");
  return $("resumo").textContent + "\n\n" + pontos;
}

$("copiar").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(textoDoResumo()); $("copiar").textContent = "Copiado"; }
  catch { $("copiar").textContent = "Não copiou"; }
  setTimeout(() => ($("copiar").textContent = "Copiar"), 1500);
});

$("baixar").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([textoDoResumo()], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "resumo.txt"; a.click();
  URL.revokeObjectURL(url);
});
