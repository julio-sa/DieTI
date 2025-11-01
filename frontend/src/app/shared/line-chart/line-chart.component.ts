import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface IntakeData {
  date: string;
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
}

type NumericField = 'calorias' | 'proteinas' | 'carbo' | 'gordura';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.css'],
})
export class LineChartComponent implements OnInit, OnChanges {
  @Input() selectedPeriod = '7 dias';
  @Output() refreshData = new EventEmitter<void>();
  @Input() goals!: {
    calorias: number;
    proteinas: number;
    carbo: number;
    gordura: number;
  };
  @ViewChild('tooltip') tooltipElement!: ElementRef;

  private readonly apiUrl = environment.apiUrl;

  // popup de histórico
  historicalFoods: any[] = [];
  historicalDate = '';
  showHistoricalPopup = false;

  // selects
  showMetricOptions = false;
  showPeriodOptions = false;

  // tooltip
  showTooltip = false;
  tooltipText = '';
  tooltipX = 0;
  tooltipY = 0;

  // dados
  rawData: IntakeData[] = [];
  animatedData: IntakeData[] = [];

  metric: NumericField = 'calorias';

  private lastTouchTime = 0;

  readonly numericFields: NumericField[] = ['calorias', 'proteinas', 'carbo', 'gordura'];

  // nota: aqui use sempre os mesmos nomes no HTML
  readonly periodOptions = ['7 dias', '1 mês', '1 trimestre', '1 semestre', '1 ano'] as const;

  // cores
  readonly colors: Record<NumericField, string> = {
    calorias: '#006e8c',
    proteinas: '#00bfff',
    carbo: '#4fc3f7',
    gordura: '#a5d8ff',
  };

  get hasHistoricalFoods(): boolean {
    return Array.isArray(this.historicalFoods) && this.historicalFoods.length > 0;
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  // ===================
  // popup de histórico
  // ===================
  openHistoricalFoodPopup(item: IntakeData) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    this.historicalDate = item.date;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    this.http
      .get<any>(`${this.apiUrl}/food/history/${item.date}?user_id=${userId}`, { headers })
      .subscribe({
        next: (res: any) => {
          const foods: any[] =
            Array.isArray(res)
              ? res
              : Array.isArray(res?.foods)
              ? res.foods
              : Array.isArray(res?.items)
              ? res.items
              : Array.isArray(res?.data)
              ? res.data
              : [];

          this.historicalFoods = foods;
          this.showHistoricalPopup = true;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erro ao buscar alimentos do histórico:', err);
          this.historicalFoods = [];
          this.showHistoricalPopup = true; // mostra pra usuário saber que não tem
          this.cdr.detectChanges();
        },
      });
  }

  onPointClick(item: IntakeData, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.openHistoricalFoodPopup(item);
  }

  // ===================
  // lifecycle
  // ===================
  ngOnInit(): void {
    this.historicalFoods = [];
    this.loadHistory();
  }

  ngOnChanges(): void {
    this.loadHistory();
    this.animateData();
  }

  // ===================
  // carga do gráfico
  // ===================
  loadHistory() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const daysMap: Record<string, number> = {
      '7 dias': 7,
      '1 mês': 30,
      '1 trimestre': 90,
      '1 semestre': 180,
      '1 ano': 365
    };
    const days = daysMap[this.selectedPeriod] || 7;

    this.http
      .get<IntakeData[]>(`${this.apiUrl}/intake/history?user_id=${userId}&days=${days}`)
      .subscribe(data => {
        // 1) guarda o valor REAL
        this.rawData = data ?? [];

        // 2) monta o valor INICIAL cheio (começa lotado)
        this.animatedData = this.rawData.map(item => ({
          date: item.date,
          calorias: this.goals.calorias,
          proteinas: this.goals.proteinas,
          carbo: this.goals.carbo,
          gordura: this.goals.gordura
        }));

        // 3) força detecção
        this.cdr.detectChanges();

        // 4) anima descendo até o real
        this.animateData();
      });
  }


  reload(): void {
    this.loadHistory();
  }

  // ===================
  // tooltip
  // ===================
  onPointHover(event: MouseEvent, item: IntakeData, _index: number) {
    const value = this.getValue(item, this.metric);
    const goal = this.goals[this.metric];

    this.tooltipText = `${this.capitalize(this.metric)}: ${value.toFixed(1)} / ${goal}`;

    const chartRect = (event.currentTarget as SVGCircleElement).ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!chartRect) return;

    this.tooltipX = event.clientX - chartRect.left + window.scrollX;
    this.tooltipY = event.clientY - chartRect.top + window.scrollY - 30;

    this.showTooltip = true;
  }

  hideTooltip() {
    this.showTooltip = false;
  }

  // ===================
  // animação
  // ===================
  animateData() {
    const duration = 900; // ms
    const start = performance.now();

    // snapshot do estado CHEIO (o que tá na tela agora)
    const startData = this.animatedData.map(item => ({ ...item }));
    // alvo = dados reais
    const targetData = this.rawData.map(item => ({ ...item }));

    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      // easing pra ficar gostoso
      const ease = 1 - Math.pow(1 - progress, 3);

      // faz LERP campo a campo
      this.animatedData = startData.map((startItem, idx) => {
        const targetItem = targetData[idx] ?? startItem;

        return {
          date: targetItem.date,
          calorias: startItem.calorias + (targetItem.calorias - startItem.calorias) * ease,
          proteinas: startItem.proteinas + (targetItem.proteinas - startItem.proteinas) * ease,
          carbo: startItem.carbo + (targetItem.carbo - startItem.carbo) * ease,
          gordura: startItem.gordura + (targetItem.gordura - startItem.gordura) * ease,
        };
      });

      this.cdr.detectChanges();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }


  // ===================
  // formatação de eixos
  // ===================
  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  formatDate(date: string): string {
    const d = this.parseLocalDate(date);
    const today = new Date();

    const isTomorrow =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate() + 1;

    const finalDate = isTomorrow ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1) : d;

    if (this.selectedPeriod === '7 dias') {
      const weekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      return weekday[finalDate.getDay()];
    }

    return `${finalDate.getDate()}`;
  }

  getValue(data: IntakeData, field: keyof IntakeData): number {
    const value = data[field];
    return typeof value === 'number' ? value : 0;
  }

  getLinePath(data: IntakeData[], field: NumericField): string {
    return data
      .map((d, i) => {
        const x = 60 + i * this.pointSpacing;
        const value = d[field];
        const goal = this.goals[field];
        const y = this.getYCoord(value, goal);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  getYCoord(value: number, goal: number): number {
    if (goal === 0) return 250;
    const percentage = Math.min(value / goal, 1);
    return 250 - percentage * 200;
  }

  get pointSpacing(): number {
    switch (this.selectedPeriod) {
      case '7 dias':
        return 90;
      case '1 mês':
        return 30;
      case '1 trimestre':
        return 15;
      case '1 semestre':
        return 8;
      case '1 ano':
        return 5;
      default:
        return 90;
    }
  }

  // ===================
  // selects mobile
  // ===================
  private isMobileDevice(): boolean {
    return (
      window.innerWidth <= 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const insideSelect = target.closest('.custom-select');
    if (!insideSelect) {
      this.showMetricOptions = false;
      this.showPeriodOptions = false;
    }
  }

  toggleMetricOptions() {
    if (this.isMobileDevice()) {
      this.showMetricOptions = !this.showMetricOptions;
      if (this.showMetricOptions) this.showPeriodOptions = false;
    }
  }

  togglePeriodOptions() {
    if (this.isMobileDevice()) {
      this.showPeriodOptions = !this.showPeriodOptions;
      if (this.showPeriodOptions) this.showMetricOptions = false;
    }
  }

  selectMetric(field: NumericField) {
    this.metric = field;
    this.showMetricOptions = false;
    this.animateData();
  }

  selectPeriod(period: string) {
    this.selectedPeriod = period;
    this.showPeriodOptions = false;
    this.loadHistory();
  }

  formatGoalValue(percentage: number): string {
    const goal = this.goals[this.metric];
    const value = Math.round(goal * percentage);
    return `${value} ${this.getUnit()}`;
  }

  getUnit(): string {
    switch (this.metric) {
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

  capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  getMetricLabel(field: NumericField): string {
    const labels: Record<NumericField, string> = {
      calorias: 'Calorias',
      proteinas: 'Proteínas',
      carbo: 'Carbo',
      gordura: 'Gordura',
    };
    return labels[field];
  }
}
