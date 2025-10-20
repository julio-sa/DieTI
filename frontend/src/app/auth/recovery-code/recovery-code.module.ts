import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecoveryCodeRoutingModule } from './recovery-code-routing.module';
import { RecoveryCodeComponent } from './recovery-code.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RecoveryCodeRoutingModule,
    RecoveryCodeComponent
  ]
})
export class RecoveryCodeModule {}