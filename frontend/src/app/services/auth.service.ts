import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiURL = 'environment.apiUrl/api';

  constructor(private http: HttpClient) {}

  register(user: any) {
    return this.http.post(`${this.apiURL}/register`, user);
  }
}