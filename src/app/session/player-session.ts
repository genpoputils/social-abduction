import { GameSession } from './game-session';
import { WebRTCManager } from '../network/webrtc-manager';
import { ConnectionOffer, LocalSignalingChannel, decodeSignal, encodeSignal } from '../network/signaling';
import { HostToPeerMessage, PeerToHostMessage } from '../network/protocol';
import { CharacterType, SabotageType } from '../engine/types';
import { Subject } from 'rxjs';

export interface RemotePositionUpdate {
  playerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  isMoving: boolean;
}

export class PlayerSession extends GameSession {
  public isHost = false;
  public webrtc: WebRTCManager;
  private localSignaling: LocalSignalingChannel | null = null;
  public answerCode: string = '';

  private positionsSubject = new Subject<RemotePositionUpdate[]>();
  public positions$ = this.positionsSubject.asObservable();

  constructor(
    public roomId: string,
    public playerId: string,
    public playerName: string,
    public character: CharacterType = 'researcher',
    public color: string = '#3b82f6'
  ) {
    super();
    this.webrtc = new WebRTCManager();
  }

  public async joinWithOffer(encodedOffer: string): Promise<string> {
    const offer = decodeSignal(encodedOffer) as ConnectionOffer;
    if (!offer || offer.type !== 'offer') {
      throw new Error('Invalid game invitation code');
    }

    this.roomId = offer.roomId;
    this.playerId = offer.peerId;

    this.setupSignaling(this.roomId);

    const { answer } = await this.webrtc.createPlayerAnswer(offer);
    this.answerCode = encodeSignal(answer);

    this.localSignaling?.broadcast(answer);
    this.setupWebRTC(offer.peerId);

    return this.answerCode;
  }

  private setupSignaling(roomId: string): void {
    this.localSignaling = new LocalSignalingChannel(roomId);
  }

  private setupWebRTC(_hostPeerId: string): void {
    this.webrtc.onConnectionStateChange((_peerId, state) => {
      if (state === 'connected') {
        this.sendToHost({
          type: 'PLAYER_JOIN',
          payload: {
            playerId: this.playerId,
            name: this.playerName,
            character: this.character,
            color: this.color
          }
        });
      }
    });

    this.webrtc.onMessage((_peerId, data) => {
      this.handleHostMessage(data as HostToPeerMessage);
    });
  }

  private handleHostMessage(message: HostToPeerMessage): void {
    switch (message.type) {
      case 'GAME_STATE':
        this.stateSubject.next(message.payload.state);
        break;

      case 'POSITIONS_SYNC':
        this.positionsSubject.next(message.payload.positions);
        break;

      case 'CHAT_BROADCAST': {
        const current = this.chatSubject.getValue();
        this.chatSubject.next([...current, message.payload.message]);
        break;
      }

      case 'GAME_ERROR':
        console.warn('[PlayerSession] Host error:', message.payload.message);
        break;

      default:
        break;
    }
  }

  private sendToHost(message: PeerToHostMessage): void {
    this.webrtc.send(this.playerId, message);
  }

  public override sendMove(x: number, y: number, vx: number, vy: number, facing: 'left' | 'right', isMoving: boolean): void {
    this.sendToHost({
      type: 'PLAYER_MOVE',
      payload: { x, y, vx, vy, facing, isMoving }
    });
  }

  public override sendCompleteTask(taskId: string): void {
    this.sendToHost({
      type: 'TASK_COMPLETED',
      payload: { taskId }
    });
  }

  public override sendKill(targetId: string): void {
    this.sendToHost({
      type: 'KILL_PLAYER',
      payload: { targetId }
    });
  }

  public override sendReportBody(bodyId: string): void {
    this.sendToHost({
      type: 'REPORT_BODY',
      payload: { bodyId }
    });
  }

  public override sendCallEmergency(): void {
    this.sendToHost({
      type: 'CALL_EMERGENCY',
      payload: {}
    });
  }

  public override sendVote(targetId: string | null): void {
    this.sendToHost({
      type: 'CAST_VOTE',
      payload: { targetId }
    });
  }

  public override sendTriggerSabotage(type: SabotageType): void {
    this.sendToHost({
      type: 'TRIGGER_SABOTAGE',
      payload: { type }
    });
  }

  public override sendFixSabotage(): void {
    this.sendToHost({
      type: 'FIX_SABOTAGE',
      payload: {}
    });
  }

  public override sendChat(text: string): void {
    this.sendToHost({
      type: 'CHAT_MESSAGE',
      payload: { text }
    });
  }

  public override startGame(): void {}
  public override rematch(): void {}

  public override disconnect(): void {
    this.localSignaling?.close();
    this.webrtc.disconnect();
    this.stateSubject.next(null);
  }
}
