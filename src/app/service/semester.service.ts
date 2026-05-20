import { inject, Injectable } from '@angular/core';

import { environment } from '../environments/environment';
import { Semester } from '../interface/semester.interface';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class SemesterService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getSemesters(idCompany : number): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/Semester?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/Semester?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  addSemester(semester: any) : Observable<Semester> {
    return this.http.post<Semester>(`${environment.urlEduControl}/Semester`, semester, { headers: this.trackingService.getHeaders() });
  }

  updateSemester(id: number, semester: any) :Observable<Semester>{
    return this.http.put<Semester>(`${environment.urlEduControl}/Semester/${id}`, semester, { headers: this.trackingService.getHeaders() });
  }


  deleteSemester(id: number): Observable<any> {
    return this.http.delete(`${environment.urlEduControl}/Semester/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
