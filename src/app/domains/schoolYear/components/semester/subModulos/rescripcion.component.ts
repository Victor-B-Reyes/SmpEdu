import { ChangeDetectionStrategy, Component, effect, inject, signal, computed } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { TrackingService } from '../../../../../service/tracking.service';
import { SignalsService } from '../../../../../service/signals.service';
import { UsersxpermissionsService } from '../../../../../service/usersxpermissions.service';
import { alerts } from '../../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, tap, toArray } from 'rxjs';
import { SchoolYearService } from '../../../../../service/schoolYear.service';
import { InegiService } from '../../../../../service/inegi.service';

@Component({
  selector: 'app-rescripcion',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './rescripcion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export default class Rescripcion {
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);
  public schoolYearService = inject(SchoolYearService);
  public inegiService = inject(InegiService);

  // Usamos computed para evitar que el ID se pierda y sea reactivo al sidebar
  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);
  
  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];

  constructor() {
    effect(() => {
      const currentId = this.idCompany();
      if (currentId > 0) {
        this.loadData(currentId);
      }
    });
  }

  loadData(companyId?: number) {
    const id = companyId ?? this.idCompany();
    if (id === 0) return;

    this.schoolYearService.getSchoolYear(id).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }
  
  protected readonly columnDefs = signal<ColDef[]>([
    {
      field: 'comment',
      headerName: 'Nombre del ciclo escolar',
      editable: true,
      filter: true,
      flex: 2,
      valueSetter: (params) => {
        const rawValue = params.newValue;
        if (!rawValue || typeof rawValue !== 'string') {
          alerts.basicAlert('Campo requerido', 'El comentario es obligatorio', 'error');
          return false;
        }
        const normalizedValue = rawValue.trim().toUpperCase();
        if (params.data) {
          params.data[params.colDef.field!] = normalizedValue;
        }
        return true;
      },
    },
    {
      field: 'startDate',
      headerName: 'Fecha Inicio',
      editable: true,
      filter: 'agDateColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      width: 150,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data.startDate) {
          return new Date();
        }
        return params.data.startDate instanceof Date
          ? params.data.startDate
          : new Date(params.data.startDate);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.startDate = new Date();
          return true;
        }

        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);

        if (isNaN(date.getTime())) {
          alerts.basicAlert('Error', 'Fecha inválida', 'error');
          return false;
        }

        params.data.startDate = date;
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
    {
      field: 'endDate',
      headerName: 'Fecha Fin',
      editable: true,
      filter: 'agDateColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      width: 150,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data.endDate) {
          return new Date();
        }
        return params.data.endDate instanceof Date
          ? params.data.endDate
          : new Date(params.data.endDate);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.endDate = new Date();
          return true;
        }

        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);

        if (isNaN(date.getTime())) {
          alerts.basicAlert('Error', 'Fecha inválida', 'error');
          return false;
        }

        params.data.endDate = date;
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
    {
      field: 'vigente',
      headerName: 'Vigente',
      editable: true,
      width: 100,
      cellEditor: 'agCheckboxCellEditor',
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
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.notSavedChanges = true;
      // Forzamos la actualización del Signal para que Angular detecte la mutación del objeto
      this.rowData.update(prev => [...prev]);
    }
  }

  public addData() {
    const newData = {
      id: 0,
      idCompany: this.idCompany(),
      comment: '',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      vigente: true,
      active: true,
    };
    const rowWithFlags = { ...newData, __isNew: true };
    this.rowData.update(prev => [rowWithFlags, ...prev]);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'comment' }), 100);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();
    
    const newRows = this.rowData().filter(row => row.__isNew);
    const modifiedRows = this.rowData().filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.comment || !item.startDate || !item.endDate);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validación', 'El comentario y las fechas son obligatorias.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Ciclos Escolares',
          'Menu Configuración Ciclos',
          this.trackingService.getEmail()
        );
        return this.schoolYearService.addSchoolYear(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Ciclos Escolares',
          'Menu Configuración Ciclos',
          this.trackingService.getEmail()
        );
        return this.schoolYearService.updateSchoolYear(row.id, cleanedData);
      });

      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(), 500);

    } catch (error: any) {
      console.error('Error al guardar sucursales:', error);
      let errorMessage = 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) errorMessage = error.error.message;
      else if (error?.status === 400) errorMessage = 'Error de validación: Verifique que todos los campos obligatorios estén completos.';
      else if (error?.status === 409) errorMessage = 'Conflicto: El correo electrónico ya está en uso.';
      else if (error?.status === 500) errorMessage = 'Error del servidor: Contacte al administrador.';
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  public refreshData() {
    this.gridApi.stopEditing();
    this.loadData();
    //console.log('Información refrescada desde el servidor.');
  }

  public deleteSelected() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    // Si es una fila nueva no guardada en DB, solo la quitamos del signal localmente
    if (selectedData.__isNew || id === 0) {
      this.rowData.update(prev => prev.filter(row => row !== selectedData));
      return;
    }

    alerts.confirmAlert('Eliminar sucursal', '¿Está seguro que desea eliminar esta sucursal?', 'warning', 'Sí, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          this.schoolYearService.deleteSchoolYear(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar año escolar:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Sucursales',
              'Menu Configuración Sucursales',
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
}
