import { Component, ElementRef, ViewChild, OnInit } from "@angular/core";
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { GoalService, Goals } from '../shared/goal.service';

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
    ) {
        this.registerForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            age: ['', Validators.required],
            weight: ['', Validators.required],
            height: ['', Validators.required]
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

        this.http.put('http://localhost:3000/api/profile/update', this.registerForm.value, { headers }).subscribe({
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

        if (!token) {
            this.router.navigate(['/login']);
            return;
        }

        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

        this.http.get('http://localhost:3000/api/profile/profile', { headers }).subscribe({
            next: (res: any) => {
                const user = res.user;

                this.originalData = {
                    name: user.name,
                    email: user.email,
                    age: user.age,
                    weight: user.weight,
                    height: user.height,
                    objective: user.objective
                };

                this.registerForm.patchValue(this.originalData);
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
    };

    cancelEdit() {
        this.registerForm.patchValue(this.originalData)
        this.isEditing = false;
    };
}