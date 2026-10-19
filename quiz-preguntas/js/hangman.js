(function () {
  "use strict";

  const loaded = window.PEKEHIME_SESSION.load();
  if (!loaded) {
    window.location.href = "index.html";
    return;
  }

  const words = Array.isArray(window.HANGMAN_WORDS) ? window.HANGMAN_WORDS.slice(0, 5) : [];
  if (!words.length) {
    document.querySelector(".main").innerHTML =
      '<p class="card">No hay palabras para ahorcado. Revisa <code>js/questions.js</code> (HANGMAN_WORDS).</p>';
    return;
  }

  let participants = loaded.map(function (p) {
    return {
      name: p.name,
      score: Number(p.score) || 0,
      priceScore: Number(p.priceScore) || 0,
      hangmanScore: Number(p.hangmanScore) || 0,
    };
  });

  const QUIZ_TOTAL = Math.min(10, Array.isArray(window.QUIZ_QUESTIONS) ? window.QUIZ_QUESTIONS.length : 0);
  const PRICE_TOTAL = Math.min(10, Array.isArray(window.PRICE_QUESTIONS) ? window.PRICE_QUESTIONS.length : 0);
  const HANGMAN_TOTAL = words.length;
  const VIDEO_EXTENSIONS = ["mp4", "webm"];
  const HANGMAN_VIDEO_VOLUME = 1;
  const FIRST_TURN_TIME_SEC = 25;
  const FOLLOWING_TURN_TIME_SEC = 15;

  const elHeader = document.querySelector(".header");
  const elIntro = document.getElementById("hangman-intro-screen");
  const elScreen = document.getElementById("hangman-screen");
  const elResults = document.getElementById("results-screen");
  const elBtnIntroContinue = document.getElementById("btn-hangman-intro-continue");
  const elScoreboard = document.getElementById("hangman-scoreboard");
  const elWordIndex = document.getElementById("hangman-word-index");
  const elWordMask = document.getElementById("hangman-word-mask");
  const elUsedLetters = document.getElementById("hangman-used-letters");
  const elTurnLabel = document.getElementById("hangman-turn-label");
  const elLetterInput = document.getElementById("hangman-letter-input");
  const elFeedback = document.getElementById("hangman-feedback");
  const elBtnGuess = document.getElementById("btn-hangman-guess");
  const elBtnNextWord = document.getElementById("btn-hangman-next-word");
  const elTimerBlock = document.getElementById("hangman-timer-block");
  const elTimerMessage = document.getElementById("hangman-timer-message");
  const elTimerCount = document.getElementById("hangman-timer-count");
  const elTimerBarFill = document.getElementById("hangman-timer-bar-fill");
  const elHangmanVideo = document.getElementById("hangman-video");
  if (elHangmanVideo) {
    elHangmanVideo.addEventListener("play", function () {
      elHangmanVideo.muted = false;
      if (elHangmanVideo.volume < 0.01) elHangmanVideo.volume = HANGMAN_VIDEO_VOLUME;
    });
  }
  const elResultsBoard = document.getElementById("results-board");
  const elScoreTotal = document.getElementById("score-total");
  const elResultsEntrefaseVideo = document.getElementById("results-entrefase-video");
  if (elResultsEntrefaseVideo) {
    elResultsEntrefaseVideo.defaultMuted = false;
    elResultsEntrefaseVideo.muted = false;
    elResultsEntrefaseVideo.addEventListener("play", function () {
      elResultsEntrefaseVideo.muted = false;
      if (elResultsEntrefaseVideo.volume < 0.01) elResultsEntrefaseVideo.volume = 1;
    });
  }
  const elBtnGoElection = document.getElementById("btn-go-election");
  const elBtnRestart = document.getElementById("btn-restart");
  const elHangmanIntroMusic = document.getElementById("hangman-intro-music");
  if (elHangmanIntroMusic) elHangmanIntroMusic.volume = 0.3;
  const elHangmanBgMusic = document.getElementById("hangman-bg-music");
  if (elHangmanBgMusic) elHangmanBgMusic.volume = 0.3;
  const elHangmanSfxGood = document.getElementById("hangman-sfx-good");
  if (elHangmanSfxGood) elHangmanSfxGood.volume = 0.8;
  const elHangmanSfxBad = document.getElementById("hangman-sfx-bad");
  if (elHangmanSfxBad) elHangmanSfxBad.volume = 0.8;

  let wordIndex = 0;
  let currentWord = "";
  let guessedLetters = {};
  let turnOrder = [];
  let turnPointer = 0;
  let solved = false;
  let introAudioUnlockBound = false;
  let turnTimerIntervalId = null;
  let turnSecondsLeft = FIRST_TURN_TIME_SEC;
  let currentTurnDurationSec = FIRST_TURN_TIME_SEC;
  let turnOrderCount = 0;

  function clearTurnTimer() {
    if (turnTimerIntervalId !== null) {
      clearInterval(turnTimerIntervalId);
      turnTimerIntervalId = null;
    }
  }

  function stopResultsEntrefaseVideo() {
    if (!elResultsEntrefaseVideo) return;
    elResultsEntrefaseVideo.pause();
    try {
      elResultsEntrefaseVideo.currentTime = 0;
    } catch (err) {
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
      } catch (err2) {
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
    } catch (err3) {
      /* ignore */
    }
    if (v.readyState >= 2) {
      v.removeEventListener("canplay", onCanPlay);
      startPlayback();
    }
  }

  function updateTurnTimerVisuals() {
    if (!elTimerCount || !elTimerBarFill) return;
    elTimerCount.textContent = String(Math.max(0, turnSecondsLeft));
    const pct = (Math.max(0, turnSecondsLeft) / Math.max(1, currentTurnDurationSec)) * 100;
    elTimerBarFill.style.width = pct + "%";
  }

  function startTurnTimer(durationSec) {
    clearTurnTimer();
    currentTurnDurationSec = Number(durationSec) > 0 ? Number(durationSec) : FOLLOWING_TURN_TIME_SEC;
    turnSecondsLeft = currentTurnDurationSec;
    if (elTimerMessage) elTimerMessage.textContent = "Tiempo para responder";
    if (elTimerBlock) elTimerBlock.classList.remove("timer-expired");
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

  function configureHangmanVideoOutput() {
    if (!elHangmanVideo) return;
    elHangmanVideo.defaultMuted = false;
    elHangmanVideo.muted = false;
    elHangmanVideo.volume = HANGMAN_VIDEO_VOLUME;
  }

  function playIntroMusicOnce() {
    if (!elHangmanIntroMusic) return;
    if (elIntro && elIntro.classList.contains("hidden")) return;
    elHangmanIntroMusic.loop = false;
    elHangmanIntroMusic.muted = false;
    try {
      elHangmanIntroMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
    const maybePromise = elHangmanIntroMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function pauseIntroMusic() {
    if (!elHangmanIntroMusic) return;
    elHangmanIntroMusic.pause();
  }

  function playHangmanBgMusic() {
    if (!elHangmanBgMusic) return;
    if (elScreen && elScreen.classList.contains("hidden")) return;
    elHangmanBgMusic.loop = true;
    elHangmanBgMusic.muted = false;
    if (!elHangmanBgMusic.paused) return;
    const maybePromise = elHangmanBgMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function pauseHangmanBgMusic() {
    if (!elHangmanBgMusic) return;
    elHangmanBgMusic.pause();
    try {
      elHangmanBgMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
  }

  function playHangmanSfx(audioEl) {
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
          playHangmanBgMusic();
        },
        { once: true, passive: true }
      );
    });
  }

  function getCombinedScore(player) {
    return Math.max(
      0,
      Number(player.score || 0) + Number(player.priceScore || 0) + Number(player.hangmanScore || 0)
    );
  }

  function normalizeLetter(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .slice(0, 1);
  }

  function formatMaskedWord() {
    return currentWord
      .split(" ")
      .map(function (wordChunk) {
        return wordChunk
          .split("")
          .map(function (ch) {
            if (!/[A-Z0-9]/.test(ch)) return ch;
            return guessedLetters[ch] ? ch : "_";
          })
          .join(" ");
      })
      .join("   ");
  }

  function isWordSolved() {
    return currentWord.split("").every(function (ch) {
      if (!/[A-Z0-9]/.test(ch)) return true;
      return Boolean(guessedLetters[ch]);
    });
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

  function buildTurnOrderForNewWord() {
    // El orden de turno se fija al empezar cada palabra y no cambia hasta resolverla.
    // En ahorcado, los turnos van del ultimo clasificado al primero.
    return getSortedIndicesByRanking().reverse();
  }

  function renderScoreboard() {
    const sorted = getSortedIndicesByRanking();
    elScoreboard.innerHTML = "";

    sorted.forEach(function (participantIndex, rank) {
      const participant = participants[participantIndex];
      const li = document.createElement("li");
      li.className = "results-board-item";

      const name = document.createElement("span");
      name.className = "results-board-name";
      name.textContent = String(rank + 1) + ". " + participant.name;

      const points = document.createElement("strong");
      points.className = "results-board-score";
      points.textContent = String(getCombinedScore(participant));

      if (!solved && turnOrder[turnPointer] === participantIndex) {
        li.classList.add("hangman-current-turn");
      }

      li.appendChild(name);
      li.appendChild(points);
      elScoreboard.appendChild(li);
    });
  }

  function renderWordState() {
    elWordMask.textContent = formatMaskedWord();
  }

  function renderUsedLetters() {
    const letters = Object.keys(guessedLetters).sort();
    elUsedLetters.textContent = letters.length ? letters.join(" - ") : "-";
  }

  function updateTurnLabel() {
    if (solved) {
      elTurnLabel.textContent = "Palabra resuelta.";
      return;
    }
    const currentIndex = turnOrder[turnPointer];
    const currentPlayer = participants[currentIndex];
    elTurnLabel.textContent = "Turno de " + currentPlayer.name;
  }

  function moveToNextTurn() {
    turnPointer = (turnPointer + 1) % turnOrder.length;
    updateTurnLabel();
    renderScoreboard();
    const durationSec = turnOrderCount === 0 ? FIRST_TURN_TIME_SEC : FOLLOWING_TURN_TIME_SEC;
    turnOrderCount += 1;
    startTurnTimer(durationSec);
    elLetterInput.value = "";
    elLetterInput.focus();
  }

  function stopHangmanVideo() {
    if (!elHangmanVideo) return;
    elHangmanVideo.onerror = null;
    elHangmanVideo.pause();
    elHangmanVideo.removeAttribute("src");
    elHangmanVideo.load();
  }

  function applyHangmanVideo(slotIndex) {
    if (!elHangmanVideo) return;
    const elBlock = elHangmanVideo.closest(".hangman-media-block");
    elHangmanVideo.onerror = null;

    function hideHangmanVideoBlock() {
      if (elBlock) elBlock.classList.add("hidden");
      stopHangmanVideo();
    }

    function showHangmanVideoBlock() {
      if (elBlock) elBlock.classList.remove("hidden");
    }

    showHangmanVideoBlock();

    const n = Number(slotIndex);
    const num = Number.isFinite(n) && n >= 0 ? n + 1 : 1;
    const candidates = VIDEO_EXTENSIONS.map(function (ext) {
      return "vids/A" + String(num) + "." + ext;
    });
    let candidateIndex = 0;

    elHangmanVideo.onerror = function () {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        elHangmanVideo.src = candidates[candidateIndex];
        elHangmanVideo.load();
        configureHangmanVideoOutput();
        elHangmanVideo.play().catch(function () {});
        return;
      }
      hideHangmanVideoBlock();
    };

    elHangmanVideo.pause();
    elHangmanVideo.src = candidates[0];
    elHangmanVideo.load();
    configureHangmanVideoOutput();
    elHangmanVideo.play().catch(function () {});
  }

  function startWord() {
    guessedLetters = {};
    solved = false;
    const rawWord = words[wordIndex] && words[wordIndex].word ? String(words[wordIndex].word) : "";
    currentWord = rawWord
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    turnOrder = buildTurnOrderForNewWord();
    turnPointer = 0;
    turnOrderCount = 0;

    elWordIndex.textContent = "Palabra " + String(wordIndex + 1);
    elFeedback.textContent = "";
    elBtnNextWord.classList.add("hidden");
    elLetterInput.disabled = false;
    elBtnGuess.disabled = false;
    renderWordState();
    renderUsedLetters();
    updateTurnLabel();
    renderScoreboard();
    elLetterInput.value = "";
    elLetterInput.focus();
    applyHangmanVideo(wordIndex);
    startTurnTimer(FIRST_TURN_TIME_SEC);
    turnOrderCount = 1;
  }

  function showFinalResults() {
    clearTurnTimer();
    stopHangmanVideo();
    pauseHangmanBgMusic();
    if (elHeader) elHeader.classList.add("hidden");
    elIntro.classList.add("hidden");
    elScreen.classList.add("hidden");
    elResults.classList.remove("hidden");
    prepareResultsEntrefaseVideo();

    if (elScoreTotal) elScoreTotal.textContent = String(QUIZ_TOTAL + PRICE_TOTAL + HANGMAN_TOTAL);
    if (!elResultsBoard) return;
    elResultsBoard.innerHTML = "";
    getSortedIndicesByRanking().forEach(function (participantIndex) {
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

  function submitLetter(fromTimer) {
    if (solved) return;

    const letter = normalizeLetter(elLetterInput.value);
    if (!/^[A-Z0-9]$/.test(letter)) {
      if (fromTimer) {
        const currentIndex = turnOrder[turnPointer];
        const currentPlayer = participants[currentIndex];
        const minHangmanScore = -(Number(currentPlayer.score || 0) + Number(currentPlayer.priceScore || 0));
        currentPlayer.hangmanScore = Math.max(minHangmanScore, Number(currentPlayer.hangmanScore || 0) - 1);
        if (getCombinedScore(currentPlayer) === 0) {
          elFeedback.textContent = currentPlayer.name + " sin respuesta a tiempo (se mantiene en 0 puntos)";
        } else {
          elFeedback.textContent = currentPlayer.name + " sin respuesta a tiempo (-1)";
        }
        renderScoreboard();
        moveToNextTurn();
        return;
      }
      elFeedback.textContent = "Escribe exactamente una letra válida.";
      return;
    }

    if (guessedLetters[letter]) {
      if (fromTimer) {
        const currentIndex = turnOrder[turnPointer];
        const currentPlayer = participants[currentIndex];
        const minHangmanScore = -(Number(currentPlayer.score || 0) + Number(currentPlayer.priceScore || 0));
        currentPlayer.hangmanScore = Math.max(minHangmanScore, Number(currentPlayer.hangmanScore || 0) - 1);
        if (getCombinedScore(currentPlayer) === 0) {
          elFeedback.textContent = currentPlayer.name + " sin respuesta valida a tiempo (se mantiene en 0 puntos)";
        } else {
          elFeedback.textContent = currentPlayer.name + " sin respuesta valida a tiempo (-1)";
        }
        renderScoreboard();
        moveToNextTurn();
        return;
      }
      elFeedback.textContent = "Esa letra ya ha sido probada. Elige otra.";
      return;
    }

    clearTurnTimer();

    const currentIndex = turnOrder[turnPointer];
    const currentPlayer = participants[currentIndex];
    guessedLetters[letter] = true;

    if (currentWord.indexOf(letter) >= 0) {
      currentPlayer.hangmanScore += 1;
      elFeedback.textContent = currentPlayer.name + " acierta (+1): " + letter;
      playHangmanSfx(elHangmanSfxGood);
    } else {
      const minHangmanScore = -(Number(currentPlayer.score || 0) + Number(currentPlayer.priceScore || 0));
      currentPlayer.hangmanScore = Math.max(minHangmanScore, Number(currentPlayer.hangmanScore || 0) - 1);
      if (getCombinedScore(currentPlayer) === 0) {
        elFeedback.textContent = currentPlayer.name + " falla: " + letter + " (se mantiene en 0 puntos)";
      } else {
        elFeedback.textContent = currentPlayer.name + " falla (-1): " + letter;
      }
      playHangmanSfx(elHangmanSfxBad);
    }

    renderWordState();
    renderUsedLetters();
    renderScoreboard();
    elLetterInput.value = "";

    if (isWordSolved()) {
      solved = true;
      updateTurnLabel();
      elLetterInput.disabled = true;
      elBtnGuess.disabled = true;
      elBtnNextWord.classList.remove("hidden");
      window.PEKEHIME_SESSION.save(participants);
      return;
    }

    moveToNextTurn();
    elLetterInput.focus();
  }

  function beginHangmanRound() {
    stopResultsEntrefaseVideo();
    pauseIntroMusic();
    if (elHeader) elHeader.classList.add("hidden");
    elIntro.classList.add("hidden");
    elResults.classList.add("hidden");
    elScreen.classList.remove("hidden");
    playHangmanBgMusic();
    wordIndex = 0;
    startWord();
  }

  function onTurnTimeUp() {
    if (solved) return;
    submitLetter(true);
  }

  elBtnIntroContinue.addEventListener("click", beginHangmanRound);

  elBtnGuess.addEventListener("click", function () {
    submitLetter(false);
  });

  elLetterInput.addEventListener("input", function () {
    elLetterInput.value = normalizeLetter(elLetterInput.value);
  });

  elLetterInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitLetter(false);
  });

  elBtnNextWord.addEventListener("click", function () {
    if (wordIndex < HANGMAN_TOTAL - 1) {
      wordIndex += 1;
      startWord();
      return;
    }
    showFinalResults();
  });

  if (elBtnRestart) {
    elBtnRestart.addEventListener("click", function () {
      pauseIntroMusic();
      pauseHangmanBgMusic();
      clearTurnTimer();
      window.PEKEHIME_SESSION.clear();
      window.location.href = "index.html";
    });
  }

  if (elBtnGoElection) {
    elBtnGoElection.addEventListener("click", function () {
      stopResultsEntrefaseVideo();
      pauseIntroMusic();
      pauseHangmanBgMusic();
      clearTurnTimer();
      window.PEKEHIME_SESSION.save(participants);
      window.location.href = "eleccion.html";
    });
  }

  window.addEventListener("load", function () {
    playIntroMusicOnce();
    bindIntroAudioUnlock();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (elIntro && !elIntro.classList.contains("hidden")) {
      if (!elHangmanIntroMusic || !elHangmanIntroMusic.paused) return;
      playIntroMusicOnce();
      return;
    }
    if (elScreen && !elScreen.classList.contains("hidden") && elHangmanBgMusic && elHangmanBgMusic.paused) {
      playHangmanBgMusic();
    }
  });

  window.addEventListener("pagehide", function () {
    clearTurnTimer();
    stopResultsEntrefaseVideo();
  });
})();
