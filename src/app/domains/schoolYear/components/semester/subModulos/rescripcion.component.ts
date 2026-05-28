import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { Subject, EMPTY, catchError, forkJoin, switchMap, takeUntil, tap } from 'rxjs';
import { alerts } from '../../../../../helpers/alerts';
import { Students } from '../../../../../interface/students';
import { CoursesService } from '../../../../../service/courses.service';
import { RegisAndReService } from '../../../../../service/regisAndRe.service';
import { SignalsService } from '../../../../../service/signals.service';
import { StudentsService } from '../../../../../service/student.service';
import { TrackingService } from '../../../../../service/tracking.service';
import { UsersxpermissionsService } from '../../../../../service/usersxpermissions.service';

@Component({
  selector: 'app-rescripcion',
  standalone: true,
  imports: [AgGridAngular, FormsModule],
  templateUrl: './rescripcion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Rescripcion implements OnDestroy {
  private gridApi!: GridApi;
  private destroy$ = new Subject<void>();

  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);
  public studentService = inject(StudentsService);
  public coursesService = inject(CoursesService);
  public regisAndReService = inject(RegisAndReService);

  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);
  protected readonly idBranch = computed(() => this.signalsService.getBranchSelectedBySidebar() ?? 0);

  idSemester = input<number>(0);
  isModalOpen = signal(false);
  monto = signal<number>(0);
  studentSearch = signal('');
  selectedStudentId = signal<number>(0);
  protected readonly coursesVigentes = signal<any[]>([]);
  protected readonly availableStudents = signal<Students[]>([]);
  protected readonly rowData = signal<any[]>([]);

  public studentForm: Students = this.createEmptyStudentForm();

  protected readonly filteredStudents = computed(() => {
    const term = this.studentSearch().trim().toLowerCase();
    const students = this.availableStudents();

    if (!term) {
      return students;
    }

    return students.filter((student) => {
      const fullName = `${student.firstName ?? ''} ${student.lastNameFather ?? ''} ${student.lastNameMother ?? ''}`.toLowerCase();
      const controlNumber = (student.controlNumber ?? '').toLowerCase();
      const grade = (student.grade ?? '').toLowerCase();
      const group = (student.group ?? '').toLowerCase();

      return fullName.includes(term) || controlNumber.includes(term) || grade.includes(term) || group.includes(term);
    });
  });

  constructor() {
    effect(() => {
      const companyId = this.idCompany();
      const branchId = this.idBranch();
      const semesterId = this.idSemester();
      const userId = this.signalsService.idUser();

      if (branchId > 0) {
        forkJoin({
          permissions: this.usersxrootService.getUsersxPermissionsGeneral('course', userId),
          courses: this.coursesService.getCoursesVigentes(branchId),
          students: this.studentService.getStudents(branchId, 0),
        }).pipe(takeUntil(this.destroy$)).subscribe({
          next: (res) => {
            const assigned = Array.isArray(res.permissions) ? res.permissions : (res.permissions?.data || []);
            const allCourses = Array.isArray(res.courses) ? res.courses : (res.courses?.data || []);
            const allStudents = Array.isArray(res.students) ? res.students : (res.students?.data || []);

            let filteredCourses = [];
            if (assigned.some((p: any) => p.idPermission === 0)) {
              filteredCourses = allCourses;
            } else {
              filteredCourses = allCourses.filter((course: any) =>
                assigned.some((permission: any) => permission.idPermission === course.id)
              );
            }

            const allowedCourseIds = new Set(filteredCourses.map((course: any) => course.id));
            const filteredStudents = allStudents.filter((student: Students) =>
              student.active !== false && student.vigente !== false && allowedCourseIds.has(student.idCourses)
            );

            this.coursesVigentes.set(filteredCourses);
            this.availableStudents.set(filteredStudents);
          },
          error: (err) => {
            console.error('Error al cargar cursos o alumnos en reinscripcion:', err);
            this.coursesVigentes.set([]);
            this.availableStudents.set([]);
          },
        });
      } else {
        this.coursesVigentes.set([]);
        this.availableStudents.set([]);
      }

      if (companyId > 0 && semesterId > 0) {
        this.loadData();
      } else {
        this.rowData.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData() {
    if (this.idCompany() === 0 || this.idSemester() === 0) return;

    this.regisAndReService.getRegisAndRe(this.idSemester(), 'REINSCRIPCION').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
      },
      error: (error) => {
        console.error('Error al cargar reinscripciones:', error);
      },
    });
  }

  protected readonly columnDefs = signal<ColDef[]>([
    {
      headerName: 'Alumno',
      flex: 2,
      valueGetter: (params) => {
        if (!params.data) return '';
        const { firstName, lastNameFather, lastNameMother } = params.data;
        return `${firstName ?? ''} ${lastNameFather ?? ''} ${lastNameMother ?? ''}`.trim();
      }
    },
    {
      headerName: 'Carrera',
      flex: 2,
      valueGetter: (params) => params.data ? `${params.data.name} (${params.data.abreviatura})` : '',
    },
    {
      field: 'grade',
      headerName: 'Grado',
      width: 90,
    },
    {
      field: 'group',
      headerName: 'Grupo',
      width: 90,
    },
    {
      field: 'monto',
      headerName: 'Monto Reinscripcion',
      width: 150,
      valueFormatter: (params) => params.value ? `$${params.value}` : '$0.00',
    },
  ]);

  public onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  public onCellDoubleClicked(_event: CellDoubleClickedEvent) {}

  public onCellValueChanged(_event: CellValueChangedEvent) {}

  public addData() {
    this.studentSearch.set('');
    this.selectedStudentId.set(0);
    this.monto.set(0);
    this.studentForm = this.createEmptyStudentForm(this.idBranch());
    this.isModalOpen.set(true);
  }

  public onStudentSelected(studentId: number) {
    this.selectedStudentId.set(Number(studentId) || 0);

    const selectedStudent = this.availableStudents().find((student) => student.id === this.selectedStudentId());
    if (!selectedStudent) {
      this.studentForm = this.createEmptyStudentForm(this.idBranch());
      return;
    }

    this.studentForm = {
      ...selectedStudent,
      idCampus: this.idBranch(),
      nacimiento: this.normalizeDate(selectedStudent.nacimiento),
    };
  }

  public confirmAddStudent() {
    if (this.selectedStudentId() === 0 || this.studentForm.id === 0) {
      alerts.basicAlert('Alumno requerido', 'Seleccione un alumno para continuar.', 'warning');
      return;
    }

    if (!this.studentForm.idCourses || !this.normalizeText(this.studentForm.grade) || !this.normalizeText(this.studentForm.group)) {
      alerts.basicAlert('Campos incompletos', 'Actualice carrera, grado y grupo antes de guardar.', 'warning');
      return;
    }

    const alreadyRegistered = this.rowData().some((row) => Number(row.idStudent) === this.studentForm.id);
    if (alreadyRegistered) {
      alerts.basicAlert('Registro duplicado', 'El alumno seleccionado ya cuenta con reinscripcion en este semestre.', 'warning');
      return;
    }

    const payload = this.buildStudentPayload();

    this.studentService.updateStudents(this.studentForm.id, payload).pipe(
      switchMap(() => this.regisAndReService.addRegisAndRe({
        id: 0,
        idSemester: this.idSemester(),
        idStudent: this.studentForm.id,
        monto: Number(this.monto()) || 0,
        type: 'REINSCRIPCION',
        active: true,
      })),
      tap(() => {
        alerts.basicAlert('Registro exitoso', 'La reinscripcion del alumno se realizo correctamente.', 'success');
        this.closeModal();
        this.loadData();
        this.reloadStudents();

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Reinscripcion de alumno: ${payload.firstName} ${payload.lastNameFather}`,
          'Modulo Reinscripcion',
          this.trackingService.getEmail()
        );
      }),
      catchError((error) => {
        console.error('Error en el proceso de reinscripcion:', error);
        const msg = error.error?.message || 'No se pudo realizar la reinscripcion. Intente de nuevo.';
        alerts.basicAlert('Error', msg, 'error');
        return EMPTY;
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  public closeModal() {
    this.isModalOpen.set(false);
  }

  public refreshData() {
    this.gridApi?.stopEditing();
    this.loadData();
    this.reloadStudents();
  }

  public getStudentFullName(student: Students): string {
    return `${student.firstName ?? ''} ${student.lastNameFather ?? ''} ${student.lastNameMother ?? ''}`.trim();
  }

  public getCourseName(courseId: number): string {
    const course = this.coursesVigentes().find((item: any) => item.id === courseId);
    return course?.name || 'Sin asignar';
  }

  private reloadStudents() {
    const branchId = this.idBranch();
    if (branchId === 0) return;

    this.studentService.getStudents(branchId, 0).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const allStudents = Array.isArray(response) ? response : (response?.data || []);
        const allowedCourseIds = new Set(this.coursesVigentes().map((course: any) => course.id));
        const filteredStudents = allStudents.filter((student: Students) =>
          student.active !== false && student.vigente !== false && allowedCourseIds.has(student.idCourses)
        );
        this.availableStudents.set(filteredStudents);
      },
      error: (error) => {
        console.error('Error al recargar alumnos:', error);
      },
    });
  }

  private createEmptyStudentForm(idCampus = 0): Students {
    return {
      id: 0,
      idCampus,
      controlNumber: '',
      firstName: '',
      lastNameFather: '',
      lastNameMother: '',
      nameProcedencia: '',
      typoProcedencia: '',
      estadoProcedencia: 0,
      curp: '',
      nacimiento: new Date().toISOString().split('T')[0],
      grade: '',
      idCourses: 0,
      group: '',
      internetPassword: '',
      email: '',
      phone: '',
      emergencyContact: '',
      emergencyPhone: '',
      address: '',
      numAddress: '',
      colonia: '',
      cp: 0,
      ciudad: 0,
      nameFather: '',
      phoneFather: '',
      ocupacionFather: '',
      nameMother: '',
      phoneMother: '',
      ocupacionMother: '',
      nameTutor: '',
      phoneTutor: '',
      ocupacionTutor: '',
      bloodType: '',
      estatura: '',
      peso: '',
      alergia: '',
      efermedad: '',
      issste: '',
      imss: '',
      clinica: '',
      razonSocial: '',
      rfc: '',
      domicilio: '',
      telefono: '',
      correo: '',
      municipio: '',
      estado: '',
      pais: '',
      metodo: '',
      acta: '',
      secundaria: '',
      parcial: '',
      resolRevalidacion: '',
      docCurp: '',
      resolEquivalencia: '',
      conducta: '',
      medico: '',
      fotos: false,
      vigente: true,
      active: true,
    };
  }

  private buildStudentPayload(): Students {
    return {
      id: this.studentForm.id ?? 0,
      idCampus: this.idBranch(),
      controlNumber: this.normalizeText(this.studentForm.controlNumber),
      firstName: this.normalizeText(this.studentForm.firstName),
      lastNameFather: this.normalizeText(this.studentForm.lastNameFather),
      lastNameMother: this.normalizeText(this.studentForm.lastNameMother),
      nameProcedencia: this.normalizeText(this.studentForm.nameProcedencia),
      typoProcedencia: this.normalizeText(this.studentForm.typoProcedencia),
      estadoProcedencia: this.normalizeNumber(this.studentForm.estadoProcedencia),
      curp: this.normalizeText(this.studentForm.curp).toUpperCase(),
      nacimiento: this.normalizeDate(this.studentForm.nacimiento),
      grade: this.normalizeText(this.studentForm.grade),
      idCourses: this.normalizeNumber(this.studentForm.idCourses),
      group: this.normalizeText(this.studentForm.group),
      internetPassword: this.normalizeText(this.studentForm.internetPassword),
      email: this.normalizeText(this.studentForm.email),
      phone: this.normalizeText(this.studentForm.phone),
      emergencyContact: this.normalizeText(this.studentForm.emergencyContact),
      emergencyPhone: this.normalizeText(this.studentForm.emergencyPhone),
      address: this.normalizeText(this.studentForm.address),
      numAddress: this.normalizeText(this.studentForm.numAddress),
      colonia: this.normalizeText(this.studentForm.colonia),
      cp: this.normalizeNumber(this.studentForm.cp),
      ciudad: this.normalizeNumber(this.studentForm.ciudad),
      nameFather: this.normalizeText(this.studentForm.nameFather),
      phoneFather: this.normalizeText(this.studentForm.phoneFather),
      ocupacionFather: this.normalizeText(this.studentForm.ocupacionFather),
      nameMother: this.normalizeText(this.studentForm.nameMother),
      phoneMother: this.normalizeText(this.studentForm.phoneMother),
      ocupacionMother: this.normalizeText(this.studentForm.ocupacionMother),
      nameTutor: this.normalizeText(this.studentForm.nameTutor),
      phoneTutor: this.normalizeText(this.studentForm.phoneTutor),
      ocupacionTutor: this.normalizeText(this.studentForm.ocupacionTutor),
      bloodType: this.normalizeText(this.studentForm.bloodType).toUpperCase(),
      estatura: this.normalizeText(this.studentForm.estatura),
      peso: this.normalizeText(this.studentForm.peso),
      alergia: this.normalizeText(this.studentForm.alergia),
      efermedad: this.normalizeText(this.studentForm.efermedad),
      issste: this.normalizeText(this.studentForm.issste),
      imss: this.normalizeText(this.studentForm.imss),
      clinica: this.normalizeText(this.studentForm.clinica),
      razonSocial: this.normalizeText(this.studentForm.razonSocial),
      rfc: this.normalizeText(this.studentForm.rfc).toUpperCase(),
      domicilio: this.normalizeText(this.studentForm.domicilio),
      telefono: this.normalizeText(this.studentForm.telefono),
      correo: this.normalizeText(this.studentForm.correo),
      municipio: this.normalizeText(this.studentForm.municipio),
      estado: this.normalizeText(this.studentForm.estado),
      pais: this.normalizeText(this.studentForm.pais),
      metodo: this.normalizeText(this.studentForm.metodo),
      acta: this.normalizeDocumentValue(this.studentForm.acta),
      secundaria: this.normalizeDocumentValue(this.studentForm.secundaria),
      parcial: this.normalizeDocumentValue(this.studentForm.parcial),
      resolRevalidacion: this.normalizeDocumentValue(this.studentForm.resolRevalidacion),
      docCurp: this.normalizeDocumentValue(this.studentForm.docCurp),
      resolEquivalencia: this.normalizeDocumentValue(this.studentForm.resolEquivalencia),
      conducta: this.normalizeDocumentValue(this.studentForm.conducta),
      medico: this.normalizeDocumentValue(this.studentForm.medico),
      fotos: !!this.studentForm.fotos,
      vigente: !!this.studentForm.vigente,
      active: !!this.studentForm.active,
    };
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeDocumentValue(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }

    try {
      const parsed = JSON.parse(value);
      const normalized = {
        original: !!parsed?.original,
        copia: !!parsed?.copia,
      };

      if (!normalized.original && !normalized.copia) {
        return '';
      }

      return JSON.stringify(normalized);
    } catch {
      return '';
    }
  }

  private normalizeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeDate(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'string' && value.trim()) {
      return value.includes('T') ? value.split('T')[0] : value;
    }

    return new Date().toISOString().split('T')[0];
  }
}
