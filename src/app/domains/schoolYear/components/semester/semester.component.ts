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
import { TrackingService } from '../../../../service/tracking.service';
import { SignalsService } from '../../../../service/signals.service';
import { UsersxpermissionsService } from '../../../../service/usersxpermissions.service';
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, tap, toArray } from 'rxjs';
import { SchoolYearService } from '../../../../service/schoolYear.service';
import { SemesterService } from '../../../../service/semester.service';
import { InegiService } from '../../../../service/inegi.service';
import LoadSubject from './load-subject.component';
import Rescripcion from './subModulos/rescripcion.component';
import  Inscripcion  from './subModulos/inscripcion.component';

@Component({
  selector: 'app-semester',
  standalone: true,
  imports: [AgGridAngular, Rescripcion, Inscripcion, LoadSubject],
  templateUrl: './semester.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Semester {
  protected readonly selectedUserId = signal<number | null>(null);
  protected readonly activeSubmodule = signal<'inscripcion' | 'rescripcion' | 'loadSubject' | null>(null);
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);
  public schoolYearService = inject(SchoolYearService);
  public inegiService = inject(InegiService);
  public semesterService = inject(SemesterService);

  // Usamos computed para evitar que el ID se pierda y sea reactivo al sidebar
  protected readonly idCompany = computed(() => this.signalsService.getRootSelectedBySidebar() ?? 0);
  
  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];

  constructor() {
    effect(() => {
      const currentId = this.idCompany();
      if (currentId > 0) {
        this.loadData(currentId);
        this.loadCiclosEscolares(currentId);
        this.loadCiclosEscolaresVigentes(currentId);
      }
    });
  }

  loadData(companyId?: number) {
    const id = companyId ?? this.idCompany();
    if (id === 0) return;

    this.semesterService.getSemesters(id).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
          console.log('Semestres cargados:', this.rowData());
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }
  loadCiclosEscolares(companyId?: number) {
    const id = companyId ?? this.idCompany();
    if (id === 0) return;

    this.schoolYearService.getSchoolYear(id).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.CiclosEscolares.set(data);
        //console.log('Ciclos Escolares cargados:', this.CiclosEscolares());
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }

  loadCiclosEscolaresVigentes(companyId?: number) {
    const id = companyId ?? this.idCompany();
    if (id === 0) return;

    this.schoolYearService.getSchoolYearVigentes(id).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.CiclosEscolaresVigentes.set(data);
        //console.log('Ciclos Escolares cargados:', this.CiclosEscolaresVigentes());
      },
      error: (error) => {
        console.error('Error en la solicitud:', error);
      }
    });
  }
  public setSelectedUserId(id: number, submodule: 'inscripcion' | 'rescripcion' | 'loadSubject') {
    if (id === 0) {
      alerts.basicAlert('Registro Pendiente', 'Debe guardar los cambios del registro antes de continuar.', 'warning');
      return;
    }
    
    this.selectedUserId.set(id);
    this.activeSubmodule.set(submodule);
    //console.log('Abriendo submódulo del semestre:', { id, submodule });

    setTimeout(() => {
      document.getElementById('semester-submodule-container')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }
  
  public closeSubmodule() {
    this.activeSubmodule.set(null);
    this.selectedUserId.set(null);
  }

  protected readonly columnDefs = computed<ColDef[]>(() => {
    const ciclos = this.CiclosEscolares();
    const ciclosVigentes = this.CiclosEscolaresVigentes();
    // Usamos todos los ciclos para el mapeo visual (refData) para que registros viejos muestren su nombre
    const ciclosMap = ciclos.reduce((acc, c) => {
      acc[c.id.toString()] = c.comment;
      return acc;
    }, {} as Record<string, string>);

    return [
    {
      field: 'vigente',
      headerName: 'Vigente',
      editable: true,
      width: 100,
      cellEditor: 'agCheckboxCellEditor',
    },
    {
      field: 'idSchoolYear',
      headerName: 'Ciclo Escolar',
      editable: true,
      filter: true,
      flex: 2,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        // Solo permitimos seleccionar los ciclos que estén vigentes
        values: ciclosVigentes.map(c => c.id),
      },
      refData: ciclosMap,
    },
    {
      field: 'comment',
      headerName: 'Nombre del Semestre',
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
      headerName: 'Inicio',
      editable: true,
      filter: 'agDateColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      width: 120,
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
      headerName: 'Fin',
      editable: true,
      filter: 'agDateColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      width: 120,
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
      headerName: "Inscripcion",
      field: "Inscripcion",
      width: 150,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => {
        const button = document.createElement('button');
        button.innerText = 'Inscripción';
        button.classList.add('bg-indigo-100', 'text-indigo-700', 'px-3', 'py-1', 'rounded-lg', 'text-xs', 'font-bold', 'hover:bg-indigo-200', 'transition-colors');
        button.addEventListener('click', () => {
          if (params.data) this.setSelectedUserId(params.data.id, 'inscripcion');
        });
        return button;
      }
    },
   {
      headerName: "Reinscripción",
      field: "Rescripcion",
      width: 150,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => {
        const button = document.createElement('button');
        button.innerText = 'Rescripcion';
        button.classList.add('bg-indigo-100', 'text-indigo-700', 'px-3', 'py-1', 'rounded-lg', 'text-xs', 'font-bold', 'hover:bg-indigo-200', 'transition-colors');
        button.addEventListener('click', () => {
          if (params.data) this.setSelectedUserId(params.data.id, 'rescripcion');
        });
        return button;
      }
    },
    {
      headerName: "Carga Académica",
      field: "LoadSubject",
      width: 150,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => {
        const button = document.createElement('button');
        button.innerText = 'Carga Académica';
        button.classList.add('bg-purple-100', 'text-purple-700', 'px-3', 'py-1', 'rounded-lg', 'text-xs', 'font-bold', 'hover:bg-purple-200', 'transition-colors');
        button.addEventListener('click', () => {
          if (params.data) this.setSelectedUserId(params.data.id, 'loadSubject');
        });
        return button;
      }
    }
   
    ];
  });

  protected readonly rowData = signal<any[]>([]);
  protected readonly CiclosEscolares = signal<any[]>([]);
  protected readonly CiclosEscolaresVigentes = signal<any[]>([]);

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
    const ciclosVigentes = this.CiclosEscolaresVigentes();
    const newData = {
      id: 0,
      idCompany: this.idCompany(),
      idSchoolYear: ciclosVigentes.length > 0 ? ciclosVigentes[0].id : 0,
      comment: '',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      vigente: true,
      active: true,
    };
    const rowWithFlags = { ...newData, __isNew: true };
    this.rowData.update(prev => [rowWithFlags, ...prev]);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idSchoolYear' }), 100);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();
    
    const newRows = this.rowData().filter(row => row.__isNew);
    const modifiedRows = this.rowData().filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.idSchoolYear || !item.comment || !item.startDate || !item.endDate);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validación', 'El semestre, nombre y las fechas son obligatorias.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Semestres',
          'Menu Configuración Semestres',
          this.trackingService.getEmail()
        );
        return this.semesterService.addSemester(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Semestres',
          'Menu Configuración Semestres',
          this.trackingService.getEmail()
        );
        return this.semesterService.updateSemester(row.id, cleanedData);
      });

      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(), 500);

    } catch (error: any) {
      console.error('Error al guardar semestres:', error);
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

    alerts.confirmAlert('Eliminar semestre', '¿Está seguro que desea eliminar este semestre?', 'warning', 'Sí, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          this.semesterService.deleteSemester(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar semestre:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Semestres',
              'Menu Configuración Semestres',
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
