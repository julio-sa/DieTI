import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  //private apiURL = 'http://localhost:3000/api/auth';
  private apiURL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  register(user: any) {
    return this.http.post(`${this.apiURL}/register`, user);
  }
}