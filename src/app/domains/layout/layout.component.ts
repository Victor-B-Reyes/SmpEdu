import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="flex min-h-screen bg-gray-50">
      <!-- Sidebar Fijo -->
      <app-sidebar></app-sidebar>

      <!-- Área de Contenido Principal -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main class="flex-1 p-4 md:p-8 overflow-auto">
          <!-- Aquí se renderizan las páginas (Dashboard, Alumnos, etc.) -->
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
})
export class LayoutComponent {}