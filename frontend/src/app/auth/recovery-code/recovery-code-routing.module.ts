import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RecoveryCodeComponent } from './recovery-code.component';

const routes: Routes = [
  { path: '', component: RecoveryCodeComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RecoveryCodeRoutingModule { }