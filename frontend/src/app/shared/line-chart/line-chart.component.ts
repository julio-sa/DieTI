import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core';
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
  styleUrls: ['./line-chart.component.css']
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

  historicalFoods: any[] = [];
  historicalDate: string = '';
  showHistoricalPopup: boolean = false;
  showMetricOptions = false;
  showPeriodOptions = false;

  showTooltip = false;
  tooltipText = '';
  tooltipX = 0; 
  tooltipY = 0;

  rawData: IntakeData[] = [];
  animatedData: IntakeData[] = [];

  metric: NumericField = 'calorias';

  private lastTouchTime = 0;

  private isMobileDevice(): boolean {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // ✅ Array seguro definido no TS
  readonly numericFields: NumericField[] = ['calorias', 'proteinas', 'carbo', 'gordura'];

  periodOptions = ['7 dias', '1 mês', '1 trimestre', '1 semestre', '1 ano'] as const;

  // ✅ Cores com tipo explícito
  readonly colors: Record<NumericField, string> = {
    calorias: '#006e8c',
    proteinas: '#00bfff',
    carbo: '#4fc3f7',
    gordura: '#a5d8ff'
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  openHistoricalFoodPopup(item: IntakeData) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    
    if (!userId || !token) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    this.historicalDate = item.date;
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.get<any[]>(`${this.apiUrl}/food/history/${item.date}?user_id=${userId}`, { headers })
      .subscribe({
        next: (foods) => {
          this.historicalFoods = foods;
          this.showHistoricalPopup = true;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erro ao buscar alimentos:', err);
          alert('Erro ao carregar alimentos para esta data.');
        }
      });
  }

  // Mapeia o label exibido para a data real
  getDateFromLabel(label: string, index: number): string {
    // animatedData tem as datas reais
    return this.animatedData[index]?.date || '';
  }


  ngOnInit(): void {
    this.historicalFoods = [];
    this.loadHistory();
  }

  ngOnChanges(): void {
    this.loadHistory();
    this.animateData();
  }

  onMetricChange() {
    this.animateData();
  }

  onSelectTouch(event: TouchEvent, type: 'metric' | 'period') {
    const now = Date.now();
    // Impede cliques muito rápidos (300ms)
    if (now - this.lastTouchTime < 300) {
      event.preventDefault();
      return;
    }
    
    this.lastTouchTime = now;
    
    if (type === 'metric') {
      this.toggleMetricOptions();
    } else {
      this.togglePeriodOptions();
    }
  }

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

    this.http.get<IntakeData[]>(`${this.apiUrl}/intake/history?user_id=${userId}&days=${days}`)
      .subscribe(data => {

        // ✅ Garante nova referência para forçar detecção
        this.rawData = JSON.parse(JSON.stringify(data));

        // ✅ Reinicia animatedData antes da animação
        this.animatedData = this.rawData.map(item => ({
          ...item,
          calorias: 0,
          proteinas: 0,
          carbo: 0,
          gordura: 0
        }));

        // ✅ Força detecção antes da animação
        this.cdr.detectChanges();

        // ✅ Inicia animação do zero
        this.animateData();
      });
  }

  reload(): void {
    this.loadHistory();
  }
  // Método chamado ao passar o mouse sobre um ponto    
  onPointHover(event: MouseEvent, item: IntakeData, index: number) {
    const value = this.getValue(item, this.metric);
    const goal = this.goals[this.metric];

    this.tooltipText = `${this.capitalize(this.metric)}: ${value.toFixed(1)} / ${goal}`;

    const chartRect = (event.currentTarget as SVGCircleElement).ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!chartRect) return;

    this.tooltipX = event.clientX - chartRect.left + window.scrollX;
    this.tooltipY = event.clientY - chartRect.top + window.scrollY - 30;

    this.showTooltip = true;
  }

  // Ao sair do ponto
  hideTooltip() {
    this.showTooltip = false;
  }

  formatGoalValue(percentage: number): string {
    const goal = this.goals[this.metric];
    const value = Math.round(goal * percentage);
    return `${value} ${this.getUnit()}`;
  }

  getUnit(): string {
    switch (this.metric) {
      case 'calorias': return 'kcal';
      case 'proteinas':
      case 'carbo':
      case 'gordura': return 'g';
      default: return '';
    }
  }

  animateData() {
    const duration = 1000;
    const start = performance.now();

    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // ✅ Recalcula animatedData em cada frame
      this.animatedData = this.rawData.map(item => ({
        date: item.date,
        calorias: item.calorias * easeOut,
        proteinas: item.proteinas * easeOut,
        carbo: item.carbo * easeOut,
        gordura: item.gordura * easeOut
      }));

      // ✅ Força detecção visual
      this.cdr.detectChanges();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  get xLabels(): string[] {
    const step = this.selectedPeriod === '7 dias' ? 1 :
                this.selectedPeriod === '1 mês' ? 2 :
                this.selectedPeriod === '3 meses' ? 3 :
                this.selectedPeriod === '6 meses' ? 6 :
                this.selectedPeriod === '1 ano' ? 12 : 1;

    return this.animatedData.map((d, i) => {
      const date = new Date(d.date);
      const day = date.getDate();
      if (i % step === 0) {
        return `${day}`;
      }
      return ''; // pula alguns labels
    });
  }

  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // Usa ano/mês/dia sem fuso
  }
  formatDate(date: string): string {
  const dateObj = this.parseLocalDate(date);

  if (this.selectedPeriod === '7 dias') {
    const weekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    return weekday[dateObj.getDay()];
  }

  return `${dateObj.getDate()}`; // Mostra o dia correto
}

  getValue(data: IntakeData, field: keyof IntakeData): number {
    const value = data[field];
    return typeof value === 'number' ? value : 0;
  }

  getLinePath(data: IntakeData[], field: NumericField): string {
    return data.map((d, i) => {
      const x = 60 + i * this.pointSpacing;
      const value = d[field];
      const goal = this.goals[field];
      const y = this.getYCoord(value, goal);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }

  getYCoord(value: number, goal: number): number {
    if (goal === 0) return 250; // evita divisão por zero
    const percentage = Math.min(value / goal, 1); // limita em 100%
    return 250 - (percentage * 200); // escala para o SVG
  }

  // Para capitalizar o nome da métrica
  capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  get pointSpacing(): number {
    switch (this.selectedPeriod) {
      case '7 dias': return 90;
      case '1 mês': return 30;
      case '3 meses': return 15;
      case '6 meses': return 8;
      case '1 ano': return 5;
      default: return 90;
    }
  }

  // Fechar dropdowns ao clicar fora
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
    this.onMetricChange();
  }

  selectPeriod(period: string) {
    this.selectedPeriod = period;
    this.showPeriodOptions = false;
    this.loadHistory();
  }

  getMetricLabel(field: NumericField): string {
    const labels: Record<NumericField, string> = {
      calorias: 'Calorias',
      proteinas: 'Proteínas',
      carbo: 'Carbo',
      gordura: 'Gordura'
    };
    return labels[field];
  }
}