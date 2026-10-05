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
    <div class="home-wrapper max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      
      <!-- Hero Header -->
      <header class="hero-section text-center flex flex-col items-center">
        
        <!-- Status Pill -->
        <div class="status-pill flex items-center gap-2 mb-3">
          <span class="pulse-indicator"></span>
          <span class="font-mono text-xs font-semibold tracking-wider text-amber-400">
            GENPOPUTILS PLAY // RESEARCH SETTLEMENT
          </span>
        </div>

        <!-- Title -->
        <h1 class="hero-title">
          MIDNIGHT VILLAGE
        </h1>
        
        <div class="tagline-wrap my-2">
          <span class="font-mono text-sm tracking-widest text-amber-400 font-bold uppercase">
            [ TRUST NO ONE AFTER MIDNIGHT ]
          </span>
        </div>

        <p class="hero-desc text-slate-300 max-w-2xl mx-auto mt-2 leading-relaxed text-sm">
          A top-down 2D browser multiplayer social deduction experience.
          Explore the isolated research settlement, complete critical facility duties,
          expose hidden Mimics among the Residents, and gather at the Central Plaza when the bell tolls.
        </p>

        <!-- Feature Tags -->
        <div class="feature-tags flex flex-wrap justify-center gap-2 mt-4">
          <span class="tag-chip">🏰 Top-Down 2D World</span>
          <span class="tag-chip">⚡ WebRTC Peer-to-Peer</span>
          <span class="tag-chip">👥 Residents vs Mimics</span>
          <span class="tag-chip">🔒 Zero Server Storage</span>
          <span class="tag-chip">🆓 $0 Free to Play</span>
        </div>

      </header>

      <!-- Quick Action Bar -->
      <section class="action-card glass-panel-elevated p-6 max-w-2xl mx-auto w-full">
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <button (click)="openCreateModal()" class="btn-cyber-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>CREATE EXPEDITION</span>
          </button>

          <button (click)="openJoinModal()" class="btn-cyber-secondary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3" />
            </svg>
            <span>JOIN EXPEDITION</span>
          </button>

        </div>

        <!-- Local Tab Quick Join Notification -->
        <div *ngIf="detectedLocalRoom" class="local-detection-banner animate-fade-in mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-amber-500/40">
          <div class="flex items-center gap-2.5 text-xs text-slate-200">
            <span class="pulse-indicator"></span>
            <span>Settlement room <strong class="text-amber-400 font-mono">#{{ detectedLocalRoom }}</strong> detected in another tab!</span>
          </div>
          <button (click)="quickJoinLocal()" class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs font-title transition-all">
            Quick Join
          </button>
        </div>

      </section>

      <!-- Character Archetype Selector Section (8 Illustrated Cards) -->
      <section class="archetype-selection-card glass-panel-elevated p-6">
        
        <div class="section-head flex items-center justify-between pb-3 mb-4 border-b border-slate-700/60">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">01. RESIDENT SPECIALIZATION</span>
            <span class="text-slate-500">•</span>
            <span class="text-xs text-slate-400">Choose your expedition archetype</span>
          </div>
          <span class="selected-badge font-mono text-xs text-amber-300 font-bold px-3 py-1 rounded bg-amber-950/60 border border-amber-500/40">
            Selected: {{ currentArchetype.name }}
          </span>
        </div>

        <!-- 8-Card Responsive Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <button
            *ngFor="let char of characters"
            type="button"
            (click)="selectCharacter(char.id)"
            class="archetype-card flex flex-col items-center p-3 rounded-xl transition-all"
            [ngClass]="gameService.character === char.id ? 'archetype-card-active' : 'archetype-card-idle'"
            [style.borderColor]="gameService.character === char.id ? char.color : 'rgba(51, 65, 85, 0.4)'"
          >
            <!-- Stylized Human Illustrated Avatar -->
            <div class="avatar-preview-box mb-2" [style.background]="char.color + '22'" [style.borderColor]="char.color + '55'">
              <div class="avatar-head">
                <div class="avatar-hat" [style.background]="char.accentColor"></div>
                <div class="avatar-face"></div>
              </div>
              <div class="avatar-body" [style.background]="char.color">
                <div class="avatar-lantern"></div>
              </div>
            </div>

            <span class="archetype-name font-title text-xs text-white mb-0.5 text-center">{{ char.name }}</span>
            <span class="archetype-role-tag font-mono text-[9px] text-slate-400 text-center line-clamp-1">{{ char.roleHint }}</span>
          </button>
        </div>

        <!-- Active Archetype Inspection Bar -->
        <div class="archetype-detail-footer mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="font-bold text-amber-400">{{ currentArchetype.name }}:</span>
            <span>{{ currentArchetype.description }}</span>
          </div>
          <span class="font-mono text-slate-400">
            Uniform: <strong [style.color]="currentArchetype.color">{{ currentArchetype.color }}</strong>
          </span>
        </div>

      </section>

      <!-- Create Expedition Modal -->
      <div *ngIf="showCreateModal" class="modal-overlay animate-fade-in" (click)="showCreateModal = false">
        <div class="modal-dialog glass-panel-elevated max-w-md" (click)="$event.stopPropagation()">
          
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/60">
            <h3 class="font-title text-xl text-white">Create Settlement Chamber</h3>
            <button (click)="showCreateModal = false" class="text-slate-400 hover:text-white text-lg">✕</button>
          </div>

          <form (ngSubmit)="confirmCreate()" class="flex flex-col gap-4">
            
            <div>
              <label class="form-label text-xs font-bold text-slate-300 font-mono uppercase mb-2 block">
                Expedition Crew Limit (5–10 Residents)
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  *ngFor="let count of [5, 6, 7, 8, 10]"
                  (click)="maxPlayers = count"
                  class="btn-option flex-1 py-2 rounded-lg font-title text-sm transition-all"
                  [ngClass]="maxPlayers === count ? 'btn-option-active' : 'btn-option-idle'"
                >
                  {{ count }}
                </button>
              </div>
            </div>

            <div>
              <label class="form-label text-xs font-bold text-slate-300 font-mono uppercase mb-2 block">
                Hidden Mimics
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  *ngFor="let count of [1, 2]"
                  (click)="impostorCount = count"
                  class="btn-option flex-1 py-2 rounded-lg font-title text-sm transition-all"
                  [ngClass]="impostorCount === count ? 'btn-option-active' : 'btn-option-idle'"
                >
                  {{ count }} Mimic{{ count > 1 ? 's' : '' }}
                </button>
              </div>
            </div>

            <div class="flex gap-2 pt-3 border-t border-slate-700/60 mt-2">
              <button type="button" (click)="showCreateModal = false" class="btn-cyber-secondary flex-1 py-2.5 text-xs">
                Cancel
              </button>
              <button type="submit" class="btn-cyber-primary flex-1 py-2.5 text-xs">
                Launch Chamber
              </button>
            </div>

          </form>
        </div>
      </div>

      <!-- Join Expedition Modal -->
      <div *ngIf="showJoinModal" class="modal-overlay animate-fade-in" (click)="showJoinModal = false">
        <div class="modal-dialog glass-panel-elevated max-w-md" (click)="$event.stopPropagation()">
          
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/60">
            <h3 class="font-title text-xl text-white">Join Settlement Chamber</h3>
            <button (click)="showJoinModal = false" class="text-slate-400 hover:text-white text-lg">✕</button>
          </div>

          <form (ngSubmit)="confirmJoin()" class="flex flex-col gap-3">
            
            <div>
              <label class="form-label text-xs font-bold text-slate-300 font-mono uppercase mb-1.5 block">
                Invitation Code or URL
              </label>
              <textarea
                [(ngModel)]="inviteInput"
                name="inviteInput"
                rows="4"
                placeholder="Paste the settlement invitation code provided by the host..."
                class="invite-textarea w-full p-3 rounded-xl bg-slate-950/80 border border-slate-700 text-xs font-mono text-amber-300 outline-none"
                required
              ></textarea>
            </div>

            <div *ngIf="joinError" class="text-xs text-rose-400 font-semibold">
              {{ joinError }}
            </div>

            <div class="flex gap-2 pt-3 border-t border-slate-700/60 mt-2">
              <button type="button" (click)="showJoinModal = false" class="btn-cyber-secondary flex-1 py-2.5 text-xs">
                Cancel
              </button>
              <button type="submit" [disabled]="!inviteInput.trim()" class="btn-cyber-primary flex-1 py-2.5 text-xs">
                Connect to Settlement
              </button>
            </div>

          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .hero-title {
      font-size: clamp(2.2rem, 5vw, 3.6rem);
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #ffffff;
      text-shadow: 0 4px 25px rgba(245, 158, 11, 0.35);
    }
    .status-pill {
      padding: 0.35rem 0.9rem;
      border-radius: 9999px;
      background: rgba(30, 20, 10, 0.7);
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .pulse-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 10px #f59e0b;
    }
    .tag-chip {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.6);
      color: #94a3b8;
    }
    .archetype-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid;
      cursor: pointer;
    }
    .archetype-card:hover {
      background: rgba(30, 41, 69, 0.6);
      transform: translateY(-2px);
    }
    .archetype-card-active {
      background: rgba(30, 20, 10, 0.7);
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.35);
      transform: translateY(-2px);
    }
    .avatar-preview-box {
      width: 46px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px solid;
      position: relative;
    }
    .avatar-head {
      width: 16px;
      height: 14px;
      position: relative;
    }
    .avatar-hat {
      width: 18px;
      height: 6px;
      border-radius: 3px 3px 0 0;
      position: absolute;
      top: -2px;
      left: -1px;
    }
    .avatar-face {
      width: 14px;
      height: 10px;
      background: #fed7aa;
      border-radius: 3px;
      margin: 2px auto 0 auto;
    }
    .avatar-body {
      width: 22px;
      height: 18px;
      border-radius: 4px;
      position: relative;
      margin-top: 1px;
    }
    .avatar-lantern {
      width: 6px;
      height: 8px;
      background: #fef08a;
      border: 1px solid #78350f;
      border-radius: 2px;
      position: absolute;
      right: -3px;
      top: 4px;
      box-shadow: 0 0 6px #fef08a;
    }
    .btn-option {
      background: #0f172a;
      border: 1px solid #334155;
      color: #cbd5e1;
      cursor: pointer;
    }
    .btn-option-active {
      background: #f59e0b;
      border-color: #fbbf24;
      color: #060911;
      font-weight: 800;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(3, 7, 18, 0.88);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-dialog {
      width: 100%;
      border-radius: 1.5rem;
      padding: 1.75rem;
      background: #0b0f19;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
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
