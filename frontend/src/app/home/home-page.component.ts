import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NutritionalInfo, TacoService } from '../services/taco.service';
import { LineChartComponent } from '../shared/line-chart/line-chart.component';
import { MultiRingChartComponent } from '../shared/multi-ring-chart/multi-ring-chart.component';

interface FoodData {
  user_id: string;
  description: string;
  grams: number;
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
  date?: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterModule, MultiRingChartComponent, LineChartComponent, FormsModule],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements AfterViewInit {
  @ViewChild('searchResultsContainer') searchResultsContainer!: ElementRef;
  @ViewChild('foodInput') foodInput!: ElementRef;
  @ViewChildren('searchItem') searchItems!: QueryList<ElementRef>;
  @ViewChild('buttonLeft') buttonLeft!: ElementRef<HTMLButtonElement>;
  @ViewChild(LineChartComponent) lineChartComponent!: LineChartComponent;
  @ViewChild(MultiRingChartComponent) ringChartComponent!: MultiRingChartComponent;

  activeMenu = false;
  sliderPosition = '0';
  isLeftActive = true;
  showInstallPrompt = false;

  favoriteRecipes: any[] = [];
  menuState: { activeMenu: string } | null = { activeMenu: '' };

  private readonly apiUrl = environment.apiUrl;

  searchQuery = '';
  searchResults: NutritionalInfo[] = [];
  selectedItemIndex = -1;
  private searchSubject = new Subject<string>();
  private isSelectingFromResults = false;

  selectedFood: NutritionalInfo | null = null;
  selectedRecipe: any = null;
  grams = 100;
  popupVisible = false;

  isOnline = true;
  pendingFoods: FoodData[] = [];

  // estado “oficial” mostrado nos anéis
  dailyIntake = {
    calorias: 0,
    proteinas: 0,
    carbo: 0,
    gordura: 0,
  };

  // metas
  goals = {
    calorias: 2704,
    proteinas: 176,
    carbo: 320,
    gordura: 80,
  };

  // dados que alimentam o componente do gráfico
  caloriasData = { value: 0, max: this.goals.calorias };
  proteinasData = { value: 0, max: this.goals.proteinas };
  carbData = { value: 0, max: this.goals.carbo };
  gorduraData = { value: 0, max: this.goals.gordura };

  constructor(
    private http: HttpClient,
    private tacoService: TacoService,
    private cdr: ChangeDetectorRef
  ) {
    // busca com debounce
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        if (term.trim().length >= 2) {
          this.tacoService.searchFood(term).subscribe({
            next: (results) => {
              this.searchResults = results;
              this.cdr.detectChanges();
            },
            error: () => {
              this.searchResults = [];
              this.cdr.detectChanges();
            },
          });
        } else {
          this.searchResults = [];
          this.cdr.detectChanges();
        }
      });

    // online/offline
    this.isOnline = navigator.onLine;
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // PWA
    window.addEventListener('pwa-install-available', () => {
      this.showInstallPrompt = true;
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    // metas do localStorage
    const savedGoals = localStorage.getItem('goals');
    if (savedGoals) {
      try {
        const parsed = JSON.parse(savedGoals);
        this.goals = {
          calorias: parsed.calorias || 2704,
          proteinas: parsed.proteinas || 176,
          carbo: parsed.carbo || 320,
          gordura: parsed.gordura || 80,
        };
      } catch (e) {
        console.error('Erro ao parsear metas do localStorage', e);
      }
    }

    // inicia gráfico com metas corretas
    this.updateCharts();

    // carrega dados do dia
    this.loadDailyIntake();
    this.loadFavoriteRecipes();

    // acessibilidade
    this.buttonLeft.nativeElement.focus();

    // clique global
    document.addEventListener('click', this.handleClickOutside.bind(this));

    this.cdr.detectChanges();
  }

  // =============================
  // online
  // =============================
  private async handleOnline() {
    this.isOnline = true;
    this.cdr.detectChanges();

    if (this.pendingFoods.length > 0) {
      const failed: FoodData[] = [];

      for (const food of this.pendingFoods) {
        try {
          await firstValueFrom(this.http.post(`${this.apiUrl}/food/add`, food));
        } catch {
          failed.push(food);
        }
      }

      this.pendingFoods = failed;
      // revalida com backend, mas sem reanimar (apenas corrige se precisar)
      this.verifyAndCorrectFromServer();
    }
  }

  // =============================
  // UI helpers
  // =============================
  handleClickOutside(event: MouseEvent) {
    if (!this.popupVisible && this.searchResults.length === 0) {
      return;
    }

    const input = this.foodInput?.nativeElement;
    const results = this.searchResultsContainer?.nativeElement;
    const popup = document.querySelector('.popup-overlay') as HTMLElement | null;
    const target = event.target as HTMLElement;

    if (target.closest('.search-item')) return;
    if (target.closest('.favorite-item')) return;

    const clickedInsideResults = results && results.contains(target);
    const clickedOnInput = input && (input === target || input.contains(target));

    if (results && !clickedInsideResults && !clickedOnInput) {
      if (input && !input.contains(target)) {
        this.closeResults();
      }
    }

    if (this.popupVisible && popup && !popup.contains(target)) {
      this.closePopup();
    }
  }

  onResultPointerDown(_event: PointerEvent) {
    this.isSelectingFromResults = true;
  }

  onResultClick(food: NutritionalInfo, event: MouseEvent) {
    event.stopPropagation();
    this.isSelectingFromResults = false;
    this.selectFood(food);
  }

  onBlur() {
    setTimeout(() => {
      if (this.isSelectingFromResults) {
        this.isSelectingFromResults = false;
        return;
      }
      if (this.searchResults.length > 0 && !this.popupVisible) {
        this.closeResults();
      }
    }, 50);
  }

  onSearch() {
    this.searchSubject.next(this.searchQuery);
  }

  showResults() {
    if (this.searchQuery.length >= 2 && this.searchResults.length === 0) {
      this.onSearch();
    } else if (this.searchResults.length > 0) {
      this.selectedItemIndex = -1;
      this.cdr.detectChanges();
    }
  }

  formatFoodDescription(description: string): { mainName: string; details: string[] } {
    const parts = description.split(',').map((p) => p.trim());
    if (parts.length === 0) {
      return { mainName: '', details: [] };
    }
    return {
      mainName: parts[0],
      details: parts.slice(1),
    };
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.searchResults.length) return;

    const prevIndex = this.selectedItemIndex;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedItemIndex = Math.min(this.selectedItemIndex + 1, this.searchResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedItemIndex = Math.max(this.selectedItemIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedItemIndex >= 0) {
          this.selectFood(this.searchResults[this.selectedItemIndex]);
        }
        break;
    }

    if (prevIndex !== this.selectedItemIndex) {
      this.scrollToSelectedItem();
    }

    this.cdr.detectChanges();
  }

  scrollToSelectedItem() {
    this.cdr.detectChanges();
    const items = this.searchItems.toArray();
    const selectedItem = items[this.selectedItemIndex];
    if (selectedItem) {
      selectedItem.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  closeResults() {
    this.searchResults = [];
    this.cdr.detectChanges();
  }

  selectFood(food: NutritionalInfo) {
    this.selectedFood = food;
    this.selectedRecipe = null;
    this.grams = 100;
    this.popupVisible = true;
    this.closeResults();
    this.cdr.detectChanges();
  }

  selectFavoriteRecipe(recipe: any) {
    this.selectedRecipe = recipe;
    this.selectedFood = null;
    this.grams = 100;
    this.popupVisible = true;
    this.closeResults();
    this.cdr.detectChanges();
  }

  // =============================
  // adicionar alimento — animação otimista única
  // =============================
  addFood() {
    if ((!this.selectedFood && !this.selectedRecipe) || !this.grams || this.grams <= 0) return;

    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.error('Usuário não autenticado');
      return;
    }

    // 1) calcula consumo do item
    let consumed: any;
    if (this.selectedFood) {
      if ((this.selectedFood as any).type === 'recipe') {
        // receitas do search/combined vêm com totals em 100g
        consumed = this.tacoService.calculateForGrams(this.selectedFood, this.grams);
        consumed.calorias = consumed.calorias / 100;
        consumed.proteinas = consumed.proteinas / 100;
        consumed.carbo = consumed.carbo / 100;
        consumed.gordura = consumed.gordura / 100;
      } else {
        consumed = this.tacoService.calculateForGrams(this.selectedFood, this.grams);
      }
    } else if (this.selectedRecipe) {
      // favorito salvo (totais já salvos)
      const fator = this.grams / 100;
      consumed = {
        calorias: (this.selectedRecipe.calorias ?? 0) * fator,
        proteinas: (this.selectedRecipe.proteinas ?? 0) * fator,
        carbo: (this.selectedRecipe.carbo ?? 0) * fator,
        gordura: (this.selectedRecipe.gordura ?? 0) * fator,
      };
    }

    // 2) animação otimista: atualiza o estado local e o gráfico JÁ
    this.applyLocalConsumption(consumed);

    // 3) fecha rapidamente o popup (sem travar a UI)
    this.closePopup();

    // 4) monta payload para o backend
    const localDate = new Date().toISOString().split('T')[0];
    const foodData: FoodData = {
      user_id: userId,
      description: this.selectedFood?.description || this.selectedRecipe?.name,
      grams: this.grams,
      calorias: Number(consumed.calorias) || 0,
      proteinas: Number(consumed.proteinas) || 0,
      carbo: Number(consumed.carbo) || 0,
      gordura: Number(consumed.gordura) || 0,
      date: localDate,
    };

    // 5) persistência: SOMENTE /food/add (NÃO chamar /intake/add)
    if (this.isOnline) {
      this.http.post(`${this.apiUrl}/food/add`, foodData).subscribe({
        next: () => {
          // não reanima: apenas confere se o servidor está igual
          this.verifyAndCorrectFromServer();
        },
        error: (err) => {
          const isActuallyOffline = !navigator.onLine;
          if (isActuallyOffline) {
            this.queueOffline(foodData);
          } else {
            // CORS/500: mantém valor otimista e avisa
            console.error('Falha ao salvar no servidor:', err);
            alert('Falha ao salvar no servidor (CORS/500). Verifique o backend.');
          }
        },
      });
    } else {
      this.queueOffline(foodData);
    }
  }

  // Confere o que está exibido vs o backend e corrige sem reanimar
  private verifyAndCorrectFromServer() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    const localDate = new Date().toISOString().split('T')[0];

    this.http.get(`${this.apiUrl}/intake/today?user_id=${userId}&date=${localDate}`).subscribe({
      next: (data: any) => {
        const server = {
          calorias: data.calorias || 0,
          proteinas: data.proteinas || 0,
          carbo: data.carbo || 0,
          gordura: data.gordura || 0,
        };

        const local = this.dailyIntake;
        const same =
          Math.abs(server.calorias - local.calorias) < 0.0001 &&
          Math.abs(server.proteinas - local.proteinas) < 0.0001 &&
          Math.abs(server.carbo - local.carbo) < 0.0001 &&
          Math.abs(server.gordura - local.gordura) < 0.0001;

        if (!same) {
          // Corrige sem chamar animação de novo: atualiza datasource e
          // deixa o componente do gráfico levar do valor animado atual até o novo sem pulo
          this.dailyIntake = server;
          this.updateCharts();
          this.cdr.detectChanges();
        }

        // Atualiza o line chart silenciosamente
        setTimeout(() => this.lineChartComponent?.reload(), 100);
      },
      error: () => {
        // mantém otimista
      },
    });
  }

  private applyLocalConsumption(consumed: { calorias: number; proteinas: number; carbo: number; gordura: number }) {
    this.dailyIntake = {
      calorias: this.dailyIntake.calorias + consumed.calorias,
      proteinas: this.dailyIntake.proteinas + consumed.proteinas,
      carbo: this.dailyIntake.carbo + consumed.carbo,
      gordura: this.dailyIntake.gordura + consumed.gordura,
    };
    this.updateCharts(); // dispara UMA animação
  }

  private queueOffline(foodData: FoodData) {
    this.pendingFoods.push(foodData);
    alert('Alimento adicionado offline. Será sincronizado quando online.');
  }

  // =============================
  // gráficos
  // =============================
  updateCharts() {
    this.caloriasData = { value: this.dailyIntake.calorias, max: this.goals.calorias };
    this.proteinasData = { value: this.dailyIntake.proteinas, max: this.goals.proteinas };
    this.carbData = { value: this.dailyIntake.carbo, max: this.goals.carbo };
    this.gorduraData = { value: this.dailyIntake.gordura, max: this.goals.gordura };
  }

  loadDailyIntake() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.warn('User not logged in');
      return;
    }

    const localDate = new Date().toISOString().split('T')[0];

    this.http.get(`${this.apiUrl}/intake/today?user_id=${userId}&date=${localDate}`).subscribe({
      next: (data: any) => {
        this.dailyIntake = {
          calorias: data.calorias || 0,
          proteinas: data.proteinas || 0,
          carbo: data.carbo || 0,
          gordura: data.gordura || 0,
        };
        this.updateCharts();   // UMA animação inicial
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Falha ao carregar dados diários', err);
        this.dailyIntake = { calorias: 0, proteinas: 0, carbo: 0, gordura: 0 };
        this.updateCharts();
        this.cdr.detectChanges();
      },
    });
  }

  loadFavoriteRecipes() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
      this.favoriteRecipes = [];
      this.cdr.detectChanges();
      return;
    }

    const savedIds = localStorage.getItem('favoriteRecipes');
    const favoriteIds = savedIds ? JSON.parse(savedIds) : [];

    if (favoriteIds.length === 0) {
      this.favoriteRecipes = [];
      this.cdr.detectChanges();
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    this.http
      .get<any[]>(`${this.apiUrl}/recipes/list?user_id=${userId}`, { headers })
      .subscribe({
        next: (allRecipes) => {
          this.favoriteRecipes = allRecipes.filter((recipe) => favoriteIds.includes(recipe._id));
          this.cdr.detectChanges();
        },
        error: () => {
          this.favoriteRecipes = [];
          this.cdr.detectChanges();
        },
      });
  }

  moveSlider(position: 'left' | 'right') {
    this.sliderPosition = position === 'left' ? '0' : '50%';
    this.isLeftActive = position === 'left';
    this.cdr.detectChanges();
  }

  openMenu() {
    this.activeMenu = true;
    if (this.menuState) this.menuState.activeMenu = 'home';
    this.cdr.markForCheck();
  }

  closeMenu() {
    this.activeMenu = false;
    if (this.menuState) this.menuState.activeMenu = '';
    this.cdr.markForCheck();
  }

  installApp() {
    const promptEvent = (window as any).__pwaInstallPrompt;
    if (!promptEvent) return;

    promptEvent.prompt();
    promptEvent.userChoice.then(() => {
      (window as any).__pwaInstallPrompt = null;
      this.showInstallPrompt = false;
      this.cdr.detectChanges();
    });
  }

  triggerInstall() {
    this.installApp();
  }

  closePopup() {
    this.selectedFood = null;
    this.selectedRecipe = null;
    this.popupVisible = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.selectedItemIndex = -1;
    this.cdr.markForCheck();
    setTimeout(() => this.cdr.detectChanges(), 0);
  }
}
