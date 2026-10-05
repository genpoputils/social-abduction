import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CharacterType, GameSettings } from '../../engine/types';
import { CHARACTER_LIST } from '../../engine/roles';
import { SoundService } from '../../services/sound.service';
import { GameService } from '../../services/game.service';
import { decodeSignal } from '../../network/signaling';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="home-container max-w-6xl mx-auto px-4 py-8">
      
      <!-- Hero Section -->
      <div class="hero-section text-center">
        <div class="ecosystem-pill">
          <span>GenPopUtils Play Ecosystem</span>
        </div>

        <h1 class="font-title hero-title">MIDNIGHT VILLAGE</h1>
        <p class="font-title hero-tagline">&ldquo;Trust no one.&rdquo;</p>
        
        <p class="hero-desc">
          A genuine top-down 2D multiplayer social-deduction game.
          Explore the isolated research settlement, repair critical infrastructure, identify hidden impostors,
          report fallen crew, and hold emergency council votes.
        </p>

        <!-- Feature Badges -->
        <div class="feature-badges flex flex-wrap justify-center gap-2">
          <span class="badge-pill">🎮 2D Animated World</span>
          <span class="badge-pill">⚡ 100% Peer-to-Peer</span>
          <span class="badge-pill">🌐 Browser Only</span>
          <span class="badge-pill">🔒 Zero Server Storage</span>
          <span class="badge-pill">🆓 Free to Play ($0 Cost)</span>
        </div>
      </div>

      <!-- Character Selection Carousel -->
      <div class="char-selection-card glass-panel-elevated max-w-2xl mx-auto p-4">
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-700/60">
          <span class="font-title text-sm text-slate-300">Select Your Settlement Suit</span>
          <span class="text-xs text-indigo-400 font-semibold">{{ currentArchetype.name }}</span>
        </div>

        <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
          <button
            *ngFor="let char of characters"
            type="button"
            (click)="selectCharacter(char.id)"
            class="char-btn flex flex-col items-center p-2 rounded-xl border transition-all"
            [ngClass]="gameService.character === char.id ? 'char-btn-active' : 'char-btn-inactive'"
            [style.borderColor]="gameService.character === char.id ? char.color : 'rgba(51, 65, 85, 0.4)'"
          >
            <div class="char-swatch" [style.background]="char.color"></div>
            <span class="char-label text-[10px] mt-1">{{ char.name }}</span>
          </button>
        </div>
        <p class="text-center text-xs text-slate-400 mt-2">{{ currentArchetype.description }}</p>
      </div>

      <!-- Action Card -->
      <div class="action-card glass-panel-elevated max-w-2xl mx-auto">
        <div class="grid grid-2 gap-4">
          
          <button (click)="openCreateModal()" class="btn-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>CREATE GAME</span>
          </button>

          <button (click)="openJoinModal()" class="btn-secondary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3" />
            </svg>
            <span>JOIN GAME</span>
          </button>

        </div>

        <!-- Local Tab Quick Join Notification -->
        <div *ngIf="detectedLocalRoom" class="local-detection-banner animate-fade-in mt-4">
          <div class="flex items-center gap-2">
            <span class="pulse-dot"></span>
            <span>Host room <strong>#{{ detectedLocalRoom }}</strong> detected in another tab!</span>
          </div>
          <button (click)="quickJoinLocal()" class="btn-quick-join">
            Quick Join
          </button>
        </div>
      </div>

      <!-- Architecture Explainer Note -->
      <div class="architecture-note glass-panel max-w-2xl mx-auto">
        <div class="note-title">Host-Authoritative 2D Peer-to-Peer Engine</div>
        <p class="note-text">
          Midnight Village runs directly in the browser using <strong>Phaser 3</strong> for 2D rendering and
          <strong>WebRTC DataChannels</strong> for real-time multiplayer synchronization. Zero backend servers or databases.
        </p>
      </div>

      <!-- Create Game Modal -->
      <div *ngIf="showCreateModal" class="modal-overlay animate-fade-in">
        <div class="modal-dialog glass-panel-elevated max-w-md">
          <h3 class="font-title modal-head">Expedition Setup</h3>
          <p class="modal-sub">Configure crew limits and hidden impostors.</p>

          <form (ngSubmit)="confirmCreate()" class="modal-form">
            
            <div class="form-group">
              <label class="form-label">Crew Limit (5–10 Players)</label>
              <div class="limit-selector flex gap-2">
                <button
                  type="button"
                  *ngFor="let count of [5, 6, 7, 8, 10]"
                  (click)="maxPlayers = count"
                  class="btn-limit"
                  [ngClass]="maxPlayers === count ? 'btn-limit-active' : ''"
                >
                  {{ count }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Hidden Impostors</label>
              <div class="limit-selector flex gap-2">
                <button
                  type="button"
                  *ngFor="let count of [1, 2]"
                  (click)="impostorCount = count"
                  class="btn-limit"
                  [ngClass]="impostorCount === count ? 'btn-limit-active' : ''"
                >
                  {{ count }} Impostor{{ count > 1 ? 's' : '' }}
                </button>
              </div>
            </div>

            <div class="modal-actions flex gap-2 mt-4">
              <button type="button" (click)="showCreateModal = false" class="btn-cancel">Cancel</button>
              <button type="submit" class="btn-confirm">Launch Chamber</button>
            </div>

          </form>
        </div>
      </div>

      <!-- Join Game Modal -->
      <div *ngIf="showJoinModal" class="modal-overlay animate-fade-in">
        <div class="modal-dialog glass-panel-elevated max-w-md">
          <h3 class="font-title modal-head">Join Expedition</h3>
          <p class="modal-sub">Paste the invite code provided by your host.</p>

          <form (ngSubmit)="confirmJoin()" class="modal-form">
            
            <div class="form-group">
              <label class="form-label">Invite Code / Invitation Data</label>
              <textarea
                [(ngModel)]="inviteInput"
                name="inviteInput"
                rows="4"
                placeholder="Paste the invitation text from host..."
                class="invite-textarea"
                required
              ></textarea>
            </div>

            <div *ngIf="joinError" class="join-error-text">
              {{ joinError }}
            </div>

            <div class="modal-actions flex gap-2">
              <button type="button" (click)="showJoinModal = false" class="btn-cancel">Cancel</button>
              <button type="submit" [disabled]="!inviteInput.trim()" class="btn-confirm">
                Connect to Settlement
              </button>
            </div>

          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .home-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .ecosystem-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: rgba(49, 46, 129, 0.6);
      border: 1px solid rgba(99, 102, 241, 0.4);
      font-size: 0.75rem;
      font-weight: 600;
      color: #c7d2fe;
      margin-bottom: 0.75rem;
    }
    .hero-title {
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #f8fafc;
      margin-bottom: 0.25rem;
    }
    .hero-tagline {
      font-size: 1.35rem;
      font-weight: 600;
      color: #fef08a;
      margin-bottom: 0.75rem;
    }
    .hero-desc {
      font-size: 0.95rem;
      color: #cbd5e1;
      max-width: 38rem;
      margin: 0 auto 1.25rem auto;
      line-height: 1.6;
    }
    .badge-pill {
      font-size: 0.7rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(51, 65, 85, 0.6);
      color: #94a3b8;
    }
    .char-swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.4);
    }
    .char-btn {
      background: rgba(15, 23, 42, 0.6);
      cursor: pointer;
    }
    .char-btn-active {
      background: rgba(49, 46, 129, 0.5);
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
      transform: scale(1.05);
    }
    .action-card {
      padding: 1.75rem;
      border-radius: 1.5rem;
      width: 100%;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 640px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.15rem;
      border-radius: 1rem;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: none;
      color: white;
      font-family: 'Cinzel', serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.35);
      transition: all 0.2s;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(79, 70, 229, 0.5);
    }
    .btn-secondary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.15rem;
      border-radius: 1rem;
      background: #1e293b;
      border: 1px solid rgba(51, 65, 85, 0.8);
      color: #f1f5f9;
      font-family: 'Cinzel', serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transition: all 0.2s;
    }
    .btn-secondary:hover {
      background: #334155;
      transform: translateY(-2px);
    }
    .local-detection-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.25rem;
      border-radius: 0.85rem;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(99, 102, 241, 0.5);
      color: #cbd5e1;
      font-size: 0.85rem;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 10px #34d399;
    }
    .btn-quick-join {
      padding: 0.35rem 0.85rem;
      background: #059669;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-weight: 700;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .architecture-note {
      padding: 1.25rem;
      border-radius: 1rem;
      width: 100%;
    }
    .note-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 0.25rem;
    }
    .note-text { font-size: 0.75rem; color: #94a3b8; line-height: 1.5; }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-dialog {
      width: 100%;
      border-radius: 1.5rem;
      padding: 2rem;
    }
    .modal-head { font-size: 1.35rem; font-weight: 800; color: white; }
    .modal-sub { font-size: 0.8rem; color: #94a3b8; margin: 0.25rem 0 1.25rem 0; }
    .form-group { margin-bottom: 1.25rem; }
    .form-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 700;
      color: #cbd5e1;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .btn-limit {
      flex: 1;
      padding: 0.65rem 0;
      border-radius: 0.75rem;
      background: #1e293b;
      border: 1px solid #475569;
      color: #cbd5e1;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-limit-active {
      background: #4f46e5;
      border-color: #818cf8;
      color: white;
    }
    .invite-textarea {
      width: 100%;
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 0.75rem;
      padding: 0.75rem;
      color: #cbd5e1;
      font-size: 0.75rem;
      font-family: monospace;
      outline: none;
    }
    .join-error-text { color: #f87171; font-size: 0.75rem; margin-bottom: 0.75rem; }
    .btn-cancel {
      flex: 1;
      padding: 0.75rem;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 0.75rem;
      color: #cbd5e1;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-confirm {
      flex: 1;
      padding: 0.75rem;
      background: #4f46e5;
      border: none;
      border-radius: 0.75rem;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  @Output() createGame = new EventEmitter<Partial<GameSettings>>();
  @Output() joinGame = new EventEmitter<string>();

  public showCreateModal: boolean = false;
  public showJoinModal: boolean = false;

  public maxPlayers: number = 8;
  public impostorCount: number = 1;
  public inviteInput: string = '';
  public joinError: string = '';

  public characters = CHARACTER_LIST;
  public detectedLocalRoom: string | null = null;
  private localBroadcastListener: BroadcastChannel | null = null;

  get currentArchetype() {
    return this.characters.find(c => c.id === this.gameService.character) || this.characters[0];
  }

  constructor(public gameService: GameService, private sound: SoundService) {}

  ngOnInit(): void {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        window.addEventListener('storage', (e) => {
          if (e.key === 'mv_last_hosted_room' && e.newValue) {
            this.detectedLocalRoom = e.newValue;
          }
        });
        const lastHosted = localStorage.getItem('mv_last_hosted_room');
        if (lastHosted) {
          this.detectedLocalRoom = lastHosted;
        }
      } catch {
        // ignore
      }
    }
  }

  ngOnDestroy(): void {
    this.localBroadcastListener?.close();
  }

  public selectCharacter(char: CharacterType): void {
    this.sound.playActionSelected();
    this.gameService.setCharacter(char);
  }

  public openCreateModal(): void {
    this.sound.playActionSelected();
    this.showCreateModal = true;
  }

  public openJoinModal(): void {
    this.sound.playActionSelected();
    this.showJoinModal = true;
  }

  public confirmCreate(): void {
    this.sound.playActionSelected();
    const settings: Partial<GameSettings> = {
      maxPlayers: this.maxPlayers,
      impostorCount: this.impostorCount
    };

    this.showCreateModal = false;
    this.createGame.emit(settings);
  }

  public confirmJoin(): void {
    const raw = this.inviteInput.trim();
    if (!raw) return;

    this.sound.playActionSelected();

    let code = raw;
    if (raw.includes('#')) {
      code = raw.split('#')[1];
    } else if (raw.includes('/play/')) {
      code = raw.split('/play/')[1];
    }

    const decoded = decodeSignal(code);
    if (!decoded || decoded.type !== 'offer') {
      this.joinError = 'Invalid invitation data. Please ensure you copied the complete invite string.';
      return;
    }

    this.showJoinModal = false;
    this.joinGame.emit(code);
  }

  public quickJoinLocal(): void {
    if (this.detectedLocalRoom) {
      const savedOffer = localStorage.getItem(`mv_offer_${this.detectedLocalRoom}`);
      if (savedOffer) {
        this.joinGame.emit(savedOffer);
      } else {
        this.showJoinModal = true;
      }
    }
  }
}
