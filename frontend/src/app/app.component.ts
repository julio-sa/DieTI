import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

@Component({
  selector: 'app-root',
  imports: [
    RouterModule
  ],
  template: `./app.component.html`,
})
export class AppComponent {
  online = true;
  title = 'frontend';

  constructor(private swUpdate: SwUpdate) {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(async (event) => {
        if (event.type === 'VERSION_READY') {
          await this.swUpdate.activateUpdate();
          document.location.reload();
        }
      });
    }
  }
}
