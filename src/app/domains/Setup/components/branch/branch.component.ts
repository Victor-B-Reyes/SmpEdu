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
import { TrackingService } from '../../../../service/tracking.service';
import { SignalsService } from '../../../../service/signals.service';
import { UsersxpermissionsService } from '../../../../service/usersxpermissions.service';
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, tap, toArray } from 'rxjs';
import { BranchsService } from '../../../../service/branchs.service';
import { InegiService } from '../../../../service/inegi.service';
import { States } from '../../../../interface/states';

@Component({
  selector: 'app-branch',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './branch.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Branch {
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);
  public branchsService = inject(BranchsService);
  public inegiService = inject(InegiService);

  idCompany:number = 0;
  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];
  estados: any[] = [];

  constructor() {
    effect(() => {
      // Obtenemos el ID de la empresa seleccionada desde el signal del sidebar
      this.idCompany = this.signalsService.getRootSelectedBySidebar() ?? 0;
      this.loadData();
      this.obtenerEstados();
    });
  }
  obtenerEstados() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado, index) => ({
          ...estado,
          id: index + 1,
        }));
      },
      error: (error) => {
        console.error('Error fetching states', error);
      },
    });
  }
  loadData() {
    if (this.idCompany === 0) return;

    this.branchsService.getBranches(this.idCompany).subscribe({
      next: (response) => {
        // Actualizamos rowData con la respuesta del servidor para que el grid se refresque
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
        //console.log('Datos cargados correctamente:', data);
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }
  
  protected readonly columnDefs = signal<ColDef[]>([
    {
      field: 'name',
      headerName: 'Nombre *',
      editable: (params) => {
        if (params.data?.__isNew) {
          return true;
        }
        return true
      },
      filter: true,
      width: 250,
      valueSetter: (params) => {
        const rawValue = params.newValue;
        if (!rawValue || typeof rawValue !== 'string') {
          alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
          return false;
        }

        const normalizedValue = rawValue.trim().toUpperCase();

        if (!normalizedValue) {
          alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
          return false;
        }

        const duplicateExists = this.rowData().some(
          (row, index) =>
            index !== params.node?.rowIndex &&
            row.name?.toUpperCase() === normalizedValue
        );

        if (duplicateExists) {
          alerts.basicAlert(
            'Nombre duplicado',
            'Ya existe una sucursal con ese nombre.',
            'error'
          );
          return false;
        }

        if (params.data) {
          params.data[params.colDef.field!] = normalizedValue;
        }
        return true;
      },

    },
    {
      field: 'description',
      headerName: 'Descripción *',
      editable: (params) => {
        if (params.data?.__isNew) {
          return true;
        }
        return true
      },
      filter: true,
      width: 400,
      valueSetter: (params) => {
        if (params.data) {
          params.data[params.colDef.field!] = params.newValue?.toUpperCase();
        }
        return true;
      },
    },
    {
      field: 'idEstado',
      headerName: 'Estado',
      editable: (params) => {
        if (params.data?.__isNew) {
          return true;
        }
        return true
      },
      filter: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({
        values: this.estados.map(e => e.nom_agee), // valores visibles en el editor
      }),
      valueFormatter: (params) => {
        const found = this.estados.find(e => e.id === params.value);
        return found ? found.nom_agee : '';
      },
      valueGetter: (params) => {
        // Devuelve el ID real, para mantener consistencia interna
        return params.data?.idEstado ?? null;
      },
      valueSetter: (params) => {
        const selectedName = (params.newValue || '').trim();
        const estado = this.estados.find(e => e.nom_agee === selectedName);
        if (estado && params.data) {
          params.data.idEstado = estado.id;
          return true;
        }
        return false;
      }
    },
    {
      field: 'address',
      headerName: 'Dirección *',
      editable: (params) => {
        if (params.data?.__isNew) {
          return true;
        }
        return true
      },
      filter: true,
      width: 400,
      valueSetter: (params) => {
        if (params.data) {
          params.data[params.colDef.field!] = params.newValue?.toUpperCase();
        }
        return true;
      },
    },
    {
      field: 'vigente',
      headerName: 'Activo',
      editable: (params) => {
        if (params.data?.__isNew) {
          return true;
        }
        return true
      },
      suppressMovable: true,
      filter: true,
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        return `<input type="checkbox" ${params.value ? 'checked' : ''
          } disabled />`;
      },
    }
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

  public addBranch() {
    const newBranch = {
      id: 0,
      idCompany: this.idCompany,
      idEstado: 0,
      name: '',
      description: '',
      address: '',
      orden: 0,
      vigente: true,
      active: true,
    };

    const rowWithFlags = { ...newBranch, __isNew: true };
    this.rowData.update(prev => [rowWithFlags, ...prev]);
    this.notSavedChanges = true;
    
    // Iniciamos la edición en el nombre automáticamente
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

    const invalidNewRows = newRows.filter(item => !item.name || !item.address);
    if (invalidNewRows.length > 0) {
      const invalidRow = invalidNewRows[0];
      let missingFields = [];
      if (!invalidRow.name) missingFields.push('Nombre');
      if (!invalidRow.address) missingFields.push('Dirección');
      alerts.basicAlert('Validación - Nueva Sucursal', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    const invalidModifiedRows = modifiedRows.filter(item => !item.name || !item.address);
    if (invalidModifiedRows.length > 0) {
      const invalidRow = invalidModifiedRows[0];
      let missingFields = [];
      if (!invalidRow.name) missingFields.push('Nombre');
      if (!invalidRow.address) missingFields.push('Dirección');
      alerts.basicAlert('Validación - Sucursal Modificada', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Sucursales',
          'Menu Configuración Sucursales',
          this.trackingService.getEmail()
        );
        return this.branchsService.addBranch(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Sucursales',
          'Menu Configuración Sucursales',
          this.trackingService.getEmail()
        );
        return this.branchsService.updateBranch(row.id, cleanedData);
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
          this.branchsService.deleteBranch(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar sucursal:', error);
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
