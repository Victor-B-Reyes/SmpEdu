import { inject, effect, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../service/auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { SignalsService } from '../service/signals.service';

@Injectable({
  providedIn: 'root',
})
export class MasterPermissionsGuard implements CanActivate {
  private permissionService = inject(AuthService);
  private router = inject(Router);
  private signalsService = inject(SignalsService);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredPermissions = route.data['permissions'];
    const email = localStorage.getItem('mail');
    if (!email) {
      this.router.navigate(['/login']);
      return of(false);
    }
    

    // Leemos los valores de los signals aquí, dentro de canActivate
    const isAdvanced = this.signalsService.getIsAdvanced();
    const idBranch = this.signalsService.getBranchSelectedBySidebar();


    // Si es avanzado pero aún no se selecciona una sucursal, no podemos verificar permisos avanzados.
    if (isAdvanced && !idBranch) {
      // Podrías redirigir o simplemente denegar el acceso hasta que se seleccione una sucursal.
      // Por ahora, lo trataremos como si no tuviera permisos.
      this.router.navigate(['/unauthorized']);
      return of(false);
    }

    return this.permissionService.getUserId(email).pipe(
      switchMap((userId) => this.permissionService.fetchUserPermissions(userId)),
      tap(res => console.log('')),
      map((finalPermissions) => {
        this.permissionService.setUserPermissions(finalPermissions);
        
        // Si la ruta no requiere permisos específicos (ej. Dashboard), permitir acceso
        if (!requiredPermissions) return true;

        const hasMasterPermission = this.permissionService.hasMasterPermission(
          requiredPermissions.master
        );
        const hasDetailedPermission = requiredPermissions.detailed
          ? this.permissionService.hasDetailedPermission(
            requiredPermissions.master,
            requiredPermissions.detailed
          )
          : true;

        if (hasMasterPermission && hasDetailedPermission) {
          return true;
        } else {
          this.router.navigate(['/unauthorized']);
          return false;
        }
      }),
      catchError((error) => {
        console.error('Error fatal en el Guard de permisos:', error);
        this.router.navigate(['/unauthorized']);
        return of(false);
      })
    );
  }
}
