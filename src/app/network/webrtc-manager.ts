import { DEFAULT_RTC_CONFIG } from './config';
import { ConnectionOffer, ConnectionAnswer } from './signaling';

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface PeerConnectionContext {
  peerId: string;
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  state: ConnectionState;
}

export class WebRTCManager {
  private peers: Map<string, PeerConnectionContext> = new Map();
  private onMessageHandler?: (peerId: string, data: unknown) => void;
  private onConnectionStateChangeHandler?: (peerId: string, state: ConnectionState) => void;

  constructor(private config: RTCConfiguration = DEFAULT_RTC_CONFIG) {}

  public onMessage(handler: (peerId: string, data: unknown) => void): void {
    this.onMessageHandler = handler;
  }

  public onConnectionStateChange(handler: (peerId: string, state: ConnectionState) => void): void {
    this.onConnectionStateChangeHandler = handler;
  }

  /**
   * HOST FLOW:
   * 1. Create a PeerConnection for an incoming peer.
   * 2. Create reliable, ordered DataChannel.
   * 3. Create Offer and wait for ICE gathering to complete.
   */
  public async createHostOffer(peerId: string, roomId: string): Promise<ConnectionOffer> {
    const pc = new RTCPeerConnection(this.config);
    const dataChannel = pc.createDataChannel('game', { ordered: true });

    const context: PeerConnectionContext = {
      peerId,
      pc,
      dataChannel,
      state: 'new'
    };
    this.peers.set(peerId, context);

    this.setupDataChannel(peerId, dataChannel);
    this.setupPeerConnectionEvents(peerId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete so all candidates are included in the SDP
    await this.waitForIceGathering(pc);

    return {
      type: 'offer',
      peerId,
      roomId,
      sdp: pc.localDescription!.toJSON(),
      candidates: []
    };
  }

  /**
   * HOST FLOW:
   * Handle the Answer received from the peer.
   */
  public async handleHostAnswer(peerId: string, answer: ConnectionAnswer): Promise<void> {
    const context = this.peers.get(peerId);
    if (!context) {
      throw new Error(`Peer context ${peerId} not found`);
    }

    if (context.pc.signalingState !== 'stable') {
      await context.pc.setRemoteDescription(new RTCSessionDescription(answer.sdp));
    }
  }

  /**
   * PLAYER FLOW:
   * 1. Create PeerConnection.
   * 2. Set remote offer.
   * 3. Create Answer.
   * 4. Listen for datachannel event from host.
   */
  public async createPlayerAnswer(offer: ConnectionOffer): Promise<{ answer: ConnectionAnswer; context: PeerConnectionContext }> {
    const pc = new RTCPeerConnection(this.config);

    const context: PeerConnectionContext = {
      peerId: offer.peerId,
      pc,
      dataChannel: null,
      state: 'new'
    };
    this.peers.set(offer.peerId, context);

    this.setupPeerConnectionEvents(offer.peerId, pc);

    pc.ondatachannel = (event) => {
      context.dataChannel = event.channel;
      this.setupDataChannel(offer.peerId, event.channel);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.waitForIceGathering(pc);

    return {
      answer: {
        type: 'answer',
        peerId: offer.peerId,
        roomId: offer.roomId,
        sdp: pc.localDescription!.toJSON(),
        candidates: []
      },
      context
    };
  }

  /**
   * Helper to wait until ICE gathering is complete or times out.
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        resolve();
      }, timeoutMs);

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);
    });
  }

  private setupPeerConnectionEvents(peerId: string, pc: RTCPeerConnection): void {
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState as ConnectionState;
      const context = this.peers.get(peerId);
      if (context) {
        context.state = state;
      }
      if (this.onConnectionStateChangeHandler) {
        this.onConnectionStateChangeHandler(peerId, state);
      }
    };
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      const context = this.peers.get(peerId);
      if (context) {
        context.state = 'connected';
      }
      if (this.onConnectionStateChangeHandler) {
        this.onConnectionStateChangeHandler(peerId, 'connected');
      }
    };

    channel.onclose = () => {
      const context = this.peers.get(peerId);
      if (context) {
        context.state = 'closed';
      }
      if (this.onConnectionStateChangeHandler) {
        this.onConnectionStateChangeHandler(peerId, 'closed');
      }
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (this.onMessageHandler) {
          this.onMessageHandler(peerId, parsed);
        }
      } catch (err) {
        console.error('[WebRTCManager] Parse message error:', err);
      }
    };
  }

  /**
   * Send a message to a specific peer.
   */
  public send(peerId: string, message: unknown): boolean {
    const context = this.peers.get(peerId);
    if (context && context.dataChannel && context.dataChannel.readyState === 'open') {
      try {
        context.dataChannel.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error(`[WebRTCManager] Failed to send message to peer ${peerId}:`, err);
      }
    }
    return false;
  }

  /**
   * Broadcast a message to all connected peers.
   */
  public broadcast(message: unknown, excludePeerId?: string): void {
    const payloadStr = JSON.stringify(message);
    for (const [pId, context] of this.peers.entries()) {
      if (pId !== excludePeerId && context.dataChannel && context.dataChannel.readyState === 'open') {
        try {
          context.dataChannel.send(payloadStr);
        } catch (err) {
          console.error(`[WebRTCManager] Failed to broadcast to ${pId}:`, err);
        }
      }
    }
  }

  /**
   * Get connected peer count.
   */
  public getConnectedPeerCount(): number {
    let count = 0;
    for (const ctx of this.peers.values()) {
      if (ctx.dataChannel && contextOpen(ctx.dataChannel)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Disconnect all peers and close connections.
   */
  public disconnect(): void {
    for (const context of this.peers.values()) {
      try {
        if (context.dataChannel) {
          context.dataChannel.close();
        }
        context.pc.close();
      } catch {
        // ignore
      }
    }
    this.peers.clear();
  }

  public removePeer(peerId: string): void {
    const context = this.peers.get(peerId);
    if (context) {
      try {
        if (context.dataChannel) context.dataChannel.close();
        context.pc.close();
      } catch {
        // ignore
      }
      this.peers.delete(peerId);
    }
  }
}

function contextOpen(ch: RTCDataChannel): boolean {
  return ch.readyState === 'open';
}
