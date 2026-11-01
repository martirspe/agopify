import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/** Legacy route — Instagram lives under Canales. */
@Component({
  selector: 'app-instagram-page',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstagramPage implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigateByUrl('/app/channels?canal=instagram', { replaceUrl: true });
  }
}
