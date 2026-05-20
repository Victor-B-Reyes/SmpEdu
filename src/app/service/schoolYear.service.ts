import { inject, Injectable } from '@angular/core';

import { environment } from '../environments/environment';
import { SchoolYear } from '../interface/schoolYear.interface';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class SchoolYearService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getSchoolYear(idroot : number): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/SchoolYear?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/SchoolYear?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

   getSchoolYearVigentes(idroot : number): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/SchoolYear/vigentes?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/SchoolYear/vigentes?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  addSchoolYear(schoolYear: any) : Observable<SchoolYear> {
    return this.http.post<SchoolYear>(`${environment.urlEduControl}/SchoolYear`, schoolYear, { headers: this.trackingService.getHeaders() });
  }

  updateSchoolYear(id: number, schoolYear: any) :Observable<SchoolYear>{
    return this.http.put<SchoolYear>(`${environment.urlEduControl}/SchoolYear/${id}`, schoolYear, { headers: this.trackingService.getHeaders() });
  }


  deleteSchoolYear(id: number): Observable<any> {
    return this.http.delete(`${environment.urlEduControl}/SchoolYear/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
