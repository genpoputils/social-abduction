import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="avatar-container"
      [ngClass]="[sizeClass, colorClass, isDead ? 'is-dead' : '']"
      [title]="name"
    >
      <!-- Deterministic Animal Icon SVG -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        [ngClass]="iconSizeClass"
      >
        <path *ngIf="iconType === 0" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6z" />
        <path *ngIf="iconType === 1" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
        <path *ngIf="iconType === 2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path *ngIf="iconType === 3" d="M9 10h.01M15 10h.01M10 2v2M14 2v2M4.93 4.93l1.41 1.41M17.66 6.34l1.41-1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 19.07l-1.41-1.41M14 22v-2M10 22v-2" />
        <path *ngIf="iconType === 4" d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />
        <path *ngIf="iconType === 5" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        <path *ngIf="iconType === 6" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>

      <!-- Skull badge if deceased -->
      <span *ngIf="isDead" class="skull-badge" title="Deceased">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <path d="M8 20v2h8v-2 M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 3.5 7v3h9v-3c2-1.5 3.5-4 3.5-7a8 8 0 0 0-8-8z" />
        </svg>
      </span>
    </div>
  `,
  styles: [`
    .avatar-container {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      flex-shrink: 0;
      transition: all 0.2s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .size-sm { width: 1.75rem; height: 1.75rem; border: 1px solid; }
    .size-md { width: 2.5rem; height: 2.5rem; border: 2px solid; }
    .size-lg { width: 3.5rem; height: 3.5rem; border: 2px solid; }
    .size-xl { width: 4.5rem; height: 4.5rem; border: 2.5rem; }

    .icon-sm { width: 14px; height: 14px; }
    .icon-md { width: 18px; height: 18px; }
    .icon-lg { width: 26px; height: 26px; }
    .icon-xl { width: 34px; height: 34px; }

    .color-indigo { background: rgba(49, 46, 129, 0.7); border-color: rgba(99, 102, 241, 0.5); color: #a5b4fc; }
    .color-rose { background: rgba(136, 19, 55, 0.7); border-color: rgba(244, 63, 94, 0.5); color: #fda4af; }
    .color-emerald { background: rgba(6, 78, 59, 0.7); border-color: rgba(16, 185, 129, 0.5); color: #6ee7b7; }
    .color-amber { background: rgba(120, 53, 15, 0.7); border-color: rgba(245, 158, 11, 0.5); color: #fcd34d; }
    .color-cyan { background: rgba(22, 78, 99, 0.7); border-color: rgba(6, 182, 212, 0.5); color: #67e8f9; }

    .is-dead {
      background: rgba(15, 23, 42, 0.9) !important;
      border-color: rgba(71, 85, 105, 0.5) !important;
      color: #64748b !important;
      filter: grayscale(1);
    }

    .skull-badge {
      position: absolute;
      bottom: -3px;
      right: -3px;
      background: #450a0a;
      color: #f87171;
      border: 1px solid #991b1b;
      border-radius: 9999px;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class AvatarComponent {
  @Input() name: string = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() isDead: boolean = false;

  get hash(): number {
    let h = 0;
    for (let i = 0; i < this.name.length; i++) {
      h = (h << 5) - h + this.name.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  get iconType(): number {
    return this.hash % 7;
  }

  get sizeClass(): string {
    return `size-${this.size}`;
  }

  get iconSizeClass(): string {
    return `icon-${this.size}`;
  }

  get colorClass(): string {
    const colors = ['color-indigo', 'color-rose', 'color-emerald', 'color-amber', 'color-cyan'];
    return colors[this.hash % colors.length];
  }
}
