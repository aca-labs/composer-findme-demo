
import { Component, ViewContainerRef } from '@angular/core';
import { OverlayService } from '@acaprojects/ngx-widgets';
import { ViewEncapsulation } from '@angular/core';

@Component({
    selector: 'app-root',
    template: `
    <div class="app">
        <router-outlet></router-outlet>
    </div>
    `,
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
    constructor(private view: ViewContainerRef, private overlay: OverlayService) {
        this.overlay.view = view;
    }
}
