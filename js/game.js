(() => {
  const { Player, Genepi, Ariel, Noa, Yardena } = window.AGS_Entities;

  const CONFIG = {
    size: { w: 1280, h: 720 },
    nightDuration: [100, 120, 140, 160],
    interactionBase: 0.28,
    sprintStressPerSec: 5,
    calmStressRecover: 8,
    maxSimultaneousThreats: [1, 2, 2, 2],
    stressFalseAlertThreshold: 72,
    stressInteractionPenaltyMax: 0.18,
    ariel: {
      wakeTelegraph: [6, 5.5, 5, 4.2],
      investigateTime: [7, 6.2, 5.8, 5.4],
      moveSpeedMul: [1, 1.07, 1.15, 1.24],
      cooldown: [15, 13, 11, 9],
    },
    noa: {
      interval: [20, 16, 14, 12],
      telegraph: [6, 5, 4.6, 4],
      breachTime: [4.8, 4.1, 3.7, 3.2],
      cooldown: [13, 11, 9, 8],
      lolRepel: 12,
    },
    yardena: {
      interval: [22, 18, 15, 13],
      telegraph: [5.6, 4.8, 4.2, 3.6],
      breakTime: [4.6, 4, 3.5, 3],
      cooldown: [16, 14, 11, 9],
      talismanBanish: true,
    },
  };

  const ROOM_LAYOUTS = {
    hall: {
      name: 'Hall',
      bg: 'hall',
      color: '#1f2433',
      spawn: { x: 640, y: 580 },
      doors: [
        { id: 'doorHallSalon', to: 'salonRight', x: 58, y: 100, w: 190, h: 260 },
        { id: 'doorHallBedroom', to: 'bedroom', x: 900, y: 95, w: 190, h: 125 },
        { id: 'doorHallOffice', to: 'office', x: 900, y: 220, w: 190, h: 150 },
      ],
      interactables: [
        { id: 'frontDoor', type: 'frontDoor', x: 490, y: 95, w: 300, h: 280, label: 'E : verrouiller la porte' },
      ],
      doorPoint: { x: 640, y: 270 },
      keySpawns: [
        { x: 360, y: 260 },
        { x: 858, y: 360 },
        { x: 642, y: 448 },
      ],
      talismanSpawn: { x: 325, y: 250 },
    },
    bedroom: {
      name: 'Chambre de Gabriel',
      bg: 'bedroom',
      color: '#2a2030',
      spawn: { x: 610, y: 560 },
      doors: [{ id: 'doorBedroomHall', to: 'hall', x: 500, y: 140, w: 165, h: 215 }],
      interactables: [
        { id: 'bed', type: 'genepiSpot', spot: 'bed', x: 580, y: 210, w: 320, h: 240, label: 'E : poser sur le lit' },
        { id: 'closet', type: 'genepiSpot', spot: 'closet', x: 985, y: 90, w: 245, h: 315, label: 'E : cacher dans le placard' },
        { id: 'windowBedroom', type: 'window', windowId: 'bedroom', x: 20, y: 100, w: 320, h: 230, label: 'E : fermer la fenêtre' },
      ],
      arielSpawn: { x: 770, y: 330 },
    },
    office: {
      name: 'Bureau',
      bg: 'office',
      color: '#1f2e2f',
      spawn: { x: 620, y: 560 },
      doors: [{ id: 'doorOfficeHall', to: 'hall', x: 920, y: 110, w: 210, h: 280 }],
      interactables: [
        { id: 'officeHide', type: 'genepiSpot', spot: 'office', x: 430, y: 360, w: 410, h: 190, label: 'E : cacher dans le bureau' },
        { id: 'pc', type: 'pc', x: 360, y: 190, w: 500, h: 180, label: 'E : lancer LoL' },
        { id: 'windowOffice', type: 'window', windowId: 'office', x: 20, y: 95, w: 300, h: 235, label: 'E : fermer la fenêtre' },
      ],
    },
    salonRight: {
      name: 'Salon / Couloir droit',
      bg: 'corridor-right',
      color: '#2d2820',
      spawn: { x: 640, y: 560 },
      doors: [{ id: 'doorSalonHall', to: 'hall', x: 28, y: 110, w: 195, h: 320 }],
      interactables: [
        { id: 'salonHide', type: 'genepiSpot', spot: 'salon', x: 0, y: 395, w: 185, h: 200, label: 'E : cacher dans le salon' },
      ],
    },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  class Game {
    constructor(canvas, ui, audio) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = ui;
      this.audio = audio;
      this.state = 'boot';
      this.night = 1;
      this.timeLeft = CONFIG.nightDuration[0];
      this.stress = 0;
      this.lastTime = 0;
      this.loopHandle = null;
      this.messageCooldown = 0;
      this.showHitboxes = false;
      this.images = {};
      this.assetsReady = false;
      this.assetReport = null;

      this.input = { up: false, down: false, left: false, right: false, shift: false, e: false };
      this.interaction = { progress: 0, target: null };

      this.rooms = this.createRooms();
      this.roomOrder = ['hall', 'bedroom', 'office', 'salonRight'];
      this.currentRoom = 'hall';

      this.player = new Player(this.rooms.hall.spawn);
      this.genepi = new Genepi();
      this.ariel = new Ariel(this.rooms.bedroom.arielSpawn);
      this.noa = new Noa();
      this.yardena = new Yardena(this.rooms.hall.doorPoint);

      this.hasKey = false;
      this.keyPos = null;
      this.frontDoorLocked = false;
      this.pcLolActive = 0;
      this.talismans = 0;

      this.scheduler = {
        arielNext: 9,
        noaNext: 40,
        yardenaNext: 50,
        activeCount: 0,
      };

      this.bindKeys();
    }

    createRooms() {
      return Object.fromEntries(
        Object.entries(ROOM_LAYOUTS).map(([roomId, room]) => [
          roomId,
          {
            ...room,
            spawn: { ...room.spawn },
            doors: room.doors.map((door) => ({ ...door })),
            interactables: room.interactables.map((interactable) => ({ ...interactable })),
            doorPoint: room.doorPoint ? { ...room.doorPoint } : undefined,
            keySpawns: room.keySpawns ? room.keySpawns.map((point) => ({ ...point })) : undefined,
            talismanSpawn: room.talismanSpawn ? { ...room.talismanSpawn } : undefined,
            arielSpawn: room.arielSpawn ? { ...room.arielSpawn } : undefined,
          },
        ]),
      );
    }

    async loadAssets(onProgress) {
      const imageMap = {
        hall: 'assets/backgrounds/hall.png',
        bedroom: 'assets/backgrounds/bedroom.png',
        office: 'assets/backgrounds/office.png',
        salon: 'assets/backgrounds/salon.png',
        'corridor-right': 'assets/backgrounds/corridor-right.png',
        gabriel: 'assets/sprites/gabriel.png',
        brother: 'assets/sprites/brother.png',
        noa: 'assets/sprites/noa.png',
        yardena: 'assets/sprites/yardena.png',
        genepi: 'assets/sprites/genepi.png',
      };

      const entries = Object.entries(imageMap);
      let loadedCount = 0;
      let failedCount = 0;
      const failedAssets = [];
      const total = entries.length;

      const loaders = entries.map(([key, src]) => new Promise((resolve) => {
        const img = new Image();

        const finalize = (isSuccess) => {
          if (isSuccess) loadedCount += 1;
          else {
            failedCount += 1;
            failedAssets.push({ key, src });
          }

          if (typeof onProgress === 'function') {
            onProgress({
              loadedCount,
              failedCount,
              total,
              progress: (loadedCount + failedCount) / total,
              key,
              ok: isSuccess,
            });
          }
        };

        img.onload = () => {
          finalize(true);
          resolve([key, img]);
        };
        img.onerror = () => {
          finalize(false);
          resolve([key, null]);
        };
        img.src = src;
      }));

      const loaded = await Promise.all(loaders);
      loaded.forEach(([key, img]) => {
        this.images[key] = img;
      });

      this.assetsReady = true;
      this.assetReport = {
        loadedCount,
        failedCount,
        total,
        failedAssets,
      };

      if (failedCount > 0) {
        console.warn(`[AGS] ${failedCount}/${total} assets non chargés. Fallbacks activés.`, failedAssets);
      }
      if (loadedCount === 0) {
        console.warn('[AGS] Aucun asset chargé, démarrage en mode fallback complet.');
      }

      return this.assetReport;
    }

    bindKeys() {
      const set = (key, v) => {
        if (key === 'w' || key === 'arrowup') this.input.up = v;
        if (key === 's' || key === 'arrowdown') this.input.down = v;
        if (key === 'a' || key === 'arrowleft') this.input.left = v;
        if (key === 'd' || key === 'arrowright') this.input.right = v;
        if (key === 'shift') this.input.shift = v;
        if (key === 'e') this.input.e = v;
      };

      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        set(k, true);
        if (k === 'm') window.AGS_Main.toggleMute();
        if (k === 'p') this.togglePause();
        if (k === 'r' && this.state === 'game_over') this.restart();
        if (k === 't') this.useTalisman();
        if (k === 'h') {
          this.showHitboxes = !this.showHitboxes;
          this.ui.showBanner(`Debug zones: ${this.showHitboxes ? 'ON' : 'OFF'}`, false, 1100);
        }
      });
      window.addEventListener('keyup', (e) => set(e.key.toLowerCase(), false));
    }

    startNewRun() {
      this.night = 1;
      this.enterNight(1);
    }

    enterNight(night) {
      this.state = 'night_transition';
      this.night = night;
      this.timeLeft = CONFIG.nightDuration[night - 1];
      this.stress = 8 + night * 2;
      this.currentRoom = 'hall';
      this.player.x = this.rooms.hall.spawn.x;
      this.player.y = this.rooms.hall.spawn.y;
      this.player.carryingGenepi = false;
      this.genepi.setLocation('bed', 0);
      this.ariel = new Ariel(this.rooms.bedroom.arielSpawn);
      this.noa = new Noa();
      this.yardena = new Yardena(this.rooms.hall.doorPoint);
      this.frontDoorLocked = false;
      this.hasKey = false;
      this.keyPos = pick(this.rooms.hall.keySpawns);
      this.talismans = night >= 3 ? 1 : 0;
      if (night === 4) this.talismans = 2;
      this.pcLolActive = 0;
      this.scheduler = {
        arielNext: 8,
        noaNext: night >= 2 ? 20 : 999,
        yardenaNext: night >= 3 ? 22 : 999,
        activeCount: 0,
      };

      this.ui.showNightCard(night, this.nightBrief(night));
      setTimeout(() => {
        this.state = 'playing';
        this.ui.showOverlay('night', false);
      }, 1900);
    }

    nightBrief(n) {
      if (n === 1) return 'Ariel seul. Apprends à déplacer la génépi.';
      if (n === 2) return 'Ariel + Noa. Fenêtres et PC deviennent critiques.';
      if (n === 3) return 'Ariel + Noa + Yardena. Trouve la clé du hall.';
      return 'Tout est plus rapide. Maximum 2 menaces à la fois.';
    }

    togglePause() {
      if (['boot', 'loading', 'menu', 'game_over', 'ending', 'night_transition'].includes(this.state)) return;
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      this.ui.showOverlay('pause', this.state === 'paused');
    }

    restart() {
      this.ui.showOverlay('gameOver', false);
      this.enterNight(1);
    }

    useTalisman() {
      if (this.state !== 'playing' || this.talismans <= 0) return;
      if (this.yardena.state !== 'idle' && this.yardena.state !== 'cooldown') {
        this.talismans -= 1;
        this.yardena.state = 'banished';
        this.yardena.stateTimer = 999;
        this.ui.showBanner('Talisman : Yardena bannie pour la nuit.');
        this.audio.playEvent('night-clear');
      }
    }

    nearestInteractable() {
      const room = this.rooms[this.currentRoom];
      let best = null;
      let bestD = Infinity;

      for (const i of room.interactables) {
        const cx = i.x + i.w / 2;
        const cy = i.y + i.h / 2;
        const d = Math.hypot(this.player.x - cx, this.player.y - cy);
        if (d < 90 && d < bestD) {
          best = i;
          bestD = d;
        }
      }

      for (const d of room.doors) {
        const cx = d.x + d.w / 2;
        const cy = d.y + d.h / 2;
        const dd = Math.hypot(this.player.x - cx, this.player.y - cy);
        if (dd < 80 && dd < bestD) {
          best = { ...d, type: 'door', label: 'E : franchir la porte' };
          bestD = dd;
        }
      }

      if (this.currentRoom === 'hall' && !this.hasKey) {
        const kd = Math.hypot(this.player.x - this.keyPos.x, this.player.y - this.keyPos.y);
        if (kd < 70 && kd < bestD) {
          best = { id: 'key', type: 'key', label: 'E : prendre la clé' };
        }
      }

      return best;
    }

    triggerInteraction(target, dt) {
      const penalty = (this.stress / 100) * CONFIG.stressInteractionPenaltyMax;
      const needed = CONFIG.interactionBase + penalty;

      if (this.interaction.target !== target.id) {
        this.interaction.target = target.id;
        this.interaction.progress = 0;
      }

      this.interaction.progress += dt;
      this.ui.setHint(`${target.label} (${Math.min(100, Math.floor((this.interaction.progress / needed) * 100))}%)`);

      if (this.interaction.progress < needed) return;

      this.interaction.progress = 0;
      this.interaction.target = null;
      this.player.interactionLock = 0.06;
      this.audio.playEvent('interact');

      if (target.type === 'door') this.changeRoom(target.to);
      else if (target.type === 'key') {
        this.hasKey = true;
        this.ui.showBanner('Tu as récupéré la clé de la porte d’entrée.');
      } else if (target.type === 'genepiSpot') this.handleGenepiSpot(target.spot);
      else if (target.type === 'frontDoor') this.handleFrontDoor();
      else if (target.type === 'window') this.closeWindow(target.windowId);
      else if (target.type === 'pc') this.launchLol();
    }

    handleGenepiSpot(spot) {
      if (!this.player.carryingGenepi && this.genepi.location === spot) {
        this.player.carryingGenepi = true;
        this.genepi.setLocation('player', this.timeLeft);
        this.ui.showBanner('Génépi prise.');
        return;
      }

      if (!this.player.carryingGenepi) {
        const canPick = (this.genepi.location === 'bed' && spot === 'bed') || (this.genepi.location === spot);
        if (canPick) {
          this.player.carryingGenepi = true;
          this.genepi.setLocation('player', this.timeLeft);
          this.ui.showBanner('Génépi prise.');
        }
        return;
      }

      this.player.carryingGenepi = false;
      this.genepi.setLocation(spot, this.timeLeft);
      this.audio.playEvent('drop');
      this.ui.showBanner(`Génépi cachée: ${this.genepiLabel()}.`);
    }

    handleFrontDoor() {
      if (this.frontDoorLocked) {
        this.ui.showBanner('Porte déjà verrouillée.');
        return;
      }
      if (!this.hasKey) {
        this.ui.showBanner('Clé requise pour verrouiller.', true);
        return;
      }
      this.frontDoorLocked = true;
      this.ui.showBanner('Porte verrouillée.');
    }

    closeWindow(windowId) {
      if (this.noa.state === 'manifesting' && this.noa.targetWindow === windowId) {
        this.noa.state = 'cooldown';
        this.noa.stateTimer = 5;
        this.ui.showBanner('Fenêtre fermée. Noa repoussée.');
      } else {
        this.ui.showBanner('Fenêtre fermée.');
      }
    }

    launchLol() {
      this.pcLolActive = CONFIG.noa.lolRepel;
      if (this.noa.state === 'manifesting') {
        this.noa.state = 'repelled';
        this.noa.stateTimer = 4;
      }
      this.ui.showBanner('LoL lancé. Noa hésite.', false, 1800);
    }

    changeRoom(roomId) {
      this.currentRoom = roomId;
      const s = this.rooms[roomId].spawn;
      this.player.x = s.x;
      this.player.y = s.y;
      this.ui.showBanner(`Tu entres: ${this.rooms[roomId].name}`, false, 900);
    }

    update(dt) {
      if (this.state !== 'playing') return;

      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.finishNight();
        return;
      }

      this.player.update(dt, this.input, this.stress);
      this.keepInRoom();

      const interact = this.nearestInteractable();
      if (this.input.e && interact) this.triggerInteraction(interact, dt);
      else {
        this.interaction.target = null;
        this.interaction.progress = 0;
        this.ui.setHint(interact ? interact.label : "Approche d'un objet.");
      }

      this.updateThreatScheduler(dt);
      this.updateAriel(dt);
      this.updateNoa(dt);
      this.updateYardena(dt);
      this.updateStress(dt);

      this.pcLolActive = Math.max(0, this.pcLolActive - dt);
      this.messageCooldown = Math.max(0, this.messageCooldown - dt);
      this.audio.updateStress(this.stress, dt);

      this.ui.updateHUD({
        night: this.night,
        time: this.formatTime(this.timeLeft),
        stress: this.stress,
        genepiLabel: this.genepiLabel(),
        hasKey: this.hasKey,
        talismans: this.talismans,
      });
    }

    updateThreatScheduler(dt) {
      this.scheduler.arielNext -= dt;
      this.scheduler.noaNext -= dt;
      this.scheduler.yardenaNext -= dt;

      const maxThreats = CONFIG.maxSimultaneousThreats[this.night - 1];
      const active = this.activeThreatCount();
      if (active >= maxThreats) return;

      if (this.scheduler.arielNext <= 0 && this.ariel.state === 'dormant') {
        this.ariel.activateWake(CONFIG.ariel.wakeTelegraph[this.night - 1]);
        this.scheduler.arielNext = CONFIG.ariel.cooldown[this.night - 1] + Math.random() * 4;
        this.ui.showBanner('Bruit du matelas... Ariel s’éveille.', true);
        this.audio.playEvent('ariel-warning');
      }

      if (this.night >= 2 && this.scheduler.noaNext <= 0 && this.noa.state === 'idle') {
        this.noa.signal(Math.random() < 0.5 ? 'bedroom' : 'office', CONFIG.noa.telegraph[this.night - 1]);
        this.scheduler.noaNext = CONFIG.noa.interval[this.night - 1] + Math.random() * 5;
        this.ui.showBanner(`Vent anormal vers ${this.noa.targetWindow === 'bedroom' ? 'la chambre' : 'le bureau'}.`, true);
        this.audio.playEvent('noa-warning');
      }

      if (this.night >= 3 && this.scheduler.yardenaNext <= 0 && this.yardena.state === 'idle' && !this.yardena.banished) {
        this.yardena.startKnock(CONFIG.yardena.telegraph[this.night - 1]);
        this.scheduler.yardenaNext = CONFIG.yardena.interval[this.night - 1] + Math.random() * 6;
        this.ui.showBanner('TOC TOC à la porte d’entrée.', true);
        this.audio.playEvent('yardena-knock');
      }
    }

    updateAriel(dt) {
      const n = this.night - 1;
      const speedMul = CONFIG.ariel.moveSpeedMul[n];

      if (this.ariel.state === 'signal') {
        this.ariel.stateTimer -= dt;
        if (this.ariel.stateTimer <= 0) {
          this.ariel.state = 'search';
          const order = ['bed', 'closet', 'office', 'salon'];
          const recent = this.genepi.location;
          if (recent !== 'player') {
            order.sort((a, b) => (a === recent ? -1 : b === recent ? 1 : 0));
          }
          this.ariel.searchOrder = order;
          this.ariel.searchIndex = 0;
        }
      } else if (this.ariel.state === 'search') {
        const spot = this.ariel.searchOrder[this.ariel.searchIndex] || 'bed';
        const target = this.spotToPosition(spot);
        this.ariel.moveToward(target.x, target.y, dt, speedMul);

        if (Math.hypot(this.ariel.x - target.x, this.ariel.y - target.y) < 20) {
          if (this.genepi.location === spot) {
            this.lose('Ariel', 'Ariel a retrouvé la génépi.');
            return;
          }
          this.ariel.searchIndex += 1;
          if (this.ariel.searchIndex >= this.ariel.searchOrder.length) {
            this.ariel.state = 'cooldown';
            this.ariel.stateTimer = CONFIG.ariel.investigateTime[n];
          }
        }
      } else if (this.ariel.state === 'cooldown') {
        this.ariel.stateTimer -= dt;
        if (this.ariel.stateTimer <= 0) this.ariel.state = 'dormant';
      }

      if (this.genepi.location === 'player') {
        const sameRoom = this.currentRoom === 'bedroom' || this.currentRoom === 'hall';
        if (sameRoom && this.ariel.state !== 'dormant' && Math.random() < dt * 0.25) {
          this.stress += 10 * dt;
          if (this.messageCooldown <= 0) {
            this.ui.showBanner('Ariel traque la bouteille que tu portes !', true, 900);
            this.audio.playEvent('ariel-danger');
            this.messageCooldown = 2;
          }
          if (this.currentRoom === 'bedroom' && dist(this.player, this.ariel) < 55) {
            this.lose('Ariel', 'Ariel t’a attrapé pendant que tu portais la génépi.');
          }
        }
      }
    }

    updateNoa(dt) {
      if (this.noa.state === 'idle') return;
      if (this.noa.state === 'manifesting') {
        this.noa.stateTimer -= dt;
        this.noa.windowProgress += dt;
        if (this.noa.stateTimer <= 0) {
          this.noa.state = 'breaching';
          this.noa.stateTimer = CONFIG.noa.breachTime[this.night - 1];
          this.audio.playEvent('noa-breach');
          this.ui.showBanner('Noa force la fenêtre !', true);
        }
      } else if (this.noa.state === 'breaching') {
        this.noa.stateTimer -= dt;
        if (this.noa.stateTimer <= 0) {
          this.noa.state = 'inside';
          this.noa.x = this.currentRoom === 'bedroom' ? 980 : 980;
          this.noa.y = 360;
          this.ui.showBanner('Noa est entrée.', true);
        }
      } else if (this.noa.state === 'inside') {
        if ((this.currentRoom === 'bedroom' && this.noa.targetWindow === 'bedroom') ||
            (this.currentRoom === 'office' && this.noa.targetWindow === 'office')) {
          if (Math.random() < dt * 0.8) this.stress += 14 * dt;
          if (dist(this.player, { x: 970, y: 360 }) < 70) {
            this.lose('Noa', 'Noa t’a atteint après avoir brisé la fenêtre.');
            return;
          }
        }
        this.noa.stateTimer -= dt;
        if (this.noa.stateTimer <= -4) {
          this.noa.state = 'cooldown';
          this.noa.stateTimer = 5;
        }
      } else if (this.noa.state === 'repelled' || this.noa.state === 'cooldown') {
        this.noa.stateTimer -= dt;
        if (this.noa.stateTimer <= 0) this.noa.state = 'idle';
      }

      if (this.pcLolActive > 0 && (this.noa.state === 'manifesting' || this.noa.state === 'breaching')) {
        this.noa.state = 'repelled';
        this.noa.stateTimer = 3;
        this.ui.showBanner('Noa fuit à cause du PC.', false, 1100);
      }
    }

    updateYardena(dt) {
      if (this.yardena.state === 'idle' || this.yardena.state === 'banished') return;

      if (this.yardena.state === 'knocking') {
        this.yardena.stateTimer -= dt;
        if (Math.random() < dt * 1.2) this.audio.playEvent('yardena-knock');
        if (this.yardena.stateTimer <= 0) {
          this.yardena.state = 'trying_handle';
          this.yardena.stateTimer = CONFIG.yardena.breakTime[this.night - 1];
          this.ui.showBanner('La poignée bouge violemment.', true);
        }
      } else if (this.yardena.state === 'trying_handle') {
        this.yardena.stateTimer -= dt;
        if (this.frontDoorLocked) {
          this.yardena.state = 'cooldown';
          this.yardena.stateTimer = 6;
          this.ui.showBanner('La porte tient. Yardena recule.', false);
          return;
        }

        if (this.yardena.stateTimer <= 0) {
          this.yardena.state = 'inside_hunting';
          this.audio.playEvent('yardena-break');
          this.ui.showBanner('Yardena a forcé la porte !', true);
        }
      } else if (this.yardena.state === 'inside_hunting') {
        if (this.currentRoom === 'hall') {
          const d = Math.hypot(this.player.x - this.rooms.hall.doorPoint.x, this.player.y - this.rooms.hall.doorPoint.y);
          if (d < 100) {
            this.lose('Yardena', 'Yardena est entrée et t’a touché dans le hall.');
            return;
          }
        }
        this.yardena.stateTimer -= dt;
        if (this.yardena.stateTimer <= -6) {
          this.yardena.state = 'cooldown';
          this.yardena.stateTimer = 6;
        }
      } else if (this.yardena.state === 'cooldown') {
        this.yardena.stateTimer -= dt;
        if (this.yardena.stateTimer <= 0) this.yardena.state = 'idle';
      }
    }

    activeThreatCount() {
      let c = 0;
      if (!['idle', 'dormant', 'cooldown', 'banished'].includes(this.ariel.state)) c += 1;
      if (!['idle', 'cooldown', 'repelled'].includes(this.noa.state)) c += 1;
      if (!['idle', 'cooldown', 'banished'].includes(this.yardena.state)) c += 1;
      return c;
    }

    updateStress(dt) {
      let delta = -CONFIG.calmStressRecover * dt;
      if (this.input.shift) delta += CONFIG.sprintStressPerSec * dt;

      if (this.ariel.state === 'search' || this.ariel.state === 'signal') delta += 7 * dt;
      if (this.noa.state === 'manifesting' || this.noa.state === 'breaching') delta += 8 * dt;
      if (this.yardena.state === 'knocking' || this.yardena.state === 'trying_handle') delta += 9 * dt;
      if (this.genepi.location === 'player' && this.activeThreatCount() > 0) delta += 6 * dt;

      this.stress = clamp(this.stress + delta, 0, 100);

      if (this.stress > CONFIG.stressFalseAlertThreshold && Math.random() < dt * 0.07) {
        this.ui.showBanner('...tu crois entendre quelqu’un derrière toi.', false, 700);
      }
    }

    keepInRoom() {
      this.player.x = clamp(this.player.x, 40, CONFIG.size.w - 40);
      this.player.y = clamp(this.player.y, 40, CONFIG.size.h - 40);
    }

    spotToPosition(spot) {
      for (const room of Object.values(this.rooms)) {
        const zone = room.interactables.find((interactable) => interactable.type === 'genepiSpot' && interactable.spot === spot);
        if (zone) return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
      }
      return { x: this.player.x, y: this.player.y };
    }

    genepiLabel() {
      const map = {
        bed: 'Sur le lit',
        closet: 'Placard chambre',
        office: 'Cachette bureau',
        salon: 'Cachette salon',
        player: 'Portée par Gabriel',
      };
      return map[this.genepi.location] || 'Inconnue';
    }

    finishNight() {
      this.audio.playEvent('night-clear');
      if (this.night >= 4) {
        this.state = 'ending';
        this.ui.showOverlay('ending', true);
        return;
      }
      this.state = 'night_transition';
      this.ui.showBanner(`Nuit ${this.night} terminée.`, false);
      setTimeout(() => this.enterNight(this.night + 1), 1500);
    }

    lose(threatName, reason) {
      this.state = 'game_over';
      this.ui.showGameOver(`${threatName} : ${reason}`, this.night);
    }

    render() {
      const ctx = this.ctx;
      const room = this.rooms[this.currentRoom];
      const stressShake = this.stress > 35 ? (Math.random() - 0.5) * (this.stress / 35) : 0;

      ctx.save();
      ctx.clearRect(0, 0, CONFIG.size.w, CONFIG.size.h);
      ctx.translate(stressShake, stressShake);

      const bg = this.images[room.bg];
      if (bg) ctx.drawImage(bg, 0, 0, CONFIG.size.w, CONFIG.size.h);
      else {
        ctx.fillStyle = room.color;
        ctx.fillRect(0, 0, CONFIG.size.w, CONFIG.size.h);
      }

      this.drawRoomDecor(room);
      this.drawInteractables(room);
      this.drawGenepi(room);
      this.drawThreats();
      this.drawPlayer();
      this.drawLighting();
      if (this.showHitboxes) this.drawDebugLayout(room);

      ctx.restore();
    }

    drawRoomDecor(room) {
      const c = this.ctx;
      if (!this.images[room.bg]) {
        c.fillStyle = 'rgba(255,255,255,0.03)';
        for (let i = 0; i < 20; i += 1) {
          c.fillRect((i * 77) % 1280, ((i * 53) % 720), 42, 4);
        }
      }
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.font = '20px monospace';
      c.fillText(room.name, 20, 32);
    }

    drawInteractables(room) {
      const c = this.ctx;
      if (this.currentRoom === 'hall' && !this.hasKey) {
        this.ctx.fillStyle = '#d6f4ff';
        this.ctx.beginPath();
        this.ctx.arc(this.keyPos.x, this.keyPos.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
      }

      if (this.currentRoom === 'hall' && this.night >= 3 && this.talismans > 0) {
        this.ctx.fillStyle = '#bafcb7';
        this.ctx.beginPath();
        this.ctx.arc(this.rooms.hall.talismanSpawn.x, this.rooms.hall.talismanSpawn.y, 9, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    drawDebugLayout(room) {
      const c = this.ctx;
      c.save();
      c.font = '14px monospace';
      c.textBaseline = 'top';

      const drawRect = (zone, color, label) => {
        c.strokeStyle = color;
        c.lineWidth = 2;
        c.strokeRect(zone.x, zone.y, zone.w, zone.h);
        c.fillStyle = 'rgba(0,0,0,0.68)';
        c.fillRect(zone.x, zone.y - 18, Math.min(260, Math.max(110, label.length * 7)), 16);
        c.fillStyle = color;
        c.fillText(label, zone.x + 4, zone.y - 17);
      };

      room.doors.forEach((door, index) => {
        drawRect(door, '#ffd86b', `door:${door.id || door.to || index}`);
      });
      room.interactables.forEach((interactable, index) => {
        drawRect(interactable, '#7fe8ff', `it:${interactable.id || interactable.type || index}`);
      });

      const drawPoint = (point, label, color = '#ff8dcf') => {
        if (!point) return;
        c.fillStyle = color;
        c.beginPath();
        c.arc(point.x, point.y, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,0.72)';
        c.fillRect(point.x + 8, point.y - 12, Math.min(180, Math.max(80, label.length * 7)), 16);
        c.fillStyle = color;
        c.fillText(label, point.x + 11, point.y - 11);
      };

      drawPoint(room.spawn, 'spawn', '#f4a2ff');
      drawPoint(room.arielSpawn, 'arielSpawn', '#ff9d9d');
      drawPoint(room.doorPoint, 'doorPoint', '#ffc58d');
      if (room.keySpawns) room.keySpawns.forEach((point, index) => drawPoint(point, `keySpawn#${index + 1}`, '#99f3ff'));
      drawPoint(room.talismanSpawn, 'talismanSpawn', '#b4ff9b');

      c.restore();
    }

    drawSprite(key, x, y, width, height, fallback) {
      const img = this.images[key];
      if (img) {
        this.ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
        return;
      }
      if (fallback) fallback(this.ctx);
    }

    drawPlayer() {
      const c = this.ctx;
      const size = this.player.radius * 2.8;
      this.drawSprite('gabriel', this.player.x, this.player.y, size, size, () => {
        c.fillStyle = this.player.color;
        c.beginPath();
        c.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
        c.fill();
      });

      if (this.player.carryingGenepi) {
        this.drawSprite('genepi', this.player.x + 16, this.player.y - 10, 16, 30, () => {
          c.fillStyle = '#8ef0ab';
          c.fillRect(this.player.x + 12, this.player.y - 8, 10, 18);
        });
      }
    }

    drawGenepi(room) {
      if (this.genepi.location === 'player') return;
      const spot = room.interactables.find((i) => i.type === 'genepiSpot' && i.spot === this.genepi.location);
      if (!spot) return;
      const x = spot.x + spot.w / 2;
      const y = spot.y + spot.h / 2;
      this.drawSprite('genepi', x, y, 18, 34, (c) => {
        c.fillStyle = '#8ef0ab';
        c.fillRect(x - 6, y - 11, 12, 22);
      });
    }

    drawThreats() {
      const c = this.ctx;
      if (this.ariel.state !== 'dormant' && (this.currentRoom === 'bedroom' || this.currentRoom === 'hall')) {
        const size = this.ariel.radius * 3;
        this.drawSprite('brother', this.ariel.x, this.ariel.y, size, size, () => {
          c.fillStyle = '#8e79ff';
          c.beginPath();
          c.arc(this.ariel.x, this.ariel.y, this.ariel.radius, 0, Math.PI * 2);
          c.fill();
        });
      }

      if (this.noa.state === 'manifesting' || this.noa.state === 'breaching' || this.noa.state === 'inside') {
        if ((this.currentRoom === 'bedroom' && this.noa.targetWindow === 'bedroom') ||
            (this.currentRoom === 'office' && this.noa.targetWindow === 'office')) {
          this.drawSprite('noa', 1090, 315, 74, 146, () => {
            c.fillStyle = 'rgba(180,255,255,0.68)';
            c.fillRect(1055, 245, 70, 140);
          });
        }
      }

      if (['knocking', 'trying_handle', 'inside_hunting'].includes(this.yardena.state) && this.currentRoom === 'hall') {
        const x = this.rooms.hall.doorPoint.x + 18;
        const y = this.rooms.hall.doorPoint.y;
        const size = this.yardena.radius * 3;
        this.drawSprite('yardena', x, y, size, size, () => {
          c.fillStyle = '#ff9d9d';
          c.beginPath();
          c.arc(x, y, this.yardena.radius, 0, Math.PI * 2);
          c.fill();
        });
      }
    }

    drawLighting() {
      const c = this.ctx;
      const g = c.createRadialGradient(this.player.x, this.player.y, 60, this.player.x, this.player.y, 430);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.63 + this.stress / 270})`);
      c.fillStyle = g;
      c.fillRect(0, 0, CONFIG.size.w, CONFIG.size.h);

      if (this.stress > 65) {
        c.fillStyle = `rgba(140, 10, 10, ${(this.stress - 60) / 220})`;
        c.fillRect(0, 0, CONFIG.size.w, CONFIG.size.h);
      }
    }

    formatTime(seconds) {
      const s = Math.max(0, Math.floor(seconds));
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    }

    frame = (ts) => {
      if (!this.lastTime) this.lastTime = ts;
      const dt = Math.min(0.033, (ts - this.lastTime) / 1000);
      this.lastTime = ts;
      this.update(dt);
      this.render();
      this.loopHandle = requestAnimationFrame(this.frame);
    };

    run() {
      cancelAnimationFrame(this.loopHandle);
      this.lastTime = 0;
      this.loopHandle = requestAnimationFrame(this.frame);
    }
  }

  window.AGS_Game = { Game };
})();
