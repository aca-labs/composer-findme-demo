
import { RouterModule, Routes } from '@angular/router';
import { AppShellComponent } from './shell/shell.component';
import { PeopleComponent } from './shell/people/people.component';

export const ROUTES: Routes = [
    { path: '', component: AppShellComponent, children: [
        { path: '', component: PeopleComponent },
        { path: ':level_id', component: PeopleComponent }
    ] },
    { path: '**',      redirectTo: '' },
];
