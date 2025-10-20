import { Component, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, QueryList, ViewChildren } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MultiRingChartComponent } from '../shared/multi-ring-chart/multi-ring-chart.component';
import { LineChartComponent } from '../shared/line-chart/line-chart.component';
import { TacoService, NutritionalInfo } from '../shared/taco.service';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface FoodData {
  user_id: string;
  description: string;
  grams: number;
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    RouterModule,
    MultiRingChartComponent,
    LineChartComponent,
    FormsModule
  ],
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

  onDataChanged() {
    this.loadDailyIntake();
    setTimeout(() => {
      this.lineChartComponent?.reload();
    }, 100);
  }

  activeMenu: boolean = false;
  sliderPosition: string = '0';
  isLeftActive: boolean = true;
  showInstallPrompt: boolean = false;
  favoriteRecipes: any[] = [];

  private installPromptEvent: any;

  selectedItemIndex = -1;

  // Intake diário
  dailyIntake = {
    calorias: 0,
    proteinas: 0,
    carbo: 0,
    gordura: 0
  };

  // Goals
  goals = {
    calorias: 2704,
    proteinas: 176,
    carbo: 320,
    gordura: 80
  };

  // Busca de alimento
  searchQuery = '';
  searchResults: NutritionalInfo[] = [];
  selectedFood: NutritionalInfo | null = null;
  grams = 100;
  pendingFoods: FoodData[] = [];
  selectedRecipe: any = null; // Receita selecionada
  popupVisible = false;

  isOnline = true;

  private searchSubject = new Subject<string>();

  constructor(
    private http: HttpClient,
    private tacoService: TacoService,
    private cdr: ChangeDetectorRef
  ) {

    this.loadFavoriteRecipes();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      if (term.trim().length >= 2) {
        this.tacoService.searchFood(term).subscribe({
          next: (results) => {
            this.searchResults = results;
            this.cdr.detectChanges();
          },
          error: () => {
            this.searchResults = [];
            this.cdr.detectChanges();
          }
        });
      } else {
        this.searchResults = [];
        this.cdr.detectChanges();
      }
    });

    // Detecta online/offline
    this.isOnline = navigator.onLine;
    window.addEventListener('online',  () => { this.handleOnline(); });
    window.addEventListener('offline', () => { this.isOnline = false; });

    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPromptEvent = event;
      this.showInstallPrompt = true;
      this.cdr.detectChanges();
    });
  }

  private async handleOnline() {
    this.isOnline = true;
    this.cdr.detectChanges();

    if (this.pendingFoods.length > 0) {
      const failed: FoodData[] = [];
      for (const food of this.pendingFoods) {
        try {
          await firstValueFrom(this.http.post('http://localhost:8000/food/add', food));
          await firstValueFrom(this.http.post('http://localhost:8000/intake/add', {
            user_id: food.user_id,
            calorias: food.calorias,
            proteinas: food.proteinas,
            carbo: food.carbo,
            gordura: food.gordura
          }));
        } catch {
          failed.push(food);
        }
      }

      this.pendingFoods = failed;
      this.onDataChanged(); // Recarrega gráficos
    }
  }

  triggerInstall() {
    if (this.installPromptEvent) {
      this.installPromptEvent.prompt();
    }
  }

  ngAfterViewInit(): void {
    this.loadDailyIntake();
    this.buttonLeft.nativeElement.focus();

    document.addEventListener('click', this.handleClickOutside.bind(this));

    this.cdr.detectChanges();
  }

  handleClickOutside(event: MouseEvent) {
    const input = this.foodInput?.nativeElement;
    const results = this.searchResultsContainer?.nativeElement;
    const popup = document.querySelector('.popup-overlay') as HTMLElement;

    // Verifica se o clique foi dentro dos resultados
    const clickedInsideResults = results && results.contains(event.target as Node);
    const clickedOnSearchItem = (event.target as HTMLElement).closest('.search-item');

    // Fecha resultados da busca
    if (results && !clickedInsideResults && !clickedOnSearchItem) {
      if (input && !input.contains(event.target as Node)) {
        this.closeResults();
      }
    }

    // Fecha popup ao clicar fora
    if (popup && !popup.contains(event.target as Node)) {
      this.closePopup();
    }
  }

  onBlur() {
    setTimeout(() => {
      if (this.searchResults.length > 0) {
        this.closeResults();
      }
    }, 50);
  }

  loadDailyIntake() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.warn('User not logged in');
      return;
    }

    this.http.get(`http://localhost:8000/intake/today?user_id=${userId}`).subscribe({
      next: (data: any) => {
        this.dailyIntake = {
          calorias: data.calorias || 0,
          proteinas: data.proteinas || 0,
          carbo: data.carbo || 0,
          gordura: data.gordura || 0
        };
        this.updateCharts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Falha ao carregar dados diários', err);
        this.dailyIntake = { calorias: 0, proteinas: 0, carbo: 0, gordura: 0 };
        this.updateCharts();
        this.cdr.detectChanges();
      }
    });

    this.caloriasData = { ...this.caloriasData, value: this.dailyIntake.calorias };
    this.proteinasData = { ...this.proteinasData, value: this.dailyIntake.proteinas };
    this.carbData = { ...this.carbData, value: this.dailyIntake.carbo };
    this.gorduraData = { ...this.gorduraData, value: this.dailyIntake.gordura };

    this.cdr.detectChanges();
  }

  onSearch() {
    this.searchSubject.next(this.searchQuery);
  }
  showResults() {
    if (this.searchQuery.length >= 2 && this.searchResults.length === 0) {
      this.onSearch(); // Dispara o debounce
    } else if (this.searchResults.length > 0) {
      this.selectedItemIndex = -1;
      this.cdr.detectChanges();
    }
  }

  formatFoodDescription(description: string): { mainName: string; details: string[] } {
    const parts = description.split(',').map(p => p.trim());

    if (parts.length === 0) return { mainName: '', details: [] };

    const mainName = parts[0]; // "Batata"
    const details = parts.slice(1); // ["baroa", "cozida"]

    return { mainName, details };
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
    this.grams = 100;
    this.popupVisible = true; // ✅ Ativa o popup
    this.closeResults();
    this.cdr.detectChanges();
  }

  addFood() {
    if ((!this.selectedFood && !this.selectedRecipe) || !this.grams || this.grams <= 0) return;

    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.error('Usuário não autenticado');
      return;
    }

    let consumed: any;

    // ✅ Caso 1: Alimento selecionado
    if (this.selectedFood) {
      consumed = this.tacoService.calculateForGrams(this.selectedFood, this.grams);
    }
    // ✅ Caso 2: Receita selecionada
    else if (this.selectedRecipe) {
      // Valores totais da receita (para a quantidade padrão, ex: 100g)
      const caloriasTotal = this.selectedRecipe.calorias ?? 0;
      const proteinasTotal = this.selectedRecipe.proteinas ?? 0;
      const carboTotal = this.selectedRecipe.carbo ?? 0;
      const gorduraTotal = this.selectedRecipe.gordura ?? 0;

      // Quantidade padrão da receita (normalmente 100g)
      const quantidadePadrao = 100; // Pode ser outro valor, ajuste se necessário

      // Fator de escala: quanto o usuário realmente comeu?
      const fator = this.grams / quantidadePadrao;

      consumed = {
        calorias: caloriasTotal * fator, 
        proteinas: proteinasTotal * fator,
        carbo: carboTotal * fator,
        gordura: gorduraTotal * fator
      };
    }

    // ✅ Agora `consumed` sempre tem valor
    this.dailyIntake.calorias += consumed.calorias;
    this.dailyIntake.proteinas += consumed.proteinas;
    this.dailyIntake.carbo += consumed.carbo;
    this.dailyIntake.gordura += consumed.gordura;
    this.updateCharts();

    const foodData = {
      user_id: userId,
      description: this.selectedFood?.description || this.selectedRecipe?.name,
      grams: this.grams,
      calorias: Number(consumed.calorias) || 0,
      proteinas: Number(consumed.proteinas) || 0,
      carbo: Number(consumed.carbo) || 0,
      gordura: Number(consumed.gordura) || 0
    };

    if (this.isOnline) {
      this.http.post('http://localhost:8000/food/add', foodData).subscribe({
        next: () => {
          this.onDataChanged(); // Carrega do backend
        },
        error: (err) => this.queueOffline(foodData, consumed)
      });
    } else {
      this.queueOffline(foodData, consumed);
    }

    this.closePopup();

    this.onDataChanged();
  }

  private queueOffline(foodData: FoodData, consumed: any) {
    this.pendingFoods.push(foodData);
    // Atualiza UI mesmo offline
    this.dailyIntake.calorias += consumed.calorias;
    this.dailyIntake.proteinas += consumed.proteinas;
    this.dailyIntake.carbo += consumed.carbo;
    this.dailyIntake.gordura += consumed.gordura;
    this.updateCharts();
    this.cdr.detectChanges();

    alert('Alimento adicionado offline. Será sincronizado quando online.');
    this.selectedFood = null;
  }

  updateCharts() {
    this.caloriasData = {
      value: this.dailyIntake.calorias,
      max: this.goals.calorias
    };
    this.proteinasData = {
      value: this.dailyIntake.proteinas,
      max: this.goals.proteinas
    };
    this.carbData = {
      value: this.dailyIntake.carbo,
      max: this.goals.carbo
    };
    this.gorduraData = {
      value: this.dailyIntake.gordura,
      max: this.goals.gordura
    };
  }

  loadFavoriteRecipes() {
    const savedIds = localStorage.getItem('favoriteRecipes');
    const ids = savedIds ? JSON.parse(savedIds) : [];
    if (ids.length === 0) return;

    this.http.get<any[]>('http://localhost:8000/recipes/list').subscribe(allRecipes => {
      this.favoriteRecipes = allRecipes.filter(r => ids.includes(r._id));
      this.cdr.detectChanges();
    });
  }

  // Método para abrir o popup com a receita
  selectFavoriteRecipe(recipe: any) {
    console.log('Receita selecionada:', recipe); // 🔍 Depure aqui

    this.selectedRecipe = recipe;
    this.grams = 100;
    this.popupVisible = true;

    this.cdr.markForCheck();
  }

  // Dados para os gráficos
  caloriasData = { value: 0, max: this.goals.calorias };
  proteinasData = { value: 0, max: this.goals.proteinas };
  carbData = { value: 0, max: this.goals.carbo };
  gorduraData = { value: 0, max: this.goals.gordura };

  moveSlider(position: 'left' | 'right'): void {
    this.sliderPosition = position === 'left' ? '0' : '50%';
    this.isLeftActive = position === 'left';
    this.cdr.detectChanges();
  }

  openMenu(): void {
    this.activeMenu = true;
    this.cdr.markForCheck();
  }

  closeMenu(): void {
    this.activeMenu = false;
    this.cdr.markForCheck();
  }

  installApp(): void {
    if (this.installPromptEvent) {
      this.installPromptEvent.prompt();
      this.installPromptEvent.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        } else {
          console.log('User dismissed the A2HS prompt');
        }
        this.installPromptEvent = null;
        this.showInstallPrompt = false;
        this.cdr.detectChanges();
      });
    }
  }

  closePopup(): void {
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