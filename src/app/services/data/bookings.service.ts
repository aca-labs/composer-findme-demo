import { Injectable } from '@angular/core';

import { IRoom } from './rooms.service';
import { IUser } from './users.service';

import * as moment from 'moment';

export interface IBooking {
    id: string;
    room: IRoom | {};
    title: string;
    date: string | number;
    duration: number;
    organiser: IUser | {};
    attendees: any[];
    state?: string;
    modified?: string | number;
    description?: string;
    control?: string;
    catering?: boolean;
    invitation?: boolean;
    location?: string;
    declined?: boolean;
    other?: any;
}

@Injectable()
export class BookingsService {
    public parent: any = null;

    private processBooking(event: any, simple: boolean = false) {
        const start = moment(event.start);
        const end = moment(event.end);
        const duration = moment.duration(end.diff(start)).asMinutes();
        const booking: IBooking = {
            id: event.id || event.booking_id || (simple ? Math.floor(Math.random() * 89999 + 10000) : 0),
            room: {},
            state: '',
            title: event.summary,
            modified: event['last-modified'],
            date: start.valueOf(),
            duration,
            organiser: {},
            attendees: [],
            description: event.description,
            control: event.support_url,
            catering: false,
            invitation: false,
            location: event.location,
            declined: event.declined,
            other: {
                room_email: event.room_email,
            },
        };
        if (event.room_id) {
            const room = this.parent.Rooms.withID(event.room_id);
            if (room) {
                booking.room = room;
                booking.catering = room && room.catering;
            }
        }
        if (booking.title) {
            if (booking.title.toLowerCase().indexOf('invitation:') >= 0) {
                booking.control = '';
                booking.invitation = true;
            }
        }
        if (!simple) {
            if (event.organizer && event.organizer.email) {
                const organiser = this.parent.Users.get(event.organizer.email);
                if (organiser) {
                    booking.organiser = organiser || event.organizer;
                } else {
                    const parts = event.organizer.email.split('@');
                    const name = `${parts[0].split('.').join(' ').split('_').join(' ')}`;
                    booking.organiser = {
                        id: event.organizer.email,
                        email: event.organizer.email,
                        name,
                        type: 'external',
                    };
                }
            }
            if (event.attendees) {
                for (const u of event.attendees) {
                    if (u) {
                        const user = this.parent.Users.get(u.email);
                        if (user) {
                            user.state = u.state;
                            booking.attendees.push(user);
                        } else {
                            const parts = u.email.split('@');
                            const name = `${parts[0].split('.').join(' ').split('_').join(' ')}`;
                            booking.attendees.push({
                                id: u.email,
                                email: u.email,
                                name,
                                type: 'external',
                                state: u.state,
                            });
                        }
                    }
                }
            }
        }
        return booking;
    }
}