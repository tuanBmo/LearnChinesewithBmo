// ==========================================
// 1. BIẾN TRẠNG THÁI VÀ DỮ LIỆU
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

// Đọc Data Local an toàn
function getSafeData(key, defaultVal) {
    try { return JSON.parse(localStorage.getItem(key)) || defaultVal; } 
    catch(e) { return defaultVal; }
}

let userLevelScores = getSafeData('hsk_user_scores', {});
let personalFiles = getSafeData('hsk_personal_files', {});
let currentUser = localStorage.getItem('hsk_current_user');
let currentStreak = parseInt(localStorage.getItem('hsk_streak_count')) || 0;
let lastLoginDate = localStorage.getItem('hsk_last_login_date');

// --- CÀI ĐẶT ---
let appSettings = getSafeData('hsk_settings', { hidePinyin: false, shuffle: true, dailyWords: 5 });

// --- TỪ HÔM NAY (MINI GAME) ---
let dailyWordsPool = []; 
let matchGameSelected = []; // Lưu các bóng đang chọn
let matchedCount = 0;

// ==========================================
// 2. KHỞI TẠO & CÀI ĐẶT
// ==========================================
function initSettingsUI() {
    const sPinyin = document.getElementById('setHidePinyin');
    const sShuffle = document.getElementById('setShuffle');
    const sDaily = document.getElementById('setDailyWords');
    
    if(sPinyin) sPinyin.checked = appSettings.hidePinyin;
    if(sShuffle) sShuffle.checked = appSettings.shuffle;
    if(sDaily) sDaily.value = appSettings.dailyWords;
    
    // Cập nhật thẻ Hero
    const dailyCountDisplay = document.getElementById('dailyWordCountDisplay');
    if(dailyCountDisplay) dailyCountDisplay.innerText = appSettings.dailyWords;
}

window.saveSettings = function() {
    appSettings.hidePinyin = document.getElementById('setHidePinyin').checked;
    appSettings.shuffle = document.getElementById('setShuffle').checked;
    appSettings.dailyWords = parseInt(document.getElementById('setDailyWords').value);
    
    localStorage.setItem('hsk_settings', JSON.stringify(appSettings));
    alert("Đã lưu cài đặt!");
    
    document.getElementById('dailyWordCountDisplay').innerText = appSettings.dailyWords;
    loadDailyWordsData(); // Tải lại bộ từ mới theo số lượng mới
};

// Tự động tải 1 lượng từ ngầm định (ví dụ HSK1) để làm "Từ hôm nay"
async function loadDailyWordsData() {
    try {
        const response = await fetch(`HSK1.csv`);
        if (response.ok) {
            const text = await response.text();
            const parsed = Papa.parse(text, { skipEmptyLines: true });
            
            // Lấy ngẫu nhiên N từ theo Cài đặt
            let allWords = parsed.data;
            allWords.sort(() => Math.random() - 0.5);
            dailyWordsPool = allWords.slice(0, appSettings.dailyWords);
        }
    } catch (e) { console.log("Không tải được data mặc định."); }
}

// ==========================================
// 3. LOGIC AUTH, STREAK & THỐNG KÊ
// ==========================================
function updateStreak() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; 
    if (lastLoginDate !== todayStr) {
        if (lastLoginDate) {
            const lastParts = lastLoginDate.split('-');
            const lastD = new Date(lastParts[0], lastParts[1] - 1, lastParts[2]);
            const currD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diffDays = Math.ceil(Math.abs(currD - lastD) / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) currentStreak += 1; else currentStreak = 1; 
        } else { currentStreak = 1; }
        localStorage.setItem('hsk_last_login_date', todayStr);
        localStorage.setItem('hsk_streak_count', currentStreak);
        lastLoginDate = todayStr;
    }
    const streakUI = document.getElementById('streakCountUI');
    if (streakUI) streakUI.innerText = currentStreak;
}

function updateTopProgress() {
    const hskStandardMax = { "HSK1": 150, "HSK2": 150, "HSK3": 300, "HSK4": 600, "HSK5": 1300, "HSK6": 2500 };
    let topLevel = "HSK1", topPercent = 0, topScore = 0, topMax = 150;
    const playedLevels = Object.keys(userLevelScores);
    if (playedLevels.length > 0) {
        playedLevels.forEach(lvl => {
            const score = userLevelScores[lvl];
            const max = hskStandardMax[lvl.toUpperCase()] || 100;
            const percent = Math.min(Math.round((score / max) * 100), 100);
            if (percent >= topPercent) { topPercent = percent; topLevel = lvl; topScore = score; topMax = max; }
        });
    }
    const title = document.getElementById('topProgressTitle');
    const circle = document.getElementById('topProgressCircle');
    const percentText = document.getElementById('topProgressPercent');
    const detailText = document.getElementById('topProgressText');
    if (title && circle && percentText && detailText) {
        title.innerText = `${topLevel.toUpperCase()} PROGRESS`;
        percentText.innerText = `${topPercent}%`;
        detailText.innerText = `${topScore} / ${topMax} từ`;
        circle.style.background = `conic-gradient(#10B981 ${topPercent}%, rgba(255,255,255,0.5) 0deg)`;
    }
}

function checkAuth() {
    const authModal = document.getElementById('authModal');
    if (!currentUser) {
        if (authModal) authModal.style.display = 'flex';
    } else {
        if (authModal) authModal.style.display = 'none';
        updateStreak(); 
        updateProfileUI();
        renderLevelScores();
        initSettingsUI();
        loadDailyWordsData();
    }
}

const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
    btnLogin.onclick = () => {
        const username = document.getElementById('usernameInput').value.trim();
        if (username.length >= 2) {
            currentUser = username;
            localStorage.setItem('hsk_current_user', currentUser);
            checkAuth();
            shootConfetti(); 
        } else { alert("Tên hiển thị phải có ít nhất 2 ký tự!"); }
    };
}

function updateProfileUI() {
    const totalScore = Object.values(userLevelScores).reduce((a, b) => a + b, 0);
    const userProfileDiv = document.getElementById('userProfileBar');
    if(userProfileDiv) {
        userProfileDiv.innerHTML = `
            <div class="streak-badge"><i class='bx bxs-star' style="color: #F59E0B; font-size:1.2rem;"></i> ${totalScore} XP</div>
            <div class="avatar"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=4F46E5&color=fff&bold=true" alt="User"></div>
        `;
    }
}

function renderLevelScores() {
    const list = document.getElementById('levelStatsList');
    if(!list) return;
    list.innerHTML = "";
    const allPlayedLevels = Object.keys(userLevelScores).sort();
    if(allPlayedLevels.length === 0) {
        list.innerHTML = `<p class="muted" style="text-align: center; padding: 20px;">Bạn chưa có điểm số nào. Hãy thiết lập ván mới để bắt đầu lấy điểm nhé!</p>`;
        updateTopProgress(); return;
    }
    const hskStandardMax = { "HSK1": 150, "HSK2": 150, "HSK3": 300, "HSK4": 600, "HSK5": 1300, "HSK6": 2500 };
    allPlayedLevels.forEach(lvl => {
        const score = userLevelScores[lvl];
        let maxWords = hskStandardMax[lvl.toUpperCase()] || 100; 
        if (score > maxWords) maxWords = score; 
        const percent = Math.min(Math.round((score / maxWords) * 100), 100);
        const item = document.createElement('div');
        item.className = 'stat-row';
        item.innerHTML = `
            <div class="stat-info-wrap">
                <div class="stat-lvl-name"><i class='bx bx-medal' style="color: var(--accent-yellow-text); font-size: 1.5rem;"></i> ${lvl}</div>
                <div class="stat-score">+${score} XP</div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
            <div class="muted" style="text-align: right; font-weight: 700;">Đã master: ${score} / ${maxWords} từ (${percent}%)</div>
        `;
        list.appendChild(item);
    });
    updateTopProgress();
}

// ==========================================
// 4. ĐIỀU HƯỚNG TABS VÀ CÀI ĐẶT BÀI HỌC
// ==========================================
function switchTab(targetId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active');
    document.querySelectorAll('.nav-links a[data-target]').forEach(l => {
        if(l.getAttribute('data-target') === targetId) l.classList.add('active');
        else l.classList.remove('active');
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
        btn.classList.add('active');
        selectedMode = btn.getAttribute('data-mode');
    };
});

// File Upload
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
            alert("Đã tải lên file: " + name);
            renderPersonalFiles();
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
        renderPersonalFiles();
    }
}
renderPersonalFiles();

// ==========================================
// 5. MINI GAME: GHÉP TỪ HÔM NAY (BONG BÓNG)
// ==========================================
window.startMatchGame = function() {
    if(dailyWordsPool.length === 0) return alert("Hệ thống chưa tải xong dữ liệu, đợi 1 chút nhé!");
    
    document.getElementById('wordMatchGameScreen').style.display = 'block';
    matchedCount = 0;
    matchGameSelected = [];
    document.getElementById('matchProgressText').innerText = `0 / ${appSettings.dailyWords}`;
    
    const container = document.getElementById('floatingBubblesContainer');
    container.innerHTML = "";

    // Tạo mảng trộn lẫn 3 yếu tố của N từ
    let allBubbles = [];
    dailyWordsPool.forEach((word, idx) => {
        allBubbles.push({ id: idx, type: 'hanzi', text: word[0] });
        allBubbles.push({ id: idx, type: 'pinyin', text: word[1] });
        allBubbles.push({ id: idx, type: 'meaning', text: word[2] });
    });
    
    allBubbles.sort(() => Math.random() - 0.5); // Xáo trộn

    allBubbles.forEach((b, i) => {
        const bubble = document.createElement('div');
        bubble.className = `match-bubble ${b.type}`;
        bubble.innerText = b.text;
        bubble.dataset.id = b.id;
        bubble.dataset.type = b.type;
        
        // Random Animation Delay để bay lệch nhịp
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        
        bubble.onclick = () => handleBubbleClick(bubble);
        container.appendChild(bubble);
    });
}

function handleBubbleClick(bubble) {
    if (bubble.classList.contains('correct') || bubble.classList.contains('wrong')) return;

    const bType = bubble.dataset.type;
    const bId = bubble.dataset.id;

    // Nếu bấm lại bubble đang chọn -> Bỏ chọn
    if (bubble.classList.contains('selected')) {
        bubble.classList.remove('selected');
        matchGameSelected = matchGameSelected.filter(node => node !== bubble);
        return;
    }

    // Nếu đã chọn type này rồi (ví dụ đã chọn 1 Pinyin, giờ bấm Pinyin khác) -> Hủy cái cũ, nhận cái mới
    const existingTypeNode = matchGameSelected.find(n => n.dataset.type === bType);
    if (existingTypeNode) {
        existingTypeNode.classList.remove('selected');
        matchGameSelected = matchGameSelected.filter(n => n !== existingTypeNode);
    }

    // Thêm bubble mới vào selection
    bubble.classList.add('selected');
    matchGameSelected.push(bubble);

    // Kiểm tra nếu đã chọn đủ 3 yếu tố
    if (matchGameSelected.length === 3) {
        const id1 = matchGameSelected[0].dataset.id;
        const id2 = matchGameSelected[1].dataset.id;
        const id3 = matchGameSelected[2].dataset.id;

        if (id1 === id2 && id2 === id3) {
            // GHÉP ĐÚNG
            matchGameSelected.forEach(n => { n.classList.remove('selected'); n.classList.add('correct'); });
            matchedCount++;
            document.getElementById('matchProgressText').innerText = `${matchedCount} / ${appSettings.dailyWords}`;
            
            // Xóa phần tử đúng sau 0.5s
            setTimeout(() => {
                document.querySelectorAll('.match-bubble.correct').forEach(el => el.remove());
                // Kiểm tra Win Game
                if (matchedCount === appSettings.dailyWords) {
                    shootConfetti();
                    setTimeout(() => { alert("Wow! Bạn đã hoàn thành Nhiệm vụ ghép từ hôm nay! +50 XP"); closeMatchGame(); }, 1000);
                }
            }, 500);
        } else {
            // GHÉP SAI
            matchGameSelected.forEach(n => { n.classList.remove('selected'); n.classList.add('wrong'); });
            setTimeout(() => {
                document.querySelectorAll('.match-bubble.wrong').forEach(n => { n.classList.remove('wrong'); n.classList.remove('selected'); });
            }, 400);
        }
        matchGameSelected = []; // Reset lựa chọn
    }
}

window.closeMatchGame = function() {
    document.getElementById('wordMatchGameScreen').style.display = 'none';
}

// ==========================================
// 6. LOGIC GAME LUYỆN TẬP CHÍNH
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
            return alert("Vui lòng chọn ít nhất 1 Level HSK hoặc 1 File Cá Nhân để luyện tập!");

        btnStart.innerHTML = "ĐANG TẢI... <i class='bx bx-loader-alt bx-spin'></i>";
        quizData = [];

        for (let lvl of selectedLevels) {
            try {
                const response = await fetch(`${lvl}.csv`);
                if (response.ok) {
                    const text = await response.text();
                    const parsed = Papa.parse(text, { skipEmptyLines: true });
                    quizData = [...quizData, ...parsed.data.map(r => [...r, lvl.toUpperCase()])];
                }
            } catch (e) {}
        }
        for (let name of selectedPersonalFiles) {
            const text = personalFiles[name];
            const parsed = Papa.parse(text, { skipEmptyLines: true });
            quizData = [...quizData, ...parsed.data.map(r => [...r, name])];
        }

        if (quizData.length === 0) {
            btnStart.innerHTML = "BẮT ĐẦU CHIẾN <i class='bx bx-play'></i>";
            return alert("Dữ liệu rỗng, vui lòng kiểm tra lại nội dung file CSV.");
        }

        // TÍNH NĂNG CÀI ĐẶT: XÁO TRỘN CÂU
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

    const currentWord = quizData[currentIndex];
    const hanzi = currentWord[0]; const pinyin = currentWord[1]; const meaning = currentWord[2];
    const lvl = currentWord[currentWord.length - 1]; 

    document.getElementById('lvlBadge').innerText = isReviewMode ? "ÔN TẬP" : (lvl || "HSK").toUpperCase();
    
    const mainQ = document.getElementById('mainQuestion');
    const subQ = document.getElementById('subQuestion');
    const answerContainer = document.getElementById('answerContainer');
    const typingContainer = document.getElementById('typingContainer');
    const pinyinInput = document.getElementById('pinyinInput');

    let correctAnswer = "";

    if (selectedMode === "GÕ PINYIN") {
        mainQ.innerText = hanzi; mainQ.style.fontSize = "8rem"; 
        subQ.innerText = meaning; 
        answerContainer.style.display = 'none'; typingContainer.style.display = 'block';
        pinyinInput.value = ''; setTimeout(() => pinyinInput.focus(), 100); 
    } else {
        typingContainer.style.display = 'none'; answerContainer.style.display = 'grid';

        if (selectedMode === "NGHĨA") {
            mainQ.innerText = hanzi; mainQ.style.fontSize = "8rem"; subQ.innerText = pinyin; correctAnswer = meaning;
        } else if (selectedMode === "PINYIN") {
            mainQ.innerText = hanzi; mainQ.style.fontSize = "8rem"; subQ.innerText = meaning; correctAnswer = pinyin;
        } else { 
            mainQ.innerText = meaning; mainQ.style.fontSize = "4rem"; subQ.innerText = pinyin; correctAnswer = hanzi;
        }

        // TÍNH NĂNG CÀI ĐẶT: ẨN PINYIN
        if(appSettings.hidePinyin && selectedMode !== "PINYIN") {
            subQ.innerText = "****"; 
        }

        renderAnswers(correctAnswer, lvl ? lvl.toUpperCase() : "CUSTOM");
    }
}

function checkTypingAnswer() {
    const userInput = document.getElementById('pinyinInput').value;
    if (!userInput.trim()) return; 

    const currentWord = quizData[currentIndex];
    const correctPinyin = currentWord[1];
    const currentLevel = (currentWord[currentWord.length - 1] || "CUSTOM").toUpperCase();

    if (normalizePinyin(userInput) === normalizePinyin(correctPinyin)) {
        if(!isReviewMode) {
            userLevelScores[currentLevel] = (userLevelScores[currentLevel] || 0) + 1;
            localStorage.setItem('hsk_user_scores', JSON.stringify(userLevelScores));
        }
        currentIndex++; showQuestion();
    } else {
        hp--; alert(`Sai rồi! Đáp án đúng là: ${correctPinyin}`);
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
                if(!isReviewMode) {
                    userLevelScores[currentLevel] = (userLevelScores[currentLevel] || 0) + 1;
                    localStorage.setItem('hsk_user_scores', JSON.stringify(userLevelScores));
                }
                currentIndex++; showQuestion();
            } else {
                hp--; alert(`Sai rồi! Đáp án đúng là: ${correct}`);
                document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
                if(!isReviewMode) missedWords.push(quizData[currentIndex]); else quizData.push(quizData[currentIndex]);
                currentIndex++; showQuestion();
            }
        };
        container.appendChild(btn);
    });
}

// ==========================================
// 7. ÔN TẬP VÀ KẾT THÚC BÀI
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
    updateProfileUI(); renderLevelScores(); switchTab('dashboard-view'); 
}

// Chạy khởi tạo
checkAuth();
 
