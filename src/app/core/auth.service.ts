import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _tokenKey = 'lh_token';

  constructor(private router: Router) {}

  get isLoggedIn(): boolean {
    return !!localStorage.getItem(this._tokenKey);
  }

  login(email: string, password: string): boolean {
    const ok = email === environment.demoUser.email && password === environment.demoUser.password;
    if (ok) {
      localStorage.setItem(this._tokenKey, 'demo-token');
    }
    return ok;
  }

  logout() {
    localStorage.removeItem(this._tokenKey);
    this.router.navigate(['/login']);
  }
}
