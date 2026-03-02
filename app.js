/* Sudoku Surprise - two puzzles, difficulty selector, reveal message on solve.
   Pure static JS (GitHub Pages friendly).
*/

const PUZZLES = [
  { id: 1, message: "I love you" },
  { id: 2, message: "Will you marry me" },
];

const difficultyToClues = {
  // approximate clue counts (higher = easier)
  easy: 40,
  medium: 32,
  hard: 26,
  expert: 22,
};

const state = {
  activePuzzleIndex: 0, // 0 or 1
  puzzles: [
    makeEmptyPuzzleState(),
    makeEmptyPuzzleState(),
  ],
  settings: {
    difficulty: "medium",
    autoCheck: true,
    pencilMode: false,
  }
};

function makeEmptyPuzzleState(){
  return {
    given: new Array(81).fill(0),
    solution: new Array(81).fill(0),
    entries: new Array(81).fill(0),
    pencil: Array.from({length:81}, ()=> new Set()),
    revealed: false,
  };
}

// ---------- DOM ----------
const tab1 = document.getElementById("tab1");
const tab2 = document.getElementById("tab2");
const panel1 = document.getElementById("panel1");
const panel2 = document.getElementById("panel2");
const grid1 = document.getElementById("grid");
const grid2 = document.getElementById("grid2");

const difficultySel = document.getElementById("difficulty");
const newPuzzleBtn = document.getElementById("newPuzzleBtn");
const checkBtn = document.getElementById("checkBtn");
const solveBtn = document.getElementById("solveBtn");
const clearBtn = document.getElementById("clearBtn");
const autoCheck = document.getElementById("autoCheck");
const pencilMode = document.getElementById("pencilMode");

const toast = document.getElementById("toast");
const modal = document.getElementById("modal");
const modalMsg = document.getElementById("modalMsg");
const modalClose = document.getElementById("modalClose");

let selectedIndex = -1;

// ---------- UI helpers ----------
function showToast(msg, ok=true){
  toast.textContent = msg;
  toast.style.borderColor = ok ? "rgba(67,211,125,.55)" : "rgba(255,92,122,.55)";
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1400);
}

function openModal(message){
  modalMsg.textContent = message;
  modal.classList.remove("hidden");
}

function closeModal(){
  modal.classList.add("hidden");
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

// ---------- Build grids ----------
function buildGrid(container, puzzleIndex){
  container.innerHTML = "";
  for(let i=0;i<81;i++){
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.idx = String(i);
    cell.dataset.puzzle = String(puzzleIndex);

    const input = document.createElement("input");
    input.inputMode = "numeric";
    input.maxLength = 1;
    input.autocomplete = "off";
    input.spellcheck = false;

    const pencil = document.createElement("div");
    pencil.className = "pencil";
    for(let k=1;k<=9;k++){
      const s = document.createElement("span");
      s.textContent = "";
      s.dataset.n = String(k);
      pencil.appendChild(s);
    }

    cell.appendChild(input);
    cell.appendChild(pencil);
    container.appendChild(cell);

    // events
    cell.addEventListener("click", ()=>selectCell(puzzleIndex, i));
    input.addEventListener("focus", ()=>selectCell(puzzleIndex, i));
    input.addEventListener("keydown", (e)=>onKeyDown(e, puzzleIndex, i));
    input.addEventListener("input", (e)=>onInput(e, puzzleIndex, i));
  }
}

buildGrid(grid1, 0);
buildGrid(grid2, 1);

// ---------- Selection ----------
function selectCell(puzzleIndex, idx){
  // If user clicks a grid that's not active, switch tabs
  if(state.activePuzzleIndex !== puzzleIndex){
    setActivePuzzle(puzzleIndex);
  }

  selectedIndex = idx;
  refreshUI();
  const activeGrid = state.activePuzzleIndex === 0 ? grid1 : grid2;
  const el = activeGrid.querySelector(`.cell[data-idx="${idx}"] input`);
  if(el) el.focus();
}

// ---------- Input handlers ----------
function onKeyDown(e, puzzleIndex, idx){
  const p = state.puzzles[puzzleIndex];

  // block editing givens
  if(p.given[idx] !== 0){
    // allow navigation
  }

  const key = e.key;

  // navigation
  const move = (delta)=>{
    e.preventDefault();
    let n = idx + delta;
    if(n < 0) n = 0;
    if(n > 80) n = 80;
    selectCell(puzzleIndex, n);
  };

  if(key === "ArrowLeft") return move(-1);
  if(key === "ArrowRight") return move(1);
  if(key === "ArrowUp") return move(-9);
  if(key === "ArrowDown") return move(9);

  if(key === "Backspace" || key === "Delete"){
    e.preventDefault();
    if(p.given[idx] !== 0) return;
    if(state.settings.pencilMode){
      p.pencil[idx].clear();
    } else {
      p.entries[idx] = 0;
      p.pencil[idx].clear();
    }
    refreshUI();
    if(state.settings.autoCheck) refreshConflicts();
    return;
  }

  // digits 1-9
  if(/^[1-9]$/.test(key)){
    e.preventDefault();
    const n = Number(key);
    if(p.given[idx] !== 0) return;

    if(state.settings.pencilMode){
      if(p.pencil[idx].has(n)) p.pencil[idx].delete(n);
      else p.pencil[idx].add(n);
    } else {
      p.entries[idx] = n;
      p.pencil[idx].clear();
    }

    refreshUI();
    if(state.settings.autoCheck) refreshConflicts();
    maybeSolved(puzzleIndex);
  }
}

function onInput(e, puzzleIndex, idx){
  // mobile IME / paste safety
  const p = state.puzzles[puzzleIndex];
  if(p.given[idx] !== 0){
    e.target.value = String(p.given[idx]);
    return;
  }
  const v = (e.target.value || "").trim();
  if(!/^[1-9]$/.test(v)){
    e.target.value = "";
    return;
  }

  const n = Number(v);
  if(state.settings.pencilMode){
    // convert typed input to pencil add
    e.target.value = "";
    if(p.pencil[idx].has(n)) p.pencil[idx].delete(n);
    else p.pencil[idx].add(n);
  } else {
    p.entries[idx] = n;
    p.pencil[idx].clear();
  }

  refreshUI();
  if(state.settings.autoCheck) refreshConflicts();
  maybeSolved(puzzleIndex);
}

// ---------- Tab handling ----------
function setActivePuzzle(index){
  state.activePuzzleIndex = index;

  tab1.classList.toggle("active", index===0);
  tab2.classList.toggle("active", index===1);
  tab1.setAttribute("aria-selected", index===0 ? "true":"false");
  tab2.setAttribute("aria-selected", index===1 ? "true":"false");

  panel1.classList.toggle("hidden", index!==0);
  panel2.classList.toggle("hidden", index!==1);

  selectedIndex = -1;
  refreshUI();
  if(state.settings.autoCheck) refreshConflicts();
}

tab1.addEventListener("click", ()=>setActivePuzzle(0));
tab2.addEventListener("click", ()=>setActivePuzzle(1));

// ---------- Controls ----------
difficultySel.addEventListener("change", ()=>{
  state.settings.difficulty = difficultySel.value;
});

autoCheck.addEventListener("change", ()=>{
  state.settings.autoCheck = autoCheck.checked;
  refreshConflicts();
});

pencilMode.addEventListener("change", ()=>{
  state.settings.pencilMode = pencilMode.checked;
  showToast(state.settings.pencilMode ? "Pencil mode on" : "Pencil mode off");
});

newPuzzleBtn.addEventListener("click", ()=>{
  const diff = state.settings.difficulty;
  generateInto(state.activePuzzleIndex, diff);
  showToast(`New ${diff} puzzle created`);
});

clearBtn.addEventListener("click", ()=>{
  const p = state.puzzles[state.activePuzzleIndex];
  for(let i=0;i<81;i++){
    if(p.given[i]===0){
      p.entries[i]=0;
      p.pencil[i].clear();
    }
  }
  refreshUI();
  refreshConflicts();
  showToast("Cleared your entries");
});

checkBtn.addEventListener("click", ()=>{
  const ok = isSolved(state.activePuzzleIndex);
  if(ok){
    revealMessage(state.activePuzzleIndex);
  } else {
    const conflicts = countConflicts(state.activePuzzleIndex);
    if(conflicts > 0) showToast(`Not solved yet (${conflicts} conflict${conflicts===1?"":"s"})`, false);
    else showToast("Not solved yet (no conflicts so far)", false);
  }
});

solveBtn.addEventListener("click", ()=>{
  const p = state.puzzles[state.activePuzzleIndex];
  // fill all entries to solution
  for(let i=0;i<81;i++){
    if(p.given[i]===0) p.entries[i] = p.solution[i];
    p.pencil[i].clear();
  }
  refreshUI();
  refreshConflicts();
  revealMessage(state.activePuzzleIndex);
});

// ---------- Render ----------
function refreshUI(){
  renderGrid(0, grid1);
  renderGrid(1, grid2);
}

function renderGrid(puzzleIndex, container){
  const p = state.puzzles[puzzleIndex];
  const isActive = (state.activePuzzleIndex === puzzleIndex);

  for(let i=0;i<81;i++){
    const cell = container.children[i];
    const input = cell.querySelector("input");
    const pencil = cell.querySelector(".pencil");

    const givenVal = p.given[i];
    const entryVal = p.entries[i];

    cell.classList.toggle("given", givenVal !== 0);
    cell.classList.toggle("selected", isActive && i === selectedIndex);

    // value
    if(givenVal !== 0){
      input.value = String(givenVal);
      input.disabled = true;
    } else {
      input.disabled = false;
      input.value = entryVal === 0 ? "" : String(entryVal);
    }

    // pencil marks
    const set = p.pencil[i];
    for(const span of pencil.children){
      const n = Number(span.dataset.n);
      span.textContent = (givenVal===0 && entryVal===0 && set.has(n)) ? String(n) : "";
    }
  }
}

// ---------- Conflict checking ----------
function refreshConflicts(){
  // clear all
  const grids = [grid1, grid2];
  for(const g of grids){
    for(const cell of g.children) cell.classList.remove("conflict");
  }
  if(!state.settings.autoCheck) return;

  markConflicts(0, grid1);
  markConflicts(1, grid2);
}

function markConflicts(puzzleIndex, container){
  const p = state.puzzles[puzzleIndex];
  const values = getCurrentValues(p);

  const conflicts = new Set();

  // rows
  for(let r=0;r<9;r++){
    const seen = new Map();
    for(let c=0;c<9;c++){
      const idx = r*9+c;
      const v = values[idx];
      if(v===0) continue;
      if(seen.has(v)){
        conflicts.add(idx);
        conflicts.add(seen.get(v));
      } else seen.set(v, idx);
    }
  }

  // cols
  for(let c=0;c<9;c++){
    const seen = new Map();
    for(let r=0;r<9;r++){
      const idx = r*9+c;
      const v = values[idx];
      if(v===0) continue;
      if(seen.has(v)){
        conflicts.add(idx);
        conflicts.add(seen.get(v));
      } else seen.set(v, idx);
    }
  }

  // boxes
  for(let br=0;br<3;br++){
    for(let bc=0;bc<3;bc++){
      const seen = new Map();
      for(let r=0;r<3;r++){
        for(let c=0;c<3;c++){
          const rr = br*3+r;
          const cc = bc*3+c;
          const idx = rr*9+cc;
          const v = values[idx];
          if(v===0) continue;
          if(seen.has(v)){
            conflicts.add(idx);
            conflicts.add(seen.get(v));
          } else seen.set(v, idx);
        }
      }
    }
  }

  for(const idx of conflicts){
    container.children[idx].classList.add("conflict");
  }
}

function countConflicts(puzzleIndex){
  const p = state.puzzles[puzzleIndex];
  const values = getCurrentValues(p);

  let count = 0;

  // rows
  for(let r=0;r<9;r++){
    const seen = new Map();
    for(let c=0;c<9;c++){
      const idx = r*9+c;
      const v = values[idx];
      if(v===0) continue;
      if(seen.has(v)) count++;
      else seen.set(v, idx);
    }
  }
  // cols
  for(let c=0;c<9;c++){
    const seen = new Map();
    for(let r=0;r<9;r++){
      const idx = r*9+c;
      const v = values[idx];
      if(v===0) continue;
      if(seen.has(v)) count++;
      else seen.set(v, idx);
    }
  }
  // boxes
  for(let br=0;br<3;br++){
    for(let bc=0;bc<3;bc++){
      const seen = new Map();
      for(let r=0;r<3;r++){
        for(let c=0;c<3;c++){
          const rr = br*3+r;
          const cc = bc*3+c;
          const idx = rr*9+cc;
          const v = values[idx];
          if(v===0) continue;
          if(seen.has(v)) count++;
          else seen.set(v, idx);
        }
      }
    }
  }
  return count;
}

// ---------- Solve/reveal ----------
function getCurrentValues(p){
  // givens override entries
  const arr = new Array(81);
  for(let i=0;i<81;i++){
    arr[i] = p.given[i] !== 0 ? p.given[i] : p.entries[i];
  }
  return arr;
}

function isSolved(puzzleIndex){
  const p = state.puzzles[puzzleIndex];
  const values = getCurrentValues(p);

  // all filled?
  for(const v of values) if(v===0) return false;

  // must match solution exactly
  for(let i=0;i<81;i++){
    if(values[i] !== p.solution[i]) return false;
  }
  return true;
}

function maybeSolved(puzzleIndex){
  if(isSolved(puzzleIndex)){
    revealMessage(puzzleIndex);
  }
}

function revealMessage(puzzleIndex){
  const p = state.puzzles[puzzleIndex];
  if(p.revealed) return;
  p.revealed = true;

  const message = PUZZLES[puzzleIndex].message;
  openModal(message);
  showToast("Solved!", true);
}

// ---------- Sudoku generation (backtracking + unique-ish removal) ----------
function generateInto(puzzleIndex, difficulty){
  const clues = difficultyToClues[difficulty] ?? 32;

  // 1) Create a full solved grid
  const full = new Array(81).fill(0);
  fillGrid(full);

  // 2) Remove numbers to create puzzle
  const puzzle = full.slice();
  carvePuzzle(puzzle, clues);

  // 3) Store
  const p = state.puzzles[puzzleIndex];
  p.solution = full.slice();
  p.given = puzzle.slice();
  p.entries = new Array(81).fill(0);
  p.pencil = Array.from({length:81}, ()=> new Set());
  p.revealed = false;

  selectedIndex = -1;
  refreshUI();
  refreshConflicts();
}

// Fill full grid with a valid solution (randomised backtracking)
function fillGrid(grid){
  const empties = findEmpty(grid);
  if(empties === -1) return true;

  const nums = shuffled([1,2,3,4,5,6,7,8,9]);
  for(const n of nums){
    if(isValidMove(grid, empties, n)){
      grid[empties] = n;
      if(fillGrid(grid)) return true;
      grid[empties] = 0;
    }
  }
  return false;
}

function carvePuzzle(puzzle, cluesTarget){
  // remove cells in random order while trying to keep a unique solution (light check)
  const idxs = shuffled([...Array(81).keys()]);
  let filled = puzzle.filter(v=>v!==0).length;

  for(const idx of idxs){
    if(filled <= cluesTarget) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;

    // Ensure still solvable + (attempt) uniqueness by counting solutions up to 2
    const count = countSolutions(puzzle.slice(), 2);
    if(count !== 1){
      puzzle[idx] = backup; // revert
    } else {
      filled--;
    }
  }
}

function countSolutions(grid, limit=2){
  const idx = findEmpty(grid);
  if(idx === -1) return 1;

  let count = 0;
  for(const n of [1,2,3,4,5,6,7,8,9]){
    if(isValidMove(grid, idx, n)){
      grid[idx] = n;
      count += countSolutions(grid, limit);
      grid[idx] = 0;
      if(count >= limit) return count;
    }
  }
  return count;
}

function findEmpty(grid){
  for(let i=0;i<81;i++){
    if(grid[i] === 0) return i;
  }
  return -1;
}

function isValidMove(grid, idx, n){
  const r = Math.floor(idx/9);
  const c = idx%9;

  // row
  for(let cc=0;cc<9;cc++){
    if(grid[r*9+cc] === n) return false;
  }
  // col
  for(let rr=0;rr<9;rr++){
    if(grid[rr*9+c] === n) return false;
  }
  // box
  const br = Math.floor(r/3)*3;
  const bc = Math.floor(c/3)*3;
  for(let rr=0;rr<3;rr++){
    for(let cc=0;cc<3;cc++){
      if(grid[(br+rr)*9 + (bc+cc)] === n) return false;
    }
  }
  return true;
}

function shuffled(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// ---------- Init ----------
function init(){
  difficultySel.value = state.settings.difficulty;
  autoCheck.checked = state.settings.autoCheck;
  pencilMode.checked = state.settings.pencilMode;

  // generate both at start using selected difficulty
  generateInto(0, state.settings.difficulty);
  generateInto(1, state.settings.difficulty);

  setActivePuzzle(0);
}
init();
