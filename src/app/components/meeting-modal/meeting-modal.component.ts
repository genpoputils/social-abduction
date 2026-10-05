import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerGameState, SafePlayer, ChatMessage } from '../../engine/types';
import { SoundService } from '../../services/sound.service';

@Component({
  selector: 'app-meeting-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="meeting-overlay animate-fade-in">
      <div class="meeting-dialog glass-panel-elevated max-w-5xl w-full">
        
        <!-- Emergency Alert Banner -->
        <div class="alert-banner flex items-center justify-between" [ngClass]="isBodyReport ? 'banner-red' : 'banner-blue'">
          <div class="flex items-center gap-3">
            <span class="siren-icon text-2xl animate-pulse">{{ isBodyReport ? '🚨' : '🔔' }}</span>
            <div>
              <h2 class="font-title alert-title">
                {{ isBodyReport ? 'DEAD BODY REPORTED' : 'EMERGENCY COUNCIL MEETING' }}
              </h2>
              <p class="alert-sub">
                Called by <strong>{{ meetingCaller }}</strong>
                <span *ngIf="meetingVictim">• Victim: <span class="text-red-400 font-bold">{{ meetingVictim }}</span></span>
              </p>
            </div>
          </div>

          <!-- Phase & Countdown -->
          <div class="timer-box flex items-center gap-2">
            <div class="text-right">
              <div class="phase-label text-xs uppercase text-slate-400">
                {{ gameState.phase === 'meeting' ? 'Discussion' : (gameState.phase === 'voting' ? 'Voting' : 'Council Decision') }}
              </div>
              <div class="countdown-val font-title text-xl text-amber-400">
                00:{{ gameState.phaseRemainingSeconds < 10 ? '0' : '' }}{{ gameState.phaseRemainingSeconds }}
              </div>
            </div>
          </div>
        </div>

        <!-- Ejection Sequence Overlay -->
        <div *ngIf="gameState.phase === 'ejection' && gameState.ejectionResult" class="ejection-screen text-center py-10 animate-fade-in">
          <div class="ejection-card max-w-md mx-auto p-6 rounded-2xl bg-slate-900/90 border border-slate-700">
            <div class="text-4xl mb-3">
              {{ gameState.ejectionResult.ejectedId ? '🚪' : (gameState.ejectionResult.isTie ? '⚖️' : '⏭️') }}
            </div>
            
            <h3 class="font-title text-2xl text-white mb-2">
              <span *ngIf="gameState.ejectionResult.ejectedName">
                {{ gameState.ejectionResult.ejectedName }} was ejected.
              </span>
              <span *ngIf="gameState.ejectionResult.isTie">
                Council vote tied.
              </span>
              <span *ngIf="gameState.ejectionResult.isSkipped && !gameState.ejectionResult.isTie">
                Council skipped the vote.
              </span>
            </h3>

            <p class="text-sm font-semibold mb-4" [ngClass]="gameState.ejectionResult.ejectedRole === 'impostor' ? 'text-red-400' : 'text-slate-400'">
              <span *ngIf="gameState.ejectionResult.ejectedRole === 'impostor'">
                They were an Impostor!
              </span>
              <span *ngIf="gameState.ejectionResult.ejectedRole === 'villager'">
                They were not an Impostor.
              </span>
              <span *ngIf="!gameState.ejectionResult.ejectedName">
                No one was ejected from the settlement.
              </span>
            </p>

            <div class="remaining-tag text-xs text-amber-300 font-title bg-amber-950/40 border border-amber-500/30 py-1 px-3 rounded-full inline-block">
              {{ gameState.ejectionResult.remainingImpostors }} Impostor{{ gameState.ejectionResult.remainingImpostors === 1 ? '' : 's' }} remain.
            </div>
          </div>
        </div>

        <!-- Main Meeting Layout (Council Seats + Discussion Chat) -->
        <div *ngIf="gameState.phase !== 'ejection'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 my-4">
          
          <!-- Council Seats & Voting -->
          <div class="lg:col-span-2 council-panel p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div class="panel-head flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <span class="font-title text-sm text-slate-300">Council Roster</span>
              <span class="text-xs text-slate-400">
                {{ gameState.phase === 'voting' ? 'Select a suspect to vote or Skip' : 'Discuss before voting begins' }}
              </span>
            </div>

            <!-- Players Grid -->
            <div class="grid grid-cols-2 gap-3">
              <div
                *ngFor="let p of gameState.players"
                class="council-seat p-3 rounded-xl flex items-center justify-between transition-all"
                [ngClass]="[
                  p.isAlive ? 'seat-alive' : 'seat-dead',
                  p.id === gameState.myPlayerId ? 'seat-me' : '',
                  hasVotedFor(p.id) ? 'seat-voted' : ''
                ]"
              >
                <div class="flex items-center gap-3">
                  <!-- Color circle & avatar -->
                  <div class="char-dot" [style.background]="p.color">
                    <span *ngIf="!p.isAlive" class="ghost-icon">👻</span>
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-sm text-white">{{ p.name }}</span>
                      <span *ngIf="p.id === gameState.myPlayerId" class="tag-you">YOU</span>
                      <span *ngIf="p.id === meetingCallerId" class="tag-caller">CALLER</span>
                    </div>
                    <div class="text-xs" [ngClass]="p.isAlive ? 'text-emerald-400' : 'text-slate-500'">
                      {{ p.isAlive ? (p.hasVoted ? '✓ Voted' : 'Voting...') : 'Deceased' }}
                    </div>
                  </div>
                </div>

                <!-- Vote Button (Enabled during Voting phase for living players) -->
                <div *ngIf="gameState.phase === 'voting' && isMyPlayerAlive && p.isAlive">
                  <button
                    (click)="castVote(p.id)"
                    class="btn-vote"
                    [disabled]="myVotedTarget !== undefined"
                    [ngClass]="myVotedTarget === p.id ? 'btn-vote-selected' : ''"
                  >
                    {{ myVotedTarget === p.id ? 'VOTED' : 'VOTE' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Skip Vote Bar -->
            <div *ngIf="gameState.phase === 'voting' && isMyPlayerAlive" class="skip-bar mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span class="text-xs text-slate-400">Not enough evidence? Abstain from Council action:</span>
              <button
                (click)="castVote(null)"
                class="btn-skip"
                [disabled]="myVotedTarget !== undefined"
                [ngClass]="myVotedTarget === null ? 'btn-skip-selected' : ''"
              >
                {{ myVotedTarget === null ? '✓ SKIPPED' : 'SKIP VOTE' }}
              </button>
            </div>
          </div>

          <!-- Discussion Chat Panel -->
          <div class="chat-panel p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col h-[400px]">
            <div class="font-title text-sm text-slate-300 pb-2 mb-2 border-b border-slate-800">
              Council Whispers
            </div>

            <!-- Message Stream -->
            <div class="chat-stream flex-1 overflow-y-auto flex flex-col gap-2 py-2">
              <div *ngFor="let msg of chatMessages" class="chat-msg text-xs">
                <span class="font-bold text-indigo-400">{{ msg.senderName }}:</span>
                <span class="text-slate-200 ml-1">{{ msg.text }}</span>
              </div>
            </div>

            <!-- Quick Chat Chips -->
            <div class="quick-chips flex flex-wrap gap-1 py-2">
              <button *ngFor="let chip of quickChips" (click)="sendQuickChat(chip)" class="chip-btn">
                {{ chip }}
              </button>
            </div>

            <!-- Input Box -->
            <form (ngSubmit)="sendChatMsg()" class="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                [(ngModel)]="chatText"
                name="chatText"
                placeholder="State your alibi or evidence..."
                class="chat-input flex-1"
                maxlength="200"
              />
              <button type="submit" [disabled]="!chatText.trim()" class="btn-send">
                Send
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  `,
  styles: [`
    .meeting-overlay {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: rgba(3, 7, 18, 0.88);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .meeting-dialog {
      border-radius: 1.5rem;
      padding: 1.5rem;
      background: #080c16;
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #f8fafc;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9);
    }
    .alert-banner {
      padding: 1rem 1.5rem;
      border-radius: 1rem;
      margin-bottom: 1rem;
    }
    .banner-red {
      background: linear-gradient(135deg, rgba(153, 27, 27, 0.6), rgba(127, 29, 29, 0.8));
      border: 1px solid rgba(239, 68, 68, 0.6);
    }
    .banner-blue {
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.6), rgba(30, 27, 75, 0.8));
      border: 1px solid rgba(99, 102, 241, 0.6);
    }
    .alert-title { font-size: 1.25rem; font-weight: 800; color: white; letter-spacing: 0.03em; }
    .alert-sub { font-size: 0.8rem; color: #cbd5e1; margin-top: 0.2rem; }
    .council-seat {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.5);
    }
    .seat-me { border-color: rgba(99, 102, 241, 0.8); background: rgba(30, 27, 75, 0.6); }
    .seat-dead { opacity: 0.45; filter: grayscale(0.6); }
    .char-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    .ghost-icon { font-size: 0.9rem; }
    .tag-you {
      font-size: 0.65rem;
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      background: #4f46e5;
      color: white;
      font-weight: 700;
    }
    .tag-caller {
      font-size: 0.65rem;
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      background: #dc2626;
      color: white;
      font-weight: 700;
    }
    .btn-vote {
      padding: 0.35rem 0.85rem;
      background: #dc2626;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-size: 0.75rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-vote:hover { background: #b91c1c; transform: scale(1.05); }
    .btn-vote-selected { background: #16a34a !important; }
    .btn-skip {
      padding: 0.45rem 1.25rem;
      background: #334155;
      border: 1px solid #64748b;
      border-radius: 0.5rem;
      color: #cbd5e1;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-skip-selected { background: #059669; border-color: #10b981; color: white; }
    .chip-btn {
      font-size: 0.65rem;
      padding: 0.25rem 0.5rem;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.4rem;
      color: #94a3b8;
      cursor: pointer;
    }
    .chip-btn:hover { background: #334155; color: white; }
    .chat-input {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 0.4rem 0.75rem;
      color: white;
      font-size: 0.75rem;
      outline: none;
    }
    .btn-send {
      padding: 0.4rem 0.85rem;
      background: #4f46e5;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }
  `]
})
export class MeetingModalComponent implements OnInit {
  @Input() gameState!: PlayerGameState;
  @Input() chatMessages: ChatMessage[] = [];
  @Output() vote = new EventEmitter<string | null>();
  @Output() sendChat = new EventEmitter<string>();

  public myVotedTarget: string | null | undefined = undefined;
  public chatText = '';

  public quickChips = [
    'Where?',
    'I was in Laboratory',
    'I was doing Power wiring',
    'Saw someone near body',
    'I was with someone else',
    'Skip vote this round'
  ];

  get isBodyReport(): boolean {
    return this.gameState.meetingInfo?.reason === 'body_report';
  }

  get meetingCaller(): string {
    return this.gameState.meetingInfo?.callerName || 'Unknown';
  }

  get meetingCallerId(): string {
    return this.gameState.meetingInfo?.callerId || '';
  }

  get meetingVictim(): string | undefined {
    return this.gameState.meetingInfo?.victimName;
  }

  get isMyPlayerAlive(): boolean {
    const me = this.gameState.players.find(p => p.id === this.gameState.myPlayerId);
    return me?.isAlive ?? true;
  }

  constructor(private sound: SoundService) {}

  ngOnInit(): void {
    this.sound.playNightResolved();
  }

  public castVote(targetId: string | null): void {
    if (this.myVotedTarget !== undefined) return;
    this.myVotedTarget = targetId;
    this.sound.playActionSelected();
    this.vote.emit(targetId);
  }

  public hasVotedFor(_playerId: string): boolean {
    return false;
  }

  public sendQuickChat(chip: string): void {
    this.sendChat.emit(chip);
  }

  public sendChatMsg(): void {
    if (this.chatText.trim()) {
      this.sendChat.emit(this.chatText.trim());
      this.chatText = '';
    }
  }
}
