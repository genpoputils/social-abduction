import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SabotageType } from '../../engine/types';
import { SoundService } from '../../services/sound.service';

@Component({
  selector: 'app-sabotage-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sabotage-overlay animate-fade-in" (click)="close.emit()">
      <div class="sabotage-dialog glass-panel-elevated" (click)="$event.stopPropagation()">
        
        <div class="flex items-center justify-between pb-3 border-b border-red-900/60">
          <div>
            <span class="text-xs font-bold text-red-500 uppercase tracking-widest">Impostor Tactical Grid</span>
            <h3 class="font-title text-xl text-white">Settlement Sabotage</h3>
          </div>
          <button (click)="close.emit()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300 my-3">
          Trigger a critical environmental sabotage to divide crew members or force an emergency win:
        </p>

        <div class="grid grid-cols-3 gap-3 my-4">
          
          <!-- 1. Lights -->
          <button (click)="trigger('lights')" class="sabotage-card border-amber-500/40 hover:border-amber-400">
            <div class="icon-wrap bg-amber-500/20 text-amber-400">💡</div>
            <div class="font-title text-sm text-white mt-2">Power Grid</div>
            <p class="desc">Dims villagers’ field of vision to near total darkness.</p>
          </button>

          <!-- 2. Reactor -->
          <button (click)="trigger('reactor')" class="sabotage-card border-red-500/40 hover:border-red-400">
            <div class="icon-wrap bg-red-500/20 text-red-400">☢️</div>
            <div class="font-title text-sm text-white mt-2">Reactor Core</div>
            <p class="desc">Initiates 45s critical meltdown. Crew must repair to prevent instant loss!</p>
          </button>

          <!-- 3. Comms -->
          <button (click)="trigger('comms')" class="sabotage-card border-cyan-500/40 hover:border-cyan-400">
            <div class="icon-wrap bg-cyan-500/20 text-cyan-400">📡</div>
            <div class="font-title text-sm text-white mt-2">Comms Array</div>
            <p class="desc">Scrambles all task markers and personal objective lists.</p>
          </button>

        </div>

        <div class="flex justify-end pt-3 border-t border-slate-700/60">
          <button (click)="close.emit()" class="btn-cancel">Close Map</button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .sabotage-overlay {
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
    .sabotage-dialog {
      width: 100%;
      max-width: 580px;
      border-radius: 1.5rem;
      padding: 1.75rem;
      background: #0d111c;
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f8fafc;
      box-shadow: 0 20px 50px rgba(220, 38, 38, 0.25);
    }
    .sabotage-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1.25rem 0.75rem;
      border-radius: 1rem;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sabotage-card:hover {
      transform: translateY(-3px);
      background: rgba(30, 41, 59, 0.8);
    }
    .icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    .desc {
      font-size: 0.7rem;
      color: #94a3b8;
      margin-top: 0.35rem;
      line-height: 1.3;
    }
    .btn-cancel {
      padding: 0.5rem 1.25rem;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 0.5rem;
      color: #cbd5e1;
      font-size: 0.8rem;
      cursor: pointer;
    }
  `]
})
export class SabotageModalComponent {
  @Output() selectSabotage = new EventEmitter<SabotageType>();
  @Output() close = new EventEmitter<void>();

  constructor(private sound: SoundService) {}

  public trigger(type: SabotageType): void {
    this.sound.playNightResolved();
    this.selectSabotage.emit(type);
    this.close.emit();
  }
}
