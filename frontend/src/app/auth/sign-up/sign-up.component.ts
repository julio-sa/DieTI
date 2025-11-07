import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { MAT_DATE_FORMATS } from '@angular/material/core';

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  standalone: true,
  selector: "app-sign-up",
  imports: [CommonModule, 
            FormsModule, 
            RouterModule, 
            ReactiveFormsModule,
            MatDatepickerModule,
            MatInputModule,
            MatFormFieldModule,
            MatNativeDateModule
          ],
  templateUrl: "./sign-up.component.html",
  styleUrls: ["./sign-up.component.css"],
  providers: [
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
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

  // Propriedades
  showCalendar = false;
  currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
  currentYear = new Date().getFullYear();
  calendarDays: any[] = [];
  isMobileDevice = window.innerWidth <= 768;

  @ViewChild('nameInput', { static: true }) nameInput!: ElementRef;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router, private location: Location) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      bdate: ['', Validators.required, minAgeValidator(13)],
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

  onDateChange(event: any) {
    // Converte para formato ISO sem alterar o dia
    if (event.value) {
      const date = new Date(event.value);
      const isoDate = date.toISOString().split('T')[0];
      this.registerForm.get('bdate')?.setValue(isoDate);
    }
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const bdateValue = this.registerForm.get('bdate')?.value;
    if (bdateValue) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(bdateValue)) {
        this.registerForm.get('bdate')?.setErrors({ invalidFormat: true });
        return;
      }
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

  formatDateInput(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  parseDateInput(event: any) {
    const value = event.target.value;
    const parts = value.split('/');
    
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && 
            date.getMonth() === month && 
            date.getDate() === day) {
          this.registerForm.get('bdate')?.setValue(date.toISOString().split('T')[0]);
        }
      }
    }
  }
}

// Função de validação personalizada
export function minAgeValidator(minAge: number): ValidatorFn {
  return (control: AbstractControl): {[key: string]: any} | null => {
    if (!control.value) return null;
    
    const birthDate = new Date(control.value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= minAge ? null : { minAge: { requiredAge: minAge, actualAge: age } };
  };
}
