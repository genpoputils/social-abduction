import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CharacterType, GameSettings } from '../engine/types';
import { CHARACTER_ARCHETYPES } from '../engine/roles';
import { generateAnonymousName, generateRoomId } from '../engine/names';
import { GameSession } from '../session/game-session';
import { HostSession } from '../session/host-session';
import { PlayerSession } from '../session/player-session';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private sessionSubject = new BehaviorSubject<GameSession | null>(null);
  public session$: Observable<GameSession | null> = this.sessionSubject.asObservable();

  public playerId: string;
  public playerName: string;
  public character: CharacterType = 'engineer';
  public color: string = '#f59e0b';

  constructor() {
    let savedId = localStorage.getItem('mv_player_id');
    if (!savedId) {
      savedId = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem('mv_player_id', savedId);
    }
    this.playerId = savedId;

    let savedName = localStorage.getItem('mv_player_name');
    if (!savedName) {
      savedName = generateAnonymousName();
      localStorage.setItem('mv_player_name', savedName);
    }
    this.playerName = savedName;

    const savedChar = localStorage.getItem('mv_player_char') as CharacterType;
    if (savedChar && CHARACTER_ARCHETYPES[savedChar]) {
      this.character = savedChar;
      this.color = CHARACTER_ARCHETYPES[savedChar].color;
    }
  }

  public setPlayerName(name: string): void {
    const trimmed = name.trim().slice(0, 24);
    if (trimmed) {
      this.playerName = trimmed;
      localStorage.setItem('mv_player_name', trimmed);
    }
  }

  public setCharacter(char: CharacterType): void {
    if (CHARACTER_ARCHETYPES[char]) {
      this.character = char;
      this.color = CHARACTER_ARCHETYPES[char].color;
      localStorage.setItem('mv_player_char', char);
    }
  }

  public get currentSession(): GameSession | null {
    return this.sessionSubject.getValue();
  }

  public get isHost(): boolean {
    return this.currentSession?.isHost ?? false;
  }

  public createGame(settings?: Partial<GameSettings>): HostSession {
    this.leaveGame();

    const roomId = generateRoomId(6);
    const hostSession = new HostSession(
      roomId,
      this.playerId,
      this.playerName,
      this.character,
      settings
    );
    this.sessionSubject.next(hostSession);
    return hostSession;
  }

  public async joinGame(encodedOffer: string): Promise<{ session: PlayerSession; answerCode: string }> {
    this.leaveGame();

    const playerSession = new PlayerSession(
      '',
      this.playerId,
      this.playerName,
      this.character,
      this.color
    );
    const answerCode = await playerSession.joinWithOffer(encodedOffer);
    this.sessionSubject.next(playerSession);

    return { session: playerSession, answerCode };
  }

  public leaveGame(): void {
    const session = this.currentSession;
    if (session) {
      session.disconnect();
      this.sessionSubject.next(null);
    }
  }
}
