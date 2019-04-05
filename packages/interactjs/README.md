<a href="http://interactjs.io"><img alt="interact.js" src="https://c4d6f7d727e094887e93-4ea74b676357550bd514a6a5b344c625.ssl.cf2.rackcdn.com/ijs-solid.svg" height="70px" width="100%"></a>

<h2>
  JavaScript drag and drop, resizing and multi-touch gestures with inertia and snapping for modern browsers (and also IE9+).
  <br><br>

  <div align="center">
  <a href="https://gitter.im/taye/interact.js"><img src="https://badges.gitter.im/Join%20Chat.svg" alt="Gitter"></a>
  <a href="https://travis-ci.org/taye/interact.js"><img src="https://travis-ci.org/taye/interact.js.svg?branch=master" alt="Build Status"></a>
  <a href="https://codeclimate.com/github/taye/interact.js/maintainability"><img src="https://api.codeclimate.com/v1/badges/0168aeaeed781a949088/maintainability.svg"></a>
  <a href="https://codeclimate.com/github/taye/interact.js/code?sort=-test_coverage"><img src="https://codeclimate.com/github/taye/interact.js/badges/coverage.svg" alt="Test Coverage"></a>
  </div>
</h2>

Features include:

 - **inertia** and **snapping**
 - **multi-touch**, simultaneous interactions
 - cross browser and device, supporting the **desktop and mobile** versions of
   Chrome, Firefox and Opera as well as **Internet Explorer 9+**
 - interaction with [**SVG**](http://interactjs.io/#use_in_svg_files) elements
 - being **standalone and customizable**
 - **not modifying the DOM** except to change the cursor (but you can disable
   that)

Installation
------------

* [npm](https://www.npmjs.org/): `npm install interactjs@next`
* [jsDelivr CDN](https://cdn.jsdelivr.net/npm/interactjs/): `<script src="https://cdn.jsdelivr.net/npm/interactjs@next/dist/interact.min.js"></script>`
* [unpkg CDN](https://unpkg.com/interactjs/): `<script src="https://unpkg.com/interactjs@next/dist/interact.min.js"></script>`
* [Webjars SBT/Play 2](https://www.webjars.org/): `libraryDependencies ++= Seq("org.webjars.npm" % "interactjs" % version)`
* Direct download the latest version: http://interactjs.io/#download
  * **Rails 4** app development (using Rails Asset Pipeline)
    * Download the file interact.js (development version) into a new sub-directory: vendor/assets/javascripts/interact
    * Add ```//= require interact/interact``` in app/assets/javascripts/application.js (above ```//= require_tree .```)
    * Restart the Rails server

### Typescript definitions

```
npm install --save-dev @interactjs/types
```

Documentation
-------------

Visit http://interactjs.io/docs for the API documentation.

Example
-------

```javascript
var pixelSize = 16;

interact('.rainbow-pixel-canvas')
  .origin('self')
  .draggable({
    modifiers: [{
      // snap to the corners of a grid
      type: 'snap',
      targets: [
        interact.snappers.grid({ x: pixelSize, y: pixelSize }),
      ],
    }],
  })
  // draw colored squares on move
  .on('dragmove', function (event) {
    var context = event.target.getContext('2d'),
        // calculate the angle of the drag direction
        dragAngle = 180 * Math.atan2(event.dx, event.dy) / Math.PI;

    // set color based on drag angle and speed
    context.fillStyle = 'hsl(' + dragAngle + ', 86%, '
                        + (30 + Math.min(event.speed / 1000, 1) * 50) + '%)';

    // draw squares
    context.fillRect(event.pageX - pixelSize / 2, event.pageY - pixelSize / 2,
                     pixelSize, pixelSize);
  })
  // clear the canvas on doubletap
  .on('doubletap', function (event) {
    var context = event.target.getContext('2d');

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  });

  function resizeCanvases () {
    [].forEach.call(document.querySelectorAll('.rainbow-pixel-canvas'), function (canvas) {
      canvas.width = document.body.clientWidth;
      canvas.height = window.innerHeight * 0.7;
    });
  }

  // interact.js can also add DOM event listeners
  interact(document).on('DOMContentLoaded', resizeCanvases);
  interact(window).on('resize', resizeCanvases);
```

See the above code in action at https://codepen.io/taye/pen/tCKAm

License
-------

interact.js is released under the [MIT License](http://taye.mit-license.org).

[ijs-twitter]: https://twitter.com/interactjs
[upcoming-changes]: https://github.com/taye/interact.js/blob/master/CHANGELOG.md#upcoming-changes