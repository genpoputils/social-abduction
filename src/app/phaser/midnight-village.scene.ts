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
  private localPlayerContainer!: Phaser.GameObjects.Container;
  private localPlayerShadow!: Phaser.GameObjects.Ellipse;
  private localPlayerNameText!: Phaser.GameObjects.Text;
  private localPlayerLanternGlow!: Phaser.GameObjects.Arc;

  private playerEntities: Map<string, {
    container: Phaser.GameObjects.Container;
    sprite: Phaser.GameObjects.Sprite;
    nameText: Phaser.GameObjects.Text;
    shadow: Phaser.GameObjects.Ellipse;
    lanternGlow: Phaser.GameObjects.Arc;
    walkTimer: number;
    lastX: number;
    lastY: number;
  }> = new Map();

  private bodySprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private taskTerminals: Map<string, { container: Phaser.GameObjects.Container; pulseArc: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }> = new Map();
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
  private idleBreath = 0;

  // Floating prompt game object
  private promptContainer!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;

  // Darkness & Lighting Mask
  private visionMask!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MidnightVillageScene' });
  }

  preload(): void {
    this.generateProceduralArtAssets();
  }

  create(): void {
    this.physics.world.setBounds(0, 0, 2400, 1800);

    // 1. Build Settlement Environment (Floors, Walls, Furniture & Props)
    this.buildSettlementWorld();

    // 2. Keyboard & Input Handling
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    }) as any;

    // 3. Create Local Player Entity
    this.createLocalPlayerEntity();

    // 4. In-World Floating Interaction Prompt
    this.createFloatingPrompt();

    // 5. Atmospheric Vision & Lighting Layer
    this.visionMask = this.add.graphics();
    this.visionMask.setDepth(250);

    // 6. Camera Setup
    this.cameras.main.setBounds(0, 0, 2400, 1800);
    this.cameras.main.setZoom(1.15);
    if (this.localPlayerSprite) {
      this.cameras.main.startFollow(this.localPlayerSprite, true, 0.08, 0.08);
    }

    // Pointer click-to-move support
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.localPlayerSprite || !this.localPlayerSprite.active) return;
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      this.physics.moveToObject(this.localPlayerSprite, worldPoint, 220);
    });
  }

  // =========================================================================
  // 1. PROCEDURAL ART & GRAPHICAL ASSET ENGINE
  // =========================================================================
  private generateProceduralArtAssets(): void {
    // Generate Character Walk & Idle Sprites for all 8 Archetypes
    Object.keys(CHARACTER_ARCHETYPES).forEach((charKey) => {
      const arch = CHARACTER_ARCHETYPES[charKey as CharacterType];
      this.generateCharacterSpritesheet(charKey, arch.color, arch.accentColor);
      this.generateGhostTexture(`ghost_${charKey}`, arch.color);
      this.generateFallenBodyTexture(`dead_${charKey}`, arch.color);
    });

    // Floor Textures
    this.generateCobbleTexture();
    this.generateLabTileTexture();
    this.generateWoodPlankTexture();
    this.generateSteelPlateTexture();
    this.generateGreenhouseSoilTexture();

    // Prop Textures
    this.generateBellTowerTexture();
    this.generateTelescopeTexture();
    this.generateGeneratorTexture();
    this.generateWorkstationTexture();
    this.generateMedBedTexture();
    this.generateRadioConsoleTexture();
    this.generateCratesTexture();
    this.generateStreetLanternTexture();
    this.generateTaskIconTexture();
  }

  /**
   * Generates a 4-frame animated spritesheet for human-proportioned characters.
   * Frame 0: Idle Stance (Lantern raised, upright)
   * Frame 1: Left step forward, right arm swing
   * Frame 2: Neutral passing stance
   * Frame 3: Right step forward, left arm swing
   */
  private generateCharacterSpritesheet(charKey: string, primaryColor: string, accentColor: string): void {
    const frameW = 52;
    const frameH = 68;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * 4;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < 4; f++) {
      const ox = f * frameW;
      const legOffset = (f === 1) ? -4 : (f === 3) ? 4 : 0;
      const armOffset = (f === 1) ? 3 : (f === 3) ? -3 : 0;

      // 1. Back Arm & Signature Equipment
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(ox + 8, 28 - armOffset, 8, 18, 4);
      ctx.fill();

      // 2. Legs & Expedition Boots
      ctx.fillStyle = '#0f172a'; // Rugged dark trousers
      // Left leg
      ctx.fillRect(ox + 16, 44, 8, 14 + legOffset);
      // Right leg
      ctx.fillRect(ox + 28, 44, 8, 14 - legOffset);
      // Boots
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(ox + 14, 56 + legOffset, 11, 7);
      ctx.fillRect(ox + 27, 56 - legOffset, 11, 7);

      // 3. Torso / Tailored Expedition Coat
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.roundRect(ox + 14, 24, 24, 22, 5);
      ctx.fill();

      // Belt & Brass Buckle
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox + 14, 38, 24, 4);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ox + 24, 38, 4, 4);

      // Archetype Lapel / Collar Trim
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(ox + 20, 24); ctx.lineTo(ox + 26, 32); ctx.lineTo(ox + 32, 24);
      ctx.fill();

      // 4. Head & Face
      // Neck
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(ox + 23, 20, 6, 5);

      // Head / Face
      ctx.fillStyle = '#fed7aa'; // stylized warm skin tone
      ctx.beginPath();
      ctx.roundRect(ox + 18, 10, 16, 14, 6);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(ox + 28, 15, 3, 3);

      // Hair / Hat / Cowl depending on Archetype
      ctx.fillStyle = accentColor;
      if (charKey === 'scout') {
        // Traveler Hood
        ctx.beginPath();
        ctx.arc(ox + 26, 14, 11, Math.PI, 0);
        ctx.lineTo(ox + 36, 24); ctx.lineTo(ox + 16, 24);
        ctx.closePath();
        ctx.fill();
      } else if (charKey === 'engineer') {
        // Industrial Cap with Headlamp
        ctx.fillRect(ox + 17, 8, 18, 6);
        ctx.fillRect(ox + 22, 6, 14, 4);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.arc(ox + 32, 11, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (charKey === 'medic') {
        // Physician Cap with Cross
        ctx.fillRect(ox + 17, 7, 18, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox + 24, 9, 5, 2); ctx.fillRect(ox + 25.5, 7.5, 2, 5);
      } else if (charKey === 'researcher') {
        // Scholar Hair & Data Monocle
        ctx.fillRect(ox + 17, 7, 18, 6);
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
        ctx.strokeRect(ox + 27, 14, 4, 4);
      } else if (charKey === 'botanist') {
        // Expedition Brimmed Hat
        ctx.fillRect(ox + 12, 11, 28, 3);
        ctx.fillRect(ox + 18, 5, 16, 7);
      } else if (charKey === 'mechanic') {
        // Bandana & Goggles
        ctx.fillRect(ox + 17, 8, 18, 5);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(ox + 22, 10, 6, 3); ctx.fillRect(ox + 29, 10, 6, 3);
      } else if (charKey === 'security') {
        // Constable Cap with Shield
        ctx.fillRect(ox + 16, 7, 20, 6);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(ox + 28, 9, 3, 3);
      } else {
        // Systems Technician Headset
        ctx.fillRect(ox + 17, 8, 18, 5);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(ox + 16, 12, 3, 7);
      }

      // 5. Front Arm Holding Glowing Brass Field Lantern
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.roundRect(ox + 32, 28 + armOffset, 8, 16, 4);
      ctx.fill();

      // Hand
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(ox + 34, 42 + armOffset, 5, 4);

      // Handheld Brass Field Lantern
      ctx.fillStyle = '#78350f'; // Dark brass frame
      ctx.fillRect(ox + 34, 45 + armOffset, 8, 12);
      ctx.fillStyle = '#fef08a'; // Glowing lantern glass
      ctx.fillRect(ox + 35, 47 + armOffset, 6, 7);
      ctx.fillStyle = '#ffffff'; // Core flare
      ctx.fillRect(ox + 37, 49 + armOffset, 2, 3);
    }

    const tex = this.textures.addCanvas(`spritesheet_${charKey}`, canvas);
    if (tex) {
      for (let i = 0; i < 4; i++) {
        tex.add(i, 0, i * frameW, 0, frameW, frameH);
        tex.add(i.toString(), 0, i * frameW, 0, frameW, frameH);
      }
    }

    // Create Phaser Walk Animation for this character
    if (!this.anims.exists(`walk_${charKey}`)) {
      this.anims.create({
        key: `walk_${charKey}`,
        frames: [
          { key: `spritesheet_${charKey}`, frame: '0' },
          { key: `spritesheet_${charKey}`, frame: '1' },
          { key: `spritesheet_${charKey}`, frame: '2' },
          { key: `spritesheet_${charKey}`, frame: '3' }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
  }

  private generateGhostTexture(key: string, baseColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 52;
    canvas.height = 68;
    const ctx = canvas.getContext('2d')!;

    ctx.globalAlpha = 0.72;
    ctx.fillStyle = baseColor;

    // Flowing spectral shroud
    ctx.beginPath();
    ctx.arc(26, 22, 16, Math.PI, 0, false);
    ctx.lineTo(44, 54);
    ctx.lineTo(36, 48);
    ctx.lineTo(28, 56);
    ctx.lineTo(20, 48);
    ctx.lineTo(12, 54);
    ctx.lineTo(8, 50);
    ctx.closePath();
    ctx.fill();

    // Luminescent Spectral Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(22, 22, 3, 0, Math.PI * 2);
    ctx.arc(30, 22, 3, 0, Math.PI * 2);
    ctx.fill();

    // Floating Spirit Aura
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this.textures.addCanvas(key, canvas);
  }

  private generateFallenBodyTexture(key: string, baseColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 68;
    canvas.height = 46;
    const ctx = canvas.getContext('2d')!;

    // Chalk / Distress Investigation Outline on cobblestone
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(34, 24, 30, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fallen Investigator Coat & Garb
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(14, 14, 40, 20, 8);
    ctx.fill();

    // Fallen Boots
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(8, 20, 8, 9);

    // Dropped Flickering Brass Lantern
    ctx.fillStyle = '#78350f';
    ctx.fillRect(52, 18, 10, 10);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(54, 20, 6, 6);

    // Broken glass shard reflection
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(53, 19); ctx.lineTo(61, 27);
    ctx.stroke();

    this.textures.addCanvas(key, canvas);
  }

  // Environment Tile Generators
  private generateCobbleTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0a0e18'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#162035'; ctx.lineWidth = 1;
    // Cobblestone Pavers
    ctx.strokeRect(2, 2, 28, 18);
    ctx.strokeRect(32, 2, 30, 18);
    ctx.strokeRect(2, 22, 18, 20);
    ctx.strokeRect(22, 22, 26, 20);
    ctx.strokeRect(50, 22, 12, 20);
    ctx.strokeRect(2, 44, 28, 18);
    ctx.strokeRect(32, 44, 30, 18);
    // Subtle Stone Texture Speckles
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(6, 6, 8, 4); ctx.fillRect(38, 10, 10, 5); ctx.fillRect(26, 30, 8, 4);
    this.textures.addCanvas('floor_cobble', canvas);
  }

  private generateLabTileTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'; ctx.fillRect(2, 2, 60, 60);
    this.textures.addCanvas('floor_lab', canvas);
  }

  private generateWoodPlankTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#292524'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 16); ctx.lineTo(64, 16);
    ctx.moveTo(0, 32); ctx.lineTo(64, 32);
    ctx.moveTo(0, 48); ctx.lineTo(64, 48);
    ctx.stroke();
    this.textures.addCanvas('floor_wood', canvas);
  }

  private generateSteelPlateTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0b0f19'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, 64, 64);
    // Industrial rivets
    ctx.fillStyle = '#475569';
    ctx.fillRect(4, 4, 3, 3); ctx.fillRect(57, 4, 3, 3);
    ctx.fillRect(4, 57, 3, 3); ctx.fillRect(57, 57, 3, 3);
    this.textures.addCanvas('floor_steel', canvas);
  }

  private generateGreenhouseSoilTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#06170d'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#064e3b'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'; ctx.fillRect(4, 4, 56, 56);
    this.textures.addCanvas('floor_soil', canvas);
  }

  // Detailed Environmental Prop Generators
  private generateBellTowerTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 90;
    const ctx = canvas.getContext('2d')!;
    // Stone Pedestal
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 60, 60, 25);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.strokeRect(10, 60, 60, 25);
    // Timber A-Frame Arch
    ctx.fillStyle = '#78350f';
    ctx.fillRect(14, 15, 8, 48);
    ctx.fillRect(58, 15, 8, 48);
    ctx.fillRect(10, 10, 60, 10);
    // Polished Brass Gathering Bell
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(34, 20); ctx.lineTo(46, 20);
    ctx.lineTo(52, 45); ctx.lineTo(28, 45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2; ctx.stroke();
    // Clapper rope
    ctx.strokeStyle = '#fef3c7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 45); ctx.lineTo(40, 65); ctx.stroke();
    this.textures.addCanvas('prop_bell_tower', canvas);
  }

  private generateTelescopeTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 90; canvas.height = 70;
    const ctx = canvas.getContext('2d')!;
    // Heavy brass tripod base
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.moveTo(45, 35); ctx.lineTo(25, 65); ctx.lineTo(65, 65); ctx.closePath(); ctx.fill();
    // Giant Refractor Optical Tube
    ctx.fillStyle = '#d97706';
    ctx.beginPath(); ctx.roundRect(15, 12, 60, 16, 4); ctx.fill();
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 2; ctx.stroke();
    // Glass Lens
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(75, 20, 8, 0, Math.PI * 2); ctx.fill();
    this.textures.addCanvas('prop_telescope', canvas);
  }

  private generateGeneratorTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 70;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(5, 10, 70, 50);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.strokeRect(5, 10, 70, 50);
    // Copper Induction Coils
    ctx.fillStyle = '#b45309';
    ctx.fillRect(15, 18, 12, 34); ctx.fillRect(34, 18, 12, 34); ctx.fillRect(53, 18, 12, 34);
    // Hazard Stripes
    ctx.fillStyle = '#eab308';
    ctx.fillRect(5, 52, 70, 6);
    this.textures.addCanvas('prop_generator', canvas);
  }

  private generateWorkstationTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 70; canvas.height = 50;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(5, 10, 60, 35);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.strokeRect(5, 10, 60, 35);
    // Monitor Screen
    ctx.fillStyle = '#0284c7'; ctx.fillRect(15, 15, 22, 14);
    // Chemical flask
    ctx.fillStyle = '#a855f7';
    ctx.beginPath(); ctx.arc(50, 24, 7, 0, Math.PI * 2); ctx.fill();
    this.textures.addCanvas('prop_workstation', canvas);
  }

  private generateMedBedTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 60; canvas.height = 75;
    const ctx = canvas.getContext('2d')!;
    // Steel clinical frame
    ctx.fillStyle = '#1e293b'; ctx.fillRect(5, 10, 50, 60);
    // Clean bed linen
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(8, 14, 44, 52);
    // Pillow
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(12, 16, 36, 12);
    // Medical Cross
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(26, 36, 8, 3); ctx.fillRect(28.5, 33.5, 3, 8);
    this.textures.addCanvas('prop_med_bed', canvas);
  }

  private generateRadioConsoleTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 70; canvas.height = 55;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(5, 10, 60, 40);
    // Oscilloscope Screen
    ctx.fillStyle = '#064e3b'; ctx.fillRect(12, 15, 26, 18);
    ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(14, 24); ctx.lineTo(20, 18); ctx.lineTo(26, 30); ctx.lineTo(34, 24); ctx.stroke();
    // Dial knobs
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(50, 22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(50, 34, 4, 0, Math.PI * 2); ctx.fill();
    this.textures.addCanvas('prop_radio_console', canvas);
  }

  private generateCratesTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 60; canvas.height = 50;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#78350f'; ctx.fillRect(5, 10, 50, 35);
    ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2; ctx.strokeRect(5, 10, 50, 35);
    // X-bracing
    ctx.beginPath();
    ctx.moveTo(5, 10); ctx.lineTo(55, 45);
    ctx.moveTo(55, 10); ctx.lineTo(5, 45);
    ctx.stroke();
    this.textures.addCanvas('prop_crates', canvas);
  }

  private generateStreetLanternTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 30; canvas.height = 60;
    const ctx = canvas.getContext('2d')!;
    // Iron post
    ctx.fillStyle = '#334155'; ctx.fillRect(13, 18, 4, 38);
    // Lantern housing
    ctx.fillStyle = '#1e293b'; ctx.fillRect(8, 8, 14, 14);
    // Glowing crystal core
    ctx.fillStyle = '#fef08a'; ctx.fillRect(10, 10, 10, 10);
    this.textures.addCanvas('prop_street_lantern', canvas);
  }

  private generateTaskIconTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 36; canvas.height = 36;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(18, 18, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    // Gear / Wrench glyph
    ctx.fillStyle = '#060911';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚙', 18, 18);
    this.textures.addCanvas('prop_task_icon', canvas);
  }

  // =========================================================================
  // 2. SETTLEMENT WORLD ARCHITECTURE
  // =========================================================================
  private buildSettlementWorld(): void {
    // 1. Background Cobblestone Base
    const bg = this.add.tileSprite(1200, 900, 2400, 1800, 'floor_cobble');
    bg.setDepth(0);

    this.wallLayer = this.physics.add.staticGroup();

    // 2. Perimeter Stone Bulkheads
    this.createStoneWall(1200, 20, 2400, 40);
    this.createStoneWall(1200, 1780, 2400, 40);
    this.createStoneWall(20, 900, 40, 1800);
    this.createStoneWall(2380, 900, 40, 1800);

    // 3. Build 10 Cohesive Settlement Zones
    this.buildCentralPlaza();
    this.buildLaboratory();
    this.buildPowerStation();
    this.buildObservatory();
    this.buildGreenhouse();
    this.buildCommunications();
    this.buildMedicalCenter();
    this.buildStorage();
    this.buildWorkshop();
    this.buildDormitories();

    // 4. Place Interactive Task Duty Terminals
    VILLAGE_TASKS.forEach((task) => {
      this.createTaskStation(task);
    });

    // 5. Street Lantern Posts along thoroughfares
    const lanternCoords = [
      { x: 950, y: 750 }, { x: 1450, y: 750 },
      { x: 950, y: 1150 }, { x: 1450, y: 1150 },
      { x: 750, y: 450 }, { x: 1650, y: 450 },
      { x: 750, y: 1450 }, { x: 1650, y: 1450 }
    ];
    lanternCoords.forEach(c => {
      this.add.sprite(c.x, c.y, 'prop_street_lantern').setDepth(12);
    });
  }

  private createStoneWall(x: number, y: number, width: number, height: number): void {
    const wall = this.add.rectangle(x, y, width, height, 0x0f172a);
    wall.setStrokeStyle(2, 0x334155);
    wall.setDepth(10);
    this.physics.add.existing(wall, true);
    this.wallLayer.add(wall);
  }

  private buildCentralPlaza(): void {
    // Rich Shaded Cobblestone Plaza Medallion
    const plazaMedallion = this.add.circle(1200, 950, 200, 0x131c2e, 0.85);
    plazaMedallion.setStrokeStyle(4, 0x22324f);
    plazaMedallion.setDepth(1);

    const innerStone = this.add.circle(1200, 950, 140, 0x0e1524, 0.7);
    innerStone.setStrokeStyle(1.5, 0x1e2b42);
    innerStone.setDepth(2);

    // Central Assembly Bell Tower
    const bellTower = this.add.sprite(1200, 930, 'prop_bell_tower');
    bellTower.setDepth(14);

    // Corner Street Lanterns around the Bell Plaza
    this.add.sprite(1130, 890, 'prop_street_lantern').setDepth(12);
    this.add.sprite(1270, 890, 'prop_street_lantern').setDepth(12);
    this.add.sprite(1130, 990, 'prop_street_lantern').setDepth(12);
    this.add.sprite(1270, 990, 'prop_street_lantern').setDepth(12);

    // Signage
    this.add.text(1200, 850, 'CENTRAL PLAZA // ASSEMBLY BELL', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#f59e0b'
    }).setOrigin(0.5).setDepth(14);

    // Physical collision obstacle for the bell pedestal so players don't clip through it
    this.createStoneWall(1200, 940, 50, 40);
  }

  private buildLaboratory(): void {
    this.addRoomFloor(500, 400, 400, 300, 'floor_lab', 'RESEARCH LABORATORY');
    this.createStoneWall(300, 400, 20, 300);
    this.createStoneWall(500, 250, 400, 20);
    this.createStoneWall(500, 550, 260, 20);
    this.createStoneWall(700, 350, 20, 160);

    // Workstation props
    this.add.sprite(440, 340, 'prop_workstation').setDepth(8);
    this.add.sprite(580, 340, 'prop_workstation').setDepth(8);
  }

  private buildPowerStation(): void {
    this.addRoomFloor(500, 1480, 420, 320, 'floor_steel', 'POWER STATION & GENERATORS');
    this.createStoneWall(290, 1480, 20, 320);
    this.createStoneWall(500, 1640, 420, 20);
    this.createStoneWall(500, 1320, 280, 20);
    this.createStoneWall(710, 1480, 20, 180);

    // Twin heavy generators
    this.add.sprite(460, 1460, 'prop_generator').setDepth(8);
    this.add.sprite(620, 1460, 'prop_generator').setDepth(8);
  }

  private buildObservatory(): void {
    this.addRoomFloor(1200, 320, 380, 240, 'floor_lab', 'ASTRONOMICAL OBSERVATORY');
    this.createStoneWall(1200, 200, 380, 20);
    this.createStoneWall(1010, 320, 20, 240);
    this.createStoneWall(1390, 320, 20, 240);
    this.createStoneWall(1200, 440, 240, 20);

    // Giant Telescope
    this.add.sprite(1200, 310, 'prop_telescope').setDepth(8);
  }

  private buildGreenhouse(): void {
    this.addRoomFloor(2000, 480, 400, 320, 'floor_soil', 'BOTANICAL GREENHOUSE');
    this.createStoneWall(2200, 480, 20, 320);
    this.createStoneWall(2000, 320, 400, 20);
    this.createStoneWall(2000, 640, 260, 20);
    this.createStoneWall(1800, 480, 20, 180);
  }

  private buildCommunications(): void {
    this.addRoomFloor(1950, 1480, 400, 320, 'floor_lab', 'COMMUNICATIONS TOWER');
    this.createStoneWall(2150, 1480, 20, 320);
    this.createStoneWall(1950, 1640, 400, 20);
    this.createStoneWall(1950, 1320, 260, 20);
    this.createStoneWall(1750, 1480, 20, 180);

    this.add.sprite(2000, 1440, 'prop_radio_console').setDepth(8);
  }

  private buildMedicalCenter(): void {
    this.addRoomFloor(850, 700, 280, 240, 'floor_lab', 'SETTLEMENT INFIRMARY');
    this.createStoneWall(710, 700, 20, 240);
    this.createStoneWall(850, 580, 280, 20);
    this.createStoneWall(850, 820, 160, 20);

    this.add.sprite(820, 690, 'prop_med_bed').setDepth(8);
    this.add.sprite(890, 690, 'prop_med_bed').setDepth(8);
  }

  private buildStorage(): void {
    this.addRoomFloor(1200, 1600, 380, 240, 'floor_wood', 'SETTLEMENT STORAGE');
    this.createStoneWall(1200, 1720, 380, 20);
    this.createStoneWall(1010, 1600, 20, 240);
    this.createStoneWall(1390, 1600, 20, 240);
    this.createStoneWall(1200, 1480, 220, 20);

    this.add.sprite(1160, 1590, 'prop_crates').setDepth(8);
    this.add.sprite(1240, 1590, 'prop_crates').setDepth(8);
  }

  private buildWorkshop(): void {
    this.addRoomFloor(1550, 700, 280, 240, 'floor_steel', 'MACHINIST WORKSHOP');
    this.createStoneWall(1690, 700, 20, 240);
    this.createStoneWall(1550, 580, 280, 20);
    this.createStoneWall(1550, 820, 160, 20);

    this.add.sprite(1550, 680, 'prop_workstation').setDepth(8);
  }

  private buildDormitories(): void {
    this.addRoomFloor(1200, 650, 320, 180, 'floor_wood', 'RESIDENT QUARTERS');
    this.createStoneWall(1040, 650, 20, 180);
    this.createStoneWall(1360, 650, 20, 180);
    this.createStoneWall(1200, 560, 320, 20);
  }

  private addRoomFloor(x: number, y: number, w: number, h: number, textureKey: string, title: string): void {
    const floor = this.add.tileSprite(x, y, w, h, textureKey);
    floor.setDepth(1);

    // Outer Room Glow / Border
    const border = this.add.rectangle(x, y, w, h);
    border.setStrokeStyle(1.5, 0x475569);
    border.setDepth(2);

    // Room Label
    this.add.text(x, y - (h / 2) + 16, title, {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#94a3b8'
    }).setOrigin(0.5).setDepth(3);
  }

  private createTaskStation(task: TaskDefinition): void {
    const container = this.add.container(task.x, task.y);
    container.setDepth(16);

    const pulseArc = this.add.circle(0, 0, 16, 0xf59e0b, 0.35);
    const sprite = this.add.sprite(0, 0, 'prop_task_icon');

    const label = this.add.text(0, -22, task.name, {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#fef3c7',
      backgroundColor: 'rgba(6, 9, 17, 0.85)',
      padding: { x: 5, y: 2 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: pulseArc,
      scale: 1.5,
      alpha: 0,
      duration: 1300,
      repeat: -1
    });

    container.add([pulseArc, sprite, label]);
    this.taskTerminals.set(task.id, { container, pulseArc, label });
  }

  // =========================================================================
  // 3. LOCAL PLAYER & INTERACTION PROMPT
  // =========================================================================
  private createLocalPlayerEntity(): void {
    const char = this.gameState?.myCharacter || 'engineer';
    const myP = this.gameState?.players.find(p => p.id === this.gameState?.myPlayerId);
    const startX = myP ? myP.x : 1200;
    const startY = myP ? myP.y : 950;

    // Local Player Physics Sprite
    this.localPlayerSprite = this.physics.add.sprite(startX, startY, `spritesheet_${char}`, 0);
    this.localPlayerSprite.setDepth(60);
    this.localPlayerSprite.setCollideWorldBounds(true);
    this.localPlayerSprite.body!.setSize(26, 22);
    this.localPlayerSprite.body!.setOffset(13, 44);

    this.physics.add.collider(this.localPlayerSprite, this.wallLayer);

    // Warm Handheld Lantern Light on Ground
    this.localPlayerLanternGlow = this.add.circle(startX, startY, 40, 0xfef08a, 0.15);
    this.localPlayerLanternGlow.setDepth(4);

    // Shadow
    this.localPlayerShadow = this.add.ellipse(startX, startY + 28, 28, 10, 0x000000, 0.4);
    this.localPlayerShadow.setDepth(5);

    // Name Label
    this.localPlayerNameText = this.add.text(startX, startY - 38, myP?.name || 'Resident', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: 'rgba(6, 9, 17, 0.85)',
      padding: { x: 6, y: 2 }
    }).setOrigin(0.5).setDepth(65);
  }

  private createFloatingPrompt(): void {
    this.promptContainer = this.add.container(0, 0);
    this.promptContainer.setDepth(200);
    this.promptContainer.setVisible(false);

    this.promptText = this.add.text(0, 0, '', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#060911',
      backgroundColor: '#f59e0b',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    this.promptContainer.add(this.promptText);
  }

  // =========================================================================
  // 4. MAIN GAME LOOP (MOVEMENT & PROXIMITIES)
  // =========================================================================
  override update(time: number, _delta: number): void {
    if (!this.localPlayerSprite || !this.localPlayerSprite.active) return;

    const isAlive = this.gameState?.players.find(p => p.id === this.gameState?.myPlayerId)?.isAlive ?? true;
    const speed = isAlive ? (this.gameState?.settings?.speed || 220) : 320;

    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) vx -= speed;
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) vx += speed;
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) vy -= speed;
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) vy += speed;

    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    this.localPlayerSprite.setVelocity(vx, vy);

    const isMoving = vx !== 0 || vy !== 0;
    const char = this.gameState?.myCharacter || 'engineer';

    if (vx < 0) {
      this.currentFacing = 'left';
      this.localPlayerSprite.setFlipX(true);
    } else if (vx > 0) {
      this.currentFacing = 'right';
      this.localPlayerSprite.setFlipX(false);
    }

    if (isMoving && isAlive) {
      if (!this.localPlayerSprite.anims.isPlaying) {
        this.localPlayerSprite.play(`walk_${char}`, true);
      }
      this.walkStep += 0.25;
      this.localPlayerSprite.y += Math.sin(this.walkStep) * 0.4;
    } else {
      this.localPlayerSprite.stop();
      this.localPlayerSprite.setFrame(0);
      this.idleBreath += 0.04;
      this.localPlayerSprite.setScale(1, 1 + Math.sin(this.idleBreath) * 0.02);
    }

    // Ghosts float through walls
    if (!isAlive) {
      this.localPlayerSprite.body!.checkCollision.none = true;
    } else {
      this.localPlayerSprite.body!.checkCollision.none = false;
    }

    // Sync shadow, name, and lantern glow positions
    const px = this.localPlayerSprite.x;
    const py = this.localPlayerSprite.y;
    this.localPlayerShadow.setPosition(px, py + 28);
    this.localPlayerNameText.setPosition(px, py - 38);
    this.localPlayerLanternGlow.setPosition(px, py + 8);

    // Send 20Hz Movement updates over WebRTC
    if (time - this.lastSentTime > 50) {
      this.lastSentTime = time;
      if (this.onMoveCallback) {
        this.onMoveCallback(px, py, vx, vy, this.currentFacing, isMoving);
      }
    }

    this.checkProximities();
    this.renderAtmosphericLighting();
  }

  private checkProximities(): void {
    if (!this.localPlayerSprite || !this.gameState) return;
    const px = this.localPlayerSprite.x;
    const py = this.localPlayerSprite.y;
    const isMimic = this.gameState?.myRole === 'impostor';
    const isAlive = this.gameState.players.find(p => p.id === this.gameState?.myPlayerId)?.isAlive ?? true;

    // 1. Task Duty Proximity
    let nearTask: TaskDefinition | null = null;
    const myTasks = this.gameState.myTasks || [];
    for (const t of VILLAGE_TASKS) {
      const isAssigned = myTasks.some(pt => pt.taskId === t.id && !pt.completed);
      if (isAssigned) {
        const dist = Math.hypot(px - t.x, py - t.y);
        if (dist < 85) {
          nearTask = t;
          break;
        }
      }
    }

    // 2. Fallen Resident (Dead Body) Proximity
    let nearBody: DeadBody | null = null;
    if (isAlive) {
      for (const b of this.gameState.deadBodies || []) {
        const dist = Math.hypot(px - b.x, py - b.y);
        if (dist < 120) {
          nearBody = b;
          break;
        }
      }
    }

    // 3. Central Gathering Bell Proximity
    const distBell = Math.hypot(px - 1200, py - 950);
    const nearEmergency = isAlive && distBell < 120;

    // 4. Mimic Strike Proximity
    let nearKillTarget: SafePlayer | null = null;
    if (isMimic && isAlive && this.gameState.killCooldown <= 0) {
      const livingResidents = this.gameState.players.filter(
        p => p.isAlive && p.id !== this.gameState?.myPlayerId && p.role !== 'impostor'
      );
      for (const res of livingResidents) {
        const dist = Math.hypot(px - res.x, py - res.y);
        if (dist < 100) {
          nearKillTarget = res;
          break;
        }
      }
    }

    // Update Floating Prompt Badge above the interactive entity
    if (nearBody) {
      this.promptContainer.setPosition(nearBody.x, nearBody.y - 30);
      this.promptText.setText('[R] REPORT FALLEN RESIDENT');
      this.promptText.setBackgroundColor('#ef4444');
      this.promptText.setColor('#ffffff');
      this.promptContainer.setVisible(true);
    } else if (nearEmergency) {
      this.promptContainer.setPosition(1200, 890);
      this.promptText.setText('[E] RING GATHERING BELL');
      this.promptText.setBackgroundColor('#f59e0b');
      this.promptText.setColor('#060911');
      this.promptContainer.setVisible(true);
    } else if (nearTask) {
      this.promptContainer.setPosition(nearTask.x, nearTask.y - 36);
      this.promptText.setText(`[E] EXAMINE: ${nearTask.name.toUpperCase()}`);
      this.promptText.setBackgroundColor('#f59e0b');
      this.promptText.setColor('#060911');
      this.promptContainer.setVisible(true);
    } else if (nearKillTarget) {
      this.promptContainer.setPosition(nearKillTarget.x, nearKillTarget.y - 45);
      this.promptText.setText(`[Q] MIMIC STRIKE (${nearKillTarget.name})`);
      this.promptText.setBackgroundColor('#dc2626');
      this.promptText.setColor('#ffffff');
      this.promptContainer.setVisible(true);
    } else {
      this.promptContainer.setVisible(false);
    }

    if (this.onProximityCallback) {
      this.onProximityCallback({ nearTask, nearBody, nearEmergency, nearKillTarget });
    }
  }

  private renderAtmosphericLighting(): void {
    this.visionMask.clear();
    const isLightsOut = this.gameState?.sabotage.active && this.gameState.sabotage.type === 'lights';
    const isDead = !(this.gameState?.players.find(p => p.id === this.gameState?.myPlayerId)?.isAlive ?? true);
    const isMimic = this.gameState?.myRole === 'impostor';

    // Sabotage darkness: if blackout active and player is living resident
    if (isLightsOut && !isMimic && !isDead) {
      const px = this.localPlayerSprite.x;
      const py = this.localPlayerSprite.y;

      this.visionMask.fillStyle(0x060911, 0.96);
      this.visionMask.fillRect(0, 0, 2400, 1800);

      // Warm handheld lantern pool of view
      this.visionMask.fillStyle(0x080e1a, 0.15);
      this.visionMask.fillCircle(px, py, 130);
    }
  }

  // =========================================================================
  // 5. REMOTE ENTITIES & DEAD BODIES SYNC
  // =========================================================================
  public syncGameState(state: PlayerGameState): void {
    this.gameState = state;

    const existingIds = new Set(this.playerEntities.keys());
    const meId = state.myPlayerId;
    const viewerIsMimic = state.myRole === 'impostor';

    state.players.forEach((p) => {
      if (p.id === meId) {
        if (this.localPlayerSprite && !p.isAlive) {
          this.localPlayerSprite.setTexture(`ghost_${p.character}`);
          this.localPlayerSprite.setAlpha(0.72);
        }
        return;
      }

      existingIds.delete(p.id);

      let peerObj = this.playerEntities.get(p.id);
      if (!peerObj) {
        const texKey = p.isAlive ? `spritesheet_${p.character}` : `ghost_${p.character}`;
        const sprite = this.add.sprite(0, 0, texKey, 0);
        if (!p.isAlive) sprite.setAlpha(0.72);

        const shadow = this.add.ellipse(0, 28, 28, 10, 0x000000, 0.4);
        const lanternGlow = this.add.circle(0, 8, 35, 0xfef08a, 0.12);

        const isFellowMimic = viewerIsMimic && state.fellowImpostors?.includes(p.id);
        const nameText = this.add.text(0, -38, p.name, {
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: isFellowMimic ? '#ef4444' : '#f8fafc',
          backgroundColor: 'rgba(6, 9, 17, 0.85)',
          padding: { x: 5, y: 2 }
        }).setOrigin(0.5);

        const container = this.add.container(p.x, p.y, [lanternGlow, shadow, sprite, nameText]);
        container.setDepth(50);

        peerObj = { container, sprite, nameText, shadow, lanternGlow, walkTimer: 0, lastX: p.x, lastY: p.y };
        this.playerEntities.set(p.id, peerObj);
      } else {
        // Move towards new position with smooth interpolation
        const isPeerMoving = Math.hypot(p.x - peerObj.lastX, p.y - peerObj.lastY) > 2;
        peerObj.lastX = p.x;
        peerObj.lastY = p.y;

        this.tweens.add({
          targets: peerObj.container,
          x: p.x,
          y: p.y,
          duration: 55,
          ease: 'Linear'
        });

        if (isPeerMoving && p.isAlive) {
          if (!peerObj.sprite.anims.isPlaying) {
            peerObj.sprite.play(`walk_${p.character}`, true);
          }
        } else {
          peerObj.sprite.stop();
          peerObj.sprite.setFrame(0);
        }

        if (!p.isAlive && !peerObj.sprite.texture.key.startsWith('ghost_')) {
          peerObj.sprite.setTexture(`ghost_${p.character}`);
          peerObj.sprite.setAlpha(0.72);
        }
      }
    });

    existingIds.forEach((id) => {
      const obj = this.playerEntities.get(id);
      if (obj) {
        obj.container.destroy();
        this.playerEntities.delete(id);
      }
    });

    // Sync Dead Bodies
    const currentBodyIds = new Set(this.bodySprites.keys());
    (state.deadBodies || []).forEach((body) => {
      currentBodyIds.delete(body.id);
      if (!this.bodySprites.has(body.id)) {
        const bodyContainer = this.add.container(body.x, body.y);
        bodyContainer.setDepth(25);

        const bSprite = this.add.sprite(0, 0, `dead_${body.character}`);
        const bLabel = this.add.text(0, -26, `FALLEN: ${body.playerName}`, {
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#f87171',
          backgroundColor: 'rgba(6, 9, 17, 0.85)',
          padding: { x: 5, y: 2 }
        }).setOrigin(0.5);

        bodyContainer.add([bSprite, bLabel]);
        this.bodySprites.set(body.id, bodyContainer);
      }
    });

    currentBodyIds.forEach((id) => {
      const b = this.bodySprites.get(id);
      if (b) {
        b.destroy();
        this.bodySprites.delete(id);
      }
    });

    // Task Terminals Visual State
    const myTasks = state.myTasks || [];
    VILLAGE_TASKS.forEach((t) => {
      const marker = this.taskTerminals.get(t.id);
      if (marker) {
        const taskInfo = myTasks.find(pt => pt.taskId === t.id);
        if (!taskInfo || taskInfo.completed) {
          marker.container.setAlpha(0.25);
          marker.label.setVisible(false);
        } else {
          marker.container.setAlpha(1);
          marker.label.setVisible(true);
        }
      }
    });
  }
}
