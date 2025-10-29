import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-password-recovery',
  imports: [FormsModule],
  templateUrl: './password-recovery.component.html',
  styleUrls: ['./password-recovery.component.css']
})
export class PasswordRecoveryComponent {
  email = '';

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
        this.http.post('http://localhost:3000/api/auth/forgot-password', { email: this.email })
      );
      alert('Código de recuperação enviado para seu email.');
      this.router.navigate(['/recovery-code'], { queryParams: { email: this.email } });
    } catch (err) {
      console.error('Erro ao enviar código:', err);
      alert('Falha ao enviar código. Verifique seu email e tente novamente.');
    }
  }
}