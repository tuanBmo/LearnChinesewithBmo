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

// CẤU TRÚC LƯU TRỮ unique từ: { "HSK1": ["我", "你"], "MSUTONG": ["电脑"] }
let hskMasteredWords = getSafeData('hsk_mastered_words_v2', {});
let hskLevelTotals = getSafeData('hsk_level_totals_v2', {}); 

let personalFiles = getSafeData('hsk_personal_files', {});
let currentUser = localStorage.getItem('hsk_current_user');
let appSettings = getSafeData('hsk_settings', { hidePinyin: false, shuffle: true });

// Lịch sử Đăng nhập mảng các ngày: ["2026-5-10", "2026-5-11", "2026-5-12"]
let loginHistory = getSafeData('hsk_login_history', []);
let currentStreak = 0;

let matchGameSelected = [];
let matchedCount = 0;
let globalDictionary = []; // Chứa tất cả từ vựng để Search

// ==========================================
// 2. DATA TRÍCH DẪN & HÌNH NỀN TRUYỀN ĐỘNG LỰC
// ==========================================
// Danh sách hình nền mang tính truyền động lực (Abstract, phong cảnh trừu tượng, đầy màu sắc)
const motivationalBgImages = [
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop", // Phong cảnh núi non
    "https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?q=80&w=800&auto=format&fit=crop", // Trừu tượng đầy màu sắc
    "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=800&auto=format&fit=crop", // Không gian
    "https://images.unsplash.com/photo-1520034475321-cbe63696469a?q=80&w=800&auto=format&fit=crop", // Phong cảnh trừu tượng
    "https://images.unsplash.com/photo-1497561813398-8fcc7a37b567?q=80&w=800&auto=format&fit=crop"  // Phong cảnh trừu tượng
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
    
    // Tải File cá nhân
    Object.keys(personalFiles).forEach(name => {
        const parsed = Papa.parse(personalFiles[name], { skipEmptyLines: true });
        parsed.data.forEach(r => { if(r.length >= 3) globalDictionary.push([...r, name.toUpperCase()]) });
    });

    // Tải HSK chuẩn
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

// Chức năng Tìm kiếm
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
        }).slice(0, 15); // Lấy tối đa 15 kết quả

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

    // Tắt search box khi click ra ngoài
    document.addEventListener('click', (e) => {
        if(!searchInput.contains(e.target) && !searchBox.contains(e.target)) {
            searchBox.style.display = 'none';
        }
    });
}


// ==========================================
// HỆ THỐNG ÂM THANH (Mã không thay đổi) ... 
// ==========================================

// ==========================================
// 4. UI: CÂU NÓI & LỊCH STREAK
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
    
    // 1. Ghi nhận đăng nhập hôm nay
    if (!loginHistory.includes(todayStr)) {
        loginHistory.push(todayStr);
        localStorage.setItem('hsk_login_history', JSON.stringify(loginHistory));
    }

    // 2. Tính chuỗi Streak ngược từ hôm nay
    currentStreak = 0;
    let checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    while(true) {
        let checkStr = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
        if(loginHistory.includes(checkStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1); // Lùi 1 ngày
        } else {
            break;
        }
    }
    
    const streakUI = document.getElementById('streakCountUI');
    if (streakUI) streakUI.innerText = currentStreak;

    // 3. Render Calendar V2 (Theo hình ảnh yêu cầu)
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calendarMonth');
    if(!grid) return;
    grid.innerHTML = "";
    
    const year = d.getFullYear();
    const month = d.getMonth();
    
    // Gắn Tiêu đề tháng
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
    if(monthLabel) monthLabel.innerText = `${monthNames[month]} ${year}`;

    // Tính toán khung lịch
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // Ngày đầu tháng là thứ mấy (0=CN, 1=T2)
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Số ngày của tháng hiện tại
    const daysInPrevMonth = new Date(year, month, 0).getDate(); // Số ngày của tháng trước
    
    // Chuyển thứ CN(0) thành vị trí T2(0), CN(6)
    let startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

    // Vẽ các ngày của tháng TRƯỚC (màu nhạt, CBD5E1)
    for(let i = startOffset - 1; i >= 0; i--) { 
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.innerText = daysInPrevMonth - i;
        grid.appendChild(cell);
    }
    
    // Vẽ các ngày của tháng HIỆN TẠI (Màu đậm hơn, 475569)
    for(let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day current-month';
        cell.innerText = i;
        
        let cellDateStr = `${year}-${month + 1}-${i}`;
        
        // Đánh dấu ngày hôm nay (khoanh tròn xanh, 38BDF8)
        if (i === d.getDate()) cell.classList.add('today');
        
        // Đánh dấu đốm lửa
        if (loginHistory.includes(cellDateStr)) cell.classList.add('active');
        
        grid.appendChild(cell);
    }
    
    // Vẽ các ngày của tháng SAU cho đầy lưới (màu nhạt, CBD5E1)
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
// 5. THỐNG KÊ UNIQUE TỪ VỰNG & LEVEL MASTERY (Mã không thay đổi) ...
// ==========================================

// ==========================================
// 6. KHỞI TẠO APP (Mã không thay đổi) ...
// ==========================================

// ==========================================
// 7. ĐIỀU HƯỚNG TABS & QUẢN LÝ FILE (Mã không thay đổi) ...
// ==========================================

// ==========================================
// 8. MINI GAME: GHÉP TỪ (Mã không thay đổi) ...
// ==========================================

// ==========================================
// 9. LOGIC GAME LUYỆN TẬP CHÍNH (Mã không thay đổi) ...
// ==========================================

// ==========================================
// 10. ÔN TẬP VÀ KẾT THÚC BÀI (Mã không thay đổi) ...
// ==========================================

// Chạy khởi tạo
checkAuth();
