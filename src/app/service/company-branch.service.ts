import { Injectable, computed, signal } from '@angular/core';
import { Company } from '../interface/company.interface';
import { Branch } from '../interface/branch.interface';

@Injectable({
  providedIn: 'root',
})
export class CompanyBranchService {
  private companies = signal<Company[]>([]);
  private branches = signal<Branch[]>([]);
  private selectedCompanyId = signal<number | null>(null);
  private selectedBranchId = signal<number | null>(null);

  public companies$ = computed(() => this.companies());
  public branches$ = computed(() => this.branches());
  public selectedCompanyId$ = computed(() => this.selectedCompanyId());
  public selectedBranchId$ = computed(() => this.selectedBranchId());

  public selectedCompany$ = computed(() => {
    const id = this.selectedCompanyId();
    return this.companies().find((company) => company.id === id) || null;
  });

  public selectedBranch$ = computed(() => {
    const id = this.selectedBranchId();
    return this.branches().find((branch) => branch.id === id) || null;
  });

  public setCompanies(companies: Company[]): void {
    this.companies.set(companies);
  }

  public setBranches(branches: Branch[]): void {
    this.branches.set(branches);
  }

  public clearBranches(): void {
    this.branches.set([]);
    this.selectedBranchId.set(null);
  }

  public selectCompany(companyId: number): void {
    this.selectedCompanyId.set(companyId);
    this.selectedBranchId.set(null);
  }

  public selectBranch(branchId: number | null): void {
    this.selectedBranchId.set(branchId);
  }

  public getSelectedCompany(): Company | null {
    return this.selectedCompany$();
  }

  public getSelectedBranch(): Branch | null {
    return this.selectedBranch$();
  }

  public reset(): void {
    this.companies.set([]);
    this.branches.set([]);
    this.selectedCompanyId.set(null);
    this.selectedBranchId.set(null);
  }
}
