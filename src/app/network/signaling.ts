export interface ConnectionOffer {
  type: 'offer';
  peerId: string;
  roomId: string;
  sdp: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
}

export interface ConnectionAnswer {
  type: 'answer';
  peerId: string;
  roomId: string;
  sdp: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
}

export type SignalPayload = ConnectionOffer | ConnectionAnswer;

/**
 * Encodes signaling payload to a compact base64 URL-safe string.
 */
export function encodeSignal(payload: SignalPayload): string {
  try {
    const json = JSON.stringify(payload);
    // Use native btoa with UTF-8 support
    const encoded = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return encoded;
  } catch (err) {
    console.error('[Signaling] Failed to encode signal:', err);
    return '';
  }
}

/**
 * Decodes base64 string back to signaling payload.
 */
export function decodeSignal(encoded: string): SignalPayload | null {
  try {
    const clean = encoded.trim();
    const raw = decodeURIComponent(Array.prototype.map.call(atob(clean), (c: string) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(raw) as SignalPayload;
  } catch (err) {
    console.error('[Signaling] Failed to decode signal:', err);
    return null;
  }
}

/**
 * Automatic local signaling over BroadcastChannel.
 * Allows multiple browser tabs on the same machine to auto-exchange
 * WebRTC offers & answers instantly without manual copy-pasting.
 */
export class LocalSignalingChannel {
  private channel: BroadcastChannel | null = null;
  private messageHandlers: Set<(signal: SignalPayload) => void> = new Set();

  constructor(public readonly roomId: string) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`mv_p2p_${roomId.toUpperCase()}`);
        this.channel.onmessage = (event) => {
          if (event.data && (event.data.type === 'offer' || event.data.type === 'answer')) {
            this.notify(event.data as SignalPayload);
          }
        };
      } catch (err) {
        console.warn('[LocalSignaling] BroadcastChannel not supported:', err);
      }
    }
  }

  public broadcast(signal: SignalPayload): void {
    if (this.channel) {
      try {
        this.channel.postMessage(signal);
      } catch (err) {
        console.error('[LocalSignaling] Broadcast error:', err);
      }
    }
  }

  public onSignal(handler: (signal: SignalPayload) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private notify(signal: SignalPayload): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(signal);
      } catch (err) {
        console.error('[LocalSignaling] Handler error:', err);
      }
    }
  }

  public close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
