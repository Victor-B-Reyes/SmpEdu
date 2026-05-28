import { Component, OnInit, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KardexService, AcademicRecord } from '../../../service/kardex.service';
import { StudentsService } from '../../../service/student.service';
import { SignalsService } from '../../../service/signals.service';

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex.component.html',
  styleUrls: ['./kardex.component.scss']
})
export default class KardexComponent implements OnInit, OnChanges {
  @Input() studentId: number | null = null;
  kardexRecords: AcademicRecord[] = [];
  gpa: number = 0;
  creditsAccumulated: number = 0;
  subjectStats: any = {};
  selectedStudentId: number | null = null;
  students: any[] = [];
  loading: boolean = false;
  error: string = '';

  private kardexService = inject(KardexService);
  private studentsService = inject(StudentsService);
  private signalsService = inject(SignalsService);

  ngOnInit(): void {
    if (this.studentId) {
      this.loadKardex(this.studentId);
    } else {
      this.loadStudents();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId'] && this.studentId) {
      this.loadKardex(this.studentId);
    }
  }

  loadStudents(): void {
    this.loading = true;
    const branchId = this.signalsService.getBranchSelectedBySidebar();
    const courseId = this.signalsService.getCourseSelectedBySidebar();
    
    if (!branchId || !courseId) {
      this.error = 'Por favor selecciona una sucursal y curso en el menú';
      this.loading = false;
      return;
    }

    this.studentsService.getStudents(branchId, courseId).subscribe({
      next: (data) => {
        this.students = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar estudiantes';
        this.loading = false;
      }
    });
  }

  onStudentSelected(event: any): void {
    const studentId = parseInt(event.target.value, 10);
    if (isNaN(studentId)) {
      this.error = 'Selecciona un estudiante válido';
      return;
    }
    this.loadKardex(studentId);
  }

  loadKardex(studentId: number): void {
    this.loading = true;
    this.error = '';
    this.selectedStudentId = studentId; // Asegura que el HTML muestre los datos cargados

    // Cargar todas las estadísticas en paralelo
    Promise.all([
      this.kardexService.getStudentKardex(studentId).toPromise(),
      this.kardexService.getGPA(studentId).toPromise(),
      this.kardexService.getAccumulatedCredits(studentId).toPromise(),
      this.kardexService.getSubjectStats(studentId).toPromise()
    ])
    .then(([records, gpaData, creditsData, statsData]) => {
      this.kardexRecords = records || [];
      this.gpa = gpaData?.gpa || 0;
      this.creditsAccumulated = creditsData?.creditsAccumulated || 0;
      this.subjectStats = statsData || {};
      this.loading = false;
    })
    .catch((err) => {
      console.error('Error al cargar kárdex:', err);
      this.error = 'No se pudo cargar la información académica del estudiante';
      this.loading = false;
    });
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    if (status.includes('Aprobado')) return 'status-approved';
    if (status.includes('Reprobado')) return 'status-failed';
    if (status.includes('Pendiente')) return 'status-pending';
    return '';
  }

  exportToExcel(): void {
    if (this.kardexRecords.length === 0) {
      console.log('No hay datos para exportar');
      return;
    }
    console.log('Exportando kárdex a Excel...');
  }
}
