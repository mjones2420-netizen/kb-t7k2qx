// ---- EMOM Timer ----
// Single exercise. Pick reps/minute + total minutes.
// Per-minute countdown, 3-2-1 warning beeps + start beep, auto rep tally.

const $ = (id) => document.getElementById(id);

const els = {
  setup: $("setup"), running: $("running"), done: $("done"),
  reps: $("reps"), minutes: $("minutes"),
  startBtn: $("startBtn"), pauseBtn: $("pauseBtn"),
  resetBtn: $("resetBtn"), againBtn: $("againBtn"),
  roundNow: $("roundNow"), roundTotal: $("roundTotal"),
  countdown: $("countdown"), totalReps: $("totalReps"),
  repTarget: $("repTarget"), finalReps: $("finalReps"),
};

const SECONDS_PER_ROUND = 60;

let state = {
  repsPerMin: 10,
  totalMinutes: 10,
  currentRound: 1,
  running: false,
  startTime: 0,      // Date.now() when this round's clock started
  pausedAt: 0,       // seconds already elapsed in current round when paused
  ticker: null,
  lastBeepSecond: -1,
};

// ---- Audio (Web Audio API, no files) ----
let audioCtx = null;
function unlockAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function beep(freq, durationMs, gainVal = 0.15) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = gainVal;
  osc.connect(gain).connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  osc.start(now);
  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.stop(now + durationMs / 1000);
}
const warnBeep = () => beep(600, 120);        // 3-2-1 warning
const startBeep = () => beep(900, 280, 0.2);  // minute start

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ---- Screens ----
function show(name) {
  [els.setup, els.running, els.done].forEach((s) => s.classList.remove("active"));
  els[name].classList.add("active");
}

// ---- Display ----
function render(secondsLeft) {
  els.countdown.textContent = secondsLeft;
  els.countdown.classList.toggle("warn", secondsLeft <= 3 && secondsLeft > 0);
  els.countdown.classList.toggle("go", secondsLeft === SECONDS_PER_ROUND);
  els.roundNow.textContent = state.currentRound;
  els.totalReps.textContent = state.repsPerMin * (state.currentRound - 1);
}

// ---- Core loop ----
function tick() {
  const elapsed = (Date.now() - state.startTime) / 1000;
  const secondsLeft = Math.ceil(SECONDS_PER_ROUND - elapsed);

  if (secondsLeft <= 0) {
    // Minute rolled over
    state.currentRound++;
    if (state.currentRound > state.totalMinutes) return finish();
    state.startTime = Date.now();
    state.lastBeepSecond = -1;
    startBeep();
    vibrate(200);
    render(SECONDS_PER_ROUND);
    return;
  }

  // 3-2-1 warning beeps (once each)
  if (secondsLeft <= 3 && secondsLeft !== state.lastBeepSecond) {
    warnBeep();
    vibrate(80);
    state.lastBeepSecond = secondsLeft;
  }
  render(secondsLeft);
}

function startTicker() {
  state.ticker = setInterval(tick, 100); // 100ms for snappy display + beep timing
}
function stopTicker() {
  clearInterval(state.ticker);
  state.ticker = null;
}

function begin() {
  unlockAudio();
  state.repsPerMin = Math.max(1, parseInt(els.reps.value, 10) || 1);
  state.totalMinutes = Math.max(1, parseInt(els.minutes.value, 10) || 1);
  state.currentRound = 1;
  state.startTime = Date.now();
  state.lastBeepSecond = -1;
  state.running = true;
  els.roundTotal.textContent = state.totalMinutes;
  els.repTarget.textContent = state.repsPerMin;
  els.pauseBtn.textContent = "Pause";
  show("running");
  render(SECONDS_PER_ROUND);
  startBeep();
  startTicker();
}

function togglePause() {
  if (state.running) {
    stopTicker();
    state.pausedAt = (Date.now() - state.startTime) / 1000;
    state.running = false;
    els.pauseBtn.textContent = "Resume";
  } else {
    state.startTime = Date.now() - state.pausedAt * 1000;
    state.running = true;
    els.pauseBtn.textContent = "Pause";
    startTicker();
  }
}

function reset() {
  stopTicker();
  state.running = false;
  show("setup");
}

function finish() {
  stopTicker();
  state.running = false;
  els.finalReps.textContent = state.repsPerMin * state.totalMinutes;
  show("done");
}

// ---- Events ----
els.startBtn.addEventListener("click", begin);
els.pauseBtn.addEventListener("click", togglePause);
els.resetBtn.addEventListener("click", reset);
els.againBtn.addEventListener("click", () => show("setup"));

// ---- Service worker (PWA) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
