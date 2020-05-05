/*
 * Copyright 2017 Banco Bilbao Vizcaya Argentaria, S.A.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

describe('<details-tile>', () => {

  var server;
  beforeEach(() => {
    server = buildFakeServer();
  });

  afterEach(() => {
    server.restore();
  });

  it('should show dashboard details information', (done) => {

    function handler(component) {
      // Wait until rivets finishes render
      setTimeout(function () {
        let img = component.shadowRoot.querySelector('img');
        let span = component.shadowRoot.querySelector('span');
        expect(img.attributes.src.value).toBe(detailsForTesting.logoUrl);
        expect(span.textContent).toBe(detailsForTesting.displayName);
        done();
      }, 100);
    }

    createTestComponent('details-tile').then((component) => {
      component.addEventListener('component-ready', function () {
        component.addEventListener('dashboard-updated', handler(component));
        server.respond();
      });
    });
  });
});