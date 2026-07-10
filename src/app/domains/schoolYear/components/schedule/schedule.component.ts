import { Component, OnInit, inject, effect, signal, computed, ChangeDetectorRef, Input, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, lastValueFrom } from 'rxjs';
import { ScheduleService, ClassOffer, StudentScheduleView, GroupScheduleConfig } from '../../../../service/schedule.service';
import { SemesterService } from '../../../../service/semester.service';
import { SignalsService } from '../../../../service/signals.service';
import { SubjectService } from '../../../../service/subject.service';
import { CoursesService } from '../../../../service/courses.service';
import { EmployeesService } from '../../../../service/employees.service';
import { alerts } from '../../../../helpers/alerts';
import { KardexService } from '../../../../service/kardex.service';
import { StudentsService } from '../../../../service/student.service';
import { SchedulePdfUtil } from './schedule-pdf.util';
import { StudentsPdfUtil } from '../../../Students/components/students-pdf.util';
import LoadSubjectComponent from '../semester/load-subject.component';

interface GroupSummary {
  grade: number;
  groupName: string;
  label: string;
  offersCount: number;
  semesterId: number;
  semesterComment?: string;
  studentCount?: number;
}

interface WeeklyScheduleBlock {
  id: number;
  subjectName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroom?: string | null;
  classOfferId?: number | null;
  teacherId?: number | null;
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadSubjectComponent],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss']
})
export default class ScheduleComponent implements OnInit {
  @Input() idSemester: number = 0;
  
  classOffers: ClassOffer[] = [];
  selectedClassOffers: StudentScheduleView[] = [];
  semesters: any[] = [];
  selectedSemesterId: number | null = null;
  selectedGrade: number | null = null;
  selectedGroup = '';
  groups: string[] = [];
  grades: number[] = [];
  groupSummaries: GroupSummary[] = [];
  private cdr = inject(ChangeDetectorRef);
  loading = false;
  error = '';
  
  // Estado para la creación
  showLoadStudentsModal = signal(false);
  showCreateForm = false;
  courses: any[] = [];
  subjects: any[] = [];
  teachers: any[] = [];
  allSubjects: any[] = [];
  newGroupSubjects: Array<{
    id: number;
    name: string;
    cod?: string;
    teacherId: number | null;
    classroom: string;
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
  }> = [];
  
  newOffer: Partial<ClassOffer> = {
    grade: 1,
    groupName: 'A',
    capacity: 30,
    active: true
  };

  dayOfWeekNames: string[] = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  selectedDays = signal<number[]>([]);
  scheduleStartTime = '';
  scheduleEndTime = '';
  scheduleStartTime2 = '';
  scheduleEndTime2 = '';
  scheduleIntervalMinutes: number | null = null;
  customIntervalMinutes: number | null = null;
  scheduleSlots: string[] = [];
  // Nueva estructura: slots con minutos y label
  scheduleSlotObjects: Array<{ startM: number; endM: number; label: string; endLabel?: string }> = [];
  // slotMap[dayIndex][slotIndex] = OfferSummary[]
  slotMap: Array<Array<Array<any>>> = [];
  // Estado para asignar desde la tabla
  assignmentTarget: { dayIndexVisible: number; slotIndex: number } | null = null;
  assignmentModel: {
    id?: number;
    classOfferId?: number | null;
    teacherId?: number | null;
    classroom?: string | null;
    startTime?: string;
    endTime?: string;
  } = {};
  assigning = false;
  // Modal para generar bloques
  showGenerateModal = false;
  modalSelectedOfferId: number | null = null;
  modalSelectedTeacherId: number | null = null;
  modalClassroom = '';
  modalSelectedDays: number[] = [];
  modalStartTime = '';
  modalEndTime = '';
  modalSelectedSlots: number[] = [];
  scheduleGenerated = false;
  newBlockName = '';
  newBlockOfferId: number | null = null;
  newBlockTeacherId: number | null = null;
  newBlockClassroom = '';
  weeklyScheduleBlocks = signal<WeeklyScheduleBlock[]>([]);
  intervalOptions = [30, 50, 60, 90, 120];

  // Estado del Visualizador de PDF
  showPdfPreview = signal(false);
  pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  private currentPdfDoc: any = null;
  private currentBlobUrl: string | null = null;
  pdfFileName = '';
  private zone = inject(NgZone);

  private sanitizer = inject(DomSanitizer);
  private studentService = inject(StudentsService);
  private scheduleService = inject(ScheduleService);
  private subjectService = inject(SubjectService);
  private coursesService = inject(CoursesService);
  private employeesService = inject(EmployeesService);
  private semesterService = inject(SemesterService);
  private signalsService = inject(SignalsService);
  private kardexService = inject(KardexService);
  private activatedRoute = inject(ActivatedRoute);
  private selectedCourseId = computed(() => this.signalsService.getCourseSelectedBySidebar() ?? 0);

  visibleScheduleDays = computed(() => {
    return this.dayOfWeekNames
      .map((name, index) => ({ name, index }))
      .filter((day) => this.selectedDays().includes(day.index));
  });

  constructor() {
    // Reacciona automáticamente a cambios de compañía en el Sidebar
    effect(() => {
      try {
        const idCompany = this.signalsService.getRootSelectedBySidebar();
        if (idCompany) {
          this.loadSemesters(idCompany);
          this.loadInitialCatalogs();
        } else {
          this.semesters = [];
          this.classOffers = [];
          this.groupSummaries = [];
          this.loading = false;
          this.cdr.markForCheck();
        }
      } catch (err) {
        console.error('Error en effect (company change):', err);
      }
    });

    effect(() => {
      try {
        const courseId = this.selectedCourseId();
        if (courseId > 0) {
          this.subjectService.getSubjects(courseId).subscribe({
            next: (res: any) => {
              this.allSubjects = Array.isArray(res) ? res : (res?.data || []);
              // También extraemos los grados disponibles de las materias para que el filtro sea completo
              const subjectGrades = [...new Set(this.allSubjects.map((s: any) => Number(s.periodo)))].filter(g => !isNaN(g));
              this.grades = [...new Set([...this.grades, ...subjectGrades])].sort((a, b) => a - b);
              this.cdr.markForCheck();
            },
            error: (err) => console.error('Error al cargar materias para el grupo:', err)
          });
        }
      } catch (err) {
        console.error('Error en effect (course change):', err);
      }
    });
  }

  // Comprueba si ya existe un schedule para la oferta, día e intervalo
  private scheduleExists(classOfferId: number, dayOfWeek: number, startTime: string, endTime: string): boolean {
    const offer = this.selectedClassOffers.find(o => Number((o as any).id) === classOfferId);
    if (!offer || !Array.isArray(offer.schedules)) return false;
    return offer.schedules.some((s: any) => Number(s.dayOfWeek) === Number(dayOfWeek) && (s.startTime === startTime && s.endTime === endTime));
  }

  // Comprueba duplicados en bloques locales
  private blockExists(dayOfWeek: number, startTime: string, endTime: string): boolean {
    return this.weeklyScheduleBlocks().some(b => Number(b.dayOfWeek) === Number(dayOfWeek) && b.startTime === startTime && b.endTime === endTime);
  }

  ngOnInit(): void {
    this.updateScheduleSlots();

    // Si viene el idSemester como input (desde el componente padre), usarlo directamente
    if (this.idSemester !== undefined && this.idSemester !== null) {
      this.selectedSemesterId = this.idSemester;
      this.loadClassOffers(this.selectedSemesterId);
      return;
    }

    // Si viene de la URL (navegación), leer de queryParams
    this.activatedRoute.queryParams.subscribe(params => {
      const semesterId = params['semesterId'];
      if (semesterId) {
        this.selectedSemesterId = Number(semesterId);
        this.loadClassOffers(this.selectedSemesterId);
      }
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
  }

  loadInitialCatalogs(): void {
    const branchId = this.signalsService.getBranchSelectedBySidebar();
    if (branchId) {
      this.coursesService.getCoursesVigentes(branchId).subscribe((res: any) => {
        this.courses = Array.isArray(res) ? res : (res?.data || []);
      });

      this.employeesService.getEmployeesVigente(branchId).subscribe((res: any) => {
        console.log("Desde aqui - Empleados vigentes recibidos del servidor:", res);
        this.teachers = Array.isArray(res) ? res : (res?.data || []);
      });
    }
  }

  prepareGroupSubjects(): void {
    if (!this.selectedSemesterId || !this.selectedGrade || !this.selectedGroup) {
      alerts.basicAlert('Error', 'Selecciona primer el semestre, grado y grupo antes de generar el grupo.', 'error');
      return;
    }

    if (this.newGroupSubjects.length > 0) {
      return;
    }

    const courseId = Number(this.newOffer.courseId) || this.selectedCourseId();
    if (!courseId) {
      alerts.basicAlert('Error', 'Selecciona la carrera/curso antes de cargar las materias.', 'error');
      return;
    }

    this.subjectService.getSubjects(courseId).subscribe({
      next: (res: any) => {
        const subjects = Array.isArray(res) ? res : (res?.data || []);
        const gradeNum = this.selectedGrade?.toString();
        const filteredSubjects = subjects.filter((subject: any) => subject.periodo?.toString() === gradeNum || subject.grade?.toString() === gradeNum);

        if (filteredSubjects.length === 0) {
          alerts.basicAlert('Sin materias', `No se encontraron materias para el período ${gradeNum}.`, 'warning');
          return;
        }

        this.newGroupSubjects = filteredSubjects.map((subject: any) => ({
          id: subject.id,
          name: subject.name || subject.descripcion || 'Materia desconocida',
          cod: subject.cod || subject.codigo || subject.code,
          teacherId: null,
          classroom: '',
          dayOfWeek: null,
          startTime: '08:00',
          endTime: '09:00'
        }));
      },
      error: (err) => {
        console.error('Error cargando materias para el curso:', err);
        alerts.basicAlert('Error', 'No se pudieron cargar las materias del curso.', 'error');
      }
    });
  }

  async saveGroupSubjects() {
    if (!this.selectedSemesterId || !this.selectedGrade || !this.selectedGroup) {
      alerts.basicAlert('Error', 'Selecciona primer el semestre, grado y grupo.', 'error');
      return;
    }

    if (this.newGroupSubjects.length === 0) {
      alerts.basicAlert('Error', 'No hay materias cargadas para guardar.', 'error');
      return;
    }

    const courseId = Number(this.newOffer.courseId) || this.selectedCourseId();
    if (!courseId) {
      alerts.basicAlert('Error', 'No se encontró curso asociado. Selecciona una carrera.', 'error');
      return;
    }

    const payloads: ClassOffer[] = this.newGroupSubjects.map(subject => ({
      semesterId: this.selectedSemesterId,
      courseId,
      subjectId: subject.id,
      grade: this.selectedGrade,
      groupName: this.selectedGroup,
      teacherId: subject.teacherId ?? undefined,
      classroom: subject.classroom,
      capacity: Number(this.newOffer.capacity) || 30,
      active: true,
      createdAt: new Date().toISOString()
    } as ClassOffer));

    try {
      const createRequests = payloads.map((payload: ClassOffer) => this.scheduleService.createClassOffer(payload));
      const createdOffers: ClassOffer[] = await lastValueFrom(forkJoin(createRequests));

      const scheduleRequests = createdOffers.flatMap((offer: ClassOffer, index: number) => {
        const config = this.newGroupSubjects[index];
        if (config.dayOfWeek === null || !config.startTime || !config.endTime) {
          return [];
        }
        return [this.scheduleService.createSchedule({
          id: 0,
          classOfferId: offer.id,
          dayOfWeek: config.dayOfWeek,
          startTime: config.startTime,
          endTime: config.endTime,
          teacherId: config.teacherId ? Number(config.teacherId) : null,
          classroom: config.classroom || null,
          active: true,
          createdAt: new Date().toISOString()
        } as any)];
      });

      if (scheduleRequests.length > 0) {
        await lastValueFrom(forkJoin(scheduleRequests));
      }

      alerts.basicAlert('Éxito', 'Las materias y bloques se han creado correctamente.', 'success');
      this.newGroupSubjects = [];
      this.loadClassOffers(this.selectedSemesterId);
    } catch (error) {
      console.error('Error al guardar materias de grupo:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al crear las materias del grupo.', 'error');
    }
  }

  async saveClassOffer() {
    if (!this.newOffer.courseId || !this.newOffer.grade || !this.newOffer.groupName || !this.newOffer.capacity || !this.selectedSemesterId) {
      alerts.basicAlert('Error', 'Faltan campos obligatorios para crear la oferta.', 'error');
      return;
    }

    const courseId = Number(this.newOffer.courseId);
    const subjectResponse: any = await lastValueFrom(this.subjectService.getSubjects(courseId));
    const subjects = Array.isArray(subjectResponse) ? subjectResponse : (subjectResponse?.data || []);

    const gradeNum = Number(this.newOffer.grade).toString();
    const filteredSubjects = subjects.filter((s: any) => s.periodo?.toString() === gradeNum || s.grade?.toString() === gradeNum);

    if (filteredSubjects.length === 0) {
      alerts.basicAlert('Error', `No se encontraron materias automáticas para grado ${gradeNum}.`, 'error');
      return;
    }

    const capacity = Number(this.newOffer.capacity);
    const payloads: ClassOffer[] = filteredSubjects.map((subject: any) => ({
      semesterId: this.selectedSemesterId,
      courseId,
      subjectId: subject.id,
      grade: Number(this.newOffer.grade),
      groupName: this.newOffer.groupName,
      classroom: '',
      capacity,
      active: true,
      createdAt: new Date().toISOString()
    } as ClassOffer));

    try {
      const createRequests = payloads.map((payload: ClassOffer) => this.scheduleService.createClassOffer(payload));
      await lastValueFrom(forkJoin(createRequests));

      alerts.basicAlert('Éxito', 'Las materias se han cargado automáticamente para el grupo.', 'success');
      this.showCreateForm = false;
      this.loadClassOffers(this.selectedSemesterId);
    } catch (error) {
      console.error('Error al crear materias automáticas:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al crear las materias automáticas.', 'error');
    }
  }

  loadSemesters(idCompany?: number): void {
    const companyId = idCompany ?? this.signalsService.getRootSelectedBySidebar();
    
    if (!companyId) {
      this.error = 'Por favor selecciona una compañia en el menu';
      this.loading = false;
      return;
    }

    this.loading = true; // Inicia la carga
    this.error = '';
    
    this.semesterService.getSemesters(companyId).subscribe({
      next: (response: any) => {
        try {
          const rawData = response?.data || response;
          // Convierte a array si viene como objeto indexado {0: {...}, 1: {...}}
          const sourceArray = Array.isArray(rawData) ? rawData : (rawData ? Object.values(rawData) : []);
          
          this.semesters = sourceArray.filter((s: any) => s.vigente === true || s.active === true); // Filtra por vigente o active
          console.log("Desde aqui - Semestres filtrados:", this.semesters);
          
          this.handleAutoSemesterSelection();
        } catch (err) {
          console.error('Error procesando semestres:', err);
          this.error = 'Error al procesar la lista de semestres';
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.error = 'Error al cargar semestres';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private handleAutoSemesterSelection(): void {
    if (this.semesters.length > 0) {
      // Verificamos si ya existe una selección válida (procedente de un @Input o selección previa)
      const exists = this.semesters.some(s => s.id === this.selectedSemesterId);

      if (!this.selectedSemesterId || !exists) {
        this.selectedSemesterId = this.semesters[0].id;
        console.log("Desde aqui - Semestre seleccionado automáticamente:", this.selectedSemesterId);
      }

      this.loadClassOffers(this.selectedSemesterId!);
    } else {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onSemesterSelected(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const semesterId = Number(target?.value ?? 0);

    if (!semesterId) {
      this.error = 'Selecciona un semestre valido';
      return;
    }

    this.selectedSemesterId = semesterId;
    this.selectedGrade = null;
    this.selectedGroup = '';
    this.groups = [];
    this.grades = [];
    this.groupSummaries = [];
    this.classOffers = [];
    this.selectedClassOffers = [];
    this.error = '';
    this.loadClassOffers(semesterId);
  }

  loadClassOffers(semesterId: number): void {
    this.loading = true; // Inicia la carga
    this.error = '';

    this.scheduleService.getClassOffersBySemester(semesterId).subscribe({
      next: (offers) => {
        console.log("Desde aqui - Ofertas de clase recibidas del servidor:", offers);
        this.classOffers = offers;
        this.grades = [...new Set(offers.map((offer) => offer.grade))].sort((left, right) => left - right);
        this.groupSummaries = this.buildGroupSummaries(offers);
        this.loadStudentCounts(semesterId);
        console.log("Desde aqui - Resumen de grupos generados:", this.groupSummaries);
        this.groups = this.getAvailableGroups();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Error al cargar ofertas de clase';
        this.loading = false;
      }
    });
  }

  loadStudentCounts(semesterId: number): void {
    this.kardexService.getRecordsBySemester(semesterId).subscribe({
      next: (res: any) => {
        const records = Array.isArray(res) ? res : (res?.data || []);
        const studentMap = new Map<string, Set<number>>();

        records.forEach((rec: any) => {
          const key = `${rec.grade}-${rec.groupName}`;
          if (!studentMap.has(key)) studentMap.set(key, new Set());
          studentMap.get(key)?.add(rec.studentId);
        });

        this.groupSummaries.forEach(group => {
          const key = `${group.grade}-${group.groupName}`;
          group.studentCount = studentMap.get(key)?.size || 0;
        });
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error al cargar conteo de alumnos:', err)
    });
  }

  onGradeSelected(): void {
    this.selectedGroup = '';
    this.selectedClassOffers = [];
    this.newGroupSubjects = [];
    this.error = '';
    this.groups = this.getAvailableGroups();
  }

  onGradeOrGroupSelected(): void {
    if (this.selectedSemesterId && this.selectedGrade && this.selectedGroup) {
      this.loadScheduleForGroup(this.selectedSemesterId, this.selectedGrade, this.selectedGroup);
    }
  }

  selectCreatedGroup(group: GroupSummary): void {
    this.selectedGrade = group.grade;
    this.groups = this.getAvailableGroups();
    this.selectedGroup = group.groupName;
    this.newGroupSubjects = [];

    if (this.selectedSemesterId) {
      this.loadScheduleForGroup(this.selectedSemesterId, group.grade, group.groupName);
    }
  }

  loadScheduleForGroup(semesterId: number, grade: number, groupName: string): void {
    this.loading = true; // Inicia la carga
    this.error = '';
    this.selectedClassOffers = [];
    this.newGroupSubjects = []; // Limpiamos carga previa
    this.scheduleGenerated = false;
    this.weeklyScheduleBlocks.set([]);

    // Reset de parámetros de tiempo para evitar mostrar datos de grupos anteriores
    this.scheduleStartTime = '';
    this.scheduleEndTime = '';
    this.scheduleStartTime2 = '';
    this.scheduleEndTime2 = '';
    this.scheduleIntervalMinutes = null;
    this.selectedDays.set([]);

    // Cargar configuración de la cuadrícula desde el servidor
    this.scheduleService.getGroupScheduleConfig(semesterId, grade, groupName).subscribe({
      next: (config) => {
        if (config) {
          this.scheduleStartTime = config.startTime1.substring(0, 5);
          this.scheduleEndTime = config.endTime1.substring(0, 5);
          this.scheduleStartTime2 = config.startTime2 ? config.startTime2.substring(0, 5) : '';
          this.scheduleEndTime2 = config.endTime2 ? config.endTime2.substring(0, 5) : '';
          this.scheduleIntervalMinutes = config.intervalMinutes;
          
          const days = config.workingDays.split(',')
            .map(d => Number(d))
            .filter(d => !isNaN(d));
          this.selectedDays.set(days);
          
          this.scheduleGenerated = true;
          this.updateScheduleSlots();
        }
      },
      error: () => console.log('No hay configuración previa para este grupo.')
    });

    this.scheduleService.getClassOffersByGradeAndGroup(semesterId, grade, groupName).subscribe({
      next: (offers) => {
        // Si no hay materias cargadas en el catálogo local (ej. al entrar desde Semestres), 
        // las cargamos usando el courseId de la primera oferta encontrada.
        if (offers.length > 0 && this.allSubjects.length === 0) {
          const firstCourseId = offers[0].courseId;
          if (firstCourseId) {
            this.subjectService.getSubjects(firstCourseId).subscribe(res => {
              this.allSubjects = Array.isArray(res) ? res : (res?.data || []);
              this.cdr.markForCheck();
            });
          }
        }

        if (offers.length === 0) {
          // Si el grupo no tiene materias, cargamos automáticamente el plan de estudios para este grado
          this.prepareGroupSubjects();
          this.scheduleGenerated = this.hasValidScheduleParameters() && this.selectedDays().length > 0;
          this.updateScheduleSlots();
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }

        forkJoin(offers.map((offer) => this.scheduleService.getSchedulesByClassOffer(offer.id))).subscribe({
          next: (schedulesByOffer) => {
            try {
              this.selectedClassOffers = offers.map((offer, index) => ({
                ...offer,
                schedules: schedulesByOffer[index] ?? []
              }));
              this.scheduleGenerated = this.hasValidScheduleParameters() && this.selectedDays().length > 0;
              this.updateScheduleSlots();
            } catch (err) {
              this.error = 'Error al procesar los datos del horario.';
            }
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.error = 'Error: No se pudo obtener el horario. Verifique que la tabla ClassScheduleBlock existe en la BD.';
            this.loading = false;
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.error = 'Error al cargar horarios';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getVisibleGroupSummaries(): GroupSummary[] {
    if (!this.selectedGrade) {
      return this.groupSummaries;
    }

    return this.groupSummaries.filter((group) => group.grade === this.selectedGrade);
  }

  isSelectedGroupCard(group: GroupSummary): boolean {
    return this.selectedGrade === group.grade && this.selectedGroup === group.groupName;
  }

  getDayName(dayIndex: number): string {
    return this.dayOfWeekNames[dayIndex] || '';
  }

  formatTime(time: string): string {
    return time?.substring(0, 5) ?? '';
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = (time || '00:00').split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  }

  formatMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  getIntervalMinutes(): number {
    if (this.scheduleIntervalMinutes === 0) {
      return this.customIntervalMinutes && this.customIntervalMinutes > 0 ? this.customIntervalMinutes : 0;
    }
    return this.scheduleIntervalMinutes ?? 0;
  }

  hasValidScheduleParameters(): boolean {
    const start = this.scheduleStartTime?.trim();
    const end = this.scheduleEndTime?.trim();
    const start2 = this.scheduleStartTime2?.trim();
    const end2 = this.scheduleEndTime2?.trim();
    const interval = this.getIntervalMinutes();
    const hasRange1 = !!start && !!end && this.toMinutes(start) < this.toMinutes(end);
    const hasRange2 = !!start2 && !!end2 && this.toMinutes(start2) < this.toMinutes(end2);
    return (hasRange1 || hasRange2) && interval > 0;
  }

  hasAnyScheduleDayAssigned(): boolean {
    return this.selectedClassOffers.some((offer) =>
      Array.isArray(offer.schedules) && offer.schedules.some((schedule: any) => {
        const dayIndex = Number(schedule.dayOfWeek);
        return !isNaN(dayIndex) && schedule.startTime && schedule.endTime;
      })
    );
  }

  isDaySelected(dayIndex: number): boolean {
    return this.selectedDays().includes(dayIndex);
  }

  toggleDaySelection(dayIndex: number): void {
    if (this.isDaySelected(dayIndex)) {
      this.selectedDays.set(this.selectedDays().filter((index) => index !== dayIndex));
    } else {
      this.selectedDays.set([...this.selectedDays(), dayIndex]);
    }
    // Activamos la vista si ya hay parámetros válidos y al menos un día seleccionado
    this.scheduleGenerated = this.hasValidScheduleParameters() && this.selectedDays().length > 0;
    this.updateScheduleSlots();
  }

  hasWeeklyBlocks(): boolean {
    return this.weeklyScheduleBlocks().length > 0 || this.hasAnyScheduleDayAssigned();
  }

  canShowWeeklySchedule(): boolean {
    return this.scheduleGenerated && this.hasValidScheduleParameters() && this.selectedDays().length > 0 && this.hasWeeklyBlocks();
  }

  onScheduleInputChanged(): void {
    // Validamos automáticamente para mostrar la tabla sin necesidad de botones extra
    this.scheduleGenerated = this.hasValidScheduleParameters() && this.selectedDays().length > 0;
    this.updateScheduleSlots();
  }

  addScheduleBlock(): void {
    if (!this.hasValidScheduleParameters()) {
      this.error = 'Selecciona entrada, salida e intervalo válidos antes de agregar un bloque.';
      return;
    }

    if (this.selectedDays().length === 0) {
      this.error = 'Selecciona al menos un día antes de agregar un bloque.';
      return;
    }

    this.error = '';
    
    let subjectName = '';
    if (this.newBlockOfferId) {
      const selectedOffer = this.selectedClassOffers.find(off => off.id === Number(this.newBlockOfferId));
      subjectName = selectedOffer ? this.getSubjectName(selectedOffer.subjectId) : `Oferta ${this.newBlockOfferId}`;
    } else {
      subjectName = this.newBlockName?.trim() || `Bloque ${this.weeklyScheduleBlocks().length + 1}`;
    }

    const newBlocks: WeeklyScheduleBlock[] = this.selectedDays().map((dayOfWeek) => ({
      id: Date.now() + dayOfWeek,
      subjectName: subjectName,
      dayOfWeek,
      startTime: this.scheduleStartTime,
      endTime: this.scheduleEndTime,
      classroom: this.newBlockClassroom,
      teacherId: this.newBlockTeacherId ?? null
    }));

    this.weeklyScheduleBlocks.update(blocks => [...blocks, ...newBlocks]);
    this.scheduleGenerated = true;
    this.updateScheduleSlots();

    // Limpiar campos del formulario para evitar que se repita la misma información
    this.clearNewBlockFields();
    this.cdr.markForCheck();
  }

  private clearNewBlockFields(): void {
    this.newBlockName = '';
    this.newBlockOfferId = null;
    this.newBlockTeacherId = null;
    this.newBlockClassroom = '';
  }

  generateSchedule(): void {
    if (!this.hasValidScheduleParameters()) {
      this.error = 'Selecciona entrada, salida e intervalo válidos antes de generar.';
      return;
    }

    if (this.selectedDays().length === 0) {
      this.error = 'Selecciona al menos un día antes de generar.';
      return;
    }

    this.error = '';
    this.scheduleGenerated = true;
    this.updateScheduleSlots();
  }

  getSubjectName(subjectId: any): string {
    if (!this.allSubjects || this.allSubjects.length === 0) return `ID: ${subjectId}`;
    // Usamos Number() para asegurar que la comparación sea exitosa sin importar el tipo (string o number)
    const subject = this.allSubjects.find((s: any) => Number(s.id) === Number(subjectId));
    return subject ? (subject.name || subject.nombre || subject.descripcion || `Materia ${subjectId}`) : `ID: ${subjectId}`;
  }

  getWeeklyScheduleRecords(): Array<any> {
    const offerRecords = this.selectedClassOffers.flatMap((offer) =>
      (offer.schedules || []).map((schedule: any) => ({
        ...schedule,
        label: this.getSubjectName(offer.subjectId),
        // Priorizar el aula/docente del bloque específico sobre el de la oferta general
        classroom: schedule.classroom || offer.classroom,
        teacherId: schedule.teacherId || offer.teacherId
      }))
    );

    const manualRecords = this.weeklyScheduleBlocks().map((block: WeeklyScheduleBlock) => ({ ...block, label: block.subjectName, subjectName: block.subjectName }));
    return [...offerRecords, ...manualRecords];
  }

  async saveScheduleConfiguration() {
    if (!this.selectedSemesterId || !this.selectedGrade || !this.selectedGroup) {
      alerts.basicAlert('Información faltante', 'Debe seleccionar un semestre, grado y grupo antes de guardar.', 'warning');
      return;
    }

    if (!this.hasValidScheduleParameters() || this.selectedDays().length === 0) {
      alerts.basicAlert('Configuración incompleta', 'Asegúrate de definir horarios de entrada/salida y seleccionar al menos un día.', 'warning');
      return;
    }

    // Preparamos el objeto para Guardar/Actualizar (Upsert) siguiendo el modelo de la interfaz
    const configPayload: GroupScheduleConfig = {
      semesterId: this.selectedSemesterId,
      grade: this.selectedGrade,
      groupName: this.selectedGroup,
      startTime1: this.scheduleStartTime.split(':').length === 2 ? `${this.scheduleStartTime}:00` : this.scheduleStartTime,
      endTime1: this.scheduleEndTime.split(':').length === 2 ? `${this.scheduleEndTime}:00` : this.scheduleEndTime,
      startTime2: this.scheduleStartTime2 ? (this.scheduleStartTime2.split(':').length === 2 ? `${this.scheduleStartTime2}:00` : this.scheduleStartTime2) : null,
      endTime2: this.scheduleEndTime2 ? (this.scheduleEndTime2.split(':').length === 2 ? `${this.scheduleEndTime2}:00` : this.scheduleEndTime2) : null,
      intervalMinutes: this.getIntervalMinutes(),
      workingDays: this.selectedDays().join(','),
      active: true
    };

    console.log('>>> [Configuración] Iniciando persistencia de estructura de tabla');
    console.table(configPayload);

    this.loading = true;
    try {
      await lastValueFrom(this.scheduleService.upsertGroupScheduleConfig(configPayload));

      alerts.basicAlert('Configuración Guardada', 'La estructura de turnos y días para este grupo se ha guardado correctamente.', 'success');
      this.updateScheduleSlots();
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      alerts.basicAlert('Error', 'No se pudo guardar la configuración estructural.', 'error');
    } finally {
      this.loading = false;
    }
  }

  async saveAllChanges() {
    // Filtramos los bloques que tienen una oferta de clase asociada para poder guardarlos en la BD
    const pendingBlocks = this.weeklyScheduleBlocks().filter(b => b.classOfferId);
    
    if (pendingBlocks.length === 0) {
      alerts.basicAlert('Info', 'No hay bloques nuevos vinculados a materias para guardar.', 'info');
      return;
    }

    this.loading = true;
    try {
      // Preparamos todas las peticiones de creación
      const requests = pendingBlocks.map(block => {
        return this.scheduleService.createSchedule({
          id: 0,
          classOfferId: block.classOfferId!,
          dayOfWeek: block.dayOfWeek,
          startTime: block.startTime.split(':').length === 2 ? `${block.startTime}:00` : block.startTime,
          endTime: block.endTime.split(':').length === 2 ? `${block.endTime}:00` : block.endTime,
          teacherId: block.teacherId ? Number(block.teacherId) : null,
          classroom: block.classroom || null,
          active: true,
          createdAt: new Date().toISOString().split('.')[0]
        } as any);
      });

      // Ejecutamos todas las promesas
      await lastValueFrom(forkJoin(requests));
      
      alerts.basicAlert('Éxito', 'El horario se ha sincronizado con el servidor.', 'success');
      this.weeklyScheduleBlocks.set([]); // Limpiamos los bloques locales
      this.onGradeOrGroupSelected(); // Recargamos datos reales del servidor
    } catch (error) {
      console.error('Error al guardar horario masivo:', error);
      alerts.basicAlert('Error', 'Ocurrió un problema al guardar los bloques.', 'error');
    } finally {
      this.loading = false;
    }
  }

  updateScheduleSlots(): void {
    try {
      const interval = this.getIntervalMinutes();

      this.scheduleSlots = [];
      this.scheduleSlotObjects = [];
      this.slotMap = [];

      if (!interval) return;

      const ranges = [
        { start: this.toMinutes(this.scheduleStartTime), end: this.toMinutes(this.scheduleEndTime) },
        { start: this.toMinutes(this.scheduleStartTime2), end: this.toMinutes(this.scheduleEndTime2) }
      ].filter(r => r.start < r.end);

      if (ranges.length === 0) {
        return;
      }

      const slots: Array<{ startM: number; endM: number; label: string; endLabel?: string }> = [];
      ranges.forEach(range => {
        for (let current = range.start; current < range.end; current += interval) {
          const slotEnd = Math.min(current + interval, range.end);
          slots.push({ startM: current, endM: slotEnd, label: this.formatMinutes(current), endLabel: this.formatMinutes(slotEnd) });
        }
      });

      // Ordenar slots por tiempo de inicio para mantener coherencia cronológica
      slots.sort((a, b) => a.startM - b.startM);

      this.scheduleSlotObjects = slots;

      // construir slotMap sólo si hay días seleccionados
      const days = this.visibleScheduleDays().map(d => d.index);
      this.slotMap = days.map(() => slots.map(() => []));

      // Combinar registros de ofertas y bloques manuales
      const records = this.getWeeklyScheduleRecords();
      // Normalizar y popular slotMap
      records.forEach((rec: any) => {
        const dayIdx = Number(rec.dayOfWeek);
        if (isNaN(dayIdx) || !days.includes(dayIdx)) return;
        const startM = this.toMinutes(rec.startTime || '00:00');
        const endM = this.toMinutes(rec.endTime || '00:00');
        if (startM >= endM) return;

        // colocar el item sólo en la primera ranura que cubra el inicio del schedule
        const startIndex = slots.findIndex(s => startM >= s.startM && startM < s.endM);
        if (startIndex >= 0) {
          const dayArrayIndex = days.indexOf(dayIdx);
          if (dayArrayIndex >= 0) {
            // calcular span (número de ranuras que ocupa)
            let endIndex = startIndex;
            for (let k = startIndex; k < slots.length; k++) {
              if (slots[k].startM < endM) {
                endIndex = k;
              } else break;
            }
            const span = endIndex - startIndex + 1;
            this.slotMap[dayArrayIndex][startIndex].push({
              dayOfWeek: dayIdx,
              startTime: rec.startTime,
              endTime: rec.endTime,
              label: rec.label || rec.subjectName || `Materia ${rec.subjectId || ''}`,
              classroom: rec.classroom,
              teacherId: rec.teacherId,
              source: rec,
              span
            });
          }
        }
      });

      // Also keep legacy string array for any other code paths
      this.scheduleSlots = this.scheduleSlotObjects.map(s => s.label);
    } catch (err) {
      console.error('Error en updateScheduleSlots:', err, { start: this.scheduleStartTime, end: this.scheduleEndTime, interval: this.getIntervalMinutes() });
      return;
    }
  }

  isScheduleActiveAtSlot(schedule: any, slotTime: string, dayName: string): boolean {
    const dayIndex = this.dayOfWeekNames.indexOf(dayName);
    const scheduleDay = Number(schedule.dayOfWeek);
    if (isNaN(scheduleDay) || scheduleDay !== dayIndex) {
      return false;
    }
    const slotMinutes = this.toMinutes(slotTime);
    const startMinutes = this.toMinutes(schedule.startTime);
    const endMinutes = this.toMinutes(schedule.endTime);
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  }

  // Devuelve los items para una celda (día visible index, slotIndex)
  getOffersForSlot(visibleDayIndex: number, slotIndex: number): any[] {
    if (!Array.isArray(this.slotMap) || !this.slotMap[visibleDayIndex]) return [];
    return this.slotMap[visibleDayIndex][slotIndex] || [];
  }

  trackByOffer(index: number, item: any) {
    return item?.source?.classOfferId || item?.label || index;
  }

  openAssign(visibleDayIndex: number, slotIndex: number, event?: Event) {
    if (event) event.stopPropagation();

    const existingItems = this.getOffersForSlot(visibleDayIndex, slotIndex);
    this.assignmentTarget = { dayIndexVisible: visibleDayIndex, slotIndex };

    if (existingItems && existingItems.length > 0) {
      // Si ya hay algo, cargamos los datos del primero para editar
      const item = existingItems[0];
      const source = item.source; // El registro original (Schedule o WeeklyScheduleBlock)

      this.assignmentModel = {
        id: source.id,
        classOfferId: source.classOfferId || null,
        teacherId: source.teacherId || null,
        classroom: source.classroom || '',
        startTime: this.formatTime(source.startTime),
        endTime: this.formatTime(source.endTime)
      };
      this.newBlockName = !source.classOfferId ? (source.subjectName || item.label) : '';
    } else {
      // Si está vacío, preparamos un nuevo bloque
      const slot = this.scheduleSlotObjects[slotIndex];
      this.assignmentModel = {
        id: 0,
        classOfferId: null,
        teacherId: null,
        classroom: '',
        startTime: slot?.label || '',
        endTime: slot?.endLabel || ''
      };
      this.newBlockName = '';
    }
  }

  closeAssign() {
    this.assignmentTarget = null;
    this.assignmentModel = {};
    this.assigning = false;
  }

  async saveAssignment() {
    if (!this.assignmentTarget) return;
    if (this.assigning) return;
    const dayVisibleIdx = this.assignmentTarget.dayIndexVisible;
    const slotIdx = this.assignmentTarget.slotIndex;
    const dayIdx = this.visibleScheduleDays()[dayVisibleIdx]?.index;
    if (dayIdx === undefined) return;

    // Asegurar formato HH:mm:ss agregando segundos si no los tiene
    const ensureSeconds = (time: string) => time.split(':').length === 2 ? `${time}:00` : time;

    const startTime = ensureSeconds(this.assignmentModel.startTime || this.scheduleSlotObjects[slotIdx]?.label);
    const endTime = ensureSeconds(this.assignmentModel.endTime || this.formatMinutes((this.scheduleSlotObjects[slotIdx]?.endM) ?? (this.toMinutes(startTime) + this.getIntervalMinutes())));

    // If a classOfferId is selected, persist via API
    if (this.assignmentModel.classOfferId != null && Number(this.assignmentModel.classOfferId) !== 0) {
      this.assigning = true;
      const isUpdate = (this.assignmentModel.id ?? 0) > 0;
      const payload = {
        id: this.assignmentModel.id ?? 0,
        classOfferId: Number(this.assignmentModel.classOfferId),
        dayOfWeek: dayIdx,
        startTime,
        endTime,
        teacherId: this.assignmentModel.teacherId ? Number(this.assignmentModel.teacherId) : null,
        classroom: this.assignmentModel.classroom || null,
        active: true,
        createdAt: new Date().toISOString()
      };
      
      console.log(isUpdate ? 'Actualizando horario:' : 'Creando horario:', payload);

      try {
        // Usamos createSchedule (asumiendo que el backend maneja el ID para update o que existe un método similar)
        // Si tu servicio tiene .updateSchedule, cámbialo aquí
        await lastValueFrom(this.scheduleService.createSchedule(payload as any));

        // refrescar horarios del grupo actual
        if (this.selectedSemesterId && this.selectedGrade && this.selectedGroup) {
          this.loadScheduleForGroup(this.selectedSemesterId, this.selectedGrade, this.selectedGroup);
        } else {
          this.updateScheduleSlots();
        }
        this.scheduleGenerated = true;
      } catch (err) {
        console.error('Error guardando horario:', err);
        alerts.basicAlert('Error', 'No se pudo guardar el horario en el servidor.', 'error');
      } finally {
        this.assigning = false;
        this.closeAssign();
      }
      return;
    }

    // Si no hay classOfferId, guardamos como bloque manual en memoria
    if (this.assignmentModel.id && this.assignmentModel.id > 0) {
      // Actualizar bloque manual existente en el signal
      this.weeklyScheduleBlocks.update(blocks => blocks.map(b => 
        b.id === this.assignmentModel.id 
          ? { ...b, subjectName: this.newBlockName, startTime, endTime, classroom: this.assignmentModel.classroom, teacherId: this.assignmentModel.teacherId }
          : b
      ));
    } else {
      // Crear nuevo bloque manual
    const blockName = this.newBlockName?.trim() || `Bloque ${this.weeklyScheduleBlocks().length + 1}`;
    const newBlock: WeeklyScheduleBlock = {
      id: Date.now(),
      subjectName: blockName,
      dayOfWeek: dayIdx,
      startTime: startTime || '',
      endTime: endTime || '',
      classOfferId: this.assignmentModel.classOfferId ? Number(this.assignmentModel.classOfferId) : null,
      classroom: this.assignmentModel.classroom || null,
      teacherId: this.assignmentModel.teacherId ? Number(this.assignmentModel.teacherId) : null
    };
    this.weeklyScheduleBlocks.update(blocks => [...blocks, newBlock]);
    }

    this.scheduleGenerated = true;
    this.updateScheduleSlots();
    this.closeAssign();
    this.newBlockName = '';
  }

  private resetGenerateModalState(selectDefaults: boolean = true): void {
    this.modalSelectedOfferId = null;
    this.modalSelectedTeacherId = null;
    this.modalClassroom = '';
    this.modalStartTime = this.scheduleStartTime;
    this.modalEndTime = this.scheduleEndTime;
    this.modalSelectedDays = selectDefaults ? [...this.selectedDays()] : [];
    this.modalSelectedSlots = selectDefaults ? this.scheduleSlotObjects.map((_, idx) => idx) : [];
  }

  private clearGenerateModalFields(): void {
    this.modalSelectedOfferId = null;
    this.modalSelectedTeacherId = null;
    this.modalClassroom = '';
    this.modalSelectedDays = [];
    this.modalSelectedSlots = [];
  }

  openGenerateModal() {
    this.resetGenerateModalState(false);
    this.showGenerateModal = true;
  }

  closeGenerateModal() {
    this.showGenerateModal = false;
    this.resetGenerateModalState(true);
  }

  toggleModalDay(dayIndex: number) {
    if (this.modalSelectedDays.includes(dayIndex)) {
      this.modalSelectedDays = this.modalSelectedDays.filter(d => d !== dayIndex);
    } else {
      this.modalSelectedDays = [...this.modalSelectedDays, dayIndex];
    }
  }

  async generateBlocksFromModal() {
    if (this.modalSelectedSlots.length === 0 || this.modalSelectedDays.length === 0) {
      alerts.basicAlert('Error', 'Selecciona al menos una ranura y al menos un día.', 'error');
      return;
    }

    const requests = [];
    const classOfferId = this.modalSelectedOfferId ? Number(this.modalSelectedOfferId) : null;
    const teacherId = this.modalSelectedTeacherId ? Number(this.modalSelectedTeacherId) : null;
    const classroom = this.modalClassroom || null;

    for (const day of this.modalSelectedDays) {
      for (const slotIdx of this.modalSelectedSlots) {
        const slot = this.scheduleSlotObjects[slotIdx];
        if (!slot) continue;
        const start = slot.label;
        const end = slot.endLabel || this.formatMinutes(slot.endM);
        
        if (this.blockExists(day, start, end)) {
          console.warn(`Skipping duplicate block: Day ${day}, Time ${start}-${end}`);
          continue;
        }

        if (classOfferId) {
          const payload = {
            id: 0,
            classOfferId,
            dayOfWeek: day,
            startTime: start.split(':').length === 2 ? `${start}:00` : start,
            endTime: end.split(':').length === 2 ? `${end}:00` : end,
            teacherId,
            classroom,
            active: true,
            createdAt: new Date().toISOString()
          };
          requests.push(this.scheduleService.createSchedule(payload as any));
        } else {
          // Bloque manual (ej. Receso)
          const newBlock: WeeklyScheduleBlock = {
            id: Math.floor(Math.random() * 1000000) + day + slotIdx,
            subjectName: classroom || `Bloque ${this.weeklyScheduleBlocks().length + 1}`,
            dayOfWeek: day,
            startTime: start,
            endTime: end,
            classOfferId: null,
            classroom,
            teacherId
          };
          this.weeklyScheduleBlocks.update(blocks => [...blocks, newBlock]);
        }
      }
    }

    if (requests.length > 0) {
      try {
        this.loading = true;
        await lastValueFrom(forkJoin(requests));
        alerts.basicAlert('Éxito', 'Los bloques se han guardado en la base de datos.', 'success');
        this.onGradeOrGroupSelected(); // Recarga real desde el servidor
      } catch (err) {
        console.error('Error al guardar bloques del asistente:', err);
        alerts.basicAlert('Error', 'No se pudieron guardar algunos bloques en el servidor.', 'error');
      } finally {
        this.loading = false;
      }
    }
    
    this.clearGenerateModalFields();
    this.updateScheduleSlots();
    this.scheduleGenerated = true;
    this.cdr.markForCheck();
  }

  getTeacherName(teacherId: number): string {
    const teacher = this.teachers.find((t) => t.id === teacherId);
    return teacher ? teacher.name : `ID ${teacherId}`;
  }

  loadStudents(): void {
    this.showLoadStudentsModal.set(true);
  }

  exportScheduleToCalendar(): void {
    console.log('Exportar a calendario');
  }

  printSchedule() {
    console.log('🎯 [printSchedule] Iniciando generación de PDF...');
    console.log('🎯 [printSchedule] Datos:', {
      semesterId: this.selectedSemesterId,
      grade: this.selectedGrade,
      group: this.selectedGroup,
      visibleDays: this.visibleScheduleDays(),
      slotsCount: this.scheduleSlotObjects.length
    });
    
    if (!this.selectedGrade || !this.selectedGroup) {
      console.error('❌ [printSchedule] Faltan datos: grado o grupo');
      return;
    }

    try {
      console.log('📋 [printSchedule] Generando definición PDF...');
      const pdfDoc = SchedulePdfUtil.generateSchedulePDF(
        this.getSelectedSemesterName(),
        this.selectedGrade,
        this.selectedGroup,
        this.visibleScheduleDays(),
        this.scheduleSlotObjects,
        (di, si) => this.getOffersForSlot(di, si),
        (id) => this.getTeacherName(id)
      );
      console.log('✅ [printSchedule] PDF generado exitosamente:', pdfDoc);
      
      this.openPdfPreview(pdfDoc, `Horario_${this.selectedGrade}_${this.selectedGroup}.pdf`);
    } catch (error) {
      console.error('❌ [printSchedule] Error al generar PDF:', error);
    }
  }

  printStudentList() {
    console.log('👥 [printStudentList] Iniciando generación de lista de alumnos...');
    console.log('👥 [printStudentList] Datos:', {
      semesterId: this.selectedSemesterId,
      grade: this.selectedGrade,
      group: this.selectedGroup
    });

    if (this.selectedSemesterId === null || !this.selectedGrade || !this.selectedGroup) {
      console.error('❌ [printStudentList] Faltan datos requeridos');
      return;
    }
    
    const branchId = this.signalsService.getBranchSelectedBySidebar() ?? 0;
    const courseId = this.selectedCourseId();
    
    console.log('👥 [printStudentList] Obteniendo estudiantes con:', {
      branchId,
      courseId,
      grade: this.selectedGrade,
      group: this.selectedGroup
    });

    this.studentService.getListStudents(
      branchId,
      courseId,
      this.selectedGrade.toString(),
      this.selectedGroup
    ).subscribe({
      next: (response: any) => {
        console.log('✅ [printStudentList] Respuesta recibida:', response);
        const data = Array.isArray(response) ? response : (response?.data || []);
        console.log('📊 [printStudentList] Estudiantes procesados:', data.length);
        
        if (data.length === 0) {
          console.warn('⚠️ [printStudentList] No hay estudiantes para este grupo');
          alerts.basicAlert('Sin datos', 'No se encontraron alumnos para este grupo', 'info');
          return;
        }
        
        console.log('📋 [printStudentList] Generando PDF de estudiantes...');
        const pdfDoc = StudentsPdfUtil.generateStudentsListPDF(data);
        console.log('✅ [printStudentList] PDF generado:', pdfDoc);
        
        this.openPdfPreview(pdfDoc, `Lista_Alumnos_${this.selectedGrade}_${this.selectedGroup}.pdf`);
      },
      error: (err) => {
        console.error('❌ [printStudentList] Error al obtener lista de alumnos:', err);
        alerts.basicAlert('Error', 'No se pudo generar la lista de alumnos', 'error');
      }
    });
  }

  private openPdfPreview(pdfDoc: any, fileName: string) {
    console.log('📂 [openPdfPreview] Iniciando apertura de PDF...');
    console.log('📂 [openPdfPreview] Tipo de pdfDoc:', pdfDoc?.constructor?.name);
    console.log('📂 [openPdfPreview] Métodos disponibles:', Object.getOwnPropertyNames(Object.getPrototypeOf(pdfDoc)));
    
    this.currentPdfDoc = pdfDoc;
    this.pdfFileName = fileName;
    
    // Mostramos el modal de inmediato
    console.log('🔓 [openPdfPreview] Abriendo modal...');
    this.showPdfPreview.set(true);
    this.pdfPreviewUrl.set(null);
    this.cdr.markForCheck();

    try {
      console.log('⏳ [openPdfPreview] Intentando obtener PDF con getBlob()...');

      // Intentamos con getBlob, pero con un wrap de seguridad
      if (pdfDoc.getBlob && typeof pdfDoc.getBlob === 'function') {
        pdfDoc.getBlob((blob: Blob) => {
          console.log('✅ [openPdfPreview] Callback de getBlob() ejecutado');
          console.log('📊 [openPdfPreview] Blob size:', blob.size, 'bytes');
            
          this.zone.run(() => {
            if (this.currentBlobUrl) {
              URL.revokeObjectURL(this.currentBlobUrl);
            }

            const blobUrl = URL.createObjectURL(blob);
            this.currentBlobUrl = blobUrl;
            console.log('📋 [openPdfPreview] Blob URL creada');
            
            const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
            
            this.pdfPreviewUrl.set(safeUrl);
            this.loading = false;
            
            this.cdr.markForCheck();
            console.log('✅ [openPdfPreview] pdfPreviewUrl seteada y vista actualizada');
          });
        });
      } else {
        console.error('❌ [openPdfPreview] Método getBlob no disponible');
        console.log('📝 Intentando métodos alternativos...');
        
        // Intentar con método promise-based si existe
        if (pdfDoc.pdfDocumentPromise) {
          console.log('⏳ Usando pdfDocumentPromise...');
          pdfDoc.pdfDocumentPromise.then((pdf: any) => {
            console.log('✅ pdfDocumentPromise resuelto');
            if (pdf.getBlob) {
              pdf.getBlob((blob: Blob) => {
                const blobUrl = URL.createObjectURL(blob);
                this.zone.run(() => {
                  this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl));
                  this.cdr.markForCheck();
                });
              });
            }
          });
        } else {
          throw new Error('No se encontró método para obtener PDF');
        }
      }
    } catch (err) {
      console.error('❌ [openPdfPreview] Error crítico:', err);
      this.closePdfPreview();
      alerts.basicAlert('Error', 'No se pudo renderizar el PDF. Verifique los datos.', 'error');
    }
  }

  downloadPdf() {
    console.log('⬇️ [downloadPdf] Iniciando descarga...');
    console.log('⬇️ [downloadPdf] Archivo:', this.pdfFileName);
    console.log('⬇️ [downloadPdf] pdfDoc disponible:', !!this.currentPdfDoc);
    
    if (this.currentPdfDoc) {
      console.log('⬇️ [downloadPdf] Llamando a download()...');
      this.currentPdfDoc.download(this.pdfFileName);
      console.log('✅ [downloadPdf] Download completado');
      this.closePdfPreview();
    } else {
      console.error('❌ [downloadPdf] No hay PDF disponible para descargar');
    }
  }

  closePdfPreview() {
    console.log('❌ [closePdfPreview] Cerrando vista previa...');
    this.showPdfPreview.set(false);
    this.pdfPreviewUrl.set(null);
    this.currentPdfDoc = null;
    console.log('✅ [closePdfPreview] Vista previa cerrada');
  }

  getSelectedSemesterName(): string {
    const semester = this.semesters.find(s => s.id === this.selectedSemesterId);
    return semester ? semester.comment : (this.selectedSemesterId ? `Semestre ${this.selectedSemesterId}` : '');
  }

  private buildGroupSummaries(offers: ClassOffer[]): GroupSummary[] {
    const grouped = new Map<string, GroupSummary>();

    offers.forEach((offer) => {
      const key = `${offer.grade}-${offer.groupName}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.offersCount += 1;
        return;
      }

      grouped.set(key, {
        grade: offer.grade,
        groupName: offer.groupName,
        label: `${offer.grade}°${offer.groupName}`,
        offersCount: 1,
        semesterId: (offer as any).semesterId,
        semesterComment: (offer as any).semesterComment
      });
    });

    return Array.from(grouped.values()).sort((left, right) => {
      if (left.grade !== right.grade) {
        return left.grade - right.grade;
      }

      return left.groupName.localeCompare(right.groupName);
    });
  }

  private getAvailableGroups(): string[] {
    const source = this.selectedGrade
      ? this.groupSummaries.filter((group) => group.grade === this.selectedGrade)
      : this.groupSummaries;

    return [...new Set(source.map((group) => group.groupName))].sort();
  }
}
