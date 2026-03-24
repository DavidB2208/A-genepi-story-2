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

  game.state = 'menu';
  game.run();
})();
