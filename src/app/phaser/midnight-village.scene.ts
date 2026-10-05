import * as Phaser from 'phaser';
import { CharacterType, DeadBody, PlayerGameState, SafePlayer, TaskDefinition } from '../engine/types';
import { CHARACTER_ARCHETYPES, VILLAGE_TASKS } from '../engine/roles';

export interface ProximityState {
  nearTask: TaskDefinition | null;
  nearBody: DeadBody | null;
  nearEmergency: boolean;
  nearKillTarget: SafePlayer | null;
}

export class MidnightVillageScene extends Phaser.Scene {
  private localPlayerSprite!: Phaser.Physics.Arcade.Sprite;
  private localPlayerGhost!: Phaser.GameObjects.Sprite;
  private playerSprites: Map<string, {
    container: Phaser.GameObjects.Container;
    sprite: Phaser.GameObjects.Sprite;
    nameText: Phaser.GameObjects.Text;
    shadow: Phaser.GameObjects.Ellipse;
  }> = new Map();

  private bodySprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private taskMarkers: Map<string, { container: Phaser.GameObjects.Container; ping: Phaser.GameObjects.Arc }> = new Map();
  private wallLayer!: Phaser.Physics.Arcade.StaticGroup;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  public gameState: PlayerGameState | null = null;
  public onMoveCallback?: (x: number, y: number, vx: number, vy: number, facing: 'left' | 'right', isMoving: boolean) => void;
  public onProximityCallback?: (state: ProximityState) => void;

  private lastSentTime = 0;
  private currentFacing: 'left' | 'right' = 'right';
  private walkStep = 0;

  // Vision darkness overlay for lights sabotage
  private darknessGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MidnightVillageScene' });
  }

  preload(): void {
    // Generate programmatic procedural textures so game is 100% self-contained without external asset loads
    this.generateProceduralTextures();
  }

  create(): void {
    this.physics.world.setBounds(0, 0, 2400, 1800);

    // Build the 2D Research Settlement World
    this.buildMapEnvironment();

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    }) as any;

    // Create Local Player
    this.createLocalPlayer();

    // Darkness layer for Lights sabotage
    this.darknessGraphics = this.add.graphics();
    this.darknessGraphics.setDepth(200);

    // Click / touch to move support
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.localPlayerSprite || !this.localPlayerSprite.active) return;
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      this.physics.moveToObject(this.localPlayerSprite, worldPoint, 220);
    });
  }

  private generateProceduralTextures(): void {
    // 1. Character texture for each character type
    Object.keys(CHARACTER_ARCHETYPES).forEach((charKey) => {
      const arch = CHARACTER_ARCHETYPES[charKey as CharacterType];
      this.drawCharacterTexture(`char_${charKey}`, arch.color, arch.accentColor);
      this.drawGhostTexture(`ghost_${charKey}`, arch.color);
      this.drawDeadBodyTexture(`dead_${charKey}`, arch.color);
    });

    // 2. Floor tile
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 64;
    floorCanvas.height = 64;
    const ctx = floorCanvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 64, 64);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(30, 30, 4, 4);
    this.textures.addCanvas('floor_tile', floorCanvas);

    // 3. Task Console Icon
    const taskCanvas = document.createElement('canvas');
    taskCanvas.width = 36;
    taskCanvas.height = 36;
    const tctx = taskCanvas.getContext('2d')!;
    tctx.fillStyle = '#eab308';
    tctx.beginPath();
    tctx.arc(18, 18, 14, 0, Math.PI * 2);
    tctx.fill();
    tctx.fillStyle = '#000000';
    tctx.font = 'bold 16px sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.fillText('!', 18, 18);
    this.textures.addCanvas('task_icon', taskCanvas);
  }

  private drawCharacterTexture(key: string, baseColor: string, darkColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 56;
    const ctx = canvas.getContext('2d')!;

    // Backpack
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.roundRect(4, 18, 10, 24, 4);
    ctx.fill();

    // Body suit
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(10, 14, 28, 32, 10);
    ctx.fill();

    // Belt / Suit detail
    ctx.fillStyle = darkColor;
    ctx.fillRect(10, 32, 28, 4);

    // Head / Visor
    ctx.fillStyle = '#38bdf8'; // reflective visor
    ctx.beginPath();
    ctx.roundRect(18, 18, 18, 12, 6);
    ctx.fill();

    // Visor highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(28, 21, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Feet / Boots
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(14, 44, 9, 8, 3);
    ctx.roundRect(25, 44, 9, 8, 3);
    ctx.fill();

    this.textures.addCanvas(key, canvas);
  }

  private drawGhostTexture(key: string, baseColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 56;
    const ctx = canvas.getContext('2d')!;

    ctx.globalAlpha = 0.65;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(24, 22, 16, Math.PI, 0, false);
    ctx.lineTo(40, 44);
    ctx.lineTo(34, 40);
    ctx.lineTo(28, 46);
    ctx.lineTo(20, 40);
    ctx.lineTo(14, 46);
    ctx.lineTo(8, 44);
    ctx.closePath();
    ctx.fill();

    // Visor
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.roundRect(18, 18, 14, 8, 4);
    ctx.fill();

    this.textures.addCanvas(key, canvas);
  }

  private drawDeadBodyTexture(key: string, baseColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;

    // Chalk / blood splat outline
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.beginPath();
    ctx.ellipse(28, 20, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fallen suit body (horizontal)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(10, 8, 36, 18, 8);
    ctx.fill();

    // Cracked Visor
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(28, 10, 14, 9, 4);
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 11);
    ctx.lineTo(38, 18);
    ctx.stroke();

    this.textures.addCanvas(key, canvas);
  }

  private buildMapEnvironment(): void {
    // 1. Floor grid background across map
    const bgTile = this.add.tileSprite(1200, 900, 2400, 1800, 'floor_tile');
    bgTile.setDepth(0);

    this.wallLayer = this.physics.add.staticGroup();

    // Map Outer Border walls
    this.createWallRect(1200, 20, 2400, 40); // Top
    this.createWallRect(1200, 1780, 2400, 40); // Bottom
    this.createWallRect(20, 900, 40, 1800); // Left
    this.createWallRect(2380, 900, 40, 1800); // Right

    // 2. Build 10 Distinct Rooms
    this.buildCentralSquare();
    this.buildLaboratory();
    this.buildPowerStation();
    this.buildObservatory();
    this.buildGreenhouse();
    this.buildCommunications();
    this.buildMedicalCenter();
    this.buildStorage();
    this.buildWorkshop();
    this.buildDormitories();

    // 3. Place Interactive Task Consoles
    VILLAGE_TASKS.forEach((task) => {
      this.createTaskStation(task);
    });
  }

  private createWallRect(x: number, y: number, width: number, height: number): void {
    const wall = this.add.rectangle(x, y, width, height, 0x1e293b);
    wall.setStrokeStyle(2, 0x334155);
    wall.setDepth(10);
    this.physics.add.existing(wall, true);
    this.wallLayer.add(wall);
  }

  private buildCentralSquare(): void {
    // Central Square: Circular Meeting Table with Emergency Siren
    const circle = this.add.circle(1200, 950, 140, 0x0f172a, 0.9);
    circle.setStrokeStyle(3, 0x6366f1);
    circle.setDepth(5);

    // Emergency Meeting Siren button in center
    const sirenBase = this.add.circle(1200, 950, 36, 0x1e1b4b);
    sirenBase.setStrokeStyle(3, 0xef4444);
    sirenBase.setDepth(6);

    const sirenButton = this.add.circle(1200, 950, 24, 0xdc2626);
    sirenButton.setDepth(7);

    // Label
    const text = this.add.text(1200, 890, 'EMERGENCY SIREN', {
      fontFamily: 'Cinzel, sans-serif',
      fontSize: '11px',
      color: '#f87171'
    }).setOrigin(0.5).setDepth(8);

    // Subtle table collision box so players don't walk over the button center
    this.createWallRect(1200, 950, 48, 48);
  }

  private buildLaboratory(): void {
    // Top Left: Laboratory (x: 500, y: 400)
    this.addRoomFloor(500, 400, 400, 300, 0x1e1b4b, 'LABORATORY');
    this.createWallRect(300, 400, 20, 300); // West wall
    this.createWallRect(500, 250, 400, 20); // North wall
    this.createWallRect(500, 550, 260, 20); // South wall with door gap
    this.createWallRect(700, 350, 20, 160); // East wall with door gap

    // Benches / props
    this.createWallRect(450, 320, 140, 30);
    this.createWallRect(420, 450, 40, 40);
  }

  private buildPowerStation(): void {
    // Bottom Left: Power Station (x: 550, y: 1500)
    this.addRoomFloor(550, 1500, 440, 320, 0x312e81, 'POWER STATION');
    this.createWallRect(330, 1500, 20, 320); // West
    this.createWallRect(550, 1660, 440, 20); // South
    this.createWallRect(550, 1340, 280, 20); // North door gap
    this.createWallRect(770, 1500, 20, 200); // East door gap

    // Generator coils
    this.createWallRect(480, 1450, 60, 60);
    this.createWallRect(620, 1520, 60, 60);
  }

  private buildObservatory(): void {
    // Top Center: Observatory (x: 1200, y: 300)
    this.addRoomFloor(1200, 300, 360, 280, 0x172554, 'OBSERVATORY');
    this.createWallRect(1200, 160, 360, 20); // North
    this.createWallRect(1020, 300, 20, 280); // West
    this.createWallRect(1380, 300, 20, 280); // East
    this.createWallRect(1100, 440, 120, 20); // South door gap
    this.createWallRect(1300, 440, 120, 20);

    // Telescope base
    this.createWallRect(1200, 260, 70, 70);
  }

  private buildGreenhouse(): void {
    // Top Right: Greenhouse (x: 2000, y: 450)
    this.addRoomFloor(2000, 450, 420, 320, 0x064e3b, 'GREENHOUSE');
    this.createWallRect(2210, 450, 20, 320); // East
    this.createWallRect(2000, 290, 420, 20); // North
    this.createWallRect(2000, 610, 260, 20); // South door gap
    this.createWallRect(1790, 450, 20, 200); // West door gap

    // Hydroponic planter beds
    this.createWallRect(1960, 420, 120, 40);
    this.createWallRect(2140, 520, 40, 100);
  }

  private buildCommunications(): void {
    // Bottom Right: Communications (x: 1950, y: 1500)
    this.addRoomFloor(1950, 1500, 420, 320, 0x134e4a, 'COMMUNICATIONS');
    this.createWallRect(2160, 1500, 20, 320); // East
    this.createWallRect(1950, 1660, 420, 20); // South
    this.createWallRect(1950, 1340, 260, 20); // North door gap
    this.createWallRect(1740, 1500, 20, 200); // West door gap

    // Radar terminal
    this.createWallRect(2050, 1450, 60, 50);
  }

  private buildMedicalCenter(): void {
    // Mid Left: Medical (x: 850, y: 700)
    this.addRoomFloor(850, 700, 280, 240, 0x164e63, 'MED CENTER');
    this.createWallRect(710, 700, 20, 240);
    this.createWallRect(850, 580, 280, 20);
    this.createWallRect(850, 820, 160, 20); // Door gap
    this.createWallRect(850, 700, 50, 50);
  }

  private buildStorage(): void {
    // Bottom Center: Storage (x: 1200, y: 1600)
    this.addRoomFloor(1200, 1600, 360, 240, 0x3b0764, 'STORAGE');
    this.createWallRect(1200, 1720, 360, 20);
    this.createWallRect(1020, 1600, 20, 240);
    this.createWallRect(1380, 1600, 20, 240);
    this.createWallRect(1200, 1480, 200, 20); // Door gap
    this.createWallRect(1200, 1620, 80, 40);
  }

  private buildWorkshop(): void {
    // Mid Right: Workshop (x: 1550, y: 700)
    this.addRoomFloor(1550, 700, 280, 240, 0x451a03, 'WORKSHOP');
    this.createWallRect(1690, 700, 20, 240);
    this.createWallRect(1550, 580, 280, 20);
    this.createWallRect(1550, 820, 160, 20); // Door gap
    this.createWallRect(1550, 700, 50, 50);
  }

  private buildDormitories(): void {
    // Center North: Dormitories (x: 1200, y: 650)
    this.addRoomFloor(1200, 650, 300, 180, 0x0f172a, 'DORMITORIES');
    this.createWallRect(1050, 650, 20, 180);
    this.createWallRect(1350, 650, 20, 180);
    this.createWallRect(1200, 560, 300, 20);
  }

  private addRoomFloor(x: number, y: number, w: number, h: number, tint: number, title: string): void {
    const floor = this.add.rectangle(x, y, w, h, tint, 0.45);
    floor.setStrokeStyle(1, 0x475569);
    floor.setDepth(2);

    const text = this.add.text(x, y - (h / 2) + 20, title, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#94a3b8'
    }).setOrigin(0.5).setDepth(3);
  }

  private createTaskStation(task: TaskDefinition): void {
    const container = this.add.container(task.x, task.y);
    container.setDepth(15);

    // Glowing circle
    const ping = this.add.circle(0, 0, 16, 0xeab308, 0.25);
    const sprite = this.add.sprite(0, 0, 'task_icon');

    this.tweens.add({
      targets: ping,
      scale: 1.6,
      alpha: 0,
      duration: 1200,
      repeat: -1
    });

    container.add([ping, sprite]);
    this.taskMarkers.set(task.id, { container, ping });
  }

  private createLocalPlayer(): void {
    const char = this.gameState?.myCharacter || 'engineer';
    this.localPlayerSprite = this.physics.add.sprite(1200, 950, `char_${char}`);
    this.localPlayerSprite.setDepth(50);
    this.localPlayerSprite.setCollideWorldBounds(true);
    this.localPlayerSprite.body!.setSize(28, 20);
    this.localPlayerSprite.body!.setOffset(10, 32);

    // Collide with settlement walls
    this.physics.add.collider(this.localPlayerSprite, this.wallLayer);

    // Camera follow with smooth damping
    this.cameras.main.startFollow(this.localPlayerSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.setBounds(0, 0, 2400, 1800);
  }

  override update(time: number, _delta: number): void {
    if (!this.localPlayerSprite || !this.localPlayerSprite.active) return;

    const isAlive = this.gameState?.players.find(p => p.id === this.gameState?.myPlayerId)?.isAlive ?? true;
    const speed = isAlive ? (this.gameState?.settings?.speed || 220) : 320; // Ghosts move faster

    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) vx -= speed;
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) vx += speed;
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) vy -= speed;
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) vy += speed;

    // Normalize diagonal speed
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    this.localPlayerSprite.setVelocity(vx, vy);

    const isMoving = vx !== 0 || vy !== 0;
    if (vx < 0) {
      this.currentFacing = 'left';
      this.localPlayerSprite.setFlipX(true);
    } else if (vx > 0) {
      this.currentFacing = 'right';
      this.localPlayerSprite.setFlipX(false);
    }

    // Procedural walk cycle bobbing
    if (isMoving) {
      this.walkStep += 0.2;
      this.localPlayerSprite.y += Math.sin(this.walkStep) * 0.4;
    }

    // Ghosts pass through walls
    if (!isAlive) {
      this.localPlayerSprite.body!.checkCollision.none = true;
    } else {
      this.localPlayerSprite.body!.checkCollision.none = false;
    }

    // Send position updates at 20Hz (~50ms)
    if (time - this.lastSentTime > 50) {
      this.lastSentTime = time;
      if (this.onMoveCallback) {
        this.onMoveCallback(
          this.localPlayerSprite.x,
          this.localPlayerSprite.y,
          vx,
          vy,
          this.currentFacing,
          isMoving
        );
      }
    }

    // Check proximities to tasks, dead bodies, emergency button, and kill targets
    this.checkProximities();

    // Render darkness mask if Lights are sabotaged
    this.renderDarkness();
  }

  private checkProximities(): void {
    if (!this.localPlayerSprite || !this.gameState) return;
    const px = this.localPlayerSprite.x;
    const py = this.localPlayerSprite.y;
    const isImpostor = this.gameState.myRole === 'impostor';
    const isAlive = this.gameState.players.find(p => p.id === this.gameState?.myPlayerId)?.isAlive ?? true;

    // 1. Task Proximity
    let nearTask: TaskDefinition | null = null;
    const myTasks = this.gameState.myTasks || [];
    for (const t of VILLAGE_TASKS) {
      const isAssigned = myTasks.some(pt => pt.taskId === t.id && !pt.completed);
      if (isAssigned) {
        const dist = Math.hypot(px - t.x, py - t.y);
        if (dist < 100) {
          nearTask = t;
          break;
        }
      }
    }

    // 2. Dead Body Proximity
    let nearBody: DeadBody | null = null;
    if (isAlive) {
      for (const b of this.gameState.deadBodies || []) {
        const dist = Math.hypot(px - b.x, py - b.y);
        if (dist < 140) {
          nearBody = b;
          break;
        }
      }
    }

    // 3. Central Emergency Siren Proximity (x: 1200, y: 950)
    const distEmergency = Math.hypot(px - 1200, py - 950);
    const nearEmergency = isAlive && distEmergency < 150;

    // 4. Kill Target Proximity (for Impostor)
    let nearKillTarget: SafePlayer | null = null;
    if (isImpostor && isAlive && this.gameState.killCooldown <= 0) {
      const livingVillagers = this.gameState.players.filter(
        p => p.isAlive && p.id !== this.gameState?.myPlayerId && p.role !== 'impostor'
      );
      for (const v of livingVillagers) {
        const dist = Math.hypot(px - v.x, py - v.y);
        if (dist < 130) {
          nearKillTarget = v;
          break;
        }
      }
    }

    if (this.onProximityCallback) {
      this.onProximityCallback({
        nearTask,
        nearBody,
        nearEmergency,
        nearKillTarget
      });
    }
  }

  private renderDarkness(): void {
    this.darknessGraphics.clear();
    const isLightsOut = this.gameState?.sabotage.active && this.gameState.sabotage.type === 'lights';
    const isDead = !(this.gameState?.players.find(p => p.id === this.gameState?.myPlayerId)?.isAlive ?? true);

    // Impostors and ghosts can see in the dark!
    const isImpostor = this.gameState?.myRole === 'impostor';
    if (!isLightsOut || isImpostor || isDead) return;

    // Dark vision mask: whole world black except a small torch circle around player
    const px = this.localPlayerSprite.x;
    const py = this.localPlayerSprite.y;
    const radius = 130;

    this.darknessGraphics.fillStyle(0x000000, 0.95);
    this.darknessGraphics.fillRect(0, 0, 2400, 1800);

    // Cut hole in darkness around player
    // In Phaser canvas/WebGL graphics, draw an inverted light circle
    this.darknessGraphics.fillStyle(0x070a13, 0.2);
    this.darknessGraphics.fillCircle(px, py, radius);
  }

  public syncGameState(state: PlayerGameState): void {
    this.gameState = state;

    // Sync remote player sprites
    const existingIds = new Set(this.playerSprites.keys());
    const meId = state.myPlayerId;
    const viewerIsImpostor = state.myRole === 'impostor';

    state.players.forEach((p) => {
      if (p.id === meId) {
        // Sync local texture if player turned into ghost
        if (this.localPlayerSprite && !p.isAlive) {
          this.localPlayerSprite.setTexture(`ghost_${p.character}`);
          this.localPlayerSprite.setAlpha(0.6);
        }
        return;
      }

      existingIds.delete(p.id);

      let peerObj = this.playerSprites.get(p.id);
      if (!peerObj) {
        const texKey = p.isAlive ? `char_${p.character}` : `ghost_${p.character}`;
        const sprite = this.add.sprite(0, 0, texKey);
        if (!p.isAlive) sprite.setAlpha(0.6);

        const shadow = this.add.ellipse(0, 24, 28, 10, 0x000000, 0.35);

        // Name text
        const isFellowImpostor = viewerIsImpostor && state.fellowImpostors?.includes(p.id);
        const nameText = this.add.text(0, -34, p.name, {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: isFellowImpostor ? '#ef4444' : '#f8fafc',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5);

        const container = this.add.container(p.x, p.y, [shadow, sprite, nameText]);
        container.setDepth(40);

        peerObj = { container, sprite, nameText, shadow };
        this.playerSprites.set(p.id, peerObj);
      } else {
        // Interpolate position
        this.tweens.add({
          targets: peerObj.container,
          x: p.x,
          y: p.y,
          duration: 60,
          ease: 'Linear'
        });

        // Update ghost texture if newly died
        if (!p.isAlive && peerObj.sprite.texture.key.startsWith('char_')) {
          peerObj.sprite.setTexture(`ghost_${p.character}`);
          peerObj.sprite.setAlpha(0.6);
        }
      }
    });

    // Remove disconnected players
    existingIds.forEach((id) => {
      const obj = this.playerSprites.get(id);
      if (obj) {
        obj.container.destroy();
        this.playerSprites.delete(id);
      }
    });

    // Sync dead bodies
    const currentBodyIds = new Set(this.bodySprites.keys());
    (state.deadBodies || []).forEach((body) => {
      currentBodyIds.delete(body.id);
      if (!this.bodySprites.has(body.id)) {
        const bSprite = this.add.sprite(body.x, body.y, `dead_${body.character}`);
        bSprite.setDepth(25);
        this.bodySprites.set(body.id, bSprite);
      }
    });

    currentBodyIds.forEach((id) => {
      const b = this.bodySprites.get(id);
      if (b) {
        b.destroy();
        this.bodySprites.delete(id);
      }
    });

    // Dim task markers if completed
    const myTasks = state.myTasks || [];
    VILLAGE_TASKS.forEach((t) => {
      const marker = this.taskMarkers.get(t.id);
      if (marker) {
        const taskInfo = myTasks.find(pt => pt.taskId === t.id);
        if (!taskInfo || taskInfo.completed) {
          marker.container.setAlpha(0.25);
        } else {
          marker.container.setAlpha(1);
        }
      }
    });
  }

  public setLocalPlayerPosition(x: number, y: number): void {
    if (this.localPlayerSprite) {
      this.localPlayerSprite.setPosition(x, y);
    }
  }
}
