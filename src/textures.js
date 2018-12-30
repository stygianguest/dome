'use strict';

//import cubetexture from './images/cubetexture.png';
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

let params = new Parameters("params", (x, v) => {
    requestAnimationFrame(draw);
});
document.body.appendChild(params.element);

params.float("rotationSensitivity", 40, 1, 0, 1000, "number of pixels one must move to rotate by one radian");

params.section("sphere")
params.sphere.float("phi", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);
params.sphere.float("lambda", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);

params.section("view");
params.view.float("distance", 2.3, 0.1, 0.0);

var textureOffset = vec2.fromValues(0.0, 0.0);
var textureScale = vec2.fromValues(1.0, 1.0);

let renderer = new Renderer(640, 480);

document.body.appendChild(renderer.element);
document.body.appendChild(params.element);

{ // add fullscreen button
    function handleKeypress(event) {
        if (event.keyCode === 27) {
            document.exitFullscreen();
        }
    }

    let fullscreen = document.createElement("a");
    fullscreen.innerText = "fullscreen";
    fullscreen.href = '#';
    fullscreen.onclick = () => {
        renderer.toggleFullscreen();
    };
    document.body.appendChild(fullscreen);

    document.addEventListener("keypress", handleKeypress, false);
}


let uniforms = {
    projectionMatrix: mat4.create(),
    modelMatrix: mat4.create(),
    textureMatrix: mat3.create(),
    aspectRatio: renderer.element.clientHeight / renderer.element.clientWidth, //FIXME: is width/height the typical way?
    tex: renderer.createTexture(cubetexture, () => {
        requestAnimationFrame(draw)
    })
};

{
    // set texture transformation
    mat3.translate(uniforms.textureMatrix, uniforms.textureMatrix, textureOffset);
    mat3.scale(uniforms.textureMatrix, uniforms.textureMatrix, textureScale);
}

let sphere = renderer.createObject(
    geometry.uvHemisphere(24, 64),
    uniforms,
    `#version 300 es

      in vec4 vertices;
      in vec2 uvs;

      uniform mat4 modelMatrix;
      uniform mat4 projectionMatrix;

      out highp vec2 uv;
      uniform mat3 textureMatrix;

      void main(void) {
        gl_Position = projectionMatrix * modelMatrix * vertices;
        uv = vec2(textureMatrix * vec3(uvs, 1.));
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

function createCameraMatrix(distance, phi, lambda) {
    //FIXME: are the angles actually X and Y? (those are not the axis) let's call them  phi and lambda

    const fieldOfView = 45 * Math.PI / 180; // in radians
    const aspect = 1. / uniforms.aspectRatio;
    const zNear = 0.1;
    const zFar = 100.0;

    let m = mat4.create();
    mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
    mat4.translate(m, m, [0., 0., -distance]);
    mat4.rotate(m, m, phi, [1, 0, 0]);
    mat4.rotate(m, m, lambda, [0, 1, 0]);

    return m;
}

cameraControls(renderer.element);
requestAnimationFrame(draw);

function draw() {
    renderer.clear(0, 0, 0.2, 1);

    { // rotate the object
        let m = mat4.create();
        mat4.rotate(m, m, params.sphere.phi, [1, 0, 0]);
        mat4.rotate(m, m, params.sphere.lambda, [0, 1, 0]);
        uniforms.modelMatrix = m;
    }

    //TODO: reuse existing matrices rather than recreate them
    const aspect = 1.0 / uniforms.aspectRatio;
    const phi = -Math.PI;
    const lambda = 0;
    const distance = params.view.distance;
    const fieldOfView = Math.atan2(1.0, distance) * 2.0;
    const zNear = distance;
    const zFar = 100.0;

    let m = mat4.create();
    mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
    mat4.translate(m, m, [0., 0., -distance]);
    mat4.rotate(m, m, phi, [1, 0, 0]);
    mat4.rotate(m, m, lambda, [0, 1, 0]);

    uniforms.projectionMatrix = m;
    sphere.draw();
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
            params.sphere.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
            params.sphere.lambda %= Math.PI * 2;
            params.sphere.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
            params.sphere.phi %= Math.PI * 2;
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
