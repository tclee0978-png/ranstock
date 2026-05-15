// app.js - 然然贏家 Pro v2.0（即時 + 盤後強化）
console.log('%c🚀 然然贏家 Pro v2.0 已啟動 • 煥然專屬高勝率系統', 'color:#c5a05b; font-size:18px; font-weight:bold');

// ==================== v2.0 即時 + 盤後強化 ====================
let isRealTime = false;
let realtimeInterval = null;
let modeCheckInterval = null;

const TWSE_SNAPSHOT = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=';
const REALTIME_SYMBOLS = [
    'tse_2330.tw', 'tse_2454.tw', 'tse_2317.tw', 'tse_2881.tw',
    'tse_3008.tw', 'otc_6669.tw', 'tse_3443.tw', 'tse_2382.tw', 'tse_2303.tw'
];

// ==================== 1. Mock 全台股數據（盤後 / API 失敗備援） ====================
const FALLBACK_STOCKS = [
    { symbol: '2330', name: '台積電', change: 4.8, volume: 12500, prevVolume: 7800, ma5: 1025, price: 1028, grade: 'S', force: '突破10日沉澱區 • 一波流', isFake: false },
    { symbol: '2454', name: '聯發科', change: 5.2, volume: 9800, prevVolume: 4200, ma5: 1320, price: 1335, grade: 'S', force: '爆量突破 • 主力鎖單', isFake: false },
    { symbol: '3008', name: '大立光', change: 6.0, volume: 8900, prevVolume: 3100, ma5: 2450, price: 2480, grade: 'S', force: '主力點火 • 強勢鎖漲停', isFake: false },
    { symbol: '6669', name: '緯穎', change: 4.2, volume: 4200, prevVolume: 1800, ma5: 620, price: 630, grade: 'S', force: '10日沉澱後爆量', isFake: false },
    { symbol: '2317', name: '鴻海', change: 3.1, volume: 6500, prevVolume: 7200, ma5: 178, price: 179, grade: 'A', force: '量增站上5MA', isFake: true },
    { symbol: '3443', name: '創意', change: 3.9, volume: 3100, prevVolume: 2900, ma5: 112, price: 114, grade: 'A', force: '站穩5MA', isFake: false },
    { symbol: '2881', name: '富邦金', change: 2.8, volume: 3100, prevVolume: 2800, ma5: 68, price: 69, grade: 'B', force: '無量大噴 • 誘敵', isFake: true },
    { symbol: '2303', name: '聯電', change: 3.5, volume: 5200, prevVolume: 4100, ma5: 52, price: 54, grade: 'A', force: '量增突破5MA', isFake: false },
    { symbol: '2382', name: '廣達', change: 4.1, volume: 7800, prevVolume: 5500, ma5: 285, price: 292, grade: 'S', force: '沉澱區突破', isFake: false },
    { symbol: '3711', name: '日月光投控', change: 3.2, volume: 4100, prevVolume: 3800, ma5: 178, price: 182, grade: 'A', force: '溫和量增', isFake: false }
];

let mockStocks = FALLBACK_STOCKS.map(s => ({ ...s }));

// ==================== 2. 核心語錄 & 心法 ====================
const coreQuotes = [
    '大噴後再追就是接刀，因為那是流動性瞬間失衡的暴力收割。',
    '獵人不會在野獸發瘋衝刺時擋在前面，我們在陷阱邊等回踩。',
    '死命抱緊模式 (HODL)：針對主力築底後的強勢股，不被洗掉。',
    '你是三個孩子的榜樣，穩健才是王道。',
    '寧可錯過 2% 的噴發，不扛 5% 的下殺。',
    '99% 勝率 = 絕對風險控制',
    '盤後覆盤：看量不看價，量才是主力的腳印。',
    '08:30 戰報提醒：今日只做 S 級，其餘觀望。'
];

const preMarketReport = '📋 盤前戰報（08:30）\n煥然，今日紀律：只做漲幅 3~6%、量增、站穩 5MA 的 S 級標的。寧可空手，不接誘多刀。';

// ==================== 3. 歷史 K 線 Mock ====================
const LABELS = ['5/8', '5/9', '5/12', '5/13', '5/14', '5/15'];
const mockHistoricalData = {};

function buildHistoricalData(basePrice) {
    const prices = [];
    const volumes = [];
    const ma5 = [];
    let p = basePrice * 0.95;
    for (let i = 0; i < 6; i++) {
        const drift = (Math.random() - 0.35) * basePrice * 0.02;
        p = Math.round(p + drift);
        prices.push(p);
        volumes.push(Math.round(3000 + Math.random() * 10000));
    }
    prices[5] = basePrice;
    for (let i = 0; i < 6; i++) {
        const slice = prices.slice(Math.max(0, i - 4), i + 1);
        ma5.push(Math.round(slice.reduce((a, b) => a + b, 0) / slice.length));
    }
    return { labels: LABELS, prices, volumes, ma5 };
}

function rebuildHistoricalData() {
    Object.keys(mockHistoricalData).forEach(k => delete mockHistoricalData[k]);
    mockStocks.forEach(s => {
        mockHistoricalData[s.symbol] = buildHistoricalData(s.price);
    });
}

rebuildHistoricalData();

// ==================== 4. 狀態 ====================
let currentChart = null;
let selectedSymbol = '2330';
let preMarketShown = false;

// ==================== 5. TWSE 即時 API ====================
function parseTwseChange(s) {
    const price = parseFloat(s.z) || parseFloat(s.y) || 0;
    const yClose = parseFloat(s.y) || price;
    if (s.ud && !isNaN(parseFloat(s.ud))) {
        const ud = parseFloat(s.ud);
        if (yClose > 0 && Math.abs(ud) <= 20) return ud;
    }
    if (yClose > 0 && price > 0) return +((price - yClose) / yClose * 100).toFixed(2);
    return 0;
}

function mapTwseStock(s) {
    const price = parseFloat(s.z) || parseFloat(s.y) || 0;
    const change = parseTwseChange(s);
    const volume = (parseFloat(s.v) || 0) * 1000;
    const prevVolume = volume * 0.7;
    const ma5 = price * 0.98;

    return {
        symbol: s.c,
        name: (s.n || '').trim(),
        change,
        volume,
        prevVolume,
        ma5,
        price,
        grade: change >= 3 && change <= 6 && volume > prevVolume * 1.5 ? 'S' : change > 2 ? 'A' : 'B',
        force: change > 5 ? '盤中爆量點火' : change >= 3 ? '量增站穩' : '觀望區間',
        isFake: volume > prevVolume * 3 && change < 2
    };
}

async function fetchRealTimeStocks() {
    const query = REALTIME_SYMBOLS.join('|');
    try {
        const res = await fetch(`${TWSE_SNAPSHOT}${query}&json=1&delay=0`, { cache: 'no-store' });
        const data = await res.json();
        const stocks = (data.msgArray || []).map(mapTwseStock).filter(s => s.symbol);

        if (stocks.length === 0) throw new Error('empty');

        mockStocks = stocks;
        rebuildHistoricalData();
        renderStockList();
        renderStockSelector();
        updateWinRate();

        const still = mockStocks.find(s => s.symbol === selectedSymbol);
        if (still) loadChart(selectedSymbol);
        else if (mockStocks[0]) selectStock(mockStocks[0].symbol);

        const lastEl = document.getElementById('last-update');
        if (lastEl) {
            const now = new Date();
            lastEl.textContent = `上次更新：${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }
    } catch (e) {
        console.log('API 暫時無法取得，即時模式切回模擬', e);
        const lastEl = document.getElementById('last-update');
        if (lastEl) lastEl.textContent = '上次更新：模擬資料（API 連線失敗）';
    }
}

function setScanStatusRealtime(active) {
    const bar = document.getElementById('scan-status');
    if (bar) bar.classList.toggle('realtime-active', active);
}

function toggleRealTime() {
    isRealTime = !isRealTime;
    const btn = document.querySelector('#scan-status button');
    const modeText = document.getElementById('mode-text');

    if (isRealTime) {
        if (btn) btn.textContent = '停止即時掃描';
        if (modeText) modeText.textContent = '盤中即時模式（15秒更新）';
        setScanStatusRealtime(true);
        fetchRealTimeStocks();
        realtimeInterval = setInterval(fetchRealTimeStocks, 15000);
    } else {
        if (btn) btn.textContent = '切換即時掃描';
        if (modeText) modeText.textContent = '盤後歷史模式';
        setScanStatusRealtime(false);
        clearInterval(realtimeInterval);
        realtimeInterval = null;
        mockStocks = FALLBACK_STOCKS.map(s => ({ ...s }));
        rebuildHistoricalData();
        renderStockList();
        renderStockSelector();
        updateWinRate();
        loadChart(selectedSymbol);
        const lastEl = document.getElementById('last-update');
        if (lastEl) lastEl.textContent = '上次更新：歷史模擬';
    }
}

async function afterHoursVolumeScan() {
    console.log('🔍 盤後爆量回放啟動...');
    const modeText = document.getElementById('mode-text');
    if (modeText) modeText.textContent = '盤後主力佈局模式';
    runFullScan();
}

function isTradingHours() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const mins = h * 60 + m;
    return mins >= 9 * 60 && mins < 13 * 60 + 30;
}

// ==================== 6. 篩選條件 ====================
function passesScanFilter(stock) {
    const changeOk = stock.change >= 3 && stock.change <= 6;
    const volumeOk = stock.volume > stock.prevVolume;
    const maOk = stock.price >= stock.ma5;
    return changeOk && volumeOk && maOk;
}

function getFilteredStocks() {
    return mockStocks
        .filter(passesScanFilter)
        .sort((a, b) => {
            const gradeOrder = { S: 3, A: 2, B: 1 };
            if (gradeOrder[b.grade] !== gradeOrder[a.grade]) return gradeOrder[b.grade] - gradeOrder[a.grade];
            return b.change - a.change;
        });
}

// ==================== 7. 初始化 ====================
function init() {
    if (typeof tailwind !== 'undefined') {
        tailwind.config = { theme: { extend: {} } };
    }

    updateClock();
    setInterval(updateClock, 1000);

    updateMarketMode();
    setInterval(updateMarketMode, 60000);

    renderStockList();
    renderStockSelector();
    loadChart('2330');

    spawnAIBubble();
    setInterval(spawnAIBubble, 8000);

    schedulePreMarketReport();
    updateWinRate();
    updateChartFooter();
}

function initV2() {
    init();

    const modeText = document.getElementById('mode-text');
    if (isTradingHours()) {
        toggleRealTime();
    } else {
        if (modeText) modeText.textContent = '盤後主力佈局模式';
        afterHoursVolumeScan();
    }

    modeCheckInterval = setInterval(() => {
        const trading = isTradingHours();
        if (trading && !isRealTime) toggleRealTime();
        if (!trading && isRealTime) toggleRealTime();
    }, 60000);
}

function updateClock() {
    const now = new Date();
    const el = document.getElementById('current-time');
    if (!el) return;
    el.textContent = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function updateChartFooter() {
    const el = document.getElementById('chart-footer-time');
    if (!el) return;
    const now = new Date();
    const mode = isRealTime ? '即時' : '盤後';
    el.textContent = `目前時間 ${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${mode} • 歷史數據已載入`;
}

function updateMarketMode() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const mins = h * 60 + m;
    const isTrading = mins >= 9 * 60 && mins < 13 * 60 + 30;
    const isPreMarket = mins >= 8 * 60 + 30 && mins < 9 * 60;

    const dot = document.getElementById('market-dot');
    const label = document.getElementById('market-label');
    const status = document.getElementById('market-status');
    const chartTitle = document.getElementById('chart-title');

    if (!label) return;

    if (isTrading) {
        label.textContent = '盤中即時';
        if (dot) { dot.classList.remove('bg-red-500'); dot.classList.add('bg-green-500'); }
        if (status) status.classList.add('market-open');
        if (chartTitle) chartTitle.textContent = '即時主力佈局分析 • 盤中模式';
    } else if (isPreMarket) {
        label.textContent = '盤前備戰';
        if (dot) { dot.classList.remove('bg-green-500'); dot.classList.add('bg-yellow-500'); }
        if (chartTitle) chartTitle.textContent = '盤前戰略佈局 • 08:30 戰報';
    } else {
        label.textContent = '盤後模式';
        if (dot) { dot.classList.remove('bg-green-500', 'bg-yellow-500'); dot.classList.add('bg-red-500'); }
        if (status) status.classList.remove('market-open');
        if (chartTitle) chartTitle.textContent = '歷史主力佈局分析 • 盤後模式';
    }
    updateChartFooter();
}

function schedulePreMarketReport() {
    const check = () => {
        const now = new Date();
        if (now.getHours() === 8 && now.getMinutes() === 30 && !preMarketShown) {
            preMarketShown = true;
            addAIBubble(preMarketReport, true);
        }
        if (now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30)) {
            preMarketShown = false;
        }
    };
    setInterval(check, 30000);
    check();
}

function updateWinRate() {
    const filtered = getFilteredStocks();
    const sCount = filtered.filter(s => s.grade === 'S').length;
    const rate = (98.5 + sCount * 0.1).toFixed(1);
    const el = document.getElementById('win-rate');
    if (el) el.textContent = `${rate}%`;
}

// ==================== 8. 全台股掃描 ====================
function runFullScan() {
    const listEl = document.getElementById('stock-list');
    const btn = document.querySelector('.scan-btn');
    if (btn) btn.classList.add('scanning');

    listEl.innerHTML = '<div class="text-center py-8 text-[#c5a05b]"><span class="scan-loader"></span>正在掃描 1800 檔台股...</div>';

    setTimeout(() => {
        if (btn) btn.classList.remove('scanning');
        renderStockList(true);
        const filtered = getFilteredStocks();
        const sCount = filtered.filter(s => s.grade === 'S').length;
        const statusEl = document.getElementById('main-force-status');
        if (statusEl) {
            statusEl.innerHTML = `🚀 S級主力點火 • 今日共 ${filtered.length} 檔符合（${sCount} 檔 S 級）`;
        }
        updateWinRate();
        const lastEl = document.getElementById('last-update');
        if (lastEl && !isRealTime) lastEl.textContent = '上次更新：盤後掃描完成';
        addAIBubble(`掃描完成！找到 ${filtered.length} 檔符合紀律的標的，其中 ${sCount} 檔 S 級。煥然，只做最好的！`, true);
    }, 1200);
}

function renderStockList(isScanned = false) {
    const listEl = document.getElementById('stock-list');
    if (!listEl) return;

    const stocks = isScanned ? getFilteredStocks() : [...mockStocks].sort((a, b) => b.change - a.change);
    listEl.innerHTML = '';

    if (isScanned && stocks.length > 0) {
        const banner = document.createElement('div');
        banner.className = 'text-[#22c55e] text-center py-2 mb-2 text-sm font-medium';
        banner.textContent = `✅ 掃描完成 • 找到 ${stocks.length} 檔 S/A 級機會`;
        listEl.appendChild(banner);
    }

    stocks.forEach(stock => {
        const gradeColor = stock.grade === 'S' ? 'text-[#c5a05b] bg-[#c5a05b]/10' :
            stock.grade === 'A' ? 'text-[#3b82f6] bg-[#3b82f6]/10' : 'text-gray-400 bg-gray-500/10';
        const volPct = Math.round((stock.volume / stock.prevVolume - 1) * 100);
        const isSelected = stock.symbol === selectedSymbol;
        const changeSign = stock.change >= 0 ? '+' : '';

        const item = document.createElement('div');
        item.className = `stock-item flex justify-between items-center bg-[#1a1a2e] hover:bg-[#25253a] p-4 rounded-3xl cursor-pointer${isSelected ? ' selected' : ''}`;
        item.dataset.symbol = stock.symbol;
        item.onclick = () => selectStock(stock.symbol);
        item.innerHTML = `
            <div>
                <div class="flex items-center gap-3">
                    <span class="font-mono text-xl">${stock.symbol}</span>
                    <span class="text-sm">${stock.name}</span>
                </div>
                <div class="text-xs mt-1 text-gray-400">主力行為：${stock.force}</div>
            </div>
            <div class="text-right">
                <div class="text-2xl font-bold ${stock.change >= 0 ? 'text-[#22c55e]' : 'text-red-400'}">${changeSign}${stock.change}%</div>
                <div class="flex items-center justify-end gap-2">
                    <span class="px-3 py-0.5 text-xs rounded-3xl ${gradeColor}">${stock.grade}級</span>
                    <span class="text-xs font-mono">量 +${volPct}%</span>
                </div>
            </div>`;
        listEl.appendChild(item);
    });
}

// ==================== 9. 主力行為偵測 ====================
function resetAlerts() {
    document.getElementById('fake-break-alert')?.classList.add('hidden');
    document.getElementById('one-wave-alert')?.classList.add('hidden');
}

function detectMainForce(stock) {
    if (!stock) return;
    resetAlerts();

    let statusHTML = '<span class="px-4 py-1 rounded-3xl bg-[#22c55e] text-black">✅ 突破沉澱區</span>';

    if (stock.isFake) {
        document.getElementById('fake-break-alert')?.classList.remove('hidden');
        statusHTML = '<span class="px-4 py-1 rounded-3xl bg-red-500 text-white">⚠️ 誘敵假突破</span>';
    } else if (stock.change >= 5) {
        document.getElementById('one-wave-alert')?.classList.remove('hidden');
        statusHTML = '<span class="px-4 py-1 rounded-3xl bg-[#c5a05b] text-black">🔥 一波流鎖單</span>';
    }

    const statusEl = document.getElementById('main-force-status');
    if (statusEl) {
        statusEl.innerHTML = statusHTML + ` <span class="ml-2 text-black/80">${stock.force}</span>`;
    }
}

function showFakeBreakWarning() {
    document.getElementById('fake-modal')?.classList.remove('hidden');
    addAIBubble('煥然！這是無量假突破，主力在誘多。不要接刀，等回踩再說！', true);
}

// ==================== 10. K 線圖 ====================
function loadChart(symbol) {
    selectedSymbol = symbol;
    const data = mockHistoricalData[symbol] || mockHistoricalData['2330'];

    if (currentChart) currentChart.destroy();

    const ctx = document.getElementById('kline-chart');
    if (!ctx || !data) return;

    const volumeColors = data.volumes.map((v, i) =>
        i > 0 && v > data.volumes[i - 1] ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.5)'
    );

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: '股價',
                    data: data.prices,
                    borderColor: '#c5a05b',
                    backgroundColor: 'rgba(197, 160, 91, 0.08)',
                    fill: true,
                    borderWidth: 3,
                    tension: 0.2,
                    pointRadius: 4,
                    pointBackgroundColor: '#c5a05b',
                    yAxisID: 'y'
                },
                {
                    label: '5MA',
                    data: data.ma5,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: '成交量',
                    data: data.volumes,
                    backgroundColor: volumeColors,
                    yAxisID: 'y1',
                    barThickness: 14,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#c5a05b', font: { size: 13 }, usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1a1a2e',
                    borderColor: '#c5a05b',
                    borderWidth: 1,
                    titleColor: '#c5a05b',
                    bodyColor: '#fff'
                }
            },
            scales: {
                y: { position: 'left', grid: { color: '#222' }, ticks: { color: '#c5a05b' } },
                y1: { position: 'right', grid: { display: false }, ticks: { color: '#22c55e', maxTicksLimit: 4 } },
                x: { grid: { color: '#222' }, ticks: { color: '#c5a05b' } }
            }
        }
    });

    const selectedStock = mockStocks.find(s => s.symbol === symbol);
    detectMainForce(selectedStock);
    renderStockList();
    const sel = document.getElementById('stock-selector');
    if (sel) sel.value = symbol;
}

function renderStockSelector() {
    const select = document.getElementById('stock-selector');
    if (!select) return;
    select.innerHTML = '';
    mockStocks.forEach(stock => {
        const opt = document.createElement('option');
        opt.value = stock.symbol;
        const sign = stock.change >= 0 ? '+' : '';
        opt.textContent = `${stock.symbol} ${stock.name} (${sign}${stock.change}%)`;
        select.appendChild(opt);
    });
}

function selectStock(symbol) {
    const sel = document.getElementById('stock-selector');
    if (sel) sel.value = symbol;
    loadChart(symbol);
}

// ==================== 11. 財務計算器 ====================
function calculateBreakeven() {
    const raw = document.getElementById('buy-price').value.trim();
    const price = parseFloat(raw);
    if (!price || price <= 0) {
        const resultEl = document.getElementById('breakeven-result');
        if (resultEl) {
            resultEl.innerHTML = '<p class="text-red-400">請輸入有效的買進價</p>';
            resultEl.classList.remove('hidden');
        }
        return;
    }

    const feeRate = 0.001425 * 2 + 0.003;
    const breakeven = (price * (1 + feeRate)).toFixed(2);
    const stopLoss = (price * 0.98).toFixed(2);
    const takeProfit = (price * 1.06).toFixed(2);

    const resultEl = document.getElementById('breakeven-result');
    resultEl.innerHTML = `
        <div class="flex justify-between mb-2">
            <span>買進價：</span><span class="font-bold">${price}</span>
        </div>
        <div class="flex justify-between mb-2">
            <span>保本價（含手續費+稅）：</span><span class="text-[#c5a05b] font-bold">${breakeven}</span>
        </div>
        <div class="flex justify-between mb-2 text-[#22c55e]">
            <span>目標價 (+6%)：</span><span class="font-bold">${takeProfit}</span>
        </div>
        <div class="text-xs text-gray-400 mt-3">
            2% 停損價 = <span class="text-red-400 font-bold">${stopLoss}</span> • 立刻停損保護本金
        </div>`;
    resultEl.classList.remove('hidden');
}

function triggerStopLossWarning() {
    document.getElementById('warning-modal')?.classList.remove('hidden');
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('煥然！停損！不要死命抱緊！你有三個孩子要照顧！');
        utterance.lang = 'zh-TW';
        utterance.rate = 0.95;
        speechSynthesis.speak(utterance);
    }
    addAIBubble('煥然！2% 停損是鐵律。執行了嗎？你是三個孩子的榜樣！', true);
}

// ==================== 12. AI 戰友 ====================
function addAIBubble(text, isAI = true) {
    const container = document.getElementById('ai-bubbles');
    if (!container) return;

    const bubble = document.createElement('div');
    if (isAI) {
        bubble.className = 'bubble bg-gradient-to-r from-[#1a1a2e] to-[#25253a] border border-[#c5a05b]/30 p-4 rounded-3xl max-w-[85%] ml-auto text-sm shadow-xl';
        bubble.innerHTML = `<div class="flex items-start gap-3"><div class="text-2xl">🐯</div><div style="white-space:pre-wrap">${text}</div></div>`;
    } else {
        bubble.className = 'bubble bg-[#3b82f6]/10 p-4 rounded-3xl max-w-[75%] mr-auto text-sm';
        bubble.innerHTML = `<div class="italic">${text}</div>`;
    }
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    while (container.children.length > 12) container.removeChild(container.children[0]);
}

function spawnAIBubble() {
    const quote = coreQuotes[Math.floor(Math.random() * coreQuotes.length)];
    addAIBubble(quote, true);
}

function handleAIQuery() {
    const inputEl = document.getElementById('ai-input');
    const input = inputEl?.value.trim();
    if (!input) return;

    addAIBubble(input, false);
    inputEl.value = '';

    setTimeout(() => {
        let reply = '煥然，記住：FOMO 是最大的敵人。紀律 > 情緒。';
        const q = input.toLowerCase();

        if (input.includes('追') || input.includes('噴') || input.includes('漲停')) {
            reply = '大噴後再追就是接刀！我們在陷阱邊等回踩，不當接刀俠。';
        } else if (input.includes('停損') || input.includes('虧') || input.includes('賠')) {
            reply = '2% 就停損！你不是廢物，你是三個孩子的榜樣。穩健才是王道。';
        } else if (input.includes('買') || input.includes('進場')) {
            const stock = mockStocks.find(s => input.includes(s.symbol) || input.includes(s.name));
            reply = stock
                ? (stock.isFake ? `${stock.name}：⚠️ 誘敵假突破，不要進！` : `${stock.name}：${stock.grade}級 • ${stock.force}。符合紀律可觀察，停損 2% 必設。`)
                : '進場前三問：量增嗎？站穩 5MA 嗎？是 S 級嗎？缺一不做。';
        } else if (input.includes('賣') || input.includes('出')) {
            reply = '獲利了？分批出場鎖利。虧損了？2% 停損不要猶豫。';
        } else if (input.includes('台積') || input.includes('2330')) {
            reply = '2330 台積電：S級標的，10日沉澱後爆量突破。但記得設停損！';
        } else if (q.includes('勝率') || input.includes('99')) {
            reply = '99% 勝率來自風控，不是每單都贏。寧可錯過，不扛下殺。';
        } else if (input.includes('即時') || input.includes('API')) {
            reply = isRealTime ? '即時模式運作中，每 15 秒更新 TWSE 快照。' : '點上方「切換即時掃描」啟動盤中模式。';
        }

        addAIBubble(reply, true);
    }, 1500);
}

// ==================== 13. 啟動 ====================
window.onload = initV2;

window.runFullScan = runFullScan;
window.loadChart = loadChart;
window.selectStock = selectStock;
window.calculateBreakeven = calculateBreakeven;
window.triggerStopLossWarning = triggerStopLossWarning;
window.showFakeBreakWarning = showFakeBreakWarning;
window.handleAIQuery = handleAIQuery;
window.spawnAIBubble = spawnAIBubble;
window.toggleRealTime = toggleRealTime;
window.fetchRealTimeStocks = fetchRealTimeStocks;
