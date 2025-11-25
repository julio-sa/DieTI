import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

type NumericField = 'calorias' | 'proteinas' | 'carbo' | 'gordura';

interface IntakeData {
  date: string; // "YYYY-MM-DD"
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
}

interface ChartPoint {
  date: string; // diário: "YYYY-MM-DD" | semanal: "YYYY-MM-DD..YYYY-MM-DD" | mensal: "YYYY-MM"
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
  __meta?: {
    kind: 'daily' | 'weekly' | 'monthly';
    year: number;
    month?: number;        // daily/weekly: mês do primeiro dia; monthly: 1..12
    daysInMonth?: number;  // monthly
    weekStart?: string;    // weekly: "YYYY-MM-DD"
    weekEnd?: string;      // weekly: "YYYY-MM-DD"
    daysInWeek?: number;   // weekly
  };
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.css'],
})
export class LineChartComponent implements OnInit, OnChanges {
  @Input() selectedPeriod = '7 dias';
  @Input() goals!: { calorias: number; proteinas: number; carbo: number; gordura: number };

  /** Largura da “janela” visível que rola (px). Não muda proporções do SVG. */
  @Input() viewportWidth = 300;

  @ViewChild('tooltip') tooltipElement!: ElementRef;

  private readonly apiUrl = environment.apiUrl;

  // colado no eixo Y
  private readonly x0 = 10;

  // tooltip
  showTooltip = false;
  tooltipText = '';
  tooltipX = 0;
  tooltipY = 0;

  // selects
  showMetricOptions = false;
  showPeriodOptions = false;

  // dados
  rawData: IntakeData[] = [];
  animatedData: ChartPoint[] = [];

  // 🔓 precisa ser pública porque o template usa
  viewMode: 'period' | 'monthDetail' | 'dailyPeriod' | 'weekDetail' = 'dailyPeriod';
  private selectedMonthKey: string | null = null;

  // legenda/indicadores
  private weekCaption: string = ''; // dd/MM — dd/MM quando em weekDetail

  metric: NumericField = 'calorias';

  readonly numericFields: NumericField[] = ['calorias', 'proteinas', 'carbo', 'gordura'];
  readonly periodOptions = ['7 dias', '1 mês', '1 trimestre', '1 semestre', '1 ano'] as const;

  readonly colors: Record<NumericField, string> = {
    calorias: '#006e8c',
    proteinas: '#00bfff',
    carbo: '#4fc3f7',
    gordura: '#a5d8ff',
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadHistory(); }
  ngOnChanges(): void { this.loadHistory(); }
  public reload(): void { this.loadHistory(); }

  // ===== carga =====
  private daysFromPrevious25ToToday(): number {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 25);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.ceil((today.setHours(0,0,0,0) as unknown as number - prevMonth.setHours(0,0,0,0)) / msPerDay) + 1;
    return Math.max(diff, 1);
  }

  private getDaysForPeriod(): number {
    if (this.selectedPeriod === '1 mês') return this.daysFromPrevious25ToToday();
    const map: Record<string, number> = {
      '7 dias': 7,
      '1 trimestre': 90,
      '1 semestre': 180,
      '1 ano': 365,
    };
    return map[this.selectedPeriod] ?? 7;
  }

  private loadHistory(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const days = this.getDaysForPeriod();

    this.http
      .get<IntakeData[]>(`${this.apiUrl}/intake/history?user_id=${userId}&days=${days}`)
      .subscribe((data) => {
        this.rawData = (data ?? []).map((d) => ({
          ...d,
          calorias: Number(d.calorias || 0),
          proteinas: Number(d.proteinas || 0),
          carbo: Number(d.carbo || 0),
          gordura: Number(d.gordura || 0),
        }));

        this.weekCaption = '';

        if (this.selectedPeriod === '7 dias') {
          this.viewMode = 'dailyPeriod';
          this.selectedMonthKey = null;
          const dailyPoints = this.mapDaily(this.rawData);
          this.animateTo(dailyPoints);
        } else if (this.selectedPeriod === '1 mês') {
          // visão semanal (blocos de 7 dias)
          this.viewMode = 'dailyPeriod';
          this.selectedMonthKey = null;
          const weekly = this.aggregateWeeklyWindow(this.rawData);
          this.animateTo(weekly);
        } else {
          this.viewMode = 'period';
          this.selectedMonthKey = null;
          const monthlyPoints = this.aggregateMonthly(this.rawData);
          this.animateTo(monthlyPoints);
        }
      });
  }

  private mapDaily(data: IntakeData[]): ChartPoint[] {
    return data.map((d) => {
      const [y, m] = d.date.split('-').map(Number);
      return {
        date: d.date,
        calorias: d.calorias,
        proteinas: d.proteinas,
        carbo: d.carbo,
        gordura: d.gordura,
        __meta: { kind: 'daily', year: y, month: m },
      } as ChartPoint;
    });
  }

  private aggregateWeeklyWindow(data: IntakeData[]): ChartPoint[] {
    if (data.length === 0) return [];

    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const parse = (s: string) => {
      const [yy, mm, dd] = s.split('-').map(Number);
      return new Date(yy, mm - 1, dd);
    };
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const addDays = (d: Date, n: number) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + n);
      return nd;
    };

    let start = parse(sorted[0].date);
    const end = parse(sorted[sorted.length - 1].date);

    const buckets: ChartPoint[] = [];

    while (start <= end) {
      const weekStart = new Date(start);
      const weekEnd = addDays(weekStart, 6);
      const capEnd = weekEnd > end ? end : weekEnd;

      let kc = 0, pr = 0, cb = 0, gd = 0;
      for (const d of sorted) {
        const dt = parse(d.date);
        if (dt >= weekStart && dt <= capEnd) {
          kc += d.calorias; pr += d.proteinas; cb += d.carbo; gd += d.gordura;
        }
      }

      const daysInWeek = Math.floor((capEnd.getTime() - weekStart.getTime()) / (24*3600*1000)) + 1;

      const cp: ChartPoint = {
        date: `${fmt(weekStart)}..${fmt(capEnd)}`,
        calorias: kc, proteinas: pr, carbo: cb, gordura: gd,
        __meta: {
          kind: 'weekly',
          year: weekStart.getFullYear(),
          month: weekStart.getMonth() + 1,
          weekStart: fmt(weekStart),
          weekEnd: fmt(capEnd),
          daysInWeek
        }
      };
      buckets.push(cp);

      start = addDays(capEnd, 1);
    }

    return buckets;
  }

  private aggregateMonthly(data: IntakeData[]): ChartPoint[] {
    const buckets = new Map<string, { y: number; m: number; sum: IntakeData; days: number }>();

    for (const d of data) {
      const [y, m] = d.date.split('-').map(Number);
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, { y, m, days: 1, sum: { ...d } });
      } else {
        bucket.days += 1;
        bucket.sum.calorias += d.calorias;
        bucket.sum.proteinas += d.proteinas;
        bucket.sum.carbo += d.carbo;
        bucket.sum.gordura += d.gordura;
      }
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        date: key,
        calorias: v.sum.calorias,
        proteinas: v.sum.proteinas,
        carbo: v.sum.carbo,
        gordura: v.sum.gordura,
        __meta: { kind: 'monthly', year: v.y, month: v.m, daysInMonth: v.days },
      }));
  }

  /** Diários filtrando por intervalo inclusive */
  private filterDailyForRange(startISO: string, endISO: string): ChartPoint[] {
    const s = startISO;
    const e = endISO;
    return this.mapDaily(this.rawData).filter(p => p.date >= s && p.date <= e);
  }

  private filterDailyForMonth(monthKey: string): ChartPoint[] {
    return this.mapDaily(this.rawData).filter((p) => p.date.startsWith(monthKey));
  }

  // ===== animação =====
  private animateTo(targetData: ChartPoint[]) {
    const hasStart = this.animatedData.length === targetData.length;
    const startData = hasStart
      ? this.animatedData.map((x) => ({ ...x }))
      : targetData.map((pt) => {
          const goal = this.getGoalForPoint(pt);
          return {
            date: pt.date,
            calorias: this.goals.calorias ? goal : pt.calorias,
            proteinas: this.goals.proteinas
              ? pt.__meta?.kind === 'monthly'
                ? this.goals.proteinas * (pt.__meta?.daysInMonth ?? 30)
                : pt.__meta?.kind === 'weekly'
                  ? this.goals.proteinas * (pt.__meta?.daysInWeek ?? 7)
                  : this.goals.proteinas
              : pt.proteinas,
            carbo: this.goals.carbo
              ? pt.__meta?.kind === 'monthly'
                ? this.goals.carbo * (pt.__meta?.daysInMonth ?? 30)
                : pt.__meta?.kind === 'weekly'
                  ? this.goals.carbo * (pt.__meta?.daysInWeek ?? 7)
                  : this.goals.carbo
              : pt.carbo,
            gordura: this.goals.gordura
              ? pt.__meta?.kind === 'monthly'
                ? this.goals.gordura * (pt.__meta?.daysInMonth ?? 30)
                : pt.__meta?.kind === 'weekly'
                  ? this.goals.gordura * (pt.__meta?.daysInWeek ?? 7)
                  : this.goals.gordura
              : pt.gordura,
            __meta: pt.__meta,
          } as ChartPoint;
        });

    const duration = 900;
    const start = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.animatedData = startData.map((s, i) => {
        const t = targetData[i] ?? s;
        return {
          date: t.date,
          calorias: s.calorias + (t.calorias - s.calorias) * ease,
          proteinas: s.proteinas + (t.proteinas - s.proteinas) * ease,
          carbo: s.carbo + (t.carbo - s.carbo) * ease,
          gordura: s.gordura + (t.gordura - s.gordura) * ease,
          __meta: t.__meta,
        };
      });

      this.cdr.detectChanges();
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  // ===== interações =====
  onPointClick(item: ChartPoint, event?: Event) {
    event?.stopPropagation();
    event?.preventDefault();

    // Clique em mês (1 tri/sem/ano) -> detalha dias do mês
    if (this.viewMode === 'period' && item.__meta?.kind === 'monthly') {
      this.selectedMonthKey = item.date; // "YYYY-MM"
      this.viewMode = 'monthDetail';
      this.weekCaption = '';
      const daily = this.filterDailyForMonth(item.date);
      this.animateTo(daily);
      return;
    }

    // Clique em semana (quando período é 1 mês) -> detalha dias da semana
    if ((this.viewMode === 'dailyPeriod') && item.__meta?.kind === 'weekly') {
      const ws = item.__meta?.weekStart!;
      const we = item.__meta?.weekEnd!;
      this.viewMode = 'weekDetail';
      this.weekCaption = `${this.formatDM(ws)} — ${this.formatDM(we)}`;
      const daily = this.filterDailyForRange(ws, we);
      this.animateTo(daily);
      return;
    }

    // Popup apenas para pontos DIÁRIOS
    if (
      (this.viewMode === 'weekDetail' || this.viewMode === 'monthDetail' || this.viewMode === 'dailyPeriod')
      && item.__meta?.kind === 'daily'
    ) {
      this.openHistoricalFoodPopupDaily(item);
    }
  }

  public selectPeriod(period: string) {
    this.selectedPeriod = period;
    this.viewMode = period === '7 dias' || period === '1 mês' ? 'dailyPeriod' : 'period';
    this.selectedMonthKey = null;
    this.weekCaption = '';
    this.loadHistory();
  }

  // ===== painel histórico abaixo =====
  historicalFoods: any[] = [];
  historicalDate = '';
  showHistoricalPopup = false;

  get hasHistoricalFoods(): boolean {
    return Array.isArray(this.historicalFoods) && this.historicalFoods.length > 0;
  }

  private openHistoricalFoodPopupDaily(item: ChartPoint) {
    const isDaily = item.__meta?.kind === 'daily' || /^\d{4}-\d{2}-\d{2}$/.test(item.date);
    if (!isDaily) return;

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
          const foods: any[] = Array.isArray(res)
            ? res
            : Array.isArray(res?.foods)
            ? res.foods
            : Array.isArray(res?.items)
            ? res.items
            : Array.isArray(res?.data)
            ? res.data
            : [];
          this.historicalFoods = foods;
          this.showHistoricalPopup = true; // painel abaixo
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erro ao buscar alimentos do histórico:', err);
          this.historicalFoods = [];
          this.showHistoricalPopup = true; // painel vazio
          this.cdr.detectChanges();
        },
      });
  }

  // ===== tooltip =====
  onPointHover(event: MouseEvent, item: ChartPoint, _index: number) {
    const value = this.getValue(item, this.metric);
    const goal = this.getGoalForPoint(item);

    let label = '';
    if (item.__meta?.kind === 'monthly') {
      label = this.formatMonthLabel(item);
    } else if (item.__meta?.kind === 'weekly') {
      label = this.formatWeekLabel(item);
    } else {
      label = this.formatDate(item.date);
    }

    this.tooltipText = `${label} — ${this.capitalize(this.metric)}: ${value.toFixed(1)} / ${goal}`;

    const container = (event.currentTarget as SVGCircleElement).closest('.chart-container') as HTMLElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    this.tooltipX = event.clientX - rect.left + 10;
    this.tooltipY = event.clientY - rect.top - 30;

    this.showTooltip = true;
  }

  hideTooltip() {
    this.showTooltip = false;
  }

  // ===== helpers desenho/format =====
  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  }

  private formatDM(s: string): string {
    const [Y,M,D] = s.split('-').map(Number);
    return `${String(D).padStart(2,'0')}/${String(M).padStart(2,'0')}`;
  }

  formatDate(date: string): string {
    const d = this.parseLocalDate(date);
    if (this.selectedPeriod === '7 dias') {
      const weekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      return weekday[d.getDay()];
    }
    return `${d.getDate()}`;
  }

  public formatMonthLabel(pt: ChartPoint): string {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const m = (pt.__meta?.month ?? Number(pt.date.split('-')[1])) - 1;
    const y = (pt.__meta?.year ?? Number(pt.date.split('-')[0])) % 100;
    return `${months[Math.max(0, m)]}/${String(y).padStart(2,'0')}`;
  }

  public formatWeekLabel(pt: ChartPoint): string {
    const a = pt.__meta?.weekStart ?? pt.date.split('..')[0];
    const b = pt.__meta?.weekEnd ?? pt.date.split('..')[1];
    return `${this.formatDM(a)} — ${this.formatDM(b)}`;
  }

  /** legenda do mês quando detalhando um mês (abaixo do gráfico) */
  public getSelectedMonthLabel(): string {
    if (!this.selectedMonthKey) return '';
    const [yStr, mStr] = this.selectedMonthKey.split('-');
    const dummy: ChartPoint = {
      date: this.selectedMonthKey,
      calorias: 0, proteinas: 0, carbo: 0, gordura: 0,
      __meta: { kind: 'monthly', year: Number(yStr), month: Number(mStr), daysInMonth: 30 }
    };
    return this.formatMonthLabel(dummy);
  }

  /** legenda geral do período para 1 trimestre / 1 semestre / 1 ano */
  public getPeriodCaption(): string {
    if (!['1 trimestre','1 semestre','1 ano'].includes(this.selectedPeriod) || this.animatedData.length === 0) return '';
    const first = this.animatedData[0];
    const last = this.animatedData[this.animatedData.length - 1];
    const a = this.formatMonthLabel(first);
    const b = this.formatMonthLabel(last);
    return `Período: ${a} — ${b}`;
  }

  /** legenda quando em detalhe de semana */
  public getWeekCaption(): string {
    return this.viewMode === 'weekDetail' && this.weekCaption ? this.weekCaption : '';
  }

  getValue(data: ChartPoint, field: NumericField): number {
    return Number(data[field] || 0);
  }

  public getGoalForPoint(pt: ChartPoint): number {
    const base = this.goals[this.metric] || 0;
    if (pt.__meta?.kind === 'monthly') {
      const d = pt.__meta?.daysInMonth ?? 30;
      return Math.round(base * d);
    }
    if (pt.__meta?.kind === 'weekly') {
      const d = pt.__meta?.daysInWeek ?? 7;
      return Math.round(base * d);
    }
    return base;
  }

  /** y a partir do % da meta */
  public tickY(percent: number): number {
    return 250 - percent * 2; // 0..100 -> 250..50
  }

  getYCoord(value: number, goal: number): number {
    if (goal <= 0) return 250;
    const percentage = Math.min(value / goal, 1);
    return 250 - percentage * 200;
  }

  /** x do ponto: não muda o SVG, só o espaçamento */
  public getX(index: number, n: number): number {
    return this.x0 + index * this.getPointSpacing(n);
  }

  /** x do rótulo (evita cortar o primeiro mensal) */
  public getXLabel(index: number, n: number, item: ChartPoint): number {
    const x = this.getX(index, n);
    if (index === 0 && (item.__meta?.kind === 'monthly')) {
      return x + 10; // leve offset no primeiro mensal
    }
    return x;
  }

  /** rótulo de semana: índice simples (1,2,3,...) */
  public getWeekIndexLabel(index: number): string {
    return String(index + 1);
  }

  /** largura do SVG para rolagem */
  public getSvgPixelWidth(): number {
    const n = Math.max(1, this.animatedData.length);
    const spacing = this.getPointSpacing(n);
    const needed = this.x0 + (n - 1) * spacing + 20;
    return Math.max(700, needed);
  }

  getPointSpacing(n: number): number {
    const xMin = this.x0;
    const xMax = 680 - (60 - this.x0);
    const usable = xMax - xMin;
    if (n <= 1) return usable;

    const base = Math.max(5, Math.floor(usable / (n - 1)));

    let factor = 1;
    if (this.selectedPeriod === '7 dias') {
      factor = 0.40;
    } else if (this.selectedPeriod === '1 trimestre') {
      factor = 0.40;
    } else if (this.selectedPeriod === '1 semestre') {
      factor = 0.47;
    } else if (this.selectedPeriod === '1 mês') {
      factor = 0.40;
    }

    return Math.max(3, Math.floor(base * factor));
  }

  // ===== globais =====
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const insideSelect = target.closest('.custom-select');
    if (!insideSelect) {
      this.showMetricOptions = false;
      this.showPeriodOptions = false;
    }
  }

  capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
}
