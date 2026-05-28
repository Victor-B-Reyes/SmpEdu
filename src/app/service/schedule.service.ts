import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface ClassOffer {
  id: number;
  semesterId: number;
  courseId: number;
  subjectId: number;
  grade: number;
  groupName: string;
  teacherId?: number;
  classroom: string;
  capacity: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ClassScheduleBlock {
  id: number;
  classOfferId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentScheduleView extends ClassOffer {
  schedules: ClassScheduleBlock[];
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private apiUrl = environment.urlEduControl;

  constructor(private http: HttpClient) { }

  // ClassOffer endpoints
  getClassOffersBySemester(semesterId: number): Observable<ClassOffer[]> {
    return this.http.get<ClassOffer[]>(`${this.apiUrl}/classoffer/semester/${semesterId}`);
  }

  getClassOffersByGradeAndGroup(semesterId: number, grade: number, groupName: string): Observable<ClassOffer[]> {
    return this.http.get<ClassOffer[]>(`${this.apiUrl}/classoffer/semester/${semesterId}/grade/${grade}/group/${groupName}`);
  }

  getClassOfferById(id: number): Observable<ClassOffer> {
    return this.http.get<ClassOffer>(`${this.apiUrl}/classoffer/${id}`);
  }

  createClassOffer(classOffer: ClassOffer): Observable<ClassOffer> {
    return this.http.post<ClassOffer>(`${this.apiUrl}/classoffer`, classOffer);
  }

  updateClassOffer(id: number, classOffer: ClassOffer): Observable<ClassOffer> {
    return this.http.put<ClassOffer>(`${this.apiUrl}/classoffer/${id}`, classOffer);
  }

  deleteClassOffer(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/classoffer/${id}`);
  }

  // ClassScheduleBlock endpoints
  getSchedulesByClassOffer(classOfferId: number): Observable<ClassScheduleBlock[]> {
    return this.http.get<ClassScheduleBlock[]>(`${this.apiUrl}/classschedule/classoffer/${classOfferId}`);
  }

  getScheduleById(id: number): Observable<ClassScheduleBlock> {
    return this.http.get<ClassScheduleBlock>(`${this.apiUrl}/classschedule/${id}`);
  }

  createSchedule(schedule: ClassScheduleBlock): Observable<ClassScheduleBlock> {
    return this.http.post<ClassScheduleBlock>(`${this.apiUrl}/classschedule`, schedule);
  }

  updateSchedule(id: number, schedule: ClassScheduleBlock): Observable<ClassScheduleBlock> {
    return this.http.put<ClassScheduleBlock>(`${this.apiUrl}/classschedule/${id}`, schedule);
  }

  deleteSchedule(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/classschedule/${id}`);
  }

  getDayOfWeekName(day: number): string {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[day] || '';
  }
}
