const canvas = document.getElementById('gameCanvas');
if (!canvas) {
    console.error("Erro: O elemento com ID 'gameCanvas' não foi encontrado no HTML.");
    throw new Error("Game Canvas not found. Please ensure your index.html has <canvas id=\"gameCanvas\"></canvas>");
}
const ctx = canvas.getContext('2d');

// Referências para a nova estrutura da UI no topo
const hpText = document.getElementById('hp-text');
const expText = document.getElementById('exp-text');
const levelText = document.getElementById('level-text');
const scoreText = document.getElementById('score-text');

const finalScoreText = document.getElementById('final-score');
const upgradeScreen = document.getElementById('upgrade-screen');
const upgradeChoicesDiv = document.getElementById('upgrade-choices');
const gameOverScreen = document.getElementById('game-over-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const leaderboardList = document.getElementById('leaderboard-list');
const viewLeaderboardButton = document.getElementById('view-leaderboard-button');
const closeLeaderboardButton = document.getElementById('close-leaderboard-button');
const playerNameInput = document.getElementById('playerName');
const submitScoreButton = document.getElementById('submit-score-button');
const restartGameButton = document.getElementById('restart-game-button');
const autoLeaderboardDisplay = document.getElementById('auto-leaderboard-display'); // NOVO: Elemento para exibir o placar automático

// Adiciona verificações para todos os elementos da UI
const uiElements = {
    hpText, expText, levelText, scoreText, finalScoreText,
    upgradeScreen, upgradeChoicesDiv, gameOverScreen,
    leaderboardScreen, leaderboardList, viewLeaderboardButton,
    closeLeaderboardButton, playerNameInput, submitScoreButton, restartGameButton,
    autoLeaderboardDisplay
};

for (const key in uiElements) {
    if (!uiElements[key]) {
        console.warn(`Atenção: Elemento da UI com ID '${key}' não foi encontrado no HTML. Verifique o ID.`);
    }
}

// Dimensiona o canvas para preencher o game-container
const gameContainer = document.getElementById('game-container');
if (gameContainer) {
    canvas.width = gameContainer.offsetWidth;
    canvas.height = gameContainer.offsetHeight;
} else {
    console.warn("Elemento 'game-container' não encontrado. Usando dimensões padrão para o canvas.");
    canvas.width = 800;
    canvas.height = 600;
}

// Game State
let gameRunning = true;

// Player
const player = {
    x: 100,
    y: 0, // Será ajustado para o chão
    width: 30, // Largura base
    height: 50, // Altura base
    color: '#8e44ad', // Cor do mago (roxo)
    dx: 0,
    dy: 0,
    speed: 5,
    jumpForce: -15,
    gravity: 0.8,
    onGround: false,
    maxHp: 100,
    currentHp: 100,
    exp: 0,
    expToNextLevel: 100,
    level: 1,
    score: 0,
    projectileDamage: 10,
    criticalChance: 0, // %
    criticalDamageMultiplier: 1.5,
    attackSpeed: 500, // ms between shots
    lastShotTime: 0,
    invincible: false,
    invincibilityDuration: 500, // ms
    lastHitTime: 0,
    projectileSize: 10,
    jumps: 1,
    jumpsRemaining: 1,
    lifeSteal: 0, // % of damage dealt
    defense: 0, // % damage reduction
    projectileHitsBeforeExplode: 1,
    shrinkFactor: 1, // 0 to 1, 1 is normal size
    revives: 0,
    baseMovementSpeed: 5, // For swift upgrade calculation
    baseJumpHeight: -15, // For impulse upgrade calculation
    baseAttackSpeed: 500, // For resonance upgrade calculation
    // Propriedades para desenho do mago
    staffColor: '#b36b00', // Marrom para o cajado
    staffLength: 60,
    staffThickness: 5,
    staffTipColor: '#f1c40f' // Dourado para a ponta do cajado
};

// CARREGAMENTO DE IMAGENS (OPCIONAL, SE VOCÊ TIVER SPRITES)
const assets = {
    player: new Image(),
    enemy: new Image(),
    projectile: new Image(),
};

// Se você não usar imagens, chame initGame() diretamente no final do script.

const keys = {
    a: false,
    d: false,
    space: false,
};

let mouse = {
    x: 0,
    y: 0,
    down: false,
};

// Projectiles
const projectiles = [];
const enemyProjectiles = [];

// Enemies
const enemies = [];
let enemySpawnTimer = 0;
let enemySpawnInterval = 2000; // ms
let wave = 1;
let enemiesKilledThisWave = 0;
let enemiesToKillForNextWave = 5;
let maxEnemiesOnScreen = 5;

// Platforms (Topology of the ground like Image 1 steps)
const platforms = [];

function createPlatforms() {
    platforms.length = 0; // Clear existing platforms

    // A altura do chão base deve levar em conta o #game-container
    const groundHeight = canvas.height - 50; // Base ground

    // Main ground (ocupa a largura do canvas)
    platforms.push({ x: 0, y: groundHeight, width: canvas.width, height: 50 });

    // Plataformas dos Cantos
    // Plataforma esquerda mais baixa
    platforms.push({ x: 0, y: groundHeight - 70, width: canvas.width * 0.25, height: 20 });
    // Plataforma esquerda mais alta
    platforms.push({ x: 0, y: groundHeight - 140, width: canvas.width * 0.15, height: 20 });

    // Plataforma direita mais baixa
    platforms.push({ x: canvas.width * 0.75, y: groundHeight - 70, width: canvas.width * 0.25, height: 20 });
    // Plataforma direita mais alta
    platforms.push({ x: canvas.width * 0.85, y: groundHeight - 140, width: canvas.width * 0.15, height: 20 });
}

// --- Upgrades List (sem alterações aqui) ---
const upgrades = [
    { name: "Catalyst", description: "Projectile Damage +2", apply: () => player.projectileDamage += 2, tier: "common" },
    { name: "Eyesight", description: "Critical Chance +5%", apply: () => player.criticalChance += 5, tier: "common" },
    { name: "Growth", description: "Max. HP +10", apply: () => { player.maxHp += 10; player.currentHp += 10; }, tier: "common" },
    { name: "Impulse", description: "Jump Height +30%", apply: () => player.jumpForce = player.baseJumpHeight * 1.3, tier: "common" },
    { name: "Renew", description: "Heal to Max. HP", apply: () => player.currentHp = player.maxHp, tier: "common" },
    { name: "Resist", description: "Defense +4%", apply: () => player.defense += 4, tier: "common" },
    { name: "Resonance", description: "Atk Speed +12%", apply: () => player.attackSpeed = player.baseAttackSpeed * (1 - 0.12), tier: "common" },
    { name: "Souls", description: "Chance to drop soul orb 1%", apply: () => console.log("Souls upgrade (not implemented yet)"), tier: "common" }, // Placeholder
    { name: "Stability", description: "Projectile takes +1 hit before exploding", apply: () => player.projectileHitsBeforeExplode += 1, tier: "common" },
    { name: "Swift", description: "Movement Speed +20%", apply: () => player.speed = player.baseMovementSpeed * 1.2, tier: "common" },

    { name: "Catalyst+", description: "Projectile Damage +4", apply: () => player.projectileDamage += 4, tier: "uncommon" },
    { name: "Charge", description: "Projectile Size +20%", apply: () => player.projectileSize *= 1.2, tier: "uncommon" },
    { name: "Cloak", description: "Invulnerability after taking damage +10% duration", apply: () => player.invincibilityDuration *= 1.1, tier: "uncommon" },
    { name: "Fragmentation", description: "When killed, enemies release 2 weaker projectiles", apply: () => console.log("Fragmentation upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder
    { name: "Friction", description: "For every meter you run, 1 explosive projectile is launched upwards", apply: () => console.log("Friction upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder
    { name: "Growth+", description: "Max. HP +20", apply: () => { player.maxHp += 20; player.currentHp += 20; }, tier: "uncommon" },
    { name: "Gush", description: "Adds +1 Jump", apply: () => player.jumps += 1, tier: "uncommon" },
    { name: "Leech", description: "Life Steal of 3% Damage", apply: () => player.lifeSteal += 0.03, tier: "uncommon" },
    { name: "Luck", description: "Bigger chance to roll uncommon items", apply: () => console.log("Luck upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder
    { name: "Orb", description: "Dead enemies have 5% chance to drop a healing orb", apply: () => console.log("Orb upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder
    { name: "Precision", description: "Critical deals +50% damage", apply: () => player.criticalDamageMultiplier += 0.5, tier: "uncommon" },
    { name: "Rage", description: "If under 50% HP, raises your projectile and body damage accordingly (up to 50%)", apply: () => console.log("Rage upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder
    { name: "Regrowth", description: "Regenerates HP% based on the number of enemies alive", apply: () => console.log("Regrowth upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder
    { name: "Resonance+", description: "Attack Speed +24%", apply: () => player.attackSpeed = player.baseAttackSpeed * (1 - 0.24), tier: "uncommon" },
    { name: "Shrink", description: "Makes you 10% smaller", apply: () => { player.width *= 0.9; player.height *= 0.9; player.shrinkFactor *= 0.9; }, tier: "uncommon" },
    { name: "Swift+", description: "Movement Speed +40%", apply: () => player.speed = player.baseMovementSpeed * 1.4, tier: "uncommon" },
    { name: "Thunderbolt", description: "Calls 2 thunderbolts from the skies every few seconds", apply: () => console.log("Thunderbolt upgrade (not implemented yet)"), tier: "uncommon" }, // Placeholder

    { name: "Appraisal", description: "+1 item choice from now on", apply: () => console.log("Appraisal upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Barrier", description: "Creates a shield that blocks damage once every few seconds", apply: () => console.log("Barrier upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Cold", description: "Enemies get 1% slower every time they take damage (up to 80%)", apply: () => console.log("Cold upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Fragmentation+", description: "When killed, enemies release 6 weaker projectiles", apply: () => console.log("Fragmentation+ upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Friction+", description: "For every meter you run, 3 explosive projectiles is launched upwards", apply: () => console.log("Friction+ upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Focus", description: "Gains attack speed every second you don't move. Resets every wave", apply: () => console.log("Focus upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Growth++", description: "Max. HP +40", apply: () => { player.maxHp += 40; player.currentHp += 40; }, tier: "rare" },
    { name: "Leech+", description: "Life Steal of 9% Damage", apply: () => player.lifeSteal += 0.09, tier: "rare" },
    { name: "Overheat", description: "Your body deals 40 damage on contact", apply: () => console.log("Overheat upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Thunderbolt+", description: "Calls 6 thunderbolts from the skies every few seconds", apply: () => console.log("Thunderbolt+ upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Tome", description: "New common items (white) you pick up are 35% more effective", apply: () => console.log("Tome upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Will-O-Wisp", description: "Summons a wisp that inherits half your attack damage and speed", apply: () => console.log("Will-O-Wisp upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
    { name: "Wound", description: "Dealing damage applies bleeding to the enemy", apply: () => console.log("Wound upgrade (not implemented yet)"), tier: "rare" }, // Placeholder
];

// --- Game Functions ---

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.scale(player.shrinkFactor, player.shrinkFactor);

    ctx.fillStyle = player.color;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    ctx.beginPath();
    ctx.arc(0, -player.height / 2 - player.width / 3, player.width / 3, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2 - player.width / 3 * 2);
    ctx.lineTo(-player.width / 2, -player.height / 2 - player.width / 3);
    ctx.lineTo(player.width / 2, -player.height / 2 - player.width / 3);
    ctx.closePath();
    ctx.fillStyle = '#4a0e6e';
    ctx.fill();

    const angle = Math.atan2(mouse.y - (player.y + player.height / 2), mouse.x - (player.x + player.width / 2));
    ctx.rotate(angle);

    ctx.fillStyle = player.staffColor;
    ctx.fillRect(player.width / 2 - 5, -player.staffThickness / 2, player.staffLength, player.staffThickness);

    ctx.beginPath();
    ctx.arc(player.width / 2 - 5 + player.staffLength, 0, player.staffThickness * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = player.staffTipColor;
    ctx.fill();

    if (player.invincible) {
        ctx.beginPath();
        ctx.arc(0, 0, player.width * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    ctx.restore();
}

function drawPlatforms() {
    ctx.fillStyle = '#2c2c2c';
    platforms.forEach(p => {
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.width, p.height);
    });
}

function updatePlayer() {
    player.dx = 0;
    if (keys.a) player.dx = -player.speed;
    if (keys.d) player.dx = player.speed;

    player.x += player.dx;

    player.dy += player.gravity;
    player.y += player.dy;

    player.onGround = false;
    platforms.forEach(p => {
        // Colisão com plataformas: Verifica se o jogador está caindo e acima da plataforma
        if (player.y + player.height <= p.y + player.dy && // Garante que o jogador está acima ou na mesma linha da plataforma no próximo frame
            player.y + player.height + player.dy >= p.y && // Garante que o jogador vai tocar/passar a plataforma
            player.x < p.x + p.width &&
            player.x + player.width > p.x) {

            // Se o jogador está caindo e colide por cima
            if (player.dy >= 0) { // Se estiver caindo (ou parado no ar)
                player.y = p.y - player.height;
                player.dy = 0;
                player.onGround = true;
                player.jumpsRemaining = player.jumps; // Reset jumps on ground
            }
        }
    });

    const canvasGround = canvas.height - 50;
    if (player.y + player.height > canvasGround) {
        player.y = canvasGround - player.height;
        player.dy = 0;
        player.onGround = true;
        player.jumpsRemaining = player.jumps;
    }

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    if (player.invincible && performance.now() - player.lastHitTime > player.invincibilityDuration) {
        player.invincible = false;
    }
}

function playerJump() {
    if (player.jumpsRemaining > 0) {
        player.dy = player.jumpForce;
        player.onGround = false;
        player.jumpsRemaining--;
    }
}

function playerShoot() {
    const currentTime = performance.now();
    if (currentTime - player.lastShotTime > player.attackSpeed) {
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const angle = Math.atan2(mouse.y - playerCenterY, mouse.x - playerCenterX);

        const projectileStartX = playerCenterX + Math.cos(angle) * player.staffLength * player.shrinkFactor;
        const projectileStartY = playerCenterY + Math.sin(angle) * player.staffLength * player.shrinkFactor;

        let actualDamage = player.projectileDamage;
        let isCritical = false;
        if (Math.random() * 100 < player.criticalChance) {
            actualDamage *= player.criticalDamageMultiplier;
            isCritical = true;
        }

        projectiles.push({
            x: projectileStartX,
            y: projectileStartY,
            radius: player.projectileSize / 2,
            color: '#f1c40f',
            dx: Math.cos(angle) * 10,
            dy: Math.sin(angle) * 10,
            damage: actualDamage,
            hitsRemaining: player.projectileHitsBeforeExplode,
            isCritical: isCritical
        });
        player.lastShotTime = currentTime;
    }
}

function drawProjectiles() {
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.isCritical ? '#ff7f50' : p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.isCritical ? '#ff7f50' : p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    });
    enemyProjectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#e74c3c';
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;
        p.y += p.dy;

        if (p.x < -p.radius || p.x > canvas.width + p.radius || p.y < -p.radius || p.y > canvas.height + p.radius) {
            projectiles.splice(i, 1);
            continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dist = Math.sqrt((p.x - (enemy.x + enemy.width / 2)) ** 2 + (p.y - (enemy.y + enemy.height / 2)) ** 2);
            if (dist < p.radius + Math.max(enemy.width, enemy.height) / 2) {
                enemy.currentHp -= p.damage * (1 - player.defense / 100);
                if (player.lifeSteal > 0) {
                    player.currentHp = Math.min(player.maxHp, player.currentHp + p.damage * player.lifeSteal);
                }
                p.hitsRemaining--;

                if (enemy.currentHp <= 0) {
                    addExp(enemy.expReward);
                    enemies.splice(j, 1);
                    enemiesKilledThisWave++;
                }

                if (p.hitsRemaining <= 0) {
                    projectiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        p.x += p.dx;
        p.y += p.dy;

        if (p.x < -p.radius || p.x > canvas.width + p.radius || p.y < -p.radius || p.y > canvas.height + p.radius) {
            enemyProjectiles.splice(i, 1);
            continue;
        }

        if (!player.invincible &&
            p.x + p.radius > player.x &&
            p.x - p.radius < player.x + player.width &&
            p.y + p.radius > player.y &&
            p.y - p.radius < player.y + player.height) {

            player.currentHp -= p.damage;
            player.invincible = true;
            player.lastHitTime = performance.now();
            enemyProjectiles.splice(i, 1);
            checkGameOver();
            break;
        }
    }
}

function spawnEnemy() {
    if (enemies.length >= maxEnemiesOnScreen) return;

    const x = Math.random() * (canvas.width - 50);
    const y = -50; // Começa acima da tela
    const size = 30 + Math.random() * (wave * 2);
    const speed = 1 + wave * 0.1;
    const hp = 20 + wave * 5;
    const damage = 5 + wave * 0.5;
    const shootInterval = Math.max(500, 2000 - wave * 50);
    const expReward = 10 + wave * 2;

    const targetY = canvas.height * 0.2 + Math.random() * (canvas.height * 0.3);

    enemies.push({
        x: x,
        y: y,
        width: size,
        height: size,
        color: '#c0392b',
        dy: speed,
        dx: 0,
        targetY: targetY,
        speed: speed,
        maxHp: hp,
        currentHp: hp,
        damage: damage,
        shootInterval: shootInterval,
        lastShotTime: 0,
        expReward: expReward,
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width * 0.3, enemy.y + enemy.height * 0.4, enemy.width * 0.1, 0, Math.PI * 2);
        ctx.arc(enemy.x + enemy.width * 0.7, enemy.y + enemy.height * 0.4, enemy.width * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width * 0.3, enemy.y + enemy.height * 0.4, enemy.width * 0.05, 0, Math.PI * 2);
        ctx.arc(enemy.x + enemy.width * 0.7, enemy.y + enemy.height * 0.4, enemy.width * 0.05, 0, Math.PI * 2);
        ctx.fill();

        const hpBarWidth = enemy.width;
        const hpBarHeight = 5;
        const hpBarX = enemy.x;
        const hpBarY = enemy.y - hpBarHeight - 2;
        ctx.fillStyle = 'darkred';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth * (enemy.currentHp / enemy.maxHp), hpBarHeight);
    });
}

function updateEnemies() {
    enemies.forEach(enemy => {
        if (enemy.y < enemy.targetY) {
            enemy.y += enemy.speed;
        } else {
            enemy.y = enemy.targetY;
            const targetX = player.x + player.width / 2;
            const enemyCenterX = enemy.x + enemy.width / 2;
            const diffX = targetX - enemyCenterX;

            enemy.x += diffX * 0.01;
        }

        const currentTime = performance.now();
        if (currentTime - enemy.lastShotTime > enemy.shootInterval) {
            const angle = Math.atan2(player.y + player.height / 2 - (enemy.y + enemy.height / 2), player.x + player.width / 2 - (enemy.x + enemy.width / 2));
            enemyProjectiles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                radius: 8,
                color: '#e74c3c',
                dx: Math.cos(angle) * 7,
                dy: Math.sin(angle) * 7,
                damage: enemy.damage
            });
            enemy.lastShotTime = currentTime;
        }
    });
}

function updateUI() {
    if (hpText) hpText.textContent = `${Math.round(player.currentHp)}/${player.maxHp}`;
    if (expText) expText.textContent = `${Math.round(player.exp)}/${player.expToNextLevel}`;
    if (levelText) levelText.textContent = player.level;
    if (scoreText) scoreText.textContent = player.score;
}

function addExp(amount) {
    player.exp += amount;
    player.score += amount;
    if (player.exp >= player.expToNextLevel) {
        levelUp();
    }
}

function levelUp() {
    player.level++;
    player.exp -= player.expToNextLevel;
    player.expToNextLevel = Math.round(player.expToNextLevel * 1.2);
    player.currentHp = player.maxHp;
    showUpgradeScreen();
}

function getRandomUpgrades(count) {
    const availableUpgrades = [...upgrades];
    const selected = [];

    const commonUpgrades = availableUpgrades.filter(u => u.tier === "common");
    const uncommonUpgrades = availableUpgrades.filter(u => u.tier === "uncommon");
    const rareUpgrades = availableUpgrades.filter(u => u.tier === "rare");

    for (let i = 0; i < count; i++) {
        let pool;
        const rarityRoll = Math.random();
        if (rarityRoll < 0.6) {
            pool = commonUpgrades;
        } else if (rarityRoll < 0.9) {
            pool = uncommonUpgrades;
        } else {
            pool = rareUpgrades;
        }

        if (pool.length === 0) {
            pool = availableUpgrades;
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        const chosenUpgrade = pool[randomIndex];

        if (chosenUpgrade) {
            selected.push(chosenUpgrade);
            const indexInAll = availableUpgrades.indexOf(chosenUpgrade);
            if (indexInAll > -1) availableUpgrades.splice(indexInAll, 1);
            const indexInCommon = commonUpgrades.indexOf(chosenUpgrade);
            if (indexInCommon > -1) commonUpgrades.splice(indexInCommon, 1);
            const indexInUncommon = uncommonUpgrades.indexOf(chosenUpgrade);
            if (indexInUncommon > -1) uncommonUpgrades.splice(indexInUncommon, 1);
            const indexInRare = rareUpgrades.indexOf(chosenUpgrade);
            if (indexInRare > -1) rareUpgrades.splice(indexInRare, 1);
        }
    }
    return selected;
}

// ... (código anterior) ...

function showUpgradeScreen() {
    gameRunning = false; // Pausa o jogo
    if (upgradeChoicesDiv) {
        upgradeChoicesDiv.innerHTML = ''; // Limpa as opções anteriores
    } else {
        console.error("upgradeChoicesDiv não encontrado.");
        return; // Sai da função se o elemento não existe
    }

    const choices = getRandomUpgrades(3);

    choices.forEach(upgrade => {
        const card = document.createElement('div');
        card.classList.add('upgrade-card');
        card.innerHTML = `
            <h3>${upgrade.name}</h3>
            <p>${upgrade.description}</p>
        `;
        // Adiciona um listener de clique a cada novo card
        card.addEventListener('click', () => {
            selectUpgrade(upgrade);
        });
        upgradeChoicesDiv.appendChild(card);
    });

    if (upgradeScreen) {
        upgradeScreen.style.display = 'flex'; // Exibe a tela de upgrade
        // Garantir que a tela de upgrade esteja acima de outros overlays (se houver)
        upgradeScreen.style.zIndex = '200'; // Um z-index alto para garantir visibilidade e clique
    }
}

// ... (código anterior) ...

function selectUpgrade(upgrade) {
    upgrade.apply(); // Aplica o efeito do upgrade

    if (upgradeScreen) {
        upgradeScreen.style.display = 'none'; // Esconde a tela de upgrade
        upgradeScreen.style.zIndex = ''; // Remove o z-index específico
    }

    gameRunning = true; // MUITO IMPORTANTE: Garante que o estado do jogo seja 'rodando'

    // Forçar o foco de volta para o documento (boa prática para eventos de teclado)
    document.body.focus();

    // CHAME gameLoop() NOVAMENTE para garantir que o loop continue
    // É seguro chamar requestAnimationFrame várias vezes, ele só agendará um novo frame
    // se nenhum outro já estiver agendado.
    requestAnimationFrame(gameLoop);
}

// ... (restante do código) ...

// ... (restante do código) ...

function checkGameOver() {
    if (player.currentHp <= 0) {
        gameOver();
    }
}

function gameOver() {
    gameRunning = false;
    if (finalScoreText) finalScoreText.textContent = player.score;
    if (gameOverScreen) gameOverScreen.style.display = 'flex';
}

async function submitScore() {
    if (!playerNameInput) {
        console.error("Input de nome do jogador não encontrado.");
        return;
    }
    const playerName = playerNameInput.value.trim();
    if (playerName === "") {
        alert("Por favor, digite seu nome para salvar a pontuação!");
        return;
    }

    try {
        const response = await fetch('/api/scores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ score: player.score, name: playerName.substring(0, 20) }),
        });
        const data = await response.json();
        console.log('Score submitted:', data);
        alert("Pontuação salva com sucesso!");
        // Após salvar a pontuação, reinicia o jogo
        restartGame();
    } catch (error) {
        console.error('Error submitting score:', error);
        alert("Erro ao salvar pontuação. Tente novamente.");
        // Mesmo com erro, pode ser útil reiniciar para o jogador tentar de novo
        restartGame();
    }
}

async function fetchLeaderboard() {
    try {
        const response = await fetch('/api/scores');
        const scores = await response.json();
        if (leaderboardList) leaderboardList.innerHTML = '';

        if (scores.length === 0) {
            if (leaderboardList) leaderboardList.innerHTML = '<li style="justify-content: center;">Nenhuma pontuação ainda. Seja o primeiro!</li>';
            return []; // Retorna array vazio se não houver scores
        }

        scores.forEach((s, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${index + 1}. ${s.name || 'Anônimo'}</span>
                <span>${s.score}</span>
            `;
            if (leaderboardList) leaderboardList.appendChild(listItem);
        });
        return scores; // Retorna os scores
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        if (leaderboardList) leaderboardList.innerHTML = '<li style="justify-content: center;">Erro ao carregar o placar.</li>';
        return [];
    }
}

// NOVA FUNÇÃO para buscar e exibir o placar no topo do jogo
async function fetchLeaderboardAndDisplay() {
    const scores = await fetchLeaderboard(); // Reutiliza a função existente
    if (autoLeaderboardDisplay) {
        autoLeaderboardDisplay.innerHTML = ''; // Limpa o conteúdo anterior

        if (scores.length === 0) {
            autoLeaderboardDisplay.innerHTML = '<p>Nenhuma pontuação ainda. Jogue para aparecer aqui!</p>';
        } else {
            // Exibe os top 3 ou top N, como preferir
            const topScores = scores.slice(0, 3); // Exibe os 3 primeiros
            topScores.forEach((s, index) => {
                const scoreEntry = document.createElement('div');
                scoreEntry.classList.add('leaderboard-entry-mini'); // Classe para estilização
                scoreEntry.innerHTML = `<span>${index + 1}. ${s.name || 'Anônimo'}: ${s.score}</span>`;
                autoLeaderboardDisplay.appendChild(scoreEntry);
            });
        }
    }
}


function restartGame() {
    // Reset player stats
    player.x = 100;
    player.y = 0;
    player.dx = 0;
    player.dy = 0;
    player.currentHp = player.maxHp = 100;
    player.exp = 0;
    player.expToNextLevel = 100;
    player.level = 1;
    player.score = 0;
    player.projectileDamage = 10;
    player.criticalChance = 0;
    player.criticalDamageMultiplier = 1.5;
    player.attackSpeed = player.baseAttackSpeed = 500;
    player.lastShotTime = 0;
    player.invincible = false;
    player.invincibilityDuration = 500;
    player.lastHitTime = 0;
    player.projectileSize = 10;
    player.jumps = 1;
    player.jumpsRemaining = 1;
    player.lifeSteal = 0;
    player.defense = 0;
    player.projectileHitsBeforeExplode = 1;
    player.shrinkFactor = 1;
    player.revives = 0;
    player.speed = player.baseMovementSpeed;
    player.jumpForce = player.baseJumpHeight;
    player.attackSpeed = player.baseAttackSpeed;

    // Reset game state
    enemies.length = 0;
    projectiles.length = 0;
    enemyProjectiles.length = 0;
    enemySpawnTimer = 0;
    enemySpawnInterval = 2000;
    wave = 1;
    enemiesKilledThisWave = 0;
    enemiesToKillForNextWave = 5;
    maxEnemiesOnScreen = 5;

    createPlatforms();

    // Hide all screens
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    if (upgradeScreen) upgradeScreen.style.display = 'none';
    if (leaderboardScreen) leaderboardScreen.style.display = 'none';

    gameRunning = true;
    updateUI();
    fetchLeaderboardAndDisplay(); // Atualiza o placar no topo ao reiniciar
    gameLoop(); // Inicia o loop do jogo
}


// Loop principal do jogo
let lastTime = 0;
function gameLoop(currentTime = 0) {
    if (!gameRunning) {
        lastTime = currentTime;
        return;
    }

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updatePlayer();
    updateProjectiles();
    updateEnemies();
    updateUI();

    enemySpawnTimer += deltaTime;
    if (enemySpawnTimer > enemySpawnInterval && enemies.length < maxEnemiesOnScreen) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }

    if (enemiesKilledThisWave >= enemiesToKillForNextWave && enemies.length === 0) {
        wave++;
        enemiesKilledThisWave = 0;
        enemiesToKillForNextWave = Math.round(enemiesToKillForNextWave * 1.5);
        enemySpawnInterval = Math.max(500, enemySpawnInterval - 100);
        maxEnemiesOnScreen++;
        player.currentHp = Math.min(player.maxHp, player.currentHp + player.maxHp * 0.1);
        console.log(`Nova Onda! Onda: ${wave}, Inimigos para a próxima: ${enemiesToKillForNextWave}`);
    }

    drawPlatforms();
    drawPlayer();
    drawProjectiles();
    drawEnemies();

    requestAnimationFrame(gameLoop);
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    createPlatforms();
    updateUI();
    fetchLeaderboardAndDisplay(); // Carrega o placar no topo ao iniciar a página

    // Configura os event listeners para os botões da UI
    if (submitScoreButton) {
        submitScoreButton.addEventListener('click', submitScore);
    }
    if (restartGameButton) {
        restartGameButton.addEventListener('click', restartGame); // Chamada direta ao restartGame
    }
    if (viewLeaderboardButton) {
        viewLeaderboardButton.addEventListener('click', () => {
            fetchLeaderboard(); // Apenas mostra o placar completo
            if (leaderboardScreen) leaderboardScreen.style.display = 'flex';
            if (gameOverScreen) gameOverScreen.style.display = 'none';
            gameRunning = false; // Pausa o jogo ao abrir o placar
        });
    }
    if (closeLeaderboardButton) {
        closeLeaderboardButton.addEventListener('click', () => {
            if (leaderboardScreen) leaderboardScreen.style.display = 'none';
            restartGame(); // Reinicia o jogo ao sair do placar
        });
    }

    // Eventos de Input do Jogo
    document.addEventListener('keydown', e => {
        if (!gameRunning) return;

        if (e.code === 'KeyA') keys.a = true;
        if (e.code === 'KeyD') keys.d = true;
        if (e.code === 'Space' && player.jumpsRemaining > 0) { // Permitir múltiplos pulos
            playerJump();
        }
    });

    document.addEventListener('keyup', e => {
        if (e.code === 'KeyA') keys.a = false;
        if (e.code === 'KeyD') keys.d = false;
    });

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', e => {
        if (!gameRunning) return;
        if (e.button === 0) { // Left click
            mouse.down = true;
            playerShoot();
        }
    });

    canvas.addEventListener('mouseup', e => {
        if (e.button === 0) { // Left click
            mouse.down = false;
        }
    });

    setInterval(() => {
        if (mouse.down && gameRunning) {
            playerShoot();
        }
    }, 100);

    initGame(); // Inicia o jogo após o DOM carregar e listeners configurados
});

function initGame() {
    console.log("Iniciando Jogo...");
    gameRunning = true;
    requestAnimationFrame(gameLoop);
}
