const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const redScoreVal = document.getElementById("redScore");
const blueScoreVal = document.getElementById("blueScore");
const overlay = document.getElementById("overlay");
const redBtn = document.getElementById("red-btn");
const blueBtn = document.getElementById("blue-btn");

let gridSize = 20;
let userColor, computerColor;
let snake1, snake2; // snake1 is user, snake2 is computer or peer
let dx1, dy1, dx2, dy2;
let redFood, blueFood;
let redScore, blueScore;
let gameActive, speed;
let mode = 'computer'; // 'computer' or 'multiplayer'
let peer, conn;
let isHost = false;
let roomCode;

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
mode = urlParams.get('mode') || 'computer';
roomCode = urlParams.get('room');
isHost = urlParams.get('host') === 'true';

if (mode === 'multiplayer') {
    setupMultiplayer();
}

function setupMultiplayer() {
    peer = new Peer();

    peer.on('open', (id) => {
        if (isHost) {
            // Host creates room
            document.getElementById("overlay-title").innerText = "ROOM CREATED";
            document.getElementById("overlay-msg").innerText = `Share this code: ${roomCode}\nWaiting for opponent...`;
            overlay.style.display = "flex";
        } else {
            // Join room
            conn = peer.connect(roomCode);
            setupConnection(conn);
            document.getElementById("overlay-title").innerText = "CONNECTING...";
            document.getElementById("overlay-msg").innerText = `Joining room: ${roomCode}`;
            overlay.style.display = "flex";
        }
    });

    peer.on('connection', (connection) => {
        if (isHost) {
            conn = connection;
            setupConnection(conn);
            overlay.style.display = "none";
            // Start game as host (red)
            init('red');
        }
    });
}

function setupConnection(connection) {
    conn = connection;
    conn.on('open', () => {
        if (!isHost) {
            overlay.style.display = "none";
            // Start game as guest (blue)
            init('blue');
        }
    });

    conn.on('data', (data) => {
        // Handle incoming data
        if (data.type === 'move') {
            dx2 = data.dx;
            dy2 = data.dy;
        } else if (data.type === 'food') {
            if (data.color === 'red') redFood = data.food;
            else blueFood = data.food;
        } else if (data.type === 'score') {
            if (data.color === 'red') redScore = data.score;
            else blueScore = data.score;
            updateScores();
        } else if (data.type === 'gameOver') {
            gameOver(data.message);
        }
    });
}

function init(color) {
    if (mode === 'multiplayer') {
        userColor = isHost ? 'red' : 'blue';
        computerColor = isHost ? 'blue' : 'red';
    } else {
        userColor = color;
        computerColor = color === 'red' ? 'blue' : 'red';
    }
    
    // Initialize snakes
    snake1 = [{x: 300, y: 300}, {x: 280, y: 300}, {x: 260, y: 300}]; // user snake
    snake2 = [{x: 300, y: 200}, {x: 280, y: 200}, {x: 260, y: 200}]; // computer or peer snake
    
    dx1 = gridSize; dy1 = 0;
    dx2 = gridSize; dy2 = 0;
    
    redScore = 0; blueScore = 0;
    speed = 100;
    gameActive = true;
    
    redScoreVal.innerText = "000";
    blueScoreVal.innerText = "000";
    
    overlay.style.display = "none";
    createFoods();
    if (isHost && mode === 'multiplayer' && conn) {
        conn.send({type: 'food', color: 'red', food: redFood});
        conn.send({type: 'food', color: 'blue', food: blueFood});
    }
    main();
}

function main() {
    if (!gameActive) return;

    setTimeout(() => {
        clearCanvas();
        drawFoods();
        if (mode === 'computer') {
            moveComputerSnake();
        }
        advanceSnakes();
        drawSnakes();
        main();
    }, speed);
}

function clearCanvas() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw Grid Lines (Subtle)
    ctx.strokeStyle = "#111";
    for(let i=0; i<canvas.width; i+=gridSize) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
}

function drawSnakes() {
    // Draw user snake
    const userSnakeColor = userColor === 'red' ? '#ff0055' : '#00d4ff';
    const userSnakeShadow = userColor === 'red' ? '#ff0055' : '#00d4ff';
    snake1.forEach((part, index) => {
        ctx.fillStyle = index === 0 ? userSnakeColor : (userColor === 'red' ? '#770022' : '#005577');
        ctx.shadowBlur = 15;
        ctx.shadowColor = userSnakeShadow;
        ctx.fillRect(part.x + 1, part.y + 1, gridSize - 2, gridSize - 2);
        ctx.shadowBlur = 0;
    });
    
    // Draw computer snake
    const compSnakeColor = computerColor === 'red' ? '#ff0055' : '#00d4ff';
    const compSnakeShadow = computerColor === 'red' ? '#ff0055' : '#00d4ff';
    snake2.forEach((part, index) => {
        ctx.fillStyle = index === 0 ? compSnakeColor : (computerColor === 'red' ? '#770022' : '#005577');
        ctx.shadowBlur = 15;
        ctx.shadowColor = compSnakeShadow;
        ctx.fillRect(part.x + 1, part.y + 1, gridSize - 2, gridSize - 2);
        ctx.shadowBlur = 0;
    });
}

function advanceSnakes() {
    // Advance user snake
    const head1 = {x: snake1[0].x + dx1, y: snake1[0].y + dy1};
    
    // Check collisions for user snake
    if (head1.x < 0 || head1.x >= canvas.width || head1.y < 0 || head1.y >= canvas.height || 
        selfCollision(head1, snake1) || collisionWithOther(head1, snake2)) {
        gameOver(userColor + " SNAKE CRASHED");
        return;
    }
    
    snake1.unshift(head1);
    
    let ate = false;
    if (userColor === 'red') {
        if (head1.x === redFood.x && head1.y === redFood.y) {
            redScore += 10;
            updateScores();
            createRedFood();
            if (mode === 'multiplayer' && conn) conn.send({type: 'food', color: 'red', food: redFood});
            ate = true;
        } else if (head1.x === blueFood.x && head1.y === blueFood.y) {
            gameOver("RED SNAKE ATE BLUE FOOD - DISQUALIFIED");
            return;
        }
    } else {
        if (head1.x === blueFood.x && head1.y === blueFood.y) {
            blueScore += 10;
            updateScores();
            createBlueFood();
            if (mode === 'multiplayer' && conn) conn.send({type: 'food', color: 'blue', food: blueFood});
            ate = true;
        } else if (head1.x === redFood.x && head1.y === redFood.y) {
            gameOver("BLUE SNAKE ATE RED FOOD - DISQUALIFIED");
            return;
        }
    }
    
    if (!ate) snake1.pop();
    
    // Advance computer snake
    const head2 = {x: snake2[0].x + dx2, y: snake2[0].y + dy2};
    
    // Check collisions for computer snake
    if (head2.x < 0 || head2.x >= canvas.width || head2.y < 0 || head2.y >= canvas.height || 
        selfCollision(head2, snake2) || collisionWithOther(head2, snake1)) {
        gameOver(computerColor.toUpperCase() + " SNAKE CRASHED");
        return;
    }
    
    snake2.unshift(head2);
    
    ate = false;
    if (computerColor === 'red') {
        if (head2.x === redFood.x && head2.y === redFood.y) {
            redScore += 10;
            updateScores();
            createRedFood();
            if (mode === 'multiplayer' && conn) conn.send({type: 'food', color: 'red', food: redFood});
            ate = true;
        } else if (head2.x === blueFood.x && head2.y === blueFood.y) {
            gameOver("RED SNAKE ATE BLUE FOOD - DISQUALIFIED");
            return;
        }
    } else {
        if (head2.x === blueFood.x && head2.y === blueFood.y) {
            blueScore += 10;
            updateScores();
            createBlueFood();
            if (mode === 'multiplayer' && conn) conn.send({type: 'food', color: 'blue', food: blueFood});
            ate = true;
        } else if (head2.x === redFood.x && head2.y === redFood.y) {
            gameOver("BLUE SNAKE ATE RED FOOD - DISQUALIFIED");
            return;
        }
    }
    
    if (!ate) snake2.pop();
}

function selfCollision(head, snake) {
    return snake.some(part => part.x === head.x && part.y === head.y);
}

function collisionWithOther(head, otherSnake) {
    return otherSnake.some(part => part.x === head.x && part.y === head.y);
}

function createFoods() {
    createRedFood();
    createBlueFood();
}

function createRedFood() {
    do {
        redFood = {
            x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
            y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
        };
    } while (isOnSnake(redFood));
}

function createBlueFood() {
    do {
        blueFood = {
            x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
            y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
        };
    } while (isOnSnake(blueFood));
}

function isOnSnake(food) {
    return [...snake1, ...snake2].some(part => part.x === food.x && part.y === food.y);
}

function drawFoods() {
    // Draw red food
    ctx.fillStyle = "#ff0055";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ff0055";
    ctx.beginPath();
    ctx.arc(redFood.x + gridSize/2, redFood.y + gridSize/2, gridSize/3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Draw blue food
    ctx.fillStyle = "#00d4ff";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00d4ff";
    ctx.beginPath();
    ctx.arc(blueFood.x + gridSize/2, blueFood.y + gridSize/2, gridSize/3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function moveComputerSnake() {
    const targetFood = computerColor === 'red' ? redFood : blueFood;
    const head = snake2[0];
    
    const dx = targetFood.x - head.x;
    const dy = targetFood.y - head.y;
    
    let newDx = dx2;
    let newDy = dy2;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        // Move horizontally
        if (dx > 0 && dx2 === 0) {
            newDx = gridSize;
            newDy = 0;
        } else if (dx < 0 && dx2 === 0) {
            newDx = -gridSize;
            newDy = 0;
        } else {
            // Can't move horizontally, try vertical
            if (dy > 0 && dy2 === 0) {
                newDx = 0;
                newDy = gridSize;
            } else if (dy < 0 && dy2 === 0) {
                newDx = 0;
                newDy = -gridSize;
            }
        }
    } else {
        // Move vertically
        if (dy > 0 && dy2 === 0) {
            newDx = 0;
            newDy = gridSize;
        } else if (dy < 0 && dy2 === 0) {
            newDx = 0;
            newDy = -gridSize;
        } else {
            // Can't move vertically, try horizontal
            if (dx > 0 && dx2 === 0) {
                newDx = gridSize;
                newDy = 0;
            } else if (dx < 0 && dx2 === 0) {
                newDx = -gridSize;
                newDy = 0;
            }
        }
    }
    
    // If no valid move, keep current direction or find any valid
    if (newDx === 0 && newDy === 0) {
        const possibleMoves = [
            {dx: gridSize, dy: 0},
            {dx: -gridSize, dy: 0},
            {dx: 0, dy: gridSize},
            {dx: 0, dy: -gridSize}
        ].filter(move => move.dx !== -dx2 || move.dy !== -dy2);
        
        for (let move of possibleMoves) {
            const nextHead = {x: head.x + move.dx, y: head.y + move.dy};
            if (nextHead.x >= 0 && nextHead.x < canvas.width && nextHead.y >= 0 && nextHead.y < canvas.height &&
                !selfCollision(nextHead, snake2) && !collisionWithOther(nextHead, snake1)) {
                newDx = move.dx;
                newDy = move.dy;
                break;
            }
        }
    }
    
    dx2 = newDx;
    dy2 = newDy;
}

function updateScores() {
    redScoreVal.innerText = redScore.toString().padStart(3, '0');
    blueScoreVal.innerText = blueScore.toString().padStart(3, '0');
}

function gameOver(message) {
    gameActive = false;
    overlay.style.display = "flex";
    document.getElementById("overlay-title").innerText = "GAME OVER";
    document.getElementById("overlay-msg").innerText = message + `\nRED SCORE: ${redScore} | BLUE SCORE: ${blueScore}`;
    if (mode === 'multiplayer' && conn) {
        conn.send({type: 'gameOver', message: message});
    }
}

window.addEventListener("keydown", e => {
    if (!gameActive && e.key === "Enter") {
        overlay.style.display = "flex";
        document.getElementById("overlay-title").innerText = "SYSTEM READY";
        document.getElementById("overlay-msg").innerText = "CHOOSE YOUR SNAKE COLOR";
    }
    if (gameActive) {
        let moved = false;
        switch(e.key) {
            case "ArrowUp": case "w": if(dy1 === 0) { dx1 = 0; dy1 = -gridSize; moved = true; } break;
            case "ArrowDown": case "s": if(dy1 === 0) { dx1 = 0; dy1 = gridSize; moved = true; } break;
            case "ArrowLeft": case "a": if(dx1 === 0) { dx1 = -gridSize; dy1 = 0; moved = true; } break;
            case "ArrowRight": case "d": if(dx1 === 0) { dx1 = gridSize; dy1 = 0; moved = true; } break;
        }
        if (moved && mode === 'multiplayer' && conn) {
            conn.send({type: 'move', dx: dx1, dy: dy1});
        }
    }
});

redBtn.addEventListener("click", () => init('red'));
blueBtn.addEventListener("click", () => init('blue'));