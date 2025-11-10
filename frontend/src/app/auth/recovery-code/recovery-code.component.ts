import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-recovery-code',
  imports: [FormsModule],
  templateUrl: './recovery-code.component.html',
  styleUrls: ['./recovery-code.component.css']
})
export class RecoveryCodeComponent implements OnInit {
  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  private readonly backendUrl = environment.backendUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParams['email'] || '';
    if (!this.email) {
      alert('Email não fornecido. Volte e tente novamente.');
      this.router.navigate(['/password-recovery']);
    }
  }

  passwordsDontMatch(): boolean {
    return this.newPassword !== this.confirmPassword;
  }

  isCodeValid(): boolean {
    return this.code.length === 6 && /^\d{6}$/.test(this.code);
  }

  isFormValid(): boolean {
    return this.isCodeValid() && !this.passwordsDontMatch() && this.newPassword.length >= 6;
  }

  async onSubmit() {
    try {
      await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/auth/reset-password`, {
          email: this.email,
          code: this.code,
          newPassword: this.newPassword
        })
      );

      alert('Senha redefinida com sucesso!');
      this.router.navigate(['/sign-in']);

    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      const errorMsg = err.error?.message || 'Falha ao redefinir senha.';
      alert(errorMsg);
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/sign-in']);
  }
}