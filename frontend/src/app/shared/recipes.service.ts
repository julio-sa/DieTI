import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RecipesService {
  private apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Token JWT ausente!');
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getRecipes(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/recipes/list?user_id=${userId}`, {
      headers: this.getHeaders()
    });
  }

  saveRecipe(recipe: any, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/recipes/save`, { ...recipe, user_id: userId }, {
      headers: this.getHeaders()
    });
  }

  updateRecipe(id: string, recipe: any, userId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/recipes/update/${id}`, { ...recipe, user_id: userId }, {
      headers: this.getHeaders()
    });
  }

  deleteRecipe(id: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/recipes/delete/${id}?user_id=${userId}`, {
      headers: this.getHeaders()
    });
  }
}