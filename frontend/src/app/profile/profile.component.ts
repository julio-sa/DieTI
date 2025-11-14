import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { GoalService, Goals } from '../services/goal.service';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  isEditing: boolean = false;
  registerForm: FormGroup;
  errorMessage: string = '';
  originalData: any;
  goals: Goals = { calorias: 2704, proteinas: 176, carbo: 320, gordura: 80 };
  showDeleteModal = false;
  deleteForm: FormGroup;
  deleteError = '';
  deleting = false;

  private userId: string | null = null;
  private readonly backendUrl = environment.backendUrl;

  @ViewChild('nameInput') nameInput!: ElementRef;

  // rótulos amigáveis para usar nas mensagens
  private readonly fieldLabels: Record<string, string> = {
    name: 'nome',
    email: 'email',
    bdate: 'data de nascimento',
    weight: 'peso',
    height: 'altura'
  };

  constructor(
    private goalService: GoalService,
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      bdate: ['', Validators.required], // dd/mm/yyyy
      weight: ['', Validators.required],
      height: ['', Validators.required]
    });

    this.deleteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.goalService.goals$.subscribe(g => this.goals = g);
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  goToEditProfile(): void {
    this.isEditing = !this.isEditing;
  }

  onGoalInput(event: any, field: keyof Goals) {
    const value = parseFloat(String(event.target.value).replace(',', '.'));
    if (!isNaN(value)) this.goals = { ...this.goals, [field]: value };
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

  // Valida data dd/mm/yyyy
  isValidDate(dateStr: string): boolean {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(regex);
    if (!match) return false;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;

    const daysInMonth = [31, 28 + (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  }

  /**
   * Verifica campos obrigatórios e mostra SweetAlert informando
   * qual campo está vazio. Retorna true se encontrou falta.
   */
  private checkMissingRequiredFields(): boolean {
    const controls = this.registerForm.controls;

    for (const key of Object.keys(controls)) {
      const control = controls[key];
      const isRequired = control.hasValidator?.(Validators.required) ?? false;

      if (isRequired) {
        const raw = control.value;
        const value = typeof raw === 'string' ? raw.trim() : raw;

        if (value === '' || value === null || value === undefined) {
          const label = this.fieldLabels[key] ?? key;
          Swal.fire({
            icon: 'warning',
            title: 'Campos obrigatórios',
            text: `Não é possível salvar com ${label} vazio.`,
            confirmButtonText: 'Ok'
          });
          control.markAsTouched();
          return true;
        }
      }
    }
    return false;
  }

  onSubmit() {
    // 1) bloqueia se tiver campo obrigatório faltando e informa qual
    if (this.checkMissingRequiredFields()) return;

    // 2) validação de data
    const bdate = (this.registerForm.get('bdate')?.value || '').trim();
    if (!this.isValidDate(bdate)) {
      Swal.fire({
        icon: 'warning',
        title: 'Data inválida',
        text: 'Use o formato dd/mm/yyyy.',
        confirmButtonText: 'Corrigir'
      });
      this.registerForm.get('bdate')?.markAsTouched();
      return;
    }

    // 3) formatação dd/mm/yyyy -> yyyy-mm-dd
    const [day, month, year] = bdate.split('/').map(Number);
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 4) normaliza tipos (peso/altura como número)
    const weight = parseFloat(String(this.registerForm.value.weight).replace(',', '.'));
    const height = parseFloat(String(this.registerForm.value.height).replace(',', '.'));

    const formData = {
      name: String(this.registerForm.value.name).trim(),
      email: String(this.registerForm.value.email).trim(),
      bdate: isoDate,
      weight,
      height
    };

    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    this.http.put(`${this.backendUrl}/api/profile/update`, formData, { headers }).subscribe({
      next: (response: any) => {
        // garante atualização visual e memória local
        this.isEditing = false;
        this.originalData = { ...response.user }; // pega o user que voltou do backend
        // re-formata bdate para o input
        let formattedBdate = '';
        if (this.originalData?.bdate) {
          const iso = String(this.originalData.bdate).split('T')[0]; // yyyy-mm-dd
          const [yy, mm, dd] = iso.split('-');
          formattedBdate = `${dd}/${mm}/${yy}`;
        }

        this.registerForm.patchValue({
          name: this.originalData?.name || formData.name,
          email: this.originalData?.email || formData.email,
          bdate: formattedBdate || bdate,
          weight: this.originalData?.weight ?? formData.weight,
          height: this.originalData?.height ?? formData.height
        });

        // salva metas se alteradas
        this.goalService.updateGoals(this.goals);

        this.cdr.detectChanges();

        Swal.fire({
          icon: 'success',
          title: 'Perfil atualizado!',
          confirmButtonText: 'Fechar'
        });
      },
      error: (err) => {
        if (err.status === 401) {
          Swal.fire({
            icon: 'warning',
            title: 'Sessão expirada',
            text: 'Faça login novamente.',
          }).then(() => this.router.navigate(['/login']));
        } else if (err.error?.message) {
          Swal.fire({
            icon: 'error',
            title: 'Erro ao atualizar',
            text: err.error.message,
            confirmButtonText: 'Fechar'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Erro ao atualizar',
            text: 'Tente novamente.',
            confirmButtonText: 'Fechar'
          });
        }
      }
    });
  }

  loadUserData() {
    const token = localStorage.getItem('token');
    this.userId = localStorage.getItem('userId');

    if (!this.userId || !token) {
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.get(`${this.backendUrl}/api/profile/profile`, { headers }).subscribe({
      next: (res: any) => {
        const user = res.user;

        // formata data ISO para dd/mm/yyyy
        let formattedBdate = '';
        if (user?.bdate) {
          const isoDate = String(user.bdate).split('T')[0]; // "2002-05-26"
          const [year, month, day] = isoDate.split('-');
          formattedBdate = `${day}/${month}/${year}`;
        }

        this.originalData = {
          name: user?.name,
          email: user?.email,
          bdate: user?.bdate, // mantém ISO original
          weight: user?.weight,
          height: user?.height
        };

        this.registerForm.patchValue({
          ...this.originalData,
          bdate: formattedBdate
        });

        if (user?.goals) {
          this.goals = { ...user.goals };
          this.goalService.updateGoals(this.goals);
        }
      },
      error: (err) => {
        if (err.status === 401) {
          Swal.fire({ icon: 'warning', title: 'Sessão expirada', text: 'Faça login novamente.' })
            .then(() => this.router.navigate(['/login']));
        } else {
          this.errorMessage = 'Falha ao carregar perfil.';
        }
      }
    });
  }

  cancelEdit() {
    if (this.originalData?.bdate) {
      const isoDate = String(this.originalData.bdate).split('T')[0];
      const [year, month, day] = isoDate.split('-');
      const formattedBdate = `${day}/${month}/${year}`;
      this.registerForm.get('bdate')?.setValue(formattedBdate);
    }
    this.isEditing = false;
  }

  // ======= Exclusão de conta (inalterado) =======
  openDeleteAccountModal(): void {
    this.showDeleteModal = true;
    this.deleteForm.reset();
    this.deleteError = '';
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deleteError = '';
  }

  async confirmDeleteAccount(): Promise<void> {
    const confirmed = window.confirm("Tem certeza que deseja deletar sua conta?");
    if (!confirmed) return;

    try {
      const validationResponse = await fetch(`${this.backendUrl}/api/auth/validate-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.deleteForm.value.email,
          password: this.deleteForm.value.password
        })
      });

      if (!validationResponse.ok) throw new Error('Falha na validação');

      const deleteResponse = await fetch(`${this.backendUrl}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!deleteResponse.ok) throw new Error('Falha ao excluir conta');

      localStorage.clear();
      sessionStorage.clear();

      Swal.fire({
        icon: 'success',
        title: 'Conta excluída!',
        text: 'Sua conta foi removida com sucesso.',
        confirmButtonText: 'OK'
      }).then(() => this.router.navigate(['/sign-in']));
    } catch (error) {
      console.error('Erro:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: 'Falha ao processar a solicitação.',
        confirmButtonText: 'Fechar'
      });
    }
  }
}
