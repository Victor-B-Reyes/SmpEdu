import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { TrackingService } from './tracking.service';

export interface AcademicRecord {
  id: number;
  studentId: number;
  semesterId: number;
  subjectId: number;
  courseId: number;
  grade: string;
  groupName: string;
  partial1?: number;
  partial2?: number;
  partial3?: number;
  finalGrade?: number;
  status: string;
  opportunity: number;
  creditsEarned: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface KardexStats {
  gpa: number;
  creditsAccumulated: number;
  subjectStats: {
    Aprobadas: number;
    Reprobadas: number;
    Pendientes: number;
    Total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class KardexService {
  private apiUrl = environment.urlEduControl;

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  getStudentKardex(studentId: number): Observable<AcademicRecord[]> {
    return this.http.get<AcademicRecord[]>(`${this.apiUrl}/academicrecord/kardex/${studentId}`, { headers: this.trackingService.getHeaders() });
  }

  getGPA(studentId: number): Observable<{ gpa: number }> {
    return this.http.get<{ gpa: number }>(`${this.apiUrl}/academicrecord/gpa/${studentId}`, { headers: this.trackingService.getHeaders() });
  }

  getAccumulatedCredits(studentId: number): Observable<{ creditsAccumulated: number }> {
    return this.http.get<{ creditsAccumulated: number }>(`${this.apiUrl}/academicrecord/credits/${studentId}`, { headers: this.trackingService.getHeaders() });
  }

  getSubjectStats(studentId: number): Observable<{ Aprobadas: number; Reprobadas: number; Pendientes: number; Total: number }> {
    return this.http.get<any>(`${this.apiUrl}/academicrecord/stats/${studentId}`, { headers: this.trackingService.getHeaders() });
  }

  getSubjectsByPeriod(studentId: number, period: number): Observable<AcademicRecord[]> {
    return this.http.get<AcademicRecord[]>(`${this.apiUrl}/academicrecord/period/${studentId}/${period}`, { headers: this.trackingService.getHeaders() });
  }

  updateGrade(id: number, academicRecord: AcademicRecord): Observable<AcademicRecord> {
    return this.http.put<AcademicRecord>(`${this.apiUrl}/academicrecord/${id}`, academicRecord, { headers: this.trackingService.getHeaders() });
  }

  createAcademicRecord(record: Omit<AcademicRecord, 'id' | 'createdAt' | 'updatedAt'>): Observable<AcademicRecord> {
    return this.http.post<AcademicRecord>(`${this.apiUrl}/academicrecord`, record, { headers: this.trackingService.getHeaders() });
  }
  getRecordsBySemester(semesterId: number): Observable<AcademicRecord[]> {
    return this.http.get<AcademicRecord[]>(`${this.apiUrl}/academicrecord/semester/${semesterId}`, { headers: this.trackingService.getHeaders() });
  }
  
}
