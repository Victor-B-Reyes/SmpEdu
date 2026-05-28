import { inject, Injectable } from '@angular/core';

import { environment } from '../environments/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class RegisAndReService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getRegisAndRe(idroot : number , type : string): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/RegisAndRe?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/RegisAndRe?idSemester=${idroot}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  addRegisAndRe(RegisAndRe: any) : Observable<any> {
    return this.http.post<any>(`${environment.urlEduControl}/RegisAndRe`, RegisAndRe, { headers: this.trackingService.getHeaders() });
  }

  updateRegisAndRe(id: number, RegisAndRe: any) :Observable<any>{
    return this.http.put<any>(`${environment.urlEduControl}/RegisAndRe/${id}`, RegisAndRe, { headers: this.trackingService.getHeaders() });
  }


  deleteRegisAndRe(id: number): Observable<any> {
    return this.http.delete(`${environment.urlEduControl}/RegisAndRe/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
