/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "ddc38b42af245de696bf22327b34562e"
  }, {
    "url": "assets/web-hLgHy90O.js",
    "revision": null
  }, {
    "url": "assets/web-CGkmAYAi.js",
    "revision": null
  }, {
    "url": "assets/web-BX13Z1Q-.js",
    "revision": null
  }, {
    "url": "assets/index-p7_TrRuA.js",
    "revision": null
  }, {
    "url": "assets/index-DNQNWqMc.css",
    "revision": null
  }, {
    "url": "assets/OnlineRecipeSearch-CkniFzik.js",
    "revision": null
  }, {
    "url": "assets/IngredientRecipeFinder-3tD1Npt2.js",
    "revision": null
  }, {
    "url": "assets/HouseholdHub-JP3a-8dZ.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "d0584036cc7577e7a228090893882e15"
  }, {
    "url": "favicon.png",
    "revision": "6f5e9a5008045e90d10d7f6812790e29"
  }, {
    "url": "icon-192.png",
    "revision": "5f7a90d53432d2c6cfc0c384c81e3c91"
  }, {
    "url": "icon-512.png",
    "revision": "af1c225f494fc648dc18905a5f116ed6"
  }, {
    "url": "icon-maskable-512.png",
    "revision": "4ccdcd625440cb2d66486eb94c5239e9"
  }, {
    "url": "manifest.webmanifest",
    "revision": "a4a4493fc9f7d7529542f30b2173ce53"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(({
    request,
    url
  }) => request.destination === "image" || /\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname), new workbox.CacheFirst({
    "cacheName": "tadbeera-recipe-images-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 120,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
