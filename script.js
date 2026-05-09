// ==========================================
// CẤU HÌNH & BIẾN TRẠNG THÁI GAME
// ==========================================
let masterData = [];      // Chứa toàn bộ từ vựng đã load
let currentQueue = [];    // Hàng đợi câu hỏi hiện tại
let currentIndex = 0;     // Vị trí câu hỏi đang xét
let hp = 5;               // Máu (Tim)
let score = 0;            // Điểm số

// Cấu hình mặc định (có thể viết thêm UI modal để chọn lại sau)
let selectedLevels = ["hsk1", "hsk2", "hsk3"]; 
let selectedMode = "NGHĨA"; // Các mode: "NGHĨA", "PINYIN", "CHỮ HÁN"
let showPinyin = true;      // Hiện Pinyin hỗ trợ
let isRandom = true;        // Đảo bừa câu hỏi

// ==========================================
// KẾT NỐI UI: DASHBOARD <-> GAME SCREEN
// ==========================================
const btnPlay = document.getElementById('btnPlayOldMode');
const homeScreen = document.getElementById('homeScreen');
const gameScreen = document.getElementById('gameScreen');

// Lắng nghe sự kiện bấm "Bắt đầu thử ngay" ở Dashboard mới
if (btnPlay) {
    btnPlay.addEventListener('click', async () => {
        // Đổi trạng thái nút thành Đang tải
        const originalText = btnPlay.innerHTML;
        btnPlay.innerHTML = "Đang tải dữ liệu... <i class='bx bx-loader-alt bx-spin'></i>";
        
        // Chạy hàm khởi tạo game
        await initGame();
        
        // Nếu load data thành công thì chuyển màn hình
        if (masterData.length > 0) {
            homeScreen.classList.remove('active');
            homeScreen.style.display = 'none';
            
            gameScreen.style.display = 'flex'; // Hiển thị khu vực Game
            gameScreen.classList.add('active');
            
            // Đổi background thành màu tối cho focus vào thẻ Flashcard
            document.body.style.background = 'radial-gradient(circle at top right, #1e1b4b, #0f172a)'; 
        } else {
            btnPlay.innerHTML = originalText; // Trả lại nút nếu lỗi
        }
    });
}

// Hàm quay lại trang chủ (Gắn vào nút Dừng/Thoát trong khu vực Game)
window.backToHome = function() {
    gameScreen.style.display = 'none';
    gameScreen.classList.remove('active');
    
    homeScreen.style.display = 'block';
    homeScreen.classList.add('active');
    
    // Trả lại màu nền sáng cho giao diện Dashboard
    document.body.style.background = 'var(--bg-main)'; 
    
    // Reset lại chỉ số
    hp = 5;
    score = 0;
    currentIndex = 0;
    
    if (btnPlay) {
        btnPlay.innerHTML = "Bắt đầu thử ngay <i class='bx bx-chevron-right'></i>";
    }
}

// ==========================================
// LOGIC GAME CỐT LÕI (LOAD CSV & XỬ LÝ)
// ==========================================
async function initGame() {
    masterData = [];
    
    // Đọc từng file CSV dựa trên mảng selectedLevels
    for (let l of selectedLevels) {
        try {
            const res = await fetch(`${l}.csv`);
            if (!res.ok) continue;
            const text = await res.text();
            
            // Dùng PapaParse (Đã nhúng ở index.html)
            const parsed = Papa.parse(text, { skipEmptyLines: true });
            
            // Map cấu trúc: h: Chữ Hán (cột 0), p: Pinyin (cột 1), m: Nghĩa (cột 2)
            const levelData = parsed.data.map(r => ({ 
                h: r[0], 
                p: r[1], 
                m: r[2], 
                lvl: l.toUpperCase() 
            }));
            
            masterData = [...masterData, ...levelData];
        } catch(e) { 
            console.warn(`Không tìm thấy file ${l}.csv, bỏ qua.`, e); 
        }
    }

    if (masterData.length === 0) {
        alert("Kho dữ liệu trống! Bạn kiểm tra lại các file CSV nhé.");
        return;
    }

    currentQueue = [...masterData];
    
    // Trộn ngẫu nhiên câu hỏi
    if (isRandom) {
        currentQueue.sort(() => Math.random() - 0.5);
    }

    renderQuestion();
}

// ==========================================
// RENDER FLASHCARD & ĐÁP ÁN
// ==========================================
function renderQuestion() {
    // Check điều kiện thắng thua
    if (currentIndex >= currentQueue.length || hp <= 0) {
        alert(hp <= 0 ? "BẠN ĐÃ BAY MÀU! 💀 Thử lại nhé!" : "CHÚC MỪNG BẬC THẦY HÁN NGỮ! 🎉");
        backToHome(); 
        return;
    }

    const data = currentQueue[currentIndex];
    
    // Bắt các DOM elements trong gameScreen (giữ nguyên ID theo code cũ của bạn)
    const lvlTag = document.getElementById('lvlTag');
    const progressInfo = document.getElementById('progressInfo');
    const hpBox = document.getElementById('hpBox');
    const qMain = document.getElementById('qMain');
    const qSub = document.getElementById('qSub');
    const btnPeek = document.getElementById('btnPeek');
    const ansGrid = document.getElementById('ansGrid');

    // Cập nhật thông số HUD
    if(lvlTag) lvlTag.innerText = data.lvl;
    if(progressInfo) progressInfo.innerText = `${score}/${currentQueue.length}`;
    if(hpBox) hpBox.innerText = "❤️".repeat(Math.max(0, hp));
    if(btnPeek) btnPeek.style.display = "none";
    
    let correct = "";

    // Xử lý hiển thị dựa trên chế độ chơi (Mode)
    if (selectedMode === "NGHĨA") {
        if(qMain) { qMain.innerText = data.h; qMain.style.fontSize = "100px"; }
        correct = data.m;
        if (showPinyin) {
            if(qSub) qSub.innerText = data.p;
        } else { 
            if(qSub) qSub.innerText = "****"; 
            if(btnPeek) btnPeek.style.display = "flex"; 
        }
    } else if (selectedMode === "PINYIN") {
        if(qMain) { qMain.innerText = data.h; qMain.style.fontSize = "100px"; }
        if(qSub) qSub.innerText = data.m;
        correct = data.p;
    } else { // CHẾ ĐỘ CHỮ HÁN
        if(qMain) { qMain.innerText = data.m; qMain.style.fontSize = "45px"; }
        correct = data.h;
        if (showPinyin) {
            if(qSub) qSub.innerText = data.p;
        } else { 
            if(qSub) qSub.innerText = "****"; 
            if(btnPeek) btnPeek.style.display = "flex"; 
        }
    }

    // Nút xem lén pinyin
    if(btnPeek) {
        btnPeek.onclick = () => { 
            qSub.innerText = data.p; 
            btnPeek.style.display = "none"; 
        };
    }

    // Render 4 đáp án (1 đúng, 3 nhiễu)
    if(ansGrid) ansGrid.innerHTML = "";
    
    const key = selectedMode === "NGHĨA" ? 'm' : (selectedMode === "PINYIN" ? 'p' : 'h');
    let choices = [correct];
    
    // Lấy pool đáp án cùng loại để tạo nhiễu
    const pool = [...new Set(masterData.map(x => x[key]))];
    
    while(choices.length < 4 && pool.length > 4) {
        let r = pool[Math.floor(Math.random() * pool.length)];
        if (!choices.includes(r)) choices.push(r);
    }
    
    // Xáo trộn vị trí đáp án
    choices.sort(() => Math.random() - 0.5);

    // Tạo nút cho từng đáp án
    choices.forEach(c => {
        const b = document.createElement('button');
        b.className = 'ans-btn'; 
        b.innerText = c;
        
        b.onclick = () => {
            if (c === correct) { 
                score++; 
                currentIndex++; 
                renderQuestion(); 
            } else {
                hp--; 
                // Hiệu ứng rung lắc thẻ
                const card = document.getElementById('card');
                if(card) {
                    card.classList.add('shake');
                    setTimeout(() => card.classList.remove('shake'), 400);
                }
                
                alert(`Sai rồi! Đáp án đúng là: ${correct}`);
                
                // Thuật toán Spaced Repetition "chạy bằng cơm": Trả câu sai về cuối hàng đợi
                currentQueue.push(currentQueue.splice(currentIndex, 1)[0]);
                renderQuestion();
            }
        };
        
        if(ansGrid) ansGrid.appendChild(b);
    });
}
