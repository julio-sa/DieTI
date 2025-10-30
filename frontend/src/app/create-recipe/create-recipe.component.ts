import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NutritionalInfo, TacoService } from '../services/taco.service';
import { environment } from '../../environments/environment';

interface RecipeIngredient {
  food: NutritionalInfo;
  grams: number;
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
}

@Component({
  standalone: true,
  selector: 'app-create-recipe',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  providers: [TacoService],
  templateUrl: './create-recipe.component.html',
  styleUrls: ['./create-recipe.component.css']
})
export class CreateRecipeComponent implements OnInit {
  @ViewChild('searchResultsContainer') searchResultsContainer!: ElementRef;
  @ViewChildren('searchItem') searchItems!: QueryList<ElementRef>;

  searchQuery = '';
  searchResults: NutritionalInfo[] = [];
  selectedFood: NutritionalInfo | null = null;
  recipeName = '';
  hasValue = false;
  ingredients: any[] = [];
  total = { calorias: 0.0, proteinas: 0.0, carbo: 0.0, gordura: 0.0 };
  selectedItemIndex = -1;

  // 🔥 URL fixa (sem environment)
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private tacoService: TacoService
  ) {}

  ngOnInit(): void {
    document.addEventListener('click', this.handleClickOutside.bind(this));
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  onSearch() {
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    this.tacoService.searchFood(this.searchQuery).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.cdr.detectChanges();
      },
      error: () => {
        this.searchResults = [];
        this.cdr.detectChanges();
      }
    });
  }

  handleClickOutside(event: MouseEvent) {
    const input = event.target as HTMLElement;
    const results = this.searchResultsContainer?.nativeElement;

    if (!input || !results) return;

    const clickedInsideInput = input.tagName === 'INPUT';
    const clickedInsideResults = results.contains(event.target as Node);

    if (!clickedInsideInput && !clickedInsideResults) {
      this.closeResults();
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.searchResults.length) return;

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

    this.scrollToSelectedItem();
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

  showResults() {
    if (this.searchQuery.length >= 2 && this.searchResults.length === 0) {
      this.onSearch();
    }
  }

  closeResults() {
    this.searchResults = [];
    this.cdr.detectChanges();
  }

  selectFood(food: NutritionalInfo) {
    this.selectedFood = food;
    this.searchQuery = food.description;
    this.closeResults();
  }

  onBlur() {
    setTimeout(() => {
      if (this.searchResults.length > 0) {
        this.closeResults();
      }
    }, 150);
  }

  onGramsInput(ev: Event) {
    const v = (ev.target as HTMLInputElement).value ?? '';
    this.hasValue = v.trim().length > 0;
  }

  addIngredient(grams: number) {
    if (!this.selectedFood || grams <= 0) return;

    const { calorias_kcal, proteinas_g, carbo_g, gordura_g } = this.selectedFood;

    const newIngredient: RecipeIngredient = {
      food: this.selectedFood,
      grams,
      calorias: (calorias_kcal || 0) * grams,
      proteinas: (proteinas_g || 0) * grams,
      carbo: (carbo_g || 0) * grams,
      gordura: (gordura_g || 0) * grams
    };

    this.ingredients.push(newIngredient);
    this.updateTotals();
    this.resetSelection();
  }

  updateTotals() {
    this.total = this.ingredients.reduce((acc, item) => ({
      calorias: acc.calorias + item.calorias,
      proteinas: acc.proteinas + item.proteinas,
      carbo: acc.carbo + item.carbo,
      gordura: acc.gordura + item.gordura
    }), { calorias: 0, proteinas: 0, carbo: 0, gordura: 0 });
  }

  removeIngredient(index: number) {
    this.ingredients.splice(index, 1);
    this.updateTotals();
  }

  resetSelection() {
    this.selectedFood = null;
    this.searchQuery = '';
  }

  getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  saveRecipe() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
      alert('Sessão expirada. Faça login novamente.');
      this.router.navigate(['/sign-in']);
      return;
    }

    if (!this.recipeName || this.ingredients.length === 0) {
      alert('Preencha o nome e adicione ao menos um ingrediente');
      return;
    }

    const totalGrams = this.ingredients.reduce((sum, i) => sum + i.grams, 0);
    if (totalGrams <= 0) {
      alert('O peso total da receita deve ser maior que 0g.');
      return;
    }

    const factor = 100 / totalGrams;

    const recipeData = {
      name: this.recipeName,
      ingredients: this.ingredients.map(i => ({ ...i })),
      calorias: this.total.calorias * factor,
      proteinas: this.total.proteinas * factor,
      carbo: this.total.carbo * factor,
      gordura: this.total.gordura * factor,
      createdAt: new Date().toISOString(),
      user_id: userId // ✅ Enviado explicitamente
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.http.post(`${this.apiUrl}/recipes/save`, recipeData, { headers })
      .subscribe({
        next: (res: any) => {
          console.log('Receita salva com sucesso:', res);
          alert('Receita salva com sucesso!');
          this.resetForm();
        },
        error: (err) => {
          console.error('Erro ao salvar receita:', err);
          alert('Falha ao salvar receita: ' + (err.error?.detail || err.message));
        }
      });
  }

  resetForm() {
    this.recipeName = '';
    this.ingredients = [];
    this.total = { calorias: 0, proteinas: 0, carbo: 0, gordura: 0 };
  }
}