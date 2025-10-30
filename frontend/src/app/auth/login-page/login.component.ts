import { CommonModule, Location } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterModule,],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(private http: HttpClient, private router: Router, private location: Location) {}
  goBack(): void {
    this.router.navigate(['/sign-in']);
  }
  onSubmit() {
    const loginData = { email: this.email, password: this.password };

    this.http.post('http://localhost:3000/api/auth/sign-in', loginData).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('userId', res.user.id);
        localStorage.setItem('userName', res.user.name);
        
        // ✅ Salva as metas retornadas
        if (res.user.goals) {
          localStorage.setItem('goals', JSON.stringify(res.user.goals));
        }

        Swal.fire({
          icon: 'success',
          title: 'Bem vindo de volta!',
          text: 'Login realizado com sucesso.',
          confirmButtonText: 'Vamos lá!'
        }).then(() => this.router.navigate(['/home']));
      },
      error: (err: HttpErrorResponse) => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Email ou senha incorretos.',
        });
      }
    });
  }
  goToPasswordRecovery() {
    this.router.navigate(['/password-recovery']);
  }
}


