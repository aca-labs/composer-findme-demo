/*
 * @Author: Alex Sorafumo
 * @Date: 2017-06-05 12:39:28
 * @Last Modified by: Alex Sorafumo
 * @Last Modified time: 2018-03-06 11:00:28
 */

import { CommsService } from '@acaprojects/ngx-composer';
import { Injectable, NgZone } from '@angular/core';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { ILevel } from './buildings.service';

import * as moment from 'moment';

export interface IRoom {
    id: string;
    name: string;
    email: string;
    equipment: string;
    level: ILevel | {};
    map_id: string;
    bookable: boolean;
    features: string;
    bookings: IBooking[];
    capacity: number;
    catering: boolean;
    images: string[];
    in_use: boolean;
    next: IBooking;
    last_update: number;
}

interface IBooking {
    booking_id: string;
    end_date: string;
    start_date: string;
    title: string;
    support_url: string;
}

@Injectable()
export class RoomsService {
    public parent: any = null;
    public sub: any = {};
    private last_query: any = null;
    private promises: any = {
        search: {},
        list: null,
    };
    private results: any = {
        search: {},
    };
    private model: any = {};
    private subjects: any = {};
    private observers: any = {};
    private timers: any = {};
    private state: any = {};

    constructor(private http: CommsService, private zone: NgZone) {
        this.subjects.search = new BehaviorSubject([]);
        this.observers.search = this.subjects.search.asObservable();
        this.sub.search = (next: any, err?: any, complete?: any) => {
            this.observers.search(next, err, complete);
            this.subjects.search.next(this.lastResults());
        };
        this.subjects.rooms = new BehaviorSubject([]);
        this.observers.rooms = this.subjects.rooms.asObservable();
        this.subjects.selected = new BehaviorSubject<any>({});
        this.observers.selected = this.subjects.rooms.asObservable();
    }
    /**
     *
     */
    public init() {
        this.model.loaded = false;
        this.parent.Buildings.listen((bld) => {
            if (bld) {
                if (localStorage) {
                    this.last_query = localStorage.getItem('CLIENT_APP.last_search');
                    if (this.last_query && this.last_query !== '') {
                        this.last_query = JSON.parse(this.last_query);
                        if (this.last_query.id !== '') {
                            this.last_query.id = '';
                            this.search(this.last_query).then(() => null, () => null);
                        }
                    }
                }
                this.updateRooms();
                this.zone.runOutsideAngular(() => {
                    if (this.timers.update) {
                        clearInterval(this.timers.update);
                        this.timers.update = null;
                    }
                    this.timers.update = setInterval(() => this.updateRoomState(), 20 * 1000);
                });
            }
        });
    }

    public updateRooms() {
        this.zone.runOutsideAngular(() => {
            const now = moment();
            if (!this.state.last_room_update || now.unix() > this.state.last_room_update.unix() + 5 * 60) {
                this.parent.log('BOOK(S)', 'Updating room listings.');
                this.state.last_room_update = now;
                // Load all rooms
                this.search({}).then(
                    (list: any) => {
                        this.model.loaded = true;
                        this.zone.run(() => {
                            this.subjects.rooms.next(list);
                        });
                    },
                    () => null
                );
                if (this.timers.rooms) {
                    clearTimeout(this.timers.rooms);
                    this.timers.rooms = null;
                }
                this.timers.rooms = setTimeout(() => this.updateRooms(), 5.01 * 60 * 1000);
            }
        });
    }

    public updateRoomState() {
        if (this.subjects.rooms) {
            const room_list = this.list();
            for (const room of room_list) {
                room.next = this.nextBooking(room.bookings);
                room.in_use = !!this.checkState(room.bookings) || !room.bookable;
            }
            this.subjects.rooms.next(room_list);
        }
    }

    public list() {
        return this.subjects.rooms.getValue();
    }

    public getRoom(id: string) {
        if (id && this.subjects[`room_${id}`]) {
            return this.subjects[`room_${id}`].getValue();
        } else {
            const list = this.list();
            for (const room of list) {
                if (room.id === id) {
                    return room;
                }
            }
        }
        return null;
    }

    public search(fields?: any) {
        const bld = this.parent.Buildings.current();
        if (!bld) {
            return new Promise((resolve, reject) => {
                setTimeout(() => this.search(fields).then((data) => resolve(data), (err) => reject(err)), 200);
            });
        }
        let query = '';
        if (fields) {
            for (const f in fields) {
                if (fields[f]) {
                    query += `${query === '' ? '' : '&'}${f}=${fields[f]}`;
                }
            }
        }
        if (query !== '') {
            this.last_query = JSON.parse(JSON.stringify(fields));
            this.last_query.id = query;
            if (localStorage) {
                localStorage.setItem('STAFF.last_search', JSON.stringify(this.last_query));
            }
        }
        if (!this.promises.search[query]) {
            this.promises.search[query] = new Promise((resolve, reject) => {
                const url = `${this.parent.api_endpoint}/rooms?${query}`;
                this.http.get(url).subscribe(
                    (rooms: any) => {
                        const rm_list = this.processRooms(rooms);
                        this.results.search[query] = this.merge(rm_list);
                    },
                    err => {
                        reject(err);
                        setTimeout(() => this.promises.search[query] = null, 500);
                    },
                    () => {
                        resolve(this.results.search[query]);
                        if (this.subjects.search && query !== '') {
                            this.subjects.search.next(
                                this.results.search[query],
                            );
                        }
                        setTimeout(() => this.promises.search[query] = null, 500);
                    },
                );
            });
        }
        return this.promises.search[query];
    }

    public listen(next: (data: any) => void) {
        return this.observers.rooms.subscribe(next);
    }

    public selected(next: (data: any) => void) {
        return this.observers.selected.subscribe(next);
    }

    public setSelected(room: any) {
        if (room && room.id) {
            this.updateBookings(room.id);
        }
        setTimeout(() => this.subjects.selected.next(room), 10);
    }

    public get(name: any) {
        if (this.subjects[name]) {
            return this.subjects[name].getValue();
        }
        return null;
    }

    public withID(id: any) {
        return this.getRoom(id);
    }

    public lastSearch() {
        return this.last_query;
    }

    public lastResults() {
        if (this.last_query && this.last_query.id !== '') {
            return this.results.search[this.last_query.id];
        } else {
            return [];
        }
    }

    public bookings(id: string, next: (room: any) => void, date: number = moment().valueOf()) {
        if (id) {
            if (!this.subjects[`room_${id}`]) {
                this.subjects[`room_${id}`] = new BehaviorSubject<IRoom>(null);
                this.observers[`room_${id}`] = this.subjects[`room_${id}`].asObservable();
            }
            this.updateBookings(id, date).then(
                (room) => this.subjects[`room_${id}`].next(room),
                (err) => console.error(err)
            );
            return this.observers[`room_${id}`].subscribe(next);
        }
        return null;
    }

    private updateBookings(id: string, date: number = moment().valueOf()) {
        return new Promise((resolve, reject) => {
            let room = this.withID(id);
            const now = moment();
            const time = moment(date || '').seconds(0).milliseconds(0);
            if (!room || now.isAfter(moment(room.last_update).add('5', 'minutes')) || room.date_loaded !== time.format('YYYY-MM-DD')) {
                const url = `${this.parent.api_endpoint}/bookings/${room.email}`;
                this.http.get(url).subscribe(
                    (data) => {
                        room = this.processRoom(data);
                        room.date_loaded = time.format('YYYY-MM-DD');
                    }, (err) => reject(err),
                    () => resolve(room)
                );
            }
        });
    }

    private merge(list: any[]) {
        const rm_list: any[] = [];
        const room_list = this.list();
        for (const rm of list) {
            if (room_list) {
                for (const room of room_list) {
                    if (room.id === rm.id) {
                        rm.today = room.today;
                        rm.timeline = room.timeline;
                        break;
                    }
                }
            }
            rm_list.push(rm);
        }
        return rm_list;
    }

    private processRooms(list: any[]): any[] {
        const room_list: any[] = [];
        for (const room of list) {
            const out: IRoom = this.processRoom(room);
            room_list.push(out);
        }
        return room_list;
    }

    private processRoom(item: any) {
        const bld = this.parent.Buildings.current();
        const out: IRoom = {
            id: item.id,
            name: item.name,
            email: item.email,
            level: {},
            map_id: item.map_id,
            bookable: !!item.bookable,
            bookings: this.processRoomBookings(item.bookings, item.name),
            features: item.features,
            equipment: '',
            capacity: item.capacity,
            catering: this.checkCatering(item.zones),
            images: item.images || [],
            in_use: !!item.in_use,
            next: null,
            last_update: moment().valueOf()
        };
        if (out.features && bld) {
            for (const extra of bld.extras) {
                if (out.features.indexOf(extra.id) >= 0) {
                    if (out.equipment) { out.equipment += ', '; }
                    out.equipment += extra.name;
                }
            }
        }
        out.next = this.nextBooking(out.bookings);
        out.in_use = !!this.checkState(out.bookings) || !out.bookable || out.in_use;
        // Set level
        for (const lvl of bld.levels) {
            if (item.zones && item.zones.indexOf(lvl.id) >= 0) {
                out.level = lvl;
                break;
            }
        }
        return out;
    }

    private checkCatering(zones: string[]) {
        if (zones) {
            const bld = this.parent.Buildings.current();
            if (bld && bld.catering) {
                for (const zone of zones) {
                    if (bld.catering.indexOf(zone) >= 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private processRoomBookings(bkns: any[], location: string = ''): any[] {
        const list = this.processBookings(bkns);
        return list;
    }

    private processBookings(bkns: any[]): any[] {
        if (!bkns) {
            return [];
        }
        const list: any[] = [];
        const bld = this.parent.Buildings.current();
        const rooms = this.list();
        for (const bkn of bkns) {
            const item = this.parent.Bookings.processBooking(bkn);
            // Get room associated with the booking
            if (rooms) {
                for (const rm of rooms) {
                    if (rm.email === item.room_id || rm.id === item.room_id) {
                        item.room = rm;
                        break;
                    }
                }
            }
            list.push(item);
        }
        list.sort((a: any, b: any) => (a.s - b.s));
        return list;
    }

    private nextBooking(bkns: any[]) {
        if (!bkns || bkns.length <= 0) {
            return null;
        }
        const now = moment();
        let bkn: any = null;
        let bkn_start: any = null;
        for (const b of bkns) {
            const start = moment(b.start_date);

            if (
                now.format('D/MM/YYYY') === start.format('D/MM/YYYY') &&
                start.isAfter(now) &&
                (!bkn_start || bkn_start.isAfter(start))
            ) {
                bkn = b;
                bkn_start = start;
                bkn.start = start.format('h:mma');
            }
        }
        return bkn;
    }

    private checkState(bkns: any[]) {
        if (!bkns || bkns.length <= 0) {
            return false;
        }
        const now = moment();
        for (const b of bkns) {
            const start = moment(b.start_date);
            const end = moment(b.end_date);
            if (start.isSameOrBefore(now) && end.isAfter(now)) {
                return end.format('h:mma');
            }
        }
        return false;
    }
}
