import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-recovery-code',
  imports: [
    FormsModule,
    RouterModule
  ],
  templateUrl: './recovery-code.component.html',
  styleUrls: ['./recovery-code.component.css']
})
export class RecoveryCodeComponent implements OnInit {
  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

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

  // ✅ Método usado no template
  passwordsDontMatch(): boolean {
    return this.newPassword !== this.confirmPassword;
  }

  async onSubmit() {
    if (this.passwordsDontMatch()) {
      alert('As senhas não coincidem.');
      return;
    }

    if (!this.code || this.code.length !== 6) {
      alert('Por favor, insira um código válido de 6 dígitos.');
      return;
    }

    try {
      await firstValueFrom(
        this.http.post('http://localhost:8000/auth/reset-password', {
          email: this.email,
          code: this.code,
          newPassword: this.newPassword
        })
      );
      alert('Senha redefinida com sucesso!');
      this.router.navigate(['/sign-in']);
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
      alert('Código inválido ou expirado. Tente novamente.');
    }
  }
}