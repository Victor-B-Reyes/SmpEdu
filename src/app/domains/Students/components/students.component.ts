import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { concat, lastValueFrom, toArray, forkJoin, Subject, takeUntil } from 'rxjs';
import { TrackingService } from '../../../service/tracking.service';
import { UsersService } from '../../../service/users.service';
import { StudentsService } from '../../../service/student.service';
import { SignalsService } from '../../../service/signals.service';
import { CoursesService } from '../../../service/courses.service';
import { UsersxpermissionsService } from '../../../service/usersxpermissions.service';
import { alerts } from '../../../helpers/alerts';
import { StudentsPdfUtil } from './students-pdf.util';


@Component({
  selector: 'app-students',
  standalone: true,
  imports: [AgGridAngular, FormsModule],
  templateUrl: './students.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Students implements OnDestroy {
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public usersService = inject(UsersService);
  public studentService = inject(StudentsService);
  public signalsService = inject(SignalsService);
  public coursesService = inject(CoursesService);
  public usersxpermissionsService = inject(UsersxpermissionsService);
  private destroy$ = new Subject<void>();
  
  // Usamos computed para que los IDs sean reactivos al sidebar y persistan correctamente
  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);
  protected readonly idBranch = computed(() => this.signalsService.getBranchSelectedBySidebar() ?? 0);
  protected readonly coursesVigentes = signal<any[]>([]);
  idCourseSelected = signal<number>(this.signalsService.getCourseSelectedBySidebar() ?? 0);

  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];
  isPrintModalOpen = signal(false);

  // Filtros para impresión
  printFilterGrade = signal<string>('');
  printFilterGroup = signal<string>('');
  printFilterCourse = signal<number>(0);

  constructor() {
    // Effect para cargar cursos y establecer el idCourseSelected inicial cuando cambia la sucursal.
    effect(() => {
      const branchId = this.idBranch();
      if (branchId > 0) {
        this.loadCourses(branchId);
        // Inicializa idCourseSelected cuando la sucursal cambia, o desde localStorage
        this.idCourseSelected.set(this.signalsService.getCourseSelectedBySidebar() ?? 0);
      } else {
        this.idCourseSelected.set(0); // Reiniciar si no hay sucursal seleccionada
      }
    });

    // Nuevo effect para cargar los datos de los estudiantes cuando idBranch o idCourseSelected cambian.
    effect(() => {
      const branchId = this.idBranch();
      const courseId = this.idCourseSelected(); // Esto hace que el effect reaccione a los cambios de idCourseSelected
      
      if (branchId > 0) {
        this.loadData(branchId, courseId);
      } else {
        this.rowData.set([]); // Limpiar datos si no hay sucursal seleccionada
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(branchId: number, courseId: number) { // Pasar courseId explícitamente
    if (branchId === 0) return;

    this.studentService.getStudents(branchId, courseId).subscribe({
      next: (response) => {
        // Actualizamos rowData con la respuesta del servidor para que el grid se refresque
        const data = Array.isArray(response) ? response : (response?.data || []);
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
        // Si el usuario tiene el permiso global 0, mostramos todos los cursos vigentes
        if (assigned.some((p: any) => p.idPermission === 0)) {
          filteredCourses = allCourses;
        } else {
          // De lo contrario, filtramos los cursos vigentes por los IDs permitidos
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
    // Creamos un mapa de ID -> Nombre para que AG Grid muestre el texto en lugar del ID numérico
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
    { field: 'firstName', headerName: 'Nombre', width: 150,  pinned: 'left', editable: true },
    { field: 'lastName', headerName: 'Apellidos', width: 180, editable: true },
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
    { field: 'internetPassword', headerName: 'Clave de Internet', width: 150, editable: true },
    { field: 'email', headerName: 'Correo', width: 220, editable: true },
    { field: 'phone', headerName: 'Telefono', width: 130, editable: true },
    { field: 'emergencyContact', headerName: 'Contacto de emergencia', width: 200, editable: true },
    { field: 'emergencyPhone', headerName: 'Telefono de emergencia', width: 160, editable: true },
    { field: 'address', headerName: 'Dirección', width: 250, editable: true },
    { field: 'bloodType', headerName: 'Tipo de sangre', width: 110, editable: true },
    ];
  });

  
  protected readonly rowData = signal<any[]>([]);

  public onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  public onCellValueChanged(event: CellValueChangedEvent) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      //console.log('Fila marcada como modificada:', event.data);
    }
    this.notSavedChanges = true;
    // Forzamos la actualización del Signal para que Angular detecte la mutación del objeto
    this.rowData.update(prev => [...prev]);
  }

  public onCellDoubleClicked(event: CellDoubleClickedEvent) {
    //console.log('Celda seleccionada:', event.value);
  }

  public addStudent() {
    const newStudent = {
      id: 0,
      idCampus: this.idBranch(), // Se cambió de idBranch a idCampus para coincidir con la expectativa del backend
      controlNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      educationLevel: '',
      grade: 1,
      group: '',
      idCourses: 0,
      internetPassword: '',
      phone: '',
      emergencyContact: '',
      emergencyPhone: '',
      address: '',
      bloodType: '',
      vigente: true,
      active: true,
      __modified: false,
      __isNew: true
    };
    this.rowData.update(prev => [newStudent, ...prev]);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'controlNumber' }), 100);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();

    // Extraemos los datos directamente del API del Grid para asegurar sincronización total
    const allRows: any[] = [];
    this.gridApi.forEachNode(node => {
      if (node.data) allRows.push(node.data);
    });

    const newRows = allRows.filter(row => row.__isNew);
    const modifiedRows = allRows.filter(row => row.__modified && !row.__isNew);

    //console.log('Resumen de cambios - Nuevos:', newRows.length, 'Modificados:', modifiedRows.length);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.controlNumber || !item.firstName || !item.lastName || !item.idCourses);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validación', 'El número de control, nombre, apellidos y carrera son obligatorios.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Alumno', 'Menú Estudiantes', this.trackingService.getEmail());
        return this.studentService.addStudents(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        //console.log('Enviando actualización para Alumno ID:', row.id, cleanedData);
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Update Alumno', 'Menú Estudiantes', this.trackingService.getEmail());
        return this.studentService.updateStudents(row.id, cleanedData);
      });

      // Ejecutamos todas las peticiones (POST y PUT) de forma secuencial
      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(this.idBranch(), this.idCourseSelected()), 500);

    } catch (error: any) {
      console.error('Error al guardar estudiantes:', error);
      let errorMessage = 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) errorMessage = error.error.message;
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  private cleanDataForServer(data: any) {
    const { __isNew, __modified, ...cleaned } = data;
    return cleaned;
  }

  public refreshData() {
    this.gridApi.stopEditing();
    // Simulamos una recarga de datos restableciendo el signal al estado inicial
    //console.log('Información refrescada desde el origen de datos.');
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

    // Si es una fila nueva no guardada en DB, solo la quitamos localmente
    if (selectedData.__isNew || id === 0) {
      this.rowData.update(prev => prev.filter(row => row !== selectedData));
      return;
    }

    alerts.confirmAlert('Eliminar alumno', `¿Está seguro que desea eliminar a ${selectedData.firstName} ${selectedData.lastName}?`, 'warning', 'Sí, eliminar')
      .then((result) => {
        if (result.isConfirmed) {
          this.studentService.deleteStudents(id).subscribe({
            next: () => {
              alerts.basicAlert('Eliminado', 'El alumno ha sido eliminado correctamente.', 'success');
              this.loadData(this.idBranch(), this.idCourseSelected());
              this.trackingService.addLog(
                this.trackingService.getnameComp(),
                `Delete Alumno: ${selectedData.firstName} ${selectedData.lastName}`,
                'Menú Estudiantes',
                this.trackingService.getEmail()
              );
              this.notSavedChanges = false;
            },
            error: (error) => {
              console.error('Error al eliminar alumno:', error);
              alerts.basicAlert('Error', 'Ocurrió un error al intentar eliminar el registro.', 'error');
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

    // Llamamos al servicio para obtener la lista filtrada
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
        console.error('Error en la solicitud de impresión:', error);
        alerts.basicAlert('Error', 'No se pudieron obtener los datos para generar el PDF', 'error');
      }
    });

    this.gridApi.setFilterModel(filterModel);
    this.closePrintModal();
  }
}
