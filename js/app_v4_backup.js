(() => {
  'use strict';

  const GAME_W = 1280;
  const GAME_H = 720;
  const SAVE_KEY = 'genepi-story-save-v6';
  const SESSION_KEY = 'genepi-story-session-v6';

  const $ = (id) => document.getElementById(id);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const nowSec = () => performance.now() / 1000;
  const fmtTime = (t) => {
    const s = Math.max(0, Math.ceil(t));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };
  const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

  const ASSETS = {
    backgrounds: {
      hall: 'assets/backgrounds/hall.png',
      corridorLeft: 'assets/backgrounds/corridor-left.png',
      corridorRight: 'assets/backgrounds/corridor-right.png',
      salon: 'assets/backgrounds/salon.png',
      office: 'assets/backgrounds/office.png',
      bedroom: 'assets/backgrounds/bedroom.png',
      map: 'assets/backgrounds/map.png',
    },
    sprites: {
      gabriel: 'assets/sprites/gabriel.png',
      genepi: 'assets/sprites/genepi.png',
      brother: 'assets/sprites/brother.png',
      yardena: 'assets/sprites/yardena.png',
      noa: 'assets/sprites/noa.png',
    },
    audio: {
      ambience: 'assets/audio/ambience.wav',
      brotherBed: 'assets/audio/brother-bed.wav',
      brotherGrowl: 'assets/audio/brother-growl.wav',
      yardenaKnock: 'assets/audio/yardena-knock.wav',
      yardenaHandle: 'assets/audio/yardena-handle.wav',
      noaWind: 'assets/audio/noa-wind.mp3',
      noaWindow: 'assets/audio/noa-window.wav',
    },
  };

  const NOTES = {
    hallRule: {
      title: 'Mot près de la porte',
      text: `"Si la bouteille est bien visible sur le lit, personne ne s’inquiète."

Quelqu’un a souligné trois fois le mot visible. La phrase paraît absurde... mais peut-être utile contre Yardena.`,
    },
    officeBoard: {
      title: 'Post-it du bureau',
      text: `"Quand le vent commence à souffler : fermer les rideaux, allumer le PC, relancer LoL. Toujours."

Un coin du papier est griffonné avec une phrase presque effacée : "Ne laisse pas Noa voir l’intérieur."`,
    },
    salonBook: {
      title: 'Page arrachée',
      text: `"Le stress te ralentit. Respire. Éloigne-toi des menaces quelques secondes si possible."

Une autre ligne : "Ariel ne cherche pas seulement Gabriel. Il veut surtout la génépi."`,
    },
    corridorBoard: {
      title: 'Tableau d’affichage',
      text: `On a collé des notes sans suite logique :
- Bruits au lit → placard.
- Toc toc + poignée → lit + serrure.
- Vent + silhouette → rideaux + LoL.

Quelqu’un connaissait déjà les règles.`,
    },
  };

  const NIGHTS = {
    1: {
      name: 'Nuit 1',
      duration: 110,
      description: 'Ariel rôde déjà dans la maison. Apprends à déplacer la génépi sans pression.',
      objective: 'Éloigner la génépi d’Ariel',
      monsters: ['brother'],
      maxConcurrent: 1,
      stressDrift: 2.6,
      falseSignals: false,
    },
    2: {
      name: 'Nuit 2',
      duration: 130,
      description: 'Yardena frappe à la porte. Verrouille-la avant qu’elle n’entre.',
      objective: 'Gérer Ariel + Yardena',
      monsters: ['brother', 'yardena'],
      maxConcurrent: 1,
      stressDrift: 2.9,
      falseSignals: false,
    },
    3: {
      name: 'Nuit 3',
      duration: 145,
      description: 'Noa surveille la fenêtre du bureau. Ferme-la vite et garde ton calme.',
      objective: 'Gérer Ariel + Noa',
      monsters: ['brother', 'noa'],
      maxConcurrent: 1,
      stressDrift: 3.2,
      falseSignals: false,
    },
    4: {
      name: 'Nuit 4',
      duration: 165,
      description: 'Les trois menaces sont actives, mais elles restent plus lisibles et moins agressives.',
      objective: 'Prioriser sans paniquer',
      monsters: ['brother', 'yardena', 'noa'],
      maxConcurrent: 2,
      stressDrift: 3.6,
      falseSignals: false,
    },
    5: {
      name: 'Nuit 5',
      duration: 185,
      description: 'La pression monte, mais les fenêtres et la porte laissent plus de marge qu’avant.',
      objective: 'Survivre à la nuit avancée',
      monsters: ['brother', 'yardena', 'noa'],
      maxConcurrent: 2,
      stressDrift: 4.1,
      falseSignals: false,
    },
    6: {
      name: 'Nuit 6 bonus',
      duration: 210,
      description: 'Mode bonus : quelques faux signaux, mais une difficulté encore jouable.',
      objective: 'Nuit bonus',
      monsters: ['brother', 'yardena', 'noa'],
      maxConcurrent: 2,
      stressDrift: 4.5,
      falseSignals: true,
      hallucinations: false,
    },
  };

  const ROOM_IDS = {
    HALL: 'hall',
    LEFT: 'corridorLeft',
    RIGHT: 'corridorRight',
    SALON: 'salon',
    OFFICE: 'office',
    BEDROOM: 'bedroom',
  };

  function rect(x, y, w, h) { return { x, y, w, h }; }
  function rectDist(r, x, y) {
    const cx = clamp(x, r.x, r.x + r.w);
    const cy = clamp(y, r.y, r.y + r.h);
    return Math.hypot(x - cx, y - cy);
  }
  function rectCenter(r) {
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  const ROOMS = {
    [ROOM_IDS.HALL]: {
      id: ROOM_IDS.HALL,
      name: 'Entrée / Hall',
      bg: ASSETS.backgrounds.hall,
      ambientDark: 0.12,
      spawn: { x: 640, y: 590 },
      bounds: { minX: 75, maxX: 1205, minY: 205, maxY: 665 },
      adjacent: [ROOM_IDS.LEFT, ROOM_IDS.RIGHT],
      colliders: [
        rect(315, 260, 160, 150),
        rect(900, 260, 185, 160),
        rect(495, 120, 285, 255),
      ],
      hotspots: [
        { id: 'hall-left', type: 'room', target: ROOM_IDS.LEFT, label: 'Passage vers le couloir gauche', area: rect(55, 120, 180, 330), anchor: { x: 175, y: 430 }, spawn: { x: 640, y: 620 }, hold: 0.22, doorKind: 'passage' },
        { id: 'hall-right', type: 'room', target: ROOM_IDS.RIGHT, label: 'Passage vers le couloir droit', area: rect(1045, 120, 180, 330), anchor: { x: 1105, y: 430 }, spawn: { x: 640, y: 620 }, hold: 0.22, doorKind: 'passage' },
        { id: 'front-door', type: 'frontDoor', label: 'Porte d’entrée', area: rect(475, 95, 330, 275), hold: 0.16 },
        { id: 'hall-note', type: 'note', noteId: 'hallRule', label: 'Lire le mot', area: rect(220, 455, 170, 120), anchor: { x: 305, y: 515 }, hold: 0.18 },
        { id: 'hall-shelf', type: 'stash', stashKey: 'hallShelf', label: 'Meuble d’entrée', area: rect(825, 485, 250, 120), anchor: { x: 950, y: 545 }, hold: 0.2 },
        { id: 'hall-ward', type: 'pickup', itemId: 'yardenaWard', label: 'Ramasser le talisman de Yardena', area: rect(610, 520, 140, 80), anchor: { x: 680, y: 560 }, hold: 0.18 },
      ],
    },
    [ROOM_IDS.LEFT]: {
      id: ROOM_IDS.LEFT,
      name: 'Couloir gauche',
      bg: ASSETS.backgrounds.corridorLeft,
      ambientDark: 0.22,
      spawn: { x: 640, y: 610 },
      bounds: { minX: 120, maxX: 1160, minY: 215, maxY: 670 },
      adjacent: [ROOM_IDS.HALL, ROOM_IDS.SALON],
      colliders: [
        rect(0, 490, 270, 220),
        rect(1000, 520, 280, 180),
      ],
      hotspots: [
        { id: 'left-hall', type: 'room', target: ROOM_IDS.HALL, label: 'Retour vers le hall', area: rect(360, 500, 560, 170), anchor: { x: 640, y: 520 }, spawn: { x: 165, y: 560 }, hold: 0.22, doorKind: 'passage' },
        { id: 'left-salon', type: 'room', target: ROOM_IDS.SALON, label: 'Porte du salon', area: rect(465, 45, 350, 215), anchor: { x: 640, y: 235 }, spawn: { x: 1090, y: 585 }, hold: 0.16, doorKind: 'door' },
        { id: 'left-note', type: 'note', noteId: 'corridorBoard', label: 'Lire le tableau', area: rect(980, 325, 200, 120), anchor: { x: 1080, y: 385 }, hold: 0.18 },
      ],
    },
    [ROOM_IDS.RIGHT]: {
      id: ROOM_IDS.RIGHT,
      name: 'Couloir droit',
      bg: ASSETS.backgrounds.corridorRight,
      ambientDark: 0.16,
      spawn: { x: 640, y: 610 },
      bounds: { minX: 105, maxX: 1175, minY: 215, maxY: 670 },
      adjacent: [ROOM_IDS.HALL, ROOM_IDS.OFFICE, ROOM_IDS.BEDROOM],
      colliders: [
        rect(0, 500, 190, 220),
        rect(1080, 520, 200, 200),
        rect(430, 0, 420, 130),
      ],
      hotspots: [
        { id: 'right-hall', type: 'room', target: ROOM_IDS.HALL, label: 'Retour vers le hall', area: rect(360, 500, 560, 170), anchor: { x: 640, y: 520 }, spawn: { x: 1105, y: 560 }, hold: 0.22, doorKind: 'passage' },
        { id: 'right-office', type: 'room', target: ROOM_IDS.OFFICE, label: 'Porte du bureau', area: rect(40, 110, 240, 300), anchor: { x: 165, y: 420 }, spawn: { x: 1070, y: 600 }, hold: 0.16, doorKind: 'door' },
        { id: 'right-bedroom', type: 'room', target: ROOM_IDS.BEDROOM, label: 'Porte de la chambre', area: rect(1015, 110, 230, 300), anchor: { x: 1115, y: 420 }, spawn: { x: 815, y: 600 }, hold: 0.16, doorKind: 'door' },
      ],
    },
    [ROOM_IDS.SALON]: {
      id: ROOM_IDS.SALON,
      name: 'Salon',
      bg: ASSETS.backgrounds.salon,
      ambientDark: 0.24,
      spawn: { x: 820, y: 600 },
      bounds: { minX: 95, maxX: 1185, minY: 240, maxY: 665 },
      adjacent: [ROOM_IDS.LEFT],
      colliders: [
        rect(0, 255, 365, 320),
        rect(338, 360, 330, 165),
        rect(865, 180, 235, 250),
        rect(1110, 100, 170, 360),
      ],
      hotspots: [
        { id: 'salon-exit', type: 'room', target: ROOM_IDS.LEFT, label: 'Porte du couloir', area: rect(1030, 95, 205, 330), anchor: { x: 1120, y: 430 }, spawn: { x: 640, y: 250 }, hold: 0.16, doorKind: 'door' },
        { id: 'salon-book', type: 'note', noteId: 'salonBook', label: 'Lire le livre ouvert', area: rect(915, 560, 145, 70), anchor: { x: 988, y: 595 }, hold: 0.18 },
        { id: 'salon-table', type: 'stash', stashKey: 'salonTable', label: 'Table basse', area: rect(700, 500, 190, 105), anchor: { x: 790, y: 550 }, hold: 0.2 },
        { id: 'salon-ward', type: 'pickup', itemId: 'roomWard', label: 'Ramasser le talisman de salle', area: rect(700, 610, 180, 50), anchor: { x: 790, y: 635 }, hold: 0.18 },
      ],
    },
    [ROOM_IDS.OFFICE]: {
      id: ROOM_IDS.OFFICE,
      name: 'Bureau',
      bg: ASSETS.backgrounds.office,
      ambientDark: 0.23,
      spawn: { x: 805, y: 610 },
      bounds: { minX: 90, maxX: 1180, minY: 240, maxY: 670 },
      adjacent: [ROOM_IDS.RIGHT],
      colliders: [
        rect(410, 250, 450, 230),
        rect(995, 100, 205, 330),
      ],
      hotspots: [
        { id: 'office-exit', type: 'room', target: ROOM_IDS.RIGHT, label: 'Porte du couloir', area: rect(1000, 95, 220, 325), anchor: { x: 1105, y: 430 }, spawn: { x: 165, y: 560 }, hold: 0.16, doorKind: 'door' },
        { id: 'office-curtains', type: 'curtain', label: 'Rideaux', area: rect(0, 95, 310, 315), hold: 0.2 },
        { id: 'office-pc', type: 'pc', label: 'PC / lancer LoL', area: rect(430, 205, 420, 185), hold: 0.22 },
        { id: 'office-desk', type: 'desk', label: 'Bureau', area: rect(430, 500, 270, 120), anchor: { x: 565, y: 560 }, hold: 0.2 },
        { id: 'office-note', type: 'note', noteId: 'officeBoard', label: 'Lire les post-it', area: rect(860, 160, 160, 110), anchor: { x: 940, y: 215 }, hold: 0.18 },
        { id: 'office-ward', type: 'pickup', itemId: 'noaWard', label: 'Ramasser le talisman de Noa', area: rect(905, 535, 180, 70), anchor: { x: 995, y: 570 }, hold: 0.18 },
      ],
    },
    [ROOM_IDS.BEDROOM]: {
      id: ROOM_IDS.BEDROOM,
      name: 'Chambre',
      bg: ASSETS.backgrounds.bedroom,
      ambientDark: 0.2,
      spawn: { x: 720, y: 610 },
      bounds: { minX: 90, maxX: 1185, minY: 235, maxY: 670 },
      adjacent: [ROOM_IDS.RIGHT],
      colliders: [
        rect(705, 255, 345, 275),
        rect(1030, 110, 225, 380),
      ],
      hotspots: [
        { id: 'bedroom-exit', type: 'room', target: ROOM_IDS.RIGHT, label: 'Porte du couloir', area: rect(675, 110, 260, 320), anchor: { x: 800, y: 430 }, spawn: { x: 1110, y: 560 }, hold: 0.28, doorKind: 'door' },
        { id: 'bedroom-bed', type: 'bed', label: 'Lit', area: rect(705, 250, 350, 275), hold: 0.35 },
        { id: 'bedroom-closet', type: 'closet', label: 'Placard', area: rect(1025, 95, 235, 390), hold: 0.35 },
        { id: 'bedroom-window', type: 'window', label: 'Fenêtre', area: rect(0, 100, 320, 260), hold: 0.25 },
        { id: 'bedroom-ward', type: 'pickup', itemId: 'arielWard', label: 'Ramasser le talisman d\'Ariel', area: rect(1040, 120, 185, 160), hold: 0.28 },
      ],
    },
  };

  const MONSTERS = {
    brother: {
      id: 'brother',
      name: 'Ariel',
      roomId: ROOM_IDS.BEDROOM,
      sprite: ASSETS.sprites.brother,
      sounds: { cue: 'brotherGrowl', stage2: 'brotherBed' },
      cueText: 'Ariel rôde près de la chambre…',
      stage1Text: 'Ariel fouille la chambre. Emporte la génépi dans une autre pièce.',
      stage2Text: 'Ariel est tout près ! Éloigne la génépi de la chambre.',
      failText: 'Ariel t’a rattrapé avant que tu quittes la chambre avec la génépi.',
      position: { x: 955, y: 650 },
      scale: { cue: 0.15, stage1: 0.2, stage2: 0.25 },
      alpha: { cue: 0.16, stage1: 0.38, stage2: 0.72 },
      timings: { cue: 5.8, stage1: 11.2, stage2: 6.4 },
      cooldown: [26, 42],
    },
    yardena: {
      id: 'yardena',
      name: 'Yardena',
      roomId: ROOM_IDS.HALL,
      sprite: ASSETS.sprites.yardena,
      sounds: { cue: 'yardenaKnock', stage2: 'yardenaHandle' },
      cueText: 'Toc toc… Yardena est devant la porte d’entrée.',
      stage1Text: 'La poignée bouge. Verrouille simplement la porte d’entrée.',
      stage2Text: 'La porte s’entrebâille. Verrouille-la vite !',
      failText: 'Yardena a forcé la porte d’entrée du hall.',
      position: { x: 640, y: 655 },
      scale: { cue: 0.13, stage1: 0.19, stage2: 0.27 },
      alpha: { cue: 0.14, stage1: 0.34, stage2: 0.78 },
      timings: { cue: 5.2, stage1: 9.5, stage2: 5.4 },
      cooldown: [28, 44],
    },
    noa: {
      id: 'noa',
      name: 'Noa',
      roomId: ROOM_IDS.OFFICE,
      sprite: ASSETS.sprites.noa,
      sounds: { cue: 'noaWind', stage2: 'noaWindow' },
      cueText: 'Un vent étrange se lève près de la fenêtre.',
      stage1Text: 'Une silhouette se dessine. Ferme la fenêtre / les rideaux.',
      stage2Text: 'Noa colle son visage à la vitre. Ferme vite.',
      failText: 'Noa t’a surpris devant la fenêtre restée ouverte.',
      position: { x: 245, y: 650 },
      scale: { cue: 0.15, stage1: 0.23, stage2: 0.31 },
      alpha: { cue: 0.16, stage1: 0.38, stage2: 0.8 },
      timings: { cue: 5.4, stage1: 10.2, stage2: 5.8 },
      cooldown: [30, 46],
    },
  };

  const ITEM_DEFS = {
    arielWard: {
      id: 'arielWard',
      name: 'Talisman d\'Ariel',
      short: 'Ariel',
      desc: 'Repousse immédiatement Ariel une fois.',
      color: '#b57aff',
    },
    yardenaWard: {
      id: 'yardenaWard',
      name: 'Talisman de Yardena',
      short: 'Yardena',
      desc: 'Repousse immédiatement Yardena une fois.',
      color: '#ffd36d',
    },
    noaWard: {
      id: 'noaWard',
      name: 'Talisman de Noa',
      short: 'Noa',
      desc: 'Repousse immédiatement Noa une fois.',
      color: '#78d4ff',
    },
    roomWard: {
      id: 'roomWard',
      name: 'Talisman de salle',
      short: 'Salle',
      desc: 'Sanctifie la salle actuelle pendant quelques secondes.',
      color: '#7ff0a3',
    },
  };

  const WORLD_ITEM_LAYOUT = {
    yardenaWard: { roomId: ROOM_IDS.HALL, x: 680, y: 560 },
    roomWard: { roomId: ROOM_IDS.SALON, x: 790, y: 635 },
    noaWard: { roomId: ROOM_IDS.OFFICE, x: 995, y: 570 },
    arielWard: { roomId: ROOM_IDS.BEDROOM, x: 480, y: 580 },
  };

  const SAFE_ROOM_DURATION = 30;

  function defaultSave() {
    return {
      unlockedNight: 1,
      settings: { volume: 80, brightness: 100, muted: false },
    };
  }

  function loadSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return Object.assign(defaultSave(), parsed || {});
    } catch {
      return defaultSave();
    }
  }

  function savePersistent(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }

  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  class AudioSystem {
    constructor(game) {
      this.game = game;
      this.paths = ASSETS.audio;
      this.cache = {};
      this.enabled = false;
      this.master = 0.8;
      this.muted = false;
      this.bgm = null;
    }

    unlock() {
      if (this.enabled) return;
      this.enabled = true;
      this.bgm = new Audio(this.paths.ambience);
      this.bgm.loop = true;
      this.bgm.volume = this.muted ? 0 : this.master * 0.22;
      this.bgm.play().catch(() => {});
    }

    setMaster(v) {
      this.master = clamp(v, 0, 1);
      if (this.bgm) this.bgm.volume = this.muted ? 0 : this.master * 0.22;
    }

    setMuted(flag) {
      this.muted = !!flag;
      if (this.bgm) this.bgm.volume = this.muted ? 0 : this.master * 0.22;
    }

    roomVolume(roomId) {
      if (!roomId || !this.game.roomId) return 0.7;
      const dist = this.game.roomDistance(this.game.roomId, roomId);
      if (dist <= 0) return 1;
      if (dist === 1) return 0.58;
      return 0.28;
    }

    play(name, opts = {}) {
      if (this.muted || !this.enabled) return;
      const src = this.paths[name];
      if (!src) return;
      const a = new Audio(src);
      const roomFactor = this.roomVolume(opts.roomId || null);
      const base = opts.volume ?? 0.72;
      a.volume = clamp(base * roomFactor * this.master, 0, 1);
      a.play().catch(() => {});
    }
  }

  class Game {
    constructor() {
      this.canvas = $('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = GAME_W;
      this.canvas.height = GAME_H;

      this.ui = {
        menuPanel: $('menuPanel'), gamePanel: $('gamePanel'),
        nightSelect: $('nightSelect'), menuDescription: $('menuDescription'),
        startBtn: $('startBtn'), resumeBtn: $('resumeBtn'),
        volumeRange: $('volumeRange'), volumeValue: $('volumeValue'),
        brightnessRange: $('brightnessRange'), brightnessValue: $('brightnessValue'),
        muteBtn: $('muteBtn'), resetSaveBtn: $('resetSaveBtn'),
        nightLabel: $('nightLabel'), roomLabel: $('roomLabel'), timeLabel: $('timeLabel'),
        objectiveLabel: $('objectiveLabel'), genepiLabel: $('genepiLabel'), doorLabel: $('doorLabel'),
        pcLabel: $('pcLabel'), curtainLabel: $('curtainLabel'), stressBar: $('stressBar'),
        stressValue: $('stressValue'), interactionBar: $('interactionBar'), interactionLabel: $('interactionLabel'),
        alertsList: $('alertsList'), hint: $('hint'), stateBadge: $('stateBadge'), journalList: $('journalList'),
        banner: $('banner'), mapOverlay: $('mapOverlay'), journalOverlay: $('journalOverlay'),
        noteOverlay: $('noteOverlay'), pauseOverlay: $('pauseOverlay'), gameOverOverlay: $('gameOverOverlay'),
        nightClearOverlay: $('nightClearOverlay'), mapRoomText: $('mapRoomText'), journalContent: $('journalContent'),
        noteTitle: $('noteTitle'), noteBody: $('noteBody'), gameOverTitle: $('gameOverTitle'),
        gameOverReason: $('gameOverReason'), backToMenuBtn: $('backToMenuBtn'), nightClearTitle: $('nightClearTitle'),
        nightClearText: $('nightClearText'), nightContinueBtn: $('nightContinueBtn'), debugPanel: $('debugPanel'),
        sprintLabel: $('sprintLabel'), inventoryMini: $('inventoryMini'), safeRoomLabel: $('safeRoomLabel'),
      };

      this.save = loadSave();
      this.session = loadSession();
      this.assets = { images: {} };
      this.audio = new AudioSystem(this);
      this.audio.setMaster(this.save.settings.volume / 100);
      this.audio.setMuted(this.save.settings.muted);

      this.keys = new Set();
      this.lastTs = 0;
      this.state = 'menu';
      this.overlay = null; // map journal note pause gameover nightclear
      this.banner = { text: '', t: 0, duration: 0 };
      this.flash = 0;
      this.screenShake = 0;
      this.hallucinationTimer = rand(10, 18);
      this.falseSignalTimer = rand(12, 20);
      this.debug = false;

      this.unlockedNight = clamp(this.save.unlockedNight || 1, 1, 6);
      this.selectedNight = this.unlockedNight;
      this.populateNightSelect();
      this.applySettingsToUi();
      this.updateMenuDescription();

      this.resetRuntime();
      this.bindEvents();
    }

    resetRuntime() {
      this.night = 1;
      this.roomId = ROOM_IDS.HALL;
      this.player = { x: 640, y: 590, vx: 0, vy: 0, radius: 19, facing: 1, bob: 0, sprint: false, stepT: 0 };
      this.genepiLocation = 'bed';
      this.genepiCarryCooldown = 0;
      this.hallDoorLocked = false;
      this.pcOn = false;
      this.pcTimer = 0;
      this.curtainsClosed = false;
      this.stress = 8;
      this.timeLeft = 0;
      this.currentNightCfg = NIGHTS[1];
      this.monsters = {};
      this.interactionTarget = null;
      this.interactionProgress = 0;
      this.interactionMode = 'object';
      this.currentNote = null;
      this.discoveredNotes = [];
      this.discoveredSet = new Set();
      this.journalEntries = [];
      this.failureMonster = null;
      this.failureText = '';
      this.transitionCooldown = 0;
      this.inventory = [];
      this.selectedSlot = 0;
      this.worldItems = Object.fromEntries(Object.entries(WORLD_ITEM_LAYOUT).map(([id, pos]) => [id, { ...pos, picked: false }]));
      this.safeRoom = null;
      this.safeRoomFxPulse = 0;
      this.safeRoomBannerLock = 0;
    }

    async loadAssets() {
      const allImages = Object.values(ASSETS.backgrounds).concat(Object.values(ASSETS.sprites));
      await Promise.all(allImages.map((src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { this.assets.images[src] = img; resolve(); };
        img.onerror = reject;
        img.src = src;
      })));
    }

    bindEvents() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)) e.preventDefault();
        if (e.code === 'KeyF') {
          e.preventDefault();
          this.useSelectedItem();
          return;
        }
        if (/^Digit[1-4]$/.test(e.code)) {
          this.selectedSlot = clamp(Number(e.code.slice(-1)) - 1, 0, 3);
          return;
        }
        if (this.overlay === 'note' && (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter')) {
          this.closeOverlay();
          return;
        }
        if ((this.overlay === 'map' || this.overlay === 'journal') && (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyJ')) {
          this.closeOverlay();
          return;
        }
        if (this.overlay === 'pause' && e.code === 'Escape') {
          this.closeOverlay();
          this.state = 'playing';
          return;
        }
        if ((this.overlay === 'gameover' || this.overlay === 'nightclear') && e.code === 'Enter') {
          this.backToMenu();
          return;
        }
        if (e.code === 'Escape' && this.state === 'playing' && !this.overlay) {
          this.overlay = 'pause';
          this.state = 'paused';
          return;
        }
        if (e.code === 'Tab' && this.state === 'playing' && !this.overlay) {
          this.overlay = 'map';
          return;
        }
        if (e.code === 'KeyJ' && this.state === 'playing' && !this.overlay) {
          this.overlay = 'journal';
          return;
        }
        if (e.code === 'F1') {
          this.debug = !this.debug;
          this.ui.debugPanel.classList.toggle('hidden', !this.debug);
          return;
        }
        if (e.code === 'KeyM') {
          this.save.settings.muted = !this.save.settings.muted;
          this.audio.setMuted(this.save.settings.muted);
          this.persistSettings();
          this.applySettingsToUi();
        }
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });

      this.ui.startBtn.addEventListener('click', () => { this.audio.unlock(); this.startNight(this.selectedNight); });
      this.ui.resumeBtn.addEventListener('click', () => {
        this.audio.unlock();
        if (!this.resumeSession()) this.startNight(this.selectedNight);
      });
      this.ui.nightSelect.addEventListener('change', () => {
        this.selectedNight = Number(this.ui.nightSelect.value);
        this.updateMenuDescription();
      });
      this.ui.volumeRange.addEventListener('input', () => {
        this.save.settings.volume = Number(this.ui.volumeRange.value);
        this.audio.setMaster(this.save.settings.volume / 100);
        this.persistSettings();
        this.applySettingsToUi();
      });
      this.ui.brightnessRange.addEventListener('input', () => {
        this.save.settings.brightness = Number(this.ui.brightnessRange.value);
        this.persistSettings();
        this.applySettingsToUi();
      });
      this.ui.muteBtn.addEventListener('click', () => {
        this.save.settings.muted = !this.save.settings.muted;
        this.audio.setMuted(this.save.settings.muted);
        this.persistSettings();
        this.applySettingsToUi();
      });
      this.ui.resetSaveBtn.addEventListener('click', () => {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(SESSION_KEY);
        this.save = defaultSave();
        this.unlockedNight = 1;
        this.selectedNight = 1;
        this.populateNightSelect();
        this.persistSettings();
        this.applySettingsToUi();
        this.setBanner('Sauvegarde réinitialisée.', 2.2);
      });
      this.ui.backToMenuBtn.addEventListener('click', () => this.backToMenu());
      this.ui.nightContinueBtn.addEventListener('click', () => this.backToMenu());
      document.querySelectorAll('[data-debug]').forEach((btn) => {
        btn.addEventListener('click', () => this.debugAction(btn.dataset.debug));
      });
    }

    persistSettings() {
      this.save.unlockedNight = this.unlockedNight;
      savePersistent(this.save);
    }

    populateNightSelect() {
      const sel = this.ui.nightSelect;
      sel.innerHTML = '';
      for (let i = 1; i <= this.unlockedNight; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = NIGHTS[i].name;
        sel.appendChild(opt);
      }
      this.selectedNight = clamp(this.selectedNight, 1, this.unlockedNight);
      sel.value = String(this.selectedNight);
      this.ui.resumeBtn.disabled = !loadSession();
    }

    updateMenuDescription() {
      this.ui.menuDescription.textContent = NIGHTS[this.selectedNight].description;
    }

    applySettingsToUi() {
      this.ui.volumeRange.value = String(this.save.settings.volume);
      this.ui.brightnessRange.value = String(this.save.settings.brightness);
      this.ui.volumeValue.textContent = `${this.save.settings.volume}%`;
      this.ui.brightnessValue.textContent = `${this.save.settings.brightness}%`;
      this.ui.muteBtn.textContent = this.save.settings.muted ? '🔇 Son coupé' : '🔊 Son actif';
    }

    roomDistance(a, b) {
      if (a === b) return 0;
      const seen = new Set([a]);
      const q = [{ room: a, d: 0 }];
      while (q.length) {
        const { room, d } = q.shift();
        for (const nxt of ROOMS[room].adjacent) {
          if (nxt === b) return d + 1;
          if (!seen.has(nxt)) { seen.add(nxt); q.push({ room: nxt, d: d + 1 }); }
        }
      }
      return 3;
    }

    isDoorHotspot(h) {
      return !!h && (h.type === 'room' || h.type === 'frontDoor');
    }

    promptKey(h) {
      if (!h) return '';
      return this.isDoorHotspot(h) ? 'R' : 'E';
    }

    activePrompt(kind = 'all') {
      if (this.transitionCooldown > 0) return null;
      const room = ROOMS[this.roomId];
      let best = null;
      let bestDist = Infinity;
      for (const h of room.hotspots) {
        const isDoor = this.isDoorHotspot(h);
        if (kind === 'door' && !isDoor) continue;
        if (kind === 'object' && isDoor) continue;
        if (h.type === 'pickup' && !this.canPickupItem(h.itemId)) continue;
        const d = this.hotspotDistance(h);
        const maxDist = h.maxDistance || (isDoor ? 130 : 140);
        if (d < maxDist && d < bestDist) {
          best = h;
          bestDist = d;
        }
      }
      return best;
    }

    genepiRoom() {
      const roomByLocation = {
        bed: ROOM_IDS.BEDROOM,
        closet: ROOM_IDS.BEDROOM,
        desk: ROOM_IDS.OFFICE,
        hallShelf: ROOM_IDS.HALL,
        salonTable: ROOM_IDS.SALON,
      };
      if (this.genepiLocation === 'carried') return this.roomId;
      return roomByLocation[this.genepiLocation] || null;
    }

    openOverlay(name) { this.overlay = name; }
    closeOverlay() {
      this.overlay = null;
      if (this.state === 'paused') this.state = 'playing';
    }

    setBanner(text, duration = 2.5) {
      this.banner.text = text;
      this.banner.t = duration;
      this.banner.duration = duration;
    }

    addJournal(title, body) {
      if (this.journalEntries.some((j) => j.title === title)) return;
      this.journalEntries.push({ title, body });
    }

    discoverNote(noteId) {
      if (this.discoveredSet.has(noteId)) return;
      this.discoveredSet.add(noteId);
      this.discoveredNotes.push(noteId);
      this.addJournal(NOTES[noteId].title, NOTES[noteId].text);
      this.setBanner(`Nouvelle note : ${NOTES[noteId].title}`, 2.2);
    }

    hasInventorySpace() { return this.inventory.length < 4; }

    canPickupItem(itemId) {
      return !!this.worldItems[itemId] && !this.worldItems[itemId].picked && this.hasInventorySpace();
    }

    pickupItem(itemId) {
      if (!this.canPickupItem(itemId)) {
        this.setBanner(this.hasInventorySpace() ? 'Cet objet a déjà été récupéré.' : 'Inventaire plein (4 objets max).', 1.6);
        return;
      }
      this.worldItems[itemId].picked = true;
      this.inventory.push(itemId);
      this.selectedSlot = this.inventory.length - 1;
      const def = ITEM_DEFS[itemId];
      this.addJournal(def.name, def.desc);
      this.setBanner(`${def.name} ajouté à l’inventaire.`, 1.8);
    }

    useSelectedItem() {
      if (this.state !== 'playing' || this.isInputBlocked()) return;
      const itemId = this.inventory[this.selectedSlot];
      if (!itemId) {
        this.setBanner('Aucun talisman sélectionné.', 1.2);
        return;
      }
      if (this.tryUseItem(itemId)) {
        this.inventory.splice(this.selectedSlot, 1);
        this.selectedSlot = clamp(this.selectedSlot, 0, Math.max(0, this.inventory.length - 1));
      }
    }

    tryUseItem(itemId) {
      const def = ITEM_DEFS[itemId];
      if (!def) return false;
      if (itemId === 'arielWard') {
        const m = this.monsters.brother;
        if (!m || m.state === 'cooldown') { this.setBanner('Ariel n’est pas en chasse pour le moment.', 1.4); return false; }
        this.resolveMonster('brother', m.state === 'stage2');
        this.flash = Math.max(this.flash, 0.22);
        this.setBanner('Le talisman d’Ariel repousse la présence qui traquait la génépi.', 2.1);
        return true;
      }
      if (itemId === 'yardenaWard') {
        const m = this.monsters.yardena;
        if (!m || m.state === 'cooldown') { this.setBanner('Yardena n’est pas active pour le moment.', 1.4); return false; }
        this.resolveMonster('yardena', m.state === 'stage2');
        this.hallDoorLocked = true;
        this.flash = Math.max(this.flash, 0.18);
        this.setBanner('Le talisman de Yardena scelle brièvement son passage.', 2.1);
        return true;
      }
      if (itemId === 'noaWard') {
        const m = this.monsters.noa;
        if (!m || m.state === 'cooldown') { this.setBanner('Noa ne hante aucune fenêtre pour le moment.', 1.4); return false; }
        this.resolveMonster('noa', m.state === 'stage2');
        this.curtainsClosed = true;
        this.pcOn = true;
        this.pcTimer = Math.max(this.pcTimer, 14);
        this.flash = Math.max(this.flash, 0.2);
        this.setBanner('Le talisman de Noa brise sa manifestation à la fenêtre.', 2.1);
        return true;
      }
      if (itemId === 'roomWard') {
        this.safeRoom = { roomId: this.roomId, timer: SAFE_ROOM_DURATION };
        this.safeRoomBannerLock = 0;
        this.flash = Math.max(this.flash, 0.16);
        this.setBanner(`La salle ${ROOMS[this.roomId].name} est sanctifiée pour ${SAFE_ROOM_DURATION}s.`, 2.4);
        Object.keys(this.monsters).forEach((id) => {
          const m = this.monsters[id];
          if (m && m.state !== 'cooldown' && MONSTERS[id].roomId === this.roomId) this.resolveMonster(id, m.state === 'stage2');
        });
        return true;
      }
      return false;
    }

    isSafeRoomActive(roomId = this.roomId) {
      return !!this.safeRoom && this.safeRoom.timer > 0 && this.safeRoom.roomId === roomId;
    }

    baseMonsterState(id) {
      const def = MONSTERS[id];
      const speedScale = Math.max(0.72, 1 - (this.night - 1) * 0.05 - (this.night === 6 ? 0.04 : 0));
      return {
        id,
        state: 'cooldown',
        timer: rand(def.cooldown[0], def.cooldown[1]) * speedScale,
        speedScale,
        resolvedCount: 0,
        showUntil: 0,
      };
    }

    createMonsterStates(monsterIds) {
      this.monsters = {};
      monsterIds.forEach((id) => { this.monsters[id] = this.baseMonsterState(id); });
    }

    startNight(n) {
      this.resetRuntime();
      this.night = n;
      this.currentNightCfg = NIGHTS[n];
      this.state = 'playing';
      this.overlay = null;
      this.roomId = ROOM_IDS.HALL;
      this.player.x = ROOMS[this.roomId].spawn.x;
      this.player.y = ROOMS[this.roomId].spawn.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.timeLeft = this.currentNightCfg.duration;
      this.falseSignalTimer = rand(10, 17);
      this.hallucinationTimer = rand(12, 20);
      this.stress = n <= 3 ? 4 : 7;
      this.createMonsterStates(this.currentNightCfg.monsters);
      this.genepiLocation = 'bed';
      this.hallDoorLocked = false;
      this.pcOn = false;
      this.pcTimer = 0;
      this.curtainsClosed = false;
      this.addJournal('Règles de base', 'Ariel → déplacer ou cacher la génépi.\nYardena → porte verrouillée + génépi sur le lit.\nNoa → rideaux fermés + LoL actif.');
      this.addJournal('Talismans', 'Des talismans sont dispersés dans la maison : un pour Ariel, un pour Yardena, un pour Noa et un talisman de salle. Utilise F pour activer l\'objet sélectionné.');
      saveSession(this.snapshotSession());
      this.populateNightSelect();
      this.setBanner(`${this.currentNightCfg.name} — ${this.currentNightCfg.description}`, 5.5);
    }

    snapshotSession() {
      return {
        state: this.state,
        night: this.night,
        roomId: this.roomId,
        player: { x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy, facing: this.player.facing },
        timeLeft: this.timeLeft,
        genepiLocation: this.genepiLocation,
        hallDoorLocked: this.hallDoorLocked,
        pcOn: this.pcOn,
        pcTimer: this.pcTimer,
        curtainsClosed: this.curtainsClosed,
        stress: this.stress,
        monsters: deepCopy(this.monsters),
        discoveredNotes: [...this.discoveredNotes],
        journalEntries: [...this.journalEntries],
        inventory: [...this.inventory],
        selectedSlot: this.selectedSlot,
        worldItems: deepCopy(this.worldItems),
        safeRoom: this.safeRoom ? deepCopy(this.safeRoom) : null,
      };
    }

    resumeSession() {
      const s = loadSession();
      if (!s || !s.night || s.state !== 'playing') return false;
      this.resetRuntime();
      this.night = s.night;
      this.currentNightCfg = NIGHTS[this.night];
      this.state = 'playing';
      this.overlay = null;
      this.roomId = s.roomId;
      this.player.x = s.player.x;
      this.player.y = s.player.y;
      this.player.vx = s.player.vx;
      this.player.vy = s.player.vy;
      this.player.facing = s.player.facing || 1;
      this.timeLeft = s.timeLeft;
      this.genepiLocation = s.genepiLocation;
      this.hallDoorLocked = s.hallDoorLocked;
      this.pcOn = s.pcOn;
      this.pcTimer = s.pcTimer;
      this.curtainsClosed = s.curtainsClosed;
      this.stress = s.stress;
      this.monsters = s.monsters || {};
      this.discoveredNotes = s.discoveredNotes || [];
      this.discoveredSet = new Set(this.discoveredNotes);
      this.journalEntries = s.journalEntries || [];
      this.inventory = s.inventory || [];
      this.selectedSlot = s.selectedSlot || 0;
      this.worldItems = s.worldItems || Object.fromEntries(Object.entries(WORLD_ITEM_LAYOUT).map(([id, pos]) => [id, { ...pos, picked: false }]));
      this.safeRoom = s.safeRoom || null;
      this.falseSignalTimer = rand(8, 16);
      this.hallucinationTimer = rand(10, 18);
      this.setBanner(`Reprise — ${this.currentNightCfg.name}`, 2.5);
      return true;
    }

    backToMenu() {
      this.state = 'menu';
      this.overlay = null;
      this.failureMonster = null;
      this.failureText = '';
      this.transitionCooldown = 0;
      this.populateNightSelect();
      this.updateMenuDescription();
      clearSession();
    }

    debugAction(key) {
      if (this.state !== 'playing') return;
      if (this.monsters[key]) {
        this.forceMonster(key);
      } else if (key === 'stress') {
        this.stress = clamp(this.stress + 15, 0, 100);
      } else if (key === 'calm') {
        this.stress = clamp(this.stress - 20, 0, 100);
      } else if (key === 'win') {
        this.finishNight();
      }
    }

    forceMonster(id) {
      const m = this.monsters[id];
      if (!m) return;
      m.state = 'cue';
      m.timer = MONSTERS[id].timings.cue * m.speedScale;
      this.triggerMonsterCue(id, 'cue');
    }

    isInputBlocked() {
      return this.overlay === 'note' || this.overlay === 'journal' || this.overlay === 'map' || this.state === 'paused' || this.state === 'gameover' || this.state === 'nightclear';
    }

    canSpawnMonster(id) {
      const active = Object.values(this.monsters).filter((m) => m.state !== 'cooldown').length;
      if (this.safeRoom && this.safeRoom.timer > 0 && MONSTERS[id].roomId === this.safeRoom.roomId) return false;
      return active < this.currentNightCfg.maxConcurrent && this.monsters[id].state === 'cooldown';
    }

    triggerMonsterCue(id, phase) {
      const def = MONSTERS[id];
      const label = phase === 'cue' ? def.cueText : phase === 'stage1' ? def.stage1Text : def.stage2Text;
      const soundKey = phase === 'stage2' ? def.sounds.stage2 : def.sounds.cue;
      this.audio.play(soundKey, { roomId: def.roomId, volume: phase === 'stage2' ? 0.82 : 0.62 });
      this.setBanner(label, phase === 'cue' ? 2.7 : 3.4);
      this.addJournal(def.name, `${def.cueText}\n${def.stage1Text}\n${def.stage2Text}`);
      this.flash = Math.max(this.flash, phase === 'stage2' ? 0.5 : 0.18);
      this.screenShake = Math.max(this.screenShake, phase === 'stage2' ? 0.7 : 0.18);
      this.stress = clamp(this.stress + (phase === 'cue' ? 5 : phase === 'stage1' ? 8 : 14), 0, 100);
    }

    resolveMonster(id, stage2) {
      const def = MONSTERS[id];
      const m = this.monsters[id];
      m.state = 'cooldown';
      m.resolvedCount += 1;
      m.speedScale = clamp(m.speedScale * (stage2 ? 0.94 : 0.98), 0.68, 1);
      m.timer = rand(def.cooldown[0], def.cooldown[1]) * m.speedScale;
      this.setBanner(`${def.name} repoussé${stage2 ? ' de justesse' : ''}.`, 1.8);
      this.stress = clamp(this.stress - (stage2 ? 4 : 8), 0, 100);
    }

    monsterResolved(id) {
      if (id === 'brother') return this.genepiRoom() !== ROOM_IDS.BEDROOM;
      if (id === 'yardena') return this.hallDoorLocked;
      if (id === 'noa') return this.curtainsClosed;
      return false;
    }

    fail(id) {
      const def = MONSTERS[id];
      this.state = 'gameover';
      this.overlay = 'gameover';
      this.failureMonster = id;
      this.failureText = def.failText;
      this.audio.play(def.sounds.stage2, { roomId: def.roomId, volume: 0.95 });
      this.flash = 1;
      this.screenShake = 1;
      this.ui.gameOverTitle.textContent = 'Game Over';
      this.ui.gameOverReason.textContent = def.failText;
      clearSession();
    }

    finishNight() {
      this.state = 'nightclear';
      this.overlay = 'nightclear';
      if (this.night >= this.unlockedNight && this.unlockedNight < 6) {
        this.unlockedNight = this.night + 1;
        this.save.unlockedNight = this.unlockedNight;
        savePersistent(this.save);
      }
      this.ui.nightClearTitle.textContent = `${this.currentNightCfg.name} terminée`;
      this.ui.nightClearText.textContent = this.night < 6 ? `Nuit ${Math.min(6, this.night + 1)} débloquée.` : 'Tu as survécu à toutes les nuits disponibles.';
      clearSession();
      this.populateNightSelect();
    }

    update(dt) {
      if (this.banner.t > 0) this.banner.t = Math.max(0, this.banner.t - dt);
      this.flash = Math.max(0, this.flash - dt * 1.4);
      this.screenShake = Math.max(0, this.screenShake - dt * 1.7);
      this.genepiCarryCooldown = Math.max(0, this.genepiCarryCooldown - dt);
      this.transitionCooldown = Math.max(0, this.transitionCooldown - dt);

      if (this.state === 'menu' || this.state === 'gameover' || this.state === 'nightclear') {
        this.renderUI();
        return;
      }

      if (this.overlay === 'map' || this.overlay === 'journal' || this.overlay === 'note' || this.state === 'paused') {
        this.renderUI();
        return;
      }

      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.finishNight();
        this.renderUI();
        return;
      }

      this.updatePlayer(dt);
      this.updateSystems(dt);
      this.updateThreats(dt);
      this.updateInteraction(dt);
      saveSession(this.snapshotSession());
      this.renderUI();
    }

    updatePlayer(dt) {
      const room = ROOMS[this.roomId];
      const inputX = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      const inputY = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const carrying = this.genepiLocation === 'carried';
      this.player.sprint = !!sprint && (inputX || inputY);
      const len = Math.hypot(inputX, inputY) || 1;
      const nx = inputX / len;
      const ny = inputY / len;
      const baseSpeed = 250;
      const sprintMul = this.player.sprint ? 1.32 : 1;
      const carryMul = carrying ? 0.96 : 1;
      const stressMul = 1 - (this.stress / 100) * 0.18;
      const targetSpeed = baseSpeed * sprintMul * carryMul * stressMul;
      const accel = 1550;
      const friction = 7.5;

      if (inputX || inputY) {
        this.player.vx = lerp(this.player.vx, nx * targetSpeed, clamp(accel * dt / 1000, 0.12, 0.25));
        this.player.vy = lerp(this.player.vy, ny * targetSpeed, clamp(accel * dt / 1000, 0.12, 0.25));
        this.player.facing = inputX < 0 ? -1 : inputX > 0 ? 1 : this.player.facing;
      } else {
        this.player.vx = lerp(this.player.vx, 0, clamp(friction * dt, 0.08, 0.22));
        this.player.vy = lerp(this.player.vy, 0, clamp(friction * dt, 0.08, 0.22));
      }

      if (this.player.sprint) this.stress = clamp(this.stress + dt * 1.5, 0, 100);

      this.moveWithCollision(this.player.vx * dt, 0, room);
      this.moveWithCollision(0, this.player.vy * dt, room);

      const moving = Math.abs(this.player.vx) + Math.abs(this.player.vy) > 20;
      if (moving) {
        this.player.stepT += dt * (this.player.sprint ? 9.5 : 7.2);
        this.player.bob += dt * (this.player.sprint ? 14 : 9.5);
      }
    }

    moveWithCollision(dx, dy, room) {
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(distance / 4));
      const stepX = dx / steps;
      const stepY = dy / steps;
      for (let i = 0; i < steps; i++) {
        if (stepX) this.moveAxis(stepX, 'x', room);
        if (stepY) this.moveAxis(stepY, 'y', room);
      }
    }

    moveAxis(delta, axis, room) {
      if (axis === 'x') {
        this.player.x = clamp(this.player.x + delta, room.bounds.minX, room.bounds.maxX);
      } else {
        this.player.y = clamp(this.player.y + delta, room.bounds.minY, room.bounds.maxY);
      }

      for (let pass = 0; pass < 2; pass++) {
        let collided = false;
        for (const c of room.colliders) {
          const overlap = this.circleRectPenetration(this.player.x, this.player.y, this.player.radius, c);
          if (!overlap) continue;
          collided = true;
          if (axis === 'x') {
            this.player.x += overlap.x;
            if ((delta > 0 && overlap.x < 0) || (delta < 0 && overlap.x > 0)) this.player.vx = 0;
          } else {
            this.player.y += overlap.y;
            if ((delta > 0 && overlap.y < 0) || (delta < 0 && overlap.y > 0)) this.player.vy = 0;
          }
        }
        if (!collided) break;
      }

      this.player.x = clamp(this.player.x, room.bounds.minX, room.bounds.maxX);
      this.player.y = clamp(this.player.y, room.bounds.minY, room.bounds.maxY);
    }

    circleRectPenetration(cx, cy, r, rect0) {
      const px = clamp(cx, rect0.x, rect0.x + rect0.w);
      const py = clamp(cy, rect0.y, rect0.y + rect0.h);
      let dx = cx - px;
      let dy = cy - py;
      let dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < r) {
        const push = r - dist + 0.1;
        return { x: (dx / dist) * push, y: (dy / dist) * push };
      }
      if (dist === 0) {
        const left = Math.abs(cx - rect0.x);
        const right = Math.abs(rect0.x + rect0.w - cx);
        const top = Math.abs(cy - rect0.y);
        const bottom = Math.abs(rect0.y + rect0.h - cy);
        const minSide = Math.min(left, right, top, bottom);
        if (minSide === left) return { x: -(r + 0.1), y: 0 };
        if (minSide === right) return { x: r + 0.1, y: 0 };
        if (minSide === top) return { x: 0, y: -(r + 0.1) };
        return { x: 0, y: r + 0.1 };
      }
      return null;
    }

    circleIntersectsRect(cx, cy, r, rect0) {
      const px = clamp(cx, rect0.x, rect0.x + rect0.w);
      const py = clamp(cy, rect0.y, rect0.y + rect0.h);
      return Math.hypot(cx - px, cy - py) < r;
    }

    updateSystems(dt) {
      if (this.pcOn) {
        this.pcTimer -= dt;
        if (this.pcTimer <= 0) {
          this.pcOn = false;
          this.setBanner('La partie de LoL s’est fermée.', 1.8);
        }
      }

      if (this.safeRoom) {
        this.safeRoom.timer -= dt;
        this.safeRoomFxPulse += dt * 3.5;
        if (this.safeRoom.timer <= 0) {
          const roomName = ROOMS[this.safeRoom.roomId].name;
          this.safeRoom = null;
          this.setBanner(`La protection de ${roomName} s’est dissipée.`, 1.8);
        }
      }

      const activeThreats = Object.values(this.monsters).filter((m) => m.state !== 'cooldown').length;
      const roomCalm = activeThreats === 0 ? 2.4 : 0.6;
      const safeBonus = this.isSafeRoomActive() ? 8.5 : 0;
      const drift = this.currentNightCfg.stressDrift + activeThreats * 1.15 + (this.genepiLocation === 'carried' ? 0.5 : 0) - (4.4 + roomCalm + safeBonus);
      this.stress = clamp(this.stress + drift * dt, 0, 100);

      if (this.currentNightCfg.falseSignals) {
        this.falseSignalTimer -= dt;
        if (this.falseSignalTimer <= 0) {
          this.falseSignalTimer = rand(10, 18);
          const target = choose(this.currentNightCfg.monsters);
          const def = MONSTERS[target];
          this.audio.play(def.sounds.cue, { roomId: def.roomId, volume: 0.34 });
          this.setBanner('Un faux signal te fait douter…', 1.3);
          this.stress = clamp(this.stress + 6, 0, 100);
          this.flash = Math.max(this.flash, 0.16);
        }
      }

      if (this.currentNightCfg.hallucinations) {
        this.hallucinationTimer -= dt;
        if (this.hallucinationTimer <= 0) {
          this.hallucinationTimer = rand(11, 18);
          this.setBanner('Une ombre file dans le coin de ton œil.', 1.3);
          this.stress = clamp(this.stress + 7, 0, 100);
          this.flash = Math.max(this.flash, 0.22);
          this.screenShake = Math.max(this.screenShake, 0.22);
        }
      }
    }

    updateThreats(dt) {
      for (const id of Object.keys(this.monsters)) {
        const def = MONSTERS[id];
        const m = this.monsters[id];

        if (this.safeRoom && this.safeRoom.timer > 0 && def.roomId === this.safeRoom.roomId) {
          if (m.state !== 'cooldown') {
            this.resolveMonster(id, m.state === 'stage2');
            this.setBanner(`Le talisman protège ${ROOMS[this.safeRoom.roomId].name} contre ${def.name}.`, 1.5);
          } else {
            m.timer = Math.max(m.timer, 1.2);
          }
          continue;
        }

        if (m.state === 'cooldown') {
          m.timer -= dt;
          if (m.timer <= 0 && this.canSpawnMonster(id)) {
            m.state = 'cue';
            m.timer = def.timings.cue * m.speedScale;
            this.triggerMonsterCue(id, 'cue');
          }
          continue;
        }

        if (this.monsterResolved(id)) {
          this.resolveMonster(id, m.state === 'stage2');
          continue;
        }

        m.timer -= dt;
        if (m.state === 'cue' && m.timer <= 0) {
          m.state = 'stage1';
          m.timer = def.timings.stage1 * m.speedScale;
          this.triggerMonsterCue(id, 'stage1');
        } else if (m.state === 'stage1' && m.timer <= 0) {
          m.state = 'stage2';
          m.timer = def.timings.stage2 * m.speedScale;
          this.triggerMonsterCue(id, 'stage2');
        } else if (m.state === 'stage2' && m.timer <= 0) {
          if (this.isSafeRoomActive()) {
            m.timer = 1.2;
            if (this.safeRoomBannerLock <= 0) {
              this.setBanner(`Le talisman protège ${ROOMS[this.roomId].name}.`, 1.2);
              this.safeRoomBannerLock = 1.4;
            }
            continue;
          }
          this.fail(id);
          return;
        }

        if (m.state === 'stage2') {
          this.stress = clamp(this.stress + dt * (this.roomId === def.roomId ? 2.1 : 0.7), 0, 100);
        }
      }
      this.safeRoomBannerLock = Math.max(0, this.safeRoomBannerLock - dt);
    }

    hotspotDistance(h) {
      if (h.anchor) return Math.hypot(this.player.x - h.anchor.x, this.player.y - h.anchor.y);
      return rectDist(h.area, this.player.x, this.player.y);
    }

    promptLabel(h) {
      if (!h) return 'Approche-toi d’une porte, d’un objet ou d’une cachette.';
      if (h.type === 'frontDoor') return this.hallDoorLocked ? 'déverrouiller la porte' : 'verrouiller la porte';
      if (h.type === 'curtain') return this.curtainsClosed ? 'ouvrir les rideaux' : 'fermer les rideaux';
      if (h.type === 'pc') return this.pcOn ? 'relancer LoL' : 'lancer LoL';
      if (h.type === 'bed') {
        if (this.genepiLocation === 'bed') return 'prendre la génépi';
        if (this.genepiLocation === 'carried') return 'poser la génépi sur le lit';
        return 'examiner le lit';
      }
      if (h.type === 'closet') {
        if (this.genepiLocation === 'closet') return 'reprendre la génépi';
        if (this.genepiLocation === 'carried') return 'cacher la génépi dans le placard';
        return 'ouvrir le placard';
      }
      if (h.type === 'desk') {
        if (this.genepiLocation === 'desk') return 'reprendre la génépi';
        if (this.genepiLocation === 'carried') return 'poser la génépi sur le bureau';
        return 'examiner le bureau';
      }
      if (h.type === 'stash') {
        const label = h.stashKey === 'hallShelf' ? "sur le meuble d'entrée" : 'sur la table basse';
        if (this.genepiLocation === h.stashKey) return 'reprendre la génépi';
        if (this.genepiLocation === 'carried') return `poser la génépi ${label}`;
        return h.label.toLowerCase();
      }
      if (h.type === 'note') return 'lire la note';
      if (h.type === 'pickup') return this.hasInventorySpace() ? `ramasser ${ITEM_DEFS[h.itemId].name.toLowerCase()}` : 'inventaire plein';
      if (h.type === 'room') return h.doorKind === 'door' ? `ouvrir ${h.label.toLowerCase()}` : h.label.toLowerCase();
      return h.label;
    }

    updateInteraction(dt) {
      const doorPrompt = this.activePrompt('door');
      const objectPrompt = this.activePrompt('object');
      const activeDoor = doorPrompt && this.keys.has('KeyR') ? doorPrompt : null;
      const activeObject = objectPrompt && this.keys.has('KeyE') ? objectPrompt : null;
      const selected = activeDoor || activeObject || doorPrompt || objectPrompt;
      this.interactionTarget = selected;
      this.interactionMode = activeDoor ? 'door' : activeObject ? 'object' : this.isDoorHotspot(selected) ? 'door' : 'object';
      if (!selected) {
        this.interactionProgress = 0;
        return;
      }
      const held = activeDoor || activeObject;
      if (!held) {
        this.interactionProgress = 0;
        return;
      }
      const stressPenalty = 1 + (this.stress / 100) * 0.35;
      const needed = (selected.hold || 0.22) * stressPenalty;
      this.interactionProgress += dt / needed;
      if (this.interactionProgress >= 1) {
        this.interactionProgress = 0;
        this.performInteraction(selected);
      }
    }

    changeRoom(h) {
      const target = ROOMS[h.target];
      this.roomId = h.target;
      const spawn = h.spawn || target.spawn;
      this.player.x = spawn.x;
      this.player.y = spawn.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.transitionCooldown = 0.45;
      if ((h.doorKind || 'door') === 'door') {
        this.audio.play('yardenaHandle', { roomId: this.roomId, volume: 0.18 });
        this.setBanner(`La porte s’ouvre — ${target.name}`, 1.2);
      } else {
        this.setBanner(`→ ${target.name}`, 1.0);
      }
    }

    performInteraction(h) {
      switch (h.type) {
        case 'room':
          this.changeRoom(h);
          break;
        case 'frontDoor':
          this.hallDoorLocked = !this.hallDoorLocked;
          this.audio.play('yardenaHandle', { roomId: ROOM_IDS.HALL, volume: 0.24 });
          this.setBanner(this.hallDoorLocked ? 'La porte d’entrée est verrouillée.' : 'La porte d’entrée est déverrouillée.', 1.4);
          break;
        case 'curtain':
          this.curtainsClosed = !this.curtainsClosed;
          this.setBanner(this.curtainsClosed ? 'Les rideaux sont fermés.' : 'Les rideaux sont ouverts.', 1.4);
          break;
        case 'pc':
          this.pcOn = true;
          this.pcTimer = 34;
          this.setBanner('Gabriel lance une game de LoL.', 1.7);
          break;
        case 'bed':
          if (this.genepiCarryCooldown > 0) break;
          if (this.genepiLocation === 'bed') {
            this.genepiLocation = 'carried';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('Gabriel prend la génépi.', 1.2);
          } else if (this.genepiLocation === 'carried') {
            this.genepiLocation = 'bed';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('La génépi est posée sur le lit.', 1.2);
          } else {
            this.setBanner('Le lit est trop risqué maintenant.', 1.1);
          }
          break;
        case 'closet':
          if (this.genepiCarryCooldown > 0) break;
          if (this.genepiLocation === 'closet') {
            this.genepiLocation = 'carried';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('Gabriel reprend la génépi.', 1.2);
          } else if (this.genepiLocation === 'carried') {
            this.genepiLocation = 'closet';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('La génépi est cachée dans le placard.', 1.2);
          } else {
            this.setBanner('Le placard peut servir de cachette.', 1.1);
          }
          break;
        case 'desk':
          if (this.genepiCarryCooldown > 0) break;
          if (this.genepiLocation === 'desk') {
            this.genepiLocation = 'carried';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('Gabriel reprend la génépi du bureau.', 1.2);
          } else if (this.genepiLocation === 'carried') {
            this.genepiLocation = 'desk';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('La génépi est posée sur le bureau.', 1.2);
          } else {
            this.setBanner('Le bureau est exposé à la fenêtre.', 1.1);
          }
          break;
        case 'stash':
          if (this.genepiCarryCooldown > 0) break;
          if (this.genepiLocation === h.stashKey) {
            this.genepiLocation = 'carried';
            this.genepiCarryCooldown = 0.2;
            this.setBanner('Gabriel reprend la génépi.', 1.2);
          } else if (this.genepiLocation === 'carried') {
            this.genepiLocation = h.stashKey;
            this.genepiCarryCooldown = 0.2;
            this.setBanner(h.stashKey === 'hallShelf' ? 'La génépi est posée sur le meuble d’entrée.' : 'La génépi est posée sur la table basse.', 1.2);
          } else {
            this.setBanner('Tu peux y poser la génépi.', 1.1);
          }
          break;
        case 'note':
          this.currentNote = h.noteId;
          this.discoverNote(h.noteId);
          this.ui.noteTitle.textContent = NOTES[h.noteId].title;
          this.ui.noteBody.textContent = NOTES[h.noteId].text;
          this.openOverlay('note');
          break;
        case 'pickup':
          this.pickupItem(h.itemId);
          break;
        default:
          this.setBanner(h.label, 1.2);
      }
    }

    genepiWorldPos() {
      const map = {
        bed: { roomId: ROOM_IDS.BEDROOM, x: 760, y: 585, scale: 0.06 },
        closet: { roomId: ROOM_IDS.BEDROOM, x: 1065, y: 570, scale: 0.058 },
        desk: { roomId: ROOM_IDS.OFFICE, x: 565, y: 560, scale: 0.06 },
        hallShelf: { roomId: ROOM_IDS.HALL, x: 950, y: 545, scale: 0.058 },
        salonTable: { roomId: ROOM_IDS.SALON, x: 790, y: 550, scale: 0.058 },
      };
      if (this.genepiLocation === 'carried') return null;
      return map[this.genepiLocation] || null;
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, GAME_W, GAME_H);
      if (this.state === 'menu') {
        this.drawMenuBackground();
        this.renderUI();
        return;
      }
      ctx.save();
      if (!this.overlay || this.overlay === 'pause' || this.overlay === 'gameover' || this.overlay === 'nightclear') {
        const shakeAmt = this.screenShake * (1 + this.stress / 100) * 4;
        if (shakeAmt > 0.02) ctx.translate(rand(-shakeAmt, shakeAmt), rand(-shakeAmt, shakeAmt));
      }
      this.drawRoom();
      this.drawGenepi();
      this.drawItems();
      this.drawThreats();
      this.drawPlayer();
      this.drawHudPrompt();
      this.drawEffects();
      ctx.restore();
      this.renderUI();
    }

    drawMenuBackground() {
      const ctx = this.ctx;
      const img = this.assets.images[ASSETS.backgrounds.bedroom];
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      if (img) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.drawImage(img, 0, 0, GAME_W, GAME_H);
        ctx.restore();
      }
      const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
      g.addColorStop(0, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f6e8a6';
      ctx.font = 'bold 54px Georgia, serif';
      ctx.fillText('A Génépi Story — version améliorée', GAME_W / 2, 110);
      ctx.font = '24px Arial';
      ctx.fillStyle = '#ececec';
      ctx.fillText('Déplacement libre, collisions, systèmes de nuit, audio dynamique, stress et menaces superposées', GAME_W / 2, 150);
    }

    drawRoom() {
      const room = ROOMS[this.roomId];
      const bg = this.assets.images[room.bg];
      if (bg) this.ctx.drawImage(bg, 0, 0, GAME_W, GAME_H);
      const brightness = this.save.settings.brightness / 100;
      const dark = clamp(room.ambientDark + this.stress * 0.0038 - (brightness - 1) * 0.15, 0.04, 0.82);
      this.ctx.fillStyle = `rgba(0,0,0,${dark})`;
      this.ctx.fillRect(0, 0, GAME_W, GAME_H);
      if (this.pcOn && this.roomId === ROOM_IDS.OFFICE) {
        this.ctx.fillStyle = 'rgba(80, 170, 255, 0.12)';
        this.ctx.fillRect(425, 205, 415, 170);
      }
      if (this.curtainsClosed && this.roomId === ROOM_IDS.OFFICE) {
        this.ctx.fillStyle = 'rgba(15, 14, 13, 0.3)';
        this.ctx.fillRect(0, 80, 320, 320);
      }
      if (this.hallDoorLocked && this.roomId === ROOM_IDS.HALL) {
        this.ctx.fillStyle = 'rgba(245, 201, 96, 0.06)';
        this.ctx.fillRect(475, 90, 330, 280);
      }
      if (this.isSafeRoomActive(this.roomId)) {
        const pulse = 0.14 + (Math.sin(this.safeRoomFxPulse * 6) + 1) * 0.03;
        this.ctx.strokeStyle = `rgba(130,255,180,${0.45 + pulse})`;
        this.ctx.lineWidth = 10;
        this.ctx.strokeRect(14, 14, GAME_W - 28, GAME_H - 28);
        this.ctx.fillStyle = `rgba(110,220,155,${0.04 + pulse * 0.2})`;
        this.ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
    }

    drawGenepi() {
      const img = this.assets.images[ASSETS.sprites.genepi];
      if (!img) return;
      if (this.genepiLocation === 'carried') {
        const scale = 0.055;
        const w = img.width * scale;
        const h = img.height * scale;
        this.ctx.drawImage(img, this.player.x + 30 * this.player.facing, this.player.y - h - 30, w, h);
        return;
      }
      const p = this.genepiWorldPos();
      if (!p || p.roomId !== this.roomId) return;
      const w = img.width * p.scale;
      const h = img.height * p.scale;
      this.ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
    }

    drawItems() {
      Object.entries(this.worldItems).forEach(([itemId, item]) => {
        if (item.picked || item.roomId !== this.roomId) return;
        const def = ITEM_DEFS[itemId];
        const pulse = (Math.sin(nowSec() * 4 + item.x * 0.01) + 1) * 0.5;
        this.ctx.save();
        this.ctx.globalAlpha = 0.92;
        this.ctx.fillStyle = def.color;
        this.ctx.beginPath();
        this.ctx.arc(item.x, item.y, 15 + pulse * 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        this.ctx.stroke();
        this.ctx.fillStyle = '#101318';
        this.ctx.font = 'bold 13px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(def.short[0], item.x, item.y + 4);
        this.ctx.restore();
      });
    }

    drawThreats() {
      Object.values(this.monsters).forEach((m) => {
        if (m.state === 'cooldown') return;
        const def = MONSTERS[m.id];
        if (def.roomId !== this.roomId) return;
        const img = this.assets.images[def.sprite];
        if (!img) return;
        const phase = m.state === 'cue' ? 'cue' : m.state === 'stage1' ? 'stage1' : 'stage2';
        const scale = def.scale[phase];
        const alpha = def.alpha[phase];
        const w = img.width * scale;
        const h = img.height * scale;
        const t = nowSec();
        const pulse = phase === 'cue' ? Math.sin(t * 6) * 3 : phase === 'stage1' ? Math.sin(t * 9) * 5 : Math.sin(t * 16) * 9;
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.drawImage(img, def.position.x - w / 2 + pulse, def.position.y - h, w, h);
        if (phase === 'stage2') {
          this.ctx.globalCompositeOperation = 'lighter';
          this.ctx.fillStyle = 'rgba(255,70,70,0.07)';
          this.ctx.fillRect(def.position.x - w / 2 - 18, def.position.y - h - 18, w + 36, h + 36);
        }
        this.ctx.restore();
      });
    }

    drawPlayer() {
      const img = this.assets.images[ASSETS.sprites.gabriel];
      if (!img) return;
      const moving = Math.abs(this.player.vx) + Math.abs(this.player.vy) > 22;
      const phase = moving ? Math.sin(this.player.stepT) : 0;
      const sway = moving ? phase * 7 : 0;
      const bob = moving ? Math.abs(Math.sin(this.player.stepT * 0.5)) * 8 : 0;
      const stretch = moving ? 1 + Math.abs(phase) * 0.035 : 1;
      const scale = 0.155 + (this.player.y / GAME_H) * 0.05;
      const w = img.width * scale * (this.player.facing === -1 ? -1 : 1);
      const h = img.height * scale * stretch;
      this.ctx.save();
      this.ctx.globalAlpha = 0.24;
      this.ctx.fillStyle = '#000';
      this.ctx.beginPath();
      this.ctx.ellipse(this.player.x, this.player.y - 8, 34, 11, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      this.ctx.save();
      if (this.player.facing === -1) {
        this.ctx.translate(this.player.x, 0);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(img, - (Math.abs(w) / 2) + sway, this.player.y - h + bob, Math.abs(w), h);
      } else {
        this.ctx.drawImage(img, this.player.x - Math.abs(w) / 2 + sway, this.player.y - h + bob, Math.abs(w), h);
      }
      this.ctx.restore();
    }

    drawHudPrompt() {
      if (this.overlay) return;
      const doorPrompt = this.activePrompt('door');
      const objectPrompt = this.activePrompt('object');
      if (!doorPrompt && !objectPrompt) return;
      const lines = [];
      if (objectPrompt) lines.push(`Maintenir E — ${this.promptLabel(objectPrompt)}`);
      if (doorPrompt) lines.push(`Maintenir R — ${this.promptLabel(doorPrompt)}`);
      this.ctx.save();
      this.ctx.font = '20px Arial';
      const boxW = clamp(Math.max(...lines.map(line => this.ctx.measureText(line).width)) + 56, 340, 980);
      const boxH = 20 + lines.length * 24 + (lines.length - 1) * 4;
      const x = GAME_W / 2 - boxW / 2;
      const y = GAME_H - (lines.length === 2 ? 96 : 72);
      this.ctx.fillStyle = 'rgba(0,0,0,0.72)';
      this.ctx.fillRect(x, y, boxW, boxH);
      this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      this.ctx.strokeRect(x, y, boxW, boxH);
      this.ctx.fillStyle = '#fff2b3';
      this.ctx.textAlign = 'center';
      lines.forEach((line, idx) => {
        this.ctx.fillText(line, GAME_W / 2, y + 28 + idx * 28);
      });
      this.ctx.restore();
    }

    drawEffects() {
      const ctx = this.ctx;
      const vig = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, 160, GAME_W / 2, GAME_H / 2, 760);
      vig.addColorStop(0, `rgba(0,0,0,${0.12 + this.stress * 0.0013})`);
      vig.addColorStop(1, `rgba(0,0,0,${0.63 + this.stress * 0.0022})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.22})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      if (this.currentNightCfg.hallucinations && this.flash > 0.12 && Math.random() < 0.08) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(rand(0, GAME_W * 0.6), rand(0, GAME_H * 0.6), rand(80, 300), rand(80, 220));
      }
    }

    renderUI() {
      this.ui.menuPanel.classList.toggle('hidden', this.state !== 'menu');
      this.ui.gamePanel.classList.toggle('hidden', this.state === 'menu');
      this.ui.stateBadge.textContent = this.state === 'paused' ? 'PAUSE' : this.state === 'gameover' ? 'GAME OVER' : this.state === 'nightclear' ? 'NUIT TERMINÉE' : '';
      this.ui.banner.textContent = this.banner.text;
      this.ui.banner.classList.toggle('show', this.banner.t > 0 && !!this.banner.text);
      this.ui.mapOverlay.classList.toggle('hidden', this.overlay !== 'map');
      this.ui.journalOverlay.classList.toggle('hidden', this.overlay !== 'journal');
      this.ui.noteOverlay.classList.toggle('hidden', this.overlay !== 'note');
      this.ui.pauseOverlay.classList.toggle('hidden', this.overlay !== 'pause');
      this.ui.gameOverOverlay.classList.toggle('hidden', this.overlay !== 'gameover');
      this.ui.nightClearOverlay.classList.toggle('hidden', this.overlay !== 'nightclear');
      this.ui.debugPanel.classList.toggle('hidden', !this.debug);

      this.ui.nightLabel.textContent = this.state === 'menu' ? 'Menu' : NIGHTS[this.night].name;
      this.ui.roomLabel.textContent = ROOMS[this.roomId].name;
      this.ui.timeLabel.textContent = fmtTime(this.timeLeft);
      this.ui.objectiveLabel.textContent = this.currentNightCfg.objective;
      this.ui.genepiLabel.textContent = this.describeGenepi();
      this.ui.doorLabel.textContent = this.hallDoorLocked ? 'Verrouillée' : 'Déverrouillée';
      this.ui.pcLabel.textContent = this.pcOn ? `LoL actif (${Math.ceil(this.pcTimer)}s)` : 'Éteint';
      this.ui.curtainLabel.textContent = this.curtainsClosed ? 'Fermés' : 'Ouverts';
      this.ui.stressBar.style.width = `${this.stress}%`;
      this.ui.stressValue.textContent = `${Math.round(this.stress)}%`;
      this.ui.interactionBar.style.width = `${Math.round(this.interactionProgress * 100)}%`;
      this.ui.interactionLabel.textContent = this.interactionTarget ? `${this.promptKey(this.interactionTarget)} — ${this.promptLabel(this.interactionTarget)}` : 'prêt';
      const doorPrompt = this.activePrompt('door');
      const objectPrompt = this.activePrompt('object');
      this.ui.hint.textContent = [
        objectPrompt ? `E : ${this.promptLabel(objectPrompt)}` : null,
        doorPrompt ? `R : ${this.promptLabel(doorPrompt)}` : null,
      ].filter(Boolean).join(' | ') || 'Approche-toi d’un objet ou d’une porte.';
      this.ui.sprintLabel.textContent = this.player.sprint ? 'Oui' : 'Non';
      this.ui.safeRoomLabel.textContent = this.safeRoom && this.safeRoom.timer > 0 ? `${ROOMS[this.safeRoom.roomId].name} (${Math.ceil(this.safeRoom.timer)}s)` : 'Aucune';
      this.ui.mapRoomText.textContent = `Position actuelle : ${ROOMS[this.roomId].name}`;
      this.ui.journalContent.textContent = this.journalEntries.length
        ? this.journalEntries.map((j) => `${j.title}\n${j.body}`).join('\n\n———\n\n')
        : 'Aucune entrée pour le moment.';
      this.ui.journalList.innerHTML = this.discoveredNotes.length
        ? this.discoveredNotes.map((id) => `<li>${NOTES[id].title}</li>`).join('')
        : '<li>Aucune note trouvée.</li>';
      const active = Object.values(this.monsters).filter((m) => m.state !== 'cooldown');
      this.ui.alertsList.innerHTML = active.length
        ? active.map((m) => {
            const def = MONSTERS[m.id];
            const phase = m.state === 'cue' ? 'pré-signal' : m.state === 'stage1' ? 'vague 1' : 'vague 2';
            return `<li><strong>${def.name}</strong> — ${phase} — ${Math.max(1, Math.ceil(m.timer))}s</li>`;
          }).join('')
        : '<li>Aucune alerte active. Respire et prépare ton prochain déplacement.</li>';
      this.ui.inventoryMini.innerHTML = Array.from({ length: 4 }, (_, i) => {
        const itemId = this.inventory[i];
        const activeClass = i === this.selectedSlot ? ' active' : '';
        if (!itemId) return `<div class="slot${activeClass}"><span class="slotIndex">${i + 1}</span><span class="slotEmpty">vide</span></div>`;
        const def = ITEM_DEFS[itemId];
        return `<div class="slot${activeClass}" style="--slotColor:${def.color}"><span class="slotIndex">${i + 1}</span><strong>${def.short}</strong><small>${def.name}</small></div>`;
      }).join('');
    }

    describeGenepi() {
      if (this.genepiLocation === 'carried') return 'Portée par Gabriel';
      if (this.genepiLocation === 'bed') return 'Sur le lit';
      if (this.genepiLocation === 'closet') return 'Dans le placard';
      if (this.genepiLocation === 'desk') return 'Sur le bureau';
      if (this.genepiLocation === 'hallShelf') return 'Sur le meuble d’entrée';
      if (this.genepiLocation === 'salonTable') return 'Sur la table basse';
      return 'Inconnue';
    }

    gameLoop = (ts) => {
      if (!this.lastTs) this.lastTs = ts;
      const dt = Math.min(0.033, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.update(dt);
      this.render();
      requestAnimationFrame(this.gameLoop);
    };
  }

  const game = new Game();
  game.loadAssets().then(() => {
    requestAnimationFrame(game.gameLoop);
  }).catch((err) => {
    console.error(err);
    game.setBanner('Erreur de chargement des assets.', 999);
  });
})();
