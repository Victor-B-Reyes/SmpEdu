import { inject, Injectable } from '@angular/core';

import { environment } from '../environments/environment';
import { Courses } from '../interface/courses.interface';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class CoursesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getCourses(idroot : number): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/Courses?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/Courses?idCampus=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

   getCoursesVigentes(idroot : number): Observable<any> {
    //  const apiUrl = `${environment.urlEduControl}/Courses/vigentes?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlEduControl}/Courses/vigentes?idCampus=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  addCourses(Courses: any) : Observable<Courses> {
    return this.http.post<Courses>(`${environment.urlEduControl}/Courses`, Courses, { headers: this.trackingService.getHeaders() });
  }

  updateCourses(id: number, Courses: any) :Observable<Courses>{
    return this.http.put<Courses>(`${environment.urlEduControl}/Courses/${id}`, Courses, { headers: this.trackingService.getHeaders() });
  }


  deleteCourses(id: number): Observable<any> {
    return this.http.delete(`${environment.urlEduControl}/Courses/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
