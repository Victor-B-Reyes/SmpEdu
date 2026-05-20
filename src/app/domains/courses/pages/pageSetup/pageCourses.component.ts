import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../service/auth.service';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface TabItem {
  id: string;
  route: string;
  label: string;
  traduc: string;
  icon: string;
}

@Component({
  selector: 'app-page-courses',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgClass],
  template: `
    <div class="">

      <!-- Tabs Navigation -->
      <div class="mb-6 border-b border-gray-200">
        <div class="flex gap-4 flex-wrap">
          @for (tab of visibleTabs(); track tab.id) {
            <button
              [routerLink]="['/courses', tab.route]"
              routerLinkActive="border-b-2 border-blue-500 text-blue-600"
              (click)="activeTab.set(tab.id)"
              class="pb-3 px-1 font-medium transition-colors hover:text-blue-500 text-gray-600"
            >
              <i class="bi mr-2 text-lg opacity-70" [ngClass]="'bi-' + tab.icon"></i>
              {{ tab.traduc }}
            </button>
          }
        </div>
      </div>

      <!-- Contenedor para las subrutas -->
      <router-outlet></router-outlet>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageCourses implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  
  protected readonly isLoading = signal(false);
  protected readonly activeTab = signal<string>('courses');
  
  protected readonly tabs = signal<TabItem[]>([
    {
      id: 'courses',
      label: 'Courses', // Debe coincidir con 'detailed' en app.routes.ts
      route: 'courses',
      traduc: 'Cursos',
      icon: 'book', 
    },

  ]);

  // Filtra las pestañas basadas en los permisos del usuario
  protected readonly visibleTabs = computed(() => {
    return this.tabs().filter(tab => 
      // Asegúrate de que 'Courses' sea exactamente igual al campo 'name' en tu BD
      this.authService.hasDetailedPermission('Courses', tab.label)
    );
  });

  ngOnInit(): void {
    this.syncActiveTab();

    // Mantener sincronizado el signal si el usuario navega por URL o botones de atrás/adelante
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.syncActiveTab());
  }

  private syncActiveTab(): void {
    const url = this.router.url;
    const currentTab = this.tabs().find(tab => url.includes(`/courses/${tab.route}`));
    if (currentTab) {
      this.activeTab.set(currentTab.id);
    }
  }

  selectTab(tabId: string): void {
    const tab = this.tabs().find(t => t.id === tabId);
    if (tab) {
      this.activeTab.set(tab.id);
      // Navega a la subruta (ej. /courses/user)
      this.router.navigate(['/courses', tab.route]);
    }
  }
}