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

var BaseComponent = (function() {
'use strict';

  // Creates an object based in the HTML Element prototype
  function BaseComponent() {
    return Reflect.construct(HTMLElement, [], new.target);
  }

  Object.setPrototypeOf(BaseComponent.prototype, HTMLElement.prototype);
  Object.setPrototypeOf(BaseComponent, HTMLElement);

  BaseComponent.prototype.connectedCallback = function() {
    for(var i = 0; i < this.attributes.length; i++) {
      var attr = this.attributes[i];
      this.getModel().attrs[attr.name] = attr.value;
    }
    var promise = this.onCreated() || Promise.resolve();
    return promise.then(function () {
      this._rootElement = document.importNode(this.getTemplate().content, true);

      //Replace skin placeholder as rivets ignore style tags :-(
      var styles = this._rootElement.querySelectorAll('style');

      for(var i = 0; i < styles.length; i++) {
        var tag = styles[i];
        tag.innerText = tag.innerText.replace(/{skin}/, Utils.getSkin());
      }

      //Don't create wrapper for container nodes
      if(this.lightDOM && (this.childNodes.length === 0 || !this.innerHTML.trim().length)) {
        var wrapper = document.createElement('div');
        wrapper.className = "component-wrapper " + this.className;
        wrapper.setAttribute("rv-ignore","true");

        var container = document.createElement('div');
        container.className = "component-host " + this.className;

        wrapper.appendChild(container);
        container.appendChild(this._rootElement);
        this.appendChild(wrapper);
        this._fakeShadowRoot = container;
      } else {
        if(this.lightDOM) {
          this.appendChild(this._rootElement);
        } else {
          this.createShadowRoot();
          this.shadowRoot.appendChild(this._rootElement);
        }
      }

      this.getModel().config = this.getAttribute('config') ? this.getAttribute('config') : this.getModel().config;
      this.__view = rivets.bind($(this._fakeShadowRoot || this.shadowRoot), this.getModel());
      this.isReady = true;
      setTimeout(function () {
        this.dispatchEvent(new CustomEvent('component-ready', {bubbles: false}));
      }.bind(this));
    }.bind(this)).catch(function (err) {
      console.error(err);
    });
  };

  BaseComponent.prototype.getRootElement = function () {
    return this._fakeShadowRoot || this.shadowRoot;
  };

  BaseComponent.prototype.getConfig = function() {
    var config = this.getAttribute('config');
    return config && JSON.parse(config);
  };

  BaseComponent.prototype.getModel = function() {
    if(!this._model) {
      this._model = {
        true: true,
        attrs: {}
      };
    }
    return this._model;
  };
  BaseComponent.prototype.onCreated = function() {};
  BaseComponent.prototype.getTemplate = function() {
    throw 'getTemplate not implemented';
  };


  BaseComponent.prototype.attributeChangedCallback = function(
      attributeName, oldValue, newValue, namespace) {
    if(oldValue === newValue) {
      return;
    }
    this.getModel().attrs[attributeName] = newValue;
    switch (attributeName) {
      case 'config':
      this.getModel().config = newValue;
        break;
    }
  };

  BaseComponent.observedAttributes = ['config','pid','enabled'];

  customElements.define('base-component', BaseComponent);

  return BaseComponent;

})();

var MGComponent = function (spec) {

  function findTemplate(node) {
    var childs = node.children;
    for(var i = 0; i < childs.length; i++) {
      if(childs[i].tagName === 'TEMPLATE') {
        return childs[i];
      }
    }
    return node.querySelector('template');
  }

  if(MGComponent.cache[spec.name]) {
    console.error("Tag already defined " + spec.name);
    return;
  }

  var parentClass = spec.parent || BaseComponent;
  var Component = (function(spec, parentClass) {
    return function (){
      var _ = Reflect.construct(parentClass, [], Object.getPrototypeOf(this).constructor);
      _.lightDOM = spec.lightDOM || !Utils.browserSupportsShadowDOM();
      return _;
    };
  })(spec, parentClass);

  MGComponent.cache[spec.name] = Component;

  var thisDoc;

  if(typeof HTMLImports !== 'undefined') {
    thisDoc = HTMLImports.importForElement(document.currentScript);
  } else {
    thisDoc= (document._currentScript || document.currentScript).ownerDocument;
  }

  var template = findTemplate(thisDoc);

  var name = spec.name;
  delete spec.name;

  Object.setPrototypeOf(Component.prototype, parentClass.prototype);
  Object.setPrototypeOf(Component, parentClass);

  Object.assign(Component.prototype, {
    getTemplate: function () {
      return template;
    }
  },spec);

  customElements.define(name, Component);
  return Component;

};

MGComponent.cache = {};
