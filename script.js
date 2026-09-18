const firebaseConfig = {
  apiKey: "AIzaSyDP6Yl6Mx8U2HJ8smTqwZz6k6pq7uQW3Yc",
  authDomain: "regate-simple-board-system.firebaseapp.com",
  projectId: "regate-simple-board-system",
  storageBucket: "regate-simple-board-system.firebasestorage.app",
  messagingSenderId: "5492810631",
  appId: "1:5492810631:web:366c4aa5be00d42a8ca922"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const CATEGORIAS_VALIDAS = ["sub-26", "misto", "feminino", "senior", "veterano"];

let equipes = [];
let baterias = [];
let currentRegataScores = {};
let editingRegataId = null;
let isAdmin = false;

const equipeNameInput = document.getElementById("equipeNameInput");
const btnAddEquipe = document.getElementById("btnAddEquipe");
const equipesRankingList = document.getElementById("equipesRankingList");

const regataNomeInput = document.getElementById("regataNomeInput");
const selectRegataCategoria = document.getElementById("selectRegataCategoria");
const regataTimesList = document.getElementById("regataTimesList");
const btnSalvarRegata = document.getElementById("btnSalvarRegata");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const historicoList = document.getElementById("historicoList");

const loginModal = document.getElementById("loginModal");
const btnOpenLogin = document.getElementById("btnOpenLogin");
const btnCloseLogin = document.getElementById("btnCloseLogin");
const btnLoginAction = document.getElementById("btnLoginAction");
const btnLogout = document.getElementById("btnLogout");
const authStatusText = document.getElementById("authStatusText");

auth.onAuthStateChanged((user) => {
  isAdmin = !!user;
  document.body.classList.toggle("is-admin", isAdmin);

  if (isAdmin) {
    authStatusText.innerHTML = `<span class="badge-status badge-admin">Conectado: ${user.email} (Admin)</span>`;
    btnOpenLogin.style.display = "none";
    btnLogout.style.display = "inline-flex";
  } else {
    authStatusText.innerHTML = `<span class="badge-status badge-viewer">Modo Visitante (Somente Leitura)</span>`;
    btnOpenLogin.style.display = "inline-flex";
    btnLogout.style.display = "none";
  }

  renderAll();
});

function openLoginModal() {
  loginModal.style.display = "flex";
}

function closeLoginModal() {
  loginModal.style.display = "none";
}

btnOpenLogin.addEventListener("click", openLoginModal);
btnCloseLogin.addEventListener("click", closeLoginModal);

btnLoginAction.onclick = async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    loginModal.style.display = "none";
    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";
  } catch (err) {
    alert("Falha na autenticação: " + err.message);
  }
};

btnLogout.onclick = () => auth.signOut();

db.collection("equipes").onSnapshot((snapshot) => {
  equipes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAll();
});

db.collection("baterias").onSnapshot((snapshot) => {
  baterias = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAll();
});

function getEquipesWithScores() {
  const scoreMap = {};
  equipes.forEach((eq) => {
    scoreMap[eq.id] = 0;
  });

  baterias.forEach((bateria) => {
    const scores = bateria.scores || {};
    Object.entries(scores).forEach(([equipeId, pts]) => {
      if (scoreMap[equipeId] !== undefined) {
        scoreMap[equipeId] += Number(pts) || 0;
      }
    });
  });

  return equipes.map((eq) => ({
    ...eq,
    score: scoreMap[eq.id] || 0
  }));
}

function renderEquipesRanking() {
  equipesRankingList.innerHTML = "";
  const equipesComPontos = getEquipesWithScores().sort((a, b) => b.score - a.score);

  if (equipesComPontos.length === 0) {
    equipesRankingList.innerHTML = '<li class="empty-msg">Nenhuma equipe cadastrada.</li>';
    return;
  }

  let currentRank = 1;

  equipesComPontos.forEach((eq, index) => {
    if (index > 0 && eq.score < equipesComPontos[index - 1].score) {
      currentRank = index + 1;
    }

    let rankClass = "";
    if (currentRank === 1) rankClass = "rank-1";
    else if (currentRank === 2) rankClass = "rank-2";
    else if (currentRank === 3) rankClass = "rank-3";

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="item-info">
        <span class="position ${rankClass}">${currentRank}º</span>
        <span class="name">${eq.name}</span>
      </div>
      <div class="score-controls">
        <span class="score-value">${eq.score} pts</span>
        ${isAdmin ? `<button class="btn-delete" title="Excluir equipe" onclick="removeEquipe('${eq.id}')">✕</button>` : ""}
      </div>
    `;
    equipesRankingList.appendChild(li);
  });
}

function renderRegataTimesList() {
  regataTimesList.innerHTML = "";

  if (equipes.length === 0) {
    regataTimesList.innerHTML = '<li class="empty-msg">Nenhuma equipe cadastrada para baterias.</li>';
    return;
  }

  equipes.forEach((eq) => {
    const scoreAtual = currentRegataScores[eq.id] || 0;
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="item-info">
        <span class="name">${eq.name}</span>
      </div>
      <div class="score-controls">
        ${isAdmin ? `<button class="btn-score" onclick="updateCurrentRegataScore('${eq.id}', -1)">-</button>` : ""}
        <span class="score-value">${scoreAtual}</span>
        ${isAdmin ? `<button class="btn-score" onclick="updateCurrentRegataScore('${eq.id}', 1)">+</button>` : ""}
      </div>
    `;
    regataTimesList.appendChild(li);
  });
}

function renderHistorico() {
  historicoList.innerHTML = "";

  if (baterias.length === 0) {
    historicoList.innerHTML = '<div class="empty-msg">Nenhuma bateria salva no histórico.</div>';
    return;
  }

  baterias
    .slice()
    .reverse()
    .forEach((bateria) => {
      const isBeingEdited = editingRegataId === bateria.id;
      const card = document.createElement("div");
      card.className = `historico-card ${isBeingEdited ? "editing" : ""}`;

      let resultadosHtml = "";
      const scores = bateria.scores || {};

      Object.entries(scores).forEach(([equipeId, pts]) => {
        if (Number(pts) > 0) {
          const equipe = equipes.find((eq) => eq.id === equipeId);
          const nome = equipe ? equipe.name : "Equipe removida";
          resultadosHtml += `
            <div class="hist-item-row">
              <span>${nome}:</span>
              <strong>+${pts} pts</strong>
            </div>
          `;
        }
      });

      if (!resultadosHtml) {
        resultadosHtml = '<div class="hist-item-row"><i>Nenhum ponto registrado.</i></div>';
      }

      card.innerHTML = `
        <div class="hist-card-header">
          <span class="hist-card-title">${bateria.nome || "Bateria"} <span class="badge-category">${bateria.categoria}</span></span>
          ${isAdmin ? `
            <div class="hist-card-actions">
              <button class="btn-action-sm btn-edit-hist" onclick="editRegata('${bateria.id}')">✏ Editar</button>
              <button class="btn-action-sm btn-delete" onclick="deleteRegata('${bateria.id}')">✕ Excluir</button>
            </div>
          ` : ""}
        </div>
        <div class="hist-card-body">${resultadosHtml}</div>
      `;

      historicoList.appendChild(card);
    });
}

function renderAll() {
  renderEquipesRanking();
  renderRegataTimesList();
  renderHistorico();
}

window.updateCurrentRegataScore = (equipeId, delta) => {
  if (!isAdmin) return;

  const atual = currentRegataScores[equipeId] || 0;
  currentRegataScores[equipeId] = Math.max(0, atual + delta);
  renderRegataTimesList();
};

window.editRegata = (regataId) => {
  if (!isAdmin) return;

  const bateria = baterias.find((item) => item.id === regataId);
  if (!bateria) return;

  editingRegataId = bateria.id;
  regataNomeInput.value = bateria.nome || "";
  selectRegataCategoria.value = bateria.categoria || CATEGORIAS_VALIDAS[0];
  currentRegataScores = { ...(bateria.scores || {}) };

  btnSalvarRegata.textContent = "🔄 Atualizar Bateria";
  btnSalvarRegata.style.backgroundColor = "#2563eb";
  btnCancelEdit.style.display = "block";

  renderAll();
};

function resetRegataForm() {
  editingRegataId = null;
  regataNomeInput.value = "";
  currentRegataScores = {};
  btnSalvarRegata.textContent = "💾 Salvar Resultado da Bateria";
  btnSalvarRegata.style.backgroundColor = "#16a34a";
  btnCancelEdit.style.display = "none";
}

btnCancelEdit.addEventListener("click", () => {
  resetRegataForm();
  renderAll();
});

window.deleteRegata = async (regataId) => {
  if (!isAdmin) return;

  if (confirm("Deseja excluir esta bateria do histórico?")) {
    await db.collection("baterias").doc(regataId).delete();
    if (editingRegataId === regataId) {
      resetRegataForm();
    }
  }
};

btnSalvarRegata.addEventListener("click", async () => {
  if (!isAdmin) return;

  const categoria = selectRegataCategoria.value;
  const nome = regataNomeInput.value.trim() || `Bateria (${categoria})`;
  const docId = editingRegataId || `reg_${Date.now()}`;

  const payload = {
    nome,
    categoria,
    scores: { ...currentRegataScores }
  };

  await db.collection("baterias").doc(docId).set(payload);
  resetRegataForm();
});

window.removeEquipe = async (equipeId) => {
  if (!isAdmin) return;

  const equipe = equipes.find((eq) => eq.id === equipeId);
  if (!equipe) return;

  if (!confirm(`Deseja excluir a equipe "${equipe.name}" e remover seus pontos das baterias?`)) {
    return;
  }

  for (const bateria of baterias) {
    const { id, ...rest } = bateria;
    const scores = { ...(rest.scores || {}) };
    delete scores[equipeId];
    await db.collection("baterias").doc(id).set({
      ...rest,
      scores
    });
  }

  await db.collection("equipes").doc(equipeId).delete();
};

btnAddEquipe.addEventListener("click", async () => {
  if (!isAdmin) return;

  const name = equipeNameInput.value.trim();
  if (!name) return;

  const docId = `eq_${Date.now()}`;
  await db.collection("equipes").doc(docId).set({ name });
  equipeNameInput.value = "";
});

selectRegataCategoria.addEventListener("change", () => {
  if (!editingRegataId) {
    currentRegataScores = {};
  }
  renderRegataTimesList();
});
