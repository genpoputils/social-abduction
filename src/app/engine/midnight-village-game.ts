import {
  CharacterType,
  DeadBody,
  EjectionResult,
  GameEvent,
  GamePhase,
  GameSettings,
  GameStats,
  MeetingInfo,
  Player,
  PlayerGameState,
  PlayerTask,
  Role,
  SabotageState,
  SabotageType,
  SafePlayer,
  Team
} from './types';
import {
  calculateRoleDistribution,
  CHARACTER_ARCHETYPES,
  DEFAULT_MIDNIGHT_SETTINGS,
  VILLAGE_TASKS
} from './roles';

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface MidnightVillageOptions {
  id: string;
  settings?: Partial<GameSettings>;
}

export class MidnightVillageGame {
  public readonly id: string;
  public settings: GameSettings;
  public phase: GamePhase = 'lobby';
  public phaseRemainingSeconds: number = 0;
  public phaseDurationSeconds: number = 0;
  public roundNumber: number = 0;

  public players: Map<string, Player> = new Map();
  public deadBodies: DeadBody[] = [];
  public meetingInfo: MeetingInfo | null = null;
  public ejectionResult: EjectionResult | null = null;
  public votes: Map<string, string | null> = new Map();

  public sabotage: SabotageState = {
    active: false,
    type: null,
    remainingSeconds: 0
  };

  public winner: Team | null = null;
  public winnerReason: string = '';
  public startTime: number = 0;
  public initialRoles: Record<string, Role> = {};
  public eliminationHistory: Array<{
    playerId: string;
    playerName: string;
    role: Role;
    phase: GamePhase;
    reason: string;
  }> = [];

  public recentEvents: GameEvent[] = [];

  constructor(options: MidnightVillageOptions) {
    this.id = options.id;
    this.settings = {
      ...DEFAULT_MIDNIGHT_SETTINGS,
      ...(options.settings || {})
    };
  }

  public addPlayer(player: Player): { success: boolean; error?: string } {
    if (this.phase !== 'lobby') {
      return { success: false, error: 'Game in progress' };
    }
    if (this.players.size >= this.settings.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }
    if (this.players.has(player.id)) {
      return { success: false, error: 'Player already in room' };
    }

    // Default spawn coordinates in Central Square
    player.x = 1200 + (Math.random() * 160 - 80);
    player.y = 950 + (Math.random() * 160 - 80);
    player.isAlive = true;
    player.connected = true;
    player.tasks = [];
    player.killCooldownRemaining = this.settings.killCooldownSeconds;
    player.emergencyMeetingsRemaining = 1;

    this.players.set(player.id, player);
    this.addEvent(`${player.name} entered the settlement chamber.`, 'system');
    return { success: true };
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.connected = false;
    this.addEvent(`${player.name} lost connection.`, 'system');

    if (this.phase === 'lobby') {
      this.players.delete(playerId);
    } else {
      if (player.isAlive) {
        player.isAlive = false;
        player.eliminatedAt = {
          phase: this.phase,
          roundNumber: this.roundNumber,
          reason: 'disconnected'
        };
        this.checkWinConditions();
      }
    }
  }

  public updatePlayerCustomization(playerId: string, name?: string, character?: CharacterType, color?: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    if (name && name.trim()) p.name = name.trim().slice(0, 24);
    if (character && CHARACTER_ARCHETYPES[character]) {
      p.character = character;
      p.color = CHARACTER_ARCHETYPES[character].color;
    }
    if (color) p.color = color;
  }

  public start(): { success: boolean; error?: string } {
    if (this.phase !== 'lobby') {
      return { success: false, error: 'Game is already running' };
    }
    if (this.players.size < this.settings.minPlayers) {
      return {
        success: false,
        error: `At least ${this.settings.minPlayers} players are required to start (currently ${this.players.size})`
      };
    }

    const playerList = Array.from(this.players.values());
    const roleList = shuffleArray(calculateRoleDistribution(playerList.length, this.settings.impostorCount));

    // Reset tasks and assign roles
    this.deadBodies = [];
    this.votes.clear();
    this.meetingInfo = null;
    this.ejectionResult = null;
    this.sabotage = { active: false, type: null, remainingSeconds: 0 };
    this.winner = null;
    this.winnerReason = '';
    this.eliminationHistory = [];
    this.roundNumber = 1;
    this.startTime = Date.now();

    playerList.forEach((player, idx) => {
      const assignedRole = roleList[idx];
      player.role = assignedRole;
      player.isAlive = true;
      player.connected = true;
      player.killCooldownRemaining = this.settings.killCooldownSeconds;
      player.emergencyMeetingsRemaining = 1;
      this.initialRoles[player.id] = assignedRole;

      // Reset position to Central Square spawn circle
      const angle = (idx / playerList.length) * Math.PI * 2;
      player.x = 1200 + Math.cos(angle) * 210;
      player.y = 950 + Math.sin(angle) * 210;

      // Assign tasks to villagers (and fake tasks list to impostors so HUD matches)
      const shuffledTasks = shuffleArray(VILLAGE_TASKS).slice(0, this.settings.tasksPerPlayer);
      player.tasks = shuffledTasks.map(t => ({
        taskId: t.id,
        name: t.name,
        room: t.room,
        type: t.type,
        completed: false
      }));
    });

    this.transitionTo('starting', 5);
    this.addEvent('Midnight approaches. The secret roles have been bestowed.', 'system', 'mysterious');
    return { success: true };
  }

  public updatePlayerPosition(
    playerId: string,
    x: number,
    y: number,
    _vx: number,
    _vy: number,
    _facing: 'left' | 'right',
    _isMoving: boolean
  ): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Boundary clamping (2400 x 1800 map)
    player.x = Math.max(80, Math.min(2320, x));
    player.y = Math.max(80, Math.min(1720, y));
  }

  public completeTask(playerId: string, taskId: string): { success: boolean; error?: string } {
    if (this.phase !== 'roaming') {
      return { success: false, error: 'Cannot complete tasks during meetings' };
    }

    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const task = player.tasks.find(t => t.taskId === taskId);
    if (!task) return { success: false, error: 'Task not assigned' };
    if (task.completed) return { success: false, error: 'Task already completed' };

    task.completed = true;
    this.addEvent(`${player.name} completed objective: ${task.name}.`, 'task', 'success');

    this.checkWinConditions();
    return { success: true };
  }

  public killPlayer(killerId: string, targetId: string): { success: boolean; error?: string } {
    if (this.phase !== 'roaming') {
      return { success: false, error: 'Cannot eliminate outside roaming phase' };
    }

    const killer = this.players.get(killerId);
    if (!killer || !killer.isAlive || killer.role !== 'impostor') {
      return { success: false, error: 'Only living Impostors can eliminate' };
    }

    if (killer.killCooldownRemaining > 0) {
      return { success: false, error: 'Kill cooldown active' };
    }

    const target = this.players.get(targetId);
    if (!target || !target.isAlive) {
      return { success: false, error: 'Target is already dead' };
    }
    if (target.role === 'impostor') {
      return { success: false, error: 'Cannot eliminate fellow Impostor' };
    }

    // Distance check (within 130px)
    const dist = Math.hypot(killer.x - target.x, killer.y - target.y);
    if (dist > 150) {
      return { success: false, error: 'Target is too far away' };
    }

    // Eliminate target
    target.isAlive = false;
    target.eliminatedAt = {
      phase: 'roaming',
      roundNumber: this.roundNumber,
      reason: 'impostor'
    };

    // Drop dead body at location
    const body: DeadBody = {
      id: `body_${Date.now()}_${target.id}`,
      playerId: target.id,
      playerName: target.name,
      character: target.character,
      color: target.color,
      x: target.x,
      y: target.y
    };
    this.deadBodies.push(body);

    killer.killCooldownRemaining = this.settings.killCooldownSeconds;
    this.eliminationHistory.push({
      playerId: target.id,
      playerName: target.name,
      role: target.role!,
      phase: 'roaming',
      reason: 'Eliminated by Impostor'
    });

    this.checkWinConditions();
    return { success: true };
  }

  public reportBody(reporterId: string, bodyId: string): { success: boolean; error?: string } {
    if (this.phase !== 'roaming') {
      return { success: false, error: 'Cannot report bodies right now' };
    }

    const reporter = this.players.get(reporterId);
    if (!reporter || !reporter.isAlive) {
      return { success: false, error: 'Dead players cannot report' };
    }

    const bodyIdx = this.deadBodies.findIndex(b => b.id === bodyId);
    if (bodyIdx < 0) {
      return { success: false, error: 'Body not found' };
    }

    const body = this.deadBodies[bodyIdx];
    const dist = Math.hypot(reporter.x - body.x, reporter.y - body.y);
    if (dist > 200) {
      return { success: false, error: 'Too far from body to report' };
    }

    // Clear bodies on meeting call
    this.deadBodies = [];
    this.meetingInfo = {
      reason: 'body_report',
      callerId: reporter.id,
      callerName: reporter.name,
      victimId: body.playerId,
      victimName: body.playerName
    };

    this.triggerMeeting();
    this.addEvent(`🚨 ${reporter.name} discovered ${body.playerName}’s fallen body! Emergency meeting called.`, 'report', 'danger');
    return { success: true };
  }

  public callEmergencyMeeting(callerId: string): { success: boolean; error?: string } {
    if (this.phase !== 'roaming') {
      return { success: false, error: 'Cannot call emergency right now' };
    }

    const caller = this.players.get(callerId);
    if (!caller || !caller.isAlive) {
      return { success: false, error: 'Dead players cannot call emergency meetings' };
    }
    if (caller.emergencyMeetingsRemaining <= 0) {
      return { success: false, error: 'No emergency meetings remaining' };
    }

    // Check proximity to Central Square meeting button (x: 1200, y: 950)
    const dist = Math.hypot(caller.x - 1200, caller.y - 950);
    if (dist > 180) {
      return { success: false, error: 'Must be at Central Square emergency siren' };
    }

    caller.emergencyMeetingsRemaining--;
    this.deadBodies = []; // Clear bodies
    this.meetingInfo = {
      reason: 'emergency_button',
      callerId: caller.id,
      callerName: caller.name
    };

    this.triggerMeeting();
    this.addEvent(`🔔 ${caller.name} sounded the Central Emergency Siren!`, 'report', 'danger');
    return { success: true };
  }

  private triggerMeeting(): void {
    this.votes.clear();
    this.ejectionResult = null;
    // Cancel active sabotage if meeting called
    this.sabotage = { active: false, type: null, remainingSeconds: 0 };

    // Move all living players to Central Square table
    const living = Array.from(this.players.values()).filter(p => p.isAlive);
    living.forEach((p, idx) => {
      const angle = (idx / living.length) * Math.PI * 2;
      p.x = 1200 + Math.cos(angle) * 120;
      p.y = 950 + Math.sin(angle) * 120;
      p.killCooldownRemaining = this.settings.killCooldownSeconds;
    });

    this.transitionTo('meeting', this.settings.discussionSeconds);
  }

  public castVote(voterId: string, targetId: string | null): { success: boolean; error?: string } {
    if (this.phase !== 'voting') {
      return { success: false, error: 'Can only vote during voting phase' };
    }

    const voter = this.players.get(voterId);
    if (!voter || !voter.isAlive) {
      return { success: false, error: 'Dead players cannot vote' };
    }

    if (targetId !== null) {
      const target = this.players.get(targetId);
      if (!target || !target.isAlive) {
        return { success: false, error: 'Invalid vote target' };
      }
    }

    this.votes.set(voterId, targetId);

    // If all living players have voted, speed up timer to 3 seconds
    const livingCount = Array.from(this.players.values()).filter(p => p.isAlive).length;
    if (this.votes.size >= livingCount && this.phaseRemainingSeconds > 3) {
      this.phaseRemainingSeconds = 3;
    }

    return { success: true };
  }

  public triggerSabotage(type: SabotageType): { success: boolean; error?: string } {
    if (this.phase !== 'roaming') {
      return { success: false, error: 'Cannot sabotage during meetings' };
    }
    if (this.sabotage.active) {
      return { success: false, error: 'A sabotage is already in effect' };
    }

    this.sabotage = {
      active: true,
      type,
      remainingSeconds: this.settings.sabotageTimerSeconds
    };

    if (type === 'reactor') {
      this.addEvent('⚠️ CRITICAL ALERT: Reactor core meltdown initiated! Repair at Power Station!', 'sabotage', 'danger');
    } else if (type === 'lights') {
      this.addEvent('💡 Settlement power grid sabotaged! Lights dimmed.', 'sabotage', 'danger');
    } else if (type === 'comms') {
      this.addEvent('📡 Communications array jammed! Mission tasks scrambled.', 'sabotage', 'danger');
    }

    return { success: true };
  }

  public fixSabotage(): { success: boolean; error?: string } {
    if (!this.sabotage.active) {
      return { success: false, error: 'No active sabotage' };
    }

    this.sabotage = { active: false, type: null, remainingSeconds: 0 };
    this.addEvent('✅ Sabotage repaired! Settlement systems restored to normal.', 'sabotage', 'success');
    return { success: true };
  }

  public tick(deltaSeconds: number): { phaseChanged: boolean; newPhase?: GamePhase } {
    if (this.phase === 'lobby' || this.phase === 'ended') {
      return { phaseChanged: false };
    }

    // Update kill cooldowns during roaming
    if (this.phase === 'roaming') {
      for (const p of this.players.values()) {
        if (p.isAlive && p.role === 'impostor' && p.killCooldownRemaining > 0) {
          p.killCooldownRemaining = Math.max(0, p.killCooldownRemaining - deltaSeconds);
        }
      }

      // Update sabotage timer if active
      if (this.sabotage.active && this.sabotage.type === 'reactor') {
        this.sabotage.remainingSeconds -= deltaSeconds;
        if (this.sabotage.remainingSeconds <= 0) {
          this.winner = 'impostors';
          this.winnerReason = 'Reactor core meltdown could not be contained in time!';
          this.transitionTo('ended', 0);
          return { phaseChanged: true, newPhase: 'ended' };
        }
      }
    }

    this.phaseRemainingSeconds -= deltaSeconds;
    if (this.phaseRemainingSeconds <= 0) {
      return this.advancePhase();
    }

    return { phaseChanged: false };
  }

  private advancePhase(): { phaseChanged: boolean; newPhase: GamePhase } {
    switch (this.phase) {
      case 'starting':
        this.roundNumber = 1;
        this.transitionTo('roaming', 0);
        return { phaseChanged: true, newPhase: 'roaming' };

      case 'meeting':
        // Transition from Discussion to Voting
        this.transitionTo('voting', this.settings.votingSeconds);
        return { phaseChanged: true, newPhase: 'voting' };

      case 'voting':
        this.resolveVotes();
        this.transitionTo('ejection', 8);
        return { phaseChanged: true, newPhase: 'ejection' };

      case 'ejection': {
        const gameOver = this.checkWinConditions();
        if (gameOver) {
          this.transitionTo('ended', 0);
          return { phaseChanged: true, newPhase: 'ended' };
        }
        this.roundNumber++;
        this.transitionTo('roaming', 0);
        return { phaseChanged: true, newPhase: 'roaming' };
      }

      default:
        return { phaseChanged: false, newPhase: this.phase };
    }
  }

  private resolveVotes(): void {
    const tallies: Record<string, number> = {};
    let skipCount = 0;

    for (const targetId of this.votes.values()) {
      if (targetId === null) {
        skipCount++;
      } else {
        tallies[targetId] = (tallies[targetId] || 0) + 1;
      }
    }

    let topCandidateId: string | null = null;
    let maxVotes = skipCount;
    let isTie = false;
    let topIsSkip = true;

    for (const [candidateId, count] of Object.entries(tallies)) {
      if (count > maxVotes) {
        maxVotes = count;
        topCandidateId = candidateId;
        isTie = false;
        topIsSkip = false;
      } else if (count === maxVotes && maxVotes > 0) {
        isTie = true;
      }
    }

    let ejectedId: string | null = null;
    let ejectedName: string | null = null;
    let ejectedRole: Role | null = null;

    if (!isTie && !topIsSkip && topCandidateId) {
      const victim = this.players.get(topCandidateId);
      if (victim && victim.isAlive) {
        victim.isAlive = false;
        victim.eliminatedAt = {
          phase: 'voting',
          roundNumber: this.roundNumber,
          reason: 'vote'
        };
        ejectedId = victim.id;
        ejectedName = victim.name;
        ejectedRole = victim.role!;

        this.eliminationHistory.push({
          playerId: victim.id,
          playerName: victim.name,
          role: victim.role!,
          phase: 'voting',
          reason: 'Ejected by Village Council'
        });
      }
    }

    const livingImpostors = Array.from(this.players.values()).filter(p => p.isAlive && p.role === 'impostor').length;

    this.ejectionResult = {
      ejectedId,
      ejectedName,
      ejectedRole,
      isTie,
      isSkipped: topIsSkip || (ejectedId === null && !isTie),
      remainingImpostors: livingImpostors
    };

    if (ejectedName) {
      this.addEvent(`Council decided: ${ejectedName} was ejected from the settlement. (${livingImpostors} Impostor${livingImpostors === 1 ? '' : 's'} remain)`, 'ejection', 'danger');
    } else if (isTie) {
      this.addEvent('Council vote tied! No one was ejected.', 'ejection');
    } else {
      this.addEvent('The council skipped the vote. No one was ejected.', 'ejection');
    }
  }

  public checkWinConditions(): boolean {
    if (this.winner) return true;

    const livingPlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    const livingImpostors = livingPlayers.filter(p => p.role === 'impostor').length;
    const livingVillagers = livingPlayers.filter(p => p.role === 'villager').length;

    // 1. Villagers win if all Impostors are eliminated
    if (livingImpostors === 0) {
      this.winner = 'villagers';
      this.winnerReason = 'All hidden Impostors have been exposed and eliminated!';
      this.phase = 'ended';
      return true;
    }

    // 2. Impostors win if Impostors >= Villagers
    if (livingImpostors >= livingVillagers) {
      this.winner = 'impostors';
      this.winnerReason = 'The Impostors have overwhelmed the research settlement!';
      this.phase = 'ended';
      return true;
    }

    // 3. Villagers win if ALL assigned tasks are completed
    const totalGoal = this.getTotalTasksGoal();
    const totalCompleted = this.getTotalTasksCompleted();
    if (totalGoal > 0 && totalCompleted >= totalGoal) {
      this.winner = 'villagers';
      this.winnerReason = 'The crew finished all settlement repair objectives!';
      this.phase = 'ended';
      return true;
    }

    return false;
  }

  public getTotalTasksGoal(): number {
    let goal = 0;
    for (const p of this.players.values()) {
      if (p.role === 'villager') {
        goal += p.tasks.length;
      }
    }
    return goal;
  }

  public getTotalTasksCompleted(): number {
    let completed = 0;
    for (const p of this.players.values()) {
      if (p.role === 'villager') {
        completed += p.tasks.filter(t => t.completed).length;
      }
    }
    return completed;
  }

  public getPlayerState(viewerId: string): PlayerGameState {
    const viewer = this.players.get(viewerId);
    const viewerIsImpostor = viewer?.role === 'impostor';
    const isOver = this.phase === 'ended';

    const safePlayers: SafePlayer[] = Array.from(this.players.values()).map(p => {
      // Reveal role only if game ended, or viewer is impostor and target is also impostor
      const revealRole = isOver || (viewerIsImpostor && p.role === 'impostor') || p.id === viewerId;

      return {
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isAlive: p.isAlive,
        connected: p.connected,
        character: p.character,
        color: p.color,
        x: p.x,
        y: p.y,
        role: revealRole ? p.role : undefined,
        isGhost: !p.isAlive,
        hasVoted: this.votes.has(p.id)
      };
    });

    const fellowImpostors = viewerIsImpostor
      ? Array.from(this.players.values()).filter(p => p.role === 'impostor' && p.id !== viewerId).map(p => p.id)
      : [];

    const totalGoal = this.getTotalTasksGoal();
    const totalCompleted = this.getTotalTasksCompleted();
    const percent = totalGoal > 0 ? Math.round((totalCompleted / totalGoal) * 100) : 0;

    let stats: GameStats | null = null;
    if (isOver && this.winner) {
      stats = {
        startedAt: this.startTime,
        endedAt: Date.now(),
        durationSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        winner: this.winner,
        winnerReason: this.winnerReason,
        initialRoles: this.initialRoles,
        eliminationHistory: this.eliminationHistory
      };
    }

    return {
      gameId: this.id,
      myPlayerId: viewerId,
      myRole: viewer?.role,
      myCharacter: viewer?.character || 'engineer',
      myColor: viewer?.color || '#f59e0b',
      phase: this.phase,
      phaseRemainingSeconds: Math.max(0, Math.ceil(this.phaseRemainingSeconds)),
      players: safePlayers,
      fellowImpostors,
      myTasks: viewer?.tasks || [],
      totalTasksCompleted: totalCompleted,
      totalTasksGoal: totalGoal,
      taskProgressPercent: percent,
      deadBodies: this.deadBodies,
      meetingInfo: this.meetingInfo,
      ejectionResult: this.ejectionResult,
      sabotage: this.sabotage,
      killCooldown: viewer?.killCooldownRemaining || 0,
      winner: this.winner,
      winnerReason: this.winnerReason,
      stats,
      settings: this.settings,
      recentEvents: this.recentEvents.slice(-10)
    };
  }

  public rematch(): void {
    this.phase = 'lobby';
    this.winner = null;
    this.winnerReason = '';
    this.deadBodies = [];
    this.votes.clear();
    this.meetingInfo = null;
    this.ejectionResult = null;
    this.sabotage = { active: false, type: null, remainingSeconds: 0 };

    for (const p of this.players.values()) {
      p.isAlive = true;
      p.role = undefined;
      p.tasks = [];
      p.killCooldownRemaining = this.settings.killCooldownSeconds;
      p.emergencyMeetingsRemaining = 1;
      p.x = 1200 + (Math.random() * 160 - 80);
      p.y = 950 + (Math.random() * 160 - 80);
    }

    this.addEvent('New expedition prepared. Waiting in lobby.', 'system');
  }

  private transitionTo(newPhase: GamePhase, durationSeconds: number): void {
    this.phase = newPhase;
    this.phaseDurationSeconds = durationSeconds;
    this.phaseRemainingSeconds = durationSeconds;
  }

  private addEvent(message: string, type: GameEvent['type'] = 'system', tone: GameEvent['tone'] = 'normal'): void {
    const event: GameEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      message,
      tone
    };
    this.recentEvents.push(event);
    if (this.recentEvents.length > 50) {
      this.recentEvents.shift();
    }
  }
}
