import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  private deferredPrompt: any = null;

  constructor() {
    // escuta BEM cedo
    window.addEventListener('beforeinstallprompt', (event: any) => {
      // bloqueia o prompt automático
      event.preventDefault();
      // guarda pra usar depois
      this.deferredPrompt = event;

      // opcional: manda um evento global, ou salva no localStorage
      window.dispatchEvent(new CustomEvent('pwa-install-available'));
      console.log('[PWA] beforeinstallprompt capturado ✅');
    });
  }

  // se você quiser chamar direto daqui:
  async install() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('[PWA] resultado:', outcome);
    this.deferredPrompt = null;
  }
}
