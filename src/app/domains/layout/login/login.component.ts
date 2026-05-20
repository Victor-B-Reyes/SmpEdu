import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, switchMap, tap, finalize } from 'rxjs';
import { AuthService } from '../../../service/auth.service';
import { TrackingService } from '../../../service/tracking.service';
import { SignalsService } from '../../../service/signals.service';
import Swal from 'sweetalert2';

type Tab = 'email' | 'google';
type EmailMode = 'login' | 'register' | 'reset';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], // Import FormsModule
  template: `
    <div class="min-h-screen flex bg-[#05050a] overflow-hidden relative font-sans">
      <!-- Background Tech Grid -->
      <div class="absolute inset-0 opacity-20 pointer-events-none" 
           style="background-image: linear-gradient(#1e1b4b 1px, transparent 1px), linear-gradient(90deg, #1e1b4b 1px, transparent 1px); background-size: 40px 40px;"></div>
      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#05050a]/80 to-[#05050a] pointer-events-none"></div>

      <!-- ── Left panel ── -->
      <div class="hidden lg:flex flex-1 relative overflow-hidden border-r border-white/5"> <!-- Left panel -->
        <img src="/fondo.png" alt="SmpEdu Core" class="absolute inset-0 w-full h-full object-cover object-center opacity-60" />
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#05050a]"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-[#05050a]/80 via-transparent to-transparent"></div>
        

        <div class="absolute bottom-8 left-8">
          <div class="px-6 py-3 bg-indigo-600/10 backdrop-blur-xl border border-indigo-500/30 rounded-2xl text-indigo-200 text-xs font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:scale-105 transition-transform cursor-default">
            <span class="mr-2">✨</span> Protocolo de Educación Inteligente v1.0
          </div>
        </div>
      </div>

      <!-- ── Right panel ── -->
      <div class="flex flex-1 lg:max-w-[520px] items-center justify-center p-8 relative">
        <div class="absolute top-1/4 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div class="absolute bottom-1/4 left-0 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div class="w-full max-w-sm relative z-10">
          <!-- Logo -->
          <div class="text-center mb-10 group">
            <div class="w-50 h-20  rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.4)] italic rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <img src="/bi2.png" alt="EduControl bi">
            </div>
            <h1 class="text-4xl font-black text-white tracking-tighter italic uppercase">
              EduControl<span class="text-indigo-500 not-italic ml-1">bi</span>
            </h1>
            <div class="h-0.5 w-12 bg-indigo-600 mx-auto mt-2 group-hover:w-24 transition-all duration-500"></div>
          </div>

          <!-- Auth Card -->
          <div class="relative bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
            <!-- Corner Accents -->
            <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-500/40 rounded-tl-[2rem]"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-500/40 rounded-br-[2rem]"></div>


            <!-- Google Auth -->
            <div *ngIf="tab() === 'google'" class="animate-in fade-in slide-in-from-left-4 duration-500">
              <p class="text-gray-500 text-[11px] font-bold text-center mb-8 uppercase tracking-[0.2em]">
                Identificación Biométrica
              </p>
              <button type="button" 
                      (click)="handleGoogleLogin()"
                      [disabled]="isLoading()"
                      class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-gray-900 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-50 active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                <span *ngIf="isLoading()" class="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin"></span>
                <img *ngIf="!isLoading()" src="https://www.google.com/favicon.ico" class="w-4 h-4" alt="G" />
                {{ isLoading() ? 'Verificando...' : 'Verificar Identidad' }}
              </button>
            </div>

            <!-- Email Auth -->
            <div *ngIf="tab() === 'email'" class="animate-in fade-in slide-in-from-right-4 duration-500">
              <p class="text-indigo-400 text-[10px] font-black text-center mb-6 uppercase tracking-[0.3em]">
                {{ mode() === 'login' ? 'Acceso de Usuario' : (mode() === 'register' ? 'Registro de Terminal' : 'Recuperación') }}
              </p>

              <!-- Error Message -->
              <div *ngIf="errorMessage()" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold text-center">
                {{ errorMessage() }}
              </div>

              <form (submit)="handleSubmit($event)" class="space-y-4">
                <div class="relative group">
                  <input type="email" 
                         [ngModel]="email()" 
                         (ngModelChange)="email.set($event)"
                         name="email"
                         placeholder="CORREO INSTITUCIONAL" 
                         class="w-full pl-6 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/20 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white/[0.06] transition-all tracking-wider uppercase group-hover:border-white/20">
                </div>

                <div *ngIf="mode() !== 'reset'" class="relative group">
                  <input [type]="showPwd() ? 'text' : 'password'" 
                         [ngModel]="password()" 
                         (ngModelChange)="password.set($event)"
                         name="password"
                         placeholder="ACCESS_KEY" 
                         class="w-full pl-6 pr-12 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/20 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white/[0.06] transition-all tracking-wider uppercase group-hover:border-white/20">
                  <button type="button" (click)="togglePwd()" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-indigo-400">
                    {{ showPwd() ? '👁️' : '🔒' }}
                  </button>
                </div>

                <button type="submit" 
                        [disabled]="isLoading()"
                        class="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 mt-4 shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:cursor-not-allowed">
                  <span *ngIf="isLoading()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span *ngIf="!isLoading()">{{ mode() === 'login' ? 'AUTENTICAR' : 'INICIALIZAR' }}</span>
                </button>

                <!-- Mode Links -->
                <div class="flex flex-col items-center gap-3 pt-6 border-t border-white/5">
                  <button *ngIf="mode() === 'login'" type="button" (click)="setMode('register')" class="text-indigo-400 text-[10px] font-bold uppercase tracking-wider hover:text-indigo-300 transition-colors">
                    ¿Primera vez? Crear cuenta
                  </button>
                  <button *ngIf="mode() === 'login'" type="button" (click)="setMode('reset')" class="text-white/20 text-[10px] font-bold uppercase tracking-wider hover:text-white/40 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </button>
                  <button *ngIf="mode() !== 'login'" type="button" (click)="setMode('login')" class="text-gray-500 text-[10px] font-bold uppercase tracking-wider hover:text-gray-300 transition-colors">
                    ← Volver al inicio
                  </button>
                </div>
              </form>
            </div>
          </div>

          <p class="text-center text-white/10 text-[9px] font-black uppercase tracking-[0.4em] mt-10">
            Neural Core OS // SmpEdu 2025
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .text-shadow-neon { text-shadow: 0 0 8px rgba(129, 140, 248, 0.6); }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slide-in-from-left { from { transform: translateX(-1rem); } to { transform: translateX(0); } }
    @keyframes slide-in-from-right { from { transform: translateX(1rem); } to { transform: translateX(0); } }
    .animate-in { animation: fade-in 0.5s ease-out; }
    .slide-in-from-left-4 { animation: fade-in 0.5s ease-out, slide-in-from-left 0.5s ease-out; }
    .slide-in-from-right-4 { animation: fade-in 0.5s ease-out, slide-in-from-right 0.5s ease-out; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LoginPageComponent implements OnInit, OnDestroy {
  // Services
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly trackingService = inject(TrackingService);
  private readonly signalsService = inject(SignalsService);

  // Signals
  public readonly tab: WritableSignal<Tab> = signal('email');
  public readonly mode: WritableSignal<EmailMode> = signal('login');
  public readonly isLoading = signal(false);
  public readonly showPwd = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  // Form fields
  public email = signal('');
  public password = signal('');

  // Lifecycle
  private readonly destroy$ = new Subject<void>();

  protected readonly hasPermission = signal(true);

  ngOnInit(): void {
    this.checkPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public setTab(newTab: Tab): void {
    this.tab.set(newTab);
    this.mode.set('login');
    this.errorMessage.set(null);
  }

  public setMode(newMode: EmailMode): void {
    this.mode.set(newMode);
    this.errorMessage.set(null);
  }

  public togglePwd(): void {
    this.showPwd.update(v => !v);
  }

  public handleSubmit(event: Event): void {
    event.preventDefault();
    this.login();
  }

  /**
   * Valida que el email y contraseña no estén vacíos
   */
  private validateForm(): boolean {
    const email = this.email().trim();
    const password = this.password().trim();

    if (!email) {
      this.errorMessage.set('El correo es requerido');
      return false;
    }

    if (!email.includes('@')) {
      this.errorMessage.set('Ingresa un correo válido');
      return false;
    }

    if (!password && this.mode() !== 'reset') {
      this.errorMessage.set('La contraseña es requerida');
      return false;
    }

    if (password.length < 6 && this.mode() !== 'reset') {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    return true;
  }

  /**
   * Maneja el login por email
   */
  public login(): void {
    this.errorMessage.set(null);

    if (!this.validateForm()) {
      return;
    }

    const emailValue = this.email().trim();
    const passwordValue = this.password().trim();
    const mode = this.mode();

    this.isLoading.set(true);

    // Registrar intento de login
    this.trackingService.setEmail(emailValue);
    this.trackingService.addLog(
      '',
      'Inicio del Sistema',
      `Origen del Formulario ${mode === 'login' ? 'Login' : mode === 'register' ? 'Registro' : 'Reset'}`,
      emailValue
    );

    // Crear datos de autenticación
    const loginData = {
      email: emailValue,
      password: passwordValue
    };

    // Flujo de login con RxJS
    this.auth.login(loginData as any)
      .pipe(
        tap((resp: any) => {
          // Guardar token
          if (resp.data?.token) {
            localStorage.setItem('token', resp.data.token);
            this.auth.startSessionTimers();
          }
        }),
        switchMap((resp: any) => this.trackingService.getIdUser(emailValue)),
        tap((response: any) => {
          const datauser = response.data;
          //console.log('Datos del usuario:', datauser);
          if (!datauser) {
            throw new Error('Usuario no encontrado');
          }

          // Configurar datos del usuario en servicios
          this.trackingService.setnameUser(datauser.displayName || datauser.name || '');
          this.trackingService.setpictureUser(datauser.picture || '');
          this.trackingService.setabranch(datauser.applybranch);
          this.trackingService.setaplatform(datauser.applyplatform);
          this.trackingService.setaproject(datauser.applyproject);
          this.trackingService.setId(datauser.id);

          this.signalsService.setidUser(datauser.id);
          this.signalsService.setemailChoose(emailValue);
          this.signalsService.setrootChoose(datauser.isRoot || datauser.userRoot || 0);

          // Guardar en localStorage
          localStorage.setItem('userRoot', (datauser.isRoot || datauser.userRoot || 0).toString());
          localStorage.setItem('mail', emailValue);
          localStorage.setItem('nameUser', datauser.displayName || datauser.name || '');
          localStorage.setItem('idUser', datauser.id.toString());
          localStorage.setItem('pictureUser', datauser.picture || '');
          localStorage.setItem('isAdvanced', (!!datauser.advanced).toString());

          this.signalsService.setIsAdvanced(!!datauser.advanced);

          if (datauser.applybranch != null) {
            this.signalsService.setBranchSelectedBySidebar(datauser.applybranch);
            localStorage.setItem('selectedBranch', datauser.applybranch.toString());
          }
        }),
        switchMap((response: any) => {
          const datauser = response.data;
          // Determinar si es usuario avanzado
          const userId = datauser.id;
          const isAdvancedLocal = !!datauser.advanced;
          const branchIdLocal = datauser.applybranch;

          if (isAdvancedLocal && branchIdLocal != null && branchIdLocal !== 0) {
            return this.auth.fetchUserPermissionsAdvanced(userId, branchIdLocal);
          } else {
            return this.auth.fetchUserPermissions(userId);
          }
        }),
        tap((permissionsData: any) => {
          this.auth.setUserPermissions(permissionsData);
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.navigateToHomeAfterLogin();
          // Limpiar formulario
          this.email.set('');
          this.password.set('');
        },
        error: (err: any) => {
          console.error('Error en login:', err);
          const errorMsg = err.error?.message || err.error?.error?.message || 'Credenciales inválidas. Intenta nuevamente.';
          this.errorMessage.set(errorMsg);
        }
      });
  }

  /**
   * Maneja el login con Google (pendiente implementar)
   */
  public handleGoogleLogin(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // TODO: Implementar integración con Google Auth
    Swal.fire({
      icon: 'info',
      title: 'Próximamente',
      text: 'La autenticación con Google estará disponible en una próxima actualización'
    });
    
    this.isLoading.set(false);
  }


  private checkPermissions(): void {
    // Por ahora, permitir acceso por defecto
    // TODO: Implementar validación de permisos si es necesario
    this.hasPermission.set(true);
  }

  /** Navega al dashboard si tiene permiso, si no a la sección de publicidad */
  private navigateToHomeAfterLogin(): void {
    const target = '/welcome';
    this.router.navigate([target]).catch((err) => {
      console.error('Error navegando a:', target, err);
    });
  }
}