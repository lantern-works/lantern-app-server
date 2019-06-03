/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */


importScripts("../scripts/workbox-v4.3.1/workbox-sw.js");
workbox.setConfig({modulePathPrefix: "../scripts/workbox-v4.3.1" ,
    debug: false});


self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "assets/empty-tile.png",
    "revision": "0915ba45de8fa8ac6d4d7d780b680ae3"
  },
  {
    "url": "favicon.ico",
    "revision": "ca035ebc2ffccb74e0ce304ecf6e4067"
  },
  {
    "url": "index.html",
    "revision": "c4fcff9061f0f04ab8da0dcc69e75db6"
  },
  {
    "url": "install/index.html",
    "revision": "fde0cd28fea8c0887f1f175a2a2166c8"
  },
  {
    "url": "portal/index.html",
    "revision": "f079581bfe2eb09e5f0f3753701ab03e"
  },
  {
    "url": "scripts/apps.js",
    "revision": "b912eed3b1936be9b5d0342da9feb80c"
  },
  {
    "url": "scripts/apps.min.js",
    "revision": "d9b84ec2254e33d5c08d64e93bcbac02"
  },
  {
    "url": "scripts/data.js",
    "revision": "d1e7522e769c22009adddd42147c034d"
  },
  {
    "url": "scripts/data.min.js",
    "revision": "98f1527574a50f962c05269a214c20f8"
  },
  {
    "url": "scripts/maps.js",
    "revision": "683617bb52e30eb0dfc1c24daf18dd9b"
  },
  {
    "url": "scripts/maps.min.js",
    "revision": "5eae48718cf5cb6a8664105c187a68f3"
  },
  {
    "url": "styles/global.css",
    "revision": "95607e465f50f0f6609301b5729b2cdf"
  },
  {
    "url": "styles/vendor.css",
    "revision": "32f2443323d21b91b255221e08c54b01"
  },
  {
    "url": "test/apps.html",
    "revision": "64ed132e2bec8544031049a0e082ebe2"
  },
  {
    "url": "test/data.html",
    "revision": "52019ee5b36ef6f8e0766d510bb3a4a4"
  },
  {
    "url": "test/lora.html",
    "revision": "543d0c8da20180d48cec70873bef046d"
  },
  {
    "url": "test/maps.html",
    "revision": "b1d4611e1d0bd242885b03bb5f85a6ad"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
