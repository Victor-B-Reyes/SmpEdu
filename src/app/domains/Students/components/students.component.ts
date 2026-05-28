import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { concat, lastValueFrom, toArray, forkJoin, Subject, takeUntil } from 'rxjs';
import KardexComponent from '../kardex/kardex.component';
import { TrackingService } from '../../../service/tracking.service';
import { UsersService } from '../../../service/users.service';
import { StudentsService } from '../../../service/student.service';
import { SignalsService } from '../../../service/signals.service';
import { CoursesService } from '../../../service/courses.service';
import { UsersxpermissionsService } from '../../../service/usersxpermissions.service';
import { alerts } from '../../../helpers/alerts';
import { StudentsPdfUtil } from './students-pdf.util';

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
  selector: 'app-students',
  standalone: true,
  imports: [AgGridAngular, FormsModule, KardexComponent],
  templateUrl: './students.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Students implements OnDestroy {
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public usersService = inject(UsersService);
  public studentService = inject(StudentsService);
  public signalsService = inject(SignalsService);
  public coursesService = inject(CoursesService);
  public usersxpermissionsService = inject(UsersxpermissionsService);
  private destroy$ = new Subject<void>();

  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);
  protected readonly idBranch = computed(() => this.signalsService.getBranchSelectedBySidebar() ?? 0);
  protected readonly coursesVigentes = signal<any[]>([]);
  idCourseSelected = signal<number>(this.signalsService.getCourseSelectedBySidebar() ?? 0);

  notSavedChanges = false;
  newlyAddedRows: any[] = [];
  isPrintModalOpen = signal(false);
  isDetailModalOpen = signal(false);
  isKardexModalOpen = signal(false);
  selectedKardexId = signal<number | null>(null);
  detailStudent: any = null;

  detailSections = signal<Record<SectionKey, boolean>>({
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

  printFilterGrade = signal<string>('');
  printFilterGroup = signal<string>('');
  printFilterCourse = signal<number>(0);

  constructor() {
    effect(() => {
      const branchId = this.idBranch();
      if (branchId > 0) {
        this.loadCourses(branchId);
        this.idCourseSelected.set(this.signalsService.getCourseSelectedBySidebar() ?? 0);
      } else {
        this.idCourseSelected.set(0);
      }
    });

    effect(() => {
      const branchId = this.idBranch();
      const courseId = this.idCourseSelected();

      if (branchId > 0) {
        this.loadData(branchId, courseId);
      } else {
        this.rowData.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(branchId: number, courseId: number) {
    if (branchId === 0) return;

    this.studentService.getStudents(branchId, courseId).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        console.log('Datos recibidos:', data);
        this.rowData.set(data);
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }

  loadCourses(branchId: number) {
    const userId = this.signalsService.idUser();

    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('course', userId),
      courses: this.coursesService.getCoursesVigentes(branchId)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const assigned = Array.isArray(res.permissions) ? res.permissions : (res.permissions?.data || []);
        const allCourses = Array.isArray(res.courses) ? res.courses : (res.courses?.data || []);

        let filteredCourses = [];
        if (assigned.some((p: any) => p.idPermission === 0)) {
          filteredCourses = allCourses;
        } else {
          filteredCourses = allCourses.filter((c: any) =>
            assigned.some((p: any) => p.idPermission === c.id)
          );
        }
        this.coursesVigentes.set(filteredCourses.filter((c: any) => c.vigente));
      },
      error: (error) => console.error('Error al cargar cursos con permisos:', error)
    });
  }

  protected readonly columnDefs = computed<ColDef[]>(() => {
    const courses = this.coursesVigentes();
    const coursesMap = courses.reduce((acc, c) => {
      acc[c.id.toString()] = c.name;
      return acc;
    }, {} as Record<string, string>);

    return [
      {
        field: 'vigente',
        headerName: 'Estado',
        width: 110,
        editable: true,
        pinned: 'left',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [true, false] },
        valueFormatter: params => params.value ? 'Activo' : 'Inactivo',
        valueParser: params => params.newValue === 'Activo'
      },
      { field: 'controlNumber', headerName: 'Numero de control', width: 140, pinned: 'left', editable: true },
      { field: 'firstName', headerName: 'Nombre', width: 150, pinned: 'left', editable: true },
      { field: 'lastNameFather', headerName: 'Apellido paterno', width: 170, editable: true },
      { field: 'lastNameMother', headerName: 'Apellido materno', width: 170, editable: true },
      { field: 'curp', headerName: 'CURP', width: 170, editable: true },
      {
        field: 'nacimiento',
        headerName: 'Nacimiento',
        editable: true,
        filter: 'agDateColumnFilter',
        filterParams: {
          defaultToNothingSelected: true,
        },
        width: 150,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          if (!params.data.nacimiento) {
            return new Date();
          }
          return params.data.nacimiento instanceof Date
            ? params.data.nacimiento
            : new Date(params.data.nacimiento);
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            params.data.nacimiento = new Date();
            return true;
          }

          const date = params.newValue instanceof Date
            ? params.newValue
            : new Date(params.newValue);

          if (isNaN(date.getTime())) {
            alerts.basicAlert('Error', 'Fecha invalida', 'error');
            return false;
          }

          params.data.nacimiento = date;
          return true;
        },
        valueFormatter: (params) => {
          try {
            if (!params.value) return '';
            const date = params.value instanceof Date ? params.value : new Date(params.value);
            if (isNaN(date.getTime())) return '';
            return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
          } catch {
            return '';
          }
        },
      },
      { field: 'grade', headerName: 'Grado', width: 80, editable: true },
      { field: 'group', headerName: 'Grupo', width: 80, editable: true },
      {
        field: 'idCourses',
        headerName: 'Carrera / Programa',
        width: 220,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: courses.map(c => c.id),
        },
        refData: coursesMap
      },
      { field: 'email', headerName: 'Correo', width: 220, editable: true },
      { field: 'phone', headerName: 'Telefono', width: 130, editable: true },
      { field: 'bloodType', headerName: 'Tipo de sangre', width: 110, editable: true },
      {
        colId: 'acciones',
        headerName: 'Acciones',
        width: 100,
        cellRenderer: () => {
          return `<div class="flex items-center justify-center h-full cursor-pointer text-indigo-600 hover:text-indigo-800" title="Ver Kárdex">
                    <i class="bi bi-mortarboard-fill text-xl"></i>
                  </div>`;
        },
        onCellClicked: (params) => this.openKardexModal(params.data),
        pinned: 'right',
        sortable: false,
        filter: false,
        editable: false
      }
    ];
  });

  protected readonly rowData = signal<any[]>([]);

  public onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  public onCellValueChanged(event: CellValueChangedEvent) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.notSavedChanges = true;
    this.rowData.update(prev => [...prev]);
  }

  public onCellDoubleClicked(event: CellDoubleClickedEvent) {
    // Evitar que el doble clic abra el modal de edición si se interactúa con la columna de acciones
    if (event.column.getColId() === 'acciones') {
      return;
    }
    if (event.data) {
      this.openDetailModal(event.data);
    }
  }

  public addStudent() {
    const newStudent = {
      id: 0,
      idCampus: this.idBranch(),
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
      group: '',
      idCourses: 0,
      internetPassword: '',
      email: '',
      phone: '',
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
      __modified: false,
      __isNew: true
    };
    this.rowData.update(prev => [newStudent, ...prev]);
    this.notSavedChanges = true;
    this.openDetailModal(newStudent, true);
  }

  public openSelectedDetail() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Detalle', 'Seleccione un alumno para abrir el detalle.', 'info');
      return;
    }

    this.openDetailModal(selectedNodes[0].data);
  }

  public openDetailModal(student: any, expandAcademic = false) {
    this.detailStudent = student;
    this.detailSections.set({
      academic: expandAcademic || true,
      origin: false,
      location: false,
      family: false,
      medical: false,
      fiscal: false,
      documents: false,
    });
    this.isDetailModalOpen.set(true);
  }

  public openKardexModal(student: any) {
    this.selectedKardexId.set(student.id);
    this.isKardexModalOpen.set(true);
  }

  public closeKardexModal() {
    this.isKardexModalOpen.set(false);
    this.selectedKardexId.set(null);
  }

  public closeDetailModal() {
    this.detailStudent = null;
    this.isDetailModalOpen.set(false);
  }

  public saveDetailModal() {
    if (!this.detailStudent) return;

    if (!this.detailStudent.controlNumber || !this.detailStudent.firstName || !this.detailStudent.lastNameFather || !this.detailStudent.idCourses) {
      alerts.basicAlert('Validacion', 'El numero de control, nombre, apellido paterno y carrera son obligatorios.', 'warning');
      return;
    }

    const isNewStudent = !!this.detailStudent.__isNew;
    const payload = this.cleanDataForServer(this.detailStudent);
    payload.idCampus = this.idBranch();

    const request = isNewStudent
      ? this.studentService.addStudents(payload)
      : this.studentService.updateStudents(this.detailStudent.id, payload);

    request.subscribe({
      next: (response: any) => {
        const savedStudent = response?.data ?? response ?? payload;

        Object.assign(this.detailStudent, savedStudent, {
          __isNew: false,
          __modified: false,
        });

        this.notSavedChanges = false;
        this.rowData.update(prev => [...prev]);
        this.closeDetailModal();
        this.loadData(this.idBranch(), this.idCourseSelected());

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          isNewStudent ? 'Add Alumno desde detalle' : 'Update Alumno desde detalle',
          'Menu Estudiantes',
          this.trackingService.getEmail()
        );

        alerts.basicAlert('Registro exitoso', 'Los datos del alumno se actualizaron correctamente.', 'success');
      },
      error: (error) => {
        console.error('Error al guardar alumno desde detalle:', error);
        const msg = error.error?.message || 'No se pudo guardar la informacion del alumno.';
        alerts.basicAlert('Error', msg, 'error');
      }
    });
  }

  public toggleDetailSection(section: SectionKey) {
    this.detailSections.update((sections) => ({
      ...sections,
      [section]: !sections[section]
    }));
  }

  public toggleDetailDocument(field: DocumentFieldKey, documentType: DocumentToggleKey) {
    if (!this.detailStudent) return;

    const current = this.getDetailDocumentState(field);
    current[documentType] = !current[documentType];
    this.detailStudent[field] = this.serializeDocumentState(current);
  }

  public isDetailDocumentSelected(field: DocumentFieldKey, documentType: DocumentToggleKey): boolean {
    return this.getDetailDocumentState(field)[documentType];
  }

  public toggleDetailFotosOriginal() {
    if (!this.detailStudent) return;
    this.detailStudent.fotos = !this.detailStudent.fotos;
  }

  public getDateInputValue(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    const normalized = String(value);
    if (normalized.includes('T')) {
      return normalized.split('T')[0];
    }

    return normalized;
  }

  public setDetailNacimiento(value: string) {
    if (!this.detailStudent) return;
    this.detailStudent.nacimiento = value;
  }

  public async saveChanges() {
    this.gridApi.stopEditing();

    const allRows: any[] = [];
    this.gridApi.forEachNode(node => {
      if (node.data) allRows.push(node.data);
    });

    const newRows = allRows.filter(row => row.__isNew);
    const modifiedRows = allRows.filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Informacion', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.controlNumber || !item.firstName || !item.lastNameFather || !item.idCourses);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validacion', 'El numero de control, nombre, apellido paterno y carrera son obligatorios.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Alumno', 'Menu Estudiantes', this.trackingService.getEmail());
        return this.studentService.addStudents(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Update Alumno', 'Menu Estudiantes', this.trackingService.getEmail());
        return this.studentService.updateStudents(row.id, cleanedData);
      });

      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(this.idBranch(), this.idCourseSelected()), 500);
    } catch (error: any) {
      console.error('Error al guardar estudiantes:', error);
      let errorMessage = 'Ocurrio un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) errorMessage = error.error.message;
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  private cleanDataForServer(data: any) {
    const { __isNew, __modified, ...cleaned } = data;
    cleaned.acta = this.normalizeDocumentValue(cleaned.acta);
    cleaned.secundaria = this.normalizeDocumentValue(cleaned.secundaria);
    cleaned.parcial = this.normalizeDocumentValue(cleaned.parcial);
    cleaned.resolRevalidacion = this.normalizeDocumentValue(cleaned.resolRevalidacion);
    cleaned.docCurp = this.normalizeDocumentValue(cleaned.docCurp);
    cleaned.resolEquivalencia = this.normalizeDocumentValue(cleaned.resolEquivalencia);
    cleaned.conducta = this.normalizeDocumentValue(cleaned.conducta);
    cleaned.medico = this.normalizeDocumentValue(cleaned.medico);
    cleaned.fotos = !!cleaned.fotos;
    return cleaned;
  }

  private getDetailDocumentState(field: DocumentFieldKey): DocumentState {
    return this.parseDocumentState(this.detailStudent?.[field]);
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

  private normalizeDocumentValue(value: unknown): string {
    return this.serializeDocumentState(this.parseDocumentState(value));
  }

  public refreshData() {
    this.gridApi.stopEditing();
    const branchId = this.idBranch();
    const courseId = this.idCourseSelected();
    if (branchId > 0) {
      this.loadData(branchId, courseId);
    }
  }

  public deleteSelected() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione un alumno para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.__isNew || id === 0) {
      this.rowData.update(prev => prev.filter(row => row !== selectedData));
      return;
    }

    alerts.confirmAlert(
      'Eliminar alumno',
      `Esta seguro que desea eliminar a ${selectedData.firstName} ${selectedData.lastNameFather ?? ''} ${selectedData.lastNameMother ?? ''}?`,
      'warning',
      'Si, eliminar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.studentService.deleteStudents(id).subscribe({
          next: () => {
            alerts.basicAlert('Eliminado', 'El alumno ha sido eliminado correctamente.', 'success');
            this.loadData(this.idBranch(), this.idCourseSelected());
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              `Delete Alumno: ${selectedData.firstName} ${selectedData.lastNameFather ?? ''} ${selectedData.lastNameMother ?? ''}`,
              'Menu Estudiantes',
              this.trackingService.getEmail()
            );
            this.notSavedChanges = false;
          },
          error: (error) => {
            console.error('Error al eliminar alumno:', error);
            alerts.basicAlert('Error', 'Ocurrio un error al intentar eliminar el registro.', 'error');
          }
        });
      }
    });
  }

  public openPrintModal() {
    this.isPrintModalOpen.set(true);
  }

  public closePrintModal() {
    this.isPrintModalOpen.set(false);
  }

  public confirmPrint() {
    const filterModel: any = {};

    if (this.printFilterGrade()) {
      filterModel.grade = { filterType: 'text', type: 'contains', filter: this.printFilterGrade() };
    }
    if (this.printFilterGroup()) {
      filterModel.group = { filterType: 'text', type: 'contains', filter: this.printFilterGroup() };
    }
    if (this.printFilterCourse() != 0) {
      filterModel.idCourses = { filterType: 'number', type: 'equals', filter: Number(this.printFilterCourse()) };
    }

    this.studentService.getListStudents(
      this.idBranch(),
      this.idCourseSelected(),
      this.printFilterGrade(),
      this.printFilterGroup()
    ).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);

        if (data.length === 0) {
          alerts.basicAlert('Sin datos', 'No se encontraron alumnos con los filtros seleccionados', 'info');
          return;
        }

        StudentsPdfUtil.generateStudentsListPDF(data);
      },
      error: (error) => {
        console.error('Error en la solicitud de impresion:', error);
        alerts.basicAlert('Error', 'No se pudieron obtener los datos para generar el PDF', 'error');
      }
    });

    this.gridApi.setFilterModel(filterModel);
    this.closePrintModal();
  }
}
