import { ChangeDetectionStrategy, Component, output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MoneyPipe } from "../../core/money.pipe";
import { RosalineSpotlight } from "./spotlight";
@Component({
  selector: "rosaline-quickview",
  imports: [RouterLink, MoneyPipe],
  templateUrl: "./original-quickview.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineQuickview extends RosalineSpotlight {
  readonly closed = output<void>();
  override addQuantity(event: Event) {
    if (this.canAdd()) this.closed.emit();
    super.addQuantity(event);
  }
}
