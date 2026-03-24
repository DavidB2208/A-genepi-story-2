(() => {
  class Actor {
    constructor(x, y, speed, radius, color) {
      this.x = x;
      this.y = y;
      this.speed = speed;
      this.radius = radius;
      this.color = color;
    }

    moveToward(targetX, targetY, dt, speedMultiplier = 1) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = this.speed * speedMultiplier * dt;
      if (d <= step) {
        this.x = targetX;
        this.y = targetY;
      } else {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      }
    }
  }

  class Player extends Actor {
    constructor(spawn) {
      super(spawn.x, spawn.y, 140, 16, '#9cd9ff');
      this.baseSpeed = 140;
      this.sprintSpeed = 205;
      this.carryingGenepi = false;
      this.interactionLock = 0;
    }

    update(dt, input, stress) {
      const sprinting = input.shift && this.interactionLock <= 0;
      const speedPenalty = 1 - Math.min(0.3, stress / 200);
      this.speed = (sprinting ? this.sprintSpeed : this.baseSpeed) * speedPenalty;

      if (this.interactionLock > 0) {
        this.interactionLock -= dt;
        return;
      }

      const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (!ax && !ay) return;
      const n = Math.hypot(ax, ay) || 1;
      this.x += (ax / n) * this.speed * dt;
      this.y += (ay / n) * this.speed * dt;
    }
  }

  class Genepi {
    constructor() {
      this.location = 'bed';
      this.hiddenAt = null;
      this.lastMovedAt = 0;
      this.beingCarried = false;
    }

    setLocation(location, gameTime) {
      this.location = location;
      this.beingCarried = location === 'player';
      this.hiddenAt = ['closet', 'office', 'salon'].includes(location) ? location : null;
      this.lastMovedAt = gameTime;
    }
  }

  class Ariel extends Actor {
    constructor(spawn) {
      super(spawn.x, spawn.y, 85, 15, '#7f70ff');
      this.state = 'dormant';
      this.stateTimer = 0;
      this.investigateTarget = null;
      this.knownGenepiLocation = 'bed';
      this.lastSearchIndex = -1;
    }

    activateWake(duration) {
      this.state = 'signal';
      this.stateTimer = duration;
    }
  }

  class Noa extends Actor {
    constructor() {
      super(0, 0, 0, 14, '#c9ffff');
      this.state = 'idle';
      this.stateTimer = 0;
      this.targetWindow = null;
      this.windowProgress = 0;
    }

    signal(windowId, telegraphTime) {
      this.state = 'manifesting';
      this.targetWindow = windowId;
      this.stateTimer = telegraphTime;
      this.windowProgress = 0;
    }
  }

  class Yardena extends Actor {
    constructor(spawn) {
      super(spawn.x, spawn.y, 100, 17, '#ff8d8d');
      this.state = 'idle';
      this.stateTimer = 0;
      this.breakProgress = 0;
      this.banished = false;
    }

    startKnock(telegraphTime) {
      if (this.banished) return;
      this.state = 'knocking';
      this.stateTimer = telegraphTime;
      this.breakProgress = 0;
    }
  }

  window.AGS_Entities = {
    Player,
    Genepi,
    Ariel,
    Noa,
    Yardena,
  };
})();
