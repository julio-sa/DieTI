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

    // ID do usuário logado
    private userId: string | null = null;

    private readonly apiUrl = environment.apiUrl;
    private readonly backendUrl = environment.backendUrl;

    @ViewChild('nameInput') nameInput!: ElementRef
    @ViewChild('emailInput') emailInput!: ElementRef
    @ViewChild('ageInput') ageInput!: ElementRef
    @ViewChild('weightInput') weightInput!: ElementRef
    @ViewChild('heightInput') heightInput!: ElementRef

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
            age: ['', Validators.required],
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
        if (!this.isEditing) {
            this.isEditing = true;
        }
        else {
            this.isEditing = false;
        }
    }

    onGoalInput(event: any, field: keyof Goals) {
        const value = parseFloat(event.target.value);
        if (!isNaN(value)) {
            this.goals = { ...this.goals, [field]: value };
        }
    }

    onSubmit() {
        if (this.registerForm.invalid) {
            this.registerForm.markAllAsTouched();
            return;
        }

        const token = localStorage.getItem('token');
        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

        this.http.put(`${this.backendUrl}/api/profile/update`, this.registerForm.value, { headers }).subscribe({
            next: (response: any) => {
                this.isEditing = false;
                this.loadUserData();
                Swal.fire({
                    icon: 'success',
                    title: 'Profile Updated!',
                    text: response.message,
                    confirmButtonText: 'Close'
                });
            },
            error: (err) => {
                if (err.status === 401) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Expired Session',
                        text: 'Please, login again.',
                    }).then(() => {
                        this.router.navigate(['/login']);
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Error updating profile. Try again.',
                        confirmButtonText: 'Close'
                    });
                }
            }
        })
        this.goalService.updateGoals(this.goals);

        this.isEditing = false;
    }

    loadUserData() {
        const token = localStorage.getItem('token');
        this.userId = localStorage.getItem('userId');

        if (!this.userId) {
            Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'ID do usuário não encontrado. Faça login novamente.'
            });
            this.router.navigate(['/login']);
            return;
        }

        if (!token) {
            this.router.navigate(['/login']);
            return;
        }

        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

        this.http.get(`${this.backendUrl}/api/profile/profile`, { headers }).subscribe({
            next: (res: any) => {
            const user = res.user;
            
            // Atualiza os dados do formulário
            this.originalData = {
                name: user.name,
                email: user.email,
                age: user.age,
                weight: user.weight,
                height: user.height,
                objective: user.objective
            };
            this.registerForm.patchValue(this.originalData);

            // ✅ Atualiza as metas se existirem
            if (user.goals) {
                this.goals = { ...user.goals };
                this.goalService.updateGoals(this.goals); // Atualiza o serviço também
            }
            },
            error: (err) => {
            if (err.status === 401) {
                Swal.fire({
                icon: 'warning',
                title: 'Expired Session',
                text: 'Please, login again.',
                }).then(() => {
                this.router.navigate(['/login']);
                });
            } else {
                this.errorMessage = 'Fail to load profile.';
            }
            }
        });
        }

    cancelEdit() {
        this.registerForm.patchValue(this.originalData)
        this.isEditing = false;
    };

    // Abre o modal
    openDeleteAccountModal(): void {
        this.showDeleteModal = true;
        this.deleteForm.reset();
        this.deleteError = '';
    }

    // Fecha o modal
    closeDeleteModal(): void {
        this.showDeleteModal = false;
        this.deleteError = '';
    }

    // Confirma a exclusão
    async confirmDeleteAccount(): Promise<void> {
        const confirmed = window.confirm("Tem certeza que deseja deletar sua conta?");
        if (!confirmed) return;

        try {
            // Primeiro valida as credenciais
            const validationResponse = await fetch('environment.backendUrl/api/auth/validate-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: this.deleteForm.value.email,
                password: this.deleteForm.value.password
            })
            });

            if (!validationResponse.ok) {
            throw new Error('Falha na validação');
            }

            // Depois exclui a conta
            const deleteResponse = await fetch(`${this.backendUrl}/api/auth/delete-account`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
            });

            if (!deleteResponse.ok) {
            throw new Error('Falha ao excluir conta');
            }

            // Limpa os dados locais
            localStorage.clear();
            sessionStorage.clear();

            Swal.fire({
            icon: 'success',
            title: 'Conta excluída!',
            text: 'Sua conta foi removida com sucesso.',
            confirmButtonText: 'OK'
            }).then(() => {
            this.router.navigate(['/sign-in']);
            });

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