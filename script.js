// ==========================================
// 1. BIẾN TRẠNG THÁI VÀ DỮ LIỆU CỐT LÕI
// ==========================================
const levels = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];
let selectedLevels = [];
let selectedPersonalFiles = [];
let selectedMode = "NGHĨA";
let quizData = [];
let grammarData = []; // Mảng chứa dữ liệu ngữ pháp
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
        hanziEl.innerText = quote.hanzi; pinyinEl.innerText = quote.pinyin; meaningEl.innerText = quote.meaning;
        card.style.backgroundImage = `url('${bgUrl}')`;
    }
}

function processStreakCalendar() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!loginHistory.includes(todayStr)) {
        loginHistory.push(todayStr); localStorage.setItem('hsk_login_history', JSON.stringify(loginHistory));
    }
    currentStreak = 0;
    let checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    while(true) {
        let checkStr = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
        if(loginHistory.includes(checkStr)) { currentStreak++; checkDate.setDate(checkDate.getDate() - 1); } else { break; }
    }
    const streakUI = document.getElementById('streakCountUI');
    if (streakUI) streakUI.innerText = currentStreak;

    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calendarMonth');
    if(!grid) return;
    grid.innerHTML = "";
    
    const year = d.getFullYear(); const month = d.getMonth();
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
    if(monthLabel) monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 
    const daysInPrevMonth = new Date(year, month, 0).getDate(); 
    let startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

    for(let i = startOffset - 1; i >= 0; i--) { 
        const cell = document.createElement('div'); cell.className = 'cal-day'; cell.innerText = daysInPrevMonth - i; grid.appendChild(cell);
    }
    for(let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div'); cell.className = 'cal-day current-month'; cell.innerText = i;
        let cellDateStr = `${year}-${month + 1}-${i}`;
        if (i === d.getDate()) cell.classList.add('today');
        if (loginHistory.includes(cellDateStr)) cell.classList.add('active');
        grid.appendChild(cell);
    }
    const totalCells = startOffset + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for(let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('div'); cell.className = 'cal-day'; cell.innerText = i; grid.appendChild(cell);
    }
}

// ==========================================
// 6. THỐNG KÊ UNIQUE TỪ VỰNG
// ==========================================
function recordCorrectWord(level, hanziWord) {
    if(!isReviewMode) {
        if(!hskMasteredWords[level]) hskMasteredWords[level] = [];
        if(!hskMasteredWords[level].includes(hanziWord)) {
            hskMasteredWords[level].push(hanziWord); localStorage.setItem('hsk_mastered_words_v2', JSON.stringify(hskMasteredWords));
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
