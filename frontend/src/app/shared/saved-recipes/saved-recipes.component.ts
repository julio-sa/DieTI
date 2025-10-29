import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RecipesService } from '../recipes.service';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-saved-recipes',
  imports: [CommonModule],
  templateUrl: './saved-recipes.component.html',
  styleUrls: ['./saved-recipes.component.css']
})
export class SavedRecipesComponent implements OnInit {
  recipes: any[] = [];
  favorites: string[] = [];

  constructor(
    private recipesService: RecipesService,
    private router: Router
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

  goBack(): void {
    this.router.navigate(['/home']);
  }
}