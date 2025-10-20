import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Goals {
  calorias: number;
  proteinas: number;
  carbo: number;
  gordura: number;
}

@Injectable({
  providedIn: 'root'
})
export class GoalService {
  private goalsKey = 'userGoals';

  // Estado observável
  private goalsSubject = new BehaviorSubject<Goals>(this.loadFromStorage());
  goals$ = this.goalsSubject.asObservable();

  constructor() {}

  // Obter metas atuais
  getGoals(): Goals {
    return this.goalsSubject.value;
  }

  // Atualizar metas
  updateGoals(newGoals: Partial<Goals>) {
    const current = this.getGoals();
    const updated: Goals = { ...current, ...newGoals };
    this.goalsSubject.next(updated);
    this.saveToStorage(updated);
  }

  // Carregar do localStorage
  private loadFromStorage(): Goals {
    const saved = localStorage.getItem(this.goalsKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved goals');
      }
    }
    // Meta padrão
    return {
      calorias: 2704,
      proteinas: 176,
      carbo: 320,
      gordura: 80
    };
  }

  // Salvar no localStorage
  private saveToStorage(goals: Goals) {
    localStorage.setItem(this.goalsKey, JSON.stringify(goals));
  }
}