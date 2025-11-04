import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: "app-sign-up",
  imports: [CommonModule, FormsModule, RouterModule, ReactiveFormsModule],
  templateUrl: "./sign-up.component.html",
  styleUrls: ["./sign-up.component.css"]
})
export class SignUpComponent implements AfterViewInit {
  registerForm: FormGroup;
  errorMessage: string = '';

  private readonly backendUrl = environment.backendUrl;

  goals = {
    calorias: 2704,
    proteinas: 176,
    carbo: 320,
    gordura: 80
  };

  @ViewChild('nameInput', { static: true }) nameInput!: ElementRef;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router, private location: Location) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      age: ['', Validators.required],
      weight: ['', Validators.required],
      height: ['', Validators.required],
      goals: this.fb.group({
        calorias: ['', [Validators.required, Validators.min(1)]],
        proteinas: ['', [Validators.required, Validators.min(1)]],
        carbo: ['', [Validators.required, Validators.min(1)]],
        gordura: ['', [Validators.required, Validators.min(1)]]
      })
    }, { validator: this.password_confirmation });
  }

  ngAfterViewInit() {
    this.nameInput.nativeElement.focus();
  }

  goBack(): void {
    this.router.navigate(['/sign-in']);
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formData = this.registerForm.value;

    this.http.post(`${this.backendUrl}/api/auth/sign-up`, formData).subscribe({
      next: (res: any) => {
        // ✅ Salva os dados do novo usuário
        localStorage.setItem('token', res.token);
        localStorage.setItem('userId', res.user.id);
        localStorage.setItem('userName', res.user.name);
        
        // ✅ Salva as metas do usuário
        if (res.user.goals) {
          localStorage.setItem('goals', JSON.stringify(res.user.goals));
        }

        Swal.fire({
          icon: 'success',
          title: 'Bem vindo a uma vida saudável!',
          text: 'Sua conta foi criada com sucesso.',
          confirmButtonText: 'Vamos lá!'
        }).then(() => this.router.navigate(['/home']));
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Erro ao criar sua conta.',
        });
      }
    });
  }

  password_confirmation(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }
}