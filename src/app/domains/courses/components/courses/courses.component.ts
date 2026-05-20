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
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, tap, toArray } from 'rxjs';
import Subjects from './subModulos/subjects.component';
import { CoursesService } from '../../../../service/courses.service';
import { SchoolYearService } from '../../../../service/schoolYear.service';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [AgGridAngular, Subjects],
  templateUrl: './courses.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CoursesComponent {
  protected readonly selectedUserId = signal<number | null>(null);
  protected readonly activeSubmodule = signal<'subjects' | null>(null);
  protected readonly selectedCourseName = signal<string>('');
  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public coursesService = inject(CoursesService);
  public schoolYearService = inject(SchoolYearService);

  // Usamos computed para evitar que el ID se pierda y sea reactivo al sidebar
  protected readonly idCampus = computed(() => this.signalsService.getBranchSelectedBySidebar() ?? 0);
  
  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];

  constructor() {
    effect(() => {
      const currentId = this.idCampus();
      if (currentId > 0) {
        this.loadData(currentId);
        this.loadCiclosEscolares(currentId);
        this.loadCiclosEscolaresVigentes(currentId);
      }
    });
  }

  loadData(campusId?: number) {
    const id = campusId ?? this.idCampus();
    if (id === 0) return;

    this.coursesService.getCourses(id).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : (response?.data || []);
        this.rowData.set(data);
        //console.log('Cursos cargados:', this.rowData());
      },
      error: (error) => {
        console.error('Error al cargar cursos:', error);
      }
    });
  }

  loadCiclosEscolares(campusId?: number) {
    const id = campusId ?? this.idCampus();
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

  loadCiclosEscolaresVigentes(campusId?: number) {
    const id = campusId ?? this.idCampus();
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
  public setSelectedUserId(id: number, name: string, submodule: 'subjects') {
    if (id === 0) {
      alerts.basicAlert('Registro Pendiente', 'Debe guardar los cambios del registro antes de continuar.', 'warning');
      return;
    }
    
    this.selectedUserId.set(id);
    this.selectedCourseName.set(name);
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
    this.selectedCourseName.set('');
  }

  protected readonly columnDefs = signal<ColDef[]>([
    {
      field: 'cod',
      headerName: 'Código',
      editable: true,
      filter: true,
      flex: 1,
    },
    {
      field: 'abreviatura',
      headerName: 'Abreviatura',
      editable: true,
      filter: true,
      flex: 1,
    },
    {
      field: 'name',
      headerName: 'Nombre del Curso',
      editable: true,
      filter: true,
      flex: 2,
      valueSetter: (params) => {
        const rawValue = params.newValue;
        if (!rawValue || typeof rawValue !== 'string') {
          alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
          return false;
        }
        params.data[params.colDef.field!] = rawValue.trim().toUpperCase();
        return true;
      },
    },
    {
      field: 'description',
      headerName: 'Descripción',
      editable: true,
      filter: true,
      flex: 3,
    },
    {
      field: 'vigente',
      headerName: 'Vigente',
      editable: true,
      width: 100,
      cellEditor: 'agCheckboxCellEditor',
    },
    {
      headerName: "Materias",
      field: "subjects",
      width: 150,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => {
        const button = document.createElement('button');
        button.innerText = 'Materias';
        button.classList.add('bg-indigo-100', 'text-indigo-700', 'px-3', 'py-1', 'rounded-lg', 'text-xs', 'font-bold', 'hover:bg-indigo-200', 'transition-colors');
        button.addEventListener('click', () => {
          if (params.data) this.setSelectedUserId(params.data.id, params.data.name, 'subjects');
        });
        return button;
      }
    }
  ]);

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
    const newData = {
      id: 0,
      idCampus: this.idCampus(),
      cod: '',
      abreviatura: '',
      name: '',
      description: '',
      vigente: true,
      active: true,
    };
    const rowWithFlags = { ...newData, __isNew: true };
    this.rowData.update(prev => [rowWithFlags, ...prev]);
    this.notSavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'cod' }), 100);
  }

  public async saveChanges() {
    this.gridApi.stopEditing();
    
    const newRows = this.rowData().filter(row => row.__isNew);
    const modifiedRows = this.rowData().filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const invalidNewRows = newRows.filter(item => !item.name || !item.cod);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validación', 'El nombre y el código son obligatorios.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Cursos',
          'Menu Configuración Cursos',
          this.trackingService.getEmail()
        );
        return this.coursesService.addCourses(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Cursos',
          'Menu Configuración Cursos',
          this.trackingService.getEmail()
        );
        return this.coursesService.updateCourses(row.id, cleanedData);
      });

      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      setTimeout(() => this.loadData(), 300);

    } catch (error: any) {
      console.error('Error al guardar cursos:', error);
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

    alerts.confirmAlert('Eliminar curso', '¿Está seguro que desea eliminar este curso?', 'warning', 'Sí, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          this.coursesService.deleteCourses(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar curso:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Cursos',
              'Menu Configuración Cursos',
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
