import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { alerts } from '../../../../helpers/alerts';
import { EmployeesService } from '../../../../service/employees.service';
import { TrackingService } from '../../../../service/tracking.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './employees.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Employees {
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public employeesService = inject(EmployeesService);
  public selectedUserId: number | string | null = null;
  public typePerson: string | null = null;

  idBranch: number = 0;
  notSavedChanges: boolean = false;

  constructor() {
    effect(() => {
      const branchId = Number(this.trackingService.getBranch()) || 0;
      this.idBranch = branchId;
      this.loadData();
    });
  }

  loadData() {
    const branchId = this.idBranch;
    if (branchId === 0) {
      this.rowData.set([]);
      return;
    }

    this.employeesService.getEmployees(branchId).subscribe({
      next: (response: any) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
        this.notSavedChanges = false;
        //console.log('Datos cargados correctamente:', data);
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
        alerts.basicAlert('Error', 'No fue posible cargar los empleados.', 'error');
      }
    });
  }

  protected readonly columnDefs = signal<ColDef[]>([
    {
      field: 'name',
      headerName: 'Nombre',
      filter: true,
      editable: true,
      pinned: 'left',
      width: 180,
      valueFormatter: params => params.value?.toUpperCase?.() ?? '',
    },
    {
      field: 'cedula',
      headerName: 'Cédula Profesional',
      filter: true,
      editable: true,
      width: 180,
      valueFormatter: params => params.value?.toUpperCase?.() ?? '',
    },
    {
      field: 'type',
      headerName: 'Tipo de trabajador',
      editable: true,
      width: 170,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['PERSONAL', 'PROFESOR'],
      },
    },
    /*{
      field: 'Horarios',
      headerName: 'Horarios',
      width: 120,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => this.createScheduleButton(params),
    },*/
    { field: 'phone', headerName: 'Teléfono', editable: true, width: 140 },
    { field: 'email', headerName: 'Correo electrónico', editable: true, width: 220 },
    { field: 'address', headerName: 'Dirección', editable: true, width: 220 },
    { field: 'neighborhood', headerName: 'Colonia', editable: true, width: 150 },
    { field: 'city', headerName: 'Ciudad', editable: true, width: 140 },
    { field: 'state', headerName: 'Estado', editable: true, width: 140 },
    { field: 'cp', headerName: 'C.P.', editable: true, width: 90 },
    {
      field: 'ingressDate',
      headerName: 'Fecha Ingreso',
      editable: true,
      filter: 'agDateColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      width: 150,
      cellEditor: 'agDateCellEditor',
      valueGetter: params => {
        if (!params.data?.ingressDate) {
          return new Date();
        }

        return params.data.ingressDate instanceof Date
          ? params.data.ingressDate
          : new Date(params.data.ingressDate);
      },
      valueSetter: params => {
        if (!params.newValue) {
          params.data.ingressDate = new Date();
          return true;
        }

        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);

        if (isNaN(date.getTime())) {
          alerts.basicAlert('Fecha inválida', 'Capture una fecha válida.', 'error');
          return false;
        }

        params.data.ingressDate = date;
        return true;
      },
      valueFormatter: params => this.formatDate(params.value),
    },
    { field: 'picture', headerName: 'Foto', editable: true, hide: true },
    {
      field: 'vigente',
      headerName: 'Vigente',
      editable: true,
      width: 90,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      valueFormatter: params => params.value ? 'Activo' : 'Inactivo',
      valueParser: params => {
        const value = String(params.newValue).toLowerCase();
        return value === 'true' || value === 'activo';
      },
    },
  ]);

  protected readonly rowData = signal<any[]>([]);

  public onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  public onCellDoubleClicked(event: CellDoubleClickedEvent) {
    //console.log('Celda seleccionada:', event.value);
  }

  public onCellValueChanged(event: CellValueChangedEvent) {
    if (!event.data?.__isNew) {
      event.data.__modified = true;
    }

    this.notSavedChanges = true;
    this.rowData.update(prev => [...prev]);
  }

  private createScheduleButton(params: ICellRendererParams): HTMLElement | null {
    if (params.data?.__isNew || !params.data?.id) {
      return null;
    }

    const button = document.createElement('button');
    button.className = 'bg-sky-500 hover:bg-sky-600 text-white px-3 py-1 rounded text-sm font-semibold';
    button.textContent = 'Horario';
    button.addEventListener('click', () => this.openSchedule(params.data.id, params.data.type));
    return button;
  }

  private formatDate(value: unknown): string {
    try {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value as string);
      if (isNaN(date.getTime())) return '';
      return `${`${date.getDate()}`.padStart(2, '0')}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${date.getFullYear()}`;
    } catch {
      return '';
    }
  }

  private cleanDataForServer(data: any) {
    const { __isNew, __modified, ...cleaned } = data;
    const normalizedIngressDate = cleaned.ingressDate
      ? (cleaned.ingressDate instanceof Date
        ? cleaned.ingressDate.toISOString()
        : new Date(cleaned.ingressDate).toISOString())
      : new Date().toISOString();

    return {
      ...cleaned,
      idBranch: cleaned.idBranch ?? this.idBranch,
      ingressDate: normalizedIngressDate,
    };
  }

  public openSchedule(userId: number | string, type: string) {
    this.selectedUserId = userId;
    this.typePerson = type;
    //console.log('Abrir horario para usuario:', { userId, type });
  }

  public addEmployee() {
    if (this.idBranch === 0) {
      alerts.basicAlert('Sucursal requerida', 'Selecciona una sucursal antes de agregar empleados.', 'warning');
      return;
    }

    const newEmployee = {
      id: 0,
      active: true,
      address: '',
      baseHours: 0,
      city: '',
      clockPassword: '',
      cp: '',
      email: '',
      employeeCode: '',
      idBranch: this.idBranch,
      idDepto: 0,
      idPosition: 0,
      ingressDate: new Date().toISOString(),
      name: '',
      type: 'PERSONAL',
      namebranch: '',
      neighborhood: '',
      phone: '',
      picture: '',
      priceXHour: 0,
      rfc: '',
      state: '',
      vigente: true,
      __isNew: true,
    };
    this.rowData.update(prev => [newEmployee, ...prev]);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'name' }), 100);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();

    const newRows = this.rowData().filter(row => row.__isNew);
    const modifiedRows = this.rowData().filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.name || !item.type);
    if (invalidNewRows.length > 0) {
      const invalidRow = invalidNewRows[0];
      const missingFields: string[] = [];
      if (!invalidRow.name) missingFields.push('Nombre');
      if (!invalidRow.type) missingFields.push('Tipo de trabajador');
      alerts.basicAlert('Validación - Nuevo Empleado', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    const invalidModifiedRows = modifiedRows.filter(item => !item.name || !item.type);
    if (invalidModifiedRows.length > 0) {
      const invalidRow = invalidModifiedRows[0];
      const missingFields: string[] = [];
      if (!invalidRow.name) missingFields.push('Nombre');
      if (!invalidRow.type) missingFields.push('Tipo de trabajador');
      alerts.basicAlert('Validación - Empleado Modificado', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Empleados',
          'Menu RH Empleados',
          this.trackingService.getEmail()
        );
        return this.employeesService.addEmployee(cleanedData);
      });

      const updateRequests = modifiedRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Empleados',
          'Menu RH Empleados',
          this.trackingService.getEmail()
        );
        return this.employeesService.updateEmployee(row.id, cleanedData);
      });

      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      setTimeout(() => this.loadData(), 500);
    } catch (error: any) {
      console.error('Error al guardar empleados:', error);
      let errorMessage = 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) errorMessage = error.error.message;
      else if (error?.status === 400) errorMessage = 'Error de validación: Verifique que todos los campos obligatorios estén completos.';
      else if (error?.status === 409) errorMessage = 'Conflicto: Ya existe un empleado con esos datos.';
      else if (error?.status === 500) errorMessage = 'Error del servidor: Contacte al administrador.';
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  public refreshData() {
    this.gridApi.stopEditing();
    this.loadData();
    //console.log('Informacion refrescada desde el servidor.');
  }

  public deleteSelected() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione un empleado para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.__isNew || id === 0) {
      this.rowData.update(prev => prev.filter(row => row !== selectedData));
      return;
    }

    alerts.confirmAlert('Eliminar empleado', '¿Está seguro que desea eliminar este empleado?', 'warning', 'Sí, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          this.employeesService.deleteEmployee(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar empleado:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Empleado eliminado satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Empleados',
              'Menu RH Empleados',
              this.trackingService.getEmail()
            );
            this.notSavedChanges = false;
          });
        }
      });
  }
}
