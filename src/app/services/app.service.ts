/**
 * @Author: Alex Sorafumo <alex.sorafumo>
 * @Date:   12/01/2017 2:25 PM
 * @Email:  alex@yuion.net
 * @Filename: app.service.ts
 * @Last modified by:   Alex Sorafumo
 * @Last modified time: 03/02/2017 10:25 AM
 */

import { SystemsService, CommsService, OAuthService } from '@acaprojects/ngx-composer';
import { OverlayService } from '@acaprojects/ngx-widgets';

import { Location } from '@angular/common';
import { Inject, Injectable, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

import { SettingsService } from './settings.service';
import { Utils } from '../shared/utility.class';

import { BuildingsService } from './data/buildings.service';
import { UsersService } from './data/users.service';
import { RoomsService } from './data/rooms.service';
import { BookingsService } from './data/bookings.service';

@Injectable()
export class AppService {
    private api_base = 'api/staff';

    private _system = '';
    private subjects: any = {};
    private observers: any = {};

    private prev_route: string[] = [];
    private model: any = {};
    private timers: any = {};

    constructor(private _title: Title,
        private version: SwUpdate,
        private router: Router,
        private location: Location,
        private route: ActivatedRoute,
        private overlay: OverlayService,
        private settings: SettingsService,
        private bookings: BookingsService,
        private buildings: BuildingsService,
        private rooms: RoomsService,
        private users: UsersService,
        // private comms: CommsService
        private systems: SystemsService
    ) {
        this.bookings.parent = this.buildings.parent = this;
        this.rooms.parent = this.users.parent = this;
        this.init();
        this.subjects.system = new BehaviorSubject('');
        this.observers.system = this.subjects.system.asObservable();
        this.subjects.systems = new BehaviorSubject<any[]>([]);
        this.observers.systems = this.subjects.systems.asObservable();
    }

    get endpoint() {
        const host = this.Settings.get('composer.domain');
        const protocol = this.Settings.get('composer.protocol');
        const port = ((protocol === 'https:') ? '443' : '80');
        const url = `${protocol || location.protocol}//${host || location.host}`;
        const endpoint = `${url}`;
        return endpoint;
    }

    get api_endpoint() {
        return `${this.endpoint}/${this.api_base}`;
    }

    public init() {
        if (!this.settings.setup) {
            return setTimeout(() => this.init(), 500);
        }
        this.version.available.subscribe(event => {
            this.settings.log('CACHE', `Update available: current version is ${event.current.hash} available version is ${event.available.hash}`);
            this.info('Newer version of the app is available', 'Refresh');
        });
        this.version.activated.subscribe(event => {
            console.log('Activated service worker');
        });
        this.model.title = this.settings.get('app.title') || 'Angular Application';
        this.initialiseComposer();
        // this.loadSystems();
        setInterval(() => this.checkCache(), 5 * 60 * 1000);
            // Initialise services
        this.buildings.init();
        this.users.init();
        this.rooms.init();
    }

    public initialiseComposer(tries: number = 0) {
        this.settings.log('SYSTEM', 'Initialising Composer...');
            // Get domain information for configuring composer
        const host = this.settings.get('composer.domain') || location.hostname;
        const protocol = this.settings.get('composer.protocol') || location.protocol;
        const port = (protocol.includes('https') ? '443' : '80');
        const url = `${protocol}//${host}`;
        const route = this.settings.get('composer.route') || '';
            // Generate configuration for composer
        const config: any = {
            id: 'AcaEngine',
            scope: 'public',
            protocol, host, port,
            oauth_server: `${url}/auth/oauth/authorize`,
            oauth_tokens: `${url}/auth/token`,
            redirect_uri: `${location.origin}${route}/oauth-resp.html`,
            api_endpoint: `${url}/control/`,
            proactive: true,
            login_local: this.settings.get('composer.local_login') || false,
            http: true,
        };
            // Enable mock/development environment if the settings is defined
        const env = this.settings.get('env');
        if (env && env.includes('dev')) {
            config.port = '3000';
            config.mock = true;
            config.http = false;
        }
            // Setup/Initialise composer
        this.systems.setup(config);
    }

    public initSystem(sys: string) {
        this._system = sys;
        if (!this._system || this._system === '') {
            if (localStorage) {
                this._system = localStorage.getItem('ACA.CONTROL.system');
                if (this.subjects.system) {
                    console.log('Emit System:', sys);
                    this.subjects.system.next(this._system);
                }
            }
            if (!this._system || this._system === '') {
                this.navigate('bootstrap');
            } else {
                this.navigate('');
            }
        } else {
            if (this.subjects.system) {
                console.log('Emit System:', sys);
                this.subjects.system.next(this._system);
            }
        }
    }

    public listen(name: string, next: (data: any) => void) {
        if (this.subjects[name]) {
            return this.observers[name].subscribe(next);
        }
        return null;
    }

    public get(name: string) {
        if (this.subjects[name]) {
            return this.subjects[name].getValue();
        }
        return null;
    }

    get Settings() { return this.settings; }
    get Overlay() { return this.overlay; }
    get Bookings() { return this.bookings; }
    get Buildings() { return this.buildings; }
    get Rooms() { return this.rooms; }
    get Users() { return this.users; }
    get system() { return this.subjects.system.getValue(); }
    set system(value: string) { this.subjects.system.next(value); }


    set title(str: string) {
        if (!this.model.title) {
            this.model.title = this.settings.get('app.title') || '';
        }
        const title = `${str ? str : ''}${this.model.title ? ' | ' + this.model.title : ''}`;
        this._title.setTitle(title || this.settings.get('app.title'));
    }

    public navigate(path: string, query?: any) {
        const path_list = [];
        path_list.push(path);
        this.prev_route.push(this.router.url);
        // if (!this.systems.resources.authLoaded) {
        this.router.navigate(path_list, { queryParams: query });
        // } else {
        // this.router.navigate([path]);
        // }
    }

    public back() {
        if (this.prev_route.length > 0) {
            this.navigate(this.prev_route.pop());
            this.prev_route.pop();
        } else {
            this.navigate('');
        }
    }

    public log(type: string, msg: string, args?: any, stream: string = 'debug') {
        this.settings.log(type, msg, args, stream);
    }

    public error(msg: string, action: string) {
        const message = msg ? msg : `Error`;
        this.overlay.notify('success', {
            innerHtml: `
            <div class="display-icon error" style="font-size:2.0em"></div><
            div>${message}</div>`,
            name: 'error-notify',
        });
    }

    public success(msg: string, action: string) {
        const message = msg ? msg : `Success`;
        this.overlay.notify('success', {
            innerHtml: `
            <div class="display-icon success" style="font-size:2.0em"></div>
            <div>${message}</div>`,
            name: 'success-notify',
        });
    }

    public info(msg: string, action: string) {
        const message = msg ? msg : `Information`;
        this.overlay.notify('info', {
            innerHtml: `
            <div class="display-icon info" style="font-size:2.0em"></div>
            </div><div>${message}</div>`,
            name: 'info-notify',
        });
    }

    get iOS() {
        return Utils.isMobileSafari();
    }

    public getSystem(id: string) {
        const system_list = this.subjects.systems.getValue();
        if (system_list) {
            for (const system of system_list) {
                if (system.id === id) {
                    return system;
                }
            }
        }
        return {};
    }

    private addSystems(list: any[]) {
        const system_list = this.subjects.systems.getValue().concat(list);
        system_list.sort((a, b) => a.name.localeCompare(b.name));
        this.subjects.systems.next(system_list);
    }

    private loadSystems(tries: number = 0) {
        if (this.timers.system) {
            clearTimeout(this.timers.system);
            this.timers.system = null;
        }
        if (tries > 20) { return; }
        const systems = this.systems.resources.get('System');
        if (systems) {
            tries = 0;
            systems.get({ offset: '0', limit: 500 }).then((sys_list: any) => {
                this.subjects.systems.next([]);
                if (sys_list) {
                    const count = sys_list.total;
                    if (count > 500) {
                        const iter = Math.ceil((count - 500) / 500);
                        for (let i = 0; i < iter; i++) {
                            systems.get({ offset: (i + 1) * 500, limit: 500 }).then((list: any) => {
                                if (list) {
                                    this.addSystems(list.results);
                                }
                            });
                        }
                    }
                    this.addSystems(sys_list.results);
                } else {
                    this.timers.system = setTimeout(() => this.loadSystems(tries), 200 * ++tries);
                }
            }, (err: any) => {
                this.timers.system = setTimeout(() => this.loadSystems(tries), 200 * ++tries);
            });
        } else {
            this.timers.system = setTimeout(() => this.loadSystems(tries), 200 * ++tries);
        }
    }

    private checkCache() {
        if (this.version.isEnabled) {
            this.settings.log('SYSTEM', 'Checking cache for updates');
            this.version.checkForUpdate()
                .then(() => this.settings.log('SYSTEM', 'Finished checking cache for updates'))
                .catch(err => this.settings.log('SYSTEM', err, null, 'error'));
        }
    }

}
