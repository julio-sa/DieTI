import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Input, OnInit, OnChanges, ElementRef, ViewChild, Output, EventEmitter } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-multi-ring-chart',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './multi-ring-chart.component.html',
  styleUrls: ['./multi-ring-chart.component.css']
})
export class MultiRingChartComponent implements OnInit, OnChanges {
  @Input() calorias!: { value: number; max: number };
  @Input() proteinas!: { value: number; max: number };
  @Input() carb!: { value: number; max: number };
  @Input() gordura!: { value: number; max: number };

  @ViewChild('tooltip') tooltipElement!: ElementRef;

  @Output() refreshData = new EventEmitter<void>();

  private readonly apiUrl = environment.apiUrl;

  showTooltip = false;
  tooltipText = '';
  tooltipX = 0;
  tooltipY = 0;

  // Valores animados
  animatedCalories = 0;
  animatedProtein = 0;
  animatedCarbs = 0;
  animatedFat = 0;

  // Raio dos anéis
  outerRadius = 80;
  middleRadius = 70;
  innerRadius = 60;
  centerRadius = 50;

  // Circunferências
  caloriasCircumference = 0;
  proteinasCircumference = 0;
  carbCircumference = 0;
  gorduraCircumference = 0;

  constructor(
    private cdr: ChangeDetectorRef, 
    private http: HttpClient,
    private router: Router
  ) {}

  // Método chamado ao passar o mouse sobre o ícone
  onIconHover(event: MouseEvent, nutrient: string, value: number, goal: number) {
    this.tooltipText = `${this.capitalize(nutrient)}: ${value.toFixed(1)} / ${goal} ${this.getUnit(nutrient)}`;
    
    // Posição relativa ao container
    const chartRect = (event.currentTarget as SVGElement).ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!chartRect) return;

    this.tooltipX = event.clientX - chartRect.left + window.scrollX + 10;
    this.tooltipY = event.clientY - chartRect.top + window.scrollY - 10;

    this.showTooltip = true;
    this.cdr.detectChanges(); // Força detecção se necessário
  }

  // Oculta o tooltip
  hideTooltip() {
    this.showTooltip = false;
  }

  // Capitaliza a primeira letra
  capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // Retorna unidade
  getUnit(nutrient: string): string {
    switch (nutrient) {
      case 'calorias': return 'kcal';
      case 'proteinas':
      case 'carbo':
      case 'gordura': return 'g';
      default: return '';
    }
  }


  dailyFoods: any[] = [];
  showDailyPopup: boolean = false;
  selectedFoodToEdit: any = null;

  async openDailyFoodPopup() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // ✅ Use firstValueFrom em vez de .toPromise()
      this.dailyFoods = await firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/food/daily?user_id=${userId}`)
      );
      this.showDailyPopup = true;
    } catch (err) {
      console.error('Falha ao carregar alimentos diários', err);
    }
  }

  async deleteFood(id: string) {
    if (confirm('Deletar esse alimento?')) {
      await this.http.delete(`${this.apiUrl}/food/delete/${id}`).toPromise();
      
      // ✅ Remove localmente
      this.dailyFoods = this.dailyFoods.filter(f => f._id !== id);
      
      // ✅ Avisa o pai para recarregar gráficos
      this.refreshData.emit();
    }
} 

  editFood(food: any) {
    this.selectedFoodToEdit = { ...food };
  }

  saveEditedFood() {
    const updated = { ...this.selectedFoodToEdit };

    // ✅ Remove _id do corpo da requisição
    const { _id, ...updateData } = updated;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Sessão expirada.');
      this.router.navigate(['/sign-in']);
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.put(`${this.apiUrl}/food/update/${_id}`, updateData, { headers })
      .subscribe({
        next: () => {
          // Atualiza localmente
          const index = this.dailyFoods.findIndex(f => f._id === _id);
          if (index !== -1) {
            this.dailyFoods[index] = { ...updated }; // Mantém _id só aqui
          }
          this.selectedFoodToEdit = null;
          this.refreshData.emit(); // Recarrega gráficos
        },
        error: (err) => {
          console.error('Erro ao salvar:', err);
          alert('Falha ao atualizar alimento. Tente novamente.');
        }
      });
  }

  closePopup() {
    this.showDailyPopup = false;
  }
  ngOnInit(): void {
    // Inicializa circunferências
    this.caloriasCircumference = 2 * Math.PI * this.outerRadius;
    this.proteinasCircumference = 2 * Math.PI * this.middleRadius;
    this.carbCircumference = 2 * Math.PI * this.innerRadius;
    this.gorduraCircumference = 2 * Math.PI * this.centerRadius;
    this.dailyFoods = []; 
    // Inicia animação
    this.animateValues();
  }

  ngOnChanges(): void {
    this.animateValues();
  }

  animateValues() {
    const duration = 1200;
    const start = performance.now();

    const fromCalories = this.animatedCalories;
    const fromProtein = this.animatedProtein;
    const fromCarbs = this.animatedCarbs;
    const fromFat = this.animatedFat;

    const toCalories = this.calorias.value;
    const toProtein = this.proteinas.value;
    const toCarbs = this.carb.value;
    const toFat = this.gordura.value;

    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out natural
      const easeOut = 1 - Math.pow(1 - progress, 3);

      this.animatedCalories = fromCalories + (toCalories - fromCalories) * easeOut;
      this.animatedProtein = fromProtein + (toProtein - fromProtein) * easeOut;
      this.animatedCarbs = fromCarbs + (toCarbs - fromCarbs) * easeOut;
      this.animatedFat = fromFat + (toFat - fromFat) * easeOut;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Garante precisão
        this.animatedCalories = toCalories;
        this.animatedProtein = toProtein;
        this.animatedCarbs = toCarbs;
        this.animatedFat = toFat;
      }

      // Força detecção
      this.cdr.detectChanges();
    };

    requestAnimationFrame(animate);
  }

  get caloriasPercentage() {
    return (this.animatedCalories / this.calorias.max) * 100;
  }

  get proteinasPercentage() {
    return (this.animatedProtein / this.proteinas.max) * 100;
  }

  get carbPercentage() {
    return (this.animatedCarbs / this.carb.max) * 100;
  }

  get gorduraPercentage() {
    return (this.animatedFat / this.gordura.max) * 100;
  }

  // Getters para offsets — usam os valores ANIMADOS
  get caloriasOffset() {
    const percentage = (this.animatedCalories / this.calorias.max) * 100;
    const raw = this.caloriasCircumference * (1 - Math.min(percentage, 100) / 100);
    return -raw;
  }

  get proteinasOffset() {
    const percentage = (this.animatedProtein / this.proteinas.max) * 100;
    const raw = this.proteinasCircumference * (1 - Math.min(percentage, 100) / 100);
    return -raw;
  }

  get carbOffset() {
    const percentage = (this.animatedCarbs / this.carb.max) * 100;
    const raw = this.carbCircumference * (1 - Math.min(percentage, 100) / 100);
    return -raw;
  }

  get gorduraOffset() {
    const percentage = (this.animatedFat / this.gordura.max) * 100;
    const raw = this.gorduraCircumference * (1 - Math.min(percentage, 100) / 100);
    return -raw;
  }

  // Formatação
  get formattedCalories() { return this.animatedCalories.toFixed(1); }
  get formattedProtein() { return this.animatedProtein.toFixed(1); }
  get formattedCarb() { return this.animatedCarbs.toFixed(1); }
  get formattedFat() { return this.animatedFat.toFixed(1); }
}