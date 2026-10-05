import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Phaser from 'phaser';
import { MidnightVillageScene, ProximityState } from '../../phaser/midnight-village.scene';
import { PlayerGameState, ChatMessage, TaskDefinition, SabotageType } from '../../engine/types';
import { GameSession } from '../../session/game-session';
import { SoundService } from '../../services/sound.service';
import { TaskModalComponent } from '../task-modal/task-modal.component';
import { SabotageModalComponent } from '../sabotage-modal/sabotage-modal.component';
import { MeetingModalComponent } from '../meeting-modal/meeting-modal.component';

@Component({
  selector: 'app-game-screen',
  standalone: true,
  imports: [
    CommonModule,
    TaskModalComponent,
    SabotageModalComponent,
    MeetingModalComponent
  ],
  template: `
    <div class="game-screen-wrapper">
      
      <!-- Top HUD Bar -->
      <div class="top-hud glass-panel-elevated flex items-center justify-between px-6 py-2">
        
        <!-- Task Progress Meter (Duties Bar) -->
        <div class="task-meter-section flex items-center gap-3">
          <span class="hud-label font-title text-xs text-amber-400">Settlement Duties:</span>
          <div class="task-meter-track">
            <div class="task-meter-fill" [style.width.%]="gameState.taskProgressPercent"></div>
          </div>
          <span class="hud-val font-title text-xs text-white">
            {{ gameState.totalTasksCompleted }} / {{ gameState.totalTasksGoal }} ({{ gameState.taskProgressPercent }}%)
          </span>
        </div>

        <!-- Role Badge -->
        <div class="role-badge-section flex items-center gap-2">
          <div
            class="role-pill font-title flex items-center gap-1.5"
            [ngClass]="isMimic ? 'pill-impostor' : 'pill-villager'"
          >
            <span class="dot"></span>
            <span>{{ isMimic ? 'MIMIC' : 'RESIDENT' }}</span>
          </div>

          <div *ngIf="isMimic" class="kill-cd-pill font-title text-xs">
            Strike CD: {{ gameState.killCooldown > 0 ? gameState.killCooldown + 's' : 'READY' }}
          </div>
        </div>

      </div>

      <!-- Critical Sabotage Alert Banner -->
      <div *ngIf="gameState.sabotage.active" class="sabotage-banner animate-pulse flex items-center justify-between px-6 py-2">
        <div class="flex items-center gap-2 text-sm font-bold text-white">
          <span>⚠️</span>
          <span>
            CRITICAL:
            {{ gameState.sabotage.type === 'reactor' ? 'Reactor Meltdown in ' + gameState.sabotage.remainingSeconds + 's! Repair at Power Station!' : '' }}
            {{ gameState.sabotage.type === 'lights' ? 'Power Grid Sabotaged! Vision is obscured.' : '' }}
            {{ gameState.sabotage.type === 'comms' ? 'Communications jammed! Terminal arrays offline.' : '' }}
          </span>
        </div>
        <button (click)="fixSabotage()" class="btn-fix-sabotage">
          Repair Systems
        </button>
      </div>

      <!-- Left Objective Task List -->
      <div class="tasks-hud-overlay glass-panel p-3">
        <div class="hud-title font-title text-xs text-amber-300 pb-1 mb-2 border-b border-slate-700">
          Settlement Duties
        </div>
        <div class="flex flex-col gap-1.5">
          <div
            *ngFor="let t of gameState.myTasks"
            class="task-row text-xs flex items-center gap-2"
            [ngClass]="t.completed ? 'task-done' : 'task-pending'"
          >
            <span class="check-box">{{ t.completed ? '✓' : '○' }}</span>
            <div>
              <span class="task-room font-semibold">{{ t.room }}:</span>
              <span class="task-name ml-1">{{ t.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Phaser 2D Canvas Container -->
      <div #phaserContainer id="phaser-game-container" class="phaser-viewport"></div>

      <!-- Bottom-Right 2D Action Cluster -->
      <div class="action-cluster-hud flex items-center gap-3">
        
        <!-- USE / INTERACT BUTTON -->
        <button
          type="button"
          (click)="handleUseAction()"
          class="btn-hud-action btn-use"
          [disabled]="!proximity.nearTask && !proximity.nearEmergency"
          [ngClass]="(proximity.nearTask || proximity.nearEmergency) ? 'btn-active-glow' : ''"
        >
          <div class="hud-action-icon">⚡</div>
          <span class="hud-action-text font-title">USE [E]</span>
        </button>

        <!-- REPORT BUTTON -->
        <button
          type="button"
          (click)="handleReportAction()"
          class="btn-hud-action btn-report"
          [disabled]="!proximity.nearBody"
          [ngClass]="proximity.nearBody ? 'btn-report-active animate-bounce' : ''"
        >
          <div class="hud-action-icon">🚨</div>
          <span class="hud-action-text font-title">REPORT [R]</span>
        </button>

        <!-- KILL BUTTON (Mimic Only) -->
        <button
          *ngIf="isMimic"
          type="button"
          (click)="handleKillAction()"
          class="btn-hud-action btn-kill"
          [disabled]="!canKill"
          [ngClass]="canKill ? 'btn-kill-ready animate-pulse' : ''"
        >
          <div class="hud-action-icon">🗡️</div>
          <span class="hud-action-text font-title">
            {{ gameState.killCooldown > 0 ? gameState.killCooldown + 's' : 'STRIKE [Q]' }}
          </span>
        </button>

        <!-- SABOTAGE BUTTON (Mimic Only) -->
        <button
          *ngIf="isMimic"
          type="button"
          (click)="showSabotageModal = true"
          class="btn-hud-action btn-sabotage"
        >
          <div class="hud-action-icon">☢️</div>
          <span class="hud-action-text font-title">SABOTAGE</span>
        </button>

      </div>

      <!-- Active Task Mini-Game Modal -->
      <app-task-modal
        *ngIf="activeTaskModal"
        [task]="activeTaskModal"
        (complete)="onTaskCompleted($event)"
        (close)="activeTaskModal = null"
      ></app-task-modal>

      <!-- Impostor Sabotage Selection Modal -->
      <app-sabotage-modal
        *ngIf="showSabotageModal"
        (selectSabotage)="onTriggerSabotage($event)"
        (close)="showSabotageModal = false"
      ></app-sabotage-modal>

      <!-- Emergency Council Meeting & Voting Modal -->
      <app-meeting-modal
        *ngIf="gameState.phase === 'meeting' || gameState.phase === 'voting' || gameState.phase === 'ejection'"
        [gameState]="gameState"
        [chatMessages]="chatMessages"
        (vote)="onVote($event)"
        (sendChat)="onSendChat($event)"
      ></app-meeting-modal>

      <!-- Victory / Game Over Overlay -->
      <div *ngIf="gameState.phase === 'ended'" class="victory-overlay animate-fade-in flex items-center justify-center p-4">
        <div class="victory-card glass-panel-elevated max-w-lg w-full text-center p-8">
          <div class="victory-icon text-5xl mb-3">
            {{ gameState.winner === 'villagers' ? '🏆' : '💀' }}
          </div>

          <h2 class="font-title text-3xl font-extrabold mb-2" [ngClass]="gameState.winner === 'villagers' ? 'text-emerald-400' : 'text-red-400'">
            {{ gameState.winner === 'villagers' ? 'VILLAGERS VICTORIOUS' : 'IMPOSTORS OVERWHELMED VILLAGE' }}
          </h2>

          <p class="text-sm text-slate-300 mb-6">
            {{ gameState.winnerReason }}
          </p>

          <div class="actions flex justify-center gap-3">
            <button *ngIf="session.isHost" (click)="rematch.emit()" class="btn-rematch">
              Play Again
            </button>
            <button (click)="leaveGame.emit()" class="btn-leave">
              Leave to Lobby
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .game-screen-wrapper {
      position: relative;
      width: 100%;
      height: calc(100vh - 64px);
      overflow: hidden;
      background: #060911;
    }
    .top-hud {
      position: absolute;
      top: 0.75rem;
      left: 1rem;
      right: 1rem;
      z-index: 30;
      border-radius: 1rem;
      background: rgba(11, 15, 25, 0.88);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(51, 65, 85, 0.6);
    }
    .task-meter-track {
      width: 240px;
      height: 12px;
      background: #1e293b;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .task-meter-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      transition: width 0.3s;
    }
    .role-pill {
      font-size: 0.75rem;
      font-weight: 800;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      letter-spacing: 0.05em;
    }
    .pill-villager { background: rgba(59, 130, 246, 0.25); border: 1px solid #3b82f6; color: #93c5fd; }
    .pill-impostor { background: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; color: #fca5a5; }
    .role-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .kill-cd-pill {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: #f87171;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
    }
    .sabotage-banner {
      position: absolute;
      top: 4.25rem;
      left: 1rem;
      right: 1rem;
      z-index: 30;
      border-radius: 0.75rem;
      background: linear-gradient(90deg, rgba(185, 28, 28, 0.95), rgba(153, 27, 27, 0.95));
      border: 1px solid #ef4444;
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5);
    }
    .btn-fix-sabotage {
      padding: 0.35rem 0.85rem;
      background: white;
      color: #b91c1c;
      font-weight: 800;
      font-size: 0.75rem;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
    }
    .tasks-hud-overlay {
      position: absolute;
      top: 4.5rem;
      left: 1rem;
      z-index: 25;
      width: 220px;
      border-radius: 0.85rem;
      background: rgba(11, 15, 25, 0.85);
      border: 1px solid rgba(51, 65, 85, 0.6);
    }
    .task-pending { color: #f1f5f9; }
    .task-done { color: #10b981; text-decoration: line-through; opacity: 0.6; }
    .phaser-viewport {
      width: 100%;
      height: 100%;
    }
    .action-cluster-hud {
      position: absolute;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 35;
    }
    .btn-hud-action {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 1.25rem;
      border: 2px solid rgba(255, 255, 255, 0.2);
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      cursor: pointer;
      color: white;
      transition: all 0.2s;
    }
    .btn-hud-action:disabled { opacity: 0.35; cursor: not-allowed; }
    .hud-action-icon { font-size: 1.5rem; }
    .hud-action-text { font-size: 0.65rem; font-weight: 800; margin-top: 0.2rem; }
    .btn-use { border-color: rgba(234, 179, 8, 0.4); }
    .btn-active-glow {
      border-color: #eab308;
      background: rgba(113, 63, 18, 0.6);
      box-shadow: 0 0 20px rgba(234, 179, 8, 0.6);
      transform: scale(1.08);
    }
    .btn-report { border-color: rgba(239, 68, 68, 0.4); }
    .btn-report-active {
      border-color: #ef4444;
      background: rgba(153, 27, 27, 0.8);
      box-shadow: 0 0 25px rgba(239, 68, 68, 0.8);
    }
    .btn-kill { border-color: rgba(220, 38, 38, 0.4); }
    .btn-kill-ready {
      border-color: #dc2626;
      background: rgba(127, 29, 29, 0.8);
      box-shadow: 0 0 25px rgba(220, 38, 38, 0.8);
    }
    .btn-sabotage { border-color: rgba(147, 51, 234, 0.4); }
    .btn-sabotage:hover { background: rgba(88, 28, 135, 0.6); }
    .victory-overlay {
      position: fixed;
      inset: 0;
      z-index: 150;
      background: rgba(3, 7, 18, 0.92);
      backdrop-filter: blur(12px);
    }
    .victory-card {
      border-radius: 1.5rem;
      border: 1px solid rgba(99, 102, 241, 0.4);
      background: #090d18;
    }
    .btn-rematch {
      padding: 0.75rem 2rem;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: none;
      border-radius: 0.75rem;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-leave {
      padding: 0.75rem 2rem;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 0.75rem;
      color: #cbd5e1;
      font-weight: 700;
      cursor: pointer;
    }
  `]
})
export class GameScreenComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('phaserContainer', { static: true }) phaserContainerRef!: ElementRef<HTMLDivElement>;

  @Input() gameState!: PlayerGameState;
  @Input() chatMessages: ChatMessage[] = [];
  @Input() session!: GameSession;

  @Output() rematch = new EventEmitter<void>();
  @Output() leaveGame = new EventEmitter<void>();

  private phaserGame: Phaser.Game | null = null;
  private villageScene: MidnightVillageScene | null = null;

  public proximity: ProximityState = {
    nearTask: null,
    nearBody: null,
    nearEmergency: false,
    nearKillTarget: null
  };

  public activeTaskModal: TaskDefinition | null = null;
  public showSabotageModal = false;

  get isMimic(): boolean {
    return this.gameState?.myRole === 'impostor';
  }

  get canKill(): boolean {
    return (
      this.isMimic &&
      this.gameState.killCooldown <= 0 &&
      this.proximity.nearKillTarget !== null
    );
  }

  constructor(private sound: SoundService) {}

  ngOnInit(): void {
    // Keyboard shortcuts for E, R, Q
    window.addEventListener('keydown', this.handleKeyDown);
  }

  ngAfterViewInit(): void {
    this.initPhaserGame();
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.phaserGame) {
      this.phaserGame.destroy(true);
      this.phaserGame = null;
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.activeTaskModal || this.gameState.phase !== 'roaming') return;

    if (event.key === 'e' || event.key === 'E') {
      this.handleUseAction();
    } else if (event.key === 'r' || event.key === 'R') {
      this.handleReportAction();
    } else if (event.key === 'q' || event.key === 'Q') {
      this.handleKillAction();
    }
  };

  private initPhaserGame(): void {
    this.villageScene = new MidnightVillageScene();
    this.villageScene.gameState = this.gameState;

    this.villageScene.onMoveCallback = (x, y, vx, vy, facing, isMoving) => {
      this.session.sendMove(x, y, vx, vy, facing, isMoving);
    };

    this.villageScene.onProximityCallback = (prox) => {
      this.proximity = prox;
    };

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: this.phaserContainerRef.nativeElement,
      width: '100%',
      height: '100%',
      backgroundColor: '#070a13',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: [this.villageScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    this.phaserGame = new Phaser.Game(config);
  }

  ngOnChanges(): void {
    if (this.villageScene && this.gameState) {
      this.villageScene.syncGameState(this.gameState);
    }
  }

  public handleUseAction(): void {
    if (this.proximity.nearTask) {
      this.sound.playActionSelected();
      this.activeTaskModal = this.proximity.nearTask;
    } else if (this.proximity.nearEmergency) {
      this.sound.playNightResolved();
      this.session.sendCallEmergency();
    }
  }

  public handleReportAction(): void {
    if (this.proximity.nearBody) {
      this.sound.playNightResolved();
      this.session.sendReportBody(this.proximity.nearBody.id);
    }
  }

  public handleKillAction(): void {
    if (this.canKill && this.proximity.nearKillTarget) {
      this.sound.playVoteGavel();
      this.session.sendKill(this.proximity.nearKillTarget.id);
    }
  }

  public onTaskCompleted(taskId: string): void {
    this.session.sendCompleteTask(taskId);
  }

  public onTriggerSabotage(type: SabotageType): void {
    this.session.sendTriggerSabotage(type);
  }

  public fixSabotage(): void {
    this.sound.playActionSelected();
    this.session.sendFixSabotage();
  }

  public onVote(targetId: string | null): void {
    this.session.sendVote(targetId);
  }

  public onSendChat(text: string): void {
    this.session.sendChat(text);
  }
}
