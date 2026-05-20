import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersxpermissionsService } from '../../../../service/usersxpermissions.service';
import { BranchsService } from '../../../../service/branchs.service';
import { SignalsService } from '../../../../service/signals.service';
import { alerts } from '../../../../helpers/alerts';
import { CoursesService } from '../../../../service/courses.service';

@Component({
  selector: 'app-user-security',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="userId" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-gray-100 p-6 bg-gray-50/50">
          <div>
            <h3 class="text-xl font-bold text-gray-900">Configuración de Seguridad</h3>
            
          </div>
          <button (click)="close()" class="rounded-full p-2 transition-colors hover:bg-gray-200">
            <svg class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Content -->
        <div class="max-h-[70vh] overflow-y-auto p-8">
          <div class="space-y-8">
            <!-- Branch Permissions Section -->
            <section>
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-xs font-black uppercase tracking-widest text-amber-600">Campus</h4>
                <span class="px-2 py-1 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-md">{{ branches().length }} Asignadas</span>
              </div>

              <!-- Cargar Campus -->
              <div class="mb-6 flex gap-2">
                <select 
                  (change)="onBranchSelected($event)"
                  class="flex-1 rounded-xl border-gray-200 bg-gray-50 text-sm py-2.5 px-4 focus:border-amber-500 focus:ring-amber-500 transition-all outline-none"
                  [value]="selectedBranchToAdd()">
                  <option value="">Seleccione un campus para asignar...</option>
                  <option *ngFor="let b of availableBranchesToAssign()" [value]="b.id">{{ b.name }}</option>
                </select>
                <button 
                  (click)="addBranchPermission()"
                  [disabled]="!selectedBranchToAdd()"
                  class="flex items-center justify-center rounded-xl bg-amber-500 px-5 text-white hover:bg-amber-600 disabled:opacity-40 transition-all shadow-lg shadow-amber-100">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>

              <!-- Listado de Campus Asignados -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                <div *ngFor="let branch of branches()" class="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                  <div class="flex items-center gap-3">
                    <div class="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold">B</div>
                    <span class="text-sm font-medium text-gray-700">{{ branch.name }}</span>
                  </div>
                  <button (click)="removePermission(branch.id)" class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              <!-- Cursos Vigentes Section -->
              <div class="flex items-center justify-between mb-4 mt-8">
                <h4 class="text-xs font-black uppercase tracking-widest text-indigo-600">Cursos / Programas Vigentes</h4>
                <span class="px-2 py-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md">{{ courses().length }} Asignados</span>
              </div>

              <div class="mb-6 flex gap-2">
                <select 
                  (change)="onCourseSelected($event)"
                  [disabled]="courses().some(c => c.idPermission === 0)"
                  class="flex-1 rounded-xl border-gray-200 bg-gray-50 text-sm py-2.5 px-4 focus:border-indigo-500 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50"
                  [value]="selectedCourseToAdd()">
                  <option value="">Seleccione un curso para asignar...</option>
                  <option *ngFor="let c of availableCoursesToAssign()" [value]="c.id">{{ c.name }}</option>
                </select>
                <button 
                  (click)="addCoursePermission()"
                  [disabled]="!selectedCourseToAdd() || courses().some(c => c.idPermission === 0)"
                  class="flex items-center justify-center rounded-xl bg-indigo-500 px-5 text-white hover:bg-indigo-600 disabled:opacity-40 transition-all shadow-lg shadow-indigo-100">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
                <button 
                  (click)="addAllCoursesPermission()"
                  [disabled]="courses().some(c => c.idPermission === 0)"
                  title="Asignar acceso a todas las carreras"
                  class="flex items-center justify-center rounded-xl bg-indigo-100 px-4 text-indigo-700 text-xs font-black uppercase tracking-tighter hover:bg-indigo-200 disabled:opacity-40 transition-all shadow-sm">
                  Todas
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                <div *ngFor="let course of coursesWithNames()" class="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                  <div class="flex items-center gap-3">
                    <div class="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">C</div>
                    <span class="text-sm font-medium text-gray-700">{{ course.name }}</span>
                  </div>
                  <button (click)="removePermission(course.id)" class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </section>

            <!-- SubPermissions Section -->
            <section>
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-xs font-black uppercase tracking-widest text-blue-600">Módulos y Submódulos</h4>
                <span class="px-2 py-1 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md">Accesos al Sistema</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div *ngFor="let module of groupedPermissions()" class="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300">
                  <!-- Header del Módulo (Clickable) -->
                  <div (click)="toggleModule(module.name)" 
                       class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                    <div class="flex items-center gap-2">
                      <i [class]="'bi bi-' + module.icon + ' text-blue-600'"></i>
                      <span class="text-sm font-black text-gray-800 uppercase tracking-tighter">{{ module.name }}</span>
                    </div>
                    <i class="bi" [class.bi-chevron-up]="isModuleExpanded(module.name)" [class.bi-chevron-down]="!isModuleExpanded(module.name)"></i>
                  </div>
                  
                  <!-- Contenido Desplegable -->
                  <div *ngIf="isModuleExpanded(module.name)" class="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200">
                    <div *ngFor="let sub of module.subs" class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all">
                      <div class="flex items-center gap-3">
                        <i [class]="'bi bi-' + sub.subicon + ' text-gray-400'"></i>
                        <span class="text-sm font-medium text-gray-700">{{ sub.subtraduc }}</span>
                      </div>
                      <button (click)="toggleSubPermission(sub); $event.stopPropagation()" 
                              [class]="sub.enabled ? 'bg-indigo-600' : 'bg-gray-200'" 
                              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none">
                        <span [class]="sub.enabled ? 'translate-x-6' : 'translate-x-1'" 
                              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"></span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="flex justify-end gap-3 border-t border-gray-100 p-6 bg-gray-50/50">
          <button (click)="close()" class="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            Cerrar Configuración
          </button>
        </div>
      </div>
    </div>
  `
})
export class UserSecurityComponent {
  // Usamos un setter para que cuando el ID cambie desde el padre, se carguen los permisos automáticamente
  @Input() set userId(value: number | null) {
    this._userId = value;
    if (value && value > 0) {
      this.loadPermissions(value);
    }
  }
  get userId() { return this._userId; }
  private _userId: number | null = null;

  @Output() onClose = new EventEmitter<void>();

  private permissionsService = inject(UsersxpermissionsService);
  private branchService = inject(BranchsService);
  private signalsService = inject(SignalsService);
  private coursesService = inject(CoursesService);
  
  public roots = signal<any[]>([]);
  public branches = signal<any[]>([]);
  public courses = signal<any[]>([]);
  public allAvailableBranches = signal<any[]>([]);
  public allAvailableCourses = signal<any[]>([]);
  public subPermissions = signal<any[]>([]);
  private expandedModules = signal<Set<string>>(new Set());

  public selectedBranchToAdd = signal<string>('');
  public selectedCourseToAdd = signal<string>('');

  // Filtramos las sucursales para no mostrar las que ya están asignadas
  public availableBranchesToAssign = computed(() => {
    const assigned = this.branches();
    const all = this.allAvailableBranches();
    // Comparamos el ID de la sucursal con idPermission (que es donde se guarda el ID de la entidad en Usersxpermission)
    return all.filter(b => !assigned.some(a => a.idPermission === b.id));
  });

  public availableCoursesToAssign = computed(() => {
    const assigned = this.courses();
    // Si ya tiene asignado "Todas" (ID 0), no mostramos más opciones en el combo
    if (assigned.some(a => a.idPermission === 0)) return [];
    const all = this.allAvailableCourses();
    return all.filter(c => !assigned.some(a => a.idPermission === c.id));
  });

  // Cruzamos los permisos con la lista de cursos para obtener el nombre real
  public coursesWithNames = computed(() => {
    const assignedPermissions = this.courses();
    const allCourses = this.allAvailableCourses();
    
    return assignedPermissions.map(permission => {
      // Si el ID de permiso es 0, mostramos el nombre especial
      if (permission.idPermission === 0) {
        return {
          ...permission,
          name: 'TODAS LAS CARRERAS'
        };
      }
      // Buscamos el curso donde el id coincida con el idPermission del permiso
      const courseDetail = allCourses.find(c => c.id === permission.idPermission);
      return {
        ...permission,
        name: courseDetail ? courseDetail.name : 'Cargando nombre...'
      };
    });
  });

  // Agrupamos los subpermisos por el nombre del módulo (traduc)
  public groupedPermissions = computed(() => {
    const flat = this.subPermissions();
    const groups: { [key: string]: any } = {};

    flat.forEach(item => {
      if (!groups[item.traduc]) {
        groups[item.traduc] = { name: item.traduc, icon: item.icon, subs: [] };
      }
      groups[item.traduc].subs.push(item);
    });

    return Object.values(groups);
  });

  toggleModule(moduleName: string) {
    this.expandedModules.update(set => {
      const newSet = new Set(set);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  }

  isModuleExpanded(moduleName: string): boolean {
    return this.expandedModules().has(moduleName);
  }

  loadPermissions(userId: number) {
    this.permissionsService.getUsersxPermissionsGeneral('root', userId).subscribe(res => {
      this.roots.set(Array.isArray(res) ? res : (res?.data || []));
    });

    // Cargar cursos asignados (usando el tipo 'course' en la tabla de permisos)
    this.permissionsService.getUsersxPermissionsGeneral('course', userId).subscribe(res => {
      //console.log('Courses permissions loaded:', res);
      this.courses.set(Array.isArray(res) ? res : (res?.data || []));
    });

    const idCompany = this.signalsService.getRootSelectedBySidebar() ?? 0;

    // Cargar sucursales que ya tiene el usuario
    this.branchService.getBranchesByUserAndCompany(userId, idCompany).subscribe(res => {
      //console.log('Branches permissions loaded:', res);
      this.branches.set(Array.isArray(res) ? res : (res?.project || []));
    });

    // Cargar todas las sucursales disponibles de la empresa para el dropdown
    this.branchService.getBranches(idCompany).subscribe(res => {
      //console.log('Available branches loaded:', res);
      this.allAvailableBranches.set(Array.isArray(res) ? res : (res?.data || []));
    });

    // Cargar todos los cursos vigentes para el dropdown
    const idBranch = this.signalsService.getBranchSelectedBySidebar() ?? 0;
    if (idBranch > 0) {
      this.coursesService.getCoursesVigentes(idBranch).subscribe(res => {
        //console.log('Available courses loaded:', res);
        this.allAvailableCourses.set(Array.isArray(res) ? res : (res?.data || []));
      });
    }

    this.permissionsService.getPermissionByUser(userId).subscribe(res => {
      this.subPermissions.set(Array.isArray(res) ? res : (res?.data || []));
    });
  }

  onBranchSelected(event: any) {
    this.selectedBranchToAdd.set(event.target.value);
  }

  onCourseSelected(event: any) {
    this.selectedCourseToAdd.set(event.target.value);
  }

  addBranchPermission() {
    const branchId = Number(this.selectedBranchToAdd());
    if (!branchId || !this.userId) return;

    const payload = { idUser: this.userId, idPermission: branchId, type: 'branch', description: 'ASIGNACION MANUAL', active: 1 };

    this.permissionsService.addUserxPermission(payload).subscribe(() => {
      alerts.toastAlert('Sucursal asignada correctamente', 'success');
      this.selectedBranchToAdd.set('');
      this.loadPermissions(this.userId!);
    });
  }

  addCoursePermission() {
    const courseId = Number(this.selectedCourseToAdd());
    if (!courseId || !this.userId) return;

    const payload = { idUser: this.userId, idPermission: courseId, type: 'course', description: 'CURSO ASIGNADO', active: 1 };

    this.permissionsService.addUserxPermission(payload).subscribe(() => {
      alerts.toastAlert('Curso asignado correctamente', 'success');
      this.selectedCourseToAdd.set('');
      this.loadPermissions(this.userId!);
    });
  }

  addAllCoursesPermission() {
    if (!this.userId) return;

    const payload = { 
      idUser: this.userId, 
      idPermission: 0, // ID 0 para representar "Todas las carreras"
      type: 'course', 
      description: 'ACCESO TOTAL A CARRERAS', 
      active: 1 
    };

    this.permissionsService.addUserxPermission(payload).subscribe(() => {
      alerts.toastAlert('Se han asignado todas las carreras correctamente', 'success');
      this.loadPermissions(this.userId!);
    });
  }

  toggleSubPermission(sub: any) {
    const newState = !sub.enabled;
    const payload = {
      idSubPermission: sub.idSubPermission,
      idUser: this.userId!,
      enabled: newState
    };

    this.permissionsService.savePermissionByUser(payload).subscribe({
      next: () => {
        // Actualizamos localmente el signal para feedback inmediato
        this.subPermissions.update(list => 
          list.map(item => item.idSubPermission === sub.idSubPermission ? { ...item, enabled: newState } : item)
        );
        alerts.toastAlert(`Acceso a ${sub.subtraduc} ${newState ? 'activado' : 'desactivado'}`, 'success');
      }
    });
  }

  removePermission(id: number) {
    alerts.confirmAlert('Revocar Acceso', '¿Está seguro de eliminar este permiso?', 'warning', 'Eliminar').then(res => {
      if (res.isConfirmed) {
        this.permissionsService.deleteUserxPermission(id).subscribe(() => {
          alerts.toastAlert('Permiso eliminado', 'success');
          if (this.userId) this.loadPermissions(this.userId);
        });
      }
    });
  }

  close() {
    this.onClose.emit();
  }
}