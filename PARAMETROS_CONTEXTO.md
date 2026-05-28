# Parámetros de Contexto: idCampus, idCourse, idCompany

## 1. Dónde se guardan en localStorage

Los parámetros se guardan en **localStorage** con las siguientes claves:

| Parámetro | Clave localStorage | Guardado por | Tipo |
|-----------|-------------------|-------------|------|
| `idCompany` | `'company'` | SignalsService, TrackingService | number |
| `idCampus` (Branch) | `'branch'` | SignalsService, TrackingService | number |
| `idCourse` | `'course'` | SignalsService | number |
| `idUser` | `'idUser'` | login.component.ts | number |
| `selectedBranch` | `'selectedBranch'` | login.component.ts | number |

### Ubicación de guardado:

**[src/app/service/signals.service.ts](src/app/service/signals.service.ts#L115-L182)**
```typescript
// Guardar company (idCompany)
setRootSelectedBySidebar(id: number) {
  this.rootSelectedBySidebar.set(id);
  localStorage.setItem('company', String(id));
}

// Guardar branch (idCampus)
setBranchSelectedBySidebar(id: number) {
  this.branchSelectedBySidebar.set(id);
  localStorage.setItem('branch', String(id));
}

// Guardar course (idCourse)
setCourseSelectedBySidebar(id: number) {
  this.CourseSelectedBySidebar.set(id);
  localStorage.setItem('course', String(id));
}
```

**[src/app/domains/layout/login/login.component.ts](src/app/domains/layout/login/login.component.ts#L297-L308)**
```typescript
localStorage.setItem('idUser', datauser.id.toString());
localStorage.setItem('selectedBranch', datauser.applybranch.toString());
```

---

## 2. Componentes que usan getStudents()

### ⚠️ PROBLEMA DETECTADO:
El servicio `StudentService.getStudents()` **requiere parámetros**, pero se está llamando sin parámetros en Kardex:

### Componentes que LO USAN CORRECTAMENTE:

#### **[src/app/domains/Students/components/students.component.ts](src/app/domains/Students/components/students.component.ts#L117)**
```typescript
loadData(branchId: number, courseId: number) {
  if (branchId === 0) return;
  
  this.studentService.getStudents(branchId, courseId).subscribe({
    next: (response) => {
      const data = Array.isArray(response) ? response : (response?.data || []);
      this.rowData.set(data);
    },
    error: (error) => {
      console.error('Error en la solicitud:', error);
    }
  });
}
```

**Cómo obtiene los parámetros:**
- Observa signals del sidebar: `branchId` y `courseId`
- Los obtiene desde `SignalsService`:
  - `signalsService.getBranchSelectedBySidebar()`
  - `signalsService.getCourseSelectedBySidebar()`

#### **[src/app/domains/schoolYear/components/semester/subModulos/rescripcion.component.ts](src/app/domains/schoolYear/components/semester/subModulos/rescripcion.component.ts#L82)**
```typescript
students: this.studentService.getStudents(branchId, 0)
```

**Y también en:**
```typescript
this.studentService.getStudents(branchId, 0).pipe(takeUntil(this.destroy$)).subscribe({
  // ...
});
```

---

### ❌ Componente CON ERROR:

#### **[src/app/domains/Students/kardex/kardex.component.ts](src/app/domains/Students/kardex/kardex.component.ts#L35)**
```typescript
loadStudents(): void {
  this.loading = true;
  this.studentsService.getStudents().subscribe({  // ❌ LLAMADA SIN PARÁMETROS
    next: (data) => {
      this.students = data;
      this.loading = false;
    },
    error: (err) => {
      this.error = 'Error al cargar estudiantes';
      this.loading = false;
    }
  });
}
```

**Problema:** La firma del servicio es:
```typescript
getStudents(idCampus: number, idCourse: number): Observable<any>
```

Pero se llama sin argumentos. Esto causará un error en tiempo de ejecución.

---

## 3. Componentes que usan getSemesters()

### Componentes que LO USAN:

#### **[src/app/domains/schoolYear/components/semester/semester.component.ts](src/app/domains/schoolYear/components/semester/semester.component.ts#L61)**
```typescript
loadData(companyId?: number) {
  const id = companyId ?? this.idCompany();
  if (id === 0) return;

  this.semesterService.getSemesters(id).subscribe({
    next: (response) => {
      const data = Array.isArray(response) ? response : (response?.data || []);
      this.rowData.set(data);
    },
    error: (error) => {
      console.error('Error en la solicitud:', error);
    }
  });
}
```

**Cómo obtiene el parámetro:**
- Usa una variable `computed` que obtiene `idCompany` del sidebar:
```typescript
protected readonly idCompany = computed(() => 
  this.signalsService.getRootSelectedBySidebar() ?? 0
);
```

#### **[src/app/domains/schoolYear/schedule/schedule.component.ts](src/app/domains/schoolYear/schedule/schedule.component.ts#L39)**
```typescript
this.semesterService.getSemesters().subscribe({
  // ...
});
```

**⚠️ PROBLEMA:** También se llama sin parámetros aquí (pero debería recibir `idCompany`).

---

## 4. Servicios que gestionan el contexto del usuario

### **[SignalsService](src/app/service/signals.service.ts)** - GESTOR PRINCIPAL

Es el **servicio central** que gestiona todo el contexto:

**Signals almacenadas:**
```typescript
private rootSelectedBySidebar = signal<number | null>(this.getStoredNumber('company'));
private branchSelectedBySidebar = signal<number | null>(this.getStoredNumber('branch'));
private CourseSelectedBySidebar = signal<number | null>(this.getStoredNumber('course'));
```

**Métodos para actualizar:**
- `setRootSelectedBySidebar(id: number)` → guarda `company` en localStorage
- `setBranchSelectedBySidebar(id: number)` → guarda `branch` en localStorage
- `setCourseSelectedBySidebar(id: number)` → guarda `course` en localStorage

**Métodos para obtener:**
- `getRootSelectedBySidebar()` → retorna `idCompany`
- `getBranchSelectedBySidebar()` → retorna `idCampus`
- `getCourseSelectedBySidebar()` → retorna `idCourse`

---

### **[TrackingService](src/app/service/tracking.service.ts)** - GESTOR AUXILIAR

Gestiona datos de seguimiento y también almacena algunos contextos:

**Métodos relacionados:**
```typescript
setCompany(company: string): void {
  this.companyser = company;
  localStorage.setItem('company', this.companyser);
}

getCompany(): string {
  return this.companyser;
}

setBranch(branch: string): void {
  this.branchser = branch;
  localStorage.setItem('branch', this.branchser);
}

getBranch(): string {
  const storedBranch = localStorage.getItem('branch');
  this.branchser = storedBranch !== null ? storedBranch : '';
  return this.branchser;
}

getEmail(): string {
  const storedEmail = localStorage.getItem('mail');
  this.emailser = storedEmail !== null ? storedEmail : '';
  return this.emailser;
}
```

---

## 5. Servicios de datos (que consumen los contextos)

### **[StudentService](src/app/service/student.service.ts)**
```typescript
getStudents(idCampus: number, idCourse: number): Observable<any> {
  return this.http.get(
    `${environment.urlEduControl}/Students?idCampus=${idCampus}&idCourse=${idCourse}`, 
    { headers: this.trackingService.getHeaders() }
  );
}

getListStudents(idCampus: number, idCourse: number, grado: string, grupo: string): Observable<any> {
  return this.http.get(
    `${environment.urlEduControl}/Students/list?idCampus=${idCampus}&idCourse=${idCourse}&grado=${grado}&grupo=${grupo}`, 
    { headers: this.trackingService.getHeaders() }
  );
}
```

### **[SemesterService](src/app/service/semester.service.ts)**
```typescript
getSemesters(idCompany: number): Observable<any> {
  return this.http.get(
    `${environment.urlEduControl}/Semester?idCompany=${idCompany}`, 
    { headers: this.trackingService.getHeaders() }
  );
}
```

### **[CoursesService](src/app/service/courses.service.ts)**
Usa `idCompany` para obtener cursos:
```typescript
// Comentado pero muestra el patrón:
// const apiUrl = `${environment.urlEduControl}/Courses?idCompany=${idroot}`;
```

### **[BranchsService](src/app/service/branchs.service.ts)**
```typescript
// Usa idCompany para obtener branches
getBranchesByUserAndCompany(idUser: number, idCompany: number): Observable<any> {
  return this.http.get(
    `${environment.urlSmp}/SmpandSecurity/Branch?idUser=${idUser}&idRoot=${idCompany}`, 
    { headers: this.trackingService.getHeaders() }
  );
}
```

---

## 6. Flujo de uso del contexto

```
┌─────────────────────────────────────────────┐
│      LOGIN / SELECCIÓN EN SIDEBAR            │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│   SignalsService.setBranchSelectedBySidebar() │
│   SignalsService.setCourseSelectedBySidebar() │
│   SignalsService.setRootSelectedBySidebar()   │
└────────────────┬────────────────────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
    localStorage     Signal en memoria
    'company'        (reactivo)
    'branch'
    'course'
         │
         ▼
┌─────────────────────────────────────────────┐
│   Componentes leen SignalsService            │
│   - students.component.ts                    │
│   - semester.component.ts                    │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│   Llamadas a servicios de datos:            │
│   - StudentService.getStudents()            │
│   - SemesterService.getSemesters()          │
│   - CoursesService.getCoursesVigentes()     │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│   API REST con parámetros en query string   │
│   /Students?idCampus={id}&idCourse={id}     │
│   /Semester?idCompany={id}                  │
└─────────────────────────────────────────────┘
```

---

## 7. Resumen de PROBLEMAS encontrados

| Problema | Ubicación | Severidad | Descripción |
|----------|-----------|-----------|------------|
| `getStudents()` sin parámetros | kardex.component.ts:35 | 🔴 ALTO | Llamada sin `idCampus` ni `idCourse` |
| `getSemesters()` sin parámetros | schedule.component.ts:39 | 🔴 ALTO | Llamada sin `idCompany` |
| Inconsistencia en StorageService | Dual (Signals + Tracking) | 🟡 MEDIO | Dos servicios guardan en localStorage |

---

## 8. Recomendaciones

1. **Corregir kardex.component.ts**: Obtener `idCampus` e `idCourse` del sidebar
2. **Corregir schedule.component.ts**: Obtener `idCompany` del sidebar
3. **Centralizar contexto**: Usar solo `SignalsService` (eliminar redundancia en TrackingService)
4. **Tipado fuerte**: Crear una interfaz `UserContext` con idCompany, idCampus, idCourse
