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
      bdate: ['', Validators.required],
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

  // Máscara para dd/mm/yyyy
  onDateInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length >= 5) {
      value = value.replace(/(\d{2})(\d{2})(\d)/, '$1/$2/$3');
    } else if (value.length >= 3) {
      value = value.replace(/(\d{2})(\d)/, '$1/$2');
    }
    this.registerForm.get('bdate')?.setValue(value, { emitEvent: false });
  }

  // Valida se a data é válida no formato dd/mm/yyyy
  isValidDate(dateStr: string): boolean {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(regex);
    if (!match) return false;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;

    // Verifica dias por mês (incluindo ano bissexto)
    const daysInMonth = [31, 28 + (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  }

  // Calcula idade
  getAge(dateStr: string): number {
    const [day, month, year] = dateStr.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  password_confirmation(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  onSubmit() {
    if (!this.registerForm.get('name')?.value ||
        !this.registerForm.get('email')?.value ||
        !this.registerForm.get('password')?.value ||
        !this.registerForm.get('weight')?.value ||
        !this.registerForm.get('height')?.value) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    const bdate = this.registerForm.get('bdate')?.value;
    if (!bdate) {
      alert('Data de nascimento é obrigatória.');
      return;
    }

    if (!this.isValidDate(bdate)) {
      alert('Data de nascimento inválida. Use o formato dd/mm/yyyy.');
      return;
    }

    const age = this.getAge(bdate);
    if (age < 13 || age > 120) {
      alert('Idade deve estar entre 13 e 120 anos.');
      return;
    }

    // ✅ CORREÇÃO: formatação manual SEM Date().toISOString()
    const [day, month, year] = bdate.split('/').map(Number);
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const formData = {
      ...this.registerForm.value,
      bdate: isoDate
    };

    this.http.post(`${this.backendUrl}/api/auth/sign-up`, formData).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('userId', res.user.id);
        localStorage.setItem('userName', res.user.name);
        if (res.user.goals) {
          localStorage.setItem('goals', JSON.stringify(res.user.goals));
        }
        Swal.fire({ icon: 'success', title: 'Conta criada!', confirmButtonText: 'Vamos lá!' })
          .then(() => this.router.navigate(['/home']));
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Erro ao criar conta.' });
      }
    });
  }
}