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

// Biến cho tính năng Review & Score
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
    if (username.length >= 3) {
        currentUser = username;
        localStorage.setItem('hsk_current_user', currentUser);
        checkAuth();
    } else {
        alert("Tên hiển thị phải có ít nhất 3 ký tự!");
    }
};

function updateProfileUI() {
    const totalScore = Object.values(userLevelScores).reduce((a, b) => a + b, 0);
    const userProfileDiv = document.getElementById('userProfileBar');
    if(userProfileDiv) {
        userProfileDiv.innerHTML = `
            <div class="streak-badge"><i class='bx bxs-star' style="color: #F59E0B;"></i> ${totalScore} điểm</div>
            <div class="avatar"><img src="https://ui-avatars.com/api/?name=${currentUser}&background=5E5CE6&color=fff" alt="User"></div>
        `;
    }
}

function renderLevelScores() {
    const list = document.getElementById('levelStatsList');
    if(!list) return;
    list.innerHTML = "";
    
    const allPlayedLevels = Object.keys(userLevelScores).sort();
    
    if(allPlayedLevels.length === 0) {
        list.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Bạn chưa có điểm số nào. Hãy thiết lập ván mới để bắt đầu lấy điểm nhé!</p>`;
        return;
    }

    // Tiêu chuẩn lượng từ vựng của HSK để tính phần trăm
    const hskStandardMax = {
        "HSK1": 150, "HSK2": 150, "HSK3": 300, 
        "HSK4": 600, "HSK5": 1300, "HSK6": 2500
    };

    allPlayedLevels.forEach(lvl => {
        const score = userLevelScores[lvl];
        let maxWords = hskStandardMax[lvl.toUpperCase()] || 100; // File cá nhân mặc định mốc 100
        if (score > maxWords) maxWords = score; 

        const percent = Math.min(Math.round((score / maxWords) * 100), 100);

        const item = document.createElement('div');
        item.className = 'stat-row';
        item.innerHTML = `
            <div class="stat-info-wrap">
                <div class="stat-lvl-name"><i class='bx bx-layer' style="color: var(--accent-purple-text);"></i> ${lvl}</div>
                <div class="stat-score">+${score} XP</div>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="progress-text">Đã master: ${score} / ${maxWords} từ (${percent}%)</div>
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
// 5. QUẢN LÝ FILE CÁ NHÂN (CSV UPLOAD)
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
        selectGrid.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.9rem;">(Chưa có file nào. Hãy tải lên ở mục File Cá Nhân)</p>`;
    }

    Object.keys(personalFiles).forEach(name => {
        // Tab quản lý
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<h4><i class='bx bx-file' style="color: var(--accent-blue-text);"></i> ${name}.csv</h4>
                          <button class="btn-delete" onclick="deleteFile('${name}')">Xóa</button>`;
        list.appendChild(item);

        // Tab Setup Luyện tập
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
// 6. LOGIC GAME & TÍNH ĐIỂM
// ==========================================
document.getElementById('btnStart').onclick = async () => {
    if (selectedLevels.length === 0 && selectedPersonalFiles.length === 0) 
        return alert("Vui lòng chọn ít nhất 1 Level HSK hoặc 1 File Cá Nhân để luyện tập!");

    document.getElementById('btnStart').innerHTML = "ĐANG TẢI DỮ LIỆU... <i class='bx bx-loader-alt bx-spin'></i>";
    quizData = [];

    // Tải file HSK chuẩn
    for (let lvl of selectedLevels) {
        try {
            const response = await fetch(`${lvl}.csv`);
            if (response.ok) {
                const text = await response.text();
                const parsed = Papa.parse(text, { skipEmptyLines: true });
                // Thêm tên Level vào cột cuối
                quizData = [...quizData, ...parsed.data.map(r => [...r, lvl.toUpperCase()])];
            }
        } catch (e) { console.log("Lỗi tải file:", e); }
    }

    // Tải file Cá nhân
    for (let name of selectedPersonalFiles) {
        const text = personalFiles[name];
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        quizData = [...quizData, ...parsed.data.map(r => [...r, name])];
    }

    if (quizData.length === 0) {
        document.getElementById('btnStart').innerHTML = "BẮT ĐẦU LUYỆN TẬP <i class='bx bx-play'></i>";
        return alert("Dữ liệu rỗng, vui lòng kiểm tra lại nội dung file CSV.");
    }

    // Xáo trộn & Reset thông số
    quizData.sort(() => Math.random() - 0.5);
    hp = 5; 
    currentIndex = 0;
    missedWords = [];
    isReviewMode = false;
    
    document.getElementById('hpDisplay').innerText = "❤️❤️❤️❤️❤️";
    document.getElementById('btnStart').innerHTML = "BẮT ĐẦU LUYỆN TẬP <i class='bx bx-play'></i>";
    document.getElementById('gameScreen').style.display = 'flex';
    
    showQuestion();
};

function showQuestion() {
    if (currentIndex >= quizData.length || hp <= 0) {
        if (missedWords.length > 0 && hp > 0) {
            document.getElementById('missedCount').innerText = missedWords.length;
            document.getElementById('reviewModal').style.display = 'flex';
        } else {
            alert(hp <= 0 ? "Hết tim rồi, nghỉ ngơi xíu nhé! 💔" : "Tuyệt vời! Bạn đã hoàn thành trọn vẹn bài học! 🎉");
            endGame();
        }
        return;
    }

    const currentWord = quizData[currentIndex];
    
    // Lấy dữ liệu an toàn dựa trên độ dài mảng thực tế của file CSV
    const hanzi = currentWord[0];
    const pinyin = currentWord[1];
    const meaning = currentWord[2];
    const lvl = currentWord[currentWord.length - 1]; // FIX LỖI UNDEFINED CẤP ĐỘ

    document.getElementById('lvlBadge').innerText = isReviewMode ? "ÔN TẬP LỖI SAI" : lvl.toUpperCase();
    document.getElementById('progressText').innerText = `${currentIndex}/${quizData.length}`;

    const mainQ = document.getElementById('mainQuestion');
    const subQ = document.getElementById('subQuestion');
    let correctAnswer = "";

    if (selectedMode === "NGHĨA") {
        mainQ.innerText = hanzi; mainQ.style.fontSize = "6rem"; subQ.innerText = pinyin; correctAnswer = meaning;
    } else if (selectedMode === "PINYIN") {
        mainQ.innerText = hanzi; mainQ.style.fontSize = "6rem"; subQ.innerText = meaning; correctAnswer = pinyin;
    } else { 
        mainQ.innerText = meaning; mainQ.style.fontSize = "3rem"; subQ.innerText = pinyin; correctAnswer = hanzi;
    }

    renderAnswers(correctAnswer, lvl.toUpperCase());
}

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
                // ĐÚNG -> Cộng điểm
                if(!isReviewMode) {
                    userLevelScores[currentLevel] = (userLevelScores[currentLevel] || 0) + 1;
                    localStorage.setItem('hsk_user_scores', JSON.stringify(userLevelScores));
                }
                currentIndex++; 
                showQuestion();
            } else {
                // SAI -> Trừ tim, gom vào hàng đợi
                hp--;
                alert(`Sai rồi! Đáp án đúng là: ${correct}`);
                document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
                
                if(!isReviewMode) {
                    missedWords.push(quizData[currentIndex]);
                } else {
                    quizData.push(quizData[currentIndex]);
                }
                
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
    
    hp = 3; // Hồi 3 tim ôn tập
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
