import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DsButtonComponent, DsIconComponent } from '@agopify/ui';

type DemoStage = 'recommend' | 'checkout' | 'handoff';

const PROMPTS: { id: DemoStage; label: string }[] = [
  { id: 'recommend', label: '¿Tienen zapatillas blancas en talla 40?' },
  { id: 'checkout', label: '¿Cómo pago?' },
  { id: 'handoff', label: '¿Me ayudas a elegir la talla?' },
];

@Component({
  selector: 'app-marketing-demo',
  imports: [DsButtonComponent, DsIconComponent],
  templateUrl: './marketing-demo.component.html',
  styleUrl: './marketing-demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingDemoComponent {
  readonly demoStage = signal<DemoStage>('recommend');
  readonly prompts = PROMPTS;
  readonly activePrompt = computed(
    () => this.prompts.find((prompt) => prompt.id === this.demoStage())?.label ?? '',
  );

  selectStage(stage: DemoStage): void {
    this.demoStage.set(stage);
  }
}
