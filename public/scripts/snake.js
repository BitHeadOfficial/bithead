// scripts/snake.js

import { API_URL, fetchAPI } from './config.js';

// Initialize leaderboard data at the top level
let leaderboardData = [];

// We expose our main function on window so script.js can call it
window.initSnakeGame = async function () {
  console.log("initSnakeGame called!"); // Debug to confirm it's invoked

  const canvas = document.getElementById("snakeCanvas");
  if (!canvas) {
    console.error("Snake canvas not found!");
    return;
  }

  // Fetch leaderboard immediately on initialization
  try {
    console.log('Fetching initial leaderboard...');
    const response = await fetchAPI('/api/leaderboard');
    console.log('Leaderboard response:', response);
    
    if (response && response.success && Array.isArray(response.leaderboard)) {
      leaderboardData = response.leaderboard.map(entry => ({
        displayName: entry.display_name || 'Anonymous',
        twitterHandle: entry.twitter_handle || '@anonymous',
        profilePic: entry.profile_pic || `https://unavatar.io/twitter/${(entry.twitter_handle || 'anonymous').replace('@', '')}`,
        score: entry.score || 0
      }));
      console.log('Processed leaderboard data:', leaderboardData);
      updateLeaderboardUI();
    } else {
      console.error('Invalid leaderboard response:', response);
      // Initialize with empty data if response is invalid
      leaderboardData = [];
      updateLeaderboardUI();
    }
  } catch (error) {
    console.error('Error fetching initial leaderboard:', error);
    // Initialize with empty data on error
    leaderboardData = [];
    updateLeaderboardUI();
  }

  const ctx = canvas.getContext("2d");

  // Determine a responsive square canvas size
  const maxDimension = 500;
  const availableDimension = Math.min(
    window.innerWidth - 40,
    window.innerHeight - 150
  );
  const size = Math.min(maxDimension, availableDimension);
  canvas.width = size;
  canvas.height = size;

  const cellSize = 20;
  const cols = Math.floor(canvas.width / cellSize);
  const rows = Math.floor(canvas.height / cellSize);

  let obstacles = [];

  function cellInArray(x, y, arr) {
    return arr.some((item) => item.x === x && item.y === y);
  }

  function randomFoodPosition(snakeA, snakeB) {
    let pos;
    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
      attempts++;
      if (attempts > 100) break; // fallback if we can't find a free spot
    } while (
      cellInArray(pos.x, pos.y, obstacles) ||
      (snakeA && snakeA.segments.some(seg => seg.x === pos.x && seg.y === pos.y)) ||
      (snakeB && snakeB.segments.some(seg => seg.x === pos.x && seg.y === pos.y))
    );
    return pos;
  }

  let food = null;
  let snakeA = new Snake(true);
  let snakeB = new Snake(false);
  food = randomFoodPosition(snakeA, snakeB);
  let snakeAWins = 0;
  let snakeBWins = 0;
  let roundStartTime = Date.now();
  let roundActive = true;

  // Betting system variables
  let currentBet = null; // "A" or "B"
  let currentStreak = 0;
  const profilePics = [
    'assets/images/BitHead_NFT.jpg',
    'assets/images/BitHead_PP.jpg',
    'assets/images/nft-preview.jpg',
    'assets/images/nft-preview-back.jpg',
    'assets/images/nft-preview-2-back.jpg',
    'assets/images/sci-fi-concept_1.jpg',
    'assets/images/placeholder1.png',
    'assets/images/placeholder2.png',
    'assets/images/placeholder3.png',
    'assets/images/The_American_Dream.png'
  ];

  // Fetch leaderboard on load
  async function fetchLeaderboard() {
    try {
      const response = await fetchAPI('/api/leaderboard');
      if (response.success && Array.isArray(response.leaderboard)) {
        leaderboardData = response.leaderboard.map(entry => ({
          displayName: entry.display_name || 'Anonymous',
          twitterHandle: entry.twitter_handle || '@anonymous',
          profilePic: entry.profile_pic || `https://unavatar.io/twitter/${(entry.twitter_handle || 'anonymous').replace('@', '')}`,
          score: entry.score || 0
        }));
        updateLeaderboardUI();
        return leaderboardData;
      }
      return [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  // Modal elements
  const modal = document.getElementById('userInfoModal');
  const userInfoForm = document.getElementById('userInfoForm');
  const cancelBtn = document.querySelector('.cancel-btn');

  function showModal() {
    modal.style.display = 'block';
  }

  function hideModal() {
    modal.style.display = 'none';
  }

  // Handle form submission
  if (userInfoForm) {
    userInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let displayName = document.getElementById('displayName').value.trim().slice(0, 20);
      let twitterHandle = document.getElementById('twitterHandle').value.trim().replace(/^@*/, '@').slice(0, 16);
      const profilePic = `https://unavatar.io/twitter/${twitterHandle.replace('@','')}`;
      const errorDiv = document.getElementById('leaderboardError') || (() => {
        const d = document.createElement('div');
        d.id = 'leaderboardError';
        d.style.color = '#ff4c60';
        d.style.margin = '0.5em 0';
        userInfoForm.insertBefore(d, userInfoForm.firstChild);
        return d;
      })();
      // Validate
      if (!displayName) {
        errorDiv.textContent = 'Display name required.';
        return;
      }
      if (!/^@[a-zA-Z0-9_]{1,15}$/.test(twitterHandle)) {
        errorDiv.textContent = 'Twitter handle must start with @ and be 2-16 chars.';
        return;
      }
      errorDiv.textContent = '';
      try {
        const res = await fetchAPI('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, twitterHandle, profilePic, score: currentStreak })
        });
        const data = res;
        if (data.success && Array.isArray(data.leaderboard)) {
          leaderboardData = data.leaderboard.map((entry, i) => ({
            displayName: entry.display_name || 'Anonymous',
            twitterHandle: entry.twitter_handle || '@anonymous',
            profilePic: entry.profile_pic || `https://unavatar.io/twitter/${(entry.twitter_handle || 'anonymous').replace('@', '')}`,
            score: entry.score || 0
          }));
          updateLeaderboardUI();
        } else if (data.success) {
          await fetchLeaderboard();
        } else {
          errorDiv.textContent = data.error || 'Failed to submit score.';
        }
      } catch (err) {
        errorDiv.textContent = 'Server error.';
      }
      // Reset streak and update UI
      currentStreak = 0;
      if (streakDisplay) {
        streakDisplay.textContent = `Your current streak: ${currentStreak}`;
      }
      hideModal();
      userInfoForm.reset();
      if (streakJustKilled) {
        showShareButton(lastScore, lastSnapshot);
        streakJustKilled = false;
      }
    });
  }

  // Handle cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      currentStreak = 0;
      if (streakDisplay) {
        streakDisplay.textContent = `Your current streak: ${currentStreak}`;
      }
      hideModal();
      userInfoForm.reset();
      if (streakJustKilled) {
        showShareButton(lastScore, lastSnapshot);
        streakJustKilled = false;
      }
    });
  }

  async function updateLeaderboardUI() {
    console.log('Updating leaderboard UI...');
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) {
        console.error('Leaderboard container not found');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        console.log('Leaderboard response:', response);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Processed leaderboard data:', data);

        // Sort by score in descending order
        const sortedData = data.sort((a, b) => b.score - a.score);
        console.log('Sorted leaderboard data:', sortedData);

        // Get top 10 entries
        const topEntries = sortedData.slice(0, 10);
        console.log('Top 10 entries:', topEntries);

        // Clear existing entries
        leaderboardContainer.innerHTML = '';

        // Only show "show more" button if there are more than 10 entries
        const showMoreButton = document.getElementById('show-more-leaderboard');
        if (showMoreButton) {
            showMoreButton.style.display = sortedData.length > 10 ? 'block' : 'none';
        }

        // If no entries, show a message
        if (topEntries.length === 0) {
            leaderboardContainer.innerHTML = `
                <div class="leaderboard-empty">
                    <p>Be the first to play and claim your spot on the leaderboard!</p>
                    <button onclick="startGame()" class="start-game-btn">Start Game</button>
                </div>
            `;
            return;
        }

        // Render entries
        console.log('Rendering leaderboard entries...');
        topEntries.forEach((entry, index) => {
            const entryElement = document.createElement('div');
            entryElement.className = 'leaderboard-entry';
            entryElement.innerHTML = `
                <div class="rank">${index + 1}</div>
                <div class="player-info">
                    <img src="${entry.profilePic || 'https://unavatar.io/twitter/bithead'}" 
                         alt="${entry.displayName || 'Anonymous'}" 
                         onerror="this.src='https://unavatar.io/twitter/bithead'"
                         class="profile-picture">
                    <span class="username">${entry.displayName || 'Anonymous'}</span>
                </div>
                <div class="score">${entry.score.toLocaleString()}</div>
            `;
            leaderboardContainer.appendChild(entryElement);
        });

    } catch (error) {
        console.error('Error updating leaderboard:', error);
        leaderboardContainer.innerHTML = `
            <div class="leaderboard-error">
                <p>Unable to load leaderboard. Please try again later.</p>
                <button onclick="updateLeaderboardUI()" class="retry-btn">Retry</button>
            </div>
        `;
    }
  }

  // Fetch leaderboard on load
  fetchLeaderboard();

  // Grab betting UI references
  const betAButton = document.getElementById("bet-A");
  const betBButton = document.getElementById("bet-B");
  const tweetButton = document.getElementById("tweet-button");
  const streakDisplay = document.getElementById("streak-display");

  // Initialize bet button styles
  if (betAButton) {
    betAButton.classList.add("filled-button");
    betAButton.textContent = "Bet on Snake A";
  }
  if (betBButton) {
    betBButton.classList.add("outline-button");
    betBButton.textContent = "Bet on Snake B";
  }

  if (betAButton && betBButton && tweetButton && streakDisplay) {
    // Bet A
    betAButton.addEventListener("click", () => {
      currentBet = "A";
      betAButton.classList.add("selected-bet");
      betBButton.classList.remove("selected-bet");
      betAButton.disabled = true;
      betBButton.disabled = true;
    });

    // Bet B
    betBButton.addEventListener("click", () => {
      currentBet = "B";
      betBButton.classList.add("selected-bet");
      betAButton.classList.remove("selected-bet");
      betAButton.disabled = true;
      betBButton.disabled = true;
    });

    // Tweet button
    tweetButton.addEventListener("click", () => {
      const tweetText = encodeURIComponent(
        `I just had a winning streak of ${currentStreak} in Snake Duel Challenge! #SnakeDuel`
      );
      window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}`,
        "_blank"
      );
    });
  }

  // generateObstacle: safely place new obstacle
  function generateObstacle(snakeA, snakeB, food, existingObstacles) {
    let pos;
    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
      attempts++;
      if (attempts > 100) break;
    } while (
      cellInArray(pos.x, pos.y, existingObstacles) ||
      snakeA.segments.some((seg) => seg.x === pos.x && seg.y === pos.y) ||
      snakeB.segments.some((seg) => seg.x === pos.x && seg.y === pos.y) ||
      (pos.x === food.x && pos.y === food.y)
    );
    return pos;
  }

  // A* pathfinding
  function findPath(start, goal, cols, rows, blockedSet) {
    const key = (x, y) => `${x},${y}`;
    function heuristic(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    const openSet = [];
    const closedSet = new Set();
    openSet.push({
      x: start.x,
      y: start.y,
      g: 0,
      h: heuristic(start, goal),
      f: heuristic(start, goal),
      parent: null,
    });
    while (openSet.length > 0) {
      // find node in openSet with lowest f
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) currentIndex = i;
      }
      const current = openSet.splice(currentIndex, 1)[0];
      // reached goal?
      if (current.x === goal.x && current.y === goal.y) {
        const path = [];
        let temp = current;
        while (temp) {
          path.push({ x: temp.x, y: temp.y });
          temp = temp.parent;
        }
        return path.reverse();
      }
      closedSet.add(key(current.x, current.y));
      // neighbors
      const neighbors = [
        { x: (current.x + 1) % cols, y: current.y },
        { x: (current.x - 1 + cols) % cols, y: current.y },
        { x: current.x, y: (current.y + 1) % rows },
        { x: current.x, y: (current.y - 1 + rows) % rows },
      ];
      for (let neighbor of neighbors) {
        if (
          closedSet.has(key(neighbor.x, neighbor.y)) ||
          blockedSet.has(key(neighbor.x, neighbor.y))
        )
          continue;
        const tentativeG = current.g + 1;
        let existing = openSet.find(
          (n) => n.x === neighbor.x && n.y === neighbor.y
        );
        if (!existing) {
          existing = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h: heuristic(neighbor, goal),
            f: tentativeG + heuristic(neighbor, goal),
            parent: current,
          };
          openSet.push(existing);
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
        }
      }
    }
    return null; // no path found
  }

  function Snake(isFilled) {
    this.segments = [];
    this.segments.push({
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    });
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    this.dir = directions[Math.floor(Math.random() * directions.length)];
    this.isFilled = isFilled;
    this.score = 0;
    this.accuracy = 0.8; // used in some advanced logic if needed
  }

  // Manhattan distance helper
  function manhattanDistance(x, y) {
    return Math.abs(x - food.x) + Math.abs(y - food.y);
  }

  // Snake move logic: A* if possible, else random fallback
  Snake.prototype.move = function (otherSnake) {
    const head = this.segments[0];
    const blockedSet = new Set();

    function addCells(snake) {
      snake.segments.forEach((seg) => blockedSet.add(`${seg.x},${seg.y}`));
    }
    addCells(this);
    addCells(otherSnake);
    obstacles.forEach((obs) => blockedSet.add(`${obs.x},${obs.y}`));

    const path = findPath(head, food, cols, rows, blockedSet);
    if (path && path.length > 1) {
      let step = path[1];
      let moveDir = { x: step.x - head.x, y: step.y - head.y };
      // Adjust wrapping
      if (moveDir.x > 1) moveDir.x = -1;
      if (moveDir.x < -1) moveDir.x = 1;
      if (moveDir.y > 1) moveDir.y = -1;
      if (moveDir.y < -1) moveDir.y = 1;
      this.dir = moveDir;
    } else {
      // fallback approach
      const diffX = food.x - head.x;
      const diffY = food.y - head.y;
      let desiredDir = { x: 0, y: 0 };
      if (Math.abs(diffX) > Math.abs(diffY)) {
        desiredDir = { x: diffX > 0 ? 1 : -1, y: 0 };
      } else if (Math.abs(diffY) > 0) {
        desiredDir = { x: 0, y: diffY > 0 ? 1 : -1 };
      }
      const candidates = [
        desiredDir,
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const safeMoves = [];
      for (let cand of candidates) {
        let newX = head.x + cand.x;
        let newY = head.y + cand.y;
        if (newX < 0) newX = cols - 1;
        if (newX >= cols) newX = 0;
        if (newY < 0) newY = rows - 1;
        if (newY >= rows) newY = 0;
        const collision =
          this.segments.some((seg) => seg.x === newX && seg.y === newY) ||
          otherSnake.segments.some((seg) => seg.x === newX && seg.y === newY) ||
          cellInArray(newX, newY, obstacles);
        if (!collision) {
          safeMoves.push({
            dir: cand,
            distance: manhattanDistance(newX, newY),
          });
        }
      }
      if (safeMoves.length === 0) return false;
      let chosenMove = safeMoves.find(
        (move) => move.dir.x === desiredDir.x && move.dir.y === desiredDir.y
      );
      if (!chosenMove) {
        chosenMove = safeMoves[Math.floor(Math.random() * safeMoves.length)];
      }
      this.dir = chosenMove.dir;
    }

    let newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };
    // wrap edges
    if (newHead.x < 0) newHead.x = cols - 1;
    if (newHead.x >= cols) newHead.x = 0;
    if (newHead.y < 0) newHead.y = rows - 1;
    if (newHead.y >= rows) newHead.y = 0;

    // collision check
    if (
      this.segments.some((seg) => seg.x === newHead.x && seg.y === newHead.y) ||
      otherSnake.segments.some(
        (seg) => seg.x === newHead.x && seg.y === newHead.y
      ) ||
      cellInArray(newHead.x, newHead.y, obstacles)
    ) {
      return false;
    }
    // eat food or move
    this.segments.unshift(newHead);
    if (newHead.x === food.x && newHead.y === food.y) {
      this.score++;
      food = randomFoodPosition(snakeA, snakeB);
      while (cellInArray(food.x, food.y, obstacles)) {
        food = randomFoodPosition(snakeA, snakeB);
      }
      const newObs = generateObstacle(snakeA, snakeB, food, obstacles);
      obstacles.push(newObs);
    } else {
      this.segments.pop();
    }
    return true;
  };

  // Outline a snake with a stroke to create the effect of a hollow shape
  function drawSnakeOutline(snake, ctx, cellSize) {
    const cellSet = new Set(snake.segments.map((s) => `${s.x},${s.y}`));
    const segmentsEdges = [];
    function neighborExists(x, y, dx, dy) {
      let nx = x + dx,
        ny = y + dy;
      if (nx < 0) nx = cols - 1;
      else if (nx >= cols) nx = 0;
      if (ny < 0) ny = rows - 1;
      else if (ny >= rows) ny = 0;
      return cellSet.has(`${nx},${ny}`);
    }
    snake.segments.forEach((s) => {
      const x = s.x,
        y = s.y;
      // top edge
      if (!neighborExists(x, y, 0, -1)) {
        segmentsEdges.push({
          x1: x * cellSize,
          y1: y * cellSize,
          x2: (x + 1) * cellSize,
          y2: y * cellSize,
        });
      }
      // right edge
      if (!neighborExists(x, y, 1, 0)) {
        segmentsEdges.push({
          x1: (x + 1) * cellSize,
          y1: y * cellSize,
          x2: (x + 1) * cellSize,
          y2: (y + 1) * cellSize,
        });
      }
      // bottom
      if (!neighborExists(x, y, 0, 1)) {
        segmentsEdges.push({
          x1: (x + 1) * cellSize,
          y1: (y + 1) * cellSize,
          x2: x * cellSize,
          y2: (y + 1) * cellSize,
        });
      }
      // left edge
      if (!neighborExists(x, y, -1, 0)) {
        segmentsEdges.push({
          x1: x * cellSize,
          y1: (y + 1) * cellSize,
          x2: x * cellSize,
          y2: y * cellSize,
        });
      }
    });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    segmentsEdges.forEach((seg) => {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    });
  }

  // Draw snake
  Snake.prototype.draw = function (ctx) {
    if (this.isFilled) {
      // fill white
      for (let i = 0; i < this.segments.length; i++) {
        const seg = this.segments[i];
        const x = seg.x * cellSize;
        const y = seg.y * cellSize;
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    } else {
      // fill black, then outline
      for (let i = 0; i < this.segments.length; i++) {
        const seg = this.segments[i];
        const x = seg.x * cellSize;
        const y = seg.y * cellSize;
        ctx.fillStyle = "#000";
        ctx.fillRect(x, y, cellSize, cellSize);
      }
      drawSnakeOutline(this, ctx, cellSize);
    }
  };

  // Restart round
  function restartRound() {
    const newAccuracyA = snakeA.accuracy;
    const newAccuracyB = snakeB.accuracy;
    snakeA = new Snake(true);
    snakeB = new Snake(false);
    snakeA.accuracy = newAccuracyA;
    snakeB.accuracy = newAccuracyB;
    food = randomFoodPosition(snakeA, snakeB);
    obstacles = [];
    roundStartTime = Date.now();
    roundActive = true;
    currentBet = null;
    if (betAButton) {
      betAButton.disabled = false;
      betAButton.classList.remove("selected-bet");
    }
    if (betBButton) {
      betBButton.disabled = false;
      betBButton.classList.remove("selected-bet");
    }
    if (tweetButton) tweetButton.style.display = "none";
    lastUpdate = 0;
    hideShareButton();
  }

  let lastUpdate = 0;
  const updateInterval = 200;

  // Add a container for the share button and snapshot
  let shareContainer = document.getElementById('shareContainer');
  if (!shareContainer) {
    shareContainer = document.createElement('div');
    shareContainer.id = 'shareContainer';
    shareContainer.style.display = 'none';
    shareContainer.style.textAlign = 'center';
    shareContainer.style.margin = '1.5em 0';
    canvas.parentNode.appendChild(shareContainer);
  }
  let lastScore = 0;
  let lastSnapshot = '';
  let streakJustKilled = false;

  function showShareButton(score, snapshotUrl) {
    shareContainer.innerHTML = '';
    if (snapshotUrl) {
      const img = document.createElement('img');
      img.src = snapshotUrl;
      img.alt = 'Game Snapshot';
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      img.style.marginBottom = '1em';
      shareContainer.appendChild(img);
    }
    const btn = document.createElement('button');
    btn.id = 'tweet-button-final';
    btn.textContent = `Share your streak (${score}) on Twitter`;
    btn.className = 'share-twitter-btn';
    btn.style.background = 'linear-gradient(90deg, #4296d2 0%, #2f6d99 100%)';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '2em';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '1.1em';
    btn.style.fontWeight = '600';
    btn.style.padding = '0.7em 2em';
    btn.style.margin = '0 auto 1em auto';
    btn.onclick = function() {
      const tweetText = encodeURIComponent(
        `I just had a streak of ${score} in the BitHeadz Snake Duel! Can you beat me? #SnakeDuel #IamBitHead`);
      window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}`,
        '_blank'
      );
    };
    shareContainer.appendChild(btn);
    shareContainer.style.display = 'block';
  }
  function hideShareButton() {
    shareContainer.style.display = 'none';
  }

  function gameLoop(timestamp) {
    if (!lastUpdate) lastUpdate = timestamp;
    const delta = timestamp - lastUpdate;
    if (delta > updateInterval && roundActive) {
      // Clear canvas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Draw obstacles
      for (let obs of obstacles) {
        const ox = obs.x * cellSize;
        const oy = obs.y * cellSize;
        ctx.fillStyle = "#000";
        ctx.fillRect(ox, oy, cellSize, cellSize);
        ctx.strokeStyle = "#ff4c60";
        ctx.lineWidth = 2;
        ctx.strokeRect(ox, oy, cellSize, cellSize);
      }

      const moveA = snakeA.move(snakeB);
      const moveB = snakeB.move(snakeA);

      if (!moveA || !moveB) {
        roundActive = false;
        if (!moveA && moveB) {
          snakeBWins++;
          snakeB.accuracy = Math.min(1.0, snakeB.accuracy + 0.1);
          snakeA.accuracy = Math.max(0.3, snakeA.accuracy - 0.1);
        } else if (!moveB && moveA) {
          snakeAWins++;
          snakeA.accuracy = Math.min(1.0, snakeA.accuracy + 0.1);
          snakeB.accuracy = Math.max(0.3, snakeB.accuracy - 0.1);
        } else {
          snakeA.accuracy = Math.max(0.3, snakeA.accuracy - 0.05);
          snakeB.accuracy = Math.max(0.3, snakeB.accuracy - 0.05);
        }
        const winningSnake =
          !moveA && moveB ? "A" : !moveB && moveA ? "B" : "Tie";

        // Betting
        if (currentBet) {
          if (currentBet === winningSnake) {
            currentStreak++;
          } else {
            showModal();
          }
          currentBet = null;
        }
        if (streakDisplay) {
          streakDisplay.textContent = `Your current streak: ${currentStreak}`;
        }
        if (tweetButton) {
          tweetButton.style.display = currentStreak > 0 ? "block" : "none";
        }
        const roundDuration = ((Date.now() - roundStartTime) / 1000).toFixed(1);
        const scoreAEl = document.getElementById("score-A");
        const scoreBEl = document.getElementById("score-B");
        const roundTimerEl = document.getElementById("round-timer");
        if (scoreAEl) scoreAEl.textContent = snakeAWins;
        if (scoreBEl) scoreBEl.textContent = snakeBWins;
        if (roundTimerEl) {
          roundTimerEl.textContent = `Last Round Time: ${roundDuration}s`;
        }
        if (currentBet && currentBet !== winningSnake) {
          lastScore = currentStreak;
          lastSnapshot = canvas.toDataURL('image/png');
          streakJustKilled = true;
        }
        setTimeout(restartRound, 500);
      }

      // Draw food
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      const foodX = food.x * cellSize + cellSize / 2;
      const foodY = food.y * cellSize + cellSize / 2;
      ctx.arc(foodX, foodY, cellSize / 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw snakes
      snakeA.draw(ctx);
      snakeB.draw(ctx);

      lastUpdate = timestamp;
    }
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
};
