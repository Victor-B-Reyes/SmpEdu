import { inject, Injectable } from '@angular/core';

import { environment } from '../environments/environment';
import { Students } from '../interface/students';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class StudentsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getStudents(idCampus : number, idCourse: number ): Observable<any> {
    //console.log('Fetching students with idCampus:', idCampus, 'and idCourse:', idCourse);
    //  const apiUrl = `${environment.urlEduControl}/Students?idCampus=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/Students?idCampus=${idCampus}&idCourse=${idCourse}`, { headers: this.trackingService.getHeaders() });
  }
  getListStudents(idCampus : number, idCourse: number , grado: string, grupo: string): Observable<any> {
    //console.log('Fetching students with idCampus:', idCampus, 'and idCourse:', idCourse);
    //  const apiUrl = `${environment.urlEduControl}/Students?idCampus=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/Students/list?idCampus=${idCampus}&idCourse=${idCourse}&grado=${grado}&grupo=${grupo}`, { headers: this.trackingService.getHeaders() });
  }

  addStudents(Students: any) : Observable<Students> {
    return this.http.post<Students>(`${environment.urlEduControl}/Students`, Students, { headers: this.trackingService.getHeaders() });
  }

  updateStudents(id: number, Students: any) :Observable<Students>{
    return this.http.put<Students>(`${environment.urlEduControl}/Students/${id}`, Students, { headers: this.trackingService.getHeaders() });
  }


  deleteStudents(id: number): Observable<any> {
    return this.http.delete(`${environment.urlEduControl}/Students/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
