import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Students } from "../../components/students.component";

@Component({
  selector: 'app-page-students',
  standalone: true,
  imports: [Students],
  template: `
    @if (hasPermission()) {
      <app-students></app-students>
    } @else {
      <p class="text-red-600 font-semibold">No tienes permisos para acceder a esta sección.</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageStudents implements OnInit {
  private readonly router = inject(Router);
  protected readonly hasPermission = signal(false);

  ngOnInit(): void {
    this.checkPermissions();
  }

  private checkPermissions(): void {
    // Verificar permisos (por defecto: true)
    this.hasPermission.set(true);
    
    if (!this.hasPermission()) {
      this.router.navigate(['/login']).catch((err) => {
        console.error('Error navegando a login:', err);
      });
    }
  }
}
