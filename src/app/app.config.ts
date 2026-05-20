import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LicenseManager } from 'ag-grid-enterprise';

import { routes } from './app.routes';

// Inicializar licencia de AG Grid Enterprise
function initializeAgGridLicense() {
  LicenseManager.setLicenseKey("Using_this_{AG_Grid}_Enterprise_key_{AG-063297}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{CONSULTORIA_Y_SERVICIOS_HCO}_is_granted_a_{Single_Application}_Developer_License_for_the_application_{SMP}_only_for_{1}_Front-End_JavaScript_developer___All_Front-End_JavaScript_developers_working_on_{SMP}_need_to_be_licensed___{SMP}_has_not_been_granted_a_Deployment_License_Add-on___This_key_works_with_{AG_Grid}_Enterprise_versions_released_before_{10_July_2025}____[v3]_[01]_MTc1MjEwMjAwMDAwMA==e7594d446af21f5c2ae8ef1591bfc6b9");
  return () => {};
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAgGridLicense,
      multi: true
    }
  ]
};
