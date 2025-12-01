const STORAGE_KEY = 'guaguale_prizes';
const CONFIG_KEY = 'guaguale_config'; // To store original config if needed, or just rely on current state

// DOM Elements
const setupPanel = document.getElementById('setup-panel');
const gamePanel = document.getElementById('game-panel');
const prizeListEl = document.getElementById('prize-list');
const addPrizeBtn = document.getElementById('add-prize-btn');
const saveStartBtn = document.getElementById('save-start-btn');
const resetBtn = document.getElementById('reset-btn');
const togglePoolBtn = document.getElementById('toggle-pool-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfoEl = document.getElementById('page-info');
const poolListEl = document.getElementById('pool-list');
const remainingCountEl = document.getElementById('remaining-count');
const scratchCardGrid = document.getElementById('scratch-card-grid');
const emptyStateEl = document.getElementById('empty-state');
const gameOverEl = document.getElementById('game-over');
const drawBtn = document.getElementById('draw-btn');
const restartBtn = document.getElementById('restart-btn');
// State
let prizes = [];
let activePrizesCount = {}; // Track prizes currently on the board (unrevealed)
let allCards = []; // Store all generated cards data: { id, prizeName, isRevealed }
let currentPage = 1;
let itemsPerPage = 9; // Default, will be adjusted based on screen size ideally, or kept fixed for simplicity

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
    
    togglePoolBtn.addEventListener('click', () => {
        const summary = document.querySelector('.prizes-summary');
        if (summary.style.display === 'none') {
            summary.style.display = 'block';
            togglePoolBtn.textContent = '👁️ 隐藏奖池';
        } else {
            summary.style.display = 'none';
            togglePoolBtn.textContent = '🙈 显示奖池';
        }
    });

    shuffleBtn.addEventListener('click', shuffleCards);
    prevPageBtn.addEventListener('click', () => renderPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => renderPage(currentPage + 1));

    window.addEventListener('resize', () => {
        const oldItemsPerPage = itemsPerPage;
        itemsPerPage = window.innerWidth < 600 ? 6 : 12;
        if (oldItemsPerPage !== itemsPerPage && allCards.length > 0) {
            renderPage(1);
        }
    });
}

// --- Setup Logic ---

function showSetupPanel() {
    setupPanel.style.display = 'block';
    gamePanel.style.display = 'none';
    resetBtn.style.display = 'none';
    togglePoolBtn.style.display = 'none';
    
    // Pre-fill if we have data (for editing) or ensure at least one empty row
    renderPrizeInputs();
}

function addPrizeRow(name = '', count = 1) {
    const row = document.createElement('div');
    row.className = 'prize-row';
    row.innerHTML = `
        <input type="text" placeholder="奖品名称 (如: 一等奖)" value="${name}">
        <input type="number" min="0" placeholder="数量" value="${count}">
        <button class="remove-btn">×</button>
    `;
    row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
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
    // Automatically start the game after saving
    startScratch();
}

// --- Game Logic ---

function showGamePanel() {
    setupPanel.style.display = 'none';
    gamePanel.style.display = 'block';
    resetBtn.style.display = 'block';
    togglePoolBtn.style.display = 'block';
    
    updatePoolDisplay();
    checkGameState();
}

function checkGameState() {
    const total = getTotalPrizes();
    const allRevealed = allCards.length > 0 && allCards.every(card => card.isRevealed);

    if (allCards.length === 0) {
        // Not started yet or reset
        document.querySelector('.scratch-container-wrapper').style.display = 'none';
        if (total > 0) {
            emptyStateEl.style.display = 'block';
            gameOverEl.style.display = 'none';
        } else {
            // No prizes configured? Or game over logic handled elsewhere?
            // If total is 0 and no cards, it's likely Setup mode or Game Over.
            // But here we assume Game Panel context.
            emptyStateEl.style.display = 'none';
            gameOverEl.style.display = 'block';
        }
    } else if (allRevealed) {
        // All cards scratched
        gameOverEl.style.display = 'block';
        emptyStateEl.style.display = 'none';
        document.querySelector('.scratch-container-wrapper').style.display = 'none';
    } else {
        // Playing
        gameOverEl.style.display = 'none';
        emptyStateEl.style.display = 'none';
        document.querySelector('.scratch-container-wrapper').style.display = 'flex';
    }
}

function updatePoolDisplay() {
    poolListEl.innerHTML = '';
    for (const [name, count] of Object.entries(activePrizesCount)) {
        if (count > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${name}</span> <span>x${count}</span>`;
            poolListEl.appendChild(li);
        }
    }
}

function getTotalPrizes() {
    return prizes.reduce((sum, p) => sum + p.count, 0);
}

function startScratch() {
    if (getTotalPrizes() === 0) return;

    emptyStateEl.style.display = 'none';
    scratchCardGrid.innerHTML = ''; // Clear previous cards
    activePrizesCount = {}; // Reset active prizes count
    allCards = []; // Reset cards data
    currentPage = 1;

    // Set initial items per page
    itemsPerPage = window.innerWidth < 600 ? 6 : 12;

    // Create a deep copy of prizes for the drawing pool
    // We use a copy so we don't modify the original configuration (prizes)
    const drawPool = JSON.parse(JSON.stringify(prizes));
    
    // Helper to get total from pool
    const getPoolTotal = (pool) => pool.reduce((sum, p) => sum + p.count, 0);

    const prizesToDraw = [];
    while (getPoolTotal(drawPool) > 0) {
        const total = getPoolTotal(drawPool);
        let random = Math.floor(Math.random() * total);
        let selectedIndex = -1;

        for (let i = 0; i < drawPool.length; i++) {
            if (drawPool[i].count > 0) {
                if (random < drawPool[i].count) {
                    selectedIndex = i;
                    break;
                }
                random -= drawPool[i].count;
            }
        }

        if (selectedIndex !== -1) {
            drawPool[selectedIndex].count--;
            prizesToDraw.push(drawPool[selectedIndex].name);
        }
    }

    // Generate card data objects
    prizesToDraw.forEach((prizeName, index) => {
        allCards.push({
            id: index,
            prizeName: prizeName,
            isRevealed: false
        });
        // Initialize count for this prize
        activePrizesCount[prizeName] = (activePrizesCount[prizeName] || 0) + 1;
    });

    // Note: We do NOT save the modified pool to localStorage here.
    // We keep the original 'prizes' configuration in localStorage.
    
    updatePoolDisplay();
    remainingCountEl.textContent = allCards.length;
    
    checkGameState(); // Update visibility state
    renderPage(1);
}

function renderPage(page) {
    const totalPages = Math.ceil(allCards.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    scratchCardGrid.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageCards = allCards.slice(start, end);

    pageCards.forEach(cardData => {
        createScratchCard(cardData);
    });

    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    pageInfoEl.textContent = `第 ${currentPage} / ${totalPages} 页`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

function shuffleCards() {
    if (allCards.length === 0) return;

    // Fisher-Yates shuffle
    for (let i = allCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }

    // Reset to first page after shuffle for better UX
    renderPage(1);
}

function playRevealSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Simple "Ding" sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6
        
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed", e);
    }
}

function createScratchCard(cardData) {
    const card = document.createElement('div');
    card.className = 'scratch-card';
    if (cardData.isRevealed) {
        card.classList.add('revealed');
    }

    const prizeText = document.createElement('div');
    prizeText.className = 'prize-text';
    prizeText.textContent = cardData.prizeName;
    card.appendChild(prizeText);

    // If already revealed, we don't need the canvas or cover
    if (!cardData.isRevealed) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        
        card.appendChild(canvas);

        // Add Cover
        const cover = document.createElement('div');
        cover.className = 'card-cover';
        cover.innerHTML = `
            <span>🎁</span>
            <p>点击刮奖</p>
        `;
        
        const removeCover = (e) => {
            e.stopPropagation(); // Prevent triggering other clicks
            cover.style.opacity = '0';
            setTimeout(() => {
                cover.remove();
            }, 300);
        };

        cover.addEventListener('click', removeCover);
        card.appendChild(cover);
        
        const initCanvas = () => {
            const width = card.offsetWidth;
            const height = card.offsetHeight;
            // Check if width/height are valid (might be 0 if hidden or not attached)
            if (width === 0 || height === 0) return;

            canvas.width = width;
            canvas.height = height;

            ctx.fillStyle = '#cccccc';
            ctx.fillRect(0, 0, width, height);
            
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let y = 15; y < height; y += 30) {
                for (let x = 20; x < width; x += 40) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate((Math.random() - 0.5) * 1); 
                    ctx.fillStyle = Math.random() > 0.5 ? '#b3b3b3' : '#a0a0a0'; 
                    ctx.fillText('刮', 0, 0);
                    ctx.restore();
                }
            }
        };

        const scratch = (e) => {
            if (!isDrawing || cardData.isRevealed) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || e.pageX) - rect.left;
            const y = (e.clientY || e.pageY) - rect.top;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI * 2);
            ctx.fill();
        };

        const checkCompletion = () => {
            if (cardData.isRevealed) return;

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            let transparentPixels = 0;
            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] < 128) {
                    transparentPixels++;
                }
            }
            if ((transparentPixels / (canvas.width * canvas.height)) > 0.3) {
                cardData.isRevealed = true; // Update data state
                canvas.style.opacity = '0';
                canvas.style.transition = 'opacity 0.5s';
                
                // Play sound
                playRevealSound();

                // Decrement remaining count
                const currentCount = parseInt(remainingCountEl.textContent);
                if (!isNaN(currentCount) && currentCount > 0) {
                    remainingCountEl.textContent = currentCount - 1;
                }
                
                // Update active prizes pool
                if (activePrizesCount[cardData.prizeName] > 0) {
                    activePrizesCount[cardData.prizeName]--;
                    updatePoolDisplay();
                }

                setTimeout(() => {
                    card.classList.add('revealed');
                    // Remove canvas from DOM after animation to save memory? 
                    // Or keep it hidden. 
                    // checkGameState is global check, might need adjustment
                    checkGameState();
                }, 500);
            }
        };

        const startScratching = (e) => { 
            // Only allow scratching if cover is gone (though cover covers canvas, so events shouldn't reach canvas if cover is there)
            // But to be safe:
            if (cover.parentNode) return;
            
            isDrawing = true; 
            scratch(e); 
        };
        
        const stopScratching = () => { if (isDrawing) { isDrawing = false; checkCompletion(); } };

        canvas.addEventListener('mousedown', startScratching);
        canvas.addEventListener('mousemove', scratch);
        canvas.addEventListener('mouseup', stopScratching);
        canvas.addEventListener('mouseleave', stopScratching);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startScratching(e.touches[0]); });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); scratch(e.touches[0]); });
        canvas.addEventListener('touchend', stopScratching);

        requestAnimationFrame(initCanvas);
    }
    
    scratchCardGrid.appendChild(card);
}



// --- Persistence ---

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prizes));
}

function resetGame() {
    if (confirm('确定要重新设置奖品池吗？您可以修改数量或添加新奖品。')) {
        scratchCardGrid.innerHTML = '';
        allCards = []; // Clear card data
        activePrizesCount = {}; // Clear active counts
        currentPage = 1; // Reset page
        showSetupPanel();
        renderPrizeInputs();
    }
}

// Start
init();
