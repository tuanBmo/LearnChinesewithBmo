// --- QUẢN LÝ ĐIỀU HƯỚNG TABS (SPA ROUTING) ---
const navLinks = document.querySelectorAll('.nav-links a[data-target]');
const views = document.querySelectorAll('.view-section');

function switchTab(targetId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    navLinks.forEach(l => {
        if(l.getAttribute('data-target') === targetId) l.classList.add('active');
        else l.classList.remove('active');
    });
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(link.getAttribute('data-target'));
    });
});

// --- BIẾN TRẠNG THÁI GAME ---
const levels = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];
let selectedLevels = [];
let selectedPersonalFiles = [];
let selectedMode = "NGHĨA";
let quizData = [];
let currentIndex = 0;
let hp = 5;
let score = 0;
let personalFiles = JSON.parse(localStorage.getItem('hsk_personal_files') || '{}');

// --- RENDER GIAO DIỆN CHỌN BÀI HỌC ---
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

// Xử lý nút Mode
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.getAttribute('data-mode');
    };
});

// --- QUẢN LÝ FILE CÁ NHÂN ---
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

    Object.keys(personalFiles).forEach(name => {
        // Render ở tab File Cá Nhân
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<h4><i class='bx bx-file'></i> ${name}.csv</h4>
                          <button class="btn-delete" onclick="deleteFile('${name}')">Xóa</button>`;
        list.appendChild(item);

        // Render nút chọn ở tab Luyện Tập
        const btn = document.createElement('button');
        btn.className = 'pill-btn';
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
renderPersonalFiles(); // Khởi tạo lần đầu

// --- LOGIC VÀO GAME ---
document.getElementById('btnStart').onclick = async () => {
    if (selectedLevels.length === 0 && selectedPersonalFiles.length === 0) 
        return alert("Vui lòng chọn ít nhất 1 Level HSK hoặc 1 File Cá Nhân để luyện tập!");

    document.getElementById('btnStart').innerHTML = "ĐANG TẢI DỮ LIỆU... <i class='bx bx-loader-alt bx-spin'></i>";
    quizData = [];

    // Load file HSK chuẩn
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

    // Load file Cá nhân từ LocalStorage
    for (let name of selectedPersonalFiles) {
        const text = personalFiles[name];
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        quizData = [...quizData, ...parsed.data.map(r => [...r, name])];
    }

    if (quizData.length === 0) {
        document.getElementById('btnStart').innerHTML = "BẮT ĐẦU <i class='bx bx-play'></i>";
        return alert("Không đọc được dữ liệu, hãy kiểm tra lại file CSV.");
    }

    // Random câu hỏi
    quizData.sort(() => Math.random() - 0.5);

    // Kích hoạt Game UI
    document.getElementById('btnStart').innerHTML = "BẮT ĐẦU <i class='bx bx-play'></i>";
    document.getElementById('gameScreen').style.display = 'flex';
    hp = 5; score = 0; currentIndex = 0;
    
    showQuestion();
};

function endGame() {
    document.getElementById('gameScreen').style.display = 'none';
}

// Hàm showQuestion và renderAnswers TƯƠNG TỰ BẢN CŨ CỦA BẠN
function showQuestion() {
    if (currentIndex >= quizData.length || hp <= 0) {
        alert(hp <= 0 ? "Hết tim rồi, học lại nha! 💔" : "Tuyệt vời! Bạn đã hoàn thành bài tập! 🎉");
        endGame();
        return;
    }

    const currentWord = quizData[currentIndex];
    const [hanzi, pinyin, meaning, type, example, lvl] = currentWord;

    document.getElementById('lvlBadge').innerText = lvl;
    document.getElementById('progressText').innerText = `${score} / ${quizData.length}`;

    const mainQ = document.getElementById('mainQuestion');
    const subQ = document.getElementById('subQuestion');
    let correctAnswer = "";

    if (selectedMode === "NGHĨA") {
        mainQ.innerText = hanzi; subQ.innerText = pinyin; correctAnswer = meaning;
    } else if (selectedMode === "PINYIN") {
        mainQ.innerText = hanzi; subQ.innerText = meaning; correctAnswer = pinyin;
    } else { 
        mainQ.innerText = meaning; mainQ.style.fontSize = "3rem"; subQ.innerText = pinyin; correctAnswer = hanzi;
    }

    renderAnswers(correctAnswer);
}

function renderAnswers(correct) {
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
                score++; currentIndex++; showQuestion();
            } else {
                hp--;
                alert(`Sai rồi! Đáp án đúng là: ${correct}`);
                document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
                quizData.push(quizData.splice(currentIndex, 1)[0]); // Đẩy xuống cuối học lại
                showQuestion();
            }
        };
        container.appendChild(btn);
    });
}
