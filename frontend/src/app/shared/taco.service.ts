// taco.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { map } from 'rxjs/operators';

export interface NutritionalInfo {
  _id: string | number;
  description: string;
  calorias_kcal: number | null;
  proteinas_g: number | null;
  gordura_g: number | null;
  carbo_g: number | null;
  type?: 'taco' | 'recipe'; // opcional: para diferenciar na UI
}

@Injectable({
  providedIn: 'root'
})
export class TacoService {
  private readonly API_BASE = 'http://localhost:8000';
  private readonly RECIPES_SEARCH = `${this.API_BASE}/search/recipes/search`;
  private readonly TACO_SEARCH = `${this.API_BASE}/taco_table/search`;

  constructor(private http: HttpClient) {}

  searchFood(term: string): Observable<NutritionalInfo[]> {
    if (!term || term.trim().length < 2) {
      return of([]);
    }

    const params = new HttpParams().set('q', term.trim());

    return this.http.get<NutritionalInfo[]>(
      'http://localhost:8000/search/combined',
      { params }
    ).pipe(
      catchError(err => {
        console.error('Erro ao buscar alimentos:', err);
        return of([]);
      })
    );
  }

  // Calcula os valores para a quantidade informada (em gramas)
  // Como sua base é por 1g → multiplica diretamente
  calculateForGrams(food: NutritionalInfo, grams: number) {
    return {
      calorias: (food.calorias_kcal || 0) * grams,
      proteinas: (food.proteinas_g || 0) * grams,
      carbo: (food.carbo_g || 0) * grams,
      gordura: (food.gordura_g || 0) * grams
    };
  }

  normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD') // Remove acentos
      .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
      .replace(/[^a-z0-9\s]/g, ' ') // Substitui pontuação por espaço
      .replace(/\s+/g, ' ') // Reduz múltiplos espaços
      .trim();
  }
}