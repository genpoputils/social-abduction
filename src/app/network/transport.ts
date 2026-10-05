/**
 * Framework-independent transport abstraction.
 * Allows replacing WebRTCTransport with a future WebSocketTransport
 * without modifying game engine or session logic.
 */
export interface GameTransport {
  connect(): Promise<void>;
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): void;
  disconnect(): void;
}
