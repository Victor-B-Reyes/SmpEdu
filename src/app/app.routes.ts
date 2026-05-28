import { Routes } from '@angular/router';
import { LayoutComponent } from './domains/layout/layout.component';
import { MasterPermissionsGuard } from './guards/master-permissions.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./domains/layout/login/login.component')
  },
  {
    path: '',
    component: LayoutComponent,
    children: [ // Puedes ajustar esta parte para usar el componente de bienvenida
      { path: '', redirectTo: 'welcome', pathMatch: 'full' }, // Redirige a 'welcome' por defecto
      {
        path: 'welcome',
        loadComponent: () => import('./domains/layout/home/welcome.component') // Carga el nuevo componente de bienvenida
      },
      { 
        path: 'dashboard',
        data: { permissions: { master: 'Dashboard' } },
        canActivate: [MasterPermissionsGuard],
        loadComponent: () => import('./domains/Dashboards/pages/pageDashboards/pageDashboards.component') 
      },
      { 
        path: 'students', 
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'Students' } },
        loadComponent: () => import('./domains/Students/pages/pageStudents/pageStudents.component'),
        children: [
          { path: '', redirectTo: 'list', pathMatch: 'full' },
          { 
            path: 'list', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Students', detailed: 'List' } },
            loadComponent: () => import('./domains/Students/components/students.component') 
          },
          { 
            path: 'kardex', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Students', detailed: 'Kardex' } },
            loadComponent: () => import('./domains/Students/kardex/kardex.component')
          }, 
        ]
      },
      { 
        path: 'rh', 
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'RH' } },
        loadComponent: () => import('./domains/RH/page/pageRH.component'),
        children: [
          { path: '', redirectTo: 'employees', pathMatch: 'full' },
          { 
            path: 'employees', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'RH', detailed: 'Employees' } },
            loadComponent: () => import('./domains/RH/components/employees/employees.component') 
          }, 
        ]
      },
      { 
        path: 'setup', 
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'Setup' } },
        loadComponent: () => import('./domains/Setup/pages/pageSetup/pageSetup.component'),
        children: [
          { path: '', redirectTo: 'user', pathMatch: 'full' },
          { 
            path: 'user', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Setup', detailed: 'User' } },
            loadComponent: () => import('./domains/Setup/components/user/user.component') 
          }, 
          { 
            path: 'branch', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Setup', detailed: 'Branch' } },
            loadComponent: () => import('./domains/Setup/components/branch/branch.component') 
          },
          { 
            path: 'logs', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Setup', detailed: 'Logs' } },
            loadComponent: () => import('./domains/Dashboards/pages/pageDashboards/pageDashboards.component') 
          },
        ]
      },
      { 
        path: 'schoolYear', 
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'SchoolYear' } },
        loadComponent: () => import('./domains/schoolYear/pages/pageSetup/pageSchoolYear.component'),
        children: [
          { path: '', redirectTo: 'year', pathMatch: 'full' },
          { 
            path: 'year', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'SchoolYear', detailed: 'Year' } },
            loadComponent: () => import('./domains/schoolYear/components/year/year.component') 
          }, 
          { 
            path: 'semester', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'SchoolYear', detailed: 'Semester' } },
            loadComponent: () => import('./domains/schoolYear/components/semester/semester.component') 
          }, 
          { 
            path: 'loadSubject', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'SchoolYear', detailed: 'LoadSubject' } },
            loadComponent: () => import('./domains/schoolYear/components/semester/semester.component') 
          },
          { 
            path: 'schedule', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'SchoolYear', detailed: 'Schedule' } },
            loadComponent: () => import('./domains/schoolYear/components/schedule/schedule.component')
          }, 
        ]
      },
      { 
        path: 'courses', 
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'Courses' } },
        loadComponent: () => import('./domains/courses/pages/pageSetup/pageCourses.component'),
        children: [
          { path: '', redirectTo: 'courses', pathMatch: 'full' },
          { 
            path: 'courses', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Courses', detailed: 'Courses' } },
            loadComponent: () => import('./domains/courses/components/courses/courses.component') 
          }, 
         /*{ 
            path: 'subjects', 
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'Courses', detailed: 'Subjects' } },
            loadComponent: () => import('./domains/courses/components/subjects/subjects.component') 
          }, */
        ]
      },
      // Agrega aquí el resto de tus rutas (alumnos, maestros, etc.)
      {
        path: 'unauthorized',
        loadComponent: () => import('./domains/layout/login/unauthorized.component')
      }
    ]
  }
];
