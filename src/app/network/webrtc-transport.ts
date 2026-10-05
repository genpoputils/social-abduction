import { GameTransport } from './transport';
import { WebRTCManager } from './webrtc-manager';

export class WebRTCTransport implements GameTransport {
  constructor(
    private webrtc: WebRTCManager,
    private targetPeerId: string
  ) {}

  public async connect(): Promise<void> {
    // WebRTC connection is negotiated through signaling
    return Promise.resolve();
  }

  public send(message: unknown): void {
    this.webrtc.send(this.targetPeerId, message);
  }

  public onMessage(handler: (message: unknown) => void): void {
    this.webrtc.onMessage((peerId, data) => {
      if (peerId === this.targetPeerId) {
        handler(data);
      }
    });
  }

  public disconnect(): void {
    this.webrtc.removePeer(this.targetPeerId);
  }
}
