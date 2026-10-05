import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rules-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="modal-overlay animate-fade-in" (click)="close.emit()">
      <div class="modal-dialog glass-panel-elevated max-w-2xl max-h-[85vh] overflow-y-auto" (click)="$event.stopPropagation()">
        
        <div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div>
            <span class="text-xs font-bold text-indigo-400 uppercase tracking-widest">Protocol & Field Manual</span>
            <h2 class="font-title text-2xl text-white">Midnight Village Guide</h2>
          </div>
          <button (click)="close.emit()" class="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div class="rules-content my-4 flex flex-col gap-6 text-sm text-slate-300">
          
          <!-- The Settlement -->
          <div>
            <h3 class="font-title text-base text-indigo-300 mb-1">1. The Research Settlement</h3>
            <p class="leading-relaxed text-xs">
              Players operate in the isolated <strong>Midnight Research Settlement</strong>. The facility contains 10 interconnected rooms:
              Central Square, Laboratory, Power Station, Observatory, Greenhouse, Communications, Medical Center, Storage, Workshop, and Dormitories.
            </p>
          </div>

          <!-- Roles -->
          <div>
            <h3 class="font-title text-base text-indigo-300 mb-2">2. Roles & Objectives</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30">
                <div class="font-title text-blue-400 font-bold mb-1">VILLAGERS (Crew)</div>
                <p class="text-xs text-slate-300">
                  Navigate the settlement and complete all assigned repair objectives (wiring, power breakers, sample scans, frequency tuning).
                  Observe crew movements and identify the hidden killers.
                </p>
              </div>

              <div class="p-3 rounded-xl bg-red-950/40 border border-red-500/30">
                <div class="font-title text-red-400 font-bold mb-1">IMPOSTORS (Killers)</div>
                <p class="text-xs text-slate-300">
                  Secretly eliminate isolated crew members and trigger environmental sabotages (Power Lights, Reactor Meltdown, Comms Jam).
                  Feign task completion to blend in during discussions.
                </p>
              </div>
            </div>
          </div>

          <!-- Elimination & Reports -->
          <div>
            <h3 class="font-title text-base text-indigo-300 mb-1">3. Reports & Emergency Meetings</h3>
            <ul class="list-disc pl-5 text-xs flex flex-col gap-1 leading-relaxed">
              <li><strong>Dead Body Report:</strong> If you find a fallen crew member, press <code>[REPORT / R]</code> to sound the alarm immediately.</li>
              <li><strong>Emergency Siren:</strong> Living crew can press the Central Square Emergency Table siren to call a council meeting.</li>
              <li><strong>Discussion & Vote:</strong> Crew members debate alibis in real-time chat, then vote to eject a suspect or Skip.</li>
              <li><strong>Ghosts:</strong> Ejected and eliminated players become ghosts who can pass through walls and complete remaining tasks!</li>
            </ul>
          </div>

          <!-- Win Conditions -->
          <div>
            <h3 class="font-title text-base text-indigo-300 mb-1">4. Win Conditions</h3>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                <strong class="text-emerald-400">Villagers Win:</strong>
                <p class="mt-1">All Impostors are discovered and ejected OR 100% of all settlement repair tasks are completed!</p>
              </div>
              <div class="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30">
                <strong class="text-rose-400">Impostors Win:</strong>
                <p class="mt-1">Impostors achieve parity with living crew OR a Reactor Meltdown reaches zero without repair!</p>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div>
            <h3 class="font-title text-base text-indigo-300 mb-1">5. Controls</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div class="bg-slate-900/60 p-2 rounded border border-slate-700"><strong>WASD / Arrows</strong>: Move</div>
              <div class="bg-slate-900/60 p-2 rounded border border-slate-700"><strong>[E]</strong>: Use / Task</div>
              <div class="bg-slate-900/60 p-2 rounded border border-slate-700"><strong>[R]</strong>: Report Body</div>
              <div class="bg-slate-900/60 p-2 rounded border border-slate-700"><strong>[Q]</strong>: Kill (Impostor)</div>
            </div>
          </div>

        </div>

        <div class="flex justify-end pt-3 border-t border-slate-700/60">
          <button (click)="close.emit()" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs">
            Acknowledge
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0, 0, 0, 0.85);
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
      background: #090d18;
      border: 1px solid rgba(99, 102, 241, 0.4);
    }
  `]
})
export class RulesModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
}
