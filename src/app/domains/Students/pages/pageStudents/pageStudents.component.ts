import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../service/auth.service';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

enum StudentAction {
  ADD_STUDENT = 'add_student',
  EXPORT_LIST = 'export_list',
  PRINT_KARDEX = 'print_kardex',
  DOWNLOAD_PDF = 'download_pdf',
}

interface ActionButton {
  id: string;
  label: string;
  icon: string;
  color: string;
  action: StudentAction;
  category: 'list' | 'kardex';
}

interface TabItem {
  id: string;
  route: string;
  label: string;
  traduc: string;
  icon: string;
}

@Component({
  selector: 'app-page-students',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgClass],
  template: `
    <div>
      <!-- Tabs Navigation -->
      <div class="mb-6 border-b border-gray-200">
        <div class="flex gap-4 flex-wrap">
          @for (tab of visibleTabs(); track tab.id) {
            <button
              [routerLink]="['/students', tab.route]"
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

      <!-- Contenedor para las subrutas (Listado / Kardex) -->
      <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
        <router-outlet></router-outlet>
      </div>

      <!-- Submenu Actions by Tab -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        @for (btn of filteredButtons(); track btn.id) {
          <button 
            (click)="onExecuteAction(btn.action)"
            [style.border-left-color]="btn.color"
            class="flex items-center p-4 bg-white rounded-lg shadow-sm border-l-4 hover:shadow-md hover:bg-gray-50 transition-all text-gray-700"
          >
            <i class="bi mr-3 text-2xl opacity-70" [ngClass]="'bi-' + btn.icon"></i>
            <span class="font-medium">{{ btn.label }}</span>
          </button>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageStudents implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  
  protected readonly activeTab = signal<string>('list');
  
  protected readonly tabs = signal<TabItem[]>([
    {
      id: 'list',
      label: 'List',
      route: 'list',
      traduc: 'Listado',
      icon: 'people',
    },
    {
      id: 'kardex',
      label: 'Kardex',
      route: 'kardex',
      traduc: 'Kárdex',
      icon: 'mortarboard',
    },
  ]);

  protected readonly menuButtons = signal<ActionButton[]>([  ]);

  // Filtra las pestañas basadas en los permisos del usuario para el módulo 'Students'
  protected readonly visibleTabs = computed(() => {
    return this.tabs().filter(tab => 
      this.authService.hasDetailedPermission('Students', tab.label)
    );
  });

  // Botones filtrados por la pestaña activa
  protected readonly filteredButtons = computed(() => {
    const active = this.activeTab();
    return this.menuButtons().filter(btn => btn.category === active);
  });

  ngOnInit(): void {
    this.syncActiveTab();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.syncActiveTab());
  }

  private syncActiveTab(): void {
    const url = this.router.url;
    const currentTab = this.tabs().find(tab => url.includes(`/students/${tab.route}`));
    if (currentTab) {
      this.activeTab.set(currentTab.id);
    }
  }

  onExecuteAction(action: StudentAction): void {
    const actionMap: Record<StudentAction, () => void> = {
      [StudentAction.ADD_STUDENT]: () => console.log('Abriendo modal de nuevo estudiante...'),
      [StudentAction.EXPORT_LIST]: () => console.log('Exportando lista...'),
      [StudentAction.PRINT_KARDEX]: () => window.print(),
      [StudentAction.DOWNLOAD_PDF]: () => console.log('Generando PDF del Kárdex...'),
    };

    const handler = actionMap[action];
    if (handler) {
      handler();
    }
  }
}
