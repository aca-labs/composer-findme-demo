import { CommsService } from '@acaprojects/ngx-composer';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';

// import { NameFormat } from '../../shared/pipes/name-format.pipe';

import * as faker from 'faker';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { IBuilding, ILevel } from './buildings.service';

export interface IUser {
    id: string;
    name: string;
    email: string;
    win_id?: string;
    type?: 'partner' | 'internal' | 'external';
    role?: string;
    state?: string;
    location?: ILocation | string | {};
    image: string;
    phone?: string;
    staff_code?: string;
    b_unit?: string;
}

export interface ILocation {
    x: number;
    y: number;
    map_id: string;
    building: string | IBuilding;
    level: string | ILevel;
    fixed: boolean;
    loc_id: string;
}

@Injectable()
export class UsersService {
    public parent: any = null;

    private model: any = {};
    private timers: any = {};
    private promises: any = {};
    private subjects: any = {};
    private observers: any = {};

    constructor(private http: CommsService, private router: Router) {
        this.subjects.user_list = new BehaviorSubject<IUser[]>([]);
        this.observers.user_list = this.subjects.user_list.asObservable();
        this.subjects.user = new BehaviorSubject<IUser>(null);
        this.observers.user = this.subjects.user.asObservable();
    }

    public init() {
        this.loadActiveUser();
        this.loadUsers();
    }

    public current() {
        return this.subjects.user ? this.subjects.user.getValue() : null;
    }

    public list() {
        return this.subjects.user_list ? this.subjects.user_list.getValue() : [];
    }

    public listen(next: (data: any) => void) {
        return this.subjects.user_list ? this.observers.user_list.subscribe(next) : null;
    }

    // returns Users in an alphabetical order - first name
    public getUsers() {
        const list = this.subjects.user_list.getValue();
        const users = this.model.users.sort((a, b) => a.name.localeCompare(b.name));
        return users ? JSON.parse(JSON.stringify(users)) : [];
    }

    public get(id: string, mutable: boolean = false) {
        const list = this.subjects.user_list.getValue();
        for (const usr of list) {
            if (usr.email === id || usr.id === id || usr.staff_code === id || usr.win_id === id) {
                return mutable ? usr : JSON.parse(JSON.stringify(usr));
            }
        }
        return null;
    }

    public location(id: string) {
        if (!this.promises.location) { this.promises.location = {}; }
        if (!this.promises.location[id]) {
            this.promises.location[id] = new Promise((resolve, reject) => {
                const user = this.get(id, true);
                if (user) {
                    const url = `${this.parent.api_endpoint}/people/${user.id}?desk=${user.win_id}`;
                    let location: any = null;
                    this.http.get(url).subscribe((data) => {
                        location = data ? data[0] : {};
                    }, (err) => {
                        reject(err);
                        this.promises.location[id] = null;
                    },
                    () => {
                        if (!location || Object.keys(location).length <= 0) {
                            this.updateUserLocation(id, {});
                            reject('User not found');
                        } else {
                            user.location = {
                                level: location.level,
                                building: location.building,
                                name: 'WiFi',
                                fixed: true,
                            };
                            if (location.x && location.y) {
                                user.location.fixed = false;
                                user.location.x = (10000 / location.x_max) * location.x;
                                user.location.y = (10000 / location.x_max) * location.y;
                            } else if (location.at_desk) {
                                user.location.map_id = `${location.desk_id}`;
                                user.location.name = `${location.desk_id.indexOf('area-') < 0 ? 'Desk ' + location.desk_id.split('-')[1] : 'In their office'}`;
                                user.location.id = location.desk_id;
                            }
                            this.updateUserLocation(id, user.location);
                            resolve(user.location);
                        }
                        this.promises.location[id] = null;
                    });
                }
            });
        }
        return this.promises.location[id];
    }

    public updateUserLocation(id, data) {
        const list = this.subjects.user_list.getValue();
        for (const user of list) {
            if (user.id === id) {
                user.location = data;
            }
        }
    }

    public getFilteredUsers(filter: string, items?: any[]) {
        let users: any[];
        const filters = filter.toLowerCase().split(' ');
        const list = {};
        for (const f of filters) {
            if (f) {
                if (!list[f]) { list[f] = 0; }
                list[f]++;
            }
        }
        const parts = [];
        for (const f in list) {
            if (list.hasOwnProperty(f)) {
                parts.push({ word: f, count: list[f], regex: new RegExp(f, 'gi') });
            }
        }
        const user_list = JSON.parse(JSON.stringify(items || this.subjects.user_list.getValue()));
        users = user_list.filter(
            (user) => {
                let name_index = 65535;
                let email_index = 65535;
                let match_count = 0;
                const name = user.name.toLowerCase();
                const email = user.email.toLowerCase();
                for (const i of parts) {
                    if (i.word) {
                        const n_index = name.indexOf(i.word);
                        const n_matches = (name.match(i.regex) || []).length;
                        if (n_index < name_index) {
                            name_index = n_index;
                        }
                        const e_index = email.indexOf(i.word);
                        const e_matches = (email.match(i.regex) || []).length;
                        if (e_index < email_index) {
                            email_index = e_index;
                        }
                        if (n_matches >= i.count || e_matches >= i.count) {
                            match_count++;
                        }
                    }
                }
                user.match_index = name_index >= 0 ? name_index : (email_index >= 0 ? email_index : -1);
                user.match = name_index >= 0 ? 'name' : (email_index >= 0 ? 'email' : '');
                return user.match_index >= 0 && (match_count >= parts.length);
            });
        users.sort((a, b) => {
            const diff = a.match_index - b.match_index;
            return diff === 0 ? a.name.localeCompare(b.name) : diff;
        });
        for (const user of users) {
            const match = user.match === 'name' ? user.name.split(' ') : user.email.split(' ');
            for (const i of parts) {
                let changed = 0;
                for (const k of match) {
                    if (changed >= i.count) { break; }
                    if (k.toLowerCase().indexOf(i.word) >= 0 && k.indexOf('`') < 0) {
                        match[match.indexOf(k)] = k.replace(i.regex, '`$&`');
                        changed++;
                    }
                }
            }
            user.match === 'name' ? user.match_name = match.join(' ') : user.match_email = match.join(' ');
        }
        return users;
    }

    public updateActiveUserLocation() {
        const person = this.current();
        if (person) {
            this.location(person.id).then(
                (loc) => this.subjects.user.next(this.get(person.id)),
                (err) => console.error(err)
            );
        }
    }

    public search(email: string, limit: number = 9999) {
        if (!this.promises.search) { this.promises.search = {}; }
        if (!this.promises.search[`${email}|${limit}`]) {
            this.promises.search[`${email}|${limit}`] = new Promise((resolve, reject) => {
                const url = `${this.parent.api_endpoint}/users?q=${email}${limit ? '&limit=' + limit : ''}`;
                this.http.get(url).subscribe(
                    (resp: any) => {
                        const user_list = [];
                        for (const usr of resp) {
                            user_list.push(this.processStaffMember(usr));
                        }
                        resolve(user_list);
                        this.promises.search[`${email}|${limit}`] = null;
                    }, (err) => {
                        this.promises.search[`${email}|${limit}`] = null;
                        reject(err);
                    });
            });
        }
        return this.promises.search[`${email}|${limit}`];
    }

    private loadActiveUser(tries: number = 0) {
        if (tries > 10) { return; }
        let user = null;
        this.http.get(`${this.parent.endpoint}/control/api/users/current`).subscribe(
            (data: any) => user = data,
            (err) => setTimeout(() => this.loadActiveUser(tries), 200 * ++tries),
            () => {
                this.subjects.user.next(user);
                const user_data = this.get(user.email);
                if (!user_data) {
                    this.search(user.email, 1).then((list: IUser[]) => {
                        if (list && list.length) {
                            const person = list[0];
                            this.location(person.id).then(
                                (loc) => this.model.active_user = this.get(person.id),
                                (err) => console.error(err)
                            );
                            this.subjects.user.next(person);
                        }
                    }, (err) => console.error(err));
                } else {
                    this.location(user_data.id).then(
                        (loc) => this.model.active_user = this.get(user_data.id),
                        (err) => console.error(err)
                    );
                    this.subjects.user.next(user_data);
                }
            },
        );
    }

    private loadUsers(tries: number = 0) {
        if (tries > 10) { return; }
        const now = new Date();
        if (localStorage) {
            const user_list = localStorage.getItem('STAFF.user_list');
            const expiry = localStorage.getItem('STAFF.user_list.expiry');
            if (user_list && +expiry > now.getTime()) {
                this.subjects.user_list.next(JSON.parse(user_list));
                return;
            }
        }
        this.search('a').then((list) => {
            this.subjects.user_list.next(list);
            if (localStorage) {
                const time = this.parent.Settings.get('user_expiry');
                localStorage.setItem('STAFF.user_list', JSON.stringify(this.subjects.user_list.getValue()));
                localStorage.setItem('STAFF.user_list.expiry', (now.getTime() + (+time || 1) * 24 * 60 * 60 * 1000).toString());
            }
        }, (err) => setTimeout(() => this.loadUsers(tries), 200 * ++tries));
    }

    private processStaffMember(user: any) {
        if (user) {
            const member: IUser = {
                id: user.id || user.email,
                win_id: user.email,
                name: user.name,
                type: user.title ? (user.title.toLowerCase() === 'partner' ? 'partner' : 'internal') : 'external',
                image: `${this.parent.endpoint}/assets/users/${user.id}.png`,
                email: user.email,
                location: {},
                phone: user.phone,
                b_unit: user.department,
                staff_code: user.staff_code
            };
            return member;
        } else {
            return null;
        }
    }

}
