'use strict';

import {Tooltip} from 'bootstrap';
import {createApp} from './app.ts';
import {addTelemetry} from './telemetry.ts';

const { app, router } = createApp();
await router.isReady();
addTelemetry(app);

app.mixin({
  mounted() {
    new Tooltip(document.body, {
      selector: '[data-bs-toggle=tooltip]'
    });
  },
});

if (!import.meta.env.SSR) {
  const appMountEl = document.getElementById('app');
  if (appMountEl['__vue_app__'] && appMountEl['__vue_app__'].unmount) {
    const vitePressApp = appMountEl['__vue_app__'];
    const html = appMountEl.innerHTML;
    vitePressApp.unmount();

    appMountEl.innerHTML = html;
    console.info('Unmounted vitepress app', vitePressApp);
  }
}

const vm= app.mount('#app', true);
router.beforeEach(async (to, from, next) => {
  if (to.meta.ssg) {
    try {
      console.log('test0', to, window.location);
      console.log('test1', window.location.protocol + '//' + window.location.host + to.path)
      console.trace();
      const response = await fetch(window.location.protocol + '//' + window.location.host + to.path);
      const html = await response.text();

      const parser = new DOMParser();
      const r = parser.parseFromString(html, 'text/html');
      const titleElem = r.querySelector('title');
      if (titleElem) {
        document.title = titleElem.innerText;
      }
      const mainContent = r.querySelector('.mainbar__content');
      const elemContent = document.querySelector('.mainbar__content');
      if (mainContent && elemContent) {
        setTimeout(() => {
          vm.emitter.emit('html_lazy_content', mainContent.innerHTML);
        }, 100);
      }
      next(true);
      return;
    } catch (err) {
      console.error(err);
    }
  }

  const toDriveId = Array.isArray(to.params?.driveId) ? to.params.driveId[0] : to.params.driveId;
  const fromDriveId = Array.isArray(from.params?.driveId) ? from.params.driveId[0] : from.params.driveId;
  if (toDriveId !== fromDriveId) {
    await (<unknown>vm).FileClientService.clearCache();
    await (<unknown>vm).changeDrive(toDriveId);
  }
  next();
});
router.afterEach(() => {
  const elements = document.querySelectorAll('[data-bs-toggle=tooltip]');
  elements.forEach(element => {
    const tooltip = Tooltip.getInstance(element);
    if (tooltip) {
      tooltip.hide();
    }
  });
});
