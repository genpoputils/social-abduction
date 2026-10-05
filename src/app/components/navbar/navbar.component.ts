import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoundService } from '../../services/sound.service';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <header class="navbar glass-panel">
      <div class="nav-content max-w-7xl mx-auto flex items-center justify-between">
        
        <!-- Brand -->
        <div class="brand flex items-center gap-3">
          <div class="brand-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fef08a" stroke="currentColor" stroke-width="1.5">
              <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-1">
              <span class="brand-sub">GenPopUtils Play</span>
              <span class="p2p-badge">P2P WebRTC</span>
            </div>
            <h1 class="brand-title">MIDNIGHT VILLAGE</h1>
          </div>
        </div>

        <!-- Right Controls -->
        <div class="controls flex items-center gap-3">
          
          <!-- P2P Status Indicator -->
          <div class="status-pill" [title]="inGame ? (isHost ? 'Authoritative P2P Host' : 'Connected to Host') : 'Browser Runtime'">
            <span class="status-dot" [ngClass]="inGame ? 'dot-active' : 'dot-idle'"></span>
            <span class="status-text">
              {{ inGame ? (isHost ? 'HOST' : 'PEER') : 'OFFLINE' }}
            </span>
          </div>

          <!-- Anonymous Display Name Editor -->
          <div class="name-editor">
            <div *ngIf="!isEditing" (click)="startEdit()" class="name-pill" title="Click to change your anonymous identity">
              <app-avatar [name]="playerName" size="sm"></app-avatar>
              <span class="name-text">{{ playerName }}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>

            <form *ngIf="isEditing" (ngSubmit)="saveName()" class="name-form">
              <input
                type="text"
                [(ngModel)]="tempName"
                name="tempName"
                maxlength="20"
                class="name-input"
                autofocus
              />
              <button type="submit" class="btn-icon text-emerald" title="Save">✓</button>
              <button type="button" (click)="isEditing = false" class="btn-icon" title="Cancel">✕</button>
            </form>
          </div>

          <!-- Sound Mute Toggle -->
          <button (click)="toggleSound()" class="btn-tool" [title]="sound.isMuted ? 'Unmute Sound' : 'Mute Sound'">
            <svg *ngIf="!sound.isMuted" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14 M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <svg *ngIf="sound.isMuted" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </button>

          <!-- Rules Modal Button -->
          <button (click)="openRules.emit()" class="btn-tool" title="Game Rules & Roles">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01" />
            </svg>
          </button>

          <!-- Leave Button -->
          <button *ngIf="inGame" (click)="leaveGame.emit()" class="btn-leave" title="Leave Game Room">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />
            </svg>
            <span>Exit</span>
          </button>

        </div>
      </div>
    </header>
  `,
  styles: [`
    .navbar {
      width: 100%;
      border-bottom: 1px solid rgba(99, 102, 241, 0.2);
      position: sticky;
      top: 0;
      z-index: 40;
      padding: 0.75rem 1rem;
    }
    .brand-icon {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, #4338ca, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    .brand-sub {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #818cf8;
    }
    .p2p-badge {
      font-size: 0.55rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0.1rem 0.35rem;
      background: rgba(49, 46, 129, 0.8);
      color: #c7d2fe;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 0.25rem;
    }
    .brand-title {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      line-height: 1;
      color: #f8fafc;
    }
    .status-pill {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.65rem;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(51, 65, 85, 0.6);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 9999px;
    }
    .dot-active {
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
    }
    .dot-idle {
      background: #94a3b8;
    }
    .name-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.65rem;
      background: rgba(17, 24, 44, 0.8);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.75rem;
      color: #e2e8f0;
      transition: all 0.2s;
    }
    .name-pill:hover {
      border-color: rgba(99, 102, 241, 0.8);
    }
    .name-text {
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .name-form {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: #0f172a;
      border: 1px solid #6366f1;
      border-radius: 0.5rem;
      padding: 0.15rem 0.4rem;
    }
    .name-input {
      background: transparent;
      border: none;
      outline: none;
      color: white;
      font-size: 0.75rem;
      width: 90px;
    }
    .btn-icon {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 0.75rem;
      color: #94a3b8;
      padding: 0.1rem;
    }
    .btn-icon:hover { color: white; }
    .text-emerald { color: #34d399; }
    .btn-tool {
      padding: 0.45rem;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(51, 65, 85, 0.6);
      border-radius: 0.5rem;
      color: #cbd5e1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .btn-tool:hover {
      border-color: #64748b;
      color: white;
    }
    .btn-leave {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.35rem 0.65rem;
      border-radius: 0.5rem;
      background: rgba(69, 10, 10, 0.6);
      border: 1px solid rgba(185, 28, 28, 0.6);
      color: #fca5a5;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-leave:hover {
      background: rgba(127, 29, 29, 0.8);
      color: white;
    }
  `]
})
export class NavbarComponent {
  @Input() playerName: string = '';
  @Input() inGame: boolean = false;
  @Input() isHost: boolean = false;

  @Output() nameChange = new EventEmitter<string>();
  @Output() openRules = new EventEmitter<void>();
  @Output() leaveGame = new EventEmitter<void>();

  public isEditing: boolean = false;
  public tempName: string = '';

  constructor(public sound: SoundService) {}

  public startEdit(): void {
    this.tempName = this.playerName;
    this.isEditing = true;
  }

  public saveName(): void {
    if (this.tempName.trim()) {
      this.nameChange.emit(this.tempName.trim());
      this.isEditing = false;
    }
  }

  public toggleSound(): void {
    this.sound.toggleMute();
  }
}
