import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: [],
})
export class AppComponent {
  title = 'DieTI';
  online = navigator.onLine;
  constructor() {
    window.addEventListener('online',  () => this.online = true);
    window.addEventListener('offline', () => this.online = false);
  }
}
