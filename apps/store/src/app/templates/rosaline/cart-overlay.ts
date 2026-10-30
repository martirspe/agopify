import { Injectable, signal } from "@angular/core";
@Injectable()
export class RosalineCartOverlay {
  readonly opened = signal(false);
}
