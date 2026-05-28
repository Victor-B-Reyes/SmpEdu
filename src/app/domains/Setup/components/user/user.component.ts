import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { catchError, concat, EMPTY, lastValueFrom, tap, toArray } from 'rxjs';
import { alerts } from '../../../../helpers/alerts';
import { TrackingService } from '../../../../service/tracking.service';
import { SignalsService } from '../../../../service/signals.service';
import { UsersService } from '../../../../service/users.service';
import { UsersxpermissionsService } from '../../../../service/usersxpermissions.service';
import { UserSecurityComponent } from './user-security.component';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [AgGridAngular, UserSecurityComponent],
  templateUrl: './user.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class User {
  private gridApi!: GridApi;
  private readonly originalRows = new Map<number | string, string>();
  public trackingService = inject(TrackingService);
  public usersService = inject(UsersService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);

  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);

  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];

  constructor() {
    effect(() => {
      const currentCompanyId = this.idCompany();
      if (currentCompanyId > 0) {
        this.loadData(currentCompanyId);
      }
    });
  }

  loadData(companyId?: number) {
    const id = companyId ?? this.idCompany();
    if (id === 0) return;

    this.usersService.getDataUsers(id).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
        this.storeOriginalRows(data);
        this.notSavedChanges = false;
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }

  private readonly employes = [
    { id: 101, name: 'Juan Pérez' },
    { id: 102, name: 'María García' },
    { id: 103, name: 'Carlos López' }
  ];

  protected readonly selectedUserId = signal<number | null>(null);

  protected readonly columnDefs = signal<ColDef[]>([
    {
      field: 'displayName',
      headerName: 'Nombre *',
      editable: (params) => !!params.data,
      filter: true,
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
            row.displayName?.toUpperCase() === normalizedValue
        );

        if (duplicateExists) {
          alerts.basicAlert(
            'Nombre duplicado',
            'Ya existe un usuario con ese nombre.',
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
      field: 'email',
      headerName: 'Email',
      editable: (params) => !!params.data,
      filter: true,
      valueSetter: (params) => {
        if (params.data) {
          params.data[params.colDef.field!] = params.newValue?.trim().toUpperCase();
        }
        return true;
      },
      flex: 1
    },
    {
      field: 'project',
      headerName: 'Empleado',
      editable: true,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['0', ...this.employes.map(e => String(e.id))]
      },
      refData: {
        '0': 'SIN ASIGNAR',
        ...this.employes.reduce((acc: any, curr) => {
          acc[String(curr.id)] = curr.name;
          return acc;
        }, {})
      }
    },
    {
      field: 'password',
      headerName: 'Contraseña',
      flex: 1,
      editable: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value) return `••••••••`;
        return params.data?.id === 0
          ? `<span class="text-danger fw-bold">REQUERIDO</span>`
          : `••••••••`;
      }
    },
    {
      field: 'signature',
      headerName: 'Firma',
      editable: (params) => !!params.data,
      filter: true,
      valueSetter: (params) => {
        if (params.data) {
          params.data[params.colDef.field!] = params.newValue?.toUpperCase();
        }
        return true;
      },
      flex: 1
    },
    {
      headerName: 'Seguridad',
      field: 'Security',
      flex: 1,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => {
        const button = document.createElement('button');
        button.innerText = 'Seguridad';
        button.classList.add(
          'bg-indigo-100',
          'text-indigo-700',
          'px-3',
          'py-1',
          'rounded-lg',
          'text-xs',
          'font-bold',
          'hover:bg-indigo-200',
          'transition-colors'
        );
        button.addEventListener('click', () => {
          if (params.data) this.setSelectedUserId(params.data.id);
        });
        return button;
      }
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
    this.updateRowModifiedState(event.data);
    this.notSavedChanges = this.hasPendingChanges();
    this.rowData.update(prev => [...prev]);
  }

  public setSelectedUserId(id: number) {
    if (id === 0) {
      alerts.basicAlert(
        'Registro Pendiente',
        'Debe guardar los cambios del nuevo usuario antes de configurar su seguridad.',
        'warning'
      );
      return;
    }

    this.selectedUserId.set(id);
  }

  public closeSecurity() {
    this.selectedUserId.set(null);
  }

  public addUser() {
    const newUser = {
      id: 0,
      active: 1,
      age: 0,
      allowWhatsapp: true,
      countEmpresas: 1,
      countPermisosMaestros: 0,
      countSucursales: 6,
      country: '',
      displayName: '',
      email: '',
      idDepartament: 1,
      idRol: 4,
      idTelegram: 'SINID',
      id_company: this.idCompany(),
      id_position: 20,
      isRoot: false,
      method: 'EDUCONTROL',
      password: '',
      phone: '',
      picture: null,
      project: '0',
      signature: '',
      usersmall: 'SINUSER'
    };

    const rowWithFlags = { ...newUser, __isNew: true };
    this.rowData.update(prev => [rowWithFlags, ...prev]);
    this.notSavedChanges = true;

    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'displayName' }), 100);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();

    const allRows = this.getAllRowsFromGrid();
    this.rowData.set([...allRows]);

    const newRows = allRows.filter(row => row.__isNew);
    const modifiedRows = allRows.filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.displayName || !item.email || !item.password);
    if (invalidNewRows.length > 0) {
      const invalidRow = invalidNewRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push('Nombre');
      if (!invalidRow.email) missingFields.push('Correo electrónico');
      if (!invalidRow.password) missingFields.push('Contraseña');
      alerts.basicAlert('Validación - Nuevo Usuario', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    const invalidModifiedRows = modifiedRows.filter(item => !item.displayName || !item.email);
    if (invalidModifiedRows.length > 0) {
      const invalidRow = invalidModifiedRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push('Nombre');
      if (!invalidRow.email) missingFields.push('Correo electrónico');
      alerts.basicAlert('Validación - Usuario Modificado', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      const addUserRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Usuarios',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
        return this.usersService.addUser(cleanedData).pipe(
          tap(response => {
            if (response.code !== 200 || !response.data?.id) {
              throw new Error(`Error del servidor: ${response.message || 'Respuesta inválida'}`);
            }
          })
        );
      });

      const updateUserRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Usuarios',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
        return this.usersService.updateUser(row.id, cleanedData);
      });

      const userResponses = await lastValueFrom(
        concat(...addUserRequests, ...updateUserRequests).pipe(toArray())
      );

      const newUserResponses = userResponses.slice(0, newRows.length);

      const permissionRequests = newUserResponses.map((response) => {
        const userId = response.data?.id;
        if (!userId) return null;

        const formattedRoot = {
          idUser: userId,
          idPermission: this.signalsService.getRootSelectedBySidebar(),
          type: 'root',
          description: 'SIN DESCRIPCION',
          active: 1
        };

        const requests = [this.usersxrootService.addUserxPermission(formattedRoot)];

        const branchPermissionFromEmployee = this.procesoData(userId);
        if (branchPermissionFromEmployee && branchPermissionFromEmployee !== EMPTY) {
          requests.push(branchPermissionFromEmployee);
        } else {
          const branchId = this.signalsService.getBranchSelectedBySidebar() ?? 0;
          if (branchId > 0) {
            requests.push(this.usersxrootService.addUserxPermission({
              idUser: userId,
              idPermission: branchId,
              type: 'branch',
              description: 'SIN DESCRIPCION',
              active: 1
            }));
          }
        }
        return requests;
      }).filter(req => req !== null);

      if (permissionRequests.length > 0) {
        await lastValueFrom(concat(...permissionRequests.flat()).pipe(toArray()));
      }

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(), 500);
    } catch (error: any) {
      console.error('Error al guardar usuarios:', error);
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
  }

  public deleteSelected() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.isRoot === 1 || selectedData.isRoot === true) {
      alerts.basicAlert('Eliminar entrada', 'No se puede eliminar un usuario administrador', 'error');
      return;
    }

    if (selectedData.__isNew || id === 0) {
      this.rowData.update(prev => prev.filter(row => row !== selectedData));
      return;
    }

    alerts.confirmAlert('Eliminar empleado', '¿Está seguro que desea eliminar este usuario?', 'warning', 'Sí, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          selectedData.active = 0;
          this.usersService.deleteUser(id, selectedData).pipe(
            catchError((error) => {
              console.error('Error al eliminar usuario:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Usuarios',
              'Menu Administracion Usuarios',
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

  private storeOriginalRows(rows: any[]) {
    this.originalRows.clear();

    for (const row of rows) {
      if (row?.id !== undefined && row?.id !== null) {
        this.originalRows.set(row.id, this.serializeRow(row));
      }
    }
  }

  private serializeRow(row: any): string {
    const { __isNew, __modified, ...cleaned } = row ?? {};
    return JSON.stringify(cleaned);
  }

  private updateRowModifiedState(row: any) {
    if (!row || row.__isNew) {
      return;
    }

    const originalRow = this.originalRows.get(row.id);
    row.__modified = originalRow !== undefined && originalRow !== this.serializeRow(row);
  }

  private getAllRowsFromGrid(): any[] {
    if (!this.gridApi) {
      return this.rowData();
    }

    const rows: any[] = [];
    this.gridApi.forEachNode(node => {
      if (node.data) {
        this.updateRowModifiedState(node.data);
        rows.push(node.data);
      }
    });

    return rows;
  }

  private hasPendingChanges(): boolean {
    return this.rowData().some(row => row.__isNew || row.__modified);
  }

  private procesoData(userId: number) {
    return EMPTY;
  }
}
