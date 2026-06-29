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
const COUNTDOWN_SECONDS = 5;

let state = {
  repsPerMin: 10,
  totalMinutes: 10,
  currentRound: 1,
  running: false,
  startTime: 0,      // Date.now() when this round's clock started
  pausedAt: 0,       // seconds already elapsed in current round when paused
  ticker: null,
  lastBeepSecond: -1,
  countingDown: false,
  countdownStart: 0,
};

// ---- Wake Lock ----
let wakeLock = null;
async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.running) acquireWakeLock();
});

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

// ---- Get-ready countdown ----
function renderCountdown(n) {
  els.countdown.textContent = n;
  els.countdown.classList.remove("warn", "go");
  els.roundNow.textContent = "—";
  els.totalReps.textContent = "—";
}

function countdownTick() {
  const elapsed = (Date.now() - state.countdownStart) / 1000;
  const remaining = Math.ceil(COUNTDOWN_SECONDS - elapsed);
  if (remaining <= 0) {
    stopTicker();
    state.countingDown = false;
    state.startTime = Date.now();
    state.lastBeepSecond = -1;
    state.running = true;
    els.roundNow.textContent = state.currentRound;
    els.totalReps.textContent = 0;
    render(SECONDS_PER_ROUND);
    startBeep();
    vibrate(200);
    startTicker();
  } else {
    renderCountdown(remaining);
  }
}

function begin() {
  unlockAudio();
  acquireWakeLock();
  state.repsPerMin = Math.max(1, parseInt(els.reps.value, 10) || 1);
  state.totalMinutes = Math.max(1, parseInt(els.minutes.value, 10) || 1);
  state.currentRound = 1;
  state.lastBeepSecond = -1;
  state.running = false;
  state.countingDown = true;
  state.countdownStart = Date.now();
  els.roundTotal.textContent = state.totalMinutes;
  els.repTarget.textContent = state.repsPerMin;
  els.pauseBtn.textContent = "Pause";
  show("running");
  renderCountdown(COUNTDOWN_SECONDS);
  state.ticker = setInterval(countdownTick, 100);
}

function togglePause() {
  if (state.countingDown) {
    // Cancel countdown, go back to setup
    stopTicker();
    state.countingDown = false;
    releaseWakeLock();
    show("setup");
    return;
  }
  if (state.running) {
    stopTicker();
    state.pausedAt = (Date.now() - state.startTime) / 1000;
    state.running = false;
    els.pauseBtn.textContent = "Resume";
  } else {
    state.startTime = Date.now() - state.pausedAt * 1000;
    state.running = true;
    els.pauseBtn.textContent = "Pause";
    acquireWakeLock();
    startTicker();
  }
}

function reset() {
  stopTicker();
  state.running = false;
  state.countingDown = false;
  releaseWakeLock();
  show("setup");
}

function finish() {
  stopTicker();
  state.running = false;
  releaseWakeLock();
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
