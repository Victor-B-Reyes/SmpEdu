import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, OnDestroy, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Students } from '../../../../../interface/students';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { TrackingService } from '../../../../../service/tracking.service';
import { SignalsService } from '../../../../../service/signals.service';
import { UsersxpermissionsService } from '../../../../../service/usersxpermissions.service';
import { alerts } from '../../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, forkJoin, Subject, takeUntil, switchMap, tap } from 'rxjs';
import { SchoolYearService } from '../../../../../service/schoolYear.service';
import { StudentsService } from '../../../../../service/student.service';
import { InegiService } from '../../../../../service/inegi.service';
import { RegisAndReService } from '../../../../../service/regisAndRe.service';
import { CoursesService } from '../../../../../service/courses.service';
type SectionKey = 'academic' | 'origin' | 'location' | 'family' | 'medical' | 'fiscal' | 'documents';
type DocumentFieldKey =
  | 'acta'
  | 'secundaria'
  | 'parcial'
  | 'resolRevalidacion'
  | 'docCurp'
  | 'resolEquivalencia'
  | 'conducta'
  | 'medico';
type DocumentToggleKey = 'original' | 'copia';
type DocumentState = Record<DocumentToggleKey, boolean>;

@Component({
  selector: 'app-inscripcion',
  standalone: true,
  imports: [AgGridAngular, FormsModule],
  templateUrl: './inscripcion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Inscripcion implements OnDestroy {
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);
  public schoolYearService = inject(SchoolYearService);
  public inegiService = inject(InegiService);
  public studentService = inject(StudentsService);
  public coursesService = inject(CoursesService);
  public regisAndReService = inject(RegisAndReService); 

  private destroy$ = new Subject<void>();

  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);
  protected readonly idBranch = computed(() => this.signalsService.getBranchSelectedBySidebar() ?? 0);

  idSemester = input<number>(0);
  notSavedChanges = false;
  newlyAddedRows: any[] = [];
  isModalOpen = signal(false);
  monto = signal<number>(0);
  protected readonly coursesVigentes = signal<any[]>([]);

  openSections = signal<{
    academic: boolean;
    origin: boolean;
    location: boolean;
    family: boolean;
    medical: boolean;
    fiscal: boolean;
    documents: boolean;
  }>({
    academic: true,
    origin: false,
    location: false,
    family: false,
    medical: false,
    fiscal: false,
    documents: false,
  });
  public readonly documentFields: Array<{ key: DocumentFieldKey; label: string }> = [
    { key: 'acta', label: 'Acta' },
    { key: 'secundaria', label: 'Secundaria' },
    { key: 'parcial', label: 'Parcial' },
    { key: 'resolRevalidacion', label: 'Resol. revalidacion' },
    { key: 'docCurp', label: 'CURP' },
    { key: 'resolEquivalencia', label: 'Resol. equivalencia' },
    { key: 'conducta', label: 'Conducta' },
    { key: 'medico', label: 'Certificado medico' },
  ];

  public studentForm: Students = this.createEmptyStudentForm();

  constructor() {
    effect(() => {
      const currentId = this.idCompany();
      const semesterId = this.idSemester(); // Rastreamos el cambio de semestre
      
      console.log('DEBUG - Inscripcion detectó Semestre:', semesterId);

      if (currentId > 0 && semesterId > 0) {
        this.loadData(currentId);
      }

      const branchId = this.idBranch();
      const userId = this.signalsService.idUser();

      if (branchId > 0) {
        forkJoin({
          permissions: this.usersxrootService.getUsersxPermissionsGeneral('course', userId),
          courses: this.coursesService.getCoursesVigentes(branchId),
        }).pipe(takeUntil(this.destroy$)).subscribe({
          next: (res) => {
            const assigned = Array.isArray(res.permissions) ? res.permissions : (res.permissions?.data || []);
            const allCourses = Array.isArray(res.courses) ? res.courses : (res.courses?.data || []);

            let filteredCourses = [];
            if (assigned.some((p: any) => p.idPermission === 0)) {
              filteredCourses = [
                { id: 0, abreviatura: 'TODAS' },
                ...allCourses,
              ];
            } else {
              filteredCourses = allCourses.filter((c: any) =>
                assigned.some((p: any) => p.idPermission === c.id)
              );
            }

            this.coursesVigentes.set(filteredCourses);
          },
          error: (err) => {
            console.error('Error al obtener cursos en inscripcion:', err);
            this.coursesVigentes.set([]);
          },
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(companyId?: number) {
    const id = companyId ?? this.idCompany();
    // Validamos que tengamos un semestre seleccionado antes de cargar
    if (id === 0 || this.idSemester() === 0) return;

    this.regisAndReService.getRegisAndRe(this.idSemester(), 'INSCRIPCION').subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
        console.log('Inscripciones cargadas:', this.rowData());
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
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
      headerName: 'Monto Inscripción',
      width: 140,
      valueFormatter: (params) => params.value ? `$${params.value}` : '$0.00',
    },
  ]);

  protected readonly rowData = signal<any[]>([]);

  public onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  public onCellDoubleClicked(_event: CellDoubleClickedEvent) {
  }

  public onCellValueChanged(event: CellValueChangedEvent) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.notSavedChanges = true;
      this.rowData.update((prev) => [...prev]);
    }
  }

  public addData() {
    this.openSections.set({
      academic: true,
      origin: false,
      location: false,
      family: false,
      medical: false,
      fiscal: false,
      documents: false,
    });

    this.monto.set(0);
    this.studentForm = this.createEmptyStudentForm(this.idBranch());
    this.isModalOpen.set(true);
  }

  public confirmAddStudent() {
    if (!this.studentForm.controlNumber || !this.studentForm.firstName || !this.studentForm.lastNameFather || !this.studentForm.idCourses) {
      alerts.basicAlert('Campos incompletos', 'Por favor, rellene Numero de Control, Nombre, Apellido Paterno y Curso.', 'warning');
      return;
    }

    const payload = this.buildStudentPayload();

    this.studentService.addStudents(payload).pipe(
      switchMap((response: any) => {
        const studentId = response?.data?.id || response?.id || 0;
        
        if (studentId === 0) throw new Error('No se pudo obtener el ID del estudiante');

        return this.regisAndReService.addRegisAndRe({
            id: 0,
            idSemester: this.idSemester(),
            idStudent: studentId,
            monto: this.monto(),
            type: 'INSCRIPCION',
            active: true
        }).pipe(
          tap(() => {
            alerts.basicAlert('Registro exitoso', 'El estudiante ha sido inscrito correctamente.', 'success');
            this.closeModal();
            this.loadData();
            
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              `Inscripcion de alumno: ${payload.firstName} ${payload.lastNameFather}`,
              'Modulo Inscripcion',
              this.trackingService.getEmail()
            );
          })
        );
      }),
      catchError((error) => {
        console.error('Error en el proceso de inscripcion:', error);
        const msg = error.error?.message || 'No se pudo realizar la inscripcion. Intente de nuevo.';
        alerts.basicAlert('Error', msg, 'error');
        return EMPTY;
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  public toggleSection(section: SectionKey) {
    this.openSections.update((sections) => ({
      ...sections,
      [section]: !sections[section],
    }));
  }

  public toggleDocument(field: DocumentFieldKey, documentType: DocumentToggleKey) {
    const current = this.getDocumentState(field);
    current[documentType] = !current[documentType];
    this.studentForm[field] = this.serializeDocumentState(current);
  }

  public isDocumentSelected(field: DocumentFieldKey, documentType: DocumentToggleKey): boolean {
    return this.getDocumentState(field)[documentType];
  }

  public toggleFotosOriginal() {
    this.studentForm.fotos = !this.studentForm.fotos;
  }

  public closeModal() {
    this.isModalOpen.set(false);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();

    const newRows = this.rowData().filter((row) => row.__isNew);
    const modifiedRows = this.rowData().filter((row) => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Informacion', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter((item) => !item.comment || !item.startDate || !item.endDate);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validacion', 'El comentario y las fechas son obligatorias.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Ciclos Escolares',
          'Menu Configuracion Ciclos',
          this.trackingService.getEmail()
        );
        return this.schoolYearService.addSchoolYear(cleanedData);
      });

      const updateRequests = modifiedRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Ciclos Escolares',
          'Menu Configuracion Ciclos',
          this.trackingService.getEmail()
        );
        return this.schoolYearService.updateSchoolYear(row.id, cleanedData);
      });

      const results = await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));
      console.log('Resultados de las operaciones:', results);
      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(), 500);
    } catch (error: any) {
      console.error('Error al guardar sucursales:', error);
      let errorMessage = 'Ocurrio un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) errorMessage = error.error.message;
      else if (error?.status === 400) errorMessage = 'Error de validacion: Verifique que todos los campos obligatorios esten completos.';
      else if (error?.status === 409) errorMessage = 'Conflicto: El correo electronico ya esta en uso.';
      else if (error?.status === 500) errorMessage = 'Error del servidor: Contacte al administrador.';
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  public refreshData() {
    this.gridApi.stopEditing();
    this.loadData();
  }

  public deleteSelected() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.__isNew || id === 0) {
      this.rowData.update((prev) => prev.filter((row) => row !== selectedData));
      return;
    }

    alerts.confirmAlert('Eliminar sucursal', 'Esta seguro que desea eliminar esta sucursal?', 'warning', 'Si, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          this.schoolYearService.deleteSchoolYear(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar ano escolar:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Sucursales',
              'Menu Configuracion Sucursales',
              this.trackingService.getEmail()
            );
            this.notSavedChanges = false;
          });
        }
      });
  }

  private cleanDataForServer(data: any) {
    const { __isNew, __modified, ...cleaned } = data;
    return cleaned;
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
      emergencyContact: '',
      emergencyPhone: '',
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

  private getDocumentState(field: DocumentFieldKey): DocumentState {
    return this.parseDocumentState(this.studentForm[field]);
  }

  private parseDocumentState(value: unknown): DocumentState {
    const emptyState: DocumentState = { original: false, copia: false };

    if (typeof value !== 'string' || !value.trim()) {
      return emptyState;
    }

    try {
      const parsed = JSON.parse(value);
      return {
        original: !!parsed?.original,
        copia: !!parsed?.copia,
      };
    } catch {
      return emptyState;
    }
  }

  private serializeDocumentState(state: DocumentState): string {
    if (!state.original && !state.copia) {
      return '';
    }

    return JSON.stringify(state);
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeDocumentValue(value: unknown): string {
    return this.serializeDocumentState(this.parseDocumentState(value));
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
      return value;
    }

    return new Date().toISOString().split('T')[0];
  }
}
