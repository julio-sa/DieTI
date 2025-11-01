import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-multi-ring-chart',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './multi-ring-chart.component.html',
  styleUrls: ['./multi-ring-chart.component.css'],
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

  // valores animados
  animatedCalories = 0;
  animatedProtein = 0;
  animatedCarbs = 0;
  animatedFat = 0;

  // raios
  outerRadius = 80;
  middleRadius = 70;
  innerRadius = 60;
  centerRadius = 50;

  // circunferências
  caloriasCircumference = 0;
  proteinasCircumference = 0;
  carbCircumference = 0;
  gorduraCircumference = 0;

  // popup diário
  dailyFoods: any[] = [];
  showDailyPopup = false;
  selectedFoodToEdit: any = null;
  private originalFoodToEdit: any = null;

  // animação
  private animationFrameId: number | null = null;

  // ✅ isso aqui evita o bug do Safari: primeiro frame = vazio
  private renderReady = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private router: Router
  ) {}

  // =========================
  // tooltip
  // =========================
  onIconHover(event: MouseEvent, nutrient: string, value: number, goal: number) {
    this.tooltipText = `${this.capitalize(nutrient)}: ${value.toFixed(
      1
    )} / ${goal} ${this.getUnit(nutrient)}`;

    const chartRect = (
      event.currentTarget as SVGElement
    ).ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!chartRect) return;

    this.tooltipX = event.clientX - chartRect.left + window.scrollX + 10;
    this.tooltipY = event.clientY - chartRect.top + window.scrollY - 10;

    this.showTooltip = true;
    this.cdr.detectChanges();
  }

  hideTooltip() {
    this.showTooltip = false;
  }

  capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  getUnit(nutrient: string): string {
    switch (nutrient) {
      case 'calorias':
        return 'kcal';
      case 'proteinas':
      case 'carbo':
      case 'gordura':
        return 'g';
      default:
        return '';
    }
  }

  // =========================
  // popup diário
  // =========================
  async openDailyFoodPopup() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
      this.dailyFoods = await firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/food/daily?user_id=${userId}`)
      );
      this.showDailyPopup = true;
    } catch (err) {
      console.error('Falha ao carregar alimentos diários', err);
    }
  }

  async deleteFood(id: string) {
    if (!confirm('Deletar esse alimento?')) return;

    await this.http.delete(`${this.apiUrl}/food/delete/${id}`).toPromise();

    this.dailyFoods = this.dailyFoods.filter((f) => f._id !== id);

    this.refreshData.emit();
  }

  editFood(food: any) {
    this.selectedFoodToEdit = { ...food };
    this.originalFoodToEdit = { ...food };
  }

  saveEditedFood() {
    if (!this.selectedFoodToEdit) return;

    const updated = { ...this.selectedFoodToEdit };
    const original = this.originalFoodToEdit ? { ...this.originalFoodToEdit } : null;

    const { _id, ...updateData } = updated;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Sessão expirada.');
      this.router.navigate(['/sign-in']);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    if (original && updated.grams && original.grams && updated.grams !== original.grams) {
      const factor = updated.grams / original.grams;
      updateData.calorias = +(original.calorias * factor).toFixed(2);
      updateData.proteinas = +(original.proteinas * factor).toFixed(2);
      updateData.carbo = +(original.carbo * factor).toFixed(2);
      updateData.gordura = +(original.gordura * factor).toFixed(2);
    }

    this.http.put(`${this.apiUrl}/food/update/${_id}`, updateData, { headers }).subscribe({
      next: async () => {
        const idx = this.dailyFoods.findIndex((f) => f._id === _id);
        if (idx !== -1) {
          this.dailyFoods[idx] = { _id, ...updateData };
        }

        if (original) {
          const diffCal = +((updateData.calorias ?? 0) - (original.calorias ?? 0)).toFixed(2);
          const diffProt = +((updateData.proteinas ?? 0) - (original.proteinas ?? 0)).toFixed(2);
          const diffCarb = +((updateData.carbo ?? 0) - (original.carbo ?? 0)).toFixed(2);
          const diffFat = +((updateData.gordura ?? 0) - (original.gordura ?? 0)).toFixed(2);

          if (diffCal !== 0 || diffProt !== 0 || diffCarb !== 0 || diffFat !== 0) {
            try {
              await firstValueFrom(
                this.http.post(
                  `${this.apiUrl}/intake/add`,
                  {
                    user_id: updated.user_id || original.user_id,
                    calorias: diffCal,
                    proteinas: diffProt,
                    carbo: diffCarb,
                    gordura: diffFat,
                  },
                  { headers }
                )
              );
            } catch (err) {
              console.warn('Não foi possível ajustar o intake com o delta.', err);
            }
          }
        }

        this.selectedFoodToEdit = null;
        this.originalFoodToEdit = null;

        this.refreshData.emit();
      },
      error: (err) => {
        console.error('Erro ao salvar:', err);
        alert('Falha ao atualizar alimento. Tente novamente.');
      },
    });
  }

  closePopup() {
    this.showDailyPopup = false;
    this.selectedFoodToEdit = null;
    this.originalFoodToEdit = null;
  }

  // =========================
  // lifecycle
  // =========================
  ngOnInit(): void {
    this.caloriasCircumference = 2 * Math.PI * this.outerRadius;
    this.proteinasCircumference = 2 * Math.PI * this.middleRadius;
    this.carbCircumference = 2 * Math.PI * this.innerRadius;
    this.gorduraCircumference = 2 * Math.PI * this.centerRadius;

    this.dailyFoods = [];

    // ⚠️ truque pro Safari / iOS:
    // primeiro paint = círculos vazios
    this.renderReady = false;
    requestAnimationFrame(() => {
      this.renderReady = true;
      this.animateValues();
    });
  }

  ngOnChanges(): void {
    // só anima se já passou o primeiro paint
    if (this.renderReady) {
      this.animateValues();
    }
  }

  // =========================
  // animação (com cancel)
  // =========================
  animateValues() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

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

    const step = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      this.animatedCalories =
        fromCalories + (toCalories - fromCalories) * easeOut;
      this.animatedProtein =
        fromProtein + (toProtein - fromProtein) * easeOut;
      this.animatedCarbs = fromCarbs + (toCarbs - fromCarbs) * easeOut;
      this.animatedFat = fromFat + (toFat - fromFat) * easeOut;

      this.cdr.detectChanges();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  // =========================
  // getters
  // =========================
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

  // ✅ agora SEM negativo, e com fallback pro 1º frame
  get caloriasOffset() {
    if (!this.renderReady) return this.caloriasCircumference;
    const pct = (this.animatedCalories / this.calorias.max) * 100;
    return this.caloriasCircumference * (1 - Math.min(pct, 100) / 100);
  }

  get proteinasOffset() {
    if (!this.renderReady) return this.proteinasCircumference;
    const pct = (this.animatedProtein / this.proteinas.max) * 100;
    return this.proteinasCircumference * (1 - Math.min(pct, 100) / 100);
  }

  get carbOffset() {
    if (!this.renderReady) return this.carbCircumference;
    const pct = (this.animatedCarbs / this.carb.max) * 100;
    return this.carbCircumference * (1 - Math.min(pct, 100) / 100);
  }

  get gorduraOffset() {
    if (!this.renderReady) return this.gorduraCircumference;
    const pct = (this.animatedFat / this.gordura.max) * 100;
    return this.gorduraCircumference * (1 - Math.min(pct, 100) / 100);
  }

  get formattedCalories() {
    return this.animatedCalories.toFixed(1);
  }
  get formattedProtein() {
    return this.animatedProtein.toFixed(1);
  }
  get formattedCarb() {
    return this.animatedCarbs.toFixed(1);
  }
  get formattedFat() {
    return this.animatedFat.toFixed(1);
  }
}
