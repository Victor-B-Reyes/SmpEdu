import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="welcome-container">
      <h1 class="welcome-title">¡Bienvenido a SmpEdu!</h1>
      <p class="welcome-message">
        Estamos encantados de tenerte aquí. Explora las opciones del menú lateral para empezar.
      </p>
      <div class="welcome-icon">
        <i class="bi bi-house-door-fill"></i>
      </div>
    </div>
  `,
  styles: `
    .welcome-container {
      text-align: center;
      padding: 50px;
      background-color: #f8f9fa;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      margin: 50px auto;
      max-width: 800px;
    }
    .welcome-title {
      color: #343a40;
      font-size: 2.5em;
      margin-bottom: 20px;
    }
    .welcome-message {
      color: #6c757d;
      font-size: 1.2em;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .welcome-icon {
      font-size: 3em;
      color: #007bff;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class WelcomeComponent {
  // Puedes añadir lógica aquí si es necesario
}