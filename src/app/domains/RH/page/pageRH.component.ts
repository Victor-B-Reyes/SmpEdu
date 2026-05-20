import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../service/auth.service';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

enum StudentAction {
  SETUP = 'setup',
  PROFILE = 'profile',
  GRADES = 'grades',
  ATTENDANCE = 'attendance',
  TASKS = 'tasks',
  PAYMENTS = 'payments',
  SCHEDULE = 'schedule',
}

interface ActionButton {
  id: string;
  label: string;
  icon: string;
  color: string;
  action: StudentAction;
  category: 'academic' | 'personal' | 'financial';
}

interface TabItem {
  id: string;
  route: string;
  label: string;
  traduc: string;
  icon: string;
}

@Component({
  selector: 'app-page-setup',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgClass],
  template: `
    <div class="">

      <!-- Tabs Navigation -->
      <div class="mb-6 border-b border-gray-200">
        <div class="flex gap-4 flex-wrap">
          @for (tab of visibleTabs(); track tab.id) {
            <button
              [routerLink]="['/rh', tab.route]"
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

      <!-- Submenu Actions by Tab -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        @for (btn of filteredButtons; track btn.id) {
          <button 
            (click)="onExecuteAction(btn.action)"
            [style.border-left-color]="btn.color"
            class="flex items-center p-4 bg-white rounded-lg shadow-sm border-l-4 hover:shadow-md hover:bg-gray-50 transition-all text-gray-700"
          >
            <i class="bi mr-3 text-2xl opacity-70" [ngClass]="'bi-' + btn.icon"></i>
            <span class="font-medium">{{ btn.label }}</span>
          </button>
        } @empty {
          @if (isLoading()) {
            <p class="text-gray-500 italic">Cargando acciones...</p>
          } 
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageSetup implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  
  protected readonly isLoading = signal(false);
  protected readonly activeTab = signal<string>('rh');
  protected readonly menuButtons = signal<ActionButton[]>([]);
  
  protected readonly tabs = signal<TabItem[]>([
    {
      id: 'Employees',
      label: 'Employees',
      route: 'employees',
      traduc: 'Empleados',
      icon: 'person-badge',
    },
  ]);

  // Filtra las pestañas basadas en los permisos del usuario
  protected readonly visibleTabs = computed(() => {
    return this.tabs().filter(tab => 
      this.authService.hasDetailedPermission('RH', tab.label)
    );
  });

  protected get filteredButtons(): ActionButton[] {
    const active = this.activeTab();
    return this.menuButtons().filter(btn => btn.category === active);
  }

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
    const currentTab = this.tabs().find(tab => url.includes(`/rh/${tab.route}`));
    if (currentTab) {
      this.activeTab.set(currentTab.id);
    }
  }

  selectTab(tabId: string): void {
    const tab = this.tabs().find(t => t.id === tabId);
    if (tab) {
      this.activeTab.set(tab.id);
      // Navega a la subruta (ej. /rh/user)
      this.router.navigate(['/rh', tab.route]);
    }
  }

  onExecuteAction(action: StudentAction): void {
    const actionMap: Record<StudentAction, () => void> = {
      [StudentAction.SETUP]: () => this.navigateTo('settings'),
      [StudentAction.PROFILE]: () => this.navigateTo('profile'),
      [StudentAction.GRADES]: () => this.navigateTo('grades'),
      [StudentAction.ATTENDANCE]: () => this.navigateTo('attendance'),
      [StudentAction.TASKS]: () => this.navigateTo('tasks'),
      [StudentAction.PAYMENTS]: () => this.navigateTo('payments'),
      [StudentAction.SCHEDULE]: () => this.navigateTo('schedule'),
    };

    const handler = actionMap[action];
    if (handler) {
      handler();
    } else {
      console.warn('Acción desconocida:', action);
    }
  }

  private navigateTo(route: string): void {
    // Corregido el path base para Setup
    this.router.navigate([`/rh/${route}`]).catch((err) => {
      console.error(`Error navegando a ${route}:`, err);
    });
  }
}