import { Component, inject, signal, computed, effect, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SignalsService } from '../../../../service/signals.service';
import { SubjectService } from '../../../../service/subject.service';
import { StudentsService } from '../../../../service/student.service';
import { KardexService, AcademicRecord } from '../../../../service/kardex.service';
import { TrackingService } from '../../../../service/tracking.service';
import { ScheduleService } from '../../../../service/schedule.service';
import { alerts } from '../../../../helpers/alerts';
import { forkJoin, of, Observable } from 'rxjs';

@Component({
  selector: 'app-load-subject',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="p-6 space-y-6">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-black text-gray-800">
            Carga por <span class="text-indigo-600">Grado y Grupo</span>
          </h2>
          @if (groupLabel()) {
            <div class="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-black border border-indigo-100 animate-in fade-in">
              GRUPO OBJETIVO: {{ groupLabel() }}
            </div>
          }
          <button 
            (click)="processAssignment()" 
            [disabled]="!selectedGrade() || !selectedGroup() || selectedStudents().size === 0 || !idSemester || isProcessing()"
            class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <i [class]="isProcessing() ? 'bi bi-arrow-repeat animate-spin' : 'bi bi-cloud-arrow-up-fill'"></i>
            {{ isProcessing() ? 'Procesando...' : 'Procesar Carga Académica' }}
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase text-gray-400">Grado (Periodo de Materias)</label>
            <select 
              [ngModel]="selectedGrade()" 
              (ngModelChange)="selectedGrade.set($event)"
              class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="">Selecciona un grado</option>
              @for (grade of grades; track grade) {
                <option [value]="grade">Grado {{ grade }}</option>
              }
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold uppercase text-gray-400">Grupo</label>
            <select 
              [ngModel]="selectedGroup()" 
              (ngModelChange)="selectedGroup.set($event)"
              class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="">Selecciona un grupo</option>
              @for (group of groups; track group) {
                <option [value]="group">Grupo {{ group }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Listado de Alumnos -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="space-y-4">
            <h3 class="font-bold text-gray-800 flex items-center gap-2">
              <i class="bi bi-people-fill text-indigo-500"></i>
              Filtrar Alumnos
            </h3>
            
            <div class="flex flex-col gap-3">
              <input 
                type="text" 
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event)"
                placeholder="Buscar por nombre o número de control..."
                class="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >

              <div class="grid grid-cols-2 gap-2">
                <select 
                  [ngModel]="filterGrade()" 
                  (ngModelChange)="filterGrade.set($event)"
                  class="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">Todos los grados</option>
                  @for (grade of grades; track grade) {
                    <option [value]="grade">Grado {{ grade }}</option>
                  }
                </select>

                <select 
                  [ngModel]="filterGroup()" 
                  (ngModelChange)="filterGroup.set($event)"
                  class="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">Todos los grupos</option>
                  @for (group of groups; track group) {
                    <option [value]="group">Grupo {{ group }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="flex justify-between items-end">
              <div class="flex flex-col gap-1">
                <span class="text-xs text-gray-400 font-bold uppercase">Resultados</span>
                <div class="flex gap-1">
                  <button (click)="selectAllFiltered()" class="text-[10px] text-indigo-600 font-bold hover:underline">Seleccionar todos</button>
                  <span class="text-[10px] text-gray-300">|</span>
                  <button (click)="deselectAll()" class="text-[10px] text-red-500 font-bold hover:underline">Limpiar</button>
                </div>
              </div>
              <div class="flex gap-2">
                <span class="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-lg">
                  {{ filteredStudents().length }} encontrados
                </span>
                <span class="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                  {{ selectedStudents().size }} seleccionados
                </span>
              </div>
            </div>
          </div>
          
          <div class="space-y-2 mt-4 max-h-[350px] overflow-y-auto pr-2">
            @for (student of filteredStudents(); track student.id) {
              <div 
                (click)="toggleStudentSelection(student.id)"
                [class.border-indigo-500]="selectedStudents().has(student.id)"
                [class.bg-indigo-50]="selectedStudents().has(student.id)"
                class="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm cursor-pointer hover:border-indigo-300 transition-all select-none"
              >
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <input type="checkbox" [checked]="selectedStudents().has(student.id)" class="rounded text-indigo-600">
                    <span class="font-medium text-gray-700">{{ student.firstName }} {{ student.lastNameFather }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    @if (isStudentEnrolled(student.id)) {
                      <span class="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <i class="bi bi-check-circle-fill"></i> CARGA LISTA
                      </span>
                    }
                    <span class="text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200 font-bold">{{ student.grade || 'S/G' }}{{ student.group || 'S/G' }}</span>
                  </div>
                </div>
                <p class="text-xs text-gray-400">{{ student.controlNumber || 'Sin control' }}</p>
              </div>
            } @empty {
              <div class="text-center py-12 text-gray-400 italic">
                Selecciona grado y grupo para visualizar alumnos
              </div>
            }
          </div>
        </div>

        <!-- Listado de Materias -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-gray-800 flex items-center gap-2">
              <i class="bi bi-book-half text-amber-500"></i>
              Materias (Periodo {{ selectedGrade() }})
            </h3>
          </div>
          
          <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            @for (subject of subjectsWithSchedules(); track subject.id) {
              <div [class]="subject.hasOffer ? 'p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-sm' : 'p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-sm'">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-gray-800">{{ subject.name }}</span>
                  <span class="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-amber-200">
                    {{ subject.cod }}
                  </span>
                </div>
                <div class="flex flex-col gap-0.5 mt-2">
                  <p class="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                    <i class="bi bi-person-badge"></i> {{ subject.teacher }}
                  </p>
                  <p class="text-[10px] text-gray-500 flex items-center gap-1">
                    <i class="bi bi-clock"></i> {{ subject.time }}
                  </p>
                </div>
              </div>
            } @empty {
              <div class="text-center py-12 text-gray-400 italic">
                {{ selectedGrade() ? 'No hay materias para este periodo' : 'Selecciona un grado' }}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export default class LoadSubject {
  private signalsService = inject(SignalsService);
  private studentsService = inject(StudentsService);
  private subjectService = inject(SubjectService);
  private kardexService = inject(KardexService);
  private trackingService = inject(TrackingService);
  private scheduleService = inject(ScheduleService);

  @Input() idSemester: number | null = null;

  idCampus = computed(() => this.signalsService.getBranchSelectedBySidebar() ?? 0);
  idCourse = computed(() => this.signalsService.getCourseSelectedBySidebar() ?? 0);

  selectedGrade = signal<string>('');
  selectedGroup = signal<string>('');
  searchTerm = signal<string>('');
  filterGrade = signal<string>('');
  filterGroup = signal<string>('');
  selectedStudents = signal<Set<number>>(new Set());
  isProcessing = signal<boolean>(false);

  groupLabel = computed(() => {
    const grade = this.selectedGrade();
    const group = this.selectedGroup();
    return grade && group ? `${grade}° ${group}` : '';
  });

  grades = ['1', '2', '3', '4', '5', '6', '7', '8'];
  groups = ['A', 'B', 'C', 'D'];

  allStudents = signal<any[]>([]);
  allSubjects = signal<any[]>([]);
  classOffers = signal<any[]>([]);
  semesterRecords = signal<any[]>([]);

  filteredStudents = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const fGrade = this.filterGrade();
    const fGroup = this.filterGroup();

    return this.allStudents().filter(s => {
      const matchesSearch = !term || `${s.firstName} ${s.lastNameFather} ${s.controlNumber}`.toLowerCase().includes(term);
      const matchesGrade = !fGrade || s.grade?.toString() === fGrade;
      const matchesGroup = !fGroup || s.group === fGroup;
      return matchesSearch && matchesGrade && matchesGroup;
    });
  });

  filteredSubjects = computed(() => {
    const grade = this.selectedGrade();
    return grade ? this.allSubjects().filter(s => s.periodo?.toString() === grade) : [];
  });

  subjectsWithSchedules = computed(() => {
    const subjects = this.filteredSubjects();
    const offers = this.classOffers();
    return subjects.map(s => {
      const offer = offers.find(o => o.subjectId === s.id);
      return {
        ...s,
        teacher: offer?.employeeName || 'Sin docente asignado',
        time: offer ? `${offer.startTime} - ${offer.endTime}` : 'Pendiente de horario',
        hasOffer: !!offer
      };
    });
  });

  isStudentEnrolled = (studentId: number) => {
    return this.semesterRecords().some(r => r.studentId === studentId);
  }

  constructor() {
    effect(() => {
      const courseId = this.idCourse();
      if (courseId > 0) {
        this.subjectService.getSubjects(courseId).subscribe({
          next: (res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.allSubjects.set(data);
          },
          error: (err) => console.error('Error al cargar materias (SubjectService.getSubjects):', err)
        });
      }
    });

    effect(() => {
      const campusId = this.idCampus(), courseId = this.idCourse();
      if (campusId > 0 && courseId > 0) {
        this.studentsService.getStudentsVigentes(campusId, courseId).subscribe({
          next: (res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.allStudents.set(data);
          },
          error: (err) => console.error('Error al cargar alumnos (StudentsService.getStudentsVigentes):', err)
        });
      }
    });

    effect(() => {
      const semesterId = this.idSemester;
      if (semesterId) {
        this.kardexService.getRecordsBySemester(semesterId).subscribe({
          next: (res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.semesterRecords.set(data);
          },
          error: (err) => {
            console.error(`Error al cargar registros del semestre ${semesterId} (KardexService.getRecordsBySemester):`, err);
            // El error 404 de la URL /api/academicrecord/kardex/ puede venir de aquí si el ID es incorrecto o la ruta cambió.
          }
        });
      }
    });

    effect(() => {
      const semesterId = this.idSemester;
      const grade = this.selectedGrade();
      const group = this.selectedGroup();
      const campusId = this.idCampus();
      
      if (semesterId && grade && group) {
        this.scheduleService.getClassOffersByGradeAndGroup(semesterId, grade, group).subscribe({
          next: (res: any) => {
            const data = Array.isArray(res) ? res : (res?.data || []);
            this.classOffers.set(data);
          },
          error: (err) => console.error('Error al cargar oferta educativa (ScheduleService.getClassOffersByGradeAndGroup):', err)
        });
      }
    });
  }

  toggleStudentSelection(id: number) {
    this.selectedStudents.update(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  selectAllFiltered() {
    const filtered = this.filteredStudents();
    this.selectedStudents.update(prev => {
      const next = new Set(prev);
      filtered.forEach(s => next.add(s.id));
      return next;
    });
  }

  deselectAll() {
    this.selectedStudents.set(new Set());
  }

  async processAssignment() {
    const grade = this.selectedGrade();
    const group = this.selectedGroup();
    const studentIds = Array.from(this.selectedStudents());
    const semesterId = this.idSemester;
    const courseId = this.idCourse();
    const campusId = this.idCampus();

    if (!grade || !group || studentIds.length === 0 || !semesterId || courseId === 0 || campusId === 0) {
      alerts.basicAlert('Advertencia', 'Por favor, selecciona un grado, un grupo, al menos un alumno y asegúrate de que el semestre y la carrera estén definidos.', 'warning');
      return;
    }

    const subjectsToAssign = this.filteredSubjects();
    if (subjectsToAssign.length === 0) {
      alerts.basicAlert('Sin Materias', `No hay materias configuradas para el periodo ${grade}. Verifica el plan de estudios.`, 'error');
      return;
    }

    const confirm = await alerts.confirmAlert(
      'Confirmar Carga',
      `Se generará el Kardex de ${studentIds.length} alumnos con ${subjectsToAssign.length} materias cada uno para el grupo ${grade}°${group}. Esto vinculará automáticamente a los alumnos con los horarios configurados para este grupo. ¿Desea continuar?`,
      'question',
      'Sí, procesar'
    );

    if (confirm.isConfirmed) {
      this.isProcessing.set(true);
      
      // PASO 1: Actualizar la ficha del alumno (Grado/Grupo actual)
      const studentUpdateObservables = studentIds.map(id => {
        const student = this.allStudents().find(s => s.id === id);
        if (!student) return of(null);
        
        // Actualizamos grado, grupo y mantenemos los contextos de campus y carrera
        const payload = { 
          ...student, 
          grade, 
          group, 
          idCampus: campusId,
          idCourses: courseId 
        };

        console.log(`Payload actualización alumno ${id}:`, payload);
        return this.studentsService.updateStudents(id, payload);
      });

      forkJoin(studentUpdateObservables).subscribe({
        next: (updatedStudents) => {
          const successfullyUpdatedStudentIds = updatedStudents.filter(s => s !== null).map((s: any) => s.id);
          
          if (successfullyUpdatedStudentIds.length === 0) {
            alerts.basicAlert('Error', 'No se pudo actualizar ningún alumno.', 'error');
            this.isProcessing.set(false);
            return;
          }

          // PASO 2: Generar Carga en Kardex (AcademicRecord)
          // Esta es la lógica que "manejas" para el Kardex. 
          // Cada registro aquí vincula al alumno con una materia en este semestre específico.
          const academicRecordCreationObservables: Observable<AcademicRecord>[] = [];
          successfullyUpdatedStudentIds.forEach(studentId => {
            subjectsToAssign.forEach(subject => {
              const newAcademicRecord: Omit<AcademicRecord, 'id' | 'createdAt' | 'updatedAt'> = {
                studentId,
                semesterId,
                subjectId: subject.id,
                courseId,
                grade,
                groupName: group,
                status: 'En Curso',
                opportunity: 1,
                creditsEarned: 0,
                active: true,
              };
              
              console.log('Enviando registro académico (AcademicRecord):', newAcademicRecord);
              academicRecordCreationObservables.push(this.kardexService.createAcademicRecord(newAcademicRecord));
            });
          });

          forkJoin(academicRecordCreationObservables).subscribe({
            next: () => {
              this.trackingService.addLog(
                this.trackingService.getnameComp(),
                `Carga masiva: Grupo ${grade}${group} - ${studentIds.length} alumnos`,
                'Carga Académica',
                this.trackingService.getEmail()
              );
              alerts.basicAlert('Éxito', 'Kardex generado. Si ya configuraste la Oferta Educativa, los alumnos verán sus horarios de inmediato.', 'success');
              this.finalizeAssignment();
            },
            error: (err) => {
              console.error('Error al crear registros académicos:', err);
              alerts.basicAlert('Error', 'Se actualizaron los datos del alumno, pero hubo un error al asignar las materias.', 'error');
              this.isProcessing.set(false);
            }
          });
        },
        error: (err) => {
          console.error('Error al actualizar datos de alumnos:', err);
          alerts.basicAlert('Error', 'No se pudieron actualizar los datos de los alumnos.', 'error');
          this.isProcessing.set(false);
        }
      });
    }
  }

  private finalizeAssignment() {
    this.isProcessing.set(false);
    this.selectedStudents.set(new Set());
    this.searchTerm.set('');
    this.filterGrade.set('');
    this.filterGroup.set('');
    this.studentsService.getStudentsVigentes(this.idCampus(), this.idCourse()).subscribe((res: any) => {
      this.allStudents.set(Array.isArray(res) ? res : (res?.data || []));
    });
  }
}
