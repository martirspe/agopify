import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { CartService } from "../../core/cart.service";
import { MoneyPipe } from "../../core/money.pipe";
@Component({
  selector: "rosaline-cart-drawer",
  imports: [RouterLink, MoneyPipe],
  templateUrl: "./original-cart.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineCartDrawer {
  readonly cart = inject(CartService);
  readonly closed = output<void>();
}
