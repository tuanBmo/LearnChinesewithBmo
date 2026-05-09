// --- CẤU HÌNH & BIẾN TRẠNG THÁI ---
const levels = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6", "HSK7", "HSK8", "HSK9"];
let selectedLevels = [];
let selectedMode = "NGHĨA";
let quizData = [];
let currentIndex = 0;
let hp = 5;
let score = 0;

// Khởi tạo các thẻ Pill chọn Level ở dưới cùng
const levelGrid = document.getElementById('levelGrid');
levels.forEach(lvl => {
    const btn = document.createElement('button');
    btn.className = 'bento-pill';
    // Thêm icon ngôi sao vào trong nút giống ảnh mẫu
    btn.innerHTML = `<i class='bx bxs-star'></i> ${lvl}`; 
    
    btn.onclick = () => {
        btn.classList.toggle('active');
        const name = lvl.toLowerCase();
        if (selectedLevels.includes(name)) {
            selectedLevels = selectedLevels.filter(l => l !== name);
        } else {
            selectedLevels.push(name);
        }
    };
    levelGrid.appendChild(btn);
});

// Xử lý chọn Mode
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.getAttribute('data-mode');
    };
});

// --- LOGIC TẢI DỮ LIỆU ---
async function fetchCSVData() {
    quizData = [];
    for (let lvl of selectedLevels) {
        try {
            const response = await fetch(`${lvl}.csv`);
            if (!response.ok) continue;
            const csvText = await response.text();
            
            const result = Papa.parse(csvText, { skipEmptyLines: true });
            const rowsWithLevel = result.data.map(row => [...row, lvl.toUpperCase()]);
            quizData = [...quizData, ...rowsWithLevel];
        } catch (e) { console.error("Lỗi tải file:", e); }
    }
}

// --- LOGIC TRÒ CHƠI ---
document.getElementById('btnStart').onclick = async () => {
    if (selectedLevels.length === 0) return alert("Vui lòng chọn ít nhất 1 Level ở bên dưới!");

    const startBtn = document.getElementById('btnStart');
    startBtn.innerHTML = "ĐANG TẢI... <i class='bx bx-loader-alt bx-spin'></i>";

    await fetchCSVData();
    if (quizData.length === 0) {
        startBtn.innerHTML = "VÀO VIỆC <i class='bx bx-right-arrow-alt'></i>";
        return alert("Không tìm thấy dữ liệu CSV!");
    }

    if (document.getElementById('settingRandom').checked) {
        quizData.sort(() => Math.random() - 0.5);
    }

    // Chuyển màn hình
    document.getElementById('menuScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    
    showQuestion();
};

function showQuestion() {
    if (currentIndex >= quizData.length || hp <= 0) {
        alert(hp <= 0 ? "Thử lại lần sau nhé! 😅" : "Chúc mừng Bậc Thầy Hán Ngữ! 🎉");
        location.reload();
        return;
    }

    const currentWord = quizData[currentIndex];
    const [hanzi, pinyin, meaning, type, example, lvl] = currentWord;

    document.getElementById('lvlBadge').innerText = lvl;
    document.getElementById('progressText').innerText = `${score} / ${quizData.length}`;

    const mainQ = document.getElementById('mainQuestion');
    const subQ = document.getElementById('subQuestion');
    const exT = document.getElementById('exampleText');

    let correctAnswer = "";

    if (selectedMode === "NGHĨA") {
        mainQ.innerText = hanzi;
        subQ.innerText = document.getElementById('settingPinyin').checked ? pinyin : "****";
        correctAnswer = meaning;
    } else if (selectedMode === "PINYIN") {
        mainQ.innerText = hanzi;
        subQ.innerText = meaning;
        correctAnswer = pinyin;
    } else { 
        mainQ.innerText = meaning;
        mainQ.style.fontSize = "3rem"; 
        subQ.innerText = document.getElementById('settingPinyin').checked ? pinyin : "****";
        correctAnswer = hanzi;
    }

    exT.innerText = document.getElementById('settingExample').checked ? (example || "") : "";

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
        btn.className = "ans-btn";
        btn.innerText = text;
        btn.onclick = () => {
            if (text === correct) {
                score++; currentIndex++;
                showQuestion();
            } else {
                hp--;
                alert(`Sai mất rồi! Đáp án đúng là: ${correct}`);
                document.getElementById('hpDisplay').innerText = "❤️".repeat(Math.max(0, hp));
                const item = quizData.splice(currentIndex, 1)[0];
                quizData.push(item);
                showQuestion();
            }
        };
        container.appendChild(btn);
    });
}
