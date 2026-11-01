import { Injectable, signal } from '@angular/core';

/**
 * When the assistant is docked, the main frame cedes margin-inline-end so a
 * separate fixed sheet can sit on the right with a chrome gap between them.
 */
@Injectable({ providedIn: 'root' })
export class ConsoleAssistantLayoutService {
  /** True while the assistant sidebar sheet is open beside the main frame. */
  readonly dockOpen = signal(false);

  setDockOpen(open: boolean): void {
    this.dockOpen.set(open);
  }
}
