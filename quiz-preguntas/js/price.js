(function () {
  "use strict";

  const questions = window.QUIZ_QUESTIONS;
  const priceQuestions = window.PRICE_QUESTIONS;
  if (!Array.isArray(priceQuestions) || priceQuestions.length === 0) {
    document.querySelector(".main").innerHTML =
      '<p class="card">No hay preguntas de precio. Revisa <code>js/questions.js</code> (PRICE_QUESTIONS).</p>';
    return;
  }

  const loaded = window.PEKEHIME_SESSION.load();
  if (!loaded) {
    window.location.href = "index.html";
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

  const CLASSIC_TOTAL = Math.min(10, Array.isArray(questions) ? questions.length : 0);
  const PRICE_TOTAL = Math.min(10, priceQuestions.length);
  const hangmanWordsMeta = window.HANGMAN_WORDS;
  const HANGMAN_TOTAL = Array.isArray(hangmanWordsMeta) ? Math.min(5, hangmanWordsMeta.length) : 0;

  const elHeader = document.querySelector(".header");
  const elResults = document.getElementById("results-screen");
  const elResultsTitle = elResults.querySelector(".results-title");
  const elScoreTotal = document.getElementById("score-total");
  const elResultsBoard = document.getElementById("results-board");
  const elBtnGoHangman = document.getElementById("btn-go-hangman");
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
  const elPriceIntro = document.getElementById("price-intro-screen");
  const elBtnPriceIntroContinue = document.getElementById("btn-price-intro-continue");
  const elPrice = document.getElementById("price-screen");
  const elPriceVideoBlock = document.getElementById("price-video-block");
  const elPriceQuestionVideo = document.getElementById("price-question-video");
  const elPriceQuestionVideoIframe = document.getElementById("price-question-video-iframe");
  const elPriceImageBlock = document.getElementById("price-image-block");
  const elPriceImageFrame = document.getElementById("price-image-frame");
  const elPriceQuestionImage = document.getElementById("price-question-image");
  const elPriceQuestionIndex = document.getElementById("price-question-index");
  const elPriceInputs = document.getElementById("price-inputs");
  const elPriceFeedback = document.getElementById("price-feedback");
  const elBtnPriceNext = document.getElementById("btn-price-next");
  const elPricePlayersPool = document.getElementById("price-players-pool");
  const elPriceTimerBlock = document.getElementById("price-timer-block");
  const elPriceTimerMessage = document.getElementById("price-timer-message");
  const elPriceTimerCount = document.getElementById("price-timer-count");
  const elPriceTimerBarFill = document.getElementById("price-timer-bar-fill");
  const elInterphaseMusic = document.getElementById("interphase-music");
  if (elInterphaseMusic) elInterphaseMusic.volume = 0.3;
  const elPriceIntroMusic = document.getElementById("price-intro-music");
  if (elPriceIntroMusic) elPriceIntroMusic.volume = 0.3;
  const elPriceBgMusic = document.getElementById("price-bg-music");
  if (elPriceBgMusic) elPriceBgMusic.volume = 0.12;
  const elStartBgLayer = document.getElementById("start-bg-video-layer");
  const elStartBgVideo = document.getElementById("start-bg-video");

  const QUESTION_TIME_SEC = 40;
  const FOLLOWING_TURN_TIME_SEC = 20;
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
  const VIDEO_EXTENSIONS = ["mp4", "webm"];

  let priceIndex = 0;
  let answeredPriceThisScreen = false;
  let priceTurnPendingParticipants = [];
  let priceActiveTurnParticipantIndex = null;
  let priceTurnOrderCount = 0;
  let priceTurnHadAnyTimeout = false;
  let priceAwaitingEvaluation = false;
  let priceTimerIntervalId = null;
  let priceSecondsLeft = 0;
  let priceCurrentTimerDurationSec = QUESTION_TIME_SEC;
  let startMediaUnlockBound = false;

  function stopStartMusicRetries() {
    /* reservado si se añade musica de inicio en esta pagina */
  }

  function unlockStartMediaAudio() {
    stopStartMusicRetries();
    if (elPriceIntroMusic && elPriceIntro && !elPriceIntro.classList.contains("hidden")) {
      elPriceIntroMusic.play().catch(function () {});
      return;
    }
    if (elPrice && !elPrice.classList.contains("hidden") && elPriceBgMusic && elPriceBgMusic.paused) {
      tryPlayPriceBgMusic();
    }
  }

  function bindStartMediaUnlock() {
    if (startMediaUnlockBound) return;
    startMediaUnlockBound = true;

    ["pointerdown", "keydown", "touchstart"].forEach(function (eventName) {
      window.addEventListener(
        eventName,
        function () {
          unlockStartMediaAudio();
        },
        { once: true, passive: true }
      );
    });
  }

  function hideStartBackgroundVideo() {
    if (!elStartBgLayer || !elStartBgVideo) return;
    elStartBgLayer.classList.add("hidden");
    elStartBgVideo.pause();
  }

  function pauseInterphaseMusic() {
    if (!elInterphaseMusic) return;
    elInterphaseMusic.pause();
  }

  function pausePriceBgMusic() {
    if (!elPriceBgMusic) return;
    elPriceBgMusic.pause();
    try {
      elPriceBgMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
  }

  function pausePriceIntroMusic() {
    if (!elPriceIntroMusic) return;
    elPriceIntroMusic.pause();
  }

  function tryPlayPriceIntroMusic() {
    pauseInterphaseMusic();
    pausePriceBgMusic();
    if (!elPriceIntroMusic) return;
    elPriceIntroMusic.loop = false;
    elPriceIntroMusic.muted = false;
    try {
      elPriceIntroMusic.currentTime = 0;
    } catch (err) {
      /* ignore if media not seekable yet */
    }
    const maybePromise = elPriceIntroMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function tryPlayPriceBgMusic() {
    if (!elPriceBgMusic) return;
    if (elResults && !elResults.classList.contains("hidden")) return;
    pauseInterphaseMusic();
    pausePriceIntroMusic();
    elPriceBgMusic.loop = true;
    elPriceBgMusic.muted = false;
    if (!elPriceBgMusic.paused) return;
    const maybePromise = elPriceBgMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function getCombinedScore(participant) {
    return (
      Number(participant.score || 0) +
      Number(participant.priceScore || 0) +
      Number(participant.hangmanScore || 0)
    );
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
    } catch (err) {
      /* ignore */
    }
    if (v.readyState >= 2) {
      v.removeEventListener("canplay", onCanPlay);
      startPlayback();
    }
  }

  function getResultsBoardScore(participant, mode) {
    if (mode === "final" && PRICE_TOTAL > 0) {
      return getCombinedScore(participant);
    }
    return Number(participant.score || 0) + Number(participant.priceScore || 0);
  }

  function renderResultsBoard(mode) {
    if (!elResultsBoard) return;
    elResultsBoard.innerHTML = "";
    const orderedParticipants = participants.slice().sort(function (a, b) {
      const scoreDiff = getResultsBoardScore(b, mode) - getResultsBoardScore(a, mode);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    orderedParticipants.forEach(function (participant) {
      const li = document.createElement("li");
      li.className = "results-board-item";

      const name = document.createElement("span");
      name.className = "results-board-name";
      name.textContent = participant.name;

      const points = document.createElement("strong");
      points.className = "results-board-score";
      if (mode === "final" && PRICE_TOTAL > 0) {
        points.textContent =
          String(getCombinedScore(participant)) +
          " (" +
          String(participant.score) +
          " + " +
          String(participant.priceScore) +
          " + " +
          String(participant.hangmanScore || 0) +
          ")";
      } else {
        const partialTotal = Number(participant.score || 0) + Number(participant.priceScore || 0);
        points.textContent = String(partialTotal);
      }

      li.appendChild(name);
      li.appendChild(points);
      elResultsBoard.appendChild(li);
    });
  }

  function youTubeEmbedUrlFromLink(raw) {
    let u;
    try {
      u = new URL(raw.trim());
    } catch {
      return null;
    }
    const host = u.hostname.replace(/^www\./, "");
    let videoId = null;
    const listId = u.searchParams.get("list");

    if (host === "youtu.be") {
      videoId = u.pathname.replace(/^\//, "").split("/")[0] || null;
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (u.pathname.startsWith("/embed/")) videoId = u.pathname.split("/")[2] || null;
      else if (u.pathname.startsWith("/shorts/")) videoId = u.pathname.split("/")[2] || null;
      else videoId = u.searchParams.get("v");
    }

    if (!videoId) return null;
    let embed =
      "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(videoId) +
      "?autoplay=1&rel=0&mute=1&controls=0&fs=0&modestbranding=1&disablekb=1&playsinline=1";
    if (listId) embed += "&list=" + encodeURIComponent(listId);
    return embed;
  }


  function stopPriceVideo() {
    if (!elPriceQuestionVideo || !elPriceQuestionVideoIframe) return;
    elPriceQuestionVideo.pause();
    elPriceQuestionVideo.removeAttribute("src");
    elPriceQuestionVideo.load();
    elPriceQuestionVideo.classList.remove("hidden");
    elPriceQuestionVideoIframe.classList.add("hidden");
    elPriceQuestionVideoIframe.removeAttribute("src");
  }

  function applyPriceVideo(q, slotIndex) {
    if (!elPriceVideoBlock || !elPriceQuestionVideo || !elPriceQuestionVideoIframe) return;

    elPriceQuestionVideo.onerror = null;

    const explicit =
      q && typeof q.video === "string" && q.video.trim() !== "";

    const slot = Number(slotIndex);
    const n = Number.isFinite(slot) && slot >= 0 ? slot + 1 : 1;

    function hidePriceVideoBlock() {
      elPriceVideoBlock.classList.add("hidden");
      stopPriceVideo();
    }

    elPriceVideoBlock.classList.remove("hidden");

    if (!explicit) {
      const candidates = VIDEO_EXTENSIONS.map(function (ext) {
        return "vids/p" + String(n) + "." + ext;
      });
      let candidateIndex = 0;

      elPriceQuestionVideo.onerror = function () {
        candidateIndex += 1;
        if (candidateIndex < candidates.length) {
          elPriceQuestionVideo.src = candidates[candidateIndex];
          elPriceQuestionVideo.load();
          elPriceQuestionVideo.play().catch(function () {});
          return;
        }
        hidePriceVideoBlock();
      };

      elPriceQuestionVideoIframe.removeAttribute("src");
      elPriceQuestionVideoIframe.classList.add("hidden");
      elPriceQuestionVideo.classList.remove("hidden");

      elPriceQuestionVideo.pause();
      elPriceQuestionVideo.src = candidates[0];
      elPriceQuestionVideo.load();
      elPriceQuestionVideo.play().catch(function () {});
      return;
    }

    const raw = q.video.trim();
    const ytEmbed = youTubeEmbedUrlFromLink(raw);
    if (ytEmbed) {
      elPriceQuestionVideo.pause();
      elPriceQuestionVideo.removeAttribute("src");
      elPriceQuestionVideo.load();
      elPriceQuestionVideo.classList.add("hidden");
      elPriceQuestionVideoIframe.classList.remove("hidden");
      elPriceQuestionVideoIframe.src = ytEmbed;
      return;
    }

    elPriceQuestionVideoIframe.removeAttribute("src");
    elPriceQuestionVideoIframe.classList.add("hidden");
    elPriceQuestionVideo.classList.remove("hidden");
    elPriceQuestionVideo.src = raw;
    elPriceQuestionVideo.load();
    elPriceQuestionVideo.play().catch(function () {});
  }


  function applyPriceImage(questionNumber) {
    if (!elPriceImageBlock || !elPriceImageFrame || !elPriceQuestionImage) return;

    elPriceImageBlock.classList.remove("hidden");
    elPriceImageFrame.classList.remove("price-image-frame-missing");
    elPriceQuestionImage.classList.remove("hidden");
    elPriceQuestionImage.alt = "Imagen de la pregunta de precio " + String(questionNumber);

    const candidates = IMAGE_EXTENSIONS.map(function (ext) {
      return "img/precio" + String(questionNumber) + "." + ext;
    });
    let candidateIndex = 0;

    elPriceQuestionImage.onerror = function () {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        elPriceQuestionImage.src = candidates[candidateIndex];
        return;
      }

      elPriceImageFrame.classList.add("price-image-frame-missing");
      elPriceQuestionImage.classList.add("hidden");
    };

    elPriceQuestionImage.src = candidates[candidateIndex];
  }



  function clearPriceTimer() {
    if (priceTimerIntervalId !== null) {
      clearInterval(priceTimerIntervalId);
      priceTimerIntervalId = null;
    }
  }

  function updatePriceTimerVisuals() {
    if (!elPriceTimerCount || !elPriceTimerBarFill) return;
    elPriceTimerCount.textContent = String(Math.max(0, priceSecondsLeft));
    const pct =
      (Math.max(0, priceSecondsLeft) / Math.max(1, priceCurrentTimerDurationSec)) * 100;
    elPriceTimerBarFill.style.width = pct + "%";
    elPrice.classList.toggle("timer-low", priceSecondsLeft <= 10 && priceSecondsLeft > 0);
    elPrice.classList.toggle("timer-critical", priceSecondsLeft <= 5 && priceSecondsLeft > 0);
  }

  function startPriceTurnTimer(message, durationSec) {
    clearPriceTimer();
    priceCurrentTimerDurationSec =
      Number(durationSec) > 0 ? Number(durationSec) : QUESTION_TIME_SEC;
    priceSecondsLeft = priceCurrentTimerDurationSec;
    if (elPriceTimerMessage) elPriceTimerMessage.textContent = message || "Tiempo para responder";
    elPrice.classList.remove("timer-low", "timer-critical");
    if (elPriceTimerBlock) elPriceTimerBlock.classList.remove("timer-expired");
    updatePriceTimerVisuals();

    priceTimerIntervalId = setInterval(function () {
      priceSecondsLeft -= 1;
      updatePriceTimerVisuals();
      if (priceSecondsLeft <= 0) {
        clearPriceTimer();
        onPriceTimeUp();
      }
    }, 1000);
  }

  function onPriceTimeUp() {
    if (answeredPriceThisScreen || priceAwaitingEvaluation) return;
    if (priceActiveTurnParticipantIndex === null) return;
    completePriceTurn(true);
  }

  function drawRandomPriceParticipant() {
    if (!priceTurnPendingParticipants.length) return null;
    const randomOffset = Math.floor(Math.random() * priceTurnPendingParticipants.length);
    const picked = priceTurnPendingParticipants.splice(randomOffset, 1);
    return picked[0];
  }

  function renderPricePlayerChips() {
    if (!elPricePlayersPool) return;
    elPricePlayersPool.innerHTML = "";
    participants.forEach(function (participant, participantIndex) {
      const chip = document.createElement("div");
      chip.className = "player-chip price-player-chip";
      chip.textContent = participant.name;
      if (
        !answeredPriceThisScreen &&
        !priceAwaitingEvaluation &&
        participantIndex === priceActiveTurnParticipantIndex
      ) {
        chip.classList.add("chip-active");
      }
      elPricePlayersPool.appendChild(chip);
    });
  }

  function finishPriceInputTurns() {
    priceAwaitingEvaluation = true;
    priceActiveTurnParticipantIndex = null;
    clearPriceTimer();
    elPriceInputs.querySelectorAll(".price-input").forEach(function (inp) {
      inp.disabled = true;
    });
    if (elPriceTimerMessage) {
      elPriceTimerMessage.textContent = priceTurnHadAnyTimeout
        ? "Hubo turnos sin tiempo. Pulsa Evaluar."
        : "Todos han escrito su cifra. Pulsa Evaluar.";
    }
    if (elPriceTimerCount) elPriceTimerCount.textContent = "0";
    if (elPriceTimerBarFill) elPriceTimerBarFill.style.width = "0%";
    elPrice.classList.remove("timer-low", "timer-critical");
    if (elPriceTimerBlock) elPriceTimerBlock.classList.remove("timer-expired");
    elBtnPriceNext.textContent = "Evaluar";
    setPriceFeedbackLarge(false);
    elPriceFeedback.textContent = "";
    renderPricePlayerChips();
  }

  function moveToNextPriceParticipantTurn() {
    if (answeredPriceThisScreen) return;

    elPriceInputs.querySelectorAll(".price-input").forEach(function (inp) {
      inp.disabled = true;
    });

    const nextParticipantIndex = drawRandomPriceParticipant();
    if (nextParticipantIndex === null || typeof nextParticipantIndex === "undefined") {
      finishPriceInputTurns();
      return;
    }

    priceActiveTurnParticipantIndex = nextParticipantIndex;
    const current = participants[nextParticipantIndex];
    const timerLabel = current
      ? "Turno de " + current.name + ": escribe tu cifra"
      : "Tiempo para responder";
    const turnDurationSec =
      priceTurnOrderCount === 0 ? QUESTION_TIME_SEC : FOLLOWING_TURN_TIME_SEC;
    priceTurnOrderCount += 1;

    const activeInput = document.getElementById("price-input-" + String(nextParticipantIndex));
    if (activeInput) {
      activeInput.disabled = false;
      window.setTimeout(function () {
        activeInput.focus();
      }, 0);
    }

    elBtnPriceNext.textContent = "Confirmar turno";
    startPriceTurnTimer(timerLabel, turnDurationSec);
    renderPricePlayerChips();
  }

  function normalizePriceRaw(raw) {
    return String(raw || "").trim().replace(",", ".");
  }

  function parsePriceInputValue(raw) {
    const s = normalizePriceRaw(raw);
    if (!s) {
      return { ok: false, message: "Introduce una cifra válida antes de confirmar." };
    }
    if (/[eE+-]/.test(s)) {
      return { ok: false, message: "Introduce una cifra válida antes de confirmar." };
    }
    const parts = s.split(".");
    if (parts.length > 2) {
      return { ok: false, message: "Introduce una cifra válida antes de confirmar." };
    }
    if (parts[1] && parts[1].length > 2) {
      return {
        ok: false,
        message: "Solo puedes usar como máximo dos cifras decimales (por ejemplo 3, 3.5 o 15.25).",
      };
    }
    const value = Number(s);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, message: "Introduce una cifra válida antes de confirmar." };
    }
    const cents = Math.round(value * 100);
    return { ok: true, value: cents / 100, cents: cents };
  }

  function setPriceFeedbackLarge(isLarge) {
    if (!elPriceFeedback) return;
    elPriceFeedback.style.fontSize = isLarge ? "2em" : "";
  }

  function priceTakenByAnotherLockedInput(activeIndex, cents) {
    let i = 0;
    for (; i < participants.length; i += 1) {
      if (i === activeIndex) continue;
      const other = document.getElementById("price-input-" + String(i));
      if (!other || !other.disabled) continue;
      const otherParsed = parsePriceInputValue(other.value);
      if (!otherParsed.ok) continue;
      if (otherParsed.cents === cents) return true;
    }
    return false;
  }

  function completePriceTurn(didTimeOut) {
    if (answeredPriceThisScreen || priceAwaitingEvaluation) return;
    if (priceActiveTurnParticipantIndex === null) return;

    clearPriceTimer();
    const idx = priceActiveTurnParticipantIndex;
    const input = document.getElementById("price-input-" + String(idx));
    if (input && didTimeOut) {
      input.value = "";
      input.classList.remove("price-input-filled");
      input.classList.add("price-input-invalid");
    }
    if (input) input.disabled = true;
    if (didTimeOut) priceTurnHadAnyTimeout = true;
    priceActiveTurnParticipantIndex = null;
    renderPricePlayerChips();
    moveToNextPriceParticipantTurn();
  }

  function confirmPriceTurn() {
    if (answeredPriceThisScreen || priceAwaitingEvaluation) return;
    if (priceActiveTurnParticipantIndex === null) return;

    const idx = priceActiveTurnParticipantIndex;
    const input = document.getElementById("price-input-" + String(idx));
    if (!input) return;

    const parsed = parsePriceInputValue(input.value);
    if (!parsed.ok) {
      setPriceFeedbackLarge(false);
      elPriceFeedback.textContent = parsed.message;
      return;
    }

    if (priceTakenByAnotherLockedInput(idx, parsed.cents)) {
      setPriceFeedbackLarge(false);
      elPriceFeedback.textContent =
        "Ese precio ya lo ha indicado otro jugador en esta pregunta. Elige otra cifra.";
      return;
    }

    input.value = String(parsed.value);
    setPriceFeedbackLarge(false);
    elPriceFeedback.textContent = "";
    clearPriceTimer();
    input.disabled = true;
    priceActiveTurnParticipantIndex = null;

    if (!priceTurnPendingParticipants.length) {
      finishPriceInputTurns();
      evaluatePriceQuestion();
      return;
    }

    renderPricePlayerChips();
    moveToNextPriceParticipantTurn();
  }

  function renderPriceQuestion() {
    clearPriceTimer();
    answeredPriceThisScreen = false;
    priceAwaitingEvaluation = false;
    priceTurnPendingParticipants = participants.map(function (_, participantIndex) {
      return participantIndex;
    });
    priceActiveTurnParticipantIndex = null;
    priceTurnOrderCount = 0;
    priceTurnHadAnyTimeout = false;
    setPriceFeedbackLarge(false);
    elPriceFeedback.textContent = "";
    elBtnPriceNext.textContent = "Confirmar turno";
    if (elPriceTimerBlock) elPriceTimerBlock.classList.remove("timer-expired");
    elPrice.classList.remove("timer-low", "timer-critical");

    const q = priceQuestions[priceIndex];
    if (elPriceQuestionIndex) elPriceQuestionIndex.textContent = "p" + String(priceIndex + 1);
    elPriceInputs.innerHTML = "";
    applyPriceVideo(q, priceIndex);
    applyPriceImage(priceIndex + 1);

    participants.forEach(function (participant, participantIndex) {
      const row = document.createElement("div");
      row.className = "price-input-row";

      const label = document.createElement("label");
      label.className = "price-input-label";
      label.setAttribute("for", "price-input-" + String(participantIndex));
      label.textContent = participant.name;

      const input = document.createElement("input");
      input.className = "price-input";
      input.type = "number";
      input.step = "0.01";
      input.min = "0";
      input.inputMode = "decimal";
      input.placeholder = "Max. 2 decimales (ej. 12.50)";
      input.id = "price-input-" + String(participantIndex);
      input.dataset.participantIndex = String(participantIndex);
      input.autocomplete = "off";
      input.disabled = true;

      row.appendChild(label);
      row.appendChild(input);
      elPriceInputs.appendChild(row);
    });

    renderPricePlayerChips();
    moveToNextPriceParticipantTurn();
  }

  function evaluatePriceQuestion() {
    if (answeredPriceThisScreen) return;
    if (!priceAwaitingEvaluation) return;

    const q = priceQuestions[priceIndex];
    const correctValue = Number(q.value);
    if (!Number.isFinite(correctValue)) {
      setPriceFeedbackLarge(false);
      elPriceFeedback.textContent =
        "La pregunta no tiene un valor válido en 'value'. Revisa js/questions.js.";
      return;
    }

    clearPriceTimer();
    elPrice.classList.remove("timer-low", "timer-critical");
    if (elPriceTimerBlock) {
      elPriceTimerBlock.classList.toggle("timer-expired", Boolean(priceTurnHadAnyTimeout));
    }

    const answers = [];
    const inputs = elPriceInputs.querySelectorAll(".price-input");
    inputs.forEach(function (input) {
      const participantIndex = Number(input.dataset.participantIndex);
      const raw = String(input.value || "").trim().replace(",", ".");
      input.disabled = true;

      const parsed = parsePriceInputValue(raw);
      if (!parsed.ok) {
        input.classList.add("price-input-invalid");
        return;
      }

      const value = parsed.value;
      input.classList.add("price-input-filled");
      if (value > correctValue) {
        input.classList.add("price-input-invalid");
        return;
      }
      answers.push({
        participantIndex: participantIndex,
        value: value,
        diff: correctValue - value,
      });
    });

    answeredPriceThisScreen = true;

    if (answers.length === 0) {
      setPriceFeedbackLarge(true);
      elPriceFeedback.textContent =
        "Nadie introdujo una cifra válida sin pasarse.\nValor correcto: " +
        String(correctValue) +
        ".";
      elBtnPriceNext.textContent =
        priceIndex === PRICE_TOTAL - 1 ? "Ver resultados finales" : "Siguiente precio";
      renderPricePlayerChips();
      return;
    }

    const minDiff = Math.min.apply(
      null,
      answers.map(function (item) {
        return item.diff;
      })
    );

    const winners = answers.filter(function (item) {
      return item.diff === minDiff;
    });

    winners.forEach(function (winner) {
      participants[winner.participantIndex].priceScore += 1;
      const winnerInput = elPriceInputs.querySelector(
        '#price-input-' + String(winner.participantIndex)
      );
      if (winnerInput) winnerInput.classList.add("price-input-winner");
    });

    const winnerNames = winners.map(function (winner) {
      return participants[winner.participantIndex].name;
    });

    setPriceFeedbackLarge(true);
    elPriceFeedback.textContent =
      "Valor correcto: " +
      String(correctValue) +
      ".\n Punto para: " +
      winnerNames.join(", ") +
      ".";

    elBtnPriceNext.textContent =
      priceIndex === PRICE_TOTAL - 1 ? "Ver resultados finales" : "Siguiente precio";
    renderPricePlayerChips();
  }


  function showPriceResults() {
    if (elHeader) elHeader.classList.add("hidden");
    hideStartBackgroundVideo();
    pausePriceIntroMusic();
    pausePriceBgMusic();
    stopPriceVideo();
    clearPriceTimer();
    elPrice.classList.add("hidden");
    if (elPriceIntro) elPriceIntro.classList.add("hidden");
    elResults.classList.remove("hidden");
    prepareResultsEntrefaseVideo();
    elResultsTitle.textContent = "Resultados hasta el momento";
    if (elBtnGoHangman) elBtnGoHangman.classList.toggle("hidden", HANGMAN_TOTAL === 0);
    elBtnRestart.classList.toggle("hidden", HANGMAN_TOTAL > 0);
    if (elScoreTotal) elScoreTotal.textContent = String(CLASSIC_TOTAL + PRICE_TOTAL);
    renderResultsBoard("classic");
  }

  function showPriceIntroScreen() {
    if (PRICE_TOTAL === 0) {
      showPriceResults();
      return;
    }
    hideStartBackgroundVideo();
    if (elHeader) elHeader.classList.add("hidden");
    pausePriceBgMusic();
    stopPriceVideo();
    stopResultsEntrefaseVideo();
    clearPriceTimer();
    elPrice.classList.add("hidden");
    elResults.classList.add("hidden");
    if (elPriceIntro) elPriceIntro.classList.remove("hidden");
    tryPlayPriceIntroMusic();
  }

  function beginPriceRound() {
    if (elHeader) elHeader.classList.add("hidden");
    if (PRICE_TOTAL === 0) {
      showPriceResults();
      return;
    }
    hideStartBackgroundVideo();
    pausePriceIntroMusic();
    tryPlayPriceBgMusic();
    if (elPriceIntro) elPriceIntro.classList.add("hidden");
    stopPriceVideo();
    stopResultsEntrefaseVideo();
    clearPriceTimer();
    elResults.classList.add("hidden");
    elPrice.classList.remove("hidden");
    priceIndex = 0;
    renderPriceQuestion();
  }






  if (elBtnPriceIntroContinue) {
    elBtnPriceIntroContinue.addEventListener("click", function () {
      beginPriceRound();
    });
  }

  elBtnPriceNext.addEventListener("click", function () {
    if (answeredPriceThisScreen) {
      if (priceIndex < PRICE_TOTAL - 1) {
        priceIndex += 1;
        renderPriceQuestion();
      } else {
        showPriceResults();
      }
      return;
    }
    if (priceAwaitingEvaluation) {
      evaluatePriceQuestion();
      return;
    }
    confirmPriceTurn();
  });

  if (elPrice) {
    elPrice.addEventListener("input", function (e) {
      const inp = e.target.closest(".price-input");
      if (!inp || inp.disabled) return;
      if (priceActiveTurnParticipantIndex === null) return;
      if (Number(inp.dataset.participantIndex) !== priceActiveTurnParticipantIndex) return;
      const s = normalizePriceRaw(inp.value);
      if (!s) return;
      const dot = s.indexOf(".");
      if (dot === -1) return;
      const frac = s.slice(dot + 1);
      if (frac.length <= 2) return;
      inp.value = s.slice(0, dot + 1) + frac.slice(0, 2);
    });

    elPrice.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (!e.target || !e.target.closest("#price-inputs")) return;
      if (answeredPriceThisScreen || priceAwaitingEvaluation) return;
      if (priceActiveTurnParticipantIndex === null) return;
      const input = e.target.closest(".price-input");
      if (!input) return;
      if (Number(input.dataset.participantIndex) !== priceActiveTurnParticipantIndex) return;
      e.preventDefault();
      confirmPriceTurn();
    });
  }

  if (elBtnGoHangman) {
    elBtnGoHangman.addEventListener("click", function () {
      stopResultsEntrefaseVideo();
      window.PEKEHIME_SESSION.save(participants);
      window.location.href = "hangman.html";
    });
  }

  elBtnRestart.addEventListener("click", function () {
    stopResultsEntrefaseVideo();
    window.PEKEHIME_SESSION.clear();
    window.location.href = "index.html";
  });

  window.addEventListener("load", function () {
    bindStartMediaUnlock();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (elPriceIntro && !elPriceIntro.classList.contains("hidden") && elPriceIntroMusic) {
      if (elPriceIntroMusic.paused) {
        elPriceIntroMusic.play().catch(function () {});
      }
      return;
    }
    if (elPrice && !elPrice.classList.contains("hidden") && elPriceBgMusic && elPriceBgMusic.paused) {
      tryPlayPriceBgMusic();
    }
  });

  window.addEventListener("pagehide", function () {
    pauseInterphaseMusic();
    pausePriceIntroMusic();
    pausePriceBgMusic();
    stopResultsEntrefaseVideo();
  });

  bindStartMediaUnlock();
  hideStartBackgroundVideo();
  if (PRICE_TOTAL === 0) {
    showPriceResults();
  } else {
    showPriceIntroScreen();
  }

  [elStartBgVideo, elPriceQuestionVideo, elResultsEntrefaseVideo].forEach(function (el) {
    if (el) el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
})();
