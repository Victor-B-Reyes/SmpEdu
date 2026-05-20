import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, input } from '@angular/core';
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
import { SubjectService } from '../../../../../service/subject.service';
import { InegiService } from '../../../../../service/inegi.service';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './subjects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export default class Subjects {
  public courseName = input<string>('');
  public idCourse = input<number>(0);

  private gridApi!: GridApi;
  public trackingService = inject(TrackingService);
  public signalsService = inject(SignalsService);
  public usersxrootService = inject(UsersxpermissionsService);
  public subjectService = inject(SubjectService);
  public inegiService = inject(InegiService);

  notSavedChanges: boolean = false;
  newlyAddedRows: any[] = [];

  constructor() {
    effect(() => {
      const currentId = this.idCourse();
      if (currentId > 0) {
        this.loadData(currentId);
      }
    });
  }

  loadData(courseId?: number) {
    const id = courseId ?? this.idCourse();
    if (id === 0) return;

    this.subjectService.getSubjects(id).subscribe({
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
      field: 'cod',
      headerName: 'Código',
      editable: true,
      filter: true,
      width: 150,
      valueSetter: (params) => {
        if (params.data) {
          params.data.cod = params.newValue?.toString().trim().toUpperCase();
        }
        return true;
      }
    },
    {
      field: 'name',
      headerName: 'Nombre de la materia',
      editable: true,
      filter: true,
      flex: 2,
      valueSetter: (params) => {
        const rawValue = params.newValue;
        if (!rawValue || typeof rawValue !== 'string') {
          alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
          return false;
        }
        const normalizedValue = rawValue.trim().toUpperCase();
        if (params.data) {
          params.data.name = normalizedValue;
        }
        return true;
      },
    },
    {
      field: 'creditos',
      headerName: 'Créditos',
      editable: true,
      width: 120,
      cellEditor: 'agNumberCellEditor',
    },
    {
      field: 'periodo',
      headerName: 'Periodo',
      editable: true,
      width: 120,
      cellEditor: 'agNumberCellEditor',
    },
    {
      field: 'vigente',
      headerName: 'Vigente',
      editable: true,
      width: 100,
      cellEditor: 'agCheckboxCellEditor',
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

  public addData() {
    const newData = {
      id: 0,
      idCourses: this.idCourse(),
      cod: '',
      name: '',
      creditos: 1,
      periodo: 1,
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

    const invalidNewRows = newRows.filter(item => !item.cod || !item.name);
    if (invalidNewRows.length > 0) {
      alerts.basicAlert('Validación', 'El código y el nombre de la materia son obligatorios.', 'error');
      return;
    }

    try {
      const addRequests = newRows.map((row) => {
        // Reforzamos el ID del curso actual antes de limpiar y enviar
        row.idCourses = this.idCourse();
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Materias',
          'Menu Configuración Materias',
          this.trackingService.getEmail()
        );
        return this.subjectService.addSubject(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        // Por seguridad, también lo aseguramos en las actualizaciones
        row.idCourses = this.idCourse();
        const cleanedData = this.cleanDataForServer(row);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Materias',
          'Menu Configuración Materias',
          this.trackingService.getEmail()
        );
        return this.subjectService.updateSubject(row.id, cleanedData);
      });

      await lastValueFrom(concat(...addRequests, ...updateRequests).pipe(toArray()));

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => this.loadData(), 500);

    } catch (error: any) {
      console.error('Error al guardar materias:', error);
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

    alerts.confirmAlert('Eliminar materia', '¿Está seguro que desea eliminar esta materia?', 'warning', 'Sí, eliminar')
      .then((value) => {
        if (value.isConfirmed) {
          this.subjectService.deleteSubject(id).pipe(
            catchError((error) => {
              console.error('Error al eliminar materia:', error);
              alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
              return EMPTY;
            })
          ).subscribe(() => {
            alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
            this.loadData();
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Delete Registro en Materias',
              'Menu Configuración Materias',
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
