(function (w) {
  "use strict";

  w.PEKEHIME_SESSION = {
    KEY: "pekehime_game_session_v1",
    save: function (participants) {
      sessionStorage.setItem(w.PEKEHIME_SESSION.KEY, JSON.stringify({ participants: participants }));
    },
    load: function () {
      try {
        const raw = sessionStorage.getItem(w.PEKEHIME_SESSION.KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.participants) || data.participants.length === 0) {
          return null;
        }
        return data.participants;
      } catch (e) {
        return null;
      }
    },
    clear: function () {
      try {
        sessionStorage.removeItem(w.PEKEHIME_SESSION.KEY);
      } catch (e) {}
    },
  };
})(window);
