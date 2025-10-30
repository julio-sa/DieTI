import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-password-recovery',
  imports: [FormsModule],
  templateUrl: './password-recovery.component.html',
  styleUrls: ['./password-recovery.component.css']
})
export class PasswordRecoveryComponent {
  email = '';
  private readonly backendUrl = environment.backendUrl;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.email) {
      alert('Por favor, insira um email.');
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/auth/forgot-password`, { email: this.email })
      );
      alert('Código de recuperação enviado para seu email.');
      this.router.navigate(['/recovery-code'], { queryParams: { email: this.email } });
    } catch (err) {
      console.error('Erro ao enviar código:', err);
      alert('Falha ao enviar código. Verifique seu email e tente novamente.');
    }
  }
  
  goToSignIn(): void {
    this.router.navigate(['/sign-in']);
  }
}