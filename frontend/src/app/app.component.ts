import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [
    RouterModule
  ],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  online = true;
  title = 'frontend';

  constructor() {
    window.addEventListener('online', () => this.updateStatus());
    window.addEventListener('offline', () => this.updateStatus());
  }

  updateStatus() {
    this.online = navigator.onLine;
  }
}