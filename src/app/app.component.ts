import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameService } from './services/game.service';
import { PlayerGameState, ChatMessage, GameSettings } from './engine/types';
import { GameSession } from './session/game-session';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HomeComponent } from './components/home/home.component';
import { LobbyComponent } from './components/lobby/lobby.component';
import { GameScreenComponent } from './components/game-screen/game-screen.component';
import { RulesModalComponent } from './components/rules-modal/rules-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    HomeComponent,
    LobbyComponent,
    GameScreenComponent,
    RulesModalComponent
  ],
  template: `
    <div class="app-root flex flex-col justify-between min-h-screen">
      
      <!-- Navbar -->
      <app-navbar
        [playerName]="gameService.playerName"
        [inGame]="inGame"
        [isHost]="gameService.isHost"
        (nameChange)="onNameChange($event)"
        (openRules)="showRulesModal = true"
        (leaveGame)="onLeaveGame()"
      ></app-navbar>

      <!-- Main Body -->
      <main class="flex-1">
        
        <!-- Home Landing View (Not in game) -->
        <app-home
          *ngIf="!inGame"
          (createGame)="handleCreateGame($event)"
          (joinGame)="handleJoinGame($event)"
        ></app-home>

        <!-- Lobby Chamber View (In game, lobby phase) -->
        <app-lobby
          *ngIf="inGame && gameState?.phase === 'lobby'"
          [gameState]="gameState!"
          [chatMessages]="chatMessages"
          [session]="currentSession!"
          (startGame)="handleStartGame()"
          (sendChat)="handleSendChat($event)"
          (openRules)="showRulesModal = true"
        ></app-lobby>

        <!-- Active 2D Game Screen (Roaming, Meeting, Voting, Ejection, Ended) -->
        <app-game-screen
          *ngIf="inGame && gameState?.phase !== 'lobby'"
          [gameState]="gameState!"
          [chatMessages]="chatMessages"
          [session]="currentSession!"
          (rematch)="handleRematch()"
          (leaveGame)="onLeaveGame()"
        ></app-game-screen>

      </main>

      <!-- Rules & Roles Modal -->
      <app-rules-modal
        [isOpen]="showRulesModal"
        (close)="showRulesModal = false"
      ></app-rules-modal>

      <!-- Footer (Only shown on home and in lobby) -->
      <footer class="app-footer text-center" *ngIf="!inGame || gameState?.phase === 'lobby'">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3">
          <div>
            <strong class="text-white">GENPOPUTILS PLAY</strong> • Midnight Village Research Settlement
          </div>
          <div class="footer-pills flex items-center gap-3">
            <span>Phaser 2D World</span>
            <span>•</span>
            <span>Browser-to-Browser WebRTC</span>
            <span>•</span>
            <span>$0 Infrastructure</span>
            <span>•</span>
            <span>play.genpoputils.com</span>
          </div>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    .app-root {
      background: #070a13;
      color: #f8fafc;
      min-height: 100vh;
    }
    .app-footer {
      border-top: 1px solid rgba(51, 65, 85, 0.6);
      background: rgba(12, 17, 32, 0.9);
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .footer-pills { font-size: 0.7rem; color: #64748b; }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  public gameState: PlayerGameState | null = null;
  public chatMessages: ChatMessage[] = [];
  public currentSession: GameSession | null = null;
  public showRulesModal = false;

  private sessionSub: Subscription | null = null;
  private stateSub: Subscription | null = null;
  private chatSub: Subscription | null = null;

  get inGame(): boolean {
    return this.currentSession !== null && this.gameState !== null;
  }

  constructor(public gameService: GameService) {}

  ngOnInit(): void {
    this.sessionSub = this.gameService.session$.subscribe((session) => {
      this.currentSession = session;
      this.stateSub?.unsubscribe();
      this.chatSub?.unsubscribe();

      if (session) {
        this.stateSub = session.state$.subscribe((state) => {
          this.gameState = state;
        });
        this.chatSub = session.chat$.subscribe((msgs) => {
          this.chatMessages = msgs;
        });
      } else {
        this.gameState = null;
        this.chatMessages = [];
      }
    });

    this.checkUrlForInvite();
  }

  ngOnDestroy(): void {
    this.sessionSub?.unsubscribe();
    this.stateSub?.unsubscribe();
    this.chatSub?.unsubscribe();
  }

  private checkUrlForInvite(): void {
    const hash = window.location.hash;
    if (hash && hash.includes('invite=')) {
      const inviteCode = hash.split('invite=')[1];
      if (inviteCode) {
        this.handleJoinGame(inviteCode);
      }
    }
  }

  public onNameChange(name: string): void {
    this.gameService.setPlayerName(name);
  }

  public handleCreateGame(settings?: Partial<GameSettings>): void {
    this.gameService.createGame(settings);
  }

  public async handleJoinGame(encodedOffer: string): Promise<void> {
    try {
      await this.gameService.joinGame(encodedOffer);
    } catch (err: any) {
      alert(err.message || 'Failed to connect using invitation');
    }
  }

  public handleStartGame(): void {
    this.currentSession?.startGame();
  }

  public handleSendChat(text: string): void {
    this.currentSession?.sendChat(text);
  }

  public handleRematch(): void {
    this.currentSession?.rematch();
  }

  public onLeaveGame(): void {
    this.gameService.leaveGame();
    window.location.hash = '';
  }
}
