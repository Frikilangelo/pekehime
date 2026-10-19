(function () {
  "use strict";

  const questions = window.QUIZ_QUESTIONS;
  if (!Array.isArray(questions) || questions.length === 0) {
    document.querySelector(".main").innerHTML =
      '<p class="card">No hay preguntas definidas. Revisa <code>js/questions.js</code>.</p>';
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
    };
  });

  const CLASSIC_TOTAL = Math.min(10, questions.length);
  const priceQuestionsMeta = window.PRICE_QUESTIONS;
  const PRICE_TOTAL = Array.isArray(priceQuestionsMeta)
    ? Math.min(10, priceQuestionsMeta.length)
    : 0;

  const elStart = document.getElementById("start-screen");
  const elInterphase = document.getElementById("interphase-screen");
  const elBtnInterphaseContinue = document.getElementById("btn-interphase-continue");
  const elHeader = document.querySelector(".header");
  const elQuiz = document.getElementById("quiz-screen");
  const elResults = document.getElementById("results-screen");
  const elResultsTitle = elResults.querySelector(".results-title");
  const elBtnStart = document.getElementById("btn-start");
  const elParticipantName = document.getElementById("participant-name");
  const elBtnAddParticipant = document.getElementById("btn-add-participant");
  const elParticipantsList = document.getElementById("participants-list");
  const elPlayersPool = document.getElementById("players-pool");
  const elQuestion = document.getElementById("question-text");
  const elAnswers = document.getElementById("answers-container");
  const elBtnNext = document.getElementById("btn-next");
  const elQuestionIndex = document.getElementById("question-index");
  const elTimerMessage = document.getElementById("timer-message");
  const elTimerCount = document.getElementById("timer-count");
  const elTimerBarFill = document.getElementById("timer-bar-fill");
  const elTimerBlock = document.getElementById("timer-block");
  const elVideoBlock = document.getElementById("question-video-block");
  const elQuestionVideo = document.getElementById("question-video");
  const elQuestionVideoIframe = document.getElementById("question-video-iframe");
  const elQuestionImagesBlock = document.getElementById("question-images-block");
  const elQuestionImagesGrid = document.getElementById("question-images-grid");
  const elScoreTotal = document.getElementById("score-total");
  const elResultsBoard = document.getElementById("results-board");
  const elBtnGoPrice = document.getElementById("btn-go-price");
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
  const elInterphaseMusic = document.getElementById("interphase-music");
  if (elInterphaseMusic) elInterphaseMusic.volume = 0.3;
  const elQuizBgMusic = document.getElementById("quiz-bg-music");
  if (elQuizBgMusic) elQuizBgMusic.volume = 0.08;
  const elStartBgLayer = document.getElementById("start-bg-video-layer");
  const elStartBgVideo = document.getElementById("start-bg-video");

  const QUESTION_TIME_SEC = 30;
  const FOLLOWING_TURN_TIME_SEC = 15;
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
  const VIDEO_EXTENSIONS = ["mp4", "webm"];

  let index = 0;
  let shuffled = [];
  let answeredThisScreen = false;
  let timerIntervalId = null;
  let secondsLeft = QUESTION_TIME_SEC;
  let currentTimerDurationSec = QUESTION_TIME_SEC;
  let placements = [];
  let draggedParticipantIndex = null;
  let poolDropConfigured = false;
  let startMediaUnlockBound = false;
  let turnPendingParticipants = [];
  let activeTurnParticipantIndex = null;
  let turnHadAnyTimeout = false;
  let turnOrderCount = 0;

  function pauseInterphaseMusic() {
    if (!elInterphaseMusic) return;
    elInterphaseMusic.pause();
  }

  function pauseQuizBgMusic() {
    if (!elQuizBgMusic) return;
    elQuizBgMusic.pause();
    try {
      elQuizBgMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
  }

  function tryPlayInterphaseMusic() {
    if (!elInterphaseMusic) return;
    pauseQuizBgMusic();
    elInterphaseMusic.loop = false;
    elInterphaseMusic.muted = false;
    try {
      elInterphaseMusic.currentTime = 0;
    } catch (err) {
      /* ignore if media not seekable yet */
    }
    const maybePromise = elInterphaseMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function tryPlayQuizBgMusic() {
    if (!elQuizBgMusic) return;
    if (elResults && !elResults.classList.contains("hidden")) return;
    pauseInterphaseMusic();
    elQuizBgMusic.loop = true;
    elQuizBgMusic.muted = false;
    if (!elQuizBgMusic.paused) return;
    const maybePromise = elQuizBgMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }


  function showStartBackgroundVideo() {
    if (!elStartBgLayer) return;
    elStartBgLayer.classList.remove("hidden");
  }

  function unlockStartMediaAudio() {
    if (
      elInterphase &&
      !elInterphase.classList.contains("hidden") &&
      elInterphaseMusic &&
      elInterphaseMusic.paused
    ) {
      elInterphaseMusic.play().catch(function () {});
      return;
    }
    if (
      elQuiz &&
      !elQuiz.classList.contains("hidden") &&
      elQuizBgMusic &&
      elQuizBgMusic.paused
    ) {
      tryPlayQuizBgMusic();
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

  function cleanParticipantName(raw) {
    const normalized = String(raw || "").trim().replace(/\s+/g, " ");
    if (!normalized) return "";
    return normalized
      .toLowerCase()
      .split(" ")
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function hasParticipants() {
    return participants.length > 0;
  }

  function updateStartButtonState() {
    elBtnStart.disabled = !hasParticipants();
  }

  function focusParticipantInput() {
    if (!elParticipantName) return;
    requestAnimationFrame(function () {
      elParticipantName.focus({ preventScroll: true });
      elParticipantName.select();
    });
  }

  function renderParticipantsList() {
    elParticipantsList.innerHTML = "";
    participants.forEach(function (participant, i) {
      const li = document.createElement("li");
      li.className = "participants-item";
      li.textContent = participant.name;
      elParticipantsList.appendChild(li);
    });
    updateStartButtonState();
  }

  function getCombinedScore(participant) {
    return Number(participant.score || 0) + Number(participant.priceScore || 0);
  }

  function renderResultsBoard(mode) {
    if (!elResultsBoard) return;
    elResultsBoard.innerHTML = "";
    const orderedParticipants = participants.slice().sort(function (a, b) {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
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
          ")";
      } else {
        points.textContent = String(participant.score);
      }

      li.appendChild(name);
      li.appendChild(points);
      elResultsBoard.appendChild(li);
    });
  }

  function addParticipant() {
    const name = cleanParticipantName(elParticipantName.value);
    if (!name) {
      elParticipantName.focus();
      return;
    }
    participants.push({ name, score: 0, priceScore: 0 });
    elParticipantName.value = "";
    renderParticipantsList();
    elParticipantName.focus();
  }

  function resetAllParticipantScores() {
    participants = participants.map(function (participant) {
      return { name: participant.name, score: 0, priceScore: 0 };
    });
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateQuestionIndexLabel() {
    elQuestionIndex.textContent = "Pregunta " + (index + 1);
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

  function stopQuestionVideo() {
    elQuestionVideo.pause();
    elQuestionVideo.removeAttribute("src");
    elQuestionVideo.load();
    elQuestionVideo.classList.remove("hidden");
    elQuestionVideoIframe.classList.add("hidden");
    elQuestionVideoIframe.removeAttribute("src");
  }

  function applyQuestionVideo(q) {
    const raw = q.video;
    const src = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "";
    if (!src) {
      elVideoBlock.classList.add("hidden");
      stopQuestionVideo();
      return;
    }
    elVideoBlock.classList.remove("hidden");

    const ytEmbed = youTubeEmbedUrlFromLink(src);
    if (ytEmbed) {
      elQuestionVideo.pause();
      elQuestionVideo.removeAttribute("src");
      elQuestionVideo.load();
      elQuestionVideo.classList.add("hidden");
      elQuestionVideoIframe.classList.remove("hidden");
      elQuestionVideoIframe.src = ytEmbed;
      return;
    }

    elQuestionVideoIframe.removeAttribute("src");
    elQuestionVideoIframe.classList.add("hidden");
    elQuestionVideo.classList.remove("hidden");
    elQuestionVideo.src = src;
    elQuestionVideo.load();
    elQuestionVideo.play().catch(function () {});
  }


  function createAnswerImageFrame(questionNumber, answerOriginalIndex, fallbackText) {
    const frame = document.createElement("div");
    frame.className = "answer-media-frame";

    const img = document.createElement("img");
    img.className = "answer-image";
    img.alt = fallbackText || "Imagen de respuesta";
    img.loading = "lazy";
    img.decoding = "async";

    const imageNumber = Number(answerOriginalIndex) + 1;
    const candidates = IMAGE_EXTENSIONS.map(function (ext) {
      return "img/" + String(questionNumber) + String(imageNumber) + "." + ext;
    });
    let candidateIndex = 0;

    img.addEventListener("error", function () {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        img.src = candidates[candidateIndex];
        return;
      }
      frame.classList.add("answer-media-frame-missing");
      img.classList.add("hidden");
    });

    img.src = candidates[candidateIndex];
    frame.appendChild(img);
    return frame;
  }

  function clearQuestionTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }


  function updateTimerVisuals() {
    elTimerCount.textContent = String(Math.max(0, secondsLeft));
    const pct = (Math.max(0, secondsLeft) / Math.max(1, currentTimerDurationSec)) * 100;
    elTimerBarFill.style.width = pct + "%";
    elQuiz.classList.toggle("timer-low", secondsLeft <= 10 && secondsLeft > 0);
    elQuiz.classList.toggle("timer-critical", secondsLeft <= 5 && secondsLeft > 0);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setTimerMessage(message, asHtml) {
    if (!elTimerMessage) return;
    if (asHtml) {
      elTimerMessage.innerHTML = message;
      return;
    }
    elTimerMessage.textContent = message || "Tiempo para responder";
  }

  function startQuestionTimer(message, durationSec, messageIsHtml) {
    clearQuestionTimer();
    currentTimerDurationSec = Number(durationSec) > 0 ? Number(durationSec) : QUESTION_TIME_SEC;
    secondsLeft = currentTimerDurationSec;
    setTimerMessage(message, messageIsHtml);
    elQuiz.classList.remove("timer-low", "timer-critical");
    elTimerBlock.classList.remove("timer-expired");
    updateTimerVisuals();

    timerIntervalId = setInterval(function () {
      secondsLeft -= 1;
      updateTimerVisuals();
      if (secondsLeft <= 0) {
        clearQuestionTimer();
        onTimeUp();
      }
    }, 1000);
  }

  function createPlayerCard(participant, participantIndex, feedback) {
    const card = document.createElement("div");
    card.className = "player-chip";
    if (feedback === "correct") card.classList.add("chip-correct");
    if (feedback === "wrong") card.classList.add("chip-wrong");
    if (feedback === "unanswered") card.classList.add("chip-unanswered");
    if (!answeredThisScreen && participantIndex === activeTurnParticipantIndex) {
      card.classList.add("chip-active");
    }
    card.textContent = participant.name;
    const hasPlacement =
      placements[participantIndex] !== null &&
      typeof placements[participantIndex] !== "undefined";
    card.draggable =
      !answeredThisScreen &&
      participantIndex === activeTurnParticipantIndex &&
      !hasPlacement;
    card.dataset.participantIndex = String(participantIndex);

    card.addEventListener("dragstart", function (e) {
      if (answeredThisScreen || !card.draggable) {
        e.preventDefault();
        return;
      }
      draggedParticipantIndex = participantIndex;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(participantIndex));
    });

    card.addEventListener("dragend", function () {
      draggedParticipantIndex = null;
      card.classList.remove("dragging");
      elQuiz.querySelectorAll(".is-drop-target").forEach(function (el) {
        el.classList.remove("is-drop-target");
      });
    });

    return card;
  }

  function placeCard(participantIndex, displayIdx) {
    if (answeredThisScreen) return;
    if (participantIndex !== activeTurnParticipantIndex) return;
    if (displayIdx === null || typeof displayIdx === "undefined") return;
    placements[participantIndex] = displayIdx;
    renderDragState();
    completeActiveTurn(false);
  }

  function drawRandomPendingParticipant() {
    if (!turnPendingParticipants.length) return null;
    const randomOffset = Math.floor(Math.random() * turnPendingParticipants.length);
    const picked = turnPendingParticipants.splice(randomOffset, 1);
    return picked[0];
  }

  function moveToNextParticipantTurn() {
    if (answeredThisScreen) return;

    const nextParticipantIndex = drawRandomPendingParticipant();
    if (nextParticipantIndex === null || typeof nextParticipantIndex === "undefined") {
      evaluateQuestion(turnHadAnyTimeout);
      return;
    }

    activeTurnParticipantIndex = nextParticipantIndex;
    const current = participants[nextParticipantIndex];
    const timerLabel = current
      ? "Turno de <strong>" + escapeHtml(current.name) + "</strong>: elige respuesta"
      : "Tiempo para responder";
    const turnDurationSec = turnOrderCount === 0 ? QUESTION_TIME_SEC : FOLLOWING_TURN_TIME_SEC;
    turnOrderCount += 1;

    startQuestionTimer(timerLabel, turnDurationSec, Boolean(current));
    renderDragState();
  }

  function completeActiveTurn(didTimeOut) {
    if (answeredThisScreen || activeTurnParticipantIndex === null) return;
    clearQuestionTimer();
    if (didTimeOut) turnHadAnyTimeout = true;
    activeTurnParticipantIndex = null;
    moveToNextParticipantTurn();
  }

  function renderDragState(feedbackMap) {
    elPlayersPool.innerHTML = "";
    const slots = elAnswers.querySelectorAll(".answer-drop-slot");
    slots.forEach(function (slot) {
      slot.innerHTML = "";
    });

    participants.forEach(function (participant, participantIndex) {
      const feedback = feedbackMap ? feedbackMap[participantIndex] : "";
      const card = createPlayerCard(participant, participantIndex, feedback);
      const placement = placements[participantIndex];
      if (placement === null || typeof placement === "undefined") {
        elPlayersPool.appendChild(card);
        return;
      }
      const targetSlot = elAnswers.querySelector(
        '.answer-drop-slot[data-display-index="' + String(placement) + '"]'
      );
      if (!targetSlot) elPlayersPool.appendChild(card);
      else targetSlot.appendChild(card);
    });
  }

  function setupDropTarget(target, getDisplayIndex) {
    target.addEventListener("dragover", function (e) {
      if (answeredThisScreen) return;
      e.preventDefault();
      target.classList.add("is-drop-target");
    });

    target.addEventListener("dragleave", function () {
      target.classList.remove("is-drop-target");
    });

    target.addEventListener("drop", function (e) {
      if (answeredThisScreen) return;
      e.preventDefault();
      target.classList.remove("is-drop-target");

      const textIdx = e.dataTransfer.getData("text/plain");
      const participantIndex =
        textIdx !== "" ? Number(textIdx) : Number(draggedParticipantIndex);
      if (Number.isNaN(participantIndex)) return;
      placeCard(participantIndex, getDisplayIndex());
    });
  }

  function evaluateQuestion(isTimeUp) {
    if (answeredThisScreen) return;

    clearQuestionTimer();
    answeredThisScreen = true;
    activeTurnParticipantIndex = null;
    turnPendingParticipants = [];
    elTimerBlock.classList.toggle("timer-expired", Boolean(isTimeUp));
    elQuiz.classList.remove("timer-low", "timer-critical");
    elTimerMessage.textContent = isTimeUp
      ? "Respuestas evaluadas (hubo turnos sin tiempo)"
      : "Respuestas evaluadas";

    const feedbackMap = {};
    participants.forEach(function (participant, participantIndex) {
      const chosenIdx = placements[participantIndex];
      const isAnswered = chosenIdx !== null && typeof chosenIdx !== "undefined";
      const isCorrect =
        isAnswered && shuffled[chosenIdx] && Boolean(shuffled[chosenIdx].correct);
      if (isCorrect) participant.score += 1;

      if (!isAnswered) feedbackMap[participantIndex] = "unanswered";
      else feedbackMap[participantIndex] = isCorrect ? "correct" : "wrong";
    });

    const options = elAnswers.querySelectorAll(".answer-option");
    options.forEach(function (opt, i) {
      const hasAnyChip = placements.some(function (value) {
        return value === i;
      });
      if (shuffled[i].correct) opt.classList.add("is-correct");
      else if (hasAnyChip) opt.classList.add("is-wrong");
    });

    renderDragState(feedbackMap);
    elBtnNext.textContent =
      index === CLASSIC_TOTAL - 1 ? "Ver resultados" : "Siguiente pregunta";
    elBtnNext.classList.remove("hidden");
  }

  function onTimeUp() {
    if (answeredThisScreen) return;
    if (activeTurnParticipantIndex === null) {
      evaluateQuestion(true);
      return;
    }
    const participantIndex = activeTurnParticipantIndex;
    const hasPlacement =
      placements[participantIndex] !== null &&
      typeof placements[participantIndex] !== "undefined";
    if (!hasPlacement && shuffled.length > 0) {
      const randomDisplayIdx = Math.floor(Math.random() * shuffled.length);
      placements[participantIndex] = randomDisplayIdx;
      renderDragState();
    }
    completeActiveTurn(true);
  }

  function renderQuestion() {
    stopQuestionVideo();
    clearQuestionTimer();
    answeredThisScreen = false;
    elBtnNext.textContent = "Responder";
    elBtnNext.classList.add("hidden");
    placements = participants.map(function () {
      return null;
    });
    turnPendingParticipants = participants.map(function (_, participantIndex) {
      return participantIndex;
    });
    activeTurnParticipantIndex = null;
    turnHadAnyTimeout = false;
    turnOrderCount = 0;

    const q = questions[index];
    const questionNumber = index + 1;
    elQuestion.textContent = q.text;

    const withIdx = q.answers.map(function (a, i) {
      return { text: a.text, correct: a.correct, originalIndex: i };
    });
    shuffled = shuffleArray(withIdx);

    elAnswers.innerHTML = "";
    shuffled.forEach(function (ans, displayIdx) {
      const option = document.createElement("div");
      option.className = "answer-option";
      option.dataset.displayIndex = String(displayIdx);

      const accessibleText = document.createElement("p");
      accessibleText.className = "answer-text visually-hidden";
      accessibleText.textContent = ans.text;

      const answerImage = createAnswerImageFrame(questionNumber, ans.originalIndex, ans.text);

      const slot = document.createElement("div");
      slot.className = "answer-drop-slot";
      slot.dataset.displayIndex = String(displayIdx);

      setupDropTarget(slot, function () {
        return displayIdx;
      });

      option.appendChild(accessibleText);
      option.appendChild(answerImage);
      option.appendChild(slot);
      elAnswers.appendChild(option);
    });

    if (!poolDropConfigured) {
      setupDropTarget(elPlayersPool, function () {
        return null;
      });
      poolDropConfigured = true;
    }

    renderDragState();
    updateQuestionIndexLabel();
    applyQuestionVideo(q);
    if (elQuestionImagesBlock) elQuestionImagesBlock.classList.add("hidden");
    moveToNextParticipantTurn();
  }




  function showClassicResults() {
    if (elHeader) elHeader.classList.add("hidden");
    hideStartBackgroundVideo();
    stopQuestionVideo();
    elVideoBlock.classList.add("hidden");
    clearQuestionTimer();
    elQuiz.classList.add("hidden");
    pauseInterphaseMusic();
    pauseQuizBgMusic();
    elResults.classList.remove("hidden");
    prepareResultsEntrefaseVideo();
    elResultsTitle.textContent = "Resultados hasta el momento";
    elBtnGoPrice.classList.toggle("hidden", PRICE_TOTAL === 0);
    elBtnRestart.classList.toggle("hidden", PRICE_TOTAL > 0);
    renderResultsBoard("classic");
  }





  function showInterphaseScreen() {
    if (!hasParticipants()) return;
    if (!elInterphase) {
      beginQuiz();
      return;
    }

    stopResultsEntrefaseVideo();

    if (elStart) elStart.classList.add("hidden");
    hideStartBackgroundVideo();

    if (elInterphase) elInterphase.classList.remove("hidden");
    tryPlayInterphaseMusic();
  }

  function beginQuiz() {
    if (!hasParticipants()) return;

    stopResultsEntrefaseVideo();

    if (elInterphase) elInterphase.classList.add("hidden");
    pauseInterphaseMusic();
    tryPlayQuizBgMusic();

    if (elHeader) elHeader.classList.add("hidden");
    hideStartBackgroundVideo();
    index = 0;
    resetAllParticipantScores();
    if (elStart) elStart.classList.add("hidden");
    elQuiz.classList.remove("hidden");
    renderQuestion();
  }

  if (elBtnInterphaseContinue) {
    elBtnInterphaseContinue.addEventListener("click", function () {
      beginQuiz();
    });
  }

  elBtnNext.addEventListener("click", function () {
    if (!answeredThisScreen) return;
    if (index < CLASSIC_TOTAL - 1) {
      index += 1;
      renderQuestion();
    } else {
      showClassicResults();
    }
  });

  elBtnGoPrice.addEventListener("click", function () {
    stopResultsEntrefaseVideo();
    window.PEKEHIME_SESSION.save(participants);
    window.location.href = "price.html";
  });

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
    if (
      elInterphase &&
      !elInterphase.classList.contains("hidden") &&
      elInterphaseMusic &&
      elInterphaseMusic.paused
    ) {
      elInterphaseMusic.play().catch(function () {});
      return;
    }
    if (
      elQuiz &&
      !elQuiz.classList.contains("hidden") &&
      elQuizBgMusic &&
      elQuizBgMusic.paused
    ) {
      tryPlayQuizBgMusic();
    }
  });

  window.addEventListener("pagehide", function () {
    pauseInterphaseMusic();
    pauseQuizBgMusic();
    stopResultsEntrefaseVideo();
  });

  bindStartMediaUnlock();
  showStartBackgroundVideo();
  showInterphaseScreen();

  [elStartBgVideo, elQuestionVideo, elResultsEntrefaseVideo].forEach(function (el) {
    if (el) el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
})();
