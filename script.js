const STORAGE_KEY = 'guaguale_prizes';
const GAME_STATE_KEY = 'guaguale_gameState';

// DOM Elements
const setupPanel = document.getElementById('setup-panel');
const gamePanel = document.getElementById('game-panel');
const prizeListEl = document.getElementById('prize-list');
const addPrizeBtn = document.getElementById('add-prize-btn');
const saveStartBtn = document.getElementById('save-start-btn');
const resetBtn = document.getElementById('reset-btn');
const togglePoolBtn = document.getElementById('toggle-pool-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const toggleUnrevealedBtn = document.getElementById('toggle-unrevealed-btn');
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
let activePrizesCount = {};
let allCards = [];
let currentPage = 1;
let itemsPerPage = 9;
let showOnlyUnrevealed = false;

// Initialization
function init() {
    loadData();
    bindEvents();
}

function loadData() {
    const storedPrizes = localStorage.getItem(STORAGE_KEY);
    if (storedPrizes) {
        prizes = JSON.parse(storedPrizes);
    }

    const storedGameState = localStorage.getItem(GAME_STATE_KEY);
    if (storedGameState) {
        // If a game is in progress, load it automatically
        continueGame();
    } else if (prizes.length > 0 && getTotalPrizes() > 0) {
        // No game in progress, but prizes are configured
        showGamePanel();
    } else {
        // No prize config, show setup
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
    toggleUnrevealedBtn.addEventListener('click', toggleUnrevealedView);
    prevPageBtn.addEventListener('click', () => renderPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => renderPage(currentPage + 1));

    window.addEventListener('resize', () => {
        const oldItemsPerPage = itemsPerPage;
        itemsPerPage = updateItemsPerPage();
        if (oldItemsPerPage !== itemsPerPage && allCards.length > 0) {
            renderPage(1, false);
        }
    });
}

function updateItemsPerPage() {
    const grid = scratchCardGrid;
    const wrapper = grid.parentElement;

    if (!wrapper || wrapper.offsetParent === null || wrapper.offsetWidth === 0) {
        return 12; // Default if the container is not visible
    }

    const gridWidth = wrapper.offsetWidth;
    const cardMinWidth = 220; // from CSS
    const gap = 16; // from CSS

    // 1. Calculate how many columns can fit
    const columns = Math.max(1, Math.floor((gridWidth + gap) / (cardMinWidth + gap)));

    // 2. Use a fixed number of rows for predictability, as requested.
    const rowsPerPage = 3;

    // 3. Items per page is columns * rows, ensuring full rows.
    const newItemsPerPage = columns * rowsPerPage;

    return Math.max(1, newItemsPerPage);
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
    localStorage.removeItem(GAME_STATE_KEY); // Ensure a fresh start
    if (getTotalPrizes() === 0) return;

    emptyStateEl.style.display = 'none';
    scratchCardGrid.innerHTML = ''; // Clear previous cards
    activePrizesCount = {}; // Reset active prizes count
    allCards = []; // Reset cards data
    currentPage = 1;

    // Create a flat array of all individual prizes
    const prizesToDraw = prizes.flatMap(p => Array(p.count).fill(p.name));

    // Shuffle the array (Fisher-Yates)
    for (let i = prizesToDraw.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [prizesToDraw[i], prizesToDraw[j]] = [prizesToDraw[j], prizesToDraw[i]];
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
    
    updatePoolDisplay();
    remainingCountEl.textContent = allCards.length;
    
    checkGameState(); // This makes the grid container visible

    // Defer rendering to ensure layout is calculated correctly
    requestAnimationFrame(() => {
        itemsPerPage = updateItemsPerPage();
        renderPage(1); // This will render the first page and save the initial state
    });
}

function continueGame() {
    const storedGameState = localStorage.getItem(GAME_STATE_KEY);
    if (storedGameState) {
        const gameState = JSON.parse(storedGameState);
        allCards = gameState.allCards;
        currentPage = gameState.currentPage || 1;

        // Re-calculate active prizes and remaining count from the loaded state
        activePrizesCount = {};
        let remaining = 0;
        allCards.forEach(card => {
            if (!card.isRevealed) {
                activePrizesCount[card.prizeName] = (activePrizesCount[card.prizeName] || 0) + 1;
                remaining++;
            }
        });
        remainingCountEl.textContent = remaining;

        showGamePanel();
        
        // Defer rendering to ensure layout is calculated correctly
        requestAnimationFrame(() => {
            itemsPerPage = updateItemsPerPage();
            renderPage(currentPage, false); // Don't re-save on initial load
        });
    }
}

function renderPage(page, shouldSave = true) {
    const cardsToRender = showOnlyUnrevealed ? allCards.filter(c => !c.isRevealed) : allCards;
    const totalPages = Math.ceil(cardsToRender.length / itemsPerPage);
    
    let targetPage = page;
    if (targetPage > totalPages) {
        targetPage = totalPages;
    }
    if (targetPage === 0) {
        targetPage = 1;
    }
    
    currentPage = targetPage;
    scratchCardGrid.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageCards = cardsToRender.slice(start, end);

    pageCards.forEach(cardData => {
        createScratchCard(cardData);
    });

    updatePagination(totalPages);

    if (shouldSave) {
        saveGameState();
    }
}

function updatePagination(totalPages) {
    const paginationContainer = pageInfoEl.parentElement;
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
    } else {
        paginationContainer.style.display = ''; // Reset to default display
        pageInfoEl.textContent = `第 ${currentPage} / ${totalPages} 页`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
}

function shuffleCards() {
    if (allCards.length === 0) return;

    for (let i = allCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }

    renderPage(1);
}

function toggleUnrevealedView() {
    showOnlyUnrevealed = !showOnlyUnrevealed;
    if (showOnlyUnrevealed) {
        toggleUnrevealedBtn.textContent = '🙉 显示全部';
        toggleUnrevealedBtn.classList.add('active');
    } else {
        toggleUnrevealedBtn.textContent = '🙈 仅看未刮';
        toggleUnrevealedBtn.classList.remove('active');
    }
    renderPage(1, false);
}

function playRevealSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc1.type = 'square';
        osc2.type = 'sine';
        
        osc1.frequency.setValueAtTime(600, now);
        osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        osc1.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        
        osc2.frequency.setValueAtTime(800, now);
        osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
        
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
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
            ctx.arc(x, y, 30, 0, Math.PI * 2);
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
            if ((transparentPixels / (canvas.width * canvas.height)) > 0.2) {
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

                saveGameState();

                setTimeout(() => {
                    card.classList.add('revealed');
                    if (showOnlyUnrevealed) {
                        renderPage(currentPage, false);
                    }
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

function saveGameState() {
    if (allCards.length > 0) {
        localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
            allCards: allCards,
            currentPage: currentPage
        }));
    } else {
        localStorage.removeItem(GAME_STATE_KEY);
    }
}

function resetGame() {
    if (confirm('确定要重新设置奖品池吗？您可以修改数量或添加新奖品。')) {
        scratchCardGrid.innerHTML = '';
        allCards = []; // Clear card data
        activePrizesCount = {}; // Clear active counts
        currentPage = 1; // Reset page
        localStorage.removeItem(GAME_STATE_KEY);
        showSetupPanel();
        renderPrizeInputs();
    }
}

// Start
init();
