import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerGameState, ChatMessage } from '../../engine/types';
import { CHARACTER_ARCHETYPES } from '../../engine/roles';
import { SoundService } from '../../services/sound.service';
import { HostSession } from '../../session/host-session';
import { PlayerSession } from '../../session/player-session';
import { GameSession } from '../../session/game-session';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lobby-container max-w-6xl mx-auto px-4 py-6">
      
      <!-- Top Room Chamber Banner -->
      <div class="room-banner glass-panel-elevated flex items-center justify-between flex-wrap gap-4">
        
        <div class="room-info">
          <div class="chamber-tag">Settlement Chamber • Peer-to-Peer</div>
          <div class="code-wrapper flex items-center gap-2">
            <h2 class="font-title room-code">#{{ gameState.gameId }}</h2>
            <button (click)="copyRoomCode()" class="btn-copy" title="Copy Room Code">
              {{ copiedCode ? '✓' : 'Copy' }}
            </button>
          </div>
        </div>

        <!-- Share Actions -->
        <div class="share-actions flex items-center gap-2">
          
          <button (click)="openShareInvite()" class="btn-invite">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13" />
            </svg>
            <span>{{ isHost ? 'Share Crew Invite' : 'View Invite Code' }}</span>
          </button>

          <button *ngIf="isHost" (click)="showAnswerInput = !showAnswerInput" class="btn-answer">
            <span>Input Peer Answer</span>
          </button>

          <button (click)="openRules.emit()" class="btn-rules">
            Rules
          </button>

        </div>

      </div>

      <!-- Remote Peer Answer Drawer -->
      <div *ngIf="isHost && showAnswerInput" class="answer-drawer glass-panel animate-fade-in">
        <div class="drawer-header flex items-center justify-between">
          <span class="drawer-title">WebRTC Answer Exchange (Remote Peers)</span>
          <button (click)="showAnswerInput = false" class="btn-close">✕</button>
        </div>
        <p class="drawer-desc">
          When a player pastes your invitation and generates an answer code, paste it here to finalize direct P2P connection:
        </p>
        <form (ngSubmit)="submitPeerAnswer()" class="flex gap-2">
          <input
            type="text"
            [(ngModel)]="peerAnswerInput"
            name="peerAnswerInput"
            placeholder="Paste player answer code here..."
            class="answer-input"
          />
          <button type="submit" [disabled]="!peerAnswerInput.trim()" class="btn-accept">
            Accept Answer
          </button>
        </form>
        <div *ngIf="answerSuccessMsg" class="success-text">{{ answerSuccessMsg }}</div>
      </div>

      <!-- Main Layout: Player Roster & Pre-game Chat -->
      <div class="grid lobby-grid gap-6">
        
        <!-- Player Roster -->
        <div class="roster-panel glass-panel">
          
          <div class="roster-head flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="font-title roster-title">
                Settlement Crew ({{ gameState.players.length }} / {{ gameState.settings.maxPlayers }})
              </h3>
            </div>
            <div class="min-players-tag">
              Min {{ minPlayers }} Players Required
            </div>
          </div>

          <!-- Roster Grid -->
          <div class="roster-grid">
            <div
              *ngFor="let p of gameState.players"
              class="player-seat"
              [ngClass]="p.id === gameState.myPlayerId ? 'seat-me' : ''"
            >
              <div class="flex items-center gap-3">
                <div class="seat-avatar" [style.background]="p.color">
                  <div class="visor-gleam"></div>
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="seat-name">{{ p.name }}</span>
                    <span *ngIf="p.id === gameState.myPlayerId" class="tag-you">YOU</span>
                  </div>
                  <span class="seat-role-hint">
                    {{ p.isHost ? '👑 Expedition Leader' : (getArchetypeName(p.character) || 'Crew') }}
                  </span>
                </div>
              </div>
              <span class="conn-dot" title="Connected"></span>
            </div>

            <!-- Empty slots -->
            <div
              *ngFor="let item of emptySlotsArray"
              class="empty-seat"
            >
              Waiting for crew member {{ gameState.players.length + item + 1 }}...
            </div>
          </div>

          <!-- Start Game Action -->
          <div class="roster-footer flex items-center justify-between flex-wrap gap-3">
            <div class="status-msg">
              <span *ngIf="!canStart">
                {{ isHost
                  ? 'Need ' + (minPlayers - gameState.players.length) + ' more crew member(s) to enable start (5–10 players).'
                  : 'Waiting for Expedition Leader to launch (' + gameState.players.length + '/' + minPlayers + ' joined).'
                }}
              </span>
              <span *ngIf="canStart" class="text-ready">
                Crew is assembled! Leader may initiate the expedition.
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                *ngIf="isHost && gameState.players.length < minPlayers"
                type="button"
                (click)="fillTestPlayers()"
                class="btn-fill-test"
                title="Fill empty slots with simulated crew members for instant testing"
              >
                ⚡ Fill to {{ minPlayers }} Crew
              </button>

              <button
                *ngIf="isHost"
                (click)="start()"
                [disabled]="!canStart"
                class="btn-start"
              >
                START EXPEDITION
              </button>
            </div>
          </div>

        </div>

        <!-- Pre-game Chat -->
        <div class="chat-panel glass-panel">
          <div class="chat-head">Chamber Communications</div>
          <div class="chat-stream">
            <div *ngIf="chatMessages.length === 0" class="chat-empty">
              No transmissions yet. Greet your crew before launching.
            </div>
            <div
              *ngFor="let m of chatMessages"
              class="chat-bubble"
              [ngClass]="m.senderId === gameState.myPlayerId ? 'bubble-me' : 'bubble-peer'"
            >
              <div class="bubble-sender">{{ m.senderName }}</div>
              <div class="bubble-text">{{ m.text }}</div>
            </div>
          </div>
          <form (ngSubmit)="sendChatMsg()" class="chat-input-wrap flex gap-2">
            <input
              type="text"
              [(ngModel)]="chatText"
              name="chatText"
              placeholder="Send message to chamber..."
              class="chat-input"
              maxlength="250"
            />
            <button type="submit" [disabled]="!chatText.trim()" class="btn-chat-send">
              Send
            </button>
          </form>
        </div>

      </div>

      <!-- Share Invite Modal -->
      <div *ngIf="showInviteModal" class="modal-overlay animate-fade-in" (click)="showInviteModal = false">
        <div class="modal-dialog glass-panel-elevated max-w-lg" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between">
            <h3 class="font-title modal-head">Settlement Invite</h3>
            <button (click)="showInviteModal = false" class="btn-close">✕</button>
          </div>
          <p class="modal-sub">
            Copy this WebRTC invitation code and send it to your friend:
          </p>

          <div class="my-4">
            <textarea
              readonly
              [value]="currentInviteCode"
              class="invite-code-area"
              rows="5"
            ></textarea>
          </div>

          <div class="flex justify-between items-center gap-3">
            <button (click)="copyInviteData()" class="btn-copy-big flex-1">
              {{ copiedInvite ? '✓ Invitation Copied!' : 'Copy Invite Code' }}
            </button>
            <button *ngIf="isHost" (click)="generateNewInvite()" class="btn-gen-new">
              Generate Next Invite
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .lobby-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .room-banner {
      padding: 1.25rem 1.75rem;
      border-radius: 1.25rem;
    }
    .chamber-tag {
      font-size: 0.75rem;
      font-weight: 600;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .room-code {
      font-size: 1.75rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      color: #f8fafc;
    }
    .btn-copy {
      padding: 0.25rem 0.65rem;
      border-radius: 0.5rem;
      background: #1e293b;
      border: 1px solid #475569;
      color: #cbd5e1;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .btn-invite {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.6rem 1rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: none;
      color: white;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-answer {
      padding: 0.6rem 0.9rem;
      border-radius: 0.75rem;
      background: #1e293b;
      border: 1px solid #475569;
      color: #cbd5e1;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .btn-rules {
      padding: 0.6rem 0.9rem;
      border-radius: 0.75rem;
      background: #0f172a;
      border: 1px solid #334155;
      color: #94a3b8;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .answer-drawer {
      padding: 1.25rem;
      border-radius: 1rem;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(99, 102, 241, 0.4);
    }
    .drawer-title { font-weight: 700; font-size: 0.85rem; color: #e2e8f0; }
    .drawer-desc { font-size: 0.75rem; color: #94a3b8; margin: 0.35rem 0 0.75rem 0; }
    .answer-input {
      flex: 1;
      background: #0b0f19;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: #f1f5f9;
      font-size: 0.75rem;
    }
    .btn-accept {
      padding: 0.5rem 1rem;
      background: #059669;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-weight: 700;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .success-text { font-size: 0.75rem; color: #34d399; margin-top: 0.5rem; }
    .lobby-grid {
      grid-template-columns: 2fr 1fr;
    }
    @media (max-width: 900px) {
      .lobby-grid { grid-template-columns: 1fr; }
    }
    .roster-panel {
      padding: 1.5rem;
      border-radius: 1.25rem;
    }
    .roster-title { font-size: 1.15rem; font-weight: 700; color: #f8fafc; }
    .min-players-tag {
      font-size: 0.7rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
    }
    .roster-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.85rem;
      margin-top: 1rem;
    }
    .player-seat {
      padding: 0.85rem;
      border-radius: 0.85rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(51, 65, 85, 0.6);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .seat-me {
      background: rgba(30, 27, 75, 0.5);
      border-color: rgba(99, 102, 241, 0.6);
    }
    .seat-avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      position: relative;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    .visor-gleam {
      position: absolute;
      top: 8px;
      left: 8px;
      width: 14px;
      height: 8px;
      background: #38bdf8;
      border-radius: 3px;
    }
    .seat-name { font-weight: 700; font-size: 0.85rem; color: #f1f5f9; }
    .tag-you {
      font-size: 0.6rem;
      padding: 0.1rem 0.35rem;
      border-radius: 9999px;
      background: #4f46e5;
      color: white;
      font-weight: 700;
    }
    .seat-role-hint { font-size: 0.7rem; color: #94a3b8; display: block; margin-top: 0.1rem; }
    .conn-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
    }
    .empty-seat {
      padding: 0.85rem;
      border-radius: 0.85rem;
      border: 1px dashed rgba(51, 65, 85, 0.5);
      color: #64748b;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .roster-footer {
      border-top: 1px solid rgba(51, 65, 85, 0.6);
      padding-top: 1.25rem;
      margin-top: 1.25rem;
    }
    .status-msg { font-size: 0.75rem; color: #94a3b8; }
    .text-ready { color: #34d399; font-weight: 600; }
    .btn-start {
      padding: 0.75rem 2rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, #059669, #0d9488);
      border: none;
      color: white;
      font-family: 'Cinzel', serif;
      font-weight: 700;
      letter-spacing: 0.05em;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4);
    }
    .btn-start:hover { background: linear-gradient(135deg, #047857, #0f766e); }
    .btn-start:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-fill-test {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.65rem 1rem;
      border-radius: 0.75rem;
      background: rgba(30, 41, 59, 0.85);
      border: 1px dashed rgba(99, 102, 241, 0.6);
      color: #cbd5e1;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-fill-test:hover {
      background: rgba(49, 46, 129, 0.7);
      border-color: #818cf8;
      color: #fff;
    }
    .chat-panel {
      padding: 1.25rem;
      border-radius: 1.25rem;
      display: flex;
      flex-direction: column;
      height: 420px;
    }
    .chat-head {
      font-weight: 700;
      font-size: 0.85rem;
      color: #f1f5f9;
      border-bottom: 1px solid rgba(51, 65, 85, 0.6);
      padding-bottom: 0.65rem;
    }
    .chat-stream {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .chat-empty {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: #64748b;
      text-align: center;
    }
    .chat-bubble {
      padding: 0.5rem 0.75rem;
      border-radius: 0.75rem;
      max-width: 85%;
      font-size: 0.75rem;
    }
    .bubble-me {
      align-self: flex-end;
      background: #4338ca;
      color: white;
    }
    .bubble-peer {
      align-self: flex-start;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
    }
    .bubble-sender { font-size: 0.65rem; font-weight: 700; color: #cbd5e1; margin-bottom: 0.15rem; }
    .chat-input {
      flex: 1;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 0.45rem 0.75rem;
      color: white;
      font-size: 0.75rem;
      outline: none;
    }
    .btn-chat-send {
      padding: 0.45rem 0.85rem;
      background: #4f46e5;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-weight: 700;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-dialog { width: 100%; border-radius: 1.5rem; padding: 2rem; }
    .modal-head { font-size: 1.25rem; font-weight: 700; color: white; }
    .modal-sub { font-size: 0.75rem; color: #94a3b8; margin: 0.25rem 0 1rem 0; line-height: 1.4; }
    .invite-code-area {
      width: 100%;
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 0.75rem;
      padding: 0.75rem;
      color: #a5b4fc;
      font-size: 0.7rem;
      font-family: monospace;
      outline: none;
      resize: vertical;
    }
    .btn-copy-big {
      padding: 0.65rem;
      background: #4f46e5;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .btn-gen-new {
      padding: 0.65rem 1rem;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 0.5rem;
      color: #cbd5e1;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1rem;
      cursor: pointer;
    }
  `]
})
export class LobbyComponent implements OnInit {
  @Input() gameState!: PlayerGameState;
  @Input() chatMessages: ChatMessage[] = [];
  @Input() session!: GameSession;

  @Output() startGame = new EventEmitter<void>();
  @Output() sendChat = new EventEmitter<string>();
  @Output() openRules = new EventEmitter<void>();

  public copiedCode = false;
  public copiedInvite = false;
  public showInviteModal = false;
  public showAnswerInput = false;
  public currentInviteCode = '';
  public peerAnswerInput = '';
  public answerSuccessMsg = '';
  public chatText = '';

  get isHost(): boolean {
    return this.session.isHost;
  }

  get minPlayers(): number {
    return this.gameState.settings?.minPlayers || 5;
  }

  get canStart(): boolean {
    return this.gameState.players.length >= this.minPlayers && this.isHost;
  }

  get emptySlotsArray(): number[] {
    const needed = Math.max(0, this.minPlayers - this.gameState.players.length);
    return Array.from({ length: needed }, (_, i) => i);
  }

  constructor(private sound: SoundService) {}

  async ngOnInit(): Promise<void> {
    if (this.isHost) {
      await this.generateNewInvite();
      try {
        localStorage.setItem('mv_last_hosted_room', this.gameState.gameId);
      } catch {
        // ignore
      }
    } else {
      const playerSession = this.session as PlayerSession;
      this.currentInviteCode = playerSession.answerCode;
    }
  }

  public getArchetypeName(charType?: string): string {
    if (!charType) return 'Crew';
    return (CHARACTER_ARCHETYPES as any)[charType]?.name || 'Crew';
  }

  public copyRoomCode(): void {
    this.sound.playActionSelected();
    navigator.clipboard.writeText(this.gameState.gameId);
    this.copiedCode = true;
    setTimeout(() => this.copiedCode = false, 2000);
  }

  public async generateNewInvite(): Promise<void> {
    if (this.isHost) {
      const host = this.session as HostSession;
      const { inviteCode } = await host.createInvitation();
      this.currentInviteCode = inviteCode;
      try {
        localStorage.setItem(`mv_offer_${this.gameState.gameId}`, inviteCode);
      } catch {
        // ignore
      }
    }
  }

  public openShareInvite(): void {
    this.sound.playActionSelected();
    this.showInviteModal = true;
  }

  public copyInviteData(): void {
    this.sound.playActionSelected();
    navigator.clipboard.writeText(this.currentInviteCode);
    this.copiedInvite = true;
    setTimeout(() => this.copiedInvite = false, 2500);
  }

  public async submitPeerAnswer(): Promise<void> {
    if (this.isHost && this.peerAnswerInput.trim()) {
      const host = this.session as HostSession;
      const success = await host.handleEncodedAnswer(this.peerAnswerInput.trim());
      if (success) {
        this.sound.playActionSelected();
        this.answerSuccessMsg = 'Peer answer accepted! Connecting WebRTC data channel...';
        this.peerAnswerInput = '';
        setTimeout(() => this.answerSuccessMsg = '', 3000);
      } else {
        this.answerSuccessMsg = 'Invalid answer code. Please verify.';
      }
    }
  }

  public fillTestPlayers(): void {
    if (this.isHost) {
      const host = this.session as HostSession;
      host.fillWithTestPlayers(this.minPlayers);
      this.sound.playActionSelected();
    }
  }

  public start(): void {
    this.sound.playActionSelected();
    this.startGame.emit();
  }

  public sendChatMsg(): void {
    if (this.chatText.trim()) {
      this.sound.playActionSelected();
      this.sendChat.emit(this.chatText.trim());
      this.chatText = '';
    }
  }
}
