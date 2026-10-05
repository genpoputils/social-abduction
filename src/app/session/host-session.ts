import { GameSession } from './game-session';
import { MidnightVillageGame } from '../engine/midnight-village-game';
import { WebRTCManager } from '../network/webrtc-manager';
import { LocalSignalingChannel, ConnectionOffer, ConnectionAnswer, encodeSignal, decodeSignal } from '../network/signaling';
import { PeerToHostMessage, HostToPeerMessage } from '../network/protocol';
import { Player, ChatMessage, CharacterType, SabotageType, GameSettings } from '../engine/types';
import { CHARACTER_ARCHETYPES, CHARACTER_LIST, VILLAGE_TASKS } from '../engine/roles';
import { generateAnonymousName } from '../engine/names';

export class HostSession extends GameSession {
  public isHost = true;
  public game: MidnightVillageGame;
  public webrtc: WebRTCManager;
  private localSignaling: LocalSignalingChannel;
  private tickInterval: number | null = null;
  private syncPositionsInterval: number | null = null;
  private pendingOffers: Map<string, ConnectionOffer> = new Map();
  public simulatedPlayerIds: Set<string> = new Set();
  private botObjectives: Map<string, { targetX: number; targetY: number; targetTaskId?: string; ticksWorking: number }> = new Map();

  constructor(
    public roomId: string,
    public playerId: string,
    public hostName: string,
    public hostCharacter: CharacterType = 'engineer',
    settings?: Partial<GameSettings>
  ) {
    super();

    this.game = new MidnightVillageGame({
      id: roomId,
      settings
    });

    const hostColor = CHARACTER_ARCHETYPES[hostCharacter]?.color || '#f59e0b';
    const hostPlayer: Player = {
      id: playerId,
      name: hostName,
      isHost: true,
      isAlive: true,
      connected: true,
      character: hostCharacter,
      color: hostColor,
      x: 1200,
      y: 950,
      tasks: [],
      killCooldownRemaining: 0,
      emergencyMeetingsRemaining: 1
    };
    this.game.addPlayer(hostPlayer);

    this.webrtc = new WebRTCManager();
    this.localSignaling = new LocalSignalingChannel(roomId);

    this.setupSignaling();
    this.setupWebRTC();
    this.startAuthoritativeLoop();

    this.broadcastState();
  }

  private setupSignaling(): void {
    this.localSignaling.onSignal(async (signal) => {
      if (signal.type === 'answer') {
        try {
          await this.handleAnswer(signal);
        } catch (err) {
          console.warn('[HostSession] Local answer handle failed:', err);
        }
      }
    });
  }

  private setupWebRTC(): void {
    this.webrtc.onMessage((peerId, data) => {
      this.handlePeerMessage(peerId, data as PeerToHostMessage);
    });

    this.webrtc.onConnectionStateChange((peerId, state) => {
      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        this.game.removePlayer(peerId);
        this.broadcastState();
      }
    });
  }

  private startAuthoritativeLoop(): void {
    // 1-second game rules tick
    this.tickInterval = window.setInterval(() => {
      this.handleSimulatedPlayerActions();
      const { phaseChanged } = this.game.tick(1);

      if (phaseChanged || this.game.phase !== 'lobby') {
        this.broadcastState();
      }
    }, 1000);

    // 20Hz position sync broadcast for smooth 2D movement
    this.syncPositionsInterval = window.setInterval(() => {
      if (this.game.phase === 'roaming') {
        this.broadcastPositions();
      }
    }, 50);
  }

  public async createInvitation(): Promise<{ inviteCode: string; slotId: string }> {
    const slotId = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const offer = await this.webrtc.createHostOffer(slotId, this.roomId);
    this.pendingOffers.set(slotId, offer);

    this.localSignaling.broadcast(offer);
    const inviteCode = encodeSignal(offer);
    return { inviteCode, slotId };
  }

  public async handleAnswer(answer: ConnectionAnswer): Promise<void> {
    await this.webrtc.handleHostAnswer(answer.peerId, answer);
    this.pendingOffers.delete(answer.peerId);
  }

  public async handleEncodedAnswer(encodedAnswer: string): Promise<boolean> {
    const decoded = decodeSignal(encodedAnswer);
    if (decoded && decoded.type === 'answer') {
      await this.handleAnswer(decoded);
      return true;
    }
    return false;
  }

  public addSimulatedPlayer(name?: string, character?: CharacterType): boolean {
    if (this.game.players.size >= this.game.settings.maxPlayers || this.game.phase !== 'lobby') {
      return false;
    }

    const id = `bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const botName = name || generateAnonymousName();

    const usedChars = new Set(Array.from(this.game.players.values()).map(p => p.character));
    const availableChars = CHARACTER_LIST.filter(c => !usedChars.has(c.id));
    const chosenArchetype = character
      ? CHARACTER_ARCHETYPES[character]
      : (availableChars[0] || CHARACTER_LIST[Math.floor(Math.random() * CHARACTER_LIST.length)]);

    const player: Player = {
      id,
      name: botName,
      isHost: false,
      isAlive: true,
      connected: true,
      character: chosenArchetype.id,
      color: chosenArchetype.color,
      x: 1200 + Math.cos((this.game.players.size / 8) * Math.PI * 2) * 210,
      y: 950 + Math.sin((this.game.players.size / 8) * Math.PI * 2) * 210,
      tasks: [],
      killCooldownRemaining: this.game.settings.killCooldownSeconds,
      emergencyMeetingsRemaining: 1
    };

    const res = this.game.addPlayer(player);
    if (res.success) {
      this.simulatedPlayerIds.add(id);
      this.broadcastState();
      return true;
    }
    return false;
  }

  public fillWithTestPlayers(targetCount: number = 5): void {
    while (this.game.players.size < targetCount && this.game.players.size < this.game.settings.maxPlayers) {
      this.addSimulatedPlayer();
    }
  }

  private handleSimulatedPlayerActions(): void {
    if (this.simulatedPlayerIds.size === 0) return;

    if (this.game.phase === 'roaming') {
      const livingBots = Array.from(this.simulatedPlayerIds)
        .map(id => this.game.players.get(id))
        .filter((p): p is Player => !!p && p.isAlive);

      for (const bot of livingBots) {
        // 1. Check if near any dead body -> report it!
        for (const body of this.game.deadBodies) {
          const dist = Math.hypot(bot.x - body.x, bot.y - body.y);
          if (dist < 140) {
            this.game.reportBody(bot.id, body.id);
            this.broadcastState();
            return;
          }
        }

        // 2. Resident Task Navigation & Execution
        if (bot.role === 'villager') {
          let objective = this.botObjectives.get(bot.id);
          const uncompleted = bot.tasks.filter(t => !t.completed);

          // If no active task or task was finished, pick next uncompleted task
          if (!objective || !objective.targetTaskId || !uncompleted.some(t => t.taskId === objective?.targetTaskId)) {
            if (uncompleted.length > 0) {
              const nextTask = uncompleted[Math.floor(Math.random() * uncompleted.length)];
              const def = VILLAGE_TASKS.find(t => t.id === nextTask.taskId);
              if (def) {
                objective = {
                  targetX: def.x + (Math.random() * 30 - 15),
                  targetY: def.y + (Math.random() * 30 - 15),
                  targetTaskId: def.id,
                  ticksWorking: 0
                };
                this.botObjectives.set(bot.id, objective);
              }
            } else {
              // All tasks done! Patrol between rooms
              const randomTask = VILLAGE_TASKS[Math.floor(Math.random() * VILLAGE_TASKS.length)];
              objective = {
                targetX: randomTask.x,
                targetY: randomTask.y,
                ticksWorking: 0
              };
              this.botObjectives.set(bot.id, objective);
            }
          }

          if (objective) {
            const dist = Math.hypot(bot.x - objective.targetX, bot.y - objective.targetY);
            if (dist > 50) {
              // Walk towards target task station at realistic speed
              const angle = Math.atan2(objective.targetY - bot.y, objective.targetX - bot.x);
              const step = 32;
              bot.x = Math.max(100, Math.min(2300, bot.x + Math.cos(angle) * step));
              bot.y = Math.max(100, Math.min(1700, bot.y + Math.sin(angle) * step));
            } else if (objective.targetTaskId) {
              // Bot has arrived at the task station! Work on the task for multiple seconds
              objective.ticksWorking++;
              if (objective.ticksWorking >= 6) {
                // Complete task after ~3 seconds standing at the station
                this.game.completeTask(bot.id, objective.targetTaskId);
                this.botObjectives.delete(bot.id);
                this.broadcastState();
              }
            }
          }
        } else if (bot.role === 'impostor') {
          // Mimic AI: Stalk residents or patrol corridors
          if (bot.killCooldownRemaining <= 0) {
            const livingVillagers = Array.from(this.game.players.values())
              .filter(p => p.isAlive && p.role === 'villager');

            let closestTarget: Player | null = null;
            let closestDist = 99999;
            for (const v of livingVillagers) {
              const d = Math.hypot(bot.x - v.x, bot.y - v.y);
              if (d < closestDist) {
                closestDist = d;
                closestTarget = v;
              }
            }

            if (closestTarget && closestDist < 100) {
              // Strike!
              this.game.killPlayer(bot.id, closestTarget.id);
              this.broadcastState();
              continue;
            } else if (closestTarget && closestDist < 400) {
              // Stalk towards closest target
              const angle = Math.atan2(closestTarget.y - bot.y, closestTarget.x - bot.x);
              bot.x = Math.max(100, Math.min(2300, bot.x + Math.cos(angle) * 30));
              bot.y = Math.max(100, Math.min(1700, bot.y + Math.sin(angle) * 30));
              continue;
            }
          }

          // Wander corridors
          const dx = (Math.random() - 0.5) * 50;
          const dy = (Math.random() - 0.5) * 50;
          bot.x = Math.max(100, Math.min(2300, bot.x + dx));
          bot.y = Math.max(100, Math.min(1700, bot.y + dy));
        }
      }
    } else if (this.game.phase === 'voting') {
      const livingBots = Array.from(this.simulatedPlayerIds)
        .map(id => this.game.players.get(id))
        .filter((p): p is Player => !!p && p.isAlive);

      const livingPlayers = Array.from(this.game.players.values()).filter(p => p.isAlive);

      for (const bot of livingBots) {
        if (!this.game.votes.has(bot.id)) {
          // Realistic voting: 75% vote for a candidate, 25% skip
          if (Math.random() > 0.25 && livingPlayers.length > 1) {
            const eligible = livingPlayers.filter(p => p.id !== bot.id);
            const target = eligible[Math.floor(Math.random() * eligible.length)];
            this.game.castVote(bot.id, target ? target.id : null);
          } else {
            this.game.castVote(bot.id, null);
          }
        }
      }
    }
  }

  private handlePeerMessage(peerId: string, message: PeerToHostMessage): void {
    switch (message.type) {
      case 'PLAYER_JOIN': {
        const { name, character, color } = message.payload;
        const playerColor = color || (character ? CHARACTER_ARCHETYPES[character]?.color : '#3b82f6') || '#3b82f6';

        const player: Player = {
          id: peerId,
          name: name.slice(0, 24),
          isHost: false,
          isAlive: true,
          connected: true,
          character: character || 'researcher',
          color: playerColor,
          x: 1200 + (Math.random() * 160 - 80),
          y: 950 + (Math.random() * 160 - 80),
          tasks: [],
          killCooldownRemaining: this.game.settings.killCooldownSeconds,
          emergencyMeetingsRemaining: 1
        };

        const result = this.game.addPlayer(player);
        if (result.success) {
          this.sendToPeer(peerId, {
            type: 'ROOM_JOINED',
            payload: { roomId: this.roomId, playerId: peerId, isHost: false }
          });
          this.broadcastState();

          // Prepare next invitation for subsequent players
          this.createInvitation().then(({ inviteCode }) => {
            try {
              localStorage.setItem(`mv_offer_${this.roomId}`, inviteCode);
            } catch {
              // ignore
            }
          });
        } else {
          this.sendToPeer(peerId, {
            type: 'GAME_ERROR',
            payload: { message: result.error || 'Unable to join village' }
          });
        }
        break;
      }

      case 'PLAYER_MOVE': {
        const { x, y, vx, vy, facing, isMoving } = message.payload;
        this.game.updatePlayerPosition(peerId, x, y, vx, vy, facing, isMoving);
        break;
      }

      case 'TASK_COMPLETED': {
        this.game.completeTask(peerId, message.payload.taskId);
        this.broadcastState();
        break;
      }

      case 'KILL_PLAYER': {
        this.game.killPlayer(peerId, message.payload.targetId);
        this.broadcastState();
        break;
      }

      case 'REPORT_BODY': {
        this.game.reportBody(peerId, message.payload.bodyId);
        this.broadcastState();
        break;
      }

      case 'CALL_EMERGENCY': {
        this.game.callEmergencyMeeting(peerId);
        this.broadcastState();
        break;
      }

      case 'CAST_VOTE': {
        this.game.castVote(peerId, message.payload.targetId);
        this.broadcastState();
        break;
      }

      case 'TRIGGER_SABOTAGE': {
        this.game.triggerSabotage(message.payload.type);
        this.broadcastState();
        break;
      }

      case 'FIX_SABOTAGE': {
        this.game.fixSabotage();
        this.broadcastState();
        break;
      }

      case 'CHAT_MESSAGE': {
        this.handleChat(peerId, message.payload.text);
        break;
      }

      default:
        break;
    }
  }

  public handleChat(senderId: string, text: string): void {
    const sender = this.game.players.get(senderId);
    if (!sender) return;

    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 300) return;

    const chatMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: sender.id,
      senderName: sender.name,
      text: trimmed,
      timestamp: Date.now(),
      isDeadSender: !sender.isAlive
    };

    const current = this.chatSubject.getValue();
    this.chatSubject.next([...current, chatMsg]);

    // Broadcast to peers
    for (const player of this.game.players.values()) {
      if (player.id === this.playerId) continue;

      // Dead players' chats can be seen by everyone if during meeting, or filtered
      this.sendToPeer(player.id, {
        type: 'CHAT_BROADCAST',
        payload: { message: chatMsg }
      });
    }
  }

  public broadcastPositions(): void {
    const positions = Array.from(this.game.players.values()).map(p => ({
      playerId: p.id,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      facing: 'left' as const,
      isMoving: false
    }));

    for (const player of this.game.players.values()) {
      if (player.id === this.playerId) continue;
      this.sendToPeer(player.id, {
        type: 'POSITIONS_SYNC',
        payload: { positions }
      });
    }
  }

  public broadcastState(): void {
    const hostState = this.game.getPlayerState(this.playerId);
    this.stateSubject.next(hostState);

    for (const player of this.game.players.values()) {
      if (player.id === this.playerId) continue;
      const peerState = this.game.getPlayerState(player.id);
      this.sendToPeer(player.id, {
        type: 'GAME_STATE',
        payload: { state: peerState }
      });
    }
  }

  private sendToPeer(peerId: string, message: HostToPeerMessage): void {
    this.webrtc.send(peerId, message);
  }

  public override sendMove(x: number, y: number, vx: number, vy: number, facing: 'left' | 'right', isMoving: boolean): void {
    this.game.updatePlayerPosition(this.playerId, x, y, vx, vy, facing, isMoving);
  }

  public override sendCompleteTask(taskId: string): void {
    this.game.completeTask(this.playerId, taskId);
    this.broadcastState();
  }

  public override sendKill(targetId: string): void {
    this.game.killPlayer(this.playerId, targetId);
    this.broadcastState();
  }

  public override sendReportBody(bodyId: string): void {
    this.game.reportBody(this.playerId, bodyId);
    this.broadcastState();
  }

  public override sendCallEmergency(): void {
    this.game.callEmergencyMeeting(this.playerId);
    this.broadcastState();
  }

  public override sendVote(targetId: string | null): void {
    this.game.castVote(this.playerId, targetId);
    this.broadcastState();
  }

  public override sendTriggerSabotage(type: SabotageType): void {
    this.game.triggerSabotage(type);
    this.broadcastState();
  }

  public override sendFixSabotage(): void {
    this.game.fixSabotage();
    this.broadcastState();
  }

  public override sendChat(text: string): void {
    this.handleChat(this.playerId, text);
  }

  public override startGame(): void {
    const res = this.game.start();
    if (res.success) {
      this.broadcastState();
    }
  }

  public override rematch(): void {
    this.game.rematch();
    this.broadcastState();
  }

  public override disconnect(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.syncPositionsInterval !== null) {
      clearInterval(this.syncPositionsInterval);
      this.syncPositionsInterval = null;
    }
    this.localSignaling.close();
    this.webrtc.disconnect();
    this.stateSubject.next(null);
  }
}
