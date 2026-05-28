import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScheduleService, ClassOffer, ClassScheduleBlock, StudentScheduleView } from '../../../../service/schedule.service';
import { SemesterService } from '../../../../service/semester.service';
import { SignalsService } from '../../../../service/signals.service';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss']
})
export default class ScheduleComponent implements OnInit {
  classOffers: ClassOffer[] = [];
  selectedClassOffers: StudentScheduleView[] = [];
  semesters: any[] = [];
  selectedSemesterId: number | null = null;
  selectedGrade: number | null = null;
  selectedGroup: string = '';
  groups: string[] = [];
  grades: number[] = [];
  loading: boolean = false;
  error: string = '';

  dayOfWeekNames: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  private scheduleService = inject(ScheduleService);
  private semesterService = inject(SemesterService);
  private signalsService = inject(SignalsService);

  ngOnInit(): void {
    this.loadSemesters();
  }

  loadSemesters(): void {
    this.loading = true;
    const idCompany = this.signalsService.getRootSelectedBySidebar();
    
    if (!idCompany) {
      this.error = 'Por favor selecciona una compañía en el menú';
      this.loading = false;
      return;
    }

    this.semesterService.getSemesters(idCompany).subscribe({
      next: (data) => {
        this.semesters = data.filter((s: any) => s.vigente === true);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar semestres';
        this.loading = false;
      }
    });
  }

  onSemesterSelected(event: any): void {
    const semesterId = parseInt(event.target.value, 10);
    if (isNaN(semesterId)) {
      this.error = 'Selecciona un semestre válido';
      return;
    }
    this.selectedSemesterId = semesterId;
    this.selectedGrade = null;
    this.selectedGroup = '';
    this.groups = [];
    this.grades = [];
    this.classOffers = [];
    this.selectedClassOffers = [];
    this.loadClassOffers(semesterId);
  }

  loadClassOffers(semesterId: number): void {
    this.loading = true;
    this.error = '';

    this.scheduleService.getClassOffersBySemester(semesterId).subscribe({
      next: (offers) => {
        this.classOffers = offers;
        // Extraer grados y grupos únicos
        this.grades = [...new Set(offers.map(o => o.grade))].sort();
        this.groups = [...new Set(offers.map(o => o.groupName))].sort();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar ofertas de clase';
        this.loading = false;
      }
    });
  }

  onGradeOrGroupSelected(): void {
    if (this.selectedSemesterId && this.selectedGrade && this.selectedGroup) {
      this.loadScheduleForGroup(this.selectedSemesterId, this.selectedGrade, this.selectedGroup);
    }
  }

  loadScheduleForGroup(semesterId: number, grade: number, groupName: string): void {
    this.loading = true;
    this.error = '';

    this.scheduleService.getClassOffersByGradeAndGroup(semesterId, grade, groupName).subscribe({
      next: async (offers) => {
        // Cargar horarios para cada oferta
        const offersWithSchedules: StudentScheduleView[] = [];

        for (const offer of offers) {
          this.scheduleService.getSchedulesByClassOffer(offer.id).subscribe({
            next: (schedules) => {
              const offerWithSchedule: StudentScheduleView = {
                ...offer,
                schedules: schedules
              };
              offersWithSchedules.push(offerWithSchedule);
            }
          });
        }

        setTimeout(() => {
          this.selectedClassOffers = offersWithSchedules;
          this.loading = false;
        }, 1000);
      },
      error: (err) => {
        this.error = 'Error al cargar horarios';
        this.loading = false;
      }
    });
  }

  getDayName(dayIndex: number): string {
    return this.dayOfWeekNames[dayIndex] || '';
  }

  formatTime(time: string): string {
    // Si viene en formato HH:mm:ss o similar
    return time.substring(0, 5);
  }

  exportScheduleToCalendar(): void {
    // Implementar exportación a calendario
    console.log('Exportar a calendario');
  }

  printSchedule(): void {
    window.print();
  }
}
