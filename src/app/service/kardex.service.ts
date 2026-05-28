import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface AcademicRecord {
  id: number;
  studentId: number;
  semesterId: number;
  subjectId: number;
  courseId: number;
  grade: number;
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

  constructor(private http: HttpClient) { }

  getStudentKardex(studentId: number): Observable<AcademicRecord[]> {
    return this.http.get<AcademicRecord[]>(`${this.apiUrl}/academicrecord/kardex/${studentId}`);
  }

  getGPA(studentId: number): Observable<{ gpa: number }> {
    return this.http.get<{ gpa: number }>(`${this.apiUrl}/academicrecord/gpa/${studentId}`);
  }

  getAccumulatedCredits(studentId: number): Observable<{ creditsAccumulated: number }> {
    return this.http.get<{ creditsAccumulated: number }>(`${this.apiUrl}/academicrecord/credits/${studentId}`);
  }

  getSubjectStats(studentId: number): Observable<{ Aprobadas: number; Reprobadas: number; Pendientes: number; Total: number }> {
    return this.http.get<any>(`${this.apiUrl}/academicrecord/stats/${studentId}`);
  }

  getSubjectsByPeriod(studentId: number, period: number): Observable<AcademicRecord[]> {
    return this.http.get<AcademicRecord[]>(`${this.apiUrl}/academicrecord/period/${studentId}/${period}`);
  }

  updateGrade(id: number, academicRecord: AcademicRecord): Observable<AcademicRecord> {
    return this.http.put<AcademicRecord>(`${this.apiUrl}/academicrecord/${id}`, academicRecord);
  }
}
