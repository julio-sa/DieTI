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

  readonly periodOptions = ['7 dias', '1 mês', '1 trimestre', '1 semestre', '1 ano'] as const;

  readonly colors: Record<NumericField, string> = {
    calorias: '#006e8c',
    proteinas: '#00bfff',
    carbo: '#4fc3f7',
    gordura: '#a5d8ff',
  };

  // ---------- Layout dinâmico ----------
  readonly MARGIN = { left: 50, right: 30, top: 20, bottom: 50 };

  /** padding interno no eixo X para o 1º/último ponto não encostarem nas bordas */
  get innerPad(): number {
    // proporcional ao espaçamento, limitado a 8..15
    return Math.max(8, Math.min(15, this.pointSpacing * 0.25));
  }

  get svgHeight(): number {
    return 300; // altura base (CSS ajusta por breakpoint se necessário)
  }

  get svgWidth(): number {
    const n = Math.max(this.animatedData.length, 1);
    // largura interna = pad esquerda + (n-1)*spacing + pad direita
    const inner = this.innerPad * 2 + Math.max(n - 1, 0) * this.pointSpacing;
    return this.MARGIN.left + inner + this.MARGIN.right;
  }

  get xAxisEnd(): number {
    return this.svgWidth - this.MARGIN.right;
  }

  xPos(index: number): number {
    return this.MARGIN.left + this.innerPad + index * this.pointSpacing;
  }

  // ---------- Rótulos do eixo X rarificados ----------
  get maxXLabels(): number {
    const mobile = window.innerWidth <= 425;
    if (this.selectedPeriod === '1 ano') {
      // mais agressivo em 1 ano
      return mobile ? 4 : 8;
    }
    return mobile ? 6 : 10;
  }

  get xLabelStep(): number {
    const n = Math.max(this.animatedData.length, 1);
    return Math.max(1, Math.ceil(n / this.maxXLabels));
  }

  shouldShowXLabel(index: number): boolean {
    const last = this.animatedData.length - 1;
    return index === 0 || index === last || index % this.xLabelStep === 0;
  }

  get xLabelFontSize(): number {
    switch (this.selectedPeriod) {
      case '7 dias':      return 12;
      case '1 mês':       return 11;
      case '1 trimestre': return 10;
      case '1 semestre':  return 9;
      case '1 ano':       return 8;
      default:            return 10;
    }
  }

  get pointRadius(): number {
    switch (this.selectedPeriod) {
      case '7 dias':      return 6;
      case '1 mês':       return 5;
      case '1 trimestre': return 4;
      case '1 semestre':  return 3;
      case '1 ano':       return 2;
      default:            return 4;
    }
  }

  get strokeWidth(): number {
    switch (this.selectedPeriod) {
      case '7 dias':      return 3;
      case '1 mês':       return 2.5;
      case '1 trimestre': return 2.2;
      case '1 semestre':  return 2;
      case '1 ano':       return 1.8;
      default:            return 2.2;
    }
  }

  // ===================
  // popup de histórico
  // ===================
  get hasHistoricalFoods(): boolean {
    return Array.isArray(this.historicalFoods) && this.historicalFoods.length > 0;
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

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
          this.showHistoricalPopup = true;
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
        // valor REAL
        this.rawData = data ?? [];

        // valor INICIAL "cheio"
        this.animatedData = this.rawData.map(item => ({
          date: item.date,
          calorias: this.goals.calorias,
          proteinas: this.goals.proteinas,
          carbo: this.goals.carbo,
          gordura: this.goals.gordura
        }));

        this.cdr.detectChanges();
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

    const startData = this.animatedData.map(item => ({ ...item }));
    const targetData = this.rawData.map(item => ({ ...item }));

    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

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
  // eixos / path
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

    if (this.selectedPeriod === '1 ano') {
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      return meses[finalDate.getMonth()];
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
        const x = this.xPos(i);
        const value = d[field];
        const goal = this.goals[field];
        const y = this.getYCoord(value, goal);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  getYCoord(value: number, goal: number): number {
    if (goal === 0) return this.svgHeight - this.MARGIN.bottom;
    const percentage = Math.min(value / goal, 1);
    const usable = 200; // altura útil
    const base = this.svgHeight - this.MARGIN.bottom;
    return base - percentage * usable;
  }

  get pointSpacing(): number {
    const base = (() => {
      switch (this.selectedPeriod) {
        case '7 dias':      return 90;
        case '1 mês':       return 28;
        case '1 trimestre': return 14;
        case '1 semestre':  return 8;
        case '1 ano':       return 6;
        default:            return 20;
      }
    })();

    const n = Math.max(this.animatedData.length, 1);
    if (n > 200) return Math.max(4, base * 0.8);
    if (n > 120) return Math.max(5, base * 0.9);
    return base;
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
