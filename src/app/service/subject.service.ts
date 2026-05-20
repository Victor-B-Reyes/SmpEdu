import { inject, Injectable } from '@angular/core';

import { environment } from '../environments/environment';
import { Subject } from '../interface/subject.interface';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class SubjectService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getSubjects(idCourses: number): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/Semester?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/Subject?idCourses=${idCourses}`, { headers: this.trackingService.getHeaders() });
  }

  addSubject(subject: any) : Observable<Subject> {
    return this.http.post<Subject>(`${environment.urlEduControl}/Subject`, subject, { headers: this.trackingService.getHeaders() });
  }

  updateSubject(id: number, subject: any) :Observable<Subject>{
    return this.http.put<Subject>(`${environment.urlEduControl}/Subject/${id}`, subject, { headers: this.trackingService.getHeaders() });
  }


  deleteSubject(id: number): Observable<any> {
    return this.http.delete(`${environment.urlEduControl}/Subject/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
