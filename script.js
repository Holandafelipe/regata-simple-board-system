import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// COLE AQUI AS SUAS CONFIGURAÇÕES DO FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyDP6Yl6Mx8U2HJ8smTqwZz6k6pq7uQW3Yc",
    authDomain: "regate-simple-board-system.firebaseapp.com",
    projectId: "regate-simple-board-system",
    storageBucket: "regate-simple-board-system.firebasestorage.app",
    messagingSenderId: "5492810631",
    appId: "1:5492810631:web:366c4aa5be00d42a8ca922"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIAS_VALIDAS = ['sub-26', 'misto', 'senior', 'feminino', 'veterano'];

let equipes = [];
let times = [];
let baterias = [];
let currentRegataScores = {};
let editingRegataId = null;
let isAdmin = false;

// Elementos da Interface
const equipeNameInput = document.getElementById('equipeNameInput');
const btnAddEquipe = document.getElementById('btnAddEquipe');
const equipesRankingList = document.getElementById('equipesRankingList');

const selectEquipe = document.getElementById('selectEquipe');
const selectCategoria = document.getElementById('selectCategoria');
const btnAddTime = document.getElementById('btnAddTime');
const timesList = document.getElementById('timesList');

const regataNomeInput = document.getElementById('regataNomeInput');
const selectRegataCategoria = document.getElementById('selectRegataCategoria');
const regataTimesList = document.getElementById('regataTimesList');
const btnSalvarRegata = document.getElementById('btnSalvarRegata');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const historicoList = document.getElementById('historicoList');

const loginModal = document.getElementById('loginModal');
const btnOpenLogin = document.getElementById('btnOpenLogin');
const btnCloseLogin = document.getElementById('btnCloseLogin');
const btnLoginAction = document.getElementById('btnLoginAction');
const btnLogout = document.getElementById('btnLogout');
const authStatusText = document.getElementById('authStatusText');

// Escuta estado de login em tempo real
onAuthStateChanged(auth, (user) => {
    isAdmin = !!user;
    document.body.classList.toggle('is-admin', isAdmin);

    if (isAdmin) {
    authStatusText.innerHTML = `<span class="badge-status badge-admin">Conectado: ${user.email} (Admin)</span>`;
    btnOpenLogin.style.display = 'none';
    btnLogout.style.display = 'inline-flex';
    } else {
    authStatusText.innerHTML = `<span class="badge-status badge-viewer">Modo Visitante (Somente Leitura)</span>`;
    btnOpenLogin.style.display = 'inline-flex';
    btnLogout.style.display = 'none';
    }
    renderAll();
});

// Login e Logout
btnOpenLogin.onclick = () => loginModal.style.display = 'flex';
btnCloseLogin.onclick = () => loginModal.style.display = 'none';

btnLoginAction.onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginModal.style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    } catch (err) {
    alert('Falha na autenticação: ' + err.message);
    }
};

btnLogout.onclick = () => signOut(auth);

// Sincronização em tempo real (Firestore -> UI)
onSnapshot(collection(db, "equipes"), (snapshot) => {
    equipes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
});

onSnapshot(collection(db, "times"), (snapshot) => {
    times = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
});

onSnapshot(collection(db, "baterias"), (snapshot) => {
    baterias = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
});

// Cálculos de Ranking
function getTimesWithScores() {
    const scoresMap = {};
    times.forEach(t => { scoresMap[t.id] = 0; });

    baterias.forEach(bateria => {
    if (bateria.scores) {
        Object.entries(bateria.scores).forEach(([timeId, pts]) => {
        if (scoresMap[timeId] !== undefined) {
            scoresMap[timeId] += (Number(pts) || 0);
        }
        });
    }
    });

    return times.map(t => ({ ...t, score: scoresMap[t.id] || 0 }));
}

function getEquipesWithScores() {
    const timesComPontos = getTimesWithScores();
    return equipes.map(eq => {
    const totalScore = timesComPontos
        .filter(t => t.equipeId === eq.id)
        .reduce((sum, t) => sum + t.score, 0);
    return { ...eq, score: totalScore };
    });
}

function updateEquipeSelectOptions() {
    const currentSelected = selectEquipe.value;
    selectEquipe.innerHTML = '<option value="" disabled selected>Selecione a equipe...</option>';
    equipes.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq.id;
    opt.textContent = eq.name;
    selectEquipe.appendChild(opt);
    });
    if (currentSelected && equipes.some(eq => eq.id === currentSelected)) {
    selectEquipe.value = currentSelected;
    }
}

// Renderizações
function renderEquipesRanking() {
    equipesRankingList.innerHTML = '';
    const equipesComPontos = getEquipesWithScores();
    equipesComPontos.sort((a, b) => b.score - a.score);

    if (equipesComPontos.length === 0) {
    equipesRankingList.innerHTML = '<li class="empty-msg">Nenhuma equipe cadastrada.</li>';
    return;
    }

    let currentRank = 1;
    equipesComPontos.forEach((eq, index) => {
    if (index > 0 && eq.score < equipesComPontos[index - 1].score) {
        currentRank = index + 1;
    }

    let rankClass = '';
    if (currentRank === 1) rankClass = 'rank-1';
    else if (currentRank === 2) rankClass = 'rank-2';
    else if (currentRank === 3) rankClass = 'rank-3';

    const li = document.createElement('li');
    li.innerHTML = `
        <div class="item-info">
        <span class="position ${rankClass}">${currentRank}º</span>
        <span class="name">${eq.name}</span>
        </div>
        <div class="score-controls">
        <span class="score-value">${eq.score} pts</span>
        ${isAdmin ? `<button class="btn-delete" title="Excluir equipe" onclick="removeEquipe('${eq.id}')">✕</button>` : ''}
        </div>
    `;
    equipesRankingList.appendChild(li);
    });
}

function renderTimesList() {
    timesList.innerHTML = '';
    let timesComPontos = getTimesWithScores();
    timesComPontos.sort((a, b) => b.score - a.score);

    if (timesComPontos.length === 0) {
    timesList.innerHTML = '<li class="empty-msg">Nenhum time encontrado.</li>';
    return;
    }

    let currentRank = 1;
    timesComPontos.forEach((t, index) => {
    if (index > 0 && t.score < timesComPontos[index - 1].score) {
        currentRank = index + 1;
    }

    const equipe = equipes.find(eq => eq.id === t.equipeId);
    const nomeEquipe = equipe ? equipe.name : 'Equipe Excluída';

    const li = document.createElement('li');
    li.innerHTML = `
        <div class="item-info">
        <span class="position">${currentRank}º</span>
        <div class="team-details">
            <span class="name">${nomeEquipe}</span>
            <span class="badge-category">${t.categoria}</span>
        </div>
        </div>
        <div class="score-controls">
        <span class="score-value">${t.score}</span>
        ${isAdmin ? `<button class="btn-delete" title="Excluir time" onclick="removeTime('${t.id}')">✕</button>` : ''}
        </div>
    `;
    timesList.appendChild(li);
    });
}

function renderRegataTimesList() {
    regataTimesList.innerHTML = '';
    const categoriaSelecionada = selectRegataCategoria.value;
    const timesDaCategoria = times.filter(t => t.categoria === categoriaSelecionada);

    if (timesDaCategoria.length === 0) {
    regataTimesList.innerHTML = `<li class="empty-msg">Nenhum time cadastrado na categoria <b>${categoriaSelecionada}</b>.</li>`;
    return;
    }

    timesDaCategoria.forEach(t => {
    const scoreAtual = currentRegataScores[t.id] || 0;
    const equipe = equipes.find(eq => eq.id === t.equipeId);
    const nomeEquipe = equipe ? equipe.name : 'Equipe Excluída';

    const li = document.createElement('li');
    li.innerHTML = `
        <div class="item-info">
        <span class="name">${nomeEquipe}</span>
        </div>
        <div class="score-controls">
        ${isAdmin ? `<button class="btn-score" onclick="updateCurrentRegataScore('${t.id}', -1)">-</button>` : ''}
        <span class="score-value">${scoreAtual}</span>
        ${isAdmin ? `<button class="btn-score" onclick="updateCurrentRegataScore('${t.id}', 1)">+</button>` : ''}
        </div>
    `;
    regataTimesList.appendChild(li);
    });
}

function renderHistorico() {
    historicoList.innerHTML = '';
    if (baterias.length === 0) {
    historicoList.innerHTML = '<div class="empty-msg">Nenhuma bateria salva no histórico.</div>';
    return;
    }

    baterias.slice().reverse().forEach(bateria => {
    const isBeingEdited = (editingRegataId === bateria.id);
    const card = document.createElement('div');
    card.className = `historico-card ${isBeingEdited ? 'editing' : ''}`;

    let resultadosHtml = '';
    if (bateria.scores) {
        Object.entries(bateria.scores).forEach(([timeId, pts]) => {
        if (pts > 0) {
            const time = times.find(t => t.id === timeId);
            const equipe = time ? equipes.find(eq => eq.id === time.equipeId) : null;
            const nome = equipe ? equipe.name : 'Time';
            resultadosHtml += `
            <div class="hist-item-row">
                <span>${nome}:</span>
                <strong>+${pts} pts</strong>
            </div>
            `;
        }
        });
    }

    if (!resultadosHtml) {
        resultadosHtml = '<div class="hist-item-row"><i>Nenhum ponto registrado.</i></div>';
    }

    card.innerHTML = `
        <div class="hist-card-header">
        <span class="hist-card-title">${bateria.nome || 'Bateria'} <span class="badge-category">${bateria.categoria}</span></span>
        ${isAdmin ? `
            <div class="hist-card-actions">
            <button class="btn-action-sm btn-edit-hist" onclick="editRegata('${bateria.id}')">✏ Editar</button>
            <button class="btn-action-sm btn-delete" onclick="deleteRegata('${bateria.id}')">✕ Excluir</button>
            </div>
        ` : ''}
        </div>
        <div class="hist-card-body">${resultadosHtml}</div>
    `;
    historicoList.appendChild(card);
    });
}

function renderAll() {
    updateEquipeSelectOptions();
    renderEquipesRanking();
    renderTimesList();
    renderRegataTimesList();
    renderHistorico();
}

// Ações de CRUD (expostas no window para os onClicks inline)
window.updateCurrentRegataScore = (timeId, delta) => {
    if (!isAdmin) return;
    const atual = currentRegataScores[timeId] || 0;
    currentRegataScores[timeId] = Math.max(0, atual + delta);
    renderRegataTimesList();
};

window.editRegata = (regataId) => {
    if (!isAdmin) return;
    const bateria = baterias.find(r => r.id === regataId);
    if (!bateria) return;

    editingRegataId = bateria.id;
    regataNomeInput.value = bateria.nome;
    selectRegataCategoria.value = bateria.categoria;
    currentRegataScores = { ...(bateria.scores || {}) };

    btnSalvarRegata.textContent = '🔄 Atualizar Bateria';
    btnSalvarRegata.style.backgroundColor = '#2563eb';
    btnCancelEdit.style.display = 'block';

    renderAll();
};

function resetRegataForm() {
    editingRegataId = null;
    regataNomeInput.value = '';
    currentRegataScores = {};
    btnSalvarRegata.textContent = '💾 Salvar Resultado da Bateria';
    btnSalvarRegata.style.backgroundColor = '#16a34a';
    btnCancelEdit.style.display = 'none';
}

btnCancelEdit.addEventListener('click', () => {
    resetRegataForm();
    renderAll();
});

window.deleteRegata = async (regataId) => {
    if (!isAdmin) return;
    if (confirm('Deseja excluir esta bateria do histórico?')) {
    await deleteDoc(doc(db, "baterias", regataId));
    if (editingRegataId === regataId) resetRegataForm();
    }
};

btnSalvarRegata.addEventListener('click', async () => {
    if (!isAdmin) return;
    const categoria = selectRegataCategoria.value;
    const nome = regataNomeInput.value.trim() || `Bateria (${categoria.toUpperCase()})`;

    const docId = editingRegataId || 'reg_' + Date.now();
    await setDoc(doc(db, "baterias", docId), {
    nome,
    categoria,
    scores: { ...currentRegataScores }
    });

    resetRegataForm();
});

window.removeTime = async (timeId) => {
    if (!isAdmin) return;
    if (confirm('Deseja excluir este time?')) {
    await deleteDoc(doc(db, "times", timeId));
    }
};

window.removeEquipe = async (equipeId) => {
    if (!isAdmin) return;
    if (confirm('Deseja excluir esta equipe e os times associados?')) {
    const timesToRemove = times.filter(t => t.equipeId === equipeId);
    for (const t of timesToRemove) {
        await deleteDoc(doc(db, "times", t.id));
    }
    await deleteDoc(doc(db, "equipes", equipeId));
    }
};

btnAddEquipe.addEventListener('click', async () => {
    if (!isAdmin) return;
    const name = equipeNameInput.value.trim();
    if (!name) return;

    const docId = 'eq_' + Date.now();
    await setDoc(doc(db, "equipes", docId), { name });
    equipeNameInput.value = '';
});

btnAddTime.addEventListener('click', async () => {
    if (!isAdmin) return;
    const equipeId = selectEquipe.value;
    const categoriaEscolhida = selectCategoria.value;
    if (!equipeId) return alert('Selecione uma equipe primeiro.');

    const categorias = (categoriaEscolhida === 'todos') ? CATEGORIAS_VALIDAS : [categoriaEscolhida];

    for (const cat of categorias) {
    const jaExiste = times.some(t => t.equipeId === equipeId && t.categoria === cat);
    if (!jaExiste) {
        const docId = 'tm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        await setDoc(doc(db, "times", docId), { equipeId, categoria: cat });
    }
    }
});

selectRegataCategoria.addEventListener('change', () => {
    if (!editingRegataId) currentRegataScores = {};
    renderRegataTimesList();
});