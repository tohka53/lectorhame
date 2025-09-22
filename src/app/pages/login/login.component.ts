import { Component } from '@angular/core';
import { FormBuilder, Validators, FormGroup, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loading = false;
  errorMsg = '';
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  // ✅ getters tipados para el template
  get email(): AbstractControl | null { return this.form.get('email'); }
  get password(): AbstractControl | null { return this.form.get('password'); }

  submit() {
    this.errorMsg = '';
    if (this.form.invalid) return;

    const { email, password } = this.form.value;
    this.loading = true;
    setTimeout(() => {
      const ok = this.auth.login(email!, password!);
      this.loading = false;
      if (ok) this.router.navigate(['/scanner']);
      else this.errorMsg = 'Credenciales inválidas';
    }, 400);
  }
}
