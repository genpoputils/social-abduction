import { BehaviorSubject, Observable } from 'rxjs';
import { PlayerGameState, ChatMessage, SabotageType } from '../engine/types';

export abstract class GameSession {
  protected stateSubject = new BehaviorSubject<PlayerGameState | null>(null);
  public state$: Observable<PlayerGameState | null> = this.stateSubject.asObservable();

  protected chatSubject = new BehaviorSubject<ChatMessage[]>([]);
  public chat$: Observable<ChatMessage[]> = this.chatSubject.asObservable();

  public abstract isHost: boolean;
  public abstract playerId: string;
  public abstract roomId: string;

  public get currentState(): PlayerGameState | null {
    return this.stateSubject.getValue();
  }

  public get currentChat(): ChatMessage[] {
    return this.chatSubject.getValue();
  }

  public abstract sendMove(x: number, y: number, vx: number, vy: number, facing: 'left' | 'right', isMoving: boolean): void;
  public abstract sendCompleteTask(taskId: string): void;
  public abstract sendKill(targetId: string): void;
  public abstract sendReportBody(bodyId: string): void;
  public abstract sendCallEmergency(): void;
  public abstract sendVote(targetId: string | null): void;
  public abstract sendTriggerSabotage(type: SabotageType): void;
  public abstract sendFixSabotage(): void;
  public abstract sendChat(text: string): void;
  public abstract startGame(): void;
  public abstract rematch(): void;
  public abstract disconnect(): void;
}
