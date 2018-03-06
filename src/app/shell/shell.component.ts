/**
 * @Author: Alex Sorafumo
 * @Date:   17/10/2016 4:10 PM
 * @Email:  alex@yuion.net
 * @Filename: simple.component.ts
 * @Last modified by:   Alex Sorafumo
 * @Last modified time: 01/02/2017 1:37 PM
 */

import { Component, OnInit } from '@angular/core';

import { AppService } from '../services/app.service';

import * as moment from 'moment';

@Component({
    selector: 'app-shell',
    styleUrls: ['./shell.styles.scss'],
    templateUrl: './shell.template.html',
})
export class AppShellComponent implements OnInit {

    public model: any = {};
    public logo: any = {};
    public timers: any = {};

    constructor(private app_service: AppService) { }

    public ngOnInit() {
        this.model.year = moment().format('YYYY');
        this.init();
    }

    public init() {
        if (!this.app_service.Settings.setup) {
            return setTimeout(() => this.init(), 200);
        }
        this.app_service.listen('system', (sys) => {
            this.model.system = sys;
        });
        this.logo.type = this.app_service.Settings.get('app.logo_type');
        this.logo.src = this.app_service.Settings.get('app.logo');
    }

}
