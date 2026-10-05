import {
  GamePhase,
  GameSettings,
  Player,
  PlayerGameState,
  GameEvent,
  GameStats
} from './types';

export interface GameEngineOptions {
  id: string;
  settings?: Partial<GameSettings>;
}

export abstract class GameEngine {
  public readonly id: string;
  public phase: GamePhase = 'lobby';
  public players: Map<string, Player> = new Map();
  public events: GameEvent[] = [];
  public roundNumber: number = 0;
  public phaseRemainingSeconds: number = 0;
  public phaseDurationSeconds: number = 0;
  public settings: GameSettings;
  public gameStats?: GameStats;

  constructor(options: GameEngineOptions, defaultSettings: GameSettings) {
    this.id = options.id;
    this.settings = { ...defaultSettings, ...(options.settings || {}) };
  }

  public abstract addPlayer(player: Player): { success: boolean; error?: string };
  public abstract removePlayer(playerId: string): { success: boolean; newHostId?: string };
  public abstract start(): { success: boolean; error?: string };
  public abstract handleAction(playerId: string, actionType: string, payload: unknown): { success: boolean; error?: string };
  public abstract tick(deltaSeconds: number): { phaseChanged: boolean; newPhase?: GamePhase };
  public abstract getPlayerState(playerId: string): PlayerGameState;
  public abstract isGameOver(): boolean;

  protected addEvent(
    message: string,
    type: GameEvent['type'] = 'system',
    tone: GameEvent['tone'] = 'normal'
  ): GameEvent {
    const event: GameEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      message,
      tone
    };
    this.events.push(event);
    if (this.events.length > 100) {
      this.events.shift();
    }
    return event;
  }
}
