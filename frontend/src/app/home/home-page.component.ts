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
  // refs
  @ViewChild('searchResultsContainer') searchResultsContainer!: ElementRef;
  @ViewChild('foodInput') foodInput!: ElementRef;
  @ViewChildren('searchItem') searchItems!: QueryList<ElementRef>;
  @ViewChild('buttonLeft') buttonLeft!: ElementRef<HTMLButtonElement>;
  @ViewChild(LineChartComponent) lineChartComponent!: LineChartComponent;
  @ViewChild(MultiRingChartComponent) ringChartComponent!: MultiRingChartComponent;

  // ui
  activeMenu = false;
  sliderPosition = '0';
  isLeftActive = true;
  showInstallPrompt = false;

  // favoritos
  favoriteRecipes: any[] = [];

  // estado extra
  menuState: { activeMenu: string } | null = { activeMenu: '' };

  // api
  private readonly apiUrl = environment.apiUrl;
  private installPromptEvent: any;

  // busca
  searchQuery = '';
  searchResults: NutritionalInfo[] = [];
  selectedItemIndex = -1;
  private searchSubject = new Subject<string>();

  // controle de clique na lista (pra não fechar no blur)
  private isSelectingFromResults = false;

  // item selecionado
  selectedFood: NutritionalInfo | null = null;
  selectedRecipe: any = null;
  grams = 100;
  popupVisible = false;

  // online
  isOnline = true;
  pendingFoods: FoodData[] = [];

  // dados do dia
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

  // dados pros gráficos
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

  // =============================
  // lifecycle
  // =============================
  ngAfterViewInit(): void {
    // metas
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

    // inicializa gráficos com metas certas
    this.updateCharts();

    // carga do dia
    this.loadDailyIntake();
    this.loadFavoriteRecipes();

    // foco
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
          await firstValueFrom(
            this.http.post(`${this.apiUrl}/intake/add`, {
              user_id: food.user_id,
              calorias: food.calorias,
              proteinas: food.proteinas,
              carbo: food.carbo,
              gordura: food.gordura,
              description: food.description,
              grams: food.grams,
            })
          );
        } catch {
          failed.push(food);
        }
      }

      this.pendingFoods = failed;
      this.onDataChanged(); // recarrega do backend só uma vez
    }
  }

  // =============================
  // clique fora
  // =============================
  handleClickOutside(event: MouseEvent) {
    if (!this.popupVisible && this.searchResults.length === 0) {
      return;
    }

    const input = this.foodInput?.nativeElement;
    const results = this.searchResultsContainer?.nativeElement;
    const popup = document.querySelector('.popup-overlay') as HTMLElement | null;
    const target = event.target as HTMLElement;

    // se clicou na lista -> não fecha
    if (target.closest('.search-item')) return;
    // se clicou no favorito -> não fecha
    if (target.closest('.favorite-item')) return;

    const clickedInsideResults = results && results.contains(target);
    const clickedOnInput = input && (input === target || input.contains(target));

    // fecha resultados
    if (results && !clickedInsideResults && !clickedOnInput) {
      if (input && !input.contains(target)) {
        this.closeResults();
      }
    }

    // fecha popup
    if (this.popupVisible && popup && !popup.contains(target)) {
      this.closePopup();
    }
  }

  // =============================
  // pointerdown na opção
  // =============================
  onResultPointerDown(_event: PointerEvent) {
    this.isSelectingFromResults = true;
  }

  // =============================
  // clique na opção
  // =============================
  onResultClick(food: NutritionalInfo, event: MouseEvent) {
    event.stopPropagation();
    this.isSelectingFromResults = false;
    this.selectFood(food);
  }

  // =============================
  // blur do input
  // =============================
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

  // =============================
  // busca
  // =============================
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

  // =============================
  // seleção de alimento
  // =============================
  selectFood(food: NutritionalInfo) {
    this.selectedFood = food;
    this.selectedRecipe = null;
    this.grams = 100;
    this.popupVisible = true;
    this.closeResults();
    this.cdr.detectChanges();
  }

  // =============================
  // seleção de favorito
  // =============================
  selectFavoriteRecipe(recipe: any) {
    this.selectedRecipe = recipe;
    this.selectedFood = null;
    this.grams = 100;
    this.popupVisible = true;
    this.closeResults();
    this.cdr.detectChanges();
  }

  // =============================
  // salvar alimento
  // =============================
  addFood() {
    if ((!this.selectedFood && !this.selectedRecipe) || !this.grams || this.grams <= 0) return;

    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.error('Usuário não autenticado');
      return;
    }

    // 1) calcula consumo
    let consumed: any;
    if (this.selectedFood) {
        if ((this.selectedFood as any).type === 'recipe') {
          consumed = this.tacoService.calculateForGrams(this.selectedFood, this.grams);
          consumed.calorias = consumed.calorias / 100;
          consumed.proteinas = consumed.proteinas / 100;
          consumed.carbo = consumed.carbo / 100;
          consumed.gordura = consumed.gordura / 100;
        } else {
            consumed = this.tacoService.calculateForGrams(this.selectedFood, this.grams);
        }
    } else if (this.selectedRecipe) {
      const caloriasTotal = this.selectedRecipe.calorias ?? 0;
      const proteinasTotal = this.selectedRecipe.proteinas ?? 0;
      const carboTotal = this.selectedRecipe.carbo ?? 0;
      const gorduraTotal = this.selectedRecipe.gordura ?? 0;
      const fator = this.grams / 100;
      consumed = {
        calorias: caloriasTotal * fator,
        proteinas: proteinasTotal * fator,
        carbo: carboTotal * fator,
        gordura: gorduraTotal * fator,
      };
    }

    // 2) atualiza UI na hora
    this.dailyIntake.calorias += consumed.calorias;
    this.dailyIntake.proteinas += consumed.proteinas;
    this.dailyIntake.carbo += consumed.carbo;
    this.dailyIntake.gordura += consumed.gordura;
    this.updateCharts();

    // 3) monta payload
    const localDate = new Date().toISOString().split('T')[0];

    const foodData: FoodData = {
      user_id: userId,
      description: this.selectedFood?.description || this.selectedRecipe?.name,
      grams: this.grams,
      calorias: Number(consumed.calorias) || 0,
      proteinas: Number(consumed.proteinas) || 0,
      carbo: Number(consumed.carbo) || 0,
      gordura: Number(consumed.gordura) || 0,
      // @ts-ignore
      date: localDate,
    };

    // 4) envia pro backend
    if (this.isOnline) {
      this.http.post(`${this.apiUrl}/food/add`, foodData).subscribe({
        next: () => {
          // grava também no intake
          this.http
            .post(`${this.apiUrl}/intake/add`, {
              user_id: userId,
              calorias: foodData.calorias,
              proteinas: foodData.proteinas,
              carbo: foodData.carbo,
              gordura: foodData.gordura,
              description: foodData.description,
              grams: foodData.grams,
            })
            .subscribe({
              next: () => this.onDataChanged(), // ✅ só aqui recarrega do backend
              error: () => this.onDataChanged(),
            });
        },
        error: () => {
          // se falhou mesmo online, joga pra fila offline
          this.queueOffline(foodData);
        },
      });
    } else {
      // offline: só enfileira (UI já foi atualizada)
      this.queueOffline(foodData);
    }

    // 5) fecha popup
    this.closePopup();
  }

  private queueOffline(foodData: FoodData) {
    this.pendingFoods.push(foodData);
    alert('Alimento adicionado offline. Será sincronizado quando online.');
    this.selectedFood = null;
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
        this.updateCharts();
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

  // =============================
  // outros
  // =============================
  onDataChanged() {
    this.loadDailyIntake();
    setTimeout(() => {
      this.lineChartComponent?.reload();
    }, 100);
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
