'use strict';

import cubetexture from './images/fisheye_grid.gif';
import {
    mat4,
    mat3,
    vec2
} from 'gl-matrix';
import {
    Parameters
} from './Parameters.js';
import Renderer from './Renderer.js';
import geometry from './geometry.js';

const searchParams = new URLSearchParams(window.location.search);

let params = new Parameters("params", (x, v) => {
    requestAnimationFrame(draw);
});

params.bool("devModeCamera", false);
params.float("rotationSensitivity", 40, 1, 0, 1000, "number of pixels one must move to rotate by one radian");
params.bool("rotateDevCamera", false);

params.section("gui")
params.gui.float("phi", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);
params.gui.float("lambda", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);

params.section("camera");
params.camera.float("distance", 3.0, 0.1, 0.0);
params.camera.float("phi", -0.7, 0.1, -2 * Math.PI, 2 * Math.PI);
params.camera.float("lambda", 0.07, 0.1, -2 * Math.PI, 2 * Math.PI);

let renderer = new Renderer("gui");

if (searchParams.has("devMode") && searchParams.get("devMode") == "true") {
    document.body.appendChild(renderer.element);
    document.body.appendChild(params.element);
    params.devModeCamera = true;
} else {
    renderer.canvas.style.display = 'block';
    renderer.canvas.style.width = '100vw';
    renderer.canvas.style.height = '100vh';
    document.body.style.margin = '0px';
    document.body.appendChild(renderer.canvas);
}


let uniforms = {
    projectionMatrix: mat4.create(),
    modelMatrix: mat4.create(),
    tex: renderer.createTexture(cubetexture, () => {
        requestAnimationFrame(draw)
    })
};

let dot = renderer.createObject(
    geometry.disk(24),
    uniforms,
    `#version 300 es

      in vec4 vertices;

      uniform mat4 modelMatrix;
      uniform mat4 projectionMatrix;

      void main(void) {
        gl_Position = projectionMatrix * modelMatrix * vertices;
      }
    `,
    `#version 300 es

      out lowp vec4 color;

      void main(void) {
        color = vec4(1.);
      }
    `);

let hemisphere = renderer.createObject(
    geometry.uvHemisphere(24, 64),
    uniforms,
    `#version 300 es

      in vec4 vertices;
      in vec2 uvs;

      uniform mat4 projectionMatrix;

      out highp vec2 uv;

      void main(void) {
        gl_Position = projectionMatrix * vertices;
        uv = uvs;
      }
    `,
    `#version 300 es

      in highp vec2 uv;
      uniform sampler2D tex;

      out lowp vec4 color;

      void main(void) {
        color = texture(tex, uv);
      }
    `);

cameraControls(renderer.canvas);
requestAnimationFrame(draw);

function update() {
    { // rotate the object
        let m = mat4.create();
        mat4.rotate(m, m, params.gui.phi, [1, 0, 0]);
        mat4.rotate(m, m, params.gui.lambda, [0, 1, 0]);
        mat4.translate(m, m, [0., 0., 1]);
        mat4.scale(m, m, [0.3, 0.3, 0.3]);
        uniforms.modelMatrix = m;
    }

    // set the camer
    if (params.devModeCamera) {
        // TODO: just a different projection isn't good enough; we need to render to a
        // canvas, and project that onto a sphere which is then rendered with
        // this projection
        const aspect = renderer.canvas.clientWidth / renderer.canvas.clientHeight;
        const fieldOfView = 45 * Math.PI / 180; // in radians
        const zNear = 0.1;
        const zFar = 100.0;

        let m = mat4.create();
        mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
        mat4.translate(m, m, [0., 0., -params.camera.distance]);
        mat4.rotate(m, m, params.camera.phi, [1, 0, 0]);
        mat4.rotate(m, m, params.camera.lambda, [0, 1, 0]);
        uniforms.projectionMatrix = m;
    } else {
        //TODO: reuse existing matrices rather than recreate them
        const aspect = renderer.canvas.clientWidth / renderer.canvas.clientHeight;
        const phi = -Math.PI;
        const lambda = 0;
        const distance = 2.3;
        const fieldOfView = Math.atan2(1.0, distance) * 2.0;
        const zNear = distance;
        const zFar = 100.0;

        let m = mat4.create();
        mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
        mat4.translate(m, m, [0., 0., -distance]);
        mat4.rotate(m, m, phi, [1, 0, 0]);
        mat4.rotate(m, m, lambda, [0, 1, 0]);
        uniforms.projectionMatrix = m;
    }

}

function draw() {
    update(); //TODO: move out of draw call

    renderer.resize();
    renderer.clear(0, 0, 0.2, 1);

    dot.draw();

    if (params.devModeCamera) {
        hemisphere.draw();
    }
}

// drag controls our view of the dome
function cameraControls(canvas) {
    var mouseIsDown = false;
    var lastPosition = {
        x: 0,
        y: 0
    };
    canvas.addEventListener("mousedown", function (e) {
        mouseIsDown = true;
        lastPosition = {
            x: e.clientX,
            y: e.clientY
        };
    }, false);
    canvas.addEventListener("mousemove", function (e) {
        if (mouseIsDown) {
            if(params.rotateDevCamera) {
                params.camera.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
                params.camera.lambda %= Math.PI * 2;
                params.camera.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
                params.camera.phi %= Math.PI * 2;
            } else {
                params.gui.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
                params.gui.lambda %= Math.PI * 2;
                params.gui.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
                params.gui.phi %= Math.PI * 2;
            }
        }
        lastPosition = {
            x: e.clientX,
            y: e.clientY
        };

    }, false);
    canvas.addEventListener("mouseup", function () {
        mouseIsDown = false;
    }, false);
}
