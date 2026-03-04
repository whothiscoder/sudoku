const MESSAGES = ["Happy Birthday!!! I love you Tasnim ♥", "Will you marry me? Click yes for part 2 of your present."];
const PART2_URL = "https://docs.google.com/presentation/d/1Yc-cdn3LpSqpnlDRY1SrIXk1B9UapWw1zwozHqLvYKI/edit?usp=sharing";
const SOLUTION_PASSWORD = "SaeedxTasnim"; 
const difficultyToClues = {
  easy: 40,
  medium: 32,
  hard: 26,
  expert: 22,
};

// ---------- DOM ----------
const tab1 = document.getElementById("tab1");
const tab2 = document.getElementById("tab2");
const difficultySel = document.getElementById("difficulty");
const newPuzzleBtn = document.getElementById("newPuzzleBtn");
const checkBtn = document.getElementById("checkBtn");
const solveBtn = document.getElementById("solveBtn");
const clearBtn = document.getElementById("clearBtn");
const autoCheckEl = document.getElementById("autoCheck");
const pencilModeEl = document.getElementById("pencilMode");

const gridEl = document.getElementById("grid");
const puzzleBadge = document.getElementById("puzzleBadge");

const toast = document.getElementById("toast");
const modal = document.getElementById("modal");
const modalMsg = document.getElementById("modalMsg");
const modalClose = document.getElementById("modalClose");
const yesBtn = document.getElementById("yesBtn");

const padButtons = document.querySelectorAll(".pad");

let selectedIndex = -1;

// reveal timer state
let revealTimeout = null;
let revealCountdownInterval = null;

const state = {
  active: 0, // 0 or 1
  settings: {
    difficulty: "medium",
    autoCheck: true,
    pencilMode: false,
  },
  puzzles: [makeEmptyPuzzle(), makeEmptyPuzzle()],
};

function makeEmptyPuzzle() {
  return {
    given: new Array(81).fill(0),
    solution: new Array(81).fill(0),
    entries: new Array(81).fill(0),
    pencil: Array.from({ length: 81 }, () => new Set()),
    revealed: false, // message already revealed (after timer)
    pendingReveal: false, // solved and waiting for countdown
  };
}

// ---------- UI helpers ----------
function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.style.borderColor = ok
    ? "rgba(68,214,126,.55)"
    : "rgba(255,92,122,.55)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1400);
}

function openModal(message) {
  modalMsg.textContent = message;

  const isProposal = state.active === 1;
  yesBtn.classList.toggle("hidden", !isProposal);

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

yesBtn.addEventListener("click", () => {
  closeModal();
  showToast("🥳 Opening part 2...", true);
  window.location.assign(PART2_URL);
});

function cancelRevealTimers() {
  if (revealTimeout) clearTimeout(revealTimeout);
  if (revealCountdownInterval) clearInterval(revealCountdownInterval);
  revealTimeout = null;
  revealCountdownInterval = null;

  // clear pending state for current puzzle
  const p = state.puzzles[state.active];
  p.pendingReveal = false;

  setInputsDisabled(false);
}

function setInputsDisabled(disabled) {
  const p = state.puzzles[state.active];
  for (let i = 0; i < 81; i++) {
    const cell = gridEl.children[i];
    if (!cell) continue;
    const input = cell.querySelector("input");
    if (!input) continue;
    if (p.given[i] !== 0) continue; // givens already disabled
    input.disabled = disabled;
  }
  padButtons.forEach((btn) => (btn.disabled = disabled));
  // You can also disable buttons if you want:
  // newPuzzleBtn.disabled = disabled;
  // checkBtn.disabled = disabled;
  // solveBtn.disabled = disabled;
  // clearBtn.disabled = disabled;
}

// ---------- Grid build (once) ----------
function buildGridOnce() {
  gridEl.innerHTML = "";
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.idx = String(i);

    // thick borders for 3x3 blocks
    if (c === 2 || c === 5) cell.classList.add("border-r");
    if (r === 2 || r === 5) cell.classList.add("border-b");

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 1;

    const pencil = document.createElement("div");
    pencil.className = "pencil";
    for (let n = 1; n <= 9; n++) {
      const s = document.createElement("span");
      s.dataset.n = String(n);
      s.textContent = "";
      pencil.appendChild(s);
    }

    cell.appendChild(input);
    cell.appendChild(pencil);
    gridEl.appendChild(cell);

    cell.addEventListener("click", () => selectCell(i));
    input.addEventListener("focus", () => selectCell(i));
    input.addEventListener("keydown", (e) => onKeyDown(e, i));
    input.addEventListener("input", (e) => onTypedInput(e, i));
  }
}

function selectCell(idx) {
  selectedIndex = idx;
  render();
  const input = gridEl.children[idx]?.querySelector("input");
  if (input) input.focus();
}

// ---------- Input ----------
function onKeyDown(e, idx) {
  const p = state.puzzles[state.active];
  if (p.pendingReveal) {
    e.preventDefault();
    return;
  }

  const move = (delta) => {
    e.preventDefault();
    let n = idx + delta;
    if (n < 0) n = 0;
    if (n > 80) n = 80;
    selectCell(n);
  };

  if (e.key === "ArrowLeft") return move(-1);
  if (e.key === "ArrowRight") return move(1);
  if (e.key === "ArrowUp") return move(-9);
  if (e.key === "ArrowDown") return move(9);

  if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();
    applyNumberInput("clear");
    return;
  }

  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    applyNumberInput(e.key);
  }
}

function onTypedInput(e) {
  const p = state.puzzles[state.active];
  if (p.pendingReveal) {
    e.target.value = "";
    return;
  }

  // Mobile keyboards sometimes fire input events rather than keydown reliably
  const v = (e.target.value || "").trim();
  e.target.value = "";
  if (/^[1-9]$/.test(v)) {
    applyNumberInput(v);
  }
}

// ---------- Number pad ----------
padButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.getAttribute("data-pad");
    applyNumberInput(v);
  });
});

function applyNumberInput(n) {
  const p = state.puzzles[state.active];
  if (p.pendingReveal) return;

  if (selectedIndex === -1) {
    showToast("Tap a cell first", false);
    return;
  }

  if (p.given[selectedIndex] !== 0) return;

  if (n === "pencil") {
    state.settings.pencilMode = !state.settings.pencilMode;
    pencilModeEl.checked = state.settings.pencilMode;
    showToast(state.settings.pencilMode ? "Pencil mode on" : "Pencil mode off");
    return;
  }

  if (n === "clear") {
    if (state.settings.pencilMode) {
      p.pencil[selectedIndex].clear();
    } else {
      p.entries[selectedIndex] = 0;
      p.pencil[selectedIndex].clear();
    }
    render();
    if (state.settings.autoCheck) refreshConflicts();
    return;
  }

  const digit = Number(n);

  if (state.settings.pencilMode) {
    if (p.pencil[selectedIndex].has(digit)) p.pencil[selectedIndex].delete(digit);
    else p.pencil[selectedIndex].add(digit);
  } else {
    p.entries[selectedIndex] = digit;
    p.pencil[selectedIndex].clear();
  }

  render();
  if (state.settings.autoCheck) refreshConflicts();
  maybeSolved();
}

// ---------- Render ----------
function render() {
  puzzleBadge.textContent = state.active === 0 ? "Puzzle 1" : "Puzzle 2";

  const p = state.puzzles[state.active];

  for (let i = 0; i < 81; i++) {
    const cell = gridEl.children[i];
    const input = cell.querySelector("input");
    const pencil = cell.querySelector(".pencil");

    cell.classList.toggle("selected", i === selectedIndex);
    cell.classList.remove("conflict");

    const givenVal = p.given[i];
    const entryVal = p.entries[i];

    cell.classList.toggle("given", givenVal !== 0);

    if (givenVal !== 0) {
      input.value = String(givenVal);
      input.disabled = true;
    } else {
      input.disabled = p.pendingReveal; // lock while counting down
      input.value = entryVal === 0 ? "" : String(entryVal);
    }

    // pencil marks
    const set = p.pencil[i];
    for (const span of pencil.children) {
      const digit = Number(span.dataset.n);
      span.textContent =
        givenVal === 0 && entryVal === 0 && set.has(digit) ? String(digit) : "";
    }
  }
}

function getCurrentValues(p) {
  const vals = new Array(81);
  for (let i = 0; i < 81; i++) {
    vals[i] = p.given[i] !== 0 ? p.given[i] : p.entries[i];
  }
  return vals;
}

// ---------- Conflicts ----------
function refreshConflicts() {
  for (const cell of gridEl.children) cell.classList.remove("conflict");
  if (!state.settings.autoCheck) return;

  const p = state.puzzles[state.active];
  const values = getCurrentValues(p);
  const conflicts = new Set();

  // row
  for (let r = 0; r < 9; r++) {
    const seen = new Map();
    for (let c = 0; c < 9; c++) {
      const idx = r * 9 + c;
      const v = values[idx];
      if (v === 0) continue;
      if (seen.has(v)) {
        conflicts.add(idx);
        conflicts.add(seen.get(v));
      } else seen.set(v, idx);
    }
  }
  // col
  for (let c = 0; c < 9; c++) {
    const seen = new Map();
    for (let r = 0; r < 9; r++) {
      const idx = r * 9 + c;
      const v = values[idx];
      if (v === 0) continue;
      if (seen.has(v)) {
        conflicts.add(idx);
        conflicts.add(seen.get(v));
      } else seen.set(v, idx);
    }
  }
  // box
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Map();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const rr = br * 3 + r;
          const cc = bc * 3 + c;
          const idx = rr * 9 + cc;
          const v = values[idx];
          if (v === 0) continue;
          if (seen.has(v)) {
            conflicts.add(idx);
            conflicts.add(seen.get(v));
          } else seen.set(v, idx);
        }
      }
    }
  }

  for (const idx of conflicts) {
    gridEl.children[idx].classList.add("conflict");
  }
}

function countConflicts() {
  const p = state.puzzles[state.active];
  const values = getCurrentValues(p);
  let count = 0;

  const countLine = (idxs) => {
    const seen = new Set();
    for (const i of idxs) {
      const v = values[i];
      if (v === 0) continue;
      if (seen.has(v)) count++;
      else seen.add(v);
    }
  };

  for (let r = 0; r < 9; r++) {
    countLine([...Array(9)].map((_, c) => r * 9 + c));
  }
  for (let c = 0; c < 9; c++) {
    countLine([...Array(9)].map((_, r) => r * 9 + c));
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const idxs = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          idxs.push((br * 3 + r) * 9 + (bc * 3 + c));
      countLine(idxs);
    }
  }
  return count;
}

// ---------- Solved / reveal ----------
function isSolved() {
  const p = state.puzzles[state.active];
  const values = getCurrentValues(p);

  for (const v of values) if (v === 0) return false;
  for (let i = 0; i < 81; i++) {
    if (values[i] !== p.solution[i]) return false;
  }
  return true;
}

function maybeSolved() {
  if (isSolved()) {
    revealMessageWithDelay(4);
  }
}

function revealMessageWithDelay(seconds) {
  const p = state.puzzles[state.active];
  if (p.revealed || p.pendingReveal) return;

  cancelRevealTimers(); // just in case
  p.pendingReveal = true;

  setInputsDisabled(true);

  let left = seconds;
  showToast(`Solved! Revealing in ${left}s...`, true);

  revealCountdownInterval = setInterval(() => {
    left--;
    if (left > 0) showToast(`Solved! Revealing in ${left}s...`, true);
  }, 1000);

  revealTimeout = setTimeout(() => {
    if (revealCountdownInterval) clearInterval(revealCountdownInterval);
    revealCountdownInterval = null;
    revealTimeout = null;

    p.pendingReveal = false;
    p.revealed = true;

    setInputsDisabled(false);
    openModal(MESSAGES[state.active]);
    showToast("Solved!", true);
  }, seconds * 1000);
}

// ---------- Sudoku generation ----------
function generateIntoActive(diff) {
  cancelRevealTimers();

  const clues = difficultyToClues[diff] ?? 32;

  const full = new Array(81).fill(0);
  fillGrid(full);

  const puzzle = full.slice();
  carvePuzzle(puzzle, clues);

  const p = state.puzzles[state.active];
  p.solution = full.slice();
  p.given = puzzle.slice();
  p.entries = new Array(81).fill(0);
  p.pencil = Array.from({ length: 81 }, () => new Set());
  p.revealed = false;
  p.pendingReveal = false;

  selectedIndex = -1;
  render();
  refreshConflicts();
}

function generateBoth(diff) {
  for (let k = 0; k < 2; k++) {
    state.active = k;
    generateIntoActive(diff);
  }
  state.active = 0;
  setActiveTab(0);
}

function fillGrid(grid) {
  const idx = grid.indexOf(0);
  if (idx === -1) return true;

  const nums = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const n of nums) {
    if (isValidMove(grid, idx, n)) {
      grid[idx] = n;
      if (fillGrid(grid)) return true;
      grid[idx] = 0;
    }
  }
  return false;
}

function carvePuzzle(puzzle, cluesTarget) {
  const idxs = shuffled([...Array(81).keys()]);
  let filled = puzzle.filter((v) => v !== 0).length;

  for (const idx of idxs) {
    if (filled <= cluesTarget) break;

    const backup = puzzle[idx];
    puzzle[idx] = 0;

    // count solutions up to 2 (keep unique)
    const count = countSolutions(puzzle.slice(), 2);
    if (count !== 1) {
      puzzle[idx] = backup;
    } else {
      filled--;
    }
  }
}

function countSolutions(grid, limit = 2) {
  const idx = grid.indexOf(0);
  if (idx === -1) return 1;

  let count = 0;
  for (let n = 1; n <= 9; n++) {
    if (isValidMove(grid, idx, n)) {
      grid[idx] = n;
      count += countSolutions(grid, limit);
      grid[idx] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}

function isValidMove(grid, idx, n) {
  const r = Math.floor(idx / 9);
  const c = idx % 9;

  for (let cc = 0; cc < 9; cc++) {
    if (grid[r * 9 + cc] === n) return false;
  }
  for (let rr = 0; rr < 9; rr++) {
    if (grid[rr * 9 + c] === n) return false;
  }

  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = 0; rr < 3; rr++) {
    for (let cc = 0; cc < 3; cc++) {
      if (grid[(br + rr) * 9 + (bc + cc)] === n) return false;
    }
  }
  return true;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Tabs + controls ----------
function setActiveTab(idx) {
  cancelRevealTimers();

  state.active = idx;
  tab1.classList.toggle("active", idx === 0);
  tab2.classList.toggle("active", idx === 1);
  tab1.setAttribute("aria-selected", idx === 0 ? "true" : "false");
  tab2.setAttribute("aria-selected", idx === 1 ? "true" : "false");

  puzzleBadge.textContent = idx === 0 ? "Puzzle 1" : "Puzzle 2";

  selectedIndex = -1;
  render();
  refreshConflicts();
}

tab1.addEventListener("click", () => setActiveTab(0));
tab2.addEventListener("click", () => setActiveTab(1));

difficultySel.addEventListener("change", () => {
  state.settings.difficulty = difficultySel.value;
});

autoCheckEl.addEventListener("change", () => {
  state.settings.autoCheck = autoCheckEl.checked;
  refreshConflicts();
});

pencilModeEl.addEventListener("change", () => {
  state.settings.pencilMode = pencilModeEl.checked;
  showToast(state.settings.pencilMode ? "Pencil mode on" : "Pencil mode off");
});

newPuzzleBtn.addEventListener("click", () => {
  generateIntoActive(state.settings.difficulty);
  showToast(`New ${state.settings.difficulty} puzzle created`);
});

clearBtn.addEventListener("click", () => {
  cancelRevealTimers();

  const p = state.puzzles[state.active];
  for (let i = 0; i < 81; i++) {
    if (p.given[i] === 0) {
      p.entries[i] = 0;
      p.pencil[i].clear();
    }
  }
  render();
  refreshConflicts();
  showToast("Cleared your entries");
});

checkBtn.addEventListener("click", () => {
  if (isSolved()) {
    revealMessageWithDelay(4);
    return;
  }
  const conflicts = countConflicts();
  if (conflicts > 0)
    showToast(`Not solved yet (${conflicts} conflict${conflicts === 1 ? "" : "s"})`, false);
  else showToast("Not solved yet (no conflicts so far)", false);
});

solveBtn.addEventListener("click", () => {
  const pw = prompt("Enter password to show the solution:");
  if (pw !== SOLUTION_PASSWORD) {
    showToast("Wrong password 😅", false);
    return;
  }

  const p = state.puzzles[state.active];
  for (let i = 0; i < 81; i++) {
    if (p.given[i] === 0) p.entries[i] = p.solution[i];
    p.pencil[i].clear();
  }
  render();
  refreshConflicts();
  // (optional) don't auto-reveal the message here:
  // revealWithDelay(4);
  revealMessageWithDelay(4);
});

// ---------- Init ----------
function init() {
  state.settings.difficulty = difficultySel.value;
  state.settings.autoCheck = autoCheckEl.checked;
  state.settings.pencilMode = pencilModeEl.checked;

  buildGridOnce();
  generateBoth(state.settings.difficulty);
  setActiveTab(0);
}

init();
