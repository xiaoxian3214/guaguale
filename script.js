const STORAGE_KEY = 'guaguale_prizes';
const CONFIG_KEY = 'guaguale_config'; // To store original config if needed, or just rely on current state

// DOM Elements
const setupPanel = document.getElementById('setup-panel');
const gamePanel = document.getElementById('game-panel');
const prizeListEl = document.getElementById('prize-list');
const addPrizeBtn = document.getElementById('add-prize-btn');
const saveStartBtn = document.getElementById('save-start-btn');
const resetBtn = document.getElementById('reset-btn');
const poolListEl = document.getElementById('pool-list');
const remainingCountEl = document.getElementById('remaining-count');
const scratchCardEl = document.getElementById('scratch-card');
const emptyStateEl = document.getElementById('empty-state');
const gameOverEl = document.getElementById('game-over');
const drawBtn = document.getElementById('draw-btn');
const restartBtn = document.getElementById('restart-btn');
const prizeTextEl = document.getElementById('prize-text');
const canvas = document.getElementById('scratch-canvas');
const ctx = canvas.getContext('2d');

// State
let prizes = [];
let isDrawing = false;
let currentPrize = null;

// Initialization
function init() {
    loadData();
    bindEvents();
}

function loadData() {
    const storedPrizes = localStorage.getItem(STORAGE_KEY);
    if (storedPrizes) {
        prizes = JSON.parse(storedPrizes);
        if (getTotalPrizes() > 0) {
            showGamePanel();
        } else {
            // Even if data exists, if total is 0 and we are not in a "just finished" state, 
            // maybe show game over or setup? Let's assume valid data implies game mode.
            // If total is 0, it means game over state effectively.
            showGamePanel();
        }
    } else {
        // Default initial row
        addPrizeRow('', 1);
        showSetupPanel();
    }
}

function bindEvents() {
    addPrizeBtn.addEventListener('click', () => addPrizeRow());
    saveStartBtn.addEventListener('click', saveAndStart);
    resetBtn.addEventListener('click', resetGame);
    drawBtn.addEventListener('click', startScratch);
    restartBtn.addEventListener('click', resetGame);
    
    // Canvas events
    canvas.addEventListener('mousedown', startScratching);
    canvas.addEventListener('mousemove', scratch);
    canvas.addEventListener('mouseup', stopScratching);
    canvas.addEventListener('mouseleave', stopScratching);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startScratching(e.touches[0]);
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        scratch(e.touches[0]);
    });
    canvas.addEventListener('touchend', stopScratching);
}

// --- Setup Logic ---

function showSetupPanel() {
    setupPanel.style.display = 'block';
    gamePanel.style.display = 'none';
    resetBtn.style.display = 'none';
    
    // Pre-fill if we have data (for editing) or ensure at least one empty row
    renderPrizeInputs();
}

function addPrizeRow(name = '', count = 1) {
    const row = document.createElement('div');
    row.className = 'prize-row';
    row.innerHTML = `
        <input type="text" placeholder="奖品名称 (如: 一等奖)" value="${name}">
        <input type="number" min="0" placeholder="数量" value="${count}">
        <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
    `;
    prizeListEl.appendChild(row);
}

function renderPrizeInputs() {
    prizeListEl.innerHTML = '';
    if (prizes.length > 0) {
        prizes.forEach(p => addPrizeRow(p.name, p.count));
    } else {
        addPrizeRow();
    }
}

function saveAndStart() {
    const rows = prizeListEl.querySelectorAll('.prize-row');
    const newPrizes = [];
    let totalCount = 0;

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0].value.trim();
        const count = parseInt(inputs[1].value);

        if (name && !isNaN(count) && count >= 0) {
            newPrizes.push({ name, count });
            totalCount += count;
        }
    });

    if (totalCount === 0) {
        alert('请至少设置一个数量大于0的奖品！');
        return;
    }

    prizes = newPrizes;
    saveData();
    showGamePanel();
}

// --- Game Logic ---

function showGamePanel() {
    setupPanel.style.display = 'none';
    gamePanel.style.display = 'block';
    resetBtn.style.display = 'block';
    
    updatePoolDisplay();
    checkGameState();
}

function checkGameState() {
    const total = getTotalPrizes();
    remainingCountEl.textContent = total;

    if (total === 0) {
        scratchCardEl.classList.add('hidden');
        emptyStateEl.style.display = 'none';
        gameOverEl.style.display = 'block';
    } else {
        gameOverEl.style.display = 'none';
        // If we are not currently scratching, show the "Start Scratch" button
        if (scratchCardEl.classList.contains('hidden')) {
            emptyStateEl.style.display = 'block';
        }
    }
}

function updatePoolDisplay() {
    poolListEl.innerHTML = '';
    prizes.forEach(p => {
        if (p.count > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${p.name}</span> <span>x${p.count}</span>`;
            poolListEl.appendChild(li);
        }
    });
}

function getTotalPrizes() {
    return prizes.reduce((sum, p) => sum + p.count, 0);
}

function startScratch() {
    if (getTotalPrizes() === 0) return;

    // Select Prize
    const prizeIndex = selectRandomPrize();
    currentPrize = prizes[prizeIndex];
    
    // Update Data
    prizes[prizeIndex].count--;
    saveData();
    updatePoolDisplay();
    remainingCountEl.textContent = getTotalPrizes();

    // Setup UI
    emptyStateEl.style.display = 'none';
    scratchCardEl.classList.remove('hidden');
    prizeTextEl.textContent = currentPrize.name;
    
    // Defer canvas drawing to the next frame to ensure its dimensions are calculated
    requestAnimationFrame(initCanvas);
}

function selectRandomPrize() {
    const total = getTotalPrizes();
    let random = Math.floor(Math.random() * total);
    
    for (let i = 0; i < prizes.length; i++) {
        if (prizes[i].count > 0) {
            if (random < prizes[i].count) {
                return i;
            }
            random -= prizes[i].count;
        }
    }
    return -1; // Should not happen
}

// --- Canvas Logic ---

function initCanvas() {
    const width = scratchCardEl.offsetWidth;
    const height = scratchCardEl.offsetHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw a dense pattern on the scratch layer
    ctx.fillStyle = '#cccccc'; // Scratch layer color
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 20; y < height; y += 40) {
        for (let x = 30; x < width; x += 60) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((Math.random() - 0.5) * 0.5);
            ctx.fillText('幸运', 0, 0);
            ctx.restore();
        }
    }
}

function startScratching(e) {
    isDrawing = true;
    scratch(e);
}

function stopScratching() {
    isDrawing = false;
    checkScratchCompletion();
}

function scratch(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2); // Increased radius for easier scratching
    ctx.fill();
}

function checkScratchCompletion() {
    // Define the central reveal area (e.g., 60% of the canvas size)
    const revealWidth = canvas.width * 0.6;
    const revealHeight = canvas.height * 0.6;
    const startX = (canvas.width - revealWidth) / 2;
    const startY = (canvas.height - revealHeight) / 2;

    const imageData = ctx.getImageData(startX, startY, revealWidth, revealHeight);
    const pixels = imageData.data;
    let transparentPixels = 0;

    // Check transparency only in the central area
    for (let i = 3; i < pixels.length; i += 4) {
        // Check the alpha channel
        if (pixels[i] < 128) {
            transparentPixels++;
        }
    }

    const totalPixelsInArea = revealWidth * revealHeight;
    const percentage = (transparentPixels / totalPixelsInArea) * 100;

    if (percentage > 60) { // Reveal if 60% of the central area is scratched
        canvas.style.opacity = '0';
        canvas.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            finishRound();
        }, 500);
    }
}

function finishRound() {
    // Show a button to continue or just go back to empty state
    // For simplicity, let's just reset the view after a delay or show a "Continue" button overlay
    // But since the requirements are simple, let's just wait a bit then go back to 'Start' state if prizes remain.
    
    setTimeout(() => {
        scratchCardEl.classList.add('hidden');
        canvas.style.opacity = '1'; // Reset for next time
        canvas.style.transition = 'none';
        checkGameState(); // Will show 'Start' button or 'Game Over'
    }, 2000); // 2 seconds to view the prize
}

// --- Persistence ---

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prizes));
}

function resetGame() {
    if (confirm('确定要重新设置奖品池吗？您可以修改数量或添加新奖品。')) {
        // Don't clear prizes, just let user edit current state
        showSetupPanel();
        renderPrizeInputs();
    }
}

// Start
init();
