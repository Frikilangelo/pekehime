(function () {
  "use strict";

  const loaded = window.PEKEHIME_SESSION.load();
  if (!loaded) {
    window.location.href = "index.html";
    return;
  }

  const questionBank = Array.isArray(window.ELECTION_QUESTIONS) ? window.ELECTION_QUESTIONS : [];
  if (!questionBank.length) {
    document.querySelector(".main").innerHTML =
      '<p class="card">No hay preguntas para eleccion. Revisa <code>js/questions.js</code> (ELECTION_QUESTIONS).</p>';
    return;
  }

  let participants = loaded.map(function (p) {
    return {
      name: p.name,
      score: Number(p.score) || 0,
      priceScore: Number(p.priceScore) || 0,
      hangmanScore: Number(p.hangmanScore) || 0,
      electionScore: Number(p.electionScore) || 0,
    };
  });

  const QUIZ_TOTAL = Math.min(10, Array.isArray(window.QUIZ_QUESTIONS) ? window.QUIZ_QUESTIONS.length : 0);
  const PRICE_TOTAL = Math.min(10, Array.isArray(window.PRICE_QUESTIONS) ? window.PRICE_QUESTIONS.length : 0);
  const HANGMAN_TOTAL = Math.min(5, Array.isArray(window.HANGMAN_WORDS) ? window.HANGMAN_WORDS.length : 0);
  const VIDEO_EXTENSIONS = ["mp4", "webm"];
  const ELECTION_VIDEO_VOLUME = 1;
  const ELECTION_RESPONDER_TIME_SEC = 30;
  const ELECTION_VOTER_TIME_SEC = 10;

  const elHeader = document.querySelector(".header");
  const elIntro = document.getElementById("election-intro-screen");
  const elScreen = document.getElementById("election-screen");
  const elResults = document.getElementById("results-screen");
  const elBtnIntroContinue = document.getElementById("btn-election-intro-continue");
  const elScoreboard = document.getElementById("election-scoreboard");
  const elElectionVideo = document.getElementById("election-video");
  if (elElectionVideo) {
    elElectionVideo.addEventListener("play", function () {
      elElectionVideo.muted = false;
      if (elElectionVideo.volume < 0.01) elElectionVideo.volume = ELECTION_VIDEO_VOLUME;
    });
  }
  const elRoundIndex = document.getElementById("election-round-index");
  const elQuestionText = document.getElementById("election-question-text");
  const elTurnLabel = document.getElementById("election-turn-label");
  const elAnswerInput = document.getElementById("election-answer-input");
  const elBtnSubmitAnswer = document.getElementById("btn-election-submit-answer");
  const elPlayersPool = document.getElementById("election-players-pool");
  const elSlotFavor = document.getElementById("election-slot-favor");
  const elSlotAgainst = document.getElementById("election-slot-against");
  const elVoteFavor = document.getElementById("election-vote-favor");
  const elVoteAgainst = document.getElementById("election-vote-against");
  const elFeedback = document.getElementById("election-feedback");
  const elBtnNextRound = document.getElementById("btn-election-next-round");
  const elResultsBoard = document.getElementById("results-board");
  const elScoreTotal = document.getElementById("score-total");
  const elBtnGoRosco = document.getElementById("btn-go-rosco");
  const elResultsEntrefaseVideo = document.getElementById("results-entrefase-video");
  if (elResultsEntrefaseVideo) {
    elResultsEntrefaseVideo.defaultMuted = false;
    elResultsEntrefaseVideo.muted = false;
    elResultsEntrefaseVideo.addEventListener("play", function () {
      elResultsEntrefaseVideo.muted = false;
      if (elResultsEntrefaseVideo.volume < 0.01) elResultsEntrefaseVideo.volume = 1;
    });
  }
  const elElectionIntroMusic = document.getElementById("election-intro-music");
  if (elElectionIntroMusic) elElectionIntroMusic.volume = 0.3;
  const elElectionBgMusic = document.getElementById("election-bg-music");
  if (elElectionBgMusic) elElectionBgMusic.volume = 0.12;
  const elElectionTimerBlock = document.getElementById("election-timer-block");
  const elElectionTimerMessage = document.getElementById("election-timer-message");
  const elElectionTimerCount = document.getElementById("election-timer-count");
  const elElectionTimerBarFill = document.getElementById("election-timer-bar-fill");

  let rankingOrder = [];
  let electionQuestionOrder = [];
  let totalElectionRounds = 0;
  let roundPointer = 0;
  let currentQuestion = null;
  let responderIndex = null;
  let voterOrder = [];
  let voterPointer = 0;
  let responderRawAnswer = "";
  let votes = {};
  let roundEvaluated = false;
  let electionTimerId = null;
  let electionSecondsLeft = 0;
  let electionTimerDurationSec = ELECTION_RESPONDER_TIME_SEC;
  let electionVideoLoadToken = 0;

  function clearElectionTimer() {
    if (electionTimerId !== null) {
      clearInterval(electionTimerId);
      electionTimerId = null;
    }
  }

  function hideElectionTimerUi() {
    clearElectionTimer();
    if (elElectionTimerBlock) {
      elElectionTimerBlock.classList.add("hidden");
      elElectionTimerBlock.classList.remove("timer-expired");
    }
    if (elScreen) elScreen.classList.remove("timer-low", "timer-critical");
  }

  function updateElectionTimerVisuals() {
    if (!elElectionTimerCount || !elElectionTimerBarFill) return;
    elElectionTimerCount.textContent = String(Math.max(0, electionSecondsLeft));
    const pct = (Math.max(0, electionSecondsLeft) / Math.max(1, electionTimerDurationSec)) * 100;
    elElectionTimerBarFill.style.width = pct + "%";
    const shortPhase = electionTimerDurationSec <= 15;
    const lowTh = shortPhase ? 5 : 10;
    const critTh = shortPhase ? 3 : 5;
    if (elScreen) {
      elScreen.classList.toggle("timer-low", electionSecondsLeft <= lowTh && electionSecondsLeft > 0);
      elScreen.classList.toggle("timer-critical", electionSecondsLeft <= critTh && electionSecondsLeft > 0);
    }
  }

  function startElectionTimer(message, durationSec, onExpire) {
    clearElectionTimer();
    if (!elElectionTimerBlock || !elElectionTimerCount || !elElectionTimerBarFill) return;
    electionTimerDurationSec = Number(durationSec) > 0 ? Number(durationSec) : ELECTION_RESPONDER_TIME_SEC;
    electionSecondsLeft = electionTimerDurationSec;
    if (elElectionTimerMessage) elElectionTimerMessage.textContent = message || "Tiempo";
    if (elScreen) elScreen.classList.remove("timer-low", "timer-critical");
    if (elElectionTimerBlock) elElectionTimerBlock.classList.remove("timer-expired", "hidden");
    updateElectionTimerVisuals();

    electionTimerId = setInterval(function () {
      electionSecondsLeft -= 1;
      updateElectionTimerVisuals();
      if (electionSecondsLeft <= 0) {
        clearElectionTimer();
        if (typeof onExpire === "function") onExpire();
      }
    }, 1000);
  }

  function scheduleCurrentVoterTimer() {
    if (roundEvaluated) return;
    if (voterPointer >= voterOrder.length) return;
    const activeIdx = voterOrder[voterPointer];
    const voter = participants[activeIdx];
    const label = voter ? "Turno de voto: " + voter.name : "Tiempo para votar";
    startElectionTimer(label, ELECTION_VOTER_TIME_SEC, onVoteTimerExpired);
  }

  function onVoteTimerExpired() {
    if (roundEvaluated) return;
    if (voterPointer >= voterOrder.length) return;
    voterPointer += 1;
    renderVoteAreas();
    if (voterPointer >= voterOrder.length) {
      hideElectionTimerUi();
      evaluateRound();
      return;
    }
    updateTurnLabel();
    scheduleCurrentVoterTimer();
  }

  function onRespondTimerExpired() {
    if (roundEvaluated) return;
    if (!elAnswerInput || elAnswerInput.disabled) return;
    clearElectionTimer();
    if (elElectionTimerBlock) elElectionTimerBlock.classList.add("timer-expired");
    if (elScreen) elScreen.classList.remove("timer-low", "timer-critical");
    responderRawAnswer = elAnswerInput.value.trim();
    elAnswerInput.disabled = true;
    elBtnSubmitAnswer.disabled = true;
    elFeedback.textContent = "Tiempo agotado.";
    startVotingPhase();
  }

  function startRespondPhaseTimer() {
    if (roundEvaluated || responderIndex === null) return;
    const name = participants[responderIndex].name;
    startElectionTimer("Tiempo para responder: " + name, ELECTION_RESPONDER_TIME_SEC, onRespondTimerExpired);
  }

  function tryPlayElectionIntroMusic() {
    if (!elElectionIntroMusic) return;
    if (elIntro && elIntro.classList.contains("hidden")) return;
    elElectionIntroMusic.loop = false;
    elElectionIntroMusic.muted = false;
    try {
      elElectionIntroMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
    const maybePromise = elElectionIntroMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function pauseElectionIntroMusic() {
    if (!elElectionIntroMusic) return;
    elElectionIntroMusic.pause();
  }

  function tryPlayElectionBgMusic() {
    if (!elElectionBgMusic) return;
    if (elScreen && elScreen.classList.contains("hidden")) return;
    pauseElectionIntroMusic();
    elElectionBgMusic.loop = true;
    elElectionBgMusic.muted = false;
    if (!elElectionBgMusic.paused) return;
    const maybePromise = elElectionBgMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;
    maybePromise.catch(function () {});
  }

  function pauseElectionBgMusic() {
    if (!elElectionBgMusic) return;
    elElectionBgMusic.pause();
    try {
      elElectionBgMusic.currentTime = 0;
    } catch (err) {
      /* ignore */
    }
  }

  function configureElectionVideoOutput() {
    if (!elElectionVideo) return;
    elElectionVideo.defaultMuted = false;
    elElectionVideo.muted = false;
    elElectionVideo.volume = ELECTION_VIDEO_VOLUME;
  }

  function stopElectionVideo() {
    if (!elElectionVideo) return;
    elElectionVideo.onerror = null;
    elElectionVideo.pause();
    elElectionVideo.removeAttribute("src");
    elElectionVideo.load();
  }

  function applyElectionVideo(slotIndex) {
    if (!elElectionVideo) return;
    const elBlock = elElectionVideo.closest(".election-media-block");
    const MEDIA_ERR_ABORTED = typeof MediaError !== "undefined" ? MediaError.MEDIA_ERR_ABORTED : 1;

    electionVideoLoadToken += 1;
    const loadToken = electionVideoLoadToken;

    elElectionVideo.onerror = null;
    elElectionVideo.pause();
    try {
      elElectionVideo.removeAttribute("src");
      elElectionVideo.load();
    } catch (err) {
      /* ignore */
    }

    function hideElectionVideoBlock() {
      if (loadToken !== electionVideoLoadToken) return;
      if (elBlock) elBlock.classList.add("hidden");
      stopElectionVideo();
    }

    function showElectionVideoBlock() {
      if (elBlock) elBlock.classList.remove("hidden");
    }

    showElectionVideoBlock();
    const n = Number(slotIndex);
    const num = Number.isFinite(n) && n >= 0 ? n + 1 : 1;
    const candidates = VIDEO_EXTENSIONS.map(function (ext) {
      return "vids/E" + String(num) + "." + ext;
    });
    let candidateIndex = 0;

    elElectionVideo.onerror = function () {
      if (loadToken !== electionVideoLoadToken) return;
      const mediaErr = elElectionVideo.error;
      if (mediaErr && mediaErr.code === MEDIA_ERR_ABORTED) return;
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        elElectionVideo.src = candidates[candidateIndex];
        elElectionVideo.load();
        configureElectionVideoOutput();
        elElectionVideo.play().catch(function () {});
        return;
      }
      hideElectionVideoBlock();
    };

    elElectionVideo.src = candidates[0];
    elElectionVideo.load();
    configureElectionVideoOutput();
    elElectionVideo.play().catch(function () {});
  }

  function getCombinedScore(player) {
    return (
      Number(player.score || 0) +
      Number(player.priceScore || 0) +
      Number(player.hangmanScore || 0) +
      Number(player.electionScore || 0)
    );
  }

  function getCombinedScoreWithoutElection(player) {
    return Number(player.score || 0) + Number(player.priceScore || 0) + Number(player.hangmanScore || 0);
  }

  function normalizeText(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function getRankingForSectionStart() {
    return participants
      .map(function (_, idx) {
        return idx;
      })
      .sort(function (a, b) {
        const scoreDiff = getCombinedScoreWithoutElection(participants[b]) - getCombinedScoreWithoutElection(participants[a]);
        if (scoreDiff !== 0) return scoreDiff;
        return participants[a].name.localeCompare(participants[b].name);
      });
  }

  function renderScoreboard() {
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
        if (participantIndex === responderIndex && !roundEvaluated) {
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

  function createChip(participantIndex) {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.textContent = participants[participantIndex].name;
    chip.dataset.participantIndex = String(participantIndex);
    return chip;
  }

  function renderVoteAreas() {
    elPlayersPool.innerHTML = "";
    elSlotFavor.innerHTML = "";
    elSlotAgainst.innerHTML = "";

    Object.keys(votes).forEach(function (rawIndex) {
      const participantIndex = Number(rawIndex);
      if (votes[participantIndex] === "favor") {
        elSlotFavor.appendChild(createChip(participantIndex));
      } else if (votes[participantIndex] === "against") {
        elSlotAgainst.appendChild(createChip(participantIndex));
      }
    });

    const activeVoter = voterOrder[voterPointer];
    if (
      !roundEvaluated &&
      responderIndex !== null &&
      voterPointer < voterOrder.length &&
      typeof activeVoter !== "undefined" &&
      !votes[activeVoter]
    ) {
      const activeChip = createChip(activeVoter);
      activeChip.classList.add("chip-active");
      elPlayersPool.appendChild(activeChip);
    }
  }

  function setVoteOptionsEnabled(enabled) {
    const method = enabled ? "remove" : "add";
    elVoteFavor.classList[method]("election-vote-disabled");
    elVoteAgainst.classList[method]("election-vote-disabled");
  }

  function updateTurnLabel() {
    if (roundEvaluated) return;
    if (voterPointer < voterOrder.length) {
      const activeVoter = participants[voterOrder[voterPointer]];
      elTurnLabel.textContent = "Turno de voto: " + activeVoter.name + " (elige A favor o En contra)";
      return;
    }
    elTurnLabel.textContent = "Todos han votado. Pulsa para evaluar la ronda.";
  }

  function startVotingPhase() {
    const pendingVoters = participants
      .map(function (_, idx) {
        return idx;
      })
      .filter(function (idx) {
        return idx !== responderIndex;
      });
    voterOrder = shuffleArray(pendingVoters);
    voterPointer = 0;
    votes = {};
    updateTurnLabel();
    setVoteOptionsEnabled(true);
    renderVoteAreas();
    if (elElectionTimerBlock) elElectionTimerBlock.classList.remove("timer-expired");
    if (voterOrder.length === 0) {
      hideElectionTimerUi();
      evaluateRound();
      return;
    }
    scheduleCurrentVoterTimer();
  }

  function isAnswerCorrect() {
    const normalizedResponse = normalizeText(responderRawAnswer);
    if (!normalizedResponse) return false;
    const accepted = Array.isArray(currentQuestion.answers) ? currentQuestion.answers : [currentQuestion.answer];
    return accepted.some(function (candidate) {
      return normalizeText(candidate) === normalizedResponse;
    });
  }

  function evaluateRound() {
    if (roundEvaluated) return;
    clearElectionTimer();
    const correct = isAnswerCorrect();
    const responder = participants[responderIndex];
    const favorIndices = Object.keys(votes)
      .map(function (key) {
        return Number(key);
      })
      .filter(function (idx) {
        return votes[idx] === "favor";
      });
    const againstIndices = Object.keys(votes)
      .map(function (key) {
        return Number(key);
      })
      .filter(function (idx) {
        return votes[idx] === "against";
      });

    if (correct) {
      responder.electionScore += 3;
      favorIndices.forEach(function (idx) {
        participants[idx].electionScore += 1;
      });
      elFeedback.textContent =
        "Respuesta correcta. " +
        responder.name +
        " gana +3 y en A favor suman +1: " +
        (favorIndices.length
          ? favorIndices.map(function (idx) { return participants[idx].name; }).join(", ")
          : "nadie") +
        ".";
    } else {
      againstIndices.forEach(function (idx) {
        participants[idx].electionScore += 1;
      });
      elFeedback.textContent =
        "Respuesta incorrecta. En En contra suman +1: " +
        (againstIndices.length
          ? againstIndices.map(function (idx) { return participants[idx].name; }).join(", ")
          : "nadie") +
        ".";
    }

    roundEvaluated = true;
    elTurnLabel.textContent = "Ronda evaluada.";
    setVoteOptionsEnabled(false);
    elBtnNextRound.classList.remove("hidden");
    renderVoteAreas();
    renderScoreboard();
    window.PEKEHIME_SESSION.save(participants);
    hideElectionTimerUi();
  }

  function castVote(voteType) {
    if (roundEvaluated) return;
    if (voterPointer >= voterOrder.length) return;
    clearElectionTimer();
    const activeVoter = voterOrder[voterPointer];
    votes[activeVoter] = voteType;
    voterPointer += 1;
    renderVoteAreas();
    if (voterPointer >= voterOrder.length) {
      hideElectionTimerUi();
      evaluateRound();
      return;
    }
    updateTurnLabel();
    scheduleCurrentVoterTimer();
  }

  function submitResponderAnswer() {
    if (roundEvaluated) return;
    if (!elAnswerInput.value.trim()) {
      elFeedback.textContent = "Escribe una respuesta antes de continuar.";
      return;
    }
    clearElectionTimer();
    if (elElectionTimerBlock) elElectionTimerBlock.classList.remove("timer-expired");
    responderRawAnswer = elAnswerInput.value.trim();
    elAnswerInput.disabled = true;
    elBtnSubmitAnswer.disabled = true;
    elFeedback.textContent = "";
    startVotingPhase();
  }

  function startRound() {
    hideElectionTimerUi();
    responderIndex = rankingOrder[roundPointer];
    const questionIndex = electionQuestionOrder[roundPointer];
    currentQuestion = questionBank[questionIndex];
    voterOrder = [];
    voterPointer = 0;
    votes = {};
    responderRawAnswer = "";
    roundEvaluated = false;

    elRoundIndex.textContent = "Ronda " + String(roundPointer + 1);
    elQuestionText.textContent = currentQuestion.text || "";
    applyElectionVideo(roundPointer);
    elTurnLabel.textContent = "Responde: " + participants[responderIndex].name;
    elAnswerInput.value = "";
    elAnswerInput.disabled = false;
    elBtnSubmitAnswer.disabled = false;
    elFeedback.textContent = "";
    elBtnNextRound.classList.add("hidden");
    setVoteOptionsEnabled(false);
    renderVoteAreas();
    renderScoreboard();
    elAnswerInput.focus();
    startRespondPhaseTimer();
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

  function showFinalResults() {
    hideElectionTimerUi();
    pauseElectionBgMusic();
    stopElectionVideo();
    if (elHeader) elHeader.classList.add("hidden");
    elIntro.classList.add("hidden");
    elScreen.classList.add("hidden");
    elResults.classList.remove("hidden");
    prepareResultsEntrefaseVideo();

    elScoreTotal.textContent = String(QUIZ_TOTAL + PRICE_TOTAL + HANGMAN_TOTAL + totalElectionRounds);
    if (!elResultsBoard) return;
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

  function beginElectionSection() {
    pauseElectionIntroMusic();
    stopElectionVideo();
    if (elHeader) elHeader.classList.add("hidden");
    elIntro.classList.add("hidden");
    elResults.classList.add("hidden");
    elScreen.classList.remove("hidden");
    tryPlayElectionBgMusic();
    rankingOrder = getRankingForSectionStart();
    electionQuestionOrder = shuffleArray(
      questionBank.map(function (_, idx) {
        return idx;
      })
    );
    totalElectionRounds = Math.min(rankingOrder.length, electionQuestionOrder.length);
    rankingOrder = rankingOrder.slice(0, totalElectionRounds);
    electionQuestionOrder = electionQuestionOrder.slice(0, totalElectionRounds);
    roundPointer = 0;
    startRound();
  }

  elBtnIntroContinue.addEventListener("click", beginElectionSection);
  elBtnSubmitAnswer.addEventListener("click", submitResponderAnswer);
  elAnswerInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitResponderAnswer();
  });
  elVoteFavor.addEventListener("click", function () {
    castVote("favor");
  });
  elVoteAgainst.addEventListener("click", function () {
    castVote("against");
  });
  elBtnNextRound.addEventListener("click", function () {
    if (roundPointer < totalElectionRounds - 1) {
      roundPointer += 1;
      startRound();
      return;
    }
    showFinalResults();
  });
  if (elBtnGoRosco) {
    elBtnGoRosco.addEventListener("click", function () {
      stopResultsEntrefaseVideo();
      pauseElectionIntroMusic();
      pauseElectionBgMusic();
      window.PEKEHIME_SESSION.save(participants);
      window.location.href = "rosco.html";
    });
  }

  window.addEventListener("load", function () {
    tryPlayElectionIntroMusic();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (elIntro && !elIntro.classList.contains("hidden") && elElectionIntroMusic && elElectionIntroMusic.paused) {
      tryPlayElectionIntroMusic();
      return;
    }
    if (elScreen && !elScreen.classList.contains("hidden") && elElectionBgMusic && elElectionBgMusic.paused) {
      tryPlayElectionBgMusic();
    }
  });

  window.addEventListener("pagehide", function () {
    pauseElectionIntroMusic();
    pauseElectionBgMusic();
    hideElectionTimerUi();
    stopElectionVideo();
    stopResultsEntrefaseVideo();
  });
})();
