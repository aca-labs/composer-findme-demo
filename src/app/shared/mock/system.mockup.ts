/**
* @Author: Alex Sorafumo <alex.sorafumo>
* @Date:   11/01/2017 4:16 PM
* @Email:  alex@yuion.net
* @Filename: mock-system.ts
* @Last modified by:   Alex Sorafumo
* @Last modified time: 03/02/2017 2:26 PM
*/

import { MOCK_REQ_HANDLER } from '@acaprojects/ngx-composer';

import * as moment from 'moment';

const win = self as any;

win.systemData = win.systemData || {};
win.control = win.control || {};
win.control.systems =  win.control.systems || {};
win.control.systems['sys-B0'] = {
    System: [{
        name: 'Demo System',
    }],
    Demo: [{
        volume: 0,
        mute: false,
        views: 0,
        state: 'Idle',

        $play: () => {
            win.control.systems['sys-B0'].Demo[0].state = 'Playing';
        },

        $stop: () => {
            win.control.systems['sys-B0'].Demo[0].state = 'Stopped';
        },

        $volume: (value: number) => {
            this.volume = value;
            if (this.volume > 100) {
                this.volume = 100;
            } else if (this.volume < 0) {
                this.volume = 0;
            }
        },

        $mute: (state: boolean) => {
            this.mute = state;
        },

        $state: (status: string) => {
            this.state = status;
        },
    }],
};

// Will be defined in the zone, like buildings and levels
// 'tracking_system': 'sys-desk-tracking'
//
win.control.systems['sys-desk-tracking'] = {
    DeskManagement: [{
        $desk_details: (desk_id: string) => {
            return this[desk_id];
        },
        $desk_usage: (level: string) => {
            return this[`${level}`] + this[`${level}:reserved`];
        },

        'zone_Fd-16': ['09.3138', '09.3139', '09.3140', '09.3142', '09.3143', '09.3145'],
        'zone_Fd-16:desk_ids': ['09.3137', '09.3138', '09.3139', '09.3140', '09.3141', '09.3142', '09.3143', '09.3144', '09.3145', '09.3146'],
        'zone_Fd-16:occupied_count': 90,
        'zone_Fd-16:desk_count': 120,
        'zone_Fd-16:free_count': 30,
        'zone_Fd-16:manual_checkin': ['09.3143', '09.3144', '09.3145', '09.3146'],

        'zone_Fd-20': ['13.2001', '13.2002', '13.2003', '13.2004', '13.2005', '13.2006'],
        'zone_Fd-20:desk_ids': ['13.2001', '13.2002', '13.2003', '13.2004', '13.2005', '13.2006', '13.2007', '13.2008'],
        'zone_Fd-20:occupied_count': 90,
        'zone_Fd-20:desk_count': 120,
        'zone_Fd-20:free_count': 30,
        'zone_Fd-20:manual_checkin': ['13.2008', '13.2007', '13.2005'],

        // If connected==false, reserved_by==your/current user, user.reserve_time < global.reserve_time and user.reserve_time + unplug_time < time.now
        //   then prompt user to reserve or release desk.
        // If conflict=true then notify that your sitting at someone elses desk
        'user': {
            'ip': '10.10.10.10',      // Connected devices IP address -- null if connected == false
            'mac': '12:34:45:34:67',  // Connected devices MAC address
            'connected': true,
            'desk_id': 'desk1',
            'username': 'username',   // only set if connected==true and should be your username in this case
            'reserved': true,         // True if reservation valid
            'reserved_by': 'username',// The user who 'owns' the desk might not be you - might indicate a clash but reservation might have expired
            'conflict': false,        // Only true if the reservation is valid and the desk isn't owned by you
            'reserve_time': 300,      // should only ever be set to either hold_time or reserve_time
            'unplug_time': 1511307676 // unix epoch in seconds
        },

        $manual_checkin: function (desk_id: string, level_id: string = 'zone_Fd-20') {
            console.log(level_id);
            if (!this[`${level_id}`]) { this[`${level_id}`] = []; }
            this[`${level_id}`] = this[`${level_id}`].concat([desk_id]);
            if (!this[`${level_id}:clashes`]) { this[`${level_id}:clashes`] = []; }
            this[`${level_id}:clashes`] = this[`${level_id}:clashes`].concat([desk_id]);
            if (!this[`${level_id}:occupied_count`]) { this[`${level_id}:occupied_count`] = 0; }
            this[`${level_id}:occupied_count`] += 1;
            if (!this[`${level_id}:free_count`]) { this[`${level_id}:free_count`] = 1; }
            this[`${level_id}free_count`] -= 1;
            if (win.backend) {
                console.log('Backend:', win.backend);
                const user = win.backend.model.user;
                this[user.win_id] = {
                    connected: true,
                    manual_desk: true,
                    desk_id,
                    unplug_time: moment().unix()
                };
            }
        },
        // Will reserve the desk that is indicated above
        $reserve_desk: () => {
            if (win.backend) {
                console.log('Backend:', win.backend);
                const user = win.backend.model.user;
                if (this[user.win_id]) {
                    this[user.win_id].reserved = true;
                    this[user.win_id].unplug_time = moment().unix();
                }
            } else {
                if (this.user) {
                    this.user.reserved = true;
                    this.user.unplug_time = moment().unix();
                }
            }
        },
        $cancel_reservation: () => {
            if (win.backend) {
                console.log('Backend:', win.backend);
                const user = win.backend.model.user;
                if (this[user.win_id]) {
                    this[user.win_id] = {
                        connected: false,
                        reserved: false,
                        unplug_time: moment().unix()
                    };
                }
            } else {
                if (this.user) {
                    this.user = {
                        connected: false,
                        reserved: false,
                        unplug_time: moment().unix()
                    };
                }
            }
        },
    }],
};

setTimeout(() => setAutoDesk(), 100);

function setAutoDesk() {
    const user = win.backend ? win.backend.model.user : null;
    if (user) {
        console.log('System User:', user);
        win.control.systems['sys-desk-tracking'].DeskManagement[0][user.win_id] = {
            clash: false,
            connected: false,
            desk_id: '09.3017',
            ip: null,
            mac: '28d24429723b',
            reserve_time: 900,
            reserved: true,
            reserved_by: user.win_id,
            unplug_time: moment().unix(),
            username: null
        };
    } else {
        setTimeout(() => setAutoDesk(), 100);
    }
}
setInterval(() => {
    const module = win.control.systems['sys-B0'].Demo[0];
    if (module.state === 'Stopped') {
        module.state = 'Idle';
    }
    module.views += Math.floor(Math.random() * 7);
}, 10 * 1000);

win.systemData['sys-B0'] = win.control.systems['sys-B0'];
