(() => {
  const { Game } = window.AGS_Game;
  const { UIManager } = window.AGS_UI;
  const { AudioManager } = window.AGS_Audio;

  const ui = new UIManager();
  const audio = new AudioManager();
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas, ui, audio);

  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const backMenuBtn = document.getElementById('backMenuBtn');
  const muteBtn = document.getElementById('muteBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  function startGame() {
    if (!game.assetsReady) return;
    audio.init();
    ui.showOverlay('menu', false);
    ui.showOverlay('ending', false);
    ui.showOverlay('gameOver', false);
    game.startNewRun();
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => game.restart());
  backMenuBtn.addEventListener('click', () => {
    ui.showOverlay('ending', false);
    ui.showOverlay('menu', true);
    game.state = 'menu';
  });

  pauseBtn.addEventListener('click', () => game.togglePause());

  function toggleMute() {
    const muted = audio.toggleMute();
    muteBtn.textContent = muted ? '🔇 Muet' : '🔊 Son';
  }
  muteBtn.addEventListener('click', toggleMute);

  window.AGS_Main = { toggleMute };

  game.run();

  async function initGame() {
    game.state = 'loading';
    startBtn.disabled = true;
    ui.showOverlay('loading', true);
    ui.showOverlay('menu', false);
    ui.updateLoading('Préparation des assets…', 0);

    const report = await game.loadAssets(({ loadedCount, failedCount, total, progress }) => {
      ui.updateLoading(`Chargement des assets (${loadedCount + failedCount}/${total})`, progress);
    });

    if (report.failedCount > 0) {
      ui.updateLoading(`Chargement terminé avec ${report.failedCount} ressource(s) manquante(s).`, 1);
      console.warn('[AGS] Démarrage en mode dégradé: certains visuels/sons utiliseront les fallbacks.');
    } else {
      ui.updateLoading('Chargement terminé.', 1);
    }

    setTimeout(() => {
      ui.showOverlay('loading', false);
      ui.showOverlay('menu', true);
      startBtn.disabled = false;
      game.state = 'menu';
    }, 250);
  }

  initGame();
})();
