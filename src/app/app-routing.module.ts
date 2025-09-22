import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { ScannerComponent } from './pages/scanner/scanner.component';
import { AuthGuard } from './core/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'scanner', component: ScannerComponent, canActivate: [AuthGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'scanner' },
  { path: '**', redirectTo: 'scanner' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
