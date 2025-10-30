import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RecipesService } from '../../services/recipes.service';
import { TacoService, NutritionalInfo } from '../../services/taco.service';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './saved-recipes.component.html',
  styleUrls: ['./saved-recipes.component.css']
})
export class SavedRecipesComponent implements OnInit {
  recipes: any[] = [];
  editingRecipeId: string | null = null;
  searchQuery = '';
  searchResults: NutritionalInfo[] = [];
  selectedFood: NutritionalInfo | null = null;
  selectedItemIndex = -1;
  hasValue = false;
  favorites: string[] = [];

  constructor(
    private recipesService: RecipesService,
    private router: Router,
    private tacoService: TacoService
  ) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('Sessão expirada');
      this.router.navigate(['/sign-in']);
      return;
    }

    this.loadRecipes(userId);
    this.loadFavorites();
  }

  async loadRecipes(userId: string) {
    try {
      this.recipes = await firstValueFrom(this.recipesService.getRecipes(userId));
      console.log('Receitas carregadas:', this.recipes);
    } catch (err: any) {
      console.error('Erro ao carregar receitas:', err);
      alert('Falha ao carregar receitas.');
    }
  }

  loadFavorites() {
    const saved = localStorage.getItem('favoriteRecipes');
    this.favorites = saved ? JSON.parse(saved) : [];
  }

  getIngredientName(item: any): string {
    return item.description || item.food?.description || 'Alimento desconhecido';
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
    localStorage.setItem('favoriteRecipes', JSON.stringify(this.favorites));
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
    const user_id = localStorage.getItem('userId');
    if (!user_id) return;

    const updatedRecipe = {
      name: recipe.editingName,
      ingredients: recipe.editingIngredients,
      calorias: recipe.calorias,
      proteinas: recipe.proteinas,
      carbo: recipe.carbo,
      gordura: recipe.gordura,
      createdAt: recipe.createdAt,
      user_id
    };

    this.recipesService.updateRecipe(recipe._id, updatedRecipe, user_id).subscribe({
      next: () => {
        recipe.name = recipe.editingName;
        recipe.ingredients = [...recipe.editingIngredients];
        this.updateTotals(recipe);
        this.editingRecipeId = null;
      },
      error: (err) => {
        console.error('Erro ao salvar edição', err);
        alert('Falha ao atualizar receita.');
      }
    });
  }

  deleteRecipe(recipeId: string) {
    if (!confirm('Excluir esta receita?')) return;

    const user_id = localStorage.getItem('userId');
    if (!user_id) return;

    this.recipesService.deleteRecipe(recipeId, user_id).subscribe({
      next: () => {
        this.recipes = this.recipes.filter(r => r._id !== recipeId);
        this.favorites = this.favorites.filter(id => id !== recipeId);
        localStorage.setItem('favoriteRecipes', JSON.stringify(this.favorites));
      },
      error: (err) => {
        console.error('Erro ao deletar receita', err);
        alert('Falha ao excluir receita.');
      }
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

  findFoodInTaco(id: string | number): NutritionalInfo | undefined {
    // Implemente se precisar buscar detalhes específicos
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
    });
  }

  formatFoodDescription(description: string): { name: string; details: string[] } {
    const parts = description.split(',').map(p => p.trim());
    if (parts.length === 0) return { name: '', details: [] };
    return { name: parts[0], details: parts.slice(1) };
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
    this.closeResults();
  }

  resetSelection() {
    this.selectedFood = null;
    this.searchQuery = '';
    this.hasValue = false;
  }

  closeResults() {
    this.searchResults = [];
    this.hasValue = false;
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
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}