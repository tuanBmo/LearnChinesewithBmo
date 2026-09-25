// ==========================================
// 1. BIẾN TRẠNG THÁI VÀ DỮ LIỆU CỐT LÕI
// ==========================================
const levels = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];
let selectedLevels = [];
let selectedPersonalFiles = [];
let selectedMode = "NGHĨA";
let quizData = [];
let grammarData = []; 
let currentIndex = 0;
let hp = 5;
let missedWords = []; 
let isReviewMode = false; 
let hskChartInstance = null; 
 
function getSafeData(key, defaultVal) {
    try { return JSON.parse(localStorage.getItem(key)) || defaultVal; } 
    catch(e) { return defaultVal; }
}
  
let hskMasteredWords = getSafeData('hsk_mastered_words_v2', {});
let hskLevelTotals = getSafeData('hsk_level_totals_v2', {}); 
let personalFiles = getSafeData('hsk_personal_files', {});
let currentUser = localStorage.getItem('hsk_current_user');
let appSettings = getSafeData('hsk_settings', { hidePinyin: false, shuffle: true });
let loginHistory = getSafeData('hsk_login_history', []);
let currentStreak = 0;
let globalMissedWords = getSafeData('hsk_global_missed_words', {}); 
let usefulLinks = getSafeData('hsk_useful_links', []);

let globalDictionary = [];

function normalizeWordData(row, levelName) {
    let h = row[0] || ""; let p = row[1] || ""; let t = "", m = "", eh = "", ep = "", em = "";
    if (row.length >= 7) { t = row[2] || ""; m = row[3] || ""; eh = row[4] || ""; ep = row[5] || ""; em = row[6] || ""; } 
    else if (row.length === 6) { m = row[2] || ""; eh = row[3] || ""; ep = row[4] || ""; em = row[5] || ""; } 
    else if (row.length === 4) { t = row[2] || ""; m = row[3] || ""; } 
    else { m = row[2] || ""; }
    return [h, p, t, m, eh, ep, em, levelName];
}

// ==========================================
// AUDIO & UTILS
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    
    if(type === 'pop') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
}

function shootConfetti() { try { if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }}); } catch(e) {} }

async function fetchGameData(difficulty, count) {
    let filesToLoad = [];
    if (difficulty === 'easy') filesToLoad = ['HSK1', 'HSK2']; 
    else if (difficulty === 'medium') filesToLoad = ['HSK3', 'HSK4']; 
    else if (difficulty === 'hard') filesToLoad = ['HSK5', 'HSK6'];

    let allWords = [];
    const fetchPromises = filesToLoad.map(async (lvl) => {
        try {
            let res = await fetch(`${lvl}.csv`); if (!res.ok) res = await fetch(`${lvl.toLowerCase()}.csv`);
            if (res.ok) { 
                const text = await res.text(); const parsed = Papa.parse(text, { skipEmptyLines: true }); 
                return parsed.data.filter(r => r.length >= 3 && r[0].trim() !== "").map(r => normalizeWordData(r, lvl)); 
            }
        } catch (e) { return []; } return [];
    });
    const results = await Promise.all(fetchPromises); 
    results.forEach(data => { allWords = [...allWords, ...data]; });
    
    if (allWords.length === 0) return [];
    allWords.sort(() => Math.random() - 0.5); 
    return allWords.slice(0, count);
}

// ==========================================
// MINIGAME 1: GHÉP 3 YẾU TỐ (CŨ)
// ==========================================
let matchGameSelected = []; let matchedCount = 0;
window.startMatchGame = async function() {
    const diffSelect = document.getElementById('miniGameDifficulty'); const countSelect = document.getElementById('miniGameWordCount');
    let difficulty = diffSelect ? diffSelect.value : 'easy'; let count = countSelect ? parseInt(countSelect.value) : 5;

    document.getElementById('wordMatchGameScreen').style.display = 'block';
    const container = document.getElementById('floatingBubblesContainer');
    container.innerHTML = `<h3 style="color:var(--text-secondary); text-align:center; width:100%;">Đang tìm kiếm dữ liệu... <i class='bx bx-loader-alt bx-spin'></i></h3>`;

    let wordsForGame = await fetchGameData(difficulty, count);
    if (wordsForGame.length === 0) { container.innerHTML = `<h3 style="color:var(--color-pink);">Không tìm thấy dữ liệu!</h3>`; return; }

    matchedCount = 0; matchGameSelected = []; document.getElementById('matchProgressText').innerText = `0 / ${count}`; container.innerHTML = "";
    let allBubbles = [];
    wordsForGame.forEach((word, idx) => {
        allBubbles.push({ id: idx, type: 'hanzi', text: word[0] }); 
        allBubbles.push({ id: idx, type: 'pinyin', text: word[1] }); 
        allBubbles.push({ id: idx, type: 'meaning', text: word[3] }); 
    });
    allBubbles.sort(() => Math.random() - 0.5); 
    allBubbles.forEach((b) => {
        const bubble = document.createElement('div'); bubble.className = `match-bubble glass-panel ${b.type}`; bubble.innerText = b.text;
        bubble.dataset.id = b.id; bubble.dataset.type = b.type;
        bubble.onclick = () => handleBubbleClick(bubble, count); container.appendChild(bubble);
    });
}
function handleBubbleClick(bubble, totalCount) {
    if (bubble.classList.contains('correct') || bubble.classList.contains('wrong')) return;
    playSound('pop'); const bType = bubble.dataset.type;
    if (bubble.classList.contains('selected')) { bubble.classList.remove('selected'); matchGameSelected = matchGameSelected.filter(n => n !== bubble); return; }
    const existingTypeNode = matchGameSelected.find(n => n.dataset.type === bType);
    if (existingTypeNode) { existingTypeNode.classList.remove('selected'); matchGameSelected = matchGameSelected.filter(n => n !== existingTypeNode); }
    bubble.classList.add('selected'); matchGameSelected.push(bubble);

    if (matchGameSelected.length === 3) {
        const id1 = matchGameSelected[0].dataset.id; const id2 = matchGameSelected[1].dataset.id; const id3 = matchGameSelected[2].dataset.id;
        if (id1 === id2 && id2 === id3) {
            playSound('correct'); matchGameSelected.forEach(n => { n.classList.remove('selected'); n.classList.add('correct'); }); matchedCount++;
            document.getElementById('matchProgressText').innerText = `${matchedCount} / ${totalCount}`;
            setTimeout(() => { document.querySelectorAll('.match-bubble.correct').forEach(el => el.remove()); if (matchedCount === totalCount) { shootConfetti(); setTimeout(() => { alert("Wow! Phản xạ xuất thần!"); closeMinigame('wordMatchGameScreen'); }, 800); } }, 400);
        } else {
            playSound('wrong'); matchGameSelected.forEach(n => { n.classList.remove('selected'); n.classList.add('wrong'); });
            setTimeout(() => { document.querySelectorAll('.match-bubble.wrong').forEach(n => { n.classList.remove('wrong'); n.classList.remove('selected'); }); }, 400);
        }
        matchGameSelected = [];
    }
}

// ==========================================
// MINIGAME 2: LẬT THẺ 2 CỘT (MỚI)
// ==========================================
let flipGameSelectedHanzi = null; let flipGameSelectedMeaning = null; let flipMatchedCount = 0;
window.startFlipGame = async function() {
    const diff = document.getElementById('flipGameDifficulty').value; 
    const count = parseInt(document.getElementById('flipGameWordCount').value);
    
    document.getElementById('flipGameScreen').style.display = 'block';
    const leftCol = document.getElementById('flipColLeft'); const rightCol = document.getElementById('flipColRight');
    leftCol.innerHTML = ""; rightCol.innerHTML = "<div style='text-align:center; padding:20px;'><i class='bx bx-loader-alt bx-spin' style='font-size:2rem;'></i></div>";

    let wordsForGame = await fetchGameData(diff, count);
    if(wordsForGame.length === 0) return rightCol.innerHTML = "Không có dữ liệu!";
    
    flipMatchedCount = 0; flipGameSelectedHanzi = null; flipGameSelectedMeaning = null;
    document.getElementById('flipProgressText').innerText = `0 / ${count}`;
    leftCol.innerHTML = ""; rightCol.innerHTML = "";

    let hanziArr = []; let meaningArr = [];
    wordsForGame.forEach((w, idx) => {
        hanziArr.push({id: idx, text: w[0], type: 'hanzi'});
        meaningArr.push({id: idx, text: w[3], type: 'meaning'});
    });
    hanziArr.sort(() => Math.random() - 0.5); meaningArr.sort(() => Math.random() - 0.5);

    hanziArr.forEach(h => {
        const c = document.createElement('div'); c.className = "flip-card glass-panel hanzi-card"; c.innerText = h.text; c.dataset.id = h.id;
        c.onclick = () => handleFlipSelection(c, 'hanzi', count); leftCol.appendChild(c);
    });
    meaningArr.forEach(m => {
        const c = document.createElement('div'); c.className = "flip-card glass-panel meaning-card"; c.innerText = m.text; c.dataset.id = m.id;
        c.onclick = () => handleFlipSelection(c, 'meaning', count); rightCol.appendChild(c);
    });
}
function handleFlipSelection(card, type, total) {
    if(card.classList.contains('hidden') || card.classList.contains('wrong')) return;
    playSound('pop');
    
    if(type === 'hanzi') {
        if(flipGameSelectedHanzi === card) { card.classList.remove('selected'); flipGameSelectedHanzi = null; return; }
        if(flipGameSelectedHanzi) flipGameSelectedHanzi.classList.remove('selected');
        flipGameSelectedHanzi = card; card.classList.add('selected');
    } else {
        if(flipGameSelectedMeaning === card) { card.classList.remove('selected'); flipGameSelectedMeaning = null; return; }
        if(flipGameSelectedMeaning) flipGameSelectedMeaning.classList.remove('selected');
        flipGameSelectedMeaning = card; card.classList.add('selected');
    }

    if(flipGameSelectedHanzi && flipGameSelectedMeaning) {
        if(flipGameSelectedHanzi.dataset.id === flipGameSelectedMeaning.dataset.id) {
            playSound('correct'); 
            flipGameSelectedHanzi.classList.remove('selected'); flipGameSelectedMeaning.classList.remove('selected');
            flipGameSelectedHanzi.classList.add('correct-fade'); flipGameSelectedMeaning.classList.add('correct-fade');
            flipMatchedCount++; document.getElementById('flipProgressText').innerText = `${flipMatchedCount} / ${total}`;
            setTimeout(() => {
                document.querySelectorAll('.correct-fade').forEach(el => el.classList.add('hidden'));
                if(flipMatchedCount === total) { shootConfetti(); setTimeout(() => { alert("Chính xác tuyệt đối!"); closeMinigame('flipGameScreen'); }, 500); }
            }, 300);
        } else {
            playSound('wrong'); 
            flipGameSelectedHanzi.classList.add('wrong'); flipGameSelectedMeaning.classList.add('wrong');
            setTimeout(() => { document.querySelectorAll('.flip-card.wrong').forEach(el => { el.classList.remove('wrong'); el.classList.remove('selected'); }); }, 400);
        }
        flipGameSelectedHanzi = null; flipGameSelectedMeaning = null;
    }
}

// ==========================================
// MINIGAME 3: BẮN TỪ RƠI (MỚI)
// ==========================================
let fallingGameInterval, spawnInterval;
let fallingWordsObj = []; let fallLives = 10; let fallScore = 0; let fallGameActive = false;
let fallSpeedMod = 1; let fallWordPool = [];

window.startFallingGame = async function() {
    const diff = document.getElementById('fallingGameDifficulty').value; 
    const speedSelect = document.getElementById('fallingGameSpeed').value;
    if(speedSelect === 'slow') fallSpeedMod = 0.5; else if(speedSelect === 'fast') fallSpeedMod = 1.8; else fallSpeedMod = 1;

    document.getElementById('fallingGameScreen').style.display = 'block';
    const zone = document.getElementById('fallingZone');
    zone.innerHTML = "<h3 style='text-align:center; padding-top:20vh;'>Chuẩn bị vũ khí... <i class='bx bx-loader-alt bx-spin'></i></h3>";
    
    fallWordPool = await fetchGameData(diff, 50); // Get a large pool
    if(fallWordPool.length === 0) return zone.innerHTML = "Không có dữ liệu!";
    
    fallLives = 10; fallScore = 0; fallingWordsObj = []; fallGameActive = true;
    updateFallingHUD(); zone.innerHTML = "";
    document.getElementById('shooterInput').value = "";
    setTimeout(() => document.getElementById('shooterInput').focus(), 100);

    spawnInterval = setInterval(spawnFallingWord, 2000 / fallSpeedMod);
    fallingGameInterval = requestAnimationFrame(updateFallingGame);
}

function spawnFallingWord() {
    if(!fallGameActive) return;
    const randomWord = fallWordPool[Math.floor(Math.random() * fallWordPool.length)];
    const el = document.createElement('div');
    el.className = "falling-word glass-panel";
    el.innerHTML = `<span class="fw-hz">${randomWord[0]}</span><span class="fw-mn">${randomWord[3]}</span>`;
    
    const zone = document.getElementById('fallingZone');
    const maxX = zone.clientWidth - 100; // random X position
    el.style.left = Math.max(10, Math.random() * maxX) + "px";
    el.style.top = "-50px";
    zone.appendChild(el);

    fallingWordsObj.push({
        el: el, pinyin: normalizePinyin(randomWord[1]), y: -50, speed: (1 + Math.random()) * fallSpeedMod
    });
}

function updateFallingGame() {
    if(!fallGameActive) return;
    const zone = document.getElementById('fallingZone');
    const bottomLimit = zone.clientHeight - 30; // Chạm đáy

    for(let i = fallingWordsObj.length - 1; i >= 0; i--) {
        let w = fallingWordsObj[i];
        w.y += w.speed;
        w.el.style.top = w.y + "px";

        if(w.y > bottomLimit) {
            w.el.remove(); fallingWordsObj.splice(i, 1);
            fallLives--; playSound('wrong'); updateFallingHUD();
            zone.classList.add('flash-red'); setTimeout(() => zone.classList.remove('flash-red'), 200);
            
            if(fallLives <= 0) {
                fallGameActive = false; clearInterval(spawnInterval);
                setTimeout(() => { alert(`GAME OVER! Điểm của bạn: ${fallScore}`); closeFallingGame(); }, 100);
                return;
            }
        }
    }
    fallingGameInterval = requestAnimationFrame(updateFallingGame);
}

window.handleShooterInput = function() {
    if(!fallGameActive) return;
    const inputEl = document.getElementById('shooterInput');
    const typed = normalizePinyin(inputEl.value);
    
    // Tìm từ rơi có pinyin khớp
    const hitIndex = fallingWordsObj.findIndex(w => w.pinyin === typed);
    if(hitIndex !== -1) {
        playSound('correct');
        const target = fallingWordsObj[hitIndex];
        target.el.classList.add('explode');
        setTimeout(() => { try{target.el.remove();}catch(e){} }, 300);
        fallingWordsObj.splice(hitIndex, 1);
        
        fallScore++; updateFallingHUD(); inputEl.value = "";
        
        // Hiệu ứng pháo laser bắn lên (css optional, dùng confetti cho nhanh)
        try { confetti({ particleCount: 30, spread: 50, origin: { x: (parseInt(target.el.style.left)+50)/window.innerWidth, y: target.y/window.innerHeight } }); } catch(e) {}
    }
}

function updateFallingHUD() {
    document.getElementById('fallingScoreText').innerText = `Điểm: ${fallScore}`;
    document.getElementById('fallingLivesText').innerText = "❤️".repeat(Math.max(0, fallLives));
}

window.closeFallingGame = function() {
    fallGameActive = false; clearInterval(spawnInterval); cancelAnimationFrame(fallingGameInterval);
    fallingWordsObj.forEach(w => w.el.remove()); fallingWordsObj = [];
    document.getElementById('fallingGameScreen').style.display = 'none';
}
window.closeMinigame = function(id) { document.getElementById(id).style.display = 'none'; }


// ==========================================
// CÁC HÀM KHỞI TẠO, TẢI DATA & VIEW CHÍNH 
// (Giữ nguyên logic Load Global, Dashboard, Settings, etc)
// ==========================================

async function loadGlobalDictionary() {
    globalDictionary = [];
    Object.keys(personalFiles).forEach(name => {
        const parsed = Papa.parse(personalFiles[name], { skipEmptyLines: true });
        parsed.data.forEach(r => { if(r.length >= 3) globalDictionary.push(normalizeWordData(r, name.toUpperCase())) });
    });
    const fetchPromises = levels.map(async (lvl) => {
        try {
            let res = await fetch(`${lvl}.csv`); if (!res.ok) res = await fetch(`${lvl.toLowerCase()}.csv`);
            if (res.ok) {
                const text = await res.text(); const parsed = Papa.parse(text, { skipEmptyLines: true });
                parsed.data.forEach(r => { if(r.length >= 3) globalDictionary.push(normalizeWordData(r, lvl.toUpperCase())) });
            }
        } catch (e) {}
    });
    await Promise.all(fetchPromises);
}

// KHỞI TẠO
function checkAuth() {
    const authModal = document.getElementById('authModal');
    if (!currentUser) { if (authModal) authModal.style.display = 'flex'; } 
    else {
        if (authModal) authModal.style.display = 'none';
        const welcomeText = document.getElementById('welcomeUserText'); if(welcomeText) welcomeText.innerText = `Welcome back, ${currentUser}! ✨`;
        loadGlobalDictionary(); processStreakCalendar(); updateProfileXP(); renderLevelScores();
        initSettingsUI(); renderDailyQuote(); loadGrammarData(); 
        renderGlobalMissedWords(); renderUsefulLinks(); initLearnView();
    }
}

const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
    btnLogin.onclick = () => {
        const username = document.getElementById('usernameInput').value.trim();
        if (username.length >= 2) { currentUser = username; localStorage.setItem('hsk_current_user', currentUser); checkAuth(); shootConfetti(); } 
        else { alert("Nhập tên hiển thị (ít nhất 2 ký tự) nhé!"); }
    };
}

function initSettingsUI() {
    const sPinyin = document.getElementById('setHidePinyin'); const sShuffle = document.getElementById('setShuffle');
    if(sPinyin) sPinyin.checked = appSettings.hidePinyin; if(sShuffle) sShuffle.checked = appSettings.shuffle;
}

window.saveSettings = function() {
    appSettings.hidePinyin = document.getElementById('setHidePinyin').checked; appSettings.shuffle = document.getElementById('setShuffle').checked;
    localStorage.setItem('hsk_settings', JSON.stringify(appSettings)); alert("Đã lưu cài đặt!");
};

window.resetAllData = function() {
    if (confirm("⚠️ CẢNH BÁO: Xóa TOÀN BỘ dữ liệu học tập?")) {
        if (confirm("Không thể khôi phục tiến trình. Tiếp tục?")) { localStorage.clear(); alert("Đã dọn dẹp bộ nhớ!"); window.location.reload(); }
    }
}

function updateGlobalProgress() {
    let totalMastered = 0; let totalTarget = 0;
    Object.keys(hskMasteredWords).forEach(lvl => { totalMastered += hskMasteredWords[lvl] ? hskMasteredWords[lvl].length : 0; totalTarget += hskLevelTotals[lvl] || 150; });
    if(totalTarget === 0) totalTarget = 1200; 
    let percent = Math.min(Math.round((totalMastered / totalTarget) * 100), 100);
    const percentText = document.getElementById('topProgressPercent'); const masteredWordsEl = document.getElementById('masteredWordsCount'); const totalWordsEl = document.getElementById('totalWordsTarget'); const sidebarProgressEl = document.getElementById('sidebarProgressText'); const sidebarBarEl = document.getElementById('sidebarProgressBar');
    if (percentText) percentText.innerText = `↗ ${percent}%`; if (masteredWordsEl) masteredWordsEl.innerText = totalMastered; if (totalWordsEl) totalWordsEl.innerText = totalTarget; if (sidebarProgressEl) sidebarProgressEl.innerText = `${percent}%`; if (sidebarBarEl) sidebarBarEl.style.width = `${percent}%`;
}

function renderLevelScores() {
    updateGlobalProgress();
    const ctx = document.getElementById('hskPieChart'); if(!ctx) return;
    const playedLevels = Object.keys(hskMasteredWords).sort();
    let levelsToDisplay = playedLevels.length > 0 ? playedLevels : ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];
    let labels = []; let dataCounts = []; let bgColors = ['#10B981', '#0EA5E9', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B']; 
    levelsToDisplay.forEach((lvl) => { let mastered = hskMasteredWords[lvl] ? hskMasteredWords[lvl].length : 0; labels.push(lvl); dataCounts.push(mastered); });
    const totalWords = dataCounts.reduce((a, b) => a + b, 0);
    if (totalWords === 0) { labels = ["Chưa học từ nào"]; dataCounts = [1]; bgColors = ['rgba(255,255,255,0.4)']; }
    if (hskChartInstance) { hskChartInstance.destroy(); }
    hskChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: dataCounts, backgroundColor: bgColors, borderWidth: 2, borderColor: 'transparent', hoverOffset: 4 }] }, options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { padding: 15, font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold', size: 11 } } } } } });
}

function updateProfileXP() {
    let totalMastered = 0; Object.keys(hskMasteredWords).forEach(lvl => { totalMastered += hskMasteredWords[lvl].length; });
    const xp = totalMastered * 5; const userProfileDiv = document.getElementById('userProfileBar'); const xpUI = document.getElementById('totalXpUI');
    if(xpUI) xpUI.innerText = `${xp} XP`;
    if(userProfileDiv) { userProfileDiv.innerHTML = `<div class="streak-badge"><i class='bx bxs-star'></i> ${xp} XP</div><div class="avatar"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=7C3AED&color=fff&bold=true" alt="User"></div>`; }
}

function switchTab(targetId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(targetId); if(target) target.classList.add('active');
    document.querySelectorAll('.nav-links a[data-target]').forEach(l => {
        if(l.getAttribute('data-target') === targetId) { l.classList.add('active'); const titleEl = document.getElementById('currentTabTitle'); if(titleEl) titleEl.innerText = l.innerText.trim(); } else { l.classList.remove('active'); }
    });
}
document.querySelectorAll('.nav-links a[data-target]').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); switchTab(link.getAttribute('data-target')); }); });

const levelGrid = document.getElementById('levelGrid');
if (levelGrid) { levels.forEach(lvl => { const btn = document.createElement('button'); btn.className = 'pill-btn'; btn.innerText = lvl; btn.onclick = () => { btn.classList.toggle('active'); const name = lvl.toLowerCase(); if (selectedLevels.includes(name)) selectedLevels = selectedLevels.filter(l => l !== name); else selectedLevels.push(name); }; levelGrid.appendChild(btn); }); }
document.querySelectorAll('.mode-btn').forEach(btn => {
    if(btn.parentElement.id !== 'grammarLevelGroup' && btn.parentElement.id !== 'learnLevelGroup') {
        btn.addEventListener('click', () => { btn.parentElement.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); selectedMode = btn.getAttribute('data-mode'); });
    }
});

const fileUpload = document.getElementById('fileUpload');
if (fileUpload) {
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = function(e) { const name = file.name.replace('.csv', ''); personalFiles[name] = e.target.result; localStorage.setItem('hsk_personal_files', JSON.stringify(personalFiles)); alert("Đã tải lên file: " + name); renderPersonalFiles(); loadGlobalDictionary(); initLearnView(); }; reader.readAsText(file);
    });
}
function renderPersonalFiles() {
    const list = document.getElementById('personalFilesList'); const selectGrid = document.getElementById('personalSelectGrid');
    if(!list || !selectGrid) return; list.innerHTML = ''; selectGrid.innerHTML = '';
    if (Object.keys(personalFiles).length === 0) { selectGrid.innerHTML = `<p class="muted">(Chưa có file nào uploaded)</p>`; }
    Object.keys(personalFiles).forEach(name => {
        const item = document.createElement('div'); item.className = 'file-item glass-panel'; item.innerHTML = `<h4><i class='bx bx-file' style="color: var(--color-blue); font-size:1.4rem;"></i> ${name}.csv</h4><button class="btn-delete" onclick="deleteFile('${name}')">Xóa tệp</button>`; list.appendChild(item);
        const btn = document.createElement('button'); btn.className = 'pill-btn'; if (selectedPersonalFiles.includes(name)) btn.classList.add('active'); btn.innerHTML = `<i class='bx bx-folder'></i> ${name}`;
        btn.onclick = () => { btn.classList.toggle('active'); if (selectedPersonalFiles.includes(name)) selectedPersonalFiles = selectedPersonalFiles.filter(l => l !== name); else selectedPersonalFiles.push(name); }; selectGrid.appendChild(btn);
    });
}
window.deleteFile = function(name) { if(confirm(`Bạn có chắc muốn xóa file ${name}?`)) { delete personalFiles[name]; localStorage.setItem('hsk_personal_files', JSON.stringify(personalFiles)); selectedPersonalFiles = selectedPersonalFiles.filter(l => l !== name); renderPersonalFiles(); loadGlobalDictionary(); initLearnView(); } }
renderPersonalFiles();


// ==========================================
// GAME LUYỆN TẬP CHÍNH
// ==========================================
function updateGameProgress() { const progressFill = document.getElementById('gameProgress'); if (progressFill && quizData.length > 0) { const percent = Math.round((currentIndex / quizData.length) * 100); progressFill.style.width = `${percent}%`; } }

const btnStart = document.getElementById('btnStart');
if (btnStart) {
    btnStart.onclick = async () => {
        if (selectedLevels.length === 0 && selectedPersonalFiles.length === 0) return alert("Vui lòng chọn ít nhất 1 Cấp độ hoặc File cá nhân!");
        btnStart.innerHTML = "ĐANG TẢI DỮ LIỆU... <i class='bx bx-loader-alt bx-spin'></i>"; quizData = [];
        for (let lvl of selectedLevels) {
            try { let res = await fetch(`${lvl}.csv`); if (!res.ok) res = await fetch(`${lvl.toLowerCase()}.csv`); if (res.ok) { const text = await res.text(); const parsed = Papa.parse(text, { skipEmptyLines: true }); const cleanData = parsed.data.filter(r => r.length >= 3 && r[0].trim() !== ""); const upperLvl = lvl.toUpperCase(); if(!hskLevelTotals[upperLvl]) { hskLevelTotals[upperLvl] = cleanData.length; localStorage.setItem('hsk_level_totals_v2', JSON.stringify(hskLevelTotals)); } quizData = [...quizData, ...cleanData.map(r => normalizeWordData(r, upperLvl))]; } } catch (e) {}
        }
        for (let name of selectedPersonalFiles) {
            const text = personalFiles[name]; const parsed = Papa.parse(text, { skipEmptyLines: true }); const cleanData = parsed.data.filter(r => r.length >= 3 && r[0].trim() !== ""); const upperName = name.toUpperCase(); if(!hskLevelTotals[upperName]) { hskLevelTotals[upperName] = cleanData.length; localStorage.setItem('hsk_level_totals_v2', JSON.stringify(hskLevelTotals)); } quizData = [...quizData, ...cleanData.map(r => normalizeWordData(r, upperName))];
        }
        if (quizData.length === 0) { btnStart.innerHTML = "BẮT ĐẦU CHIẾN NGAY <i class='bx bx-right-arrow-alt'></i>"; return alert("Dữ liệu trống!"); }
        if(appSettings.shuffle) { quizData.sort(() => Math.random() - 0.5); }
        hp = 5; currentIndex = 0; missedWords = []; isReviewMode = false;
        document.getElementById('hpDisplay').innerText = "❤️❤️❤️❤️❤️"; btnStart.innerHTML = "BẮT ĐẦU CHIẾN NGAY <i class='bx bx-right-arrow-alt'></i>";
        document.getElementById('gameScreen').style.display = 'block'; showQuestion();
    };
}

function showQuestion() {
    updateGameProgress();
    if (currentIndex >= quizData.length || hp <= 0) {
        if (missedWords.length > 0 && hp > 0) { document.getElementById('missedCount').innerText = missedWords.length; document.getElementById('reviewModal').style.display = 'flex'; }
        else { if(hp > 0) shootConfetti(); setTimeout(() => { alert(hp <= 0 ? "Hết tim rồi! 💔" : "Tuyệt vời! Đã hoàn thành! 🎉"); endGame(); }, 500); } return;
    }
    const currentWord = quizData[currentIndex]; const hanzi = currentWord[0] || ""; const pinyin = currentWord[1] || ""; const wordType = currentWord[2] || ""; const meaning = currentWord[3] || ""; const exHanzi = currentWord[4] || ""; const exPinyin = currentWord[5] || ""; const exMeaning = currentWord[6] || ""; const lvl = currentWord[7]; 
    document.getElementById('lvlBadge').innerText = isReviewMode ? "ÔN TẬP" : (lvl || "HSK").toUpperCase();
    const typeBadge = document.getElementById('typeBadge'); if (typeBadge) { if (wordType) { typeBadge.innerText = wordType; typeBadge.style.display = 'inline-block'; } else { typeBadge.style.display = 'none'; } }
    const mainQ = document.getElementById('mainQuestion'); const subQ = document.getElementById('subQuestion'); const answerContainer = document.getElementById('answerContainer'); const typingContainer = document.getElementById('typingContainer'); const pinyinInput = document.getElementById('pinyinInput'); const btnReveal = document.getElementById('btnRevealPinyin'); const sentenceContainer = document.getElementById('sentenceContainer'); const sentenceHanziEl = document.getElementById('sentenceHanzi'); const sentencePinyinEl = document.getElementById('sentencePinyin'); const sentenceMeaningEl = document.getElementById('sentenceMeaning');
    let correctAnswer = ""; let hiddenText = ""; answerContainer.classList.remove('hanzi-mode');

    if (selectedMode === "GÕ PINYIN") {
        mainQ.innerText = hanzi; mainQ.style.fontSize = "5.5rem"; hiddenText = meaning; answerContainer.style.display = 'none'; typingContainer.style.display = 'block'; pinyinInput.value = ''; setTimeout(() => pinyinInput.focus(), 100); 
    } else {
        typingContainer.style.display = 'none'; answerContainer.style.display = 'grid';
        if (selectedMode === "NGHĨA") { mainQ.innerText = hanzi; mainQ.style.fontSize = "5.5rem"; hiddenText = pinyin; correctAnswer = meaning; } else if (selectedMode === "PINYIN") { mainQ.innerText = hanzi; mainQ.style.fontSize = "5.5rem"; hiddenText = meaning; correctAnswer = pinyin; } else { mainQ.innerText = meaning; mainQ.style.fontSize = "3.2rem"; hiddenText = pinyin; correctAnswer = hanzi; answerContainer.classList.add('hanzi-mode'); }
        renderAnswers(correctAnswer, lvl ? lvl.toUpperCase() : "CUSTOM");
    }
    if (appSettings.hidePinyin && selectedMode !== "PINYIN" && selectedMode !== "GÕ PINYIN") { subQ.innerText = "****"; btnReveal.style.display = 'flex'; btnReveal.onclick = () => { subQ.innerText = hiddenText; btnReveal.style.display = 'none'; }; } else { subQ.innerText = hiddenText; btnReveal.style.display = 'none'; }
    if (exHanzi && sentenceContainer) { sentenceContainer.style.display = 'block'; let displaySentenceHanzi = exHanzi; if (selectedMode === "CHỮ HÁN") displaySentenceHanzi = exHanzi.split(hanzi).join(`<span class="highlight-word">[___]</span>`); else displaySentenceHanzi = exHanzi.split(hanzi).join(`<span class="highlight-word">${hanzi}</span>`); sentenceHanziEl.innerHTML = displaySentenceHanzi; sentencePinyinEl.innerText = exPinyin; sentenceMeaningEl.innerText = exMeaning; if (appSettings.hidePinyin) sentencePinyinEl.style.display = 'none'; else sentencePinyinEl.style.display = 'block'; } else if (sentenceContainer) { sentenceContainer.style.display = 'none'; }
}

window.handlePinyinEnter = function(e) { if (e.key === 'Enter') { e.preventDefault(); window.checkTypingAnswer(); } };
window.checkTypingAnswer = function() {
    const freshInput = document.getElementById('pinyinInput'); if (!freshInput) return; const userInput = freshInput.value; 
    if (!userInput || !userInput.trim()) { alert("Vui lòng gõ đáp án Pinyin vào ô trống nhé!"); freshInput.focus(); return; }
    const currentWord = quizData[currentIndex]; if (!currentWord) return;
    const hanzi = currentWord[0]; const correctPinyin = currentWord[1] || ""; const currentLevel = (currentWord[7] || "CUSTOM").toUpperCase();
    if (normalizePinyin(userInput) === normalizePinyin(correctPinyin)) { playSound('correct'); recordCorrectWord(currentLevel, hanzi); if(isReviewMode) window.removeGlobalMissedWord(currentLevel, hanzi); currentIndex++; showQuestion(); } else { hp--; playSound('wrong'); alert(`Sai rồi! Đáp án đúng: ${correctPinyin}`); document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp)); if(!isReviewMode) missedWords.push(quizData[currentIndex]); else quizData.push(quizData[currentIndex]); recordMissedWordGlobal(quizData[currentIndex], currentLevel); currentIndex++; showQuestion(); }
};

function renderAnswers(correct, currentLevel) {
    const container = document.getElementById('answerContainer'); container.innerHTML = "";
    const colIndex = selectedMode === "NGHĨA" ? 3 : (selectedMode === "PINYIN" ? 1 : 0); 
    let pool = [...new Set(quizData.map(r => r[colIndex]))];
    if (pool.length < 4 && globalDictionary && globalDictionary.length > 4) { let extraPool = [...new Set(globalDictionary.map(r => r[colIndex]))]; pool = [...new Set([...pool, ...extraPool])]; }
    let choices = [correct]; while (choices.length < 4 && pool.length >= 4) { let rand = pool[Math.floor(Math.random() * pool.length)]; if (!choices.includes(rand)) choices.push(rand); } choices.sort(() => Math.random() - 0.5);
    choices.forEach(text => {
        const btn = document.createElement('button'); btn.className = "ans-btn glass-panel"; btn.innerText = text;
        btn.onclick = () => {
            const hanzi = quizData[currentIndex][0]; 
            if (text === correct) { playSound('correct'); recordCorrectWord(currentLevel, hanzi); if(isReviewMode) window.removeGlobalMissedWord(currentLevel, hanzi); currentIndex++; showQuestion(); }
            else { hp--; playSound('wrong'); alert(`Sai rồi! Đáp án đúng: ${correct}`); document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp)); if(!isReviewMode) missedWords.push(quizData[currentIndex]); else quizData.push(quizData[currentIndex]); recordMissedWordGlobal(quizData[currentIndex], currentLevel); currentIndex++; showQuestion(); }
        }; container.appendChild(btn);
    });
}
window.endGame = function() { document.getElementById('reviewModal').style.display = 'none'; document.getElementById('gameScreen').style.display = 'none'; updateProfileXP(); renderLevelScores(); switchTab('dashboard-view'); }


// ==========================================
// TỪ VỰNG SAI, WEB HỮU ÍCH & ÔN TẬP TỔNG
// ==========================================
function recordMissedWordGlobal(wordData, level) {
    let lvl = (level || "CUSTOM").toUpperCase(); if(!globalMissedWords[lvl]) globalMissedWords[lvl] = [];
    if(!globalMissedWords[lvl].find(w => w[0] === wordData[0])) { globalMissedWords[lvl].push(wordData); localStorage.setItem('hsk_global_missed_words', JSON.stringify(globalMissedWords)); } renderGlobalMissedWords();
}
window.removeGlobalMissedWord = function(lvl, hanzi) {
    if(globalMissedWords[lvl]) { globalMissedWords[lvl] = globalMissedWords[lvl].filter(w => w[0] !== hanzi); localStorage.setItem('hsk_global_missed_words', JSON.stringify(globalMissedWords)); renderGlobalMissedWords(); }
}
function renderGlobalMissedWords() {
    const container = document.getElementById('globalMissedWordsContainer'); if(!container) return; container.innerHTML = ""; let hasData = false;
    Object.keys(globalMissedWords).sort().forEach(lvl => {
        if(globalMissedWords[lvl] && globalMissedWords[lvl].length > 0) {
            hasData = true; const lvlGroup = document.createElement('div'); lvlGroup.style.marginBottom = "20px"; lvlGroup.innerHTML = `<h4 style="color:var(--color-purple); margin-bottom:12px; display:flex; align-items:center; gap:8px;">${lvl} <span class="badge-pill" style="background:rgba(255,255,255,0.6); color:#475569; border: 1px solid rgba(255,255,255,0.8);">${globalMissedWords[lvl].length} từ</span></h4>`;
            const listContainer = document.createElement('div'); listContainer.style.display = "flex"; listContainer.style.flexDirection = "column"; listContainer.style.gap = "12px";
            globalMissedWords[lvl].forEach(w => {
                const wordCard = document.createElement('div'); wordCard.style.cssText = "background:rgba(255,255,255,0.4); border:1px solid rgba(255,255,255,0.6); padding:14px 18px; border-radius:12px; display:flex; align-items:center; gap:16px; box-shadow: inset 0 1px 3px rgba(255,255,255,0.6), var(--glass-shadow); backdrop-filter: blur(8px);";
                wordCard.innerHTML = `<div style="font-size:1.8rem; font-weight:800; color:#0F172A; font-family:'Quicksand', sans-serif; min-width:60px; text-align:center;">${w[0]}</div><div style="display:flex; flex-direction:column; flex: 1;"><span style="font-size:1rem; font-weight:800; color:var(--color-blue); margin-bottom:4px; text-shadow: 0 1px 1px rgba(255,255,255,0.8);">${w[1]}</span><span style="font-size:0.9rem; color:#475569; line-height:1.4; font-weight:600;">${w[3]}</span></div><button onclick="removeGlobalMissedWord('${lvl}', '${w[0]}')" title="Đã thuộc từ này" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#065F46; border-radius:8px; cursor:pointer; padding:8px 10px; font-size:1.2rem; display:flex; align-items:center; justify-content:center; transition: all 0.2s; backdrop-filter: blur(4px);"><i class='bx bx-check'></i></button>`;
                listContainer.appendChild(wordCard);
            }); lvlGroup.appendChild(listContainer); container.appendChild(lvlGroup);
        }
    });
    if(!hasData) { container.innerHTML = `<div style="text-align:center; padding:40px; background:rgba(255,255,255,0.3); border-radius:12px; border:1px dashed rgba(255,255,255,0.8); backdrop-filter:blur(8px);"><p class="muted" style="font-size:1rem; color:#1E293B; font-weight:600;">Tuyệt vời! Bạn chưa có từ vựng nào bị hổng kiến thức. 🎉</p></div>`; }
}
window.addNewLink = function() {
    const nameInput = document.getElementById('linkName'); const urlInput = document.getElementById('linkUrl'); const name = nameInput.value.trim(); let url = urlInput.value.trim();
    if(name && url) { if(!url.startsWith('http')) url = 'https://' + url; usefulLinks.push({name, url}); localStorage.setItem('hsk_useful_links', JSON.stringify(usefulLinks)); nameInput.value = ''; urlInput.value = ''; renderUsefulLinks(); } else { alert("Vui lòng nhập đủ tên và đường dẫn web nhé!"); }
}
window.removeLink = function(index) { usefulLinks.splice(index, 1); localStorage.setItem('hsk_useful_links', JSON.stringify(usefulLinks)); renderUsefulLinks(); }
function renderUsefulLinks() {
    const container = document.getElementById('usefulLinksContainer'); if(!container) return; container.innerHTML = "";
    if(usefulLinks.length === 0) { container.innerHTML = `<p class="muted" style="margin-bottom:15px; font-style:italic;">Chưa có liên kết nào. Hãy ghim các web bạn hay dùng vào đây nhé!</p>`; return; }
    const list = document.createElement('div'); list.style.display = "flex"; list.style.flexDirection = "column"; list.style.gap = "8px"; list.style.marginBottom = "15px";
    usefulLinks.forEach((link, idx) => {
        const item = document.createElement('div'); item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.4); padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.6); transition: all 0.2s; backdrop-filter: blur(8px);";
        item.onmouseover = () => { item.style.background = "rgba(255,255,255,0.7)"; item.style.transform = "translateY(-1px)"; }; item.onmouseout = () => { item.style.background = "rgba(255,255,255,0.4)"; item.style.transform = "translateY(0)"; };
        item.innerHTML = `<a href="${link.url}" target="_blank" style="text-decoration:none; font-weight:700; color:var(--color-blue); display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; text-shadow: 0 1px 1px rgba(255,255,255,0.8);"><i class='bx bx-link-external'></i> ${link.name}</a><button onclick="removeLink(${idx})" style="background:none; border:none; color:#94A3B8; cursor:pointer; padding: 4px;"><i class='bx bx-trash'></i></button>`; list.appendChild(item);
    }); container.appendChild(list);
}
window.startGlobalReviewMode = function() {
    let allMissed = []; Object.keys(globalMissedWords).forEach(lvl => { if(globalMissedWords[lvl]) { allMissed = allMissed.concat(globalMissedWords[lvl]); } });
    if (allMissed.length === 0) { alert("Tuyệt vời! Bạn chưa có từ vựng nào cần ôn tập cả. 🎉"); return; }
    quizData = [...allMissed]; if(appSettings.shuffle) { quizData.sort(() => Math.random() - 0.5); }
    hp = 5; currentIndex = 0; missedWords = []; isReviewMode = true; document.getElementById('hpDisplay').innerText = "❤️❤️❤️❤️❤️";
    document.getElementById('reviewModal').style.display = 'none'; document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active')); document.getElementById('gameScreen').style.display = 'block'; showQuestion();
}
window.startReviewMode = function() { document.getElementById('reviewModal').style.display = 'none'; quizData = [...missedWords]; missedWords = []; currentIndex = 0; isReviewMode = true; hp = 3; document.getElementById('hpDisplay').innerText = "❤️❤️❤️"; showQuestion(); }

// ==========================================
// HỌC TỪ VỰNG TỔNG QUAN (VIEW GRID 1.5)
// ==========================================
function initLearnView() {
    const group = document.getElementById('learnLevelGroup'); if(!group) return; group.innerHTML = '';
    levels.forEach(lvl => { const btn = document.createElement('button'); btn.className = 'mode-btn'; btn.innerText = lvl; btn.onclick = () => loadLearnVocabulary(lvl, btn, false); group.appendChild(btn); });
    Object.keys(personalFiles).forEach(name => { const btn = document.createElement('button'); btn.className = 'mode-btn'; btn.innerHTML = `<i class='bx bx-folder'></i> ${name}`; btn.onclick = () => loadLearnVocabulary(name, btn, true); group.appendChild(btn); });
    if(levels.length > 0) { setTimeout(() => loadLearnVocabulary(levels[0], group.firstChild, false), 500); }
}

async function loadLearnVocabulary(level, btnNode, isPersonal = false) {
    const group = document.getElementById('learnLevelGroup'); if(group) { group.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active')); } if(btnNode) btnNode.classList.add('active');
    const container = document.getElementById('learnContentArea'); container.innerHTML = `<div style="text-align:center; padding:40px;"><i class='bx bx-loader-alt bx-spin' style="font-size:2.5rem; color:var(--color-purple);"></i><p style="margin-top:10px; font-weight:700; color:#475569;">Đang trích xuất dữ liệu ${level}...</p></div>`;
    let vocabData = [];
    if (isPersonal) {
        const text = personalFiles[level]; const parsed = Papa.parse(text, { skipEmptyLines: true });
        vocabData = parsed.data.filter(r => r.length >= 3 && r[0].trim() !== "").map(r => normalizeWordData(r, level.toUpperCase())); renderLearnList(vocabData);
    } else {
        try { let res = await fetch(`${level}.csv`); if (!res.ok) res = await fetch(`${level.toLowerCase()}.csv`); if (res.ok) { const text = await res.text(); const parsed = Papa.parse(text, { skipEmptyLines: true }); vocabData = parsed.data.filter(r => r.length >= 3 && r[0].trim() !== "").map(r => normalizeWordData(r, level.toUpperCase())); renderLearnList(vocabData); } else { container.innerHTML = `<div style="text-align:center; padding:30px; background:rgba(255,255,255,0.3); border-radius:16px; border:1px dashed rgba(255,255,255,0.8);"><p class="muted">Không tìm thấy file dữ liệu cho ${level}.</p></div>`; } } catch (e) { container.innerHTML = `<p class="muted" style="text-align:center;">Lỗi tải dữ liệu.</p>`; }
    }
}

function renderLearnList(data) {
    const container = document.getElementById('learnContentArea');
    if(data.length === 0) { container.innerHTML = `<div style="text-align:center; padding:30px; background:rgba(255,255,255,0.3); border-radius:16px; border:1px dashed rgba(255,255,255,0.8);"><p class="muted">Danh sách từ vựng trống.</p></div>`; return; }
    
    // Tạo cấu trúc Grid cho View Học Từ Vựng
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
    container.style.gap = "16px";
    
    container.innerHTML = data.map((w, idx) => {
        const hanzi = w[0]; const pinyin = w[1]; const type = w[2]; const meaning = w[3]; const exHanzi = w[4] || ""; const exPinyin = w[5] || ""; const exMeaning = w[6] || "";
        let exampleHTML = "";
        if(exHanzi) {
             const highlightedEx = exHanzi.split(hanzi).join(`<span style="color:var(--color-pink); font-weight:800;">${hanzi}</span>`);
             exampleHTML = `<div class="learn-ex-scroll" style="margin-top: auto; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,0.1); max-height: 80px; overflow-y: auto;"><p style="font-size:1.05rem; font-family:'Quicksand', sans-serif; font-weight:700; color:#1E293B; margin-bottom:4px; line-height:1.3;">${highlightedEx}</p><p style="font-size:0.9rem; color:var(--color-blue); margin-bottom:2px; font-weight:600;">${exPinyin}</p><p style="font-size:0.85rem; color:#475569; font-style:italic; line-height:1.3;">${exMeaning}</p></div>`;
        }
        return `
            <div style="background:rgba(255,255,255,0.4); border:1px solid rgba(255,255,255,0.6); padding:20px; border-radius:16px; box-shadow: inset 0 1px 3px rgba(255,255,255,0.6), var(--glass-shadow); backdrop-filter: blur(8px); display:flex; flex-direction:column; height: 100%; min-height: 180px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                    <div style="font-size: 3.5rem; font-weight:800; font-family:'Quicksand', sans-serif; color:#0F172A; text-shadow: 0 2px 10px rgba(255,255,255,0.8); line-height: 1;">${hanzi}</div>
                    <div style="font-size: 0.8rem; font-weight:800; color:#64748B; background:rgba(255,255,255,0.6); padding:4px 10px; border-radius:8px; border: 1px solid rgba(255,255,255,0.8);">#${idx + 1}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <span style="font-size:1.2rem; font-weight:800; color:var(--color-blue); text-shadow: 0 1px 1px rgba(255,255,255,0.8);">${pinyin}</span>
                    ${type ? `<span style="font-size:0.75rem; font-weight:800; padding:2px 8px; background:rgba(124,58,237,0.15); color:var(--color-purple); border-radius:6px; border: 1px solid rgba(124,58,237,0.3);">${type}</span>` : ''}
                </div>
                <p style="font-size:1.05rem; color:#1E293B; font-weight:700; line-height:1.4; margin-bottom: 10px;">${meaning}</p>
                ${exampleHTML}
            </div>
        `;
    }).join('');
}

checkAuth();
