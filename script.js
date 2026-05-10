// ==========================================
// 1. BIẾN TRẠNG THÁI VÀ DỮ LIỆU LOCAL
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
let userLevelScores = JSON.parse(localStorage.getItem('hsk_user_scores')) || {};
let personalFiles = JSON.parse(localStorage.getItem('hsk_personal_files') || '{}');
let currentUser = localStorage.getItem('hsk_current_user');

// ==========================================
// 2. LOGIC AUTH & THỐNG KÊ ĐIỂM SỐ
// ==========================================
function checkAuth() {
    if (!currentUser) {
        document.getElementById('authModal').style.display = 'flex';
    } else {
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('greetName').innerText = currentUser;
        updateProfileUI();
        renderLevelScores();
    }
}

document.getElementById('btnLogin').onclick = () => {
    const username = document.getElementById('usernameInput').value.trim();
    if (username.length >= 2) {
        currentUser = username;
        localStorage.setItem('hsk_current_user', currentUser);
        checkAuth();
        shootConfetti(); // Bắn pháo hoa chào mừng
    } else {
        alert("Tên hiển thị phải có ít nhất 2 ký tự!");
    }
};

function updateProfileUI() {
    const totalScore = Object.values(userLevelScores).reduce((a, b) => a + b, 0);
    const userProfileDiv = document.getElementById('userProfileBar');
    if(userProfileDiv) {
        userProfileDiv.innerHTML = `
            <div class="streak-badge"><i class='bx bxs-star' style="color: #F59E0B; font-size:1.2rem;"></i> ${totalScore} XP</div>
            <div class="avatar"><img src="https://ui-avatars.com/api/?name=${currentUser}&background=4F46E5&color=fff&bold=true" alt="User"></div>
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
        return;
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
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="muted" style="text-align: right; font-weight: 700;">Đã master: ${score} / ${maxWords} từ (${percent}%)</div>
        `;
        list.appendChild(item);
    });
}

// ==========================================
// 3. ĐIỀU HƯỚNG TABS (SPA ROUTING)
// ==========================================
function switchTab(targetId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    document.querySelectorAll('.nav-links a[data-target]').forEach(l => {
        if(l.getAttribute('data-target') === targetId) l.classList.add('active');
        else l.classList.remove('active');
    });
}

document.querySelectorAll('.nav-links a[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(link.getAttribute('data-target'));
    });
});

// ==========================================
// 4. SETUP BÀI HỌC VÀ CHỌN CHẾ ĐỘ
// ==========================================
const levelGrid = document.getElementById('levelGrid');
levels.forEach(lvl => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn';
    btn.innerText = lvl;
    btn.onclick = () => {
        btn.classList.toggle('active');
        const name = lvl.toLowerCase();
        if (selectedLevels.includes(name)) selectedLevels = selectedLevels.filter(l => l !== name);
        else selectedLevels.push(name);
    };
    levelGrid.appendChild(btn);
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.getAttribute('data-mode');
    };
});

// ==========================================
// 5. QUẢN LÝ FILE CÁ NHÂN
// ==========================================
document.getElementById('fileUpload').addEventListener('change', function(e) {
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

function renderPersonalFiles() {
    const list = document.getElementById('personalFilesList');
    const selectGrid = document.getElementById('personalSelectGrid');
    list.innerHTML = ''; selectGrid.innerHTML = '';

    if (Object.keys(personalFiles).length === 0) {
        selectGrid.innerHTML = `<p class="muted">(Chưa có file nào. Hãy tải lên ở mục File Cá Nhân)</p>`;
    }

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
// 6. LOGIC GAME & KIỂM TRA ĐÁP ÁN
// ==========================================
function normalizePinyin(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
}

function updateGameProgress() {
    const percent = Math.round((currentIndex / quizData.length) * 100);
    document.getElementById('gameProgress').style.width = `${percent}%`;
}

function shootConfetti() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#4F46E5', '#DB2777', '#10B981', '#F59E0B'] });
}

document.getElementById('btnStart').onclick = async () => {
    if (selectedLevels.length === 0 && selectedPersonalFiles.length === 0) 
        return alert("Vui lòng chọn ít nhất 1 Level HSK hoặc 1 File Cá Nhân để luyện tập!");

    document.getElementById('btnStart').innerHTML = "ĐANG TẢI... <i class='bx bx-loader-alt bx-spin'></i>";
    quizData = [];

    for (let lvl of selectedLevels) {
        try {
            const response = await fetch(`${lvl}.csv`);
            if (response.ok) {
                const text = await response.text();
                const parsed = Papa.parse(text, { skipEmptyLines: true });
                quizData = [...quizData, ...parsed.data.map(r => [...r, lvl.toUpperCase()])];
            }
        } catch (e) { console.log(e); }
    }

    for (let name of selectedPersonalFiles) {
        const text = personalFiles[name];
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        quizData = [...quizData, ...parsed.data.map(r => [...r, name])];
    }

    if (quizData.length === 0) {
        document.getElementById('btnStart').innerHTML = "BẮT ĐẦU CHIẾN <i class='bx bx-play'></i>";
        return alert("Dữ liệu rỗng, vui lòng kiểm tra lại nội dung file CSV.");
    }

    quizData.sort(() => Math.random() - 0.5);
    hp = 5; 
    currentIndex = 0;
    missedWords = [];
    isReviewMode = false;
    
    document.getElementById('hpDisplay').innerText = "❤️❤️❤️❤️❤️";
    document.getElementById('btnStart').innerHTML = "BẮT ĐẦU CHIẾN <i class='bx bx-play'></i>";
    document.getElementById('gameScreen').style.display = 'block'; // Block, không phải flex vì layout mới
    
    showQuestion();
};

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
    const hanzi = currentWord[0];
    const pinyin = currentWord[1];
    const meaning = currentWord[2];
    const lvl = currentWord[currentWord.length - 1]; 

    document.getElementById('lvlBadge').innerText = isReviewMode ? "ÔN TẬP LỖI SAI" : lvl.toUpperCase();
    
    const mainQ = document.getElementById('mainQuestion');
    const subQ = document.getElementById('subQuestion');
    const answerContainer = document.getElementById('answerContainer');
    const typingContainer = document.getElementById('typingContainer');
    const pinyinInput = document.getElementById('pinyinInput');

    let correctAnswer = "";

    // CHẾ ĐỘ GÕ PINYIN
    if (selectedMode === "GÕ PINYIN") {
        mainQ.innerText = hanzi; 
        mainQ.style.fontSize = "7.5rem"; 
        subQ.innerText = meaning; 
        
        answerContainer.style.display = 'none';
        typingContainer.style.display = 'block';
        
        pinyinInput.value = '';
        setTimeout(() => pinyinInput.focus(), 100); 
        
    } else {
        // CHẾ ĐỘ TRẮC NGHIỆM
        typingContainer.style.display = 'none';
        answerContainer.style.display = 'grid';

        if (selectedMode === "NGHĨA") {
            mainQ.innerText = hanzi; mainQ.style.fontSize = "7.5rem"; subQ.innerText = pinyin; correctAnswer = meaning;
        } else if (selectedMode === "PINYIN") {
            mainQ.innerText = hanzi; mainQ.style.fontSize = "7.5rem"; subQ.innerText = meaning; correctAnswer = pinyin;
        } else { 
            mainQ.innerText = meaning; mainQ.style.fontSize = "4rem"; subQ.innerText = pinyin; correctAnswer = hanzi;
        }

        renderAnswers(correctAnswer, lvl.toUpperCase());
    }
}

// LOGIC GÕ PINYIN
function checkTypingAnswer() {
    const userInput = document.getElementById('pinyinInput').value;
    if (!userInput.trim()) return; 

    const currentWord = quizData[currentIndex];
    const correctPinyin = currentWord[1];
    const currentLevel = currentWord[currentWord.length - 1].toUpperCase();

    if (normalizePinyin(userInput) === normalizePinyin(correctPinyin)) {
        if(!isReviewMode) {
            userLevelScores[currentLevel] = (userLevelScores[currentLevel] || 0) + 1;
            localStorage.setItem('hsk_user_scores', JSON.stringify(userLevelScores));
        }
        currentIndex++;
        showQuestion();
    } else {
        hp--;
        alert(`Sai rồi! Đáp án đúng là: ${correctPinyin}`);
        document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
        if(!isReviewMode) missedWords.push(quizData[currentIndex]);
        else quizData.push(quizData[currentIndex]);
        
        currentIndex++;
        showQuestion();
    }
}

document.getElementById('btnSubmitPinyin').addEventListener('click', checkTypingAnswer);
document.getElementById('pinyinInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); checkTypingAnswer(); }
});

// LOGIC TRẮC NGHIỆM
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
                currentIndex++; 
                showQuestion();
            } else {
                hp--;
                alert(`Sai rồi! Đáp án đúng là: ${correct}`);
                document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
                
                if(!isReviewMode) missedWords.push(quizData[currentIndex]);
                else quizData.push(quizData[currentIndex]);
                
                currentIndex++;
                showQuestion();
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
    quizData = [...missedWords]; 
    missedWords = []; 
    currentIndex = 0;
    isReviewMode = true;
    
    hp = 3; 
    document.getElementById('hpDisplay').innerText = "❤️❤️❤️";
    
    showQuestion();
}

window.endGame = function() {
    document.getElementById('reviewModal').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    updateProfileUI(); 
    renderLevelScores(); 
    switchTab('dashboard-view'); 
}

// Boot up
checkAuth();
