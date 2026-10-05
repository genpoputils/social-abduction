import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskDefinition } from '../../engine/types';
import { SoundService } from '../../services/sound.service';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="task-overlay animate-fade-in" (click)="close.emit()">
      <div class="task-dialog glass-panel-elevated" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="task-head flex items-center justify-between">
          <div>
            <div class="room-tag">{{ task.room }}</div>
            <h3 class="task-title font-title">{{ task.name }}</h3>
          </div>
          <button (click)="close.emit()" class="btn-close">✕</button>
        </div>

        <div class="task-body">
          
          <!-- 1. WIRING TASK -->
          <div *ngIf="task.type === 'wiring'" class="wiring-game">
            <p class="instruction">Connect matching terminal wires from left to right:</p>
            <div class="wire-board grid grid-cols-2 gap-8 py-4">
              
              <!-- Left Terminals -->
              <div class="terminals-col flex flex-col gap-3">
                <button
                  *ngFor="let wire of leftWires"
                  (click)="selectLeftWire(wire)"
                  class="wire-node"
                  [ngStyle]="{ 'background': wire.color, 'border-color': selectedWire === wire ? '#ffffff' : wire.color }"
                  [ngClass]="wire.connected ? 'wire-connected' : (selectedWire === wire ? 'wire-active' : '')"
                >
                  <span class="wire-label">{{ wire.name }}</span>
                  <span *ngIf="wire.connected" class="check">✓</span>
                </button>
              </div>

              <!-- Right Ports -->
              <div class="terminals-col flex flex-col gap-3">
                <button
                  *ngFor="let wire of rightWires"
                  (click)="connectToRightWire(wire)"
                  class="wire-node"
                  [ngStyle]="{ 'background': wire.color }"
                  [ngClass]="wire.connected ? 'wire-connected' : ''"
                >
                  <span *ngIf="wire.connected" class="check">✓</span>
                  <span class="wire-label">{{ wire.name }}</span>
                </button>
              </div>

            </div>
          </div>

          <!-- 2. DIVERT POWER BREAKERS -->
          <div *ngIf="task.type === 'divert_power'" class="breaker-game">
            <p class="instruction">Flip all 4 auxiliary grid breakers to the UP position:</p>
            <div class="breakers-row flex justify-center gap-6 py-6">
              <div *ngFor="let b of breakers; let i = index" class="breaker-slot flex flex-col items-center gap-2">
                <span class="breaker-tag">AUX-0{{ i + 1 }}</span>
                <button
                  type="button"
                  (click)="toggleBreaker(i)"
                  class="breaker-switch"
                  [ngClass]="b ? 'breaker-up' : 'breaker-down'"
                >
                  <div class="switch-handle"></div>
                </button>
                <span class="status-indicator" [ngClass]="b ? 'text-green' : 'text-red'">
                  {{ b ? 'ONLINE' : 'OFF' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 3. SAMPLE SCAN -->
          <div *ngIf="task.type === 'sample_scan'" class="sample-game text-center py-4">
            <p class="instruction">Initiate biological centrifuge and extract the anomalous culture:</p>
            
            <div *ngIf="!scanComplete" class="scan-progress-area my-6">
              <div class="scan-spinner animate-spin"></div>
              <div class="scan-bar mt-4">
                <div class="scan-fill" [style.width.%]="scanProgress"></div>
              </div>
              <p class="scan-text mt-2">Centrifuge Analyzing... {{ scanProgress }}%</p>
            </div>

            <div *ngIf="scanComplete" class="sample-vials flex justify-center gap-4 my-4 animate-fade-in">
              <button
                *ngFor="let vial of vials; let idx = index"
                (click)="pickVial(idx)"
                class="vial-btn"
                [ngClass]="vial.anomalous ? 'vial-anomaly' : ''"
              >
                <div class="vial-fluid" [style.background]="vial.color"></div>
                <span>Culture #{{ idx + 1 }}</span>
              </button>
            </div>
          </div>

          <!-- 4. FREQUENCY TUNE -->
          <div *ngIf="task.type === 'frequency_tune'" class="frequency-game py-4">
            <p class="instruction">Adjust the tuner slider to lock onto target signal ({{ targetFreq }} MHz):</p>
            
            <div class="freq-display text-center my-4 font-title">
              <div class="current-freq" [ngClass]="isFreqLocked ? 'text-green' : 'text-amber'">
                {{ currentFreq }} MHz
              </div>
              <div class="freq-meter my-3">
                <div class="target-marker" [style.left.%]="(targetFreq - 80) / 0.4"></div>
                <div class="current-marker" [style.left.%]="(currentFreq - 80) / 0.4"></div>
              </div>
            </div>

            <input
              type="range"
              min="80"
              max="120"
              step="0.5"
              [(ngModel)]="currentFreq"
              (input)="checkFrequency()"
              class="freq-slider w-full"
            />
          </div>

          <!-- 5. VALVE CALIBRATE -->
          <div *ngIf="task.type === 'valve_calibrate'" class="valve-game text-center py-4">
            <p class="instruction">Turn the pneumatic wheel until pressure gauge aligns in the green sector:</p>
            
            <div class="gauge-circle my-4">
              <div class="green-sector"></div>
              <div class="gauge-needle" [style.transform]="'rotate(' + (pressure - 50) * 2.8 + 'deg)'"></div>
              <div class="pressure-val font-title">{{ pressure }} PSI</div>
            </div>

            <div class="flex justify-center gap-3">
              <button (click)="adjustPressure(-8)" class="btn-valve">- Purge</button>
              <button (click)="adjustPressure(8)" class="btn-valve">+ Pressurize</button>
            </div>
          </div>

        </div>

        <!-- Footer / Status -->
        <div class="task-foot flex items-center justify-between">
          <span *ngIf="taskSuccess" class="success-banner text-green font-title">
            ✓ Objective Complete!
          </span>
          <span *ngIf="!taskSuccess" class="hint-text">
            Interact to restore research settlement systems.
          </span>
          <button (click)="close.emit()" class="btn-done">
            {{ taskSuccess ? 'Done' : 'Cancel' }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .task-overlay {
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
    .task-dialog {
      width: 100%;
      max-width: 520px;
      border-radius: 1.5rem;
      padding: 1.75rem;
      border: 1px solid rgba(99, 102, 241, 0.4);
      background: #0b0f19;
      color: #f8fafc;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    }
    .room-tag {
      font-size: 0.75rem;
      font-weight: 700;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .task-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: #fff;
    }
    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.25rem;
      cursor: pointer;
    }
    .instruction {
      font-size: 0.85rem;
      color: #cbd5e1;
      margin-bottom: 0.75rem;
    }
    .wire-node {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      border: 2px solid transparent;
      color: white;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .wire-node:hover { transform: scale(1.02); }
    .wire-active { box-shadow: 0 0 15px #ffffff; }
    .wire-connected { opacity: 0.6; cursor: default; }
    .breaker-switch {
      width: 44px;
      height: 80px;
      background: #1e293b;
      border-radius: 8px;
      position: relative;
      cursor: pointer;
      border: 2px solid #334155;
    }
    .switch-handle {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background: #475569;
      position: absolute;
      left: 2px;
      transition: top 0.2s, background 0.2s;
    }
    .breaker-down .switch-handle { top: 38px; background: #dc2626; }
    .breaker-up .switch-handle { top: 2px; background: #16a34a; }
    .breaker-tag { font-size: 0.7rem; font-family: monospace; color: #94a3b8; }
    .scan-bar {
      width: 100%;
      height: 12px;
      background: #1e293b;
      border-radius: 6px;
      overflow: hidden;
    }
    .scan-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #06b6d4);
      transition: width 0.2s linear;
    }
    .vial-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      background: #1e293b;
      border: 2px solid #334155;
      border-radius: 0.75rem;
      padding: 1rem;
      cursor: pointer;
      color: #cbd5e1;
      font-size: 0.8rem;
    }
    .vial-btn:hover { border-color: #38bdf8; }
    .vial-fluid {
      width: 24px;
      height: 48px;
      border-radius: 12px;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
    }
    .freq-meter {
      height: 16px;
      background: #1e293b;
      border-radius: 8px;
      position: relative;
      margin: 0.5rem 0;
    }
    .target-marker {
      position: absolute;
      top: -2px;
      width: 8px;
      height: 20px;
      background: #10b981;
      border-radius: 4px;
      transform: translateX(-50%);
    }
    .current-marker {
      position: absolute;
      top: 0;
      width: 6px;
      height: 16px;
      background: #f59e0b;
      border-radius: 3px;
      transform: translateX(-50%);
    }
    .gauge-circle {
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: #1e293b;
      border: 4px solid #334155;
      margin: 0 auto;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gauge-needle {
      position: absolute;
      top: 25px;
      left: 62px;
      width: 6px;
      height: 45px;
      background: #ef4444;
      border-radius: 3px;
      transform-origin: bottom center;
      transition: transform 0.2s;
    }
    .pressure-val {
      position: absolute;
      bottom: 15px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #f1f5f9;
    }
    .btn-valve {
      padding: 0.5rem 1.25rem;
      background: #334155;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-valve:hover { background: #475569; }
    .text-green { color: #34d399; font-weight: 700; }
    .text-red { color: #f87171; font-weight: 700; }
    .text-amber { color: #fbbf24; font-weight: 700; }
    .task-foot {
      border-top: 1px solid rgba(51, 65, 85, 0.6);
      padding-top: 1rem;
      margin-top: 1.5rem;
    }
    .btn-done {
      padding: 0.5rem 1.25rem;
      background: #4f46e5;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
  `]
})
export class TaskModalComponent implements OnInit, OnDestroy {
  @Input() task!: TaskDefinition;
  @Output() complete = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  public taskSuccess = false;

  // Wiring data
  public leftWires = [
    { id: 'red', name: 'Red Conduit', color: '#ef4444', connected: false },
    { id: 'blue', name: 'Blue Data', color: '#3b82f6', connected: false },
    { id: 'yellow', name: 'Yellow Power', color: '#eab308', connected: false },
    { id: 'magenta', name: 'Pink Flux', color: '#ec4899', connected: false }
  ];
  public rightWires = [
    { id: 'yellow', name: 'Yellow Port', color: '#eab308', connected: false },
    { id: 'red', name: 'Red Port', color: '#ef4444', connected: false },
    { id: 'magenta', name: 'Pink Port', color: '#ec4899', connected: false },
    { id: 'blue', name: 'Blue Port', color: '#3b82f6', connected: false }
  ];
  public selectedWire: any = null;

  // Breakers
  public breakers = [false, false, false, false];

  // Scan
  public scanProgress = 0;
  public scanComplete = false;
  private scanTimer: any = null;
  public vials = [
    { color: '#10b981', anomalous: false },
    { color: '#8b5cf6', anomalous: true },
    { color: '#3b82f6', anomalous: false }
  ];

  // Frequency
  public targetFreq = 104.5;
  public currentFreq = 85.0;
  public isFreqLocked = false;

  // Valve
  public pressure = 30;

  constructor(private sound: SoundService) {}

  ngOnInit(): void {
    if (this.task.type === 'sample_scan') {
      this.startCentrifuge();
    }
  }

  ngOnDestroy(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
  }

  // Wiring
  public selectLeftWire(wire: any): void {
    if (wire.connected) return;
    this.sound.playActionSelected();
    this.selectedWire = wire;
  }

  public connectToRightWire(wire: any): void {
    if (!this.selectedWire || wire.connected) return;

    if (this.selectedWire.id === wire.id) {
      this.sound.playNightResolved();
      this.selectedWire.connected = true;
      wire.connected = true;
      this.selectedWire = null;

      if (this.leftWires.every(w => w.connected)) {
        this.triggerTaskCompletion();
      }
    } else {
      this.selectedWire = null;
    }
  }

  // Breakers
  public toggleBreaker(index: number): void {
    this.sound.playActionSelected();
    this.breakers[index] = !this.breakers[index];
    if (this.breakers.every(b => b)) {
      this.triggerTaskCompletion();
    }
  }

  // Sample Scan
  private startCentrifuge(): void {
    this.scanTimer = setInterval(() => {
      this.scanProgress += 20;
      if (this.scanProgress >= 100) {
        clearInterval(this.scanTimer);
        this.scanComplete = true;
        this.sound.playActionSelected();
      }
    }, 400);
  }

  public pickVial(idx: number): void {
    if (this.vials[idx].anomalous) {
      this.triggerTaskCompletion();
    }
  }

  // Frequency
  public checkFrequency(): void {
    if (Math.abs(this.currentFreq - this.targetFreq) < 1.0) {
      this.isFreqLocked = true;
      this.triggerTaskCompletion();
    } else {
      this.isFreqLocked = false;
    }
  }

  // Valve
  public adjustPressure(delta: number): void {
    this.sound.playActionSelected();
    this.pressure = Math.max(10, Math.min(100, this.pressure + delta));
    // Green sector is 60 - 75
    if (this.pressure >= 62 && this.pressure <= 74) {
      this.triggerTaskCompletion();
    }
  }

  private triggerTaskCompletion(): void {
    if (this.taskSuccess) return;
    this.taskSuccess = true;
    this.sound.playVictoryFanfare();
    setTimeout(() => {
      this.complete.emit(this.task.id);
      this.close.emit();
    }, 1200);
  }
}
