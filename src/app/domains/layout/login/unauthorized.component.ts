import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div class="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-gray-100">
        <div class="text-red-500 text-6xl mb-6">
          <i class="bi bi-shield-lock"></i>
        </div>
        <h1 class="text-3xl font-black text-gray-900 mb-3 tracking-tighter uppercase italic">Acceso Denegado</h1>
        <p class="text-gray-500 mb-8 font-medium">Lo sentimos, tu terminal no cuenta con los protocolos de acceso necesarios para esta sección.</p>
        <a routerLink="/welcome" class="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
          Volver al Inicio
        </a>
      </div>
    </div>
  `
})
export default class UnauthorizedComponent {}