(() => {
  class UIManager {
    constructor() {
      this.el = {
        hudNight: document.getElementById('hudNight'),
        hudTime: document.getElementById('hudTime'),
        hudStress: document.getElementById('hudStress'),
        hudGenepi: document.getElementById('hudGenepi'),
        hudKey: document.getElementById('hudKey'),
        hudTalisman: document.getElementById('hudTalisman'),
        hint: document.getElementById('interactionHint'),
        banner: document.getElementById('alertBanner'),
        loading: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        loadingProgress: document.getElementById('loadingProgress'),
        menu: document.getElementById('menuOverlay'),
        pause: document.getElementById('pauseOverlay'),
        night: document.getElementById('nightOverlay'),
        gameOver: document.getElementById('gameOverOverlay'),
        ending: document.getElementById('endingOverlay'),
        nightTitle: document.getElementById('nightTitle'),
        nightText: document.getElementById('nightText'),
        gameOverCause: document.getElementById('gameOverCause'),
        gameOverNight: document.getElementById('gameOverNight'),
      };

      this.bannerTimeout = null;
    }

    setHint(text) {
      this.el.hint.textContent = text || "Approche d'un objet.";
    }

    showBanner(text, danger = false, dur = 1600) {
      const b = this.el.banner;
      b.textContent = text;
      b.style.background = danger ? 'rgba(120,15,15,0.78)' : 'rgba(12,50,90,0.78)';
      b.classList.add('show');
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = setTimeout(() => b.classList.remove('show'), dur);
    }

    updateHUD(state) {
      this.el.hudNight.textContent = `${state.night}`;
      this.el.hudTime.textContent = state.time;
      this.el.hudStress.textContent = `${Math.round(state.stress)}%`;
      this.el.hudGenepi.textContent = state.genepiLabel;
      this.el.hudKey.textContent = state.hasKey ? 'Oui' : 'Non';
      this.el.hudTalisman.textContent = `${state.talismans}`;
      this.el.hudStress.style.color = state.stress > 75 ? '#ff8f8f' : state.stress > 45 ? '#ffd98a' : '#b4ffd1';
    }

    showOverlay(name, show) {
      if (!this.el[name]) return;
      this.el[name].classList.toggle('visible', show);
    }

    updateLoading(statusText, progress = null) {
      if (this.el.loadingText) {
        this.el.loadingText.textContent = statusText || 'Chargement...';
      }
      if (this.el.loadingProgress) {
        if (typeof progress === 'number') {
          this.el.loadingProgress.textContent = `${Math.round(progress * 100)}%`;
        } else {
          this.el.loadingProgress.textContent = '';
        }
      }
    }

    showNightCard(night, text) {
      this.el.nightTitle.textContent = `Nuit ${night}`;
      this.el.nightText.textContent = text;
      this.showOverlay('night', true);
    }

    showGameOver(cause, night) {
      this.el.gameOverCause.textContent = cause;
      this.el.gameOverNight.textContent = `Nuit atteinte : ${night}`;
      this.showOverlay('gameOver', true);
    }
  }

  window.AGS_UI = { UIManager };
})();
