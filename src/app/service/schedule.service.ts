import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { TrackingService } from './tracking.service';

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

export interface ActiveSemesterGroup {
  semesterId: number;
  semesterComment: string;
  grade: number;
  groupName: string;
  offersCount: number;
}

export interface GroupScheduleConfig {
  id?: number;
  semesterId: number;
  grade: number;
  groupName: string;
  startTime1: string;
  endTime1: string;
  startTime2?: string | null;
  endTime2?: string | null;
  intervalMinutes: number;
  workingDays: string;
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private apiUrl = environment.urlEduControl;

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  // ClassOffer endpoints
  getClassOffersBySemester(semesterId: number): Observable<ClassOffer[]> {
    return this.http.get<ClassOffer[]>(`${this.apiUrl}/classoffer/semester/${semesterId}`, { headers: this.trackingService.getHeaders() });
  }

  getClassOffersByGradeAndGroup(semesterId: number, grade: string | number, groupName: string): Observable<ClassOffer[]> {
    return this.http.get<ClassOffer[]>(`${this.apiUrl}/classoffer/semester/${semesterId}/grade/${grade}/group/${groupName}`, { headers: this.trackingService.getHeaders() });
  }

  getGroupsByActiveSemesters(idCompany: number): Observable<ActiveSemesterGroup[]> {
    return this.http.get<ActiveSemesterGroup[]>(`${this.apiUrl}/classoffer/active-semesters/company/${idCompany}/groups`, { headers: this.trackingService.getHeaders() });
  }

  getClassOfferById(id: number): Observable<ClassOffer> {
    return this.http.get<ClassOffer>(`${this.apiUrl}/classoffer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  createClassOffer(classOffer: ClassOffer): Observable<ClassOffer> {
    return this.http.post<ClassOffer>(`${this.apiUrl}/classoffer`, classOffer, { headers: this.trackingService.getHeaders() });
  }

  updateClassOffer(id: number, classOffer: ClassOffer): Observable<ClassOffer> {
    return this.http.put<ClassOffer>(`${this.apiUrl}/classoffer/${id}`, classOffer, { headers: this.trackingService.getHeaders() });
  }

  deleteClassOffer(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/classoffer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ClassScheduleBlock endpoints
  getSchedulesByClassOffer(classOfferId: number): Observable<ClassScheduleBlock[]> {
    return this.http.get<ClassScheduleBlock[]>(`${this.apiUrl}/classschedule/classoffer/${classOfferId}`, { headers: this.trackingService.getHeaders() });
  }

  getScheduleById(id: number): Observable<ClassScheduleBlock> {
    return this.http.get<ClassScheduleBlock>(`${this.apiUrl}/classschedule/${id}`, { headers: this.trackingService.getHeaders() });
  }

  createSchedule(schedule: ClassScheduleBlock): Observable<ClassScheduleBlock> {
    return this.http.post<ClassScheduleBlock>(`${this.apiUrl}/classschedule`, schedule, { headers: this.trackingService.getHeaders() });
  }

  updateSchedule(id: number, schedule: ClassScheduleBlock): Observable<ClassScheduleBlock> {
    return this.http.put<ClassScheduleBlock>(`${this.apiUrl}/classschedule/${id}`, schedule, { headers: this.trackingService.getHeaders() });
  }

  deleteSchedule(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/classschedule/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getDayOfWeekName(day: number): string {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[day] || '';
  }
  getClassOffers(semesterId: number, campusId: number, grade: string, group: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/academicrecord/kardex/offers/${semesterId}/${campusId}/${grade}/${group}`, { headers: this.trackingService.getHeaders() });
  }

  // GroupScheduleConfig endpoints
  getGroupScheduleConfig(semesterId: number, grade: number, groupName: string): Observable<GroupScheduleConfig> {
    return this.http.get<GroupScheduleConfig>(`${this.apiUrl}/groupscheduleconfig/semester/${semesterId}/grade/${grade}/group/${groupName}`, { headers: this.trackingService.getHeaders() });
  }

  upsertGroupScheduleConfig(config: GroupScheduleConfig): Observable<GroupScheduleConfig> {
    return this.http.post<GroupScheduleConfig>(`${this.apiUrl}/groupscheduleconfig/upsert`, config, { headers: this.trackingService.getHeaders() });
  }

}
