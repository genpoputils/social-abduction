export type Role = 'villager' | 'impostor' | 'resident' | 'mimic';
export type Team = 'villagers' | 'impostors' | 'residents' | 'mimics';

export type CharacterType =
  | 'engineer'
  | 'scientist'
  | 'medic'
  | 'botanist'
  | 'mechanic'
  | 'researcher'
  | 'scout'
  | 'security';

export interface CharacterArchetype {
  id: CharacterType;
  name: string;
  roleHint: string;
  color: string;
  accentColor: string;
  description: string;
}

export type GamePhase =
  | 'lobby'
  | 'starting'
  | 'roaming'
  | 'meeting'
  | 'voting'
  | 'ejection'
  | 'ended';

export type TaskType =
  | 'wiring'
  | 'divert_power'
  | 'sample_scan'
  | 'frequency_tune'
  | 'valve_calibrate';

export interface TaskDefinition {
  id: string;
  room: string;
  name: string;
  type: TaskType;
  x: number;
  y: number;
}

export interface PlayerTask {
  taskId: string;
  name: string;
  room: string;
  type: TaskType;
  completed: boolean;
}

export type SabotageType = 'lights' | 'reactor' | 'comms';

export interface SabotageState {
  active: boolean;
  type: SabotageType | null;
  remainingSeconds: number;
}

export interface DeadBody {
  id: string;
  playerId: string;
  playerName: string;
  character: CharacterType;
  color: string;
  x: number;
  y: number;
}

export interface PlayerPosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  isMoving: boolean;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  connected: boolean;
  role?: Role;
  character: CharacterType;
  color: string;
  x: number;
  y: number;
  tasks: PlayerTask[];
  killCooldownRemaining: number;
  emergencyMeetingsRemaining: number;
  eliminatedAt?: {
    phase: GamePhase;
    roundNumber: number;
    reason: 'impostor' | 'vote' | 'disconnected';
  };
}

export interface SafePlayer {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  connected: boolean;
  character: CharacterType;
  color: string;
  x: number;
  y: number;
  role?: Role; // only revealed if game ended, or if viewer is also an impostor
  isGhost: boolean;
  hasVoted?: boolean;
}

export interface MeetingInfo {
  reason: 'body_report' | 'emergency_button';
  callerId: string;
  callerName: string;
  victimId?: string;
  victimName?: string;
}

export interface EjectionResult {
  ejectedId: string | null;
  ejectedName: string | null;
  ejectedRole: Role | null;
  isTie: boolean;
  isSkipped: boolean;
  remainingImpostors: number;
}

export interface GameSettings {
  minPlayers: number;
  maxPlayers: number;
  impostorCount: number;
  discussionSeconds: number;
  votingSeconds: number;
  killCooldownSeconds: number;
  tasksPerPlayer: number;
  speed: number;
  sabotageTimerSeconds: number;
}

export interface GameStats {
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  winner: Team;
  winnerReason: string;
  initialRoles: Record<string, Role>;
  eliminationHistory: Array<{
    playerId: string;
    playerName: string;
    role: Role;
    phase: GamePhase;
    reason: string;
  }>;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'system' | 'report' | 'ejection' | 'sabotage' | 'task';
  message: string;
  tone?: 'normal' | 'danger' | 'success' | 'mysterious';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isDeadSender: boolean;
}

export interface PlayerGameState {
  gameId: string;
  myPlayerId: string;
  myRole?: Role;
  myCharacter: CharacterType;
  myColor: string;
  phase: GamePhase;
  phaseRemainingSeconds: number;
  players: SafePlayer[];
  fellowImpostors?: string[]; // IDs of other impostors
  myTasks: PlayerTask[];
  totalTasksCompleted: number;
  totalTasksGoal: number;
  taskProgressPercent: number;
  deadBodies: DeadBody[];
  meetingInfo: MeetingInfo | null;
  ejectionResult: EjectionResult | null;
  sabotage: SabotageState;
  killCooldown: number;
  winner: Team | null;
  winnerReason: string;
  stats: GameStats | null;
  settings: GameSettings;
  recentEvents: GameEvent[];
}
