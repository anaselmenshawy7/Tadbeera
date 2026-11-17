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
    "revision": "f3945bb4c1a78cb615cc8241f5e7e192"
  }, {
    "url": "assets/web-TvZfRmH2.js",
    "revision": null
  }, {
    "url": "assets/web-DcpDovtx.js",
    "revision": null
  }, {
    "url": "assets/jsx-dev-runtime-D-PzxhQO.js",
    "revision": null
  }, {
    "url": "assets/index-DcVpmafN.js",
    "revision": null
  }, {
    "url": "assets/index--k2gWiz5.css",
    "revision": null
  }, {
    "url": "assets/OnlineRecipeSearch-B04BeMO_.js",
    "revision": null
  }, {
    "url": "assets/IngredientRecipeFinder-D9jEbQ2H.js",
    "revision": null
  }, {
    "url": "assets/HouseholdHub-A1UL1EwI.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "08ca7a7de071c329f5d458b40e3addff"
  }, {
    "url": "favicon.png",
    "revision": "e5a0162c98c1ba35821a54649f5d50d2"
  }, {
    "url": "assets/aistudio/launchericon-144x144_b3711091.png",
    "revision": "8b8ef9c782daec07bc228fdd8fbbb430"
  }, {
    "url": "assets/aistudio/launchericon-192x192_a1111b2e.png",
    "revision": "08ca7a7de071c329f5d458b40e3addff"
  }, {
    "url": "assets/aistudio/launchericon-48x48_08576b00.png",
    "revision": "e5a0162c98c1ba35821a54649f5d50d2"
  }, {
    "url": "assets/aistudio/launchericon-512x512_fdb81f54.png",
    "revision": "5c50e5ba1ad4b11cb2202dd2b2d4c2e4"
  }, {
    "url": "assets/aistudio/launchericon-72x72_e4abd8ef.png",
    "revision": "04769d682c290f9746bc8186cd4ac4b0"
  }, {
    "url": "assets/aistudio/launchericon-96x96_4d503cd4.png",
    "revision": "fba9f6d7654a375d6b9276c54becf181"
  }, {
    "url": "manifest.webmanifest",
    "revision": "6b1e8aa8ea2baf4e17a9eb097ce28885"
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
