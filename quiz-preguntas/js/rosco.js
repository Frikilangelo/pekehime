(function () {
  "use strict";

  const loaded = window.PEKEHIME_SESSION.load();
  if (!loaded) {
    window.location.href = "index.html";
    return;
  }

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const ROSCO_FIRST_LAP_TIME_SEC = 30;
  const ROSCO_LATER_LAP_TIME_SEC = 15;

  const QUIZ_TOTAL = Math.min(10, Array.isArray(window.QUIZ_QUESTIONS) ? window.QUIZ_QUESTIONS.length : 0);
  const PRICE_TOTAL = Math.min(10, Array.isArray(window.PRICE_QUESTIONS) ? window.PRICE_QUESTIONS.length : 0);
  const HANGMAN_TOTAL = Math.min(5, Array.isArray(window.HANGMAN_WORDS) ? window.HANGMAN_WORDS.length : 0);
  const ELECTION_TOTAL = Math.min(
    loaded.length,
    Array.isArray(window.ELECTION_QUESTIONS) ? window.ELECTION_QUESTIONS.length : 0
  );

  let participants = loaded.map(function (p) {
    return {
      name: p.name,
      score: Number(p.score) || 0,
      priceScore: Number(p.priceScore) || 0,
      hangmanScore: Number(p.hangmanScore) || 0,
      electionScore: Number(p.electionScore) || 0,
      roscoScore: Number(p.roscoScore) || 0,
    };
  });

  const letterBank = buildLetterQueue();
  if (!letterBank.length) {
    document.querySelector(".main").innerHTML =
      '<p class="card">No hay letras para el rosco. Revisa <code>js/questions.js</code> (ROSCO_LETTERS).</p>';
    return;
  }

  const elHeader = document.querySelector(".header");
  const elIntro = document.getElementById("rosco-intro-screen");
  const elScreen = document.getElementById("rosco-screen");
  const elResults = document.getElementById("results-screen");
  const elBtnIntroContinue = document.getElementById("btn-rosco-intro-continue");
  const elScoreboard = document.getElementById("rosco-scoreboard");
  const elLetterIndex = document.getElementById("rosco-letter-index");
  const elPlayerLabel = document.getElementById("rosco-player-label");
  const elTimerBlock = document.getElementById("rosco-timer-block");
  const elTimerMessage = document.getElementById("rosco-timer-message");
  const elTimerCount = document.getElementById("rosco-timer-count");
  const elTimerBarFill = document.getElementById("rosco-timer-bar-fill");
  const elWheel = document.getElementById("rosco-wheel");
  const elClueText = document.getElementById("rosco-clue-text");
  const elHintBlock = document.getElementById("rosco-hint-block");
  const elHintText = document.getElementById("rosco-hint-text");
  const elAnswerInput = document.getElementById("rosco-answer-input");
  const elBtnConfirm = document.getElementById("btn-rosco-confirm");
  const elBtnPass = document.getElementById("btn-rosco-pass");
  const elFeedback = document.getElementById("rosco-feedback");
  const elResultsBoard = document.getElementById("results-board");
  const elScoreTotal = document.getElementById("score-total");
  const elBtnRestart = document.getElementById("btn-restart");
  const elResultsEntrefaseVideo = document.getElementById("results-entrefase-video");
  if (elResultsEntrefaseVideo) {
    elResultsEntrefaseVideo.defaultMuted = false;
    elResultsEntrefaseVideo.muted = false;
    elResultsEntrefaseVideo.addEventListener("play", function () {
      elResultsEntrefaseVideo.muted = false;
      if (elResultsEntrefaseVideo.volume < 0.01) elResultsEntrefaseVideo.volume = 1;
    });
  }
  const elRoscoIntroMusic = document.getElementById("rosco-intro-music");
  if (elRoscoIntroMusic) elRoscoIntroMusic.volume = 0.3;
  const elRoscoBgMusic = document.getElementById("rosco-bg-music");
  if (elRoscoBgMusic) elRoscoBgMusic.volume = 0.12;
  const elRoscoResultsBgMusic = document.getElementById("rosco-results-bg-music");
  if (elRoscoResultsBgMusic) elRoscoResultsBgMusic.volume = 0.12;
  const elRoscoSfxGood = document.getElementById("rosco-sfx-good");
  if (elRoscoSfxGood) elRoscoSfxGood.volume = 0.8;
  const elRoscoSfxBad = document.getElementById("rosco-sfx-bad");
  if (elRoscoSfxBad) elRoscoSfxBad.volume = 0.8;

  let turnOrder = [];
  let turnPointer = 0;
  const letterQueue = letterBank.slice();
  let letterStates = letterQueue.map(function () {
    return "pending";
  });
  let pendingIndices = [];
  let queuePointer = 0;
  let roscoFinished = false;
  let turnTimerIntervalId = null;
  let turnSecondsLeft = ROSCO_FIRST_LAP_TIME_SEC;
  let currentTurnDurationSec = ROSCO_FIRST_LAP_TIME_SEC;
  let roscoLapNumber = 1;
  let introAudioUnlockBound = false;
  let introMusicHasPlayed = false;

  function getTurnDurationSec() {
    return roscoLapNumber <= 1 ? ROSCO_FIRST_LAP_TIME_SEC : ROSCO_LATER_LAP_TIME_SEC;
  }

  function updateRoscoHint(entry) {
    const showHint = roscoLapNumber >= 2 && entry && String(entry.hint || "").trim() !== "";
    if (elHintBlock) elHintBlock.classList.toggle("hidden", !showHint);
    if (showHint && elHintText) {
      elHintText.textContent = String(entry.hint).trim();
    } else if (elHintText) {
      elHintText.textContent = "";
    }
  }

  function buildLetterQueue() {
    const bank = Array.isArray(window.ROSCO_LETTERS) ? window.ROSCO_LETTERS : [];
    const byLetter = {};
    bank.forEach(function (entry) {
      if (!entry || typeof entry.letter !== "string") return;
      const key = entry.letter.trim().toUpperCase().charAt(0);
      if (!key || !/^[A-Z]$/.test(key)) return;
      if (!entry.clue || String(entry.clue).trim() === "") return;
      byLetter[key] = entry;
    });
    return ALPHABET.filter(function (letter) {
      return Boolean(byLetter[letter]);
    }).map(function (letter) {
      return byLetter[letter];
    });
  }

  function getScoreBeforeRosco(player) {
    return (
      Number(player.score || 0) +
      Number(player.priceScore || 0) +
      Number(player.hangmanScore || 0) +
      Number(player.electionScore || 0)
    );
  }

  function getCombinedScore(player) {
    return getScoreBeforeRosco(player) + Number(player.roscoScore || 0);
  }

  function getSortedIndicesByRanking() {
    return participants
      .map(function (_, idx) {
        return idx;
      })
      .sort(function (a, b) {
        const scoreDiff = getCombinedScore(participants[b]) - getCombinedScore(participants[a]);
        if (scoreDiff !== 0) return scoreDiff;
        return participants[a].name.localeCompare(participants[b].name);
      });
  }

  function buildTurnOrder() {
    return getSortedIndicesByRanking().reverse();
  }

  function getActivePlayerIndex() {
    if (!turnOrder.length) return 0;
    return turnOrder[turnPointer % turnOrder.length];
  }

  function normalizeText(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function isAnswerCorrect(entry, rawAnswer) {
    const normalizedResponse = normalizeText(rawAnswer);
    if (!normalizedResponse) return false;
    const accepted = Array.isArray(entry.answers) ? entry.answers : [];
    return accepted.some(function (candidate) {
      return normalizeText(candidate) === normalizedResponse;
    });
  }

  function clearTurnTimer() {
    if (turnTimerIntervalId !== null) {
      clearInterval(turnTimerIntervalId);
      turnTimerIntervalId = null;
    }
  }

  function updateTurnTimerVisuals() {
    if (!elTimerCount || !elTimerBarFill) return;
    elTimerCount.textContent = String(Math.max(0, turnSecondsLeft));
    const pct = (Math.max(0, turnSecondsLeft) / Math.max(1, currentTurnDurationSec)) * 100;
    elTimerBarFill.style.width = pct + "%";
    if (elScreen) {
      const lowTh = Math.ceil(currentTurnDurationSec * 0.5);
      const critTh = Math.ceil(currentTurnDurationSec * 0.25);
      elScreen.classList.toggle("timer-low", turnSecondsLeft <= lowTh && turnSecondsLeft > 0);
      elScreen.classList.toggle("timer-critical", turnSecondsLeft <= critTh && turnSecondsLeft > 0);
    }
  }

  function startTurnTimer() {
    clearTurnTimer();
    currentTurnDurationSec = getTurnDurationSec();
    turnSecondsLeft = currentTurnDurationSec;
    if (elTimerMessage) elTimerMessage.textContent = "Tiempo para responder";
    if (elTimerBlock) elTimerBlock.classList.remove("timer-expired");
    if (elScreen) elScreen.classList.remove("timer-low", "timer-critical");
    updateTurnTimerVisuals();

    turnTimerIntervalId = setInterval(function () {
      turnSecondsLeft -= 1;
      updateTurnTimerVisuals();
      if (turnSecondsLeft <= 0) {
        clearTurnTimer();
        onTurnTimeUp();
      }
    }, 1000);
  }

  function updateTurnLabel() {
    if (!elPlayerLabel) return;
    const player = participants[getActivePlayerIndex()];
    elPlayerLabel.textContent = "Turno de " + player.name;
  }

  function advanceTurn() {
    if (turnOrder.length > 1) {
      turnPointer = (turnPointer + 1) % turnOrder.length;
    }
  }

  function onTurnTimeUp() {
    if (roscoFinished || queuePointer >= pendingIndices.length) return;
    setInputEnabled(false);
    if (elFeedback) elFeedback.textContent = "Tiempo agotado (-1). La letra queda fallada (amarillo).";
    resolveAfterAttempt("wrong");
  }

  function playIntroMusicOnce() {
    if (!elRoscoIntroMusic || introMusicHasPlayed) return;
    if (elIntro && elIntro.classList.contains("hidden")) return;
    elRoscoIntroMusic.loop = false;
    elRoscoIntroMusic.muted = false;
    try {
      elRoscoIntroMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
    const maybePromise = elRoscoIntroMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") {
      introMusicHasPlayed = true;
      return;
    }
    maybePromise
      .then(function () {
        introMusicHasPlayed = true;
      })
      .catch(function () {});
  }

  function pauseIntroMusic() {
    if (!elRoscoIntroMusic) return;
    elRoscoIntroMusic.pause();
  }

  function tryPlayRoscoBgMusic() {
    if (!elRoscoBgMusic) return;
    if (elScreen && elScreen.classList.contains("hidden")) return;
    pauseIntroMusic();
    elRoscoBgMusic.loop = true;
    elRoscoBgMusic.muted = false;
    if (!elRoscoBgMusic.paused) return;
    const maybePromise = elRoscoBgMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function pauseRoscoBgMusic() {
    if (!elRoscoBgMusic) return;
    elRoscoBgMusic.pause();
    try {
      elRoscoBgMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
  }

  function tryPlayResultsBgMusic() {
    if (!elRoscoResultsBgMusic) return;
    if (!elResults || elResults.classList.contains("hidden")) return;
    pauseIntroMusic();
    pauseRoscoBgMusic();
    elRoscoResultsBgMusic.loop = true;
    elRoscoResultsBgMusic.muted = false;
    if (!elRoscoResultsBgMusic.paused) return;
    const maybePromise = elRoscoResultsBgMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function pauseResultsBgMusic() {
    if (!elRoscoResultsBgMusic) return;
    elRoscoResultsBgMusic.pause();
    try {
      elRoscoResultsBgMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
  }

  function stopResultsEntrefaseVideo() {
    if (!elResultsEntrefaseVideo) return;
    elResultsEntrefaseVideo.pause();
    try {
      elResultsEntrefaseVideo.currentTime = 0;
    } catch (err2) {
      /* ignore */
    }
    elResultsEntrefaseVideo.preload = "none";
  }

  function prepareResultsEntrefaseVideo() {
    if (!elResultsEntrefaseVideo) return;
    const v = elResultsEntrefaseVideo;
    v.preload = "auto";
    v.defaultMuted = false;
    v.muted = false;
    v.volume = 1;
    try {
      v.load();
    } catch (err) {
      /* ignore */
    }

    function startPlayback() {
      try {
        v.currentTime = 0;
      } catch (err3) {
        /* ignore */
      }
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(function () {
          v.muted = false;
        }).catch(function () {});
      }
    }

    function onCanPlay() {
      v.removeEventListener("canplay", onCanPlay);
      startPlayback();
    }
    v.addEventListener("canplay", onCanPlay);
    try {
      v.load();
    } catch (err4) {
      /* ignore */
    }
    if (v.readyState >= 2) {
      v.removeEventListener("canplay", onCanPlay);
      startPlayback();
    }
  }

  function playRoscoSfx(audioEl) {
    if (!audioEl) return;
    try {
      audioEl.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
    const maybePromise = audioEl.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function bindIntroAudioUnlock() {
    if (introAudioUnlockBound) return;
    introAudioUnlockBound = true;
    ["pointerdown", "keydown", "touchstart"].forEach(function (eventName) {
      window.addEventListener(
        eventName,
        function () {
          playIntroMusicOnce();
          tryPlayRoscoBgMusic();
        },
        { once: true, passive: true }
      );
    });
  }

  function renderScoreboard() {
    if (!elScoreboard) return;
    elScoreboard.innerHTML = "";
    participants
      .map(function (_, idx) {
        return idx;
      })
      .sort(function (a, b) {
        const scoreDiff = getCombinedScore(participants[b]) - getCombinedScore(participants[a]);
        if (scoreDiff !== 0) return scoreDiff;
        return participants[a].name.localeCompare(participants[b].name);
      })
      .forEach(function (participantIndex, rank) {
        const participant = participants[participantIndex];
        const li = document.createElement("li");
        li.className = "results-board-item";
        if (participantIndex === getActivePlayerIndex() && !roscoFinished) {
          li.classList.add("hangman-current-turn");
        }

        const name = document.createElement("span");
        name.className = "results-board-name";
        name.textContent = String(rank + 1) + ". " + participant.name;

        const score = document.createElement("strong");
        score.className = "results-board-score";
        score.textContent = String(getCombinedScore(participant));

        li.appendChild(name);
        li.appendChild(score);
        elScoreboard.appendChild(li);
      });
  }

  function renderRoscoWheel() {
    if (!elWheel) return;
    elWheel.innerHTML = "";
    letterQueue.forEach(function (entry, index) {
      const cell = document.createElement("div");
      const state = letterStates[index] || "pending";
      cell.className = "rosco-letter rosco-letter--" + state;
      cell.style.setProperty("--rosco-i", String(index));
      cell.textContent = entry.letter.toUpperCase();
      elWheel.appendChild(cell);
    });
  }

  function setInputEnabled(enabled) {
    if (elAnswerInput) elAnswerInput.disabled = !enabled;
    if (elBtnConfirm) elBtnConfirm.disabled = !enabled;
    if (elBtnPass) elBtnPass.disabled = !enabled;
  }

  function rebuildPendingIndices() {
    pendingIndices = [];
    for (let i = 0; i < letterQueue.length; i += 1) {
      if (letterStates[i] !== "correct") {
        pendingIndices.push(i);
      }
    }
  }

  function allLettersCorrect() {
    if (!letterStates.length) return false;
    return letterStates.every(function (state) {
      return state === "correct";
    });
  }

  function startPendingLap(feedbackMessage) {
    roscoLapNumber += 1;
    rebuildPendingIndices();
    queuePointer = 0;
    if (!pendingIndices.length) {
      finishRosco();
      return false;
    }
    if (feedbackMessage && elFeedback) {
      elFeedback.textContent = feedbackMessage;
    }
    return true;
  }

  function showCurrentLetter() {
    if (roscoFinished) return;
    if (queuePointer >= pendingIndices.length) {
      if (!startPendingLap("Nueva vuelta: solo letras pendientes.")) return;
    }

    const letterIndex = pendingIndices[queuePointer];
    const entry = letterQueue[letterIndex];
    letterStates[letterIndex] = "current";
    renderRoscoWheel();
    updateTurnLabel();
    renderScoreboard();

    if (elLetterIndex) elLetterIndex.textContent = "Letra " + entry.letter.toUpperCase();
    if (elClueText) elClueText.textContent = entry.clue || "";
    updateRoscoHint(entry);
    if (elAnswerInput) {
      elAnswerInput.value = "";
      elAnswerInput.disabled = false;
      elAnswerInput.focus();
    }
    setInputEnabled(true);
    startTurnTimer();
  }

  function resolveAfterAttempt(outcome) {
    if (roscoFinished || queuePointer >= pendingIndices.length) return;
    clearTurnTimer();
    const letterIndex = pendingIndices[queuePointer];
    const scoringPlayerIndex = getActivePlayerIndex();

    if (outcome === "correct") {
      playRoscoSfx(elRoscoSfxGood);
      letterStates[letterIndex] = "correct";
      participants[scoringPlayerIndex].roscoScore += 1;
    } else if (outcome === "wrong") {
      playRoscoSfx(elRoscoSfxBad);
      letterStates[letterIndex] = "failed";
      participants[scoringPlayerIndex].roscoScore -= 1;
    } else {
      letterStates[letterIndex] = "pending";
    }

    queuePointer += 1;
    advanceTurn();
    window.PEKEHIME_SESSION.save(participants);
    renderRoscoWheel();
    renderScoreboard();

    if (allLettersCorrect()) {
      if (elFeedback) elFeedback.textContent = "Rosco completado.";
      finishRosco();
      return;
    }

    if (queuePointer >= pendingIndices.length) {
      if (!startPendingLap("Nueva vuelta: solo letras pendientes.")) return;
    }

    showCurrentLetter();
  }

  function confirmAnswer() {
    if (roscoFinished || queuePointer >= pendingIndices.length) return;
    const letterIndex = pendingIndices[queuePointer];
    const entry = letterQueue[letterIndex];
    const raw = elAnswerInput ? elAnswerInput.value : "";
    if (!String(raw).trim()) {
      if (elFeedback) elFeedback.textContent = "Escribe una respuesta.";
      return;
    }

    setInputEnabled(false);
    const wasCorrect = isAnswerCorrect(entry, raw);
    if (elFeedback) {
      elFeedback.textContent = wasCorrect
        ? "Correcto (+1)."
        : "Incorrecto (-1). La letra queda fallada (amarillo).";
    }
    resolveAfterAttempt(wasCorrect ? "correct" : "wrong");
  }

  function passLetter() {
    if (roscoFinished || queuePointer >= pendingIndices.length) return;
    setInputEnabled(false);
    if (elFeedback) elFeedback.textContent = "Pasapalabra. Siguiente letra sin penalizacion.";
    resolveAfterAttempt("pass");
  }

  function showFinalResults() {
    clearTurnTimer();
    pauseRoscoBgMusic();
    roscoFinished = true;
    setInputEnabled(false);

    if (elHeader) elHeader.classList.add("hidden");
    elIntro.classList.add("hidden");
    elScreen.classList.add("hidden");
    elResults.classList.remove("hidden");
    tryPlayResultsBgMusic();
    prepareResultsEntrefaseVideo();

    if (elScoreTotal) {
      elScoreTotal.textContent = String(QUIZ_TOTAL + PRICE_TOTAL + HANGMAN_TOTAL + ELECTION_TOTAL + 1);
    }

    if (elResultsBoard) {
      elResultsBoard.innerHTML = "";
      participants
        .map(function (_, idx) {
          return idx;
        })
        .sort(function (a, b) {
          const scoreDiff = getCombinedScore(participants[b]) - getCombinedScore(participants[a]);
          if (scoreDiff !== 0) return scoreDiff;
          return participants[a].name.localeCompare(participants[b].name);
        })
        .forEach(function (participantIndex) {
          const participant = participants[participantIndex];
          const li = document.createElement("li");
          li.className = "results-board-item";

          const name = document.createElement("span");
          name.className = "results-board-name";
          name.textContent = participant.name;

          const score = document.createElement("strong");
          score.className = "results-board-score";
          score.textContent = String(getCombinedScore(participant));

          li.appendChild(name);
          li.appendChild(score);
          elResultsBoard.appendChild(li);
        });
    }
  }

  function finishRosco() {
    if (roscoFinished) return;
    clearTurnTimer();
    if (elScreen) elScreen.classList.remove("timer-low", "timer-critical");
    window.PEKEHIME_SESSION.save(participants);
    showFinalResults();
  }

  function beginRoscoSection() {
    pauseIntroMusic();
    if (elHeader) elHeader.classList.add("hidden");
    elIntro.classList.add("hidden");
    elResults.classList.add("hidden");
    elScreen.classList.remove("hidden");

    turnOrder = buildTurnOrder();
    turnPointer = 0;
    roscoLapNumber = 1;
    letterStates = letterQueue.map(function () {
      return "pending";
    });
    rebuildPendingIndices();
    queuePointer = 0;

    renderScoreboard();
    renderRoscoWheel();
    tryPlayRoscoBgMusic();
    showCurrentLetter();
  }

  elBtnIntroContinue.addEventListener("click", beginRoscoSection);
  elBtnConfirm.addEventListener("click", confirmAnswer);
  if (elBtnPass) elBtnPass.addEventListener("click", passLetter);
  elAnswerInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    confirmAnswer();
  });

  elBtnRestart.addEventListener("click", function () {
    pauseIntroMusic();
    pauseRoscoBgMusic();
    pauseResultsBgMusic();
    clearTurnTimer();
    window.PEKEHIME_SESSION.clear();
    window.location.href = "index.html";
  });

  window.addEventListener("load", function () {
    playIntroMusicOnce();
    bindIntroAudioUnlock();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (elResults && !elResults.classList.contains("hidden")) {
      tryPlayResultsBgMusic();
      return;
    }
    if (elScreen && !elScreen.classList.contains("hidden") && elRoscoBgMusic && elRoscoBgMusic.paused) {
      tryPlayRoscoBgMusic();
    }
  });

  window.addEventListener("pagehide", function () {
    pauseIntroMusic();
    pauseRoscoBgMusic();
    pauseResultsBgMusic();
    clearTurnTimer();
  });
})();
