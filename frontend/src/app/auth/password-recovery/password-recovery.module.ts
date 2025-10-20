import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PasswordRecoveryRoutingModule } from './password-recovery-routing.module';
import { PasswordRecoveryComponent } from './password-recovery.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    PasswordRecoveryRoutingModule,
    PasswordRecoveryComponent
  ]
})
export class PasswordRecoveryModule { }