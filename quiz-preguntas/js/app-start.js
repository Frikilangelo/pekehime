(function () {
  "use strict";

  const elStart = document.getElementById("start-screen");
  const elBtnStart = document.getElementById("btn-start");
  const elBtnShortcut = document.getElementById("btn-shortcut");
  const elBtnPeleitas = document.getElementById("btn-peleitas");
  const elParticipantName = document.getElementById("participant-name");
  const elBtnAddParticipant = document.getElementById("btn-add-participant");
  const elParticipantsList = document.getElementById("participants-list");
  const elStartMusic = document.getElementById("start-music");
  if (elStartMusic) elStartMusic.volume = 0.3;
  const elStartBgLayer = document.getElementById("start-bg-video-layer");
  const elStartBgVideo = document.getElementById("start-bg-video");
  const elStartPresentaVideo = document.getElementById("start-presenta-video");

  let participants = [];
  let startMusicRetryId = null;
  let startMusicRetryCount = 0;
  const MAX_START_MUSIC_RETRIES = 10;
  let usedMutedAutoplayBootstrap = false;
  let startMediaUnlockBound = false;
  let startVideosActivated = false;
  let startPresentaPlaybackCommitted = false;

  function stopStartMusicRetries() {
    if (startMusicRetryId !== null) {
      clearTimeout(startMusicRetryId);
      startMusicRetryId = null;
    }
    startMusicRetryCount = 0;
  }

  function scheduleStartMusicRetry() {
    if (
      startMusicRetryId !== null ||
      startMusicRetryCount >= MAX_START_MUSIC_RETRIES ||
      document.hidden
    ) {
      return;
    }

    startMusicRetryId = setTimeout(function () {
      startMusicRetryId = null;
      startMusicRetryCount += 1;
      tryPlayStartMusic();
    }, 1500);
  }

  function tryPlayStartMusic() {
    if (!elStartMusic) return;
    elStartMusic.autoplay = true;
    elStartMusic.loop = true;
    elStartMusic.muted = false;

    const maybePromise = elStartMusic.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;

    maybePromise
      .then(function () {
        stopStartMusicRetries();
      })
      .catch(function () {
        if (!usedMutedAutoplayBootstrap) {
          usedMutedAutoplayBootstrap = true;
          elStartMusic.muted = true;
          elStartMusic.play().catch(function () {});
        }
        scheduleStartMusicRetry();
      });
  }

  function showStartBackgroundVideo() {
    if (!elStartBgLayer) return;
    elStartBgLayer.classList.remove("hidden");
  }

  function playStartVideos() {
    if (elStartBgVideo) elStartBgVideo.play().catch(function () {});
    tryPlayStartPresentaVideo();
  }

  function tryPlayStartPresentaVideo() {
    if (!elStartPresentaVideo || startPresentaPlaybackCommitted) return;

    elStartPresentaVideo.muted = false;
    const maybePromise = elStartPresentaVideo.play();
    if (!maybePromise || typeof maybePromise.then !== "function") return;

    maybePromise.catch(function () {
      elStartPresentaVideo.muted = true;
      elStartPresentaVideo.play().catch(function () {});
    });
  }

  function unlockStartMediaAudio() {
    if (elStartPresentaVideo) {
      elStartPresentaVideo.muted = false;
      elStartPresentaVideo.play().catch(function () {});
    }
    if (elStartMusic) {
      elStartMusic.muted = false;
      elStartMusic.play().catch(function () {});
    }
    stopStartMusicRetries();
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
    const disabled = !hasParticipants();
    elBtnStart.disabled = disabled;
    if (elBtnShortcut) elBtnShortcut.disabled = disabled;
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
    participants.forEach(function (participant) {
      const li = document.createElement("li");
      li.className = "participants-item";
      li.textContent = participant.name;
      elParticipantsList.appendChild(li);
    });
    updateStartButtonState();
  }

  function addParticipant() {
    const name = cleanParticipantName(elParticipantName.value);
    if (!name) {
      elParticipantName.focus();
      return;
    }
    participants.push({ name: name, score: 0, priceScore: 0 });
    elParticipantName.value = "";
    renderParticipantsList();
    elParticipantName.focus();
  }

  function goToQuiz() {
    if (!hasParticipants()) return;
    window.PEKEHIME_SESSION.save(participants);
    window.location.href = "quiz.html";
  }

  function goToElectionShortcut() {
    if (!hasParticipants()) return;
    window.PEKEHIME_SESSION.save(participants);
    window.location.href = "eleccion.html";
  }

  function goToPeleitas() {
    window.location.href = "../Peleitas/index.html";
  }

  elStart.addEventListener("click", function (e) {
    if (
      e.target.closest("#btn-start") ||
      e.target.closest("#btn-shortcut") ||
      e.target.closest("#btn-peleitas")
    ) {
      return;
    }
    if (!startVideosActivated) startVideosActivated = true;
    playStartVideos();
    if (elStartMusic && elStartMusic.paused) tryPlayStartMusic();
  });

  elBtnStart.addEventListener("click", function () {
    goToQuiz();
  });

  if (elBtnShortcut) {
    elBtnShortcut.addEventListener("click", function () {
      goToElectionShortcut();
    });
  }

  if (elBtnPeleitas) {
    elBtnPeleitas.addEventListener("click", function () {
      goToPeleitas();
    });
  }

  elBtnAddParticipant.addEventListener("click", function () {
    addParticipant();
  });

  elParticipantName.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addParticipant();
  });

  window.addEventListener("load", function () {
    bindStartMediaUnlock();
    tryPlayStartMusic();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (elStart && !elStart.classList.contains("hidden")) {
      tryPlayStartMusic();
    }
  });

  renderParticipantsList();
  bindStartMediaUnlock();
  focusParticipantInput();
  showStartBackgroundVideo();
  tryPlayStartMusic();

  if (elStartPresentaVideo) {
    elStartPresentaVideo.addEventListener("playing", function () {
      startPresentaPlaybackCommitted = true;
    });
  }

  [elStartBgVideo, elStartPresentaVideo].forEach(function (el) {
    if (el) el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
})();
