/**
 * @Author: Alex Sorafumo
 * @Date:   17/10/2016 4:10 PM
 * @Email:  alex@yuion.net
 * @Filename: simple.component.ts
 * @Last modified by:   Alex Sorafumo
 * @Last modified time: 01/02/2017 1:37 PM
 */

import { CommsService } from '@acaprojects/ngx-composer';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

import { AppService } from '../../services/app.service';
import { MapPinComponent, MapRangeComponent } from '@acaprojects/ngx-widgets';

@Component({
    selector: 'people',
    styleUrls: ['./people.style.scss'],
    templateUrl: './people.template.html',
})
export class PeopleComponent {
    public model: any = {};
    public timers: any = {};

    constructor(private app_service: AppService, private route: ActivatedRoute) {
        this.model.map = {};
        this.model.active_level = {};
        this.model.user = {};
        this.route.params.subscribe((params) => {
            if (params.sys_id) {
                this.model.system = params.sys_id;
                this.app_service.system = this.model.system;
            }
            if (params.level_id) {
                for (const lvl of this.model.levels) {
                    if (lvl.id === params.level_id) {
                        this.setLevel(lvl);
                        break;
                    }
                }
            }
        });
    }

    public ngOnInit() {
            // Listen to the state of the selected building
        this.app_service.Buildings.listen((bld) => {
            if (bld) {
                    // Update level list
                this.model.levels = bld.levels || [];
                this.model.system = bld.systems ? bld.systems.desks : '';
                if (this.model.levels && this.model.levels.length > 0) {
                        // Default to first level of the building
                    this.setLevel(this.model.levels[0]);
                }
            }
        });
        this.init();
    }

    public init() {
        this.model.user = this.app_service.Users.current() || {};
        if (!this.model.user) {
            return setTimeout(() => this.init(), 300);
        }
    }

    public setLevel(lvl: any) {
        this.model.active_level = lvl;
        this.model.lvl_index = this.model.levels.indexOf(lvl);
        this.updatePointsOfInterest();
    }

    public filter() {
        if (this.model.search) {
            if (this.model.search.length === 1 && !this.model.filtered_users) {
                this.app_service.Users.search(this.model.search).then((list) => {
                    this.model.people_list = list || [];
                    this.model.filtered_users = this.app_service.Users.getFilteredUsers(this.model.search, this.model.people_list);
                }, (err) => this.model.filtered_users = []);
            } else {
                this.model.filtered_users = this.app_service.Users.getFilteredUsers(this.model.search, this.model.people_list);
            }
        } else {
            this.model.people_list = [];
            this.model.filtered_users = null;
        }
    }

    public find(user: any) {
        if (user) {
            this.model.found_user = user;
            this.app_service.Users.location(user.id).then((location) => {
                this.model.found_user.location = location;
                console.log('Levels:', this.model.levels, location.level);
                for (const lvl of this.model.levels) {
                    if (location.level === lvl.id) {
                        this.setLevel(lvl);
                        break;
                    }
                }
                this.updatePointsOfInterest();
                this.model.search = '';
                this.filter();
            }, (err) => {
                this.model.found_user.location = {};
                this.updatePointsOfInterest();
                this.model.search = '';
                this.filter();
            });
        }
    }

    public updateDeskMarkers() {
        if (this.timers.desks) {
            clearTimeout(this.timers.desks);
            this.timers.desks = null;
        }
        this.timers.desks = setTimeout(() => {
            if (this.model.desks) {
                this.model.map.poi = [];
                const u_desk = this.model.user_desk;
                const list = this.model.desk_list || [];
                const styles = {};
                for (const desk_label of this.model.desks) {
                    if (desk_label) {
                        const desk = `${desk_label}`;
                        const desk_obj = {
                            level: this.model.active,
                            id: desk,
                            name: `Desk ${desk_label.split('-')[1]}`,
                        };
                        const in_use = list && list.indexOf(desk_label) >= 0;
                        const users_desk = u_desk && u_desk.connected && u_desk.desk_id === desk_label;
                        styles[desk] = {
                            fill: '#C0E6FF',
                            stroke: '#57ACEE',
                        };
                        if (in_use) {
                            styles[desk].fill = users_desk ? '#f6d5ae' : '#fff';
                            styles[desk].stroke = users_desk ? '#d4b38c' : '#b7bbc4';
                        }
                    }
                }
                this.model.map.styles = JSON.parse(JSON.stringify(styles));
                this.updatePointsOfInterest();
            }
            this.timers.desks = null;
        }, 50);
    }

    public clearUser() {
        this.model.found_user = null;
        this.updatePointsOfInterest();
    }

    public updatePointsOfInterest() {
        this.model.map.poi = [];
        if (this.model.found_user && this.model.found_user.location && this.model.found_user.location.level) {
            if (this.model.found_user.location.level === this.model.active_level.id) {
                const loc = this.model.found_user.location;
                this.model.map.poi.push({
                    id: loc.map_id || 'person',
                    cmp: loc.fixed ? MapPinComponent : MapRangeComponent,
                    coordinates: !loc.fixed ? { x: loc.x, y: loc.y } : null,
                    data: { text: `${this.model.found_user.name} is here` }
                });
            }
        }
    }

}
