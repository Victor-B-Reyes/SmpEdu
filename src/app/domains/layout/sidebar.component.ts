import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../service/auth.service';
import { TrackingService } from '../../service/tracking.service';
import { CompanyBranchService } from '../../service/company-branch.service';
import { RootService } from '../../service/root.service';
import { SignalsService } from '../../service/signals.service';
import { BranchsService } from '../../service/branchs.service';
import { CoursesService } from '../../service/courses.service';
import { UsersxpermissionsService } from '../../service/usersxpermissions.service';
import { environment } from '../../environments/environment';
import { Branch } from '../../interface/branch.interface';
import { Company } from '../../interface/company.interface';
import { Subject, takeUntil, forkJoin } from 'rxjs';

interface NavItem {
  route: string;
  label: string;
  traduc: string;
  icon?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  template: `
    <aside [class.w-64]="!isCollapsed()" [class.w-20]="isCollapsed()"
           class="h-screen bg-indigo-950 text-white transition-all duration-300 flex flex-col shadow-2xl sticky top-0 border-r border-white/10">

      <!-- Logo Section -->
      <div class="h-20 flex items-center px-4 border-b border-white/5 shrink-0">
        <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-indigo-500/20 shadow-lg">
          <span class="font-black text-xl italic tracking-tighter">S</span>
        </div>
        @if (!isCollapsed()) {
          <div class="ml-3 overflow-hidden">
            <p class="font-black text-base leading-tight whitespace-nowrap tracking-tight">EduControl <span class="text-indigo-400 italic">pro</span></p>
            <p class="text-indigo-300/60 text-[10px] font-bold uppercase tracking-[0.2em]">Gestión Inteligente</p>
          </div>
        }
      </div>

      <div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col custom-scrollbar">
        
        <!-- Selectors Section -->
        <div class="px-3 py-6 space-y-4" *ngIf="!isCollapsed() || isTemporarilyExpanded()">
          
          <!-- Company Select -->
          <div class="space-y-1">
            <label class="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest ml-1">Institución</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i class="bi bi-building text-indigo-400 group-focus-within:text-white transition-colors"></i>
              </div>
              <select
                id="root"
                (change)="onRootsSelected($event)"
                class="block w-full pl-9 pr-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-900/50 transition-all appearance-none cursor-pointer"
                [value]="selectedRoot() || ''"
              >
                <option selected value="" disabled>Empresa...</option>
                <option *ngFor="let item of rootData()" [value]="item.id" class="text-gray-900">
                  {{ item.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Branch Select -->
          <div class="space-y-1">
            <label class="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest ml-1">Campus</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i class="bi bi-geo-alt text-indigo-400 group-focus-within:text-white transition-colors"></i>
              </div>
              <select
                id="branchs"
                (change)="onBranchSelected($event)"
                class="block w-full pl-9 pr-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-900/50 transition-all appearance-none cursor-pointer"
                [value]="selectedBranchId() || ''"
              >
                <option selected disabled value="">Campus...</option>
                <option *ngFor="let item of branchData()" [value]="'' + item.id" class="text-gray-900">
                  {{ item.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Course Select -->
          <div class="space-y-1" *ngIf="courseData().length > 0">
            <label class="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest ml-1">Carrera / Programa</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i class="bi bi-mortarboard text-indigo-400 group-focus-within:text-white transition-colors"></i>
              </div>
              <select
                id="courses_sidebar"
                (change)="onCourseSelected($event)"
                class="block w-full pl-9 pr-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-900/50 transition-all appearance-none cursor-pointer"
                [value]="selectedCourseId() || ''"
              >
                <option selected disabled value="">Seleccionar...</option>
                <option *ngFor="let item of courseData()" [value]="item.id" class="text-gray-900">
                  {{ item.abreviatura }}
                </option>
              </select>
            </div>
          </div>

        </div>

        <!-- Navigation Menu -->
        <nav class="flex-1 px-3 space-y-1 mt-2">
          @for (item of visibleNavItems(); track item.route) {
            <a
             [routerLink]="item.route"
             routerLinkActive="bg-indigo-600/40 text-white shadow-lg ring-1 ring-white/20"
             class="flex items-center p-3 rounded-xl text-indigo-300 hover:bg-white/5 hover:text-white transition-all group">
              <span class="w-6 h-6 flex items-center justify-center shrink-0">
                 <i class="bi text-lg opacity-50 group-hover:opacity-100 transition-opacity" [ngClass]="'bi-' + item.icon"></i>
              </span>
              @if (!isCollapsed()) {
                <span class="ml-3 font-semibold text-sm tracking-tight truncate transition-all">
                  {{ item.traduc }}
                </span>
              }
            </a>
          }
        </nav>
      </div>

      <!-- Footer Section: User & Logout -->
      <div class="px-3 py-4 border-t border-white/5">
        <div class="flex items-center p-2 mb-3 bg-white/5 rounded-2xl" [class.justify-center]="isCollapsed()">
          <div class="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
            <span class="text-sm font-black">{{ nameUser() }}</span>
          </div>
          @if (!isCollapsed()) {
            <div class="ml-3 overflow-hidden">
              <p class="text-[13px] font-black truncate leading-tight text-white">{{ nameUser() }}</p>
              <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Usuario Activo</p>
            </div>
          }
        </div>

        <button (click)="logout()"
                class="w-full flex items-center p-3 rounded-xl text-indigo-300 hover:bg-rose-500/20 hover:text-rose-300 transition-all group"
                [class.justify-center]="isCollapsed()">
          <span class="w-6 h-6 flex items-center justify-center shrink-0">
             <i class="bi bi-box-arrow-left text-lg opacity-60 group-hover:opacity-100 transition-opacity"></i>
          </span>
          @if (!isCollapsed()) {
            <span class="ml-3 font-bold text-sm tracking-tight">Cerrar sesión</span>
          }
        </button>
      </div>

      <div class="p-4 border-t border-white/5">
        <button (click)="toggleSidebar()"
                class="w-full flex items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-indigo-600 hover:text-white transition-all text-indigo-400 group border border-white/5">
          <span class="text-[10px] font-black uppercase tracking-widest">
            {{ isCollapsed() ? 'Expandir' : 'Contraer menu' }}
          </span>
        </button>
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  public trackingService = inject(TrackingService);
  private companyBranchService = inject(CompanyBranchService);
  private rootService = inject(RootService);
  private signalsService = inject(SignalsService);
  private branchService = inject(BranchsService);
  private coursesService = inject(CoursesService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private destroy$ = new Subject<void>();

  public isCollapsed = signal(false);
  public isSidebarCollapsed = signal(false);
  public isTemporarilyExpanded = signal(false);
  public nameUser = signal<string>('');

  public courseData = signal<any[]>([]);
  public selectedCourseId = signal<number | null>(null);

  public rootData = signal<Company[]>([]);
  public branchData = computed(() => this.companyBranchService.branches$());
  public selectedRoot = computed(() => this.companyBranchService.selectedCompanyId$());
  public selectedBranchId = computed(() => this.companyBranchService.selectedBranchId$());

  public navItems = computed<NavItem[]>(() => {
    // Obtenemos los permisos del servicio de autenticación (asumiendo que es una señal)
    const permissions = (this.auth as any).userPermissions?.() || [];
    const items: NavItem[] = [];
    const seenNames = new Set<string>();

    const routeMap: Record<string, string> = {
      'Dashboard': '/dashboard',
      'Students': '/students',
      'Teachers': '/teachers',
      'Subjects': '/subjects',
      'Scheduling': '/scheduling',
      'Setup': '/setup',
      'SchoolYear': '/schoolYear',
      'RH': '/rh'
    };

    permissions.forEach((p: any) => {
      // Solo agregamos si está habilitado y es una categoría nueva para el menú superior
      if (p.enabled && !seenNames.has(p.name)) {
        seenNames.add(p.name);
        items.push({
          route: routeMap[p.name] || `/${p.name.toLowerCase()}`,
          label: p.name,
          traduc: p.traduc,
          icon: p.icon
        });
      }
    });

    return items;
  });

  public visibleNavItems = computed(() => {
    // Ahora los navItems ya vienen filtrados por permisos 'enabled' desde la fuente
    return this.navItems();
  });

  ngOnInit(): void {
    // Restaurar datos de sesión si los servicios están vacíos (escenario de refresh)
    if (!this.trackingService.getnameUser()) {
      const savedName = localStorage.getItem('nameUser');
      if (savedName) this.trackingService.setnameUser(savedName);
    }
    
    if (!this.signalsService.idUser() || this.signalsService.idUser() === 0) {
      const savedId = localStorage.getItem('idUser');
      if (savedId) this.signalsService.setidUser(Number(savedId));
    }

    this.nameUser.set(this.trackingService.getnameUser());
    //console.log('Nombre del usuario en Sidebar:', this.nameUser());
    this.getpermissionxRoots();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getpermissionxRoots(): void {
    this.rootService.get2Root(this.signalsService.idUser()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        const roots = this.normalizeRoots(data);
        this.rootData.set(roots);
        this.companyBranchService.setCompanies(roots);

        if (roots.length === 0) {
          this.companyBranchService.reset();
          return;
        }

        const savedRootId = this.signalsService.getRootSelectedBySidebar() ?? 0;
        const defaultRoot = roots.find((root) => root.id === savedRootId) ?? roots[0];
        this.applyRootSelection(defaultRoot.id);
      },
      error: (err) => {
        console.error('Error al obtener roots de permisos:', err);
        this.rootData.set([]);
        this.companyBranchService.reset();
      },
    });
  }

  getpermissionxBranchs(idRoot: number): void {
    if (!Number.isFinite(idRoot) || idRoot <= 0) {
      console.warn('Se intento cargar sucursales con un idRoot invalido:', idRoot);
      this.companyBranchService.clearBranches();
      return;
    }

    const hasPermission = this.auth.hasDetailedPermission('principal', 'see-all-branches');
    const isRoot = this.signalsService.getemailChoose() === environment.root;

    if (hasPermission || isRoot) {
      this.branchService.getBranches2fields(idRoot).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          const branches = this.normalizeBranches(data, idRoot, true);
          this.syncBranches(branches, idRoot);
        },
        error: (error) => {
          console.error('Error al obtener branches:', error);
          this.companyBranchService.clearBranches();
        },
      });
      return;
    }

    this.branchService
      .getBranchesByUserAndCompany(this.signalsService.idUser(), idRoot)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          const branches = this.normalizeBranches(data?.project, idRoot, false);
          this.syncBranches(branches, idRoot);
        },
        error: (error) => {
          console.error('Error al obtener branches:', error);
          this.companyBranchService.clearBranches();
        },
      });
  }

  getpermissionxCourses(branchId: number): void {
    if (branchId <= 0) {
      this.courseData.set([]);
      this.selectedCourseId.set(null);
      return;
    }

    const userId = this.signalsService.idUser();

    // Consultamos los permisos asignados y los detalles de los cursos en paralelo
    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('course', userId),
      courses: this.coursesService.getCoursesVigentes(branchId)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const assigned = Array.isArray(res.permissions) ? res.permissions : (res.permissions?.data || []);
        const allCourses = Array.isArray(res.courses) ? res.courses : (res.courses?.data || []);

        let filteredCourses = [];
        // Si el usuario tiene el permiso global 0, agregamos la opción "TODAS" con ID 0
        if (assigned.some((p: any) => p.idPermission === 0)) {
          filteredCourses = [
            { id: 0, abreviatura: 'TODAS' },
            ...allCourses
          ];
        } else {
          // De lo contrario, filtramos los cursos vigentes por los IDs permitidos
          filteredCourses = allCourses.filter((c: any) => 
            assigned.some((p: any) => p.idPermission === c.id)
          );
        }

        this.courseData.set(filteredCourses);
        //console.log('Cursos disponibles para el usuario:', filteredCourses);
        
        const savedCourseId = this.signalsService.getCourseSelectedBySidebar() ?? 0;
        // Intentamos seleccionar el guardado, si no existe o es 0, seleccionamos la opción TODAS (id 0) si está disponible
        const preferredCourse = filteredCourses.find((c: any) => c.id === savedCourseId) ?? filteredCourses.find((c: any) => c.id === 0) ?? filteredCourses[0];
        if (preferredCourse) this.applyCourseSelection(preferredCourse.id);
      },
      error: (err) => {
        console.error('Error al obtener cursos en sidebar:', err);
        this.courseData.set([]);
      },
    });
  }

  private getpermissionxContracts(): void {
    //console.log('Cargando permisos de contratos...');
  }

  onRootsSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const companyId = Number(target.value);

    if (!Number.isFinite(companyId) || companyId <= 0) {
      console.warn('Empresa invalida seleccionada:', target.value);
      return;
    }

    this.applyRootSelection(companyId);
    //console.log('Empresa seleccionada:', companyId);
  }

  onBranchSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const branchId = Number(target.value);

    if (!Number.isFinite(branchId)) {
      console.warn('Sucursal invalida seleccionada:', target.value);
      return;
    }

    this.applyBranchSelection(branchId, target.options[target.selectedIndex]?.text ?? '');
    //console.log('Sucursal seleccionada:', branchId);
  }

  onCourseSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const courseId = Number(target.value);
    this.applyCourseSelection(courseId);
  }

  expandTemporarily(): void {
    if (this.isSidebarCollapsed()) {
      this.isTemporarilyExpanded.set(true);
    }
  }

  collapseAfterInteraction(): void {
    if (this.isSidebarCollapsed()) {
      this.isTemporarilyExpanded.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  toggleSidebar(): void {
    const collapsed = !this.isCollapsed();
    this.isCollapsed.set(collapsed);
    this.isSidebarCollapsed.set(collapsed);

    if (!collapsed) {
      this.isTemporarilyExpanded.set(false);
    }
  }

  private applyRootSelection(companyId: number): void {
    this.companyBranchService.selectCompany(companyId);
    this.companyBranchService.clearBranches();
    this.signalsService.setRootSelectedBySidebar(companyId);
    this.trackingService.setCompany(String(companyId));
    this.getpermissionxBranchs(companyId);
  }

  private applyBranchSelection(branchId: number, branchName: string): void {
    this.companyBranchService.selectBranch(branchId);
    this.signalsService.setBranchSelectedBySidebar(branchId);
    this.signalsService.setBranchNameSelectedBySidebar(branchName);
    this.trackingService.setBranch(String(branchId));
    this.trackingService.setContract(String(branchId));

    setTimeout(() => {
      const branchSelect = document.getElementById('branchs') as HTMLSelectElement | null;
      if (branchSelect) {
        branchSelect.value = String(branchId);
      }
    });

    this.getpermissionxCourses(branchId);
    this.getpermissionxContracts();
  }

  private applyCourseSelection(courseId: number): void {
    this.selectedCourseId.set(courseId);
    this.signalsService.setCourseSelectedBySidebar?.(courseId);
  }

  private syncBranches(branches: Branch[], idRoot: number): void {
    this.companyBranchService.setBranches(branches);

    if (branches.length === 0) {
      this.companyBranchService.selectBranch(null);
      return;
    }

    const savedBranchId = this.signalsService.getBranchSelectedBySidebar() ?? 0;
    const allBranchesId = -idRoot;
    const preferredBranch =
      branches.find((branch) => branch.id === savedBranchId) ??
      branches.find((branch) => branch.id !== allBranchesId) ??
      branches[0];

    this.applyBranchSelection(preferredBranch.id, preferredBranch.name);
  }

  private normalizeRoots(data: unknown): Company[] {
    const rawRoots = Array.isArray(data) ? data : Object.values(data ?? {});

    return rawRoots
      .map((root: any) => ({
        id: Number(root?.id),
        name: String(root?.name ?? ''),
        description: root?.description,
        active: root?.active ?? true,
      }))
      .filter((root) => Number.isFinite(root.id) && root.id > 0 && root.name.trim().length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private normalizeBranches(data: unknown, idRoot: number, includeAllOption: boolean): Branch[] {
    const rawBranches = Array.isArray(data) ? data : [];
    const branches = rawBranches
      .map((branch: any) => ({
        id: Number(branch?.id),
        idCompany: idRoot,
        name: String(branch?.name ?? ''),
        description: branch?.description,
        address: branch?.address,
        active: branch?.active ?? true,
      }))
      .filter((branch) => Number.isFinite(branch.id) && branch.name.trim().length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!includeAllOption) {
      return branches;
    }

    return [
      {
        id: -idRoot,
        idCompany: idRoot,
        name: 'Todas las sucursales',
        active: true,
      },
      ...branches,
    ];
  }
}
