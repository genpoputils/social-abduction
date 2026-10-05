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
    <div class="lobby-wrapper max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
      
      <!-- Top Room Chamber Header -->
      <div class="room-banner glass-panel-elevated p-5 flex items-center justify-between flex-wrap gap-4">
        
        <div class="room-info">
          <div class="flex items-center gap-2 mb-1">
            <span class="pulse-dot"></span>
            <span class="font-mono text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Settlement Chamber • Peer-to-Peer
            </span>
          </div>
          <div class="code-wrapper flex items-center gap-3">
            <h2 class="font-title text-2xl tracking-widest text-white">#{{ gameState.gameId }}</h2>
            <button (click)="copyRoomCode()" class="btn-copy px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white" title="Copy Room Code">
              {{ copiedCode ? '✓ Copied' : 'Copy Code' }}
            </button>
          </div>
        </div>

        <!-- Share Actions -->
        <div class="share-actions flex items-center gap-2">
          
          <button (click)="openShareInvite()" class="btn-cyber-primary py-2 px-4 text-xs font-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13" />
            </svg>
            <span>{{ isHost ? 'Share Crew Invite' : 'View Invite Code' }}</span>
          </button>

          <button (click)="showManualSignaling = !showManualSignaling" class="btn-cyber-secondary py-2 px-3 text-xs">
            <span>{{ showManualSignaling ? 'Hide Manual P2P' : 'Manual P2P' }}</span>
          </button>

          <button (click)="openRules.emit()" class="btn-cyber-secondary py-2 px-3 text-xs">
            Field Manual
          </button>

        </div>

      </div>

      <!-- Collapsible Manual Signaling Drawer (For fallback remote signaling) -->
      <div *ngIf="isHost && showManualSignaling" class="answer-drawer glass-panel p-4 animate-fade-in">
        <div class="drawer-header flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <span class="text-xs font-bold text-slate-300 font-mono">Manual WebRTC Answer Exchange (Remote Fallback)</span>
          <button (click)="showManualSignaling = false" class="text-slate-400 hover:text-white text-sm">✕</button>
        </div>
        <p class="text-xs text-slate-400 mb-3">
          If automatic signaling is unavailable, paste the answer code returned by the player below:
        </p>
        <form (ngSubmit)="submitPeerAnswer()" class="flex gap-2">
          <input
            type="text"
            [(ngModel)]="peerAnswerInput"
            name="peerAnswerInput"
            placeholder="Paste player answer code..."
            class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 outline-none"
          />
          <button type="submit" [disabled]="!peerAnswerInput.trim()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg">
            Accept Answer
          </button>
        </form>
        <div *ngIf="answerSuccessMsg" class="text-xs text-emerald-400 mt-2 font-semibold">{{ answerSuccessMsg }}</div>
      </div>

      <!-- Main Layout: Player Roster & Pre-game Chat -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Player Roster (2 Cols on lg) -->
        <div class="lg:col-span-2 roster-panel glass-panel p-5">
          
          <div class="roster-head flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div class="flex items-center gap-2">
              <h3 class="font-title text-base text-white">
                Settlement Crew ({{ gameState.players.length }} / {{ maxPlayers }})
              </h3>
            </div>
            <span class="font-mono text-xs text-indigo-400 px-2.5 py-1 rounded bg-indigo-950/60 border border-indigo-500/30">
              Min {{ minPlayers }} Required to Launch
            </span>
          </div>

          <!-- Roster Grid (All slots up to maxPlayers) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            <!-- Connected Players -->
            <div
              *ngFor="let p of gameState.players"
              class="crew-seat p-3 rounded-xl flex items-center justify-between transition-all"
              [ngClass]="p.id === gameState.myPlayerId ? 'seat-me' : 'seat-peer'"
            >
              <div class="flex items-center gap-3">
                <div class="seat-avatar-box" [style.background]="p.color + '22'" [style.borderColor]="p.color">
                  <div class="avatar-head">
                    <div class="avatar-hat" [style.background]="p.color"></div>
                    <div class="avatar-face"></div>
                  </div>
                  <div class="avatar-body" [style.background]="p.color">
                    <div class="avatar-lantern"></div>
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="seat-name font-title text-sm text-white">{{ p.name }}</span>
                    <span *ngIf="p.id === gameState.myPlayerId" class="tag-you">YOU</span>
                  </div>
                  <span class="seat-role-hint font-mono text-[10px] text-slate-400">
                    {{ p.isHost ? '👑 Expedition Leader' : (getArchetypeName(p.character) || 'Resident') }}
                  </span>
                </div>
              </div>
              <span class="conn-dot" title="WebRTC Connected"></span>
            </div>

            <!-- Empty Waiting Slots -->
            <div
              *ngFor="let item of emptySlotsArray"
              class="empty-seat p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-mono text-slate-500"
            >
              <span>[ QUARTERS SLOT 0{{ gameState.players.length + item + 1 }} ]</span>
              <span>Awaiting Resident Arrival...</span>
            </div>

          </div>

          <!-- Roster Footer & Launch Action -->
          <div class="roster-footer flex items-center justify-between flex-wrap gap-4 mt-6 pt-4 border-t border-slate-800">
            <div class="status-msg text-xs">
              <span *ngIf="!canStart" class="text-slate-400">
                {{ isHost
                  ? 'Need ' + (minPlayers - gameState.players.length) + ' more crew member(s) to enable expedition launch.'
                  : 'Waiting for Expedition Leader to launch (' + gameState.players.length + '/' + minPlayers + ' assembled).'
                }}
              </span>
              <span *ngIf="canStart" class="text-emerald-400 font-bold font-title">
                ✓ Crew is assembled! Leader may initiate the expedition.
              </span>
            </div>

            <div class="flex items-center gap-2">
              <!-- Quick bot fill test button for solo testing -->
              <button
                *ngIf="isHost && gameState.players.length < minPlayers"
                type="button"
                (click)="fillTestPlayers()"
                class="btn-fill-test px-3 py-2 rounded-lg text-xs font-mono"
                title="Populate empty slots with simulated crew members"
              >
                ⚡ Fill with {{ minPlayers }} Crew
              </button>

              <button
                *ngIf="isHost"
                (click)="start()"
                [disabled]="!canStart"
                class="btn-start font-title"
              >
                START EXPEDITION
              </button>
            </div>
          </div>

        </div>

        <!-- Pre-game Chat Panel -->
        <div class="chat-panel glass-panel p-5 flex flex-col h-[480px]">
          <div class="chat-head font-title text-sm text-slate-300 pb-3 mb-3 border-b border-slate-800">
            Chamber Transmissions
          </div>
          
          <div class="chat-stream flex-1 overflow-y-auto flex flex-col gap-2.5 py-1">
            <div *ngIf="chatMessages.length === 0" class="chat-empty text-xs text-slate-500 text-center my-auto">
              No transmissions yet. Greet the expedition crew.
            </div>
            <div
              *ngFor="let m of chatMessages"
              class="chat-bubble p-2.5 rounded-xl text-xs"
              [ngClass]="m.senderId === gameState.myPlayerId ? 'bubble-me' : 'bubble-peer'"
            >
              <div class="bubble-sender font-bold mb-0.5 text-indigo-300">{{ m.senderName }}</div>
              <div class="bubble-text text-slate-200">{{ m.text }}</div>
            </div>
          </div>

          <form (ngSubmit)="sendChatMsg()" class="chat-input-wrap flex gap-2 pt-3 border-t border-slate-800 mt-2">
            <input
              type="text"
              [(ngModel)]="chatText"
              name="chatText"
              placeholder="Message chamber..."
              class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
              maxlength="250"
            />
            <button type="submit" [disabled]="!chatText.trim()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg">
              Send
            </button>
          </form>
        </div>

      </div>

      <!-- Share Invite Modal -->
      <div *ngIf="showInviteModal" class="modal-overlay animate-fade-in" (click)="showInviteModal = false">
        <div class="modal-dialog glass-panel-elevated max-w-lg p-6" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-700">
            <h3 class="font-title text-xl text-white">Settlement Invite</h3>
            <button (click)="showInviteModal = false" class="text-slate-400 hover:text-white text-lg">✕</button>
          </div>
          
          <p class="text-xs text-slate-300 mb-3">
            Share this WebRTC invitation string with friends to join directly over browser P2P:
          </p>

          <textarea
            readonly
            [value]="currentInviteCode"
            class="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs font-mono text-cyan-300 outline-none mb-4"
            rows="5"
          ></textarea>

          <div class="flex gap-2">
            <button (click)="copyInviteData()" class="btn-cyber-primary flex-1 py-2.5 text-xs">
              {{ copiedInvite ? '✓ Invitation Copied!' : 'Copy Invitation Code' }}
            </button>
            <button *ngIf="isHost" (click)="generateNewInvite()" class="btn-cyber-secondary py-2.5 text-xs">
              Generate Next
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
    .crew-seat {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.5);
    }
    .seat-me {
      background: rgba(30, 27, 75, 0.6);
      border-color: rgba(99, 102, 241, 0.7);
    }
    .seat-avatar-box {
      width: 40px;
      height: 42px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px solid;
      position: relative;
    }
    .avatar-head {
      width: 14px;
      height: 12px;
      position: relative;
    }
    .avatar-hat {
      width: 16px;
      height: 5px;
      border-radius: 3px 3px 0 0;
      position: absolute;
      top: -2px;
      left: -1px;
    }
    .avatar-face {
      width: 12px;
      height: 8px;
      background: #fed7aa;
      border-radius: 2px;
      margin: 2px auto 0 auto;
    }
    .avatar-body {
      width: 18px;
      height: 14px;
      border-radius: 3px;
      position: relative;
      margin-top: 1px;
    }
    .avatar-lantern {
      width: 5px;
      height: 7px;
      background: #fef08a;
      border: 1px solid #78350f;
      border-radius: 2px;
      position: absolute;
      right: -3px;
      top: 3px;
      box-shadow: 0 0 5px #fef08a;
    }
    .tag-you {
      font-size: 0.6rem;
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      background: #4f46e5;
      color: white;
      font-weight: 700;
    }
    .conn-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
    }
    .empty-seat {
      border: 1px dashed rgba(51, 65, 85, 0.6);
      background: rgba(15, 23, 42, 0.3);
    }
    .btn-start {
      padding: 0.8rem 2rem;
      border-radius: 0.85rem;
      background: linear-gradient(135deg, #059669, #0d9488);
      border: none;
      color: white;
      font-weight: 700;
      letter-spacing: 0.05em;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(5, 150, 105, 0.4);
      transition: all 0.2s;
    }
    .btn-start:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(5, 150, 105, 0.6); }
    .btn-start:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
    .btn-fill-test {
      background: rgba(30, 41, 59, 0.8);
      border: 1px dashed rgba(99, 102, 241, 0.6);
      color: #cbd5e1;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-fill-test:hover {
      background: rgba(49, 46, 129, 0.7);
      border-color: #818cf8;
      color: white;
    }
    .bubble-me {
      align-self: flex-end;
      background: #4338ca;
      max-width: 85%;
    }
    .bubble-peer {
      align-self: flex-start;
      background: #1e293b;
      border: 1px solid #334155;
      max-width: 85%;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(3, 7, 18, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-dialog {
      width: 100%;
      border-radius: 1.5rem;
      background: #0b0f19;
      border: 1px solid rgba(99, 102, 241, 0.4);
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
  public showManualSignaling = false;
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

  get maxPlayers(): number {
    return this.gameState.settings?.maxPlayers || 8;
  }

  get canStart(): boolean {
    return this.gameState.players.length >= this.minPlayers && this.isHost;
  }

  get emptySlotsArray(): number[] {
    const totalSlots = this.maxPlayers;
    const needed = Math.max(0, totalSlots - this.gameState.players.length);
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
