// ==========================================
// 1. BIẾN TRẠNG THÁI VÀ DỮ LIỆU CỐT LÕI
// ==========================================
const levels = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];
let selectedLevels = [];
let selectedPersonalFiles = [];
let selectedMode = "NGHĨA";
let quizData = [];
let currentIndex = 0;
let hp = 5;
let missedWords = []; 
let isReviewMode = false;

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

let matchGameSelected = [];
let matchedCount = 0;
let globalDictionary = [];

// ==========================================
// 2. DATA TRÍCH DẪN & HÌNH NỀN
// ==========================================
const motivationalBgImages = [
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?q=80&w=800&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=800&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1520034475321-cbe63696469a?q=80&w=800&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1497561813398-8fcc7a37b567?q=80&w=800&auto=format&fit=crop"  
];

const motivationalQuotes = [
    { hanzi: "不怕慢，就怕停。", pinyin: "Bù pà màn, jiù pà tíng.", meaning: "Không sợ chậm, chỉ sợ dừng." },
    { hanzi: "千里之行，始于足下。", pinyin: "Qiān lǐ zhī xíng, shǐ yú zú xià.", meaning: "Đường đi ngàn dặm bắt đầu từ một bước chân." },
    { hanzi: "学如逆水行舟，不进则退。", pinyin: "Xué rú nì shuǐ xíng zhōu, bù jìn zé tuì.", meaning: "Học như thuyền ngược dòng, không tiến ắt lùi." },
    { hanzi: "只要功夫深，铁杵磨成针。", pinyin: "Zhǐ yào gōng fū shēn, tiě chǔ mó chéng zhēn.", meaning: "Có công mài sắt, có ngày nên kim." },
    { hanzi: "熟能生巧。", pinyin: "Shú néng shēng qiǎo.", meaning: "Trăm hay không bằng tay quen." },
    { hanzi: "万事开头难。", pinyin: "Wàn shì kāi tóu nán.", meaning: "Vạn sự khởi đầu nan." },
    { hanzi: "吃得苦中苦，方为人上人。", pinyin: "Chī dé kǔ zhōng kǔ, fāng wéi rén shàng rén.", meaning: "Chịu được khổ trong khổ, mới làm được người trên người." }
];

// ==========================================
// 3. TẢI TỪ VỰNG GLOBAL & SEARCH
// ==========================================
async function loadGlobalDictionary() {
    globalDictionary = [];
    
    Object.keys(personalFiles).forEach(name => {
        const parsed = Papa.parse(personalFiles[name], { skipEmptyLines: true });
        parsed.data.forEach(r => { if(r.length >= 3) globalDictionary.push([...r, name.toUpperCase()]) });
    });

    const fetchPromises = levels.map(async (lvl) => {
        try {
            let res = await fetch(`${lvl}.csv`);
            if (!res.ok) res = await fetch(`${lvl.toLowerCase()}.csv`);
            if (res.ok) {
                const text = await res.text();
                const parsed = Papa.parse(text, { skipEmptyLines: true });
                parsed.data.forEach(r => { if(r.length >= 3) globalDictionary.push([...r, lvl.toUpperCase()]) });
            }
        } catch (e) {}
    });
    await Promise.all(fetchPromises);
}

const searchInput = document.getElementById('globalSearchInput');
const searchBox = document.getElementById('searchResultsBox');
if(searchInput) {
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        if(query.length < 1) { searchBox.style.display = 'none'; return; }
        
        const results = globalDictionary.filter(word => {
            return (word[0] && word[0].toLowerCase().includes(query)) || 
                   (word[1] && word[1].toLowerCase().includes(query)) || 
                   (word[2] && word[2].toLowerCase().includes(query));
        }).slice(0, 15);

        if(results.length > 0) {
            searchBox.innerHTML = results.map(w => `
                <div class="search-item">
                    <div>
                        <span class="search-item-hanzi">${w[0]}</span>
                        <span class="search-item-detail">${w[1]} - ${w[2]}</span>
                    </div>
                    <span class="search-item-lvl">${w[w.length-1]}</span>
                </div>
            `).join('');
            searchBox.style.display = 'block';
        } else {
            searchBox.innerHTML = `<div style="padding:15px; color:#94A3B8; text-align:center;">Không tìm thấy từ vựng nào!</div>`;
            searchBox.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if(!searchInput.contains(e.target) && !searchBox.contains(e.target)) {
            searchBox.style.display = 'none';
        }
    });
}

// ==========================================
// 4. HỆ THỐNG ÂM THANH
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    
    if(type === 'pop') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
}

// ==========================================
// 5. CÂU NÓI ĐỘNG LỰC & LỊCH STREAK
// ==========================================
function renderDailyQuote() {
    const dayNumber = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const quote = motivationalQuotes[dayNumber % motivationalQuotes.length];
    const bgUrl = motivationalBgImages[dayNumber % motivationalBgImages.length];
    
    const card = document.getElementById('dailyQuoteCard');
    const hanziEl = document.getElementById('dailyQuoteHanzi');
    const pinyinEl = document.getElementById('dailyQuotePinyin');
    const meaningEl = document.getElementById('dailyQuoteMeaning');
    
    if (hanziEl && card) {
        hanziEl.innerText = quote.hanzi;
        pinyinEl.innerText = quote.pinyin;
        meaningEl.innerText = quote.meaning;
        card.style.backgroundImage = `url('${bgUrl}')`;
    }
}

function processStreakCalendar() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    
    if (!loginHistory.includes(todayStr)) {
        loginHistory.push(todayStr);
        localStorage.setItem('hsk_login_history', JSON.stringify(loginHistory));
    }

    currentStreak = 0;
    let checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    while(true) {
        let checkStr = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
        if(loginHistory.includes(checkStr)) {
            currentStreak++; checkDate.setDate(checkDate.getDate() - 1); 
        } else { break; }
    }
    
    const streakUI = document.getElementById('streakCountUI');
    if (streakUI) streakUI.innerText = currentStreak;

    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calendarMonth');
    if(!grid) return;
    grid.innerHTML = "";
    
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
    if(monthLabel) monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 
    const daysInPrevMonth = new Date(year, month, 0).getDate(); 
    
    let startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

    for(let i = startOffset - 1; i >= 0; i--) { 
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.innerText = daysInPrevMonth - i;
        grid.appendChild(cell);
    }
    
    for(let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day current-month';
        cell.innerText = i;
        
        let cellDateStr = `${year}-${month + 1}-${i}`;
        if (i === d.getDate()) cell.classList.add('today');
        if (loginHistory.includes(cellDateStr)) cell.classList.add('active');
        grid.appendChild(cell);
    }
    
    const totalCells = startOffset + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for(let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.innerText = i;
        grid.appendChild(cell);
    }
}

// ==========================================
// 6. THỐNG KÊ UNIQUE TỪ VỰNG
// ==========================================
function recordCorrectWord(level, hanziWord) {
    if(!isReviewMode) {
        if(!hskMasteredWords[level]) hskMasteredWords[level] = [];
        if(!hskMasteredWords[level].includes(hanziWord)) {
            hskMasteredWords[level].push(hanziWord);
            localStorage.setItem('hsk_mastered_words_v2', JSON.stringify(hskMasteredWords));
        }
    }
}

function updateGlobalProgress() {
    let totalMastered = 0; let totalTarget = 0;
    Object.keys(hskMasteredWords).forEach(lvl => {
        totalMastered += hskMasteredWords[lvl] ? hskMasteredWords[lvl].length : 0;
        totalTarget += hskLevelTotals[lvl] || 100; 
    });

    let percent = totalTarget === 0 ? 0 : Math.min(Math.round((totalMastered / totalTarget) * 100), 100);

    const circle = document.getElementById('topProgressCircle');
    const percentText = document.getElementById('topProgressPercent');
    const detailText = document.getElementById('topProgressText');

    if (circle && percentText && detailText) {
        percentText.innerText = `${percent}%`;
        detailText.innerHTML = `${totalMastered} / ${totalTarget} từ<br><span style="font-size: 0.8rem; opacity: 0.8;">Đã master</span>`;
        circle.style.background = `conic-gradient(#10B981 ${percent}%, rgba(255,255,255,0.5) 0deg)`;
    }
}

function renderLevelScores() {
    const list = document.getElementById('levelStatsList');
    if(!list) return;
    list.innerHTML = "";
    
    const playedLevels = Object.keys(hskMasteredWords).sort();
    if(playedLevels.length === 0) {
        list.innerHTML = `<p class="muted" style="text-align: center; padding: 20px;">Bạn chưa master từ nào. Chơi game thôi!</p>`;
        updateGlobalProgress(); return;
    }

    playedLevels.forEach(lvl => {
        let mastered = hskMasteredWords[lvl].length;
        let maxWords = hskLevelTotals[lvl] || 100; 
        const percent = Math.min(Math.round((mastered / maxWords) * 100), 100);
        
        const item = document.createElement('div');
        item.className = 'stat-row';
        item.innerHTML = `
            <div class="stat-info-wrap">
                <div class="stat-lvl-name"><i class='bx bx-medal' style="color: var(--accent-yellow-text); font-size: 1.5rem;"></i> ${lvl}</div>
                <div class="stat-score">${mastered} TỪ</div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
            <div class="muted" style="text-align: right; font-weight: 700;">Đã master: ${mastered} / ${maxWords} (${percent}%)</div>
        `;
        list.appendChild(item);
    });
    updateGlobalProgress();
}

function updateProfileXP() {
    let totalMastered = 0;
    Object.keys(hskMasteredWords).forEach(lvl => { totalMastered += hskMasteredWords[lvl].length; });
    const xp = totalMastered * 5; 

    const userProfileDiv = document.getElementById('userProfileBar');
    if(userProfileDiv) {
        userProfileDiv.innerHTML = `
            <div class="streak-badge"><i class='bx bxs-star' style="color: #F59E0B; font-size:1.2rem;"></i> ${xp} XP</div>
            <div class="avatar"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=4F46E5&color=fff&bold=true" alt="User"></div>
        `;
    }
}

// ==========================================
// 7. KHỞI TẠO APP
// ==========================================
function checkAuth() {
    const authModal = document.getElementById('authModal');
    if (!currentUser) {
        if (authModal) authModal.style.display = 'flex';
    } else {
        if (authModal) authModal.style.display = 'none';
        loadGlobalDictionary(); processStreakCalendar(); updateProfileXP(); renderLevelScores();
        initSettingsUI(); renderDailyQuote();
    }
}

const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
    btnLogin.onclick = () => {
        const username = document.getElementById('usernameInput').value.trim();
        if (username.length >= 2) {
            currentUser = username; localStorage.setItem('hsk_current_user', currentUser);
            checkAuth(); shootConfetti(); 
        } else { alert("Nhập tên hiển thị (ít nhất 2 ký tự) nhé!"); }
    };
}

function initSettingsUI() {
    const sPinyin = document.getElementById('setHidePinyin');
    const sShuffle = document.getElementById('setShuffle');
    if(sPinyin) sPinyin.checked = appSettings.hidePinyin;
    if(sShuffle) sShuffle.checked = appSettings.shuffle;
}

window.saveSettings = function() {
    appSettings.hidePinyin = document.getElementById('setHidePinyin').checked;
    appSettings.shuffle = document.getElementById('setShuffle').checked;
    localStorage.setItem('hsk_settings', JSON.stringify(appSettings));
    alert("Đã lưu cài đặt!");
};

window.resetAllData = function() {
    if (confirm("⚠️ CẢNH BÁO: Xóa TOÀN BỘ dữ liệu học tập?")) {
        if (confirm("Không thể khôi phục lại Điểm số, Streak, Tên và File. Tiếp tục?")) {
            localStorage.clear(); alert("Đã dọn dẹp bộ nhớ!"); window.location.reload();
        }
    }
}

// ==========================================
// 8. ĐIỀU HƯỚNG TABS & QUẢN LÝ FILE
// ==========================================
function switchTab(targetId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active');
    document.querySelectorAll('.nav-links a[data-target]').forEach(l => {
        if(l.getAttribute('data-target') === targetId) l.classList.add('active'); else l.classList.remove('active');
    });
}
document.querySelectorAll('.nav-links a[data-target]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); switchTab(link.getAttribute('data-target')); });
});

const levelGrid = document.getElementById('levelGrid');
if (levelGrid) {
    levels.forEach(lvl => {
        const btn = document.createElement('button');
        btn.className = 'pill-btn'; btn.innerText = lvl;
        btn.onclick = () => {
            btn.classList.toggle('active');
            const name = lvl.toLowerCase();
            if (selectedLevels.includes(name)) selectedLevels = selectedLevels.filter(l => l !== name);
            else selectedLevels.push(name);
        };
        levelGrid.appendChild(btn);
    });
}

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); selectedMode = btn.getAttribute('data-mode');
    };
});

const fileUpload = document.getElementById('fileUpload');
if (fileUpload) {
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const name = file.name.replace('.csv', '');
            personalFiles[name] = e.target.result;
            localStorage.setItem('hsk_personal_files', JSON.stringify(personalFiles));
            alert("Đã tải lên file: " + name); renderPersonalFiles(); loadGlobalDictionary(); 
        };
        reader.readAsText(file);
    });
}

function renderPersonalFiles() {
    const list = document.getElementById('personalFilesList');
    const selectGrid = document.getElementById('personalSelectGrid');
    if(!list || !selectGrid) return;
    list.innerHTML = ''; selectGrid.innerHTML = '';

    if (Object.keys(personalFiles).length === 0) { selectGrid.innerHTML = `<p class="muted">(Chưa có file nào)</p>`; }
    Object.keys(personalFiles).forEach(name => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<h4><i class='bx bx-file' style="color: var(--accent-sky-text); font-size:1.5rem;"></i> ${name}.csv</h4>
                          <button class="btn-delete" onclick="deleteFile('${name}')">Xóa</button>`;
        list.appendChild(item);

        const btn = document.createElement('button');
        btn.className = 'pill-btn';
        if (selectedPersonalFiles.includes(name)) btn.classList.add('active');
        btn.innerHTML = `<i class='bx bx-folder'></i> ${name}`;
        btn.onclick = () => {
            btn.classList.toggle('active');
            if (selectedPersonalFiles.includes(name)) selectedPersonalFiles = selectedPersonalFiles.filter(l => l !== name);
            else selectedPersonalFiles.push(name);
        };
        selectGrid.appendChild(btn);
    });
}
window.deleteFile = function(name) {
    if(confirm(`Bạn có chắc muốn xóa file ${name}?`)) {
        delete personalFiles[name];
        localStorage.setItem('hsk_personal_files', JSON.stringify(personalFiles));
        selectedPersonalFiles = selectedPersonalFiles.filter(l => l !== name);
        renderPersonalFiles(); loadGlobalDictionary(); 
    }
}
renderPersonalFiles();

// ==========================================
// 9. MINI GAME: GHÉP TỪ
// ==========================================
window.startMatchGame = async function() {
    const diffSelect = document.getElementById('miniGameDifficulty');
    const countSelect = document.getElementById('miniGameWordCount');
    let difficulty = diffSelect ? diffSelect.value : 'easy';
    let count = countSelect ? parseInt(countSelect.value) : 5;

    let filesToLoad = [];
    if (difficulty === 'easy') filesToLoad = ['HSK1', 'HSK2'];
    else if (difficulty === 'medium') filesToLoad = ['HSK3', 'HSK4'];
    else if (difficulty === 'hard') filesToLoad = ['HSK5', 'HSK6'];

    document.getElementById('wordMatchGameScreen').style.display = 'block';
    const container = document.getElementById('floatingBubblesContainer');
    container.innerHTML = `<h3 style="color:var(--text-secondary);">Đang tìm kiếm dữ liệu... <i class='bx bx-loader-alt bx-spin'></i></h3>`;

    let allWords = [];
    const fetchPromises = filesToLoad.map(async (lvl) => {
        try {
            let res = await fetch(`${lvl}.csv`);
            if (!res.ok) res = await fetch(`${lvl.toLowerCase()}.csv`);
            if (res.ok) {
                const text = await res.text();
                const parsed = Papa.parse(text, { skipEmptyLines: true });
                return parsed.data;
            }
        } catch (e) { return []; }
        return [];
    });

    const results = await Promise.all(fetchPromises);
    results.forEach(data => { allWords = [...allWords, ...data]; });
    allWords = allWords.filter(row => row.length >= 3 && row[0] !== undefined && row[0].trim() !== "");
    
    if (allWords.length === 0) {
        container.innerHTML = `<h3 style="color:var(--accent-pink-text);">Không tìm thấy file ${difficulty.toUpperCase()} nào!</h3>`;
        return;
    }

    allWords.sort(() => Math.random() - 0.5);
    let wordsForGame = allWords.slice(0, count);

    matchedCount = 0; matchGameSelected = [];
    document.getElementById('matchProgressText').innerText = `0 / ${count}`;
    container.innerHTML = "";

    let allBubbles = [];
    wordsForGame.forEach((word, idx) => {
        allBubbles.push({ id: idx, type: 'hanzi', text: word[0] });
        allBubbles.push({ id: idx, type: 'pinyin', text: word[1] });
        allBubbles.push({ id: idx, type: 'meaning', text: word[2] });
    });
    
    allBubbles.sort(() => Math.random() - 0.5); 
    allBubbles.forEach((b, i) => {
        const bubble = document.createElement('div');
        bubble.className = `match-bubble ${b.type}`;
        bubble.innerText = b.text;
        bubble.dataset.id = b.id; bubble.dataset.type = b.type;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        bubble.onclick = () => handleBubbleClick(bubble, count);
        container.appendChild(bubble);
    });
}

function handleBubbleClick(bubble, totalCount) {
    if (bubble.classList.contains('correct') || bubble.classList.contains('wrong')) return;
    playSound('pop'); 
    const bType = bubble.dataset.type;

    if (bubble.classList.contains('selected')) {
        bubble.classList.remove('selected');
        matchGameSelected = matchGameSelected.filter(node => node !== bubble);
        return;
    }

    const existingTypeNode = matchGameSelected.find(n => n.dataset.type === bType);
    if (existingTypeNode) {
        existingTypeNode.classList.remove('selected');
        matchGameSelected = matchGameSelected.filter(n => n !== existingTypeNode);
    }

    bubble.classList.add('selected');
    matchGameSelected.push(bubble);

    if (matchGameSelected.length === 3) {
        const id1 = matchGameSelected[0].dataset.id;
        const id2 = matchGameSelected[1].dataset.id;
        const id3 = matchGameSelected[2].dataset.id;

        if (id1 === id2 && id2 === id3) {
            playSound('correct'); 
            matchGameSelected.forEach(n => { n.classList.remove('selected'); n.classList.add('correct'); });
            matchedCount++;
            document.getElementById('matchProgressText').innerText = `${matchedCount} / ${totalCount}`;
            
            setTimeout(() => {
                document.querySelectorAll('.match-bubble.correct').forEach(el => el.remove());
                if (matchedCount === totalCount) {
                    shootConfetti();
                    setTimeout(() => { alert("Wow! Phản xạ xuất thần! Đã dọn sạch bảng."); closeMatchGame(); }, 800);
                }
            }, 500);
        } else {
            playSound('wrong'); 
            matchGameSelected.forEach(n => { n.classList.remove('selected'); n.classList.add('wrong'); });
            setTimeout(() => {
                document.querySelectorAll('.match-bubble.wrong').forEach(n => { n.classList.remove('wrong'); n.classList.remove('selected'); });
            }, 400);
        }
        matchGameSelected = [];
    }
}

window.closeMatchGame = function() { document.getElementById('wordMatchGameScreen').style.display = 'none'; }


// ==========================================
// 10. LOGIC GAME CHÍNH (CÓ SENTENCE MINING)
// ==========================================
function normalizePinyin(str) { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase(); }

function updateGameProgress() {
    const progressFill = document.getElementById('gameProgress');
    if (progressFill && quizData.length > 0) {
        const percent = Math.round((currentIndex / quizData.length) * 100);
        progressFill.style.width = `${percent}%`;
    }
}

function shootConfetti() {
    try { if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#4F46E5', '#DB2777', '#10B981', '#F59E0B'] }); } 
    catch(e) {}
}

const btnStart = document.getElementById('btnStart');
if (btnStart) {
    btnStart.onclick = async () => {
        if (selectedLevels.length === 0 && selectedPersonalFiles.length === 0) 
            return alert("Vui lòng chọn ít nhất 1 Level hoặc File Cá Nhân để chiến!");

        btnStart.innerHTML = "ĐANG TẢI... <i class='bx bx-loader-alt bx-spin'></i>";
        quizData = [];

        for (let lvl of selectedLevels) {
            try {
                let res = await fetch(`${lvl}.csv`);
                if (!res.ok) res = await fetch(`${lvl.toLowerCase()}.csv`);
                if (res.ok) {
                    const text = await res.text();
                    const parsed = Papa.parse(text, { skipEmptyLines: true });
                    const cleanData = parsed.data.filter(r => r.length >= 3 && r[0].trim() !== "");
                    
                    const upperLvl = lvl.toUpperCase();
                    if(!hskLevelTotals[upperLvl]) {
                        hskLevelTotals[upperLvl] = cleanData.length;
                        localStorage.setItem('hsk_level_totals_v2', JSON.stringify(hskLevelTotals));
                    }
                    quizData = [...quizData, ...cleanData.map(r => [...r, upperLvl])];
                }
            } catch (e) {}
        }

        for (let name of selectedPersonalFiles) {
            const text = personalFiles[name];
            const parsed = Papa.parse(text, { skipEmptyLines: true });
            const cleanData = parsed.data.filter(r => r.length >= 3 && r[0].trim() !== "");
            
            const upperName = name.toUpperCase();
            if(!hskLevelTotals[upperName]) {
                hskLevelTotals[upperName] = cleanData.length;
                localStorage.setItem('hsk_level_totals_v2', JSON.stringify(hskLevelTotals));
            }
            quizData = [...quizData, ...cleanData.map(r => [...r, upperName])];
        }

        if (quizData.length === 0) {
            btnStart.innerHTML = "BẮT ĐẦU CHIẾN <i class='bx bx-play'></i>";
            return alert("Dữ liệu rỗng, vui lòng kiểm tra file CSV.");
        }

        if(appSettings.shuffle) { quizData.sort(() => Math.random() - 0.5); }
        
        hp = 5; currentIndex = 0; missedWords = []; isReviewMode = false;
        
        document.getElementById('hpDisplay').innerText = "❤️❤️❤️❤️❤️";
        btnStart.innerHTML = "BẮT ĐẦU CHIẾN <i class='bx bx-play'></i>";
        document.getElementById('gameScreen').style.display = 'block'; 
        
        showQuestion();
    };
}

function showQuestion() {
    updateGameProgress();

    if (currentIndex >= quizData.length || hp <= 0) {
        if (missedWords.length > 0 && hp > 0) {
            document.getElementById('missedCount').innerText = missedWords.length;
            document.getElementById('reviewModal').style.display = 'flex';
        } else {
            if(hp > 0) shootConfetti();
            setTimeout(() => {
                alert(hp <= 0 ? "Hết tim rồi, nghỉ ngơi xíu nhé! 💔" : "Tuyệt vời! Bạn đã hoàn thành bài học! 🎉");
                endGame();
            }, 500);
        }
        return;
    }

    // Bóc tách dữ liệu 3 cột cơ bản
    const currentWord = quizData[currentIndex];
    const hanzi = currentWord[0] || ""; 
    const pinyin = currentWord[1] || ""; 
    const meaning = currentWord[2] || "";
    const lvl = currentWord[currentWord.length - 1]; 

    // Bóc tách dữ liệu 3 cột Sentence Mining (nếu có)
    let exHanzi = "", exPinyin = "", exMeaning = "";
    if (currentWord.length >= 7) { 
        exHanzi = currentWord[3] || "";
        exPinyin = currentWord[4] || "";
        exMeaning = currentWord[5] || "";
    }

    document.getElementById('lvlBadge').innerText = isReviewMode ? "ÔN TẬP" : (lvl || "HSK").toUpperCase();
    
    const mainQ = document.getElementById('mainQuestion');
    const subQ = document.getElementById('subQuestion');
    const answerContainer = document.getElementById('answerContainer');
    const typingContainer = document.getElementById('typingContainer');
    const pinyinInput = document.getElementById('pinyinInput');
    const btnReveal = document.getElementById('btnRevealPinyin');

    const sentenceContainer = document.getElementById('sentenceContainer');
    const sentenceHanziEl = document.getElementById('sentenceHanzi');
    const sentencePinyinEl = document.getElementById('sentencePinyin');
    const sentenceMeaningEl = document.getElementById('sentenceMeaning');

    let correctAnswer = "";
    let hiddenText = "";

    if (selectedMode === "GÕ PINYIN") {
        mainQ.innerText = hanzi; mainQ.style.fontSize = "7.5rem"; 
        hiddenText = meaning; 
        answerContainer.style.display = 'none'; typingContainer.style.display = 'block';
        pinyinInput.value = ''; setTimeout(() => pinyinInput.focus(), 100); 
    } else {
        typingContainer.style.display = 'none'; answerContainer.style.display = 'grid';

        if (selectedMode === "NGHĨA") {
            mainQ.innerText = hanzi; mainQ.style.fontSize = "7.5rem"; hiddenText = pinyin; correctAnswer = meaning;
        } else if (selectedMode === "PINYIN") {
            mainQ.innerText = hanzi; mainQ.style.fontSize = "7.5rem"; hiddenText = meaning; correctAnswer = pinyin;
        } else { 
            mainQ.innerText = meaning; mainQ.style.fontSize = "4rem"; hiddenText = pinyin; correctAnswer = hanzi;
        }
        renderAnswers(correctAnswer, lvl ? lvl.toUpperCase() : "CUSTOM");
    }

    // CON MẮT ẨN PINYIN
    if (appSettings.hidePinyin && selectedMode !== "PINYIN" && selectedMode !== "GÕ PINYIN") {
        subQ.innerText = "****"; 
        btnReveal.style.display = 'flex';
        btnReveal.onclick = () => {
            subQ.innerText = hiddenText;
            btnReveal.style.display = 'none';
        };
    } else {
        subQ.innerText = hiddenText;
        btnReveal.style.display = 'none';
    }

    // RENDER SENTENCE MINING
    if (exHanzi && sentenceContainer) {
        sentenceContainer.style.display = 'block';
        
        let displaySentenceHanzi = exHanzi;
        if (selectedMode === "CHỮ HÁN") {
            // Giấu chữ Hán trong câu nếu đang chơi chế độ tìm Chữ Hán
            displaySentenceHanzi = exHanzi.split(hanzi).join(`<span class="highlight-word">[___]</span>`);
        } else {
            // Bôi đỏ bình thường
            displaySentenceHanzi = exHanzi.split(hanzi).join(`<span class="highlight-word">${hanzi}</span>`);
        }
        
        sentenceHanziEl.innerHTML = displaySentenceHanzi;
        sentencePinyinEl.innerText = exPinyin;
        sentenceMeaningEl.innerText = exMeaning;

        if (appSettings.hidePinyin) sentencePinyinEl.style.display = 'none';
        else sentencePinyinEl.style.display = 'block';
        
    } else if (sentenceContainer) {
        sentenceContainer.style.display = 'none';
    }
}

function checkTypingAnswer() {
    const userInput = document.getElementById('pinyinInput').value;
    if (!userInput.trim()) return; 

    const currentWord = quizData[currentIndex];
    const hanzi = currentWord[0];
    const correctPinyin = currentWord[1];
    const currentLevel = (currentWord[currentWord.length - 1] || "CUSTOM").toUpperCase();

    if (normalizePinyin(userInput) === normalizePinyin(correctPinyin)) {
        playSound('correct');
        recordCorrectWord(currentLevel, hanzi);
        currentIndex++; showQuestion();
    } else {
        hp--; playSound('wrong');
        alert(`Sai rồi! Đáp án đúng là: ${correctPinyin}`);
        document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
        if(!isReviewMode) missedWords.push(quizData[currentIndex]); else quizData.push(quizData[currentIndex]);
        currentIndex++; showQuestion();
    }
}

const btnSubmitPinyin = document.getElementById('btnSubmitPinyin');
if (btnSubmitPinyin) btnSubmitPinyin.addEventListener('click', checkTypingAnswer);
const pinyinInput = document.getElementById('pinyinInput');
if (pinyinInput) pinyinInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); checkTypingAnswer(); } });

function renderAnswers(correct, currentLevel) {
    const container = document.getElementById('answerContainer');
    container.innerHTML = "";
    const colIndex = selectedMode === "NGHĨA" ? 2 : (selectedMode === "PINYIN" ? 1 : 0);
    const pool = [...new Set(quizData.map(r => r[colIndex]))];
    
    let choices = [correct];
    while (choices.length < 4 && pool.length > 4) {
        let rand = pool[Math.floor(Math.random() * pool.length)];
        if (!choices.includes(rand)) choices.push(rand);
    }
    choices.sort(() => Math.random() - 0.5);

    choices.forEach(text => {
        const btn = document.createElement('button');
        btn.className = "ans-btn"; btn.innerText = text;
        btn.onclick = () => {
            if (text === correct) {
                playSound('correct');
                const hanzi = quizData[currentIndex][0];
                recordCorrectWord(currentLevel, hanzi);
                currentIndex++; showQuestion();
            } else {
                hp--; playSound('wrong');
                alert(`Sai rồi! Đáp án đúng là: ${correct}`);
                document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
                if(!isReviewMode) missedWords.push(quizData[currentIndex]); else quizData.push(quizData[currentIndex]);
                currentIndex++; showQuestion();
            }
        };
        container.appendChild(btn);
    });
}

// ==========================================
// 11. ÔN TẬP VÀ KẾT THÚC BÀI
// ==========================================
window.startReviewMode = function() {
    document.getElementById('reviewModal').style.display = 'none';
    quizData = [...missedWords]; missedWords = []; currentIndex = 0; isReviewMode = true;
    hp = 3; document.getElementById('hpDisplay').innerText = "❤️❤️❤️";
    showQuestion();
}

window.endGame = function() {
    document.getElementById('reviewModal').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    updateProfileXP(); renderLevelScores(); switchTab('dashboard-view'); 
}

// Chạy khởi tạo
checkAuth();
