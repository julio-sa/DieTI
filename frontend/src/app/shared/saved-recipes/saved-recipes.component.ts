// src/app/shared/saved-recipes/saved-recipes.component.ts
import { Component, ElementRef, QueryList, ViewChildren, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ FormsModule adicionado
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TacoService, NutritionalInfo } from '../taco.service'; // ✅ Caminho corrigido
import { FormsModule } from '@angular/forms';

interface RecipeIngredient {
  id: string | number;
  description: string;
  grams: number;
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
}

@Component({
  standalone: true,
  selector: 'app-saved-recipes',
  imports: [CommonModule, FormsModule], // ✅ Imports corretos
  templateUrl: './saved-recipes.component.html',
  styleUrls: ['./saved-recipes.component.css']
})
export class SavedRecipesComponent {
  @ViewChild('searchResultsContainer') searchResultsContainer!: ElementRef;
  @ViewChildren('searchItem') searchItems!: QueryList<ElementRef>;

  recipes: any[] = [];
  editingRecipeId: string | null = null;
  searchQuery = '';
  searchResults: NutritionalInfo[] = [];
  selectedFood: NutritionalInfo | null = null;
  selectedItemIndex = -1;
  hasValue = false;
  favorites: string[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private tacoService: TacoService
  ) {
    this.loadRecipes();
    document.addEventListener('click', this.handleClickOutside.bind(this));
  }

  ngOnInit(): void {
    // Carrega favoritos do localStorage
    const saved = localStorage.getItem('favoriteRecipes');
    this.favorites = saved ? JSON.parse(saved) : [];
  }

  loadRecipes() {
    this.http.get<any[]>('http://localhost:8000/recipes/list')
      .subscribe(data => {
        this.recipes = data.map(r => ({
          ...r,
          calorias: r.calorias ?? 0,
          proteinas: r.proteinas ?? 0,
          carbo: r.carbo ?? 0,
          gordura: r.gordura ?? 0,
          editingName: r.name,
          editingIngredients: r.ingredients.map((i: any) => ({
            ...i,
            description: i.description || i.food?.description || 'Alimento desconhecido'
          }))
        }));
        this.cdr.detectChanges();
      });
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  startEditing(recipe: any) {
    this.editingRecipeId = recipe._id;
    recipe.editingName = recipe.name;
    recipe.editingIngredients = [...recipe.ingredients];
    this.updateTotals(recipe);
  }

  cancelEdit(recipe: any) {
    this.editingRecipeId = null;
  }

  saveEditedRecipe(recipe: any) {
    const updatedRecipe = {
      name: recipe.editingName,
      ingredients: recipe.editingIngredients,
      calorias: recipe.calorias,
      proteinas: recipe.proteinas,
      carbo: recipe.carbo,
      gordura: recipe.gordura,
      createdAt: recipe.createdAt
    };

    this.http.put(`http://localhost:8000/recipes/update/${recipe._id}`, updatedRecipe)
      .subscribe(() => {
        recipe.name = recipe.editingName;
        recipe.ingredients = [...recipe.editingIngredients];
        this.updateTotals(recipe); // ✅ updateTotals, não recalculateTotals
        this.editingRecipeId = null;
      }, err => {
        console.error('Erro ao salvar edição', err);
      });
  }

  deleteRecipe(recipeId: string) {
    if (!confirm('Excluir esta receita?')) return;

    this.http.delete(`http://localhost:8000/recipes/delete/${recipeId}`)
      .subscribe(() => {
        this.recipes = this.recipes.filter(r => r._id !== recipeId);
      });
  }

  addIngredientToRecipe(recipe: any, grams: number) {
    if (!this.selectedFood || grams <= 0) return;

    const ing: RecipeIngredient = {
      id: this.selectedFood._id,
      description: this.selectedFood.description,
      grams,
      calorias: (this.selectedFood.calorias_kcal || 0) * grams,
      proteinas: (this.selectedFood.proteinas_g || 0) * grams,
      carbo: (this.selectedFood.carbo_g || 0) * grams,
      gordura: (this.selectedFood.gordura_g || 0) * grams
    };

    recipe.editingIngredients.push(ing);
    this.updateTotals(recipe);
    this.resetSelection();
  }

  removeIngredientFromRecipe(recipe: any, index: number) {
    recipe.editingIngredients.splice(index, 1);
    this.updateTotals(recipe);
  }

  updateIngredientGrams(recipe: any, index: number, grams: number) {
    const item = recipe.editingIngredients[index];
    const food = this.findFoodInTaco(item.id);

    if (food && grams > 0) {
      item.grams = grams;
      item.calorias = (food.calorias_kcal || 0) * grams;
      item.proteinas = (food.proteinas_g || 0) * grams;
      item.carbo = (food.carbo_g || 0) * grams;
      item.gordura = (food.gordura_g || 0) * grams;
      this.updateTotals(recipe);
    }
  }

  updateTotals(recipe: any) {
    const total = recipe.editingIngredients.reduce((acc: any, item: any) => ({
      calorias: acc.calorias + item.calorias,
      proteinas: acc.proteinas + item.proteinas,
      carbo: acc.carbo + item.carbo,
      gordura: acc.gordura + item.gordura
    }), { calorias: 0, proteinas: 0, carbo: 0, gordura: 0 });

    recipe.calorias = total.calorias;
    recipe.proteinas = total.proteinas;
    recipe.carbo = total.carbo;
    recipe.gordura = total.gordura;
  }

  findFoodInTaco(id: string |number): NutritionalInfo | undefined {
    return undefined;
  }

  onSearch() {
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    this.hasValue = true;
    this.tacoService.searchFood(this.searchQuery).subscribe((results: NutritionalInfo[]) => {
      this.searchResults = results;
      this.cdr.detectChanges();
    });
  }

  formatFoodDescription(description: string): { name: string; details: string[] } {
    const parts = description.split(',').map(p => p.trim());

    if (parts.length === 0) return { name: '', details: [] };

    const name = parts[0]; // "Ovo"
    const details = parts.slice(1); // ["de galinha", "inteiro", "cru"]

    return { name, details };
  }

  showResults() {
    if (this.searchQuery.length >= 2 && this.searchResults.length === 0) {
      this.onSearch();
    }
  }

  selectFood(food: NutritionalInfo) {
    this.selectedFood = food;
    this.searchQuery = food.description;
    this.hasValue = true;
    this.searchResults = [];
  }

  resetSelection() {
    this.selectedFood = null;
    this.searchQuery = '';
    this.hasValue = false;
  }

  closeResults() {
    this.searchResults = [];
    this.hasValue = false;
    this.cdr.detectChanges();
  }

  handleClickOutside(event: MouseEvent) {
    const results = this.searchResultsContainer?.nativeElement;
    if (results && !results.contains(event.target as Node)) {
      this.closeResults();
    }
  }

  scrollToSelectedItem() {
    this.cdr.detectChanges();
    const items = this.searchItems.toArray();
    const selectedItem = items[this.selectedItemIndex];
    if (selectedItem) {
      selectedItem.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
  }

  onBlur() {
    setTimeout(() => {
      if (this.searchResults.length > 0) {
        this.closeResults();
      }
    }, 150);
  }

  isFavorite(recipe: any): boolean {
    return this.favorites.includes(recipe._id);
  }

  toggleFavorite(recipe: any): void {
    const index = this.favorites.indexOf(recipe._id);
    if (index === -1) {
      this.favorites.push(recipe._id);
    } else {
      this.favorites.splice(index, 1);
    }
    // Salva no localStorage
    localStorage.setItem('favoriteRecipes', JSON.stringify(this.favorites));
  }
}