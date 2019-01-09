'use strict';

//import cubetexture from './images/cubetexture.png';
import cubetexture from './images/earth_latlong.jpg';
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

params.float("rotationSensitivity", 40, 1, 0, 1000, "number of pixels one must move to rotate by one radian");

params.section("sphere")
params.sphere.float("phi", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);
params.sphere.float("lambda", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);

params.section("view");
params.view.float("distance", 2.3, 0.1, 0.0);

var textureOffset = vec2.fromValues(0.0, 0.0);
var textureScale = vec2.fromValues(1.0, 1.0);

let renderer = new Renderer("textures");

if (searchParams.has("devMode") && searchParams.get("devMode") == "true") {
    document.body.appendChild(renderer.element);
    document.body.appendChild(params.element);
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
    textureMatrix: mat3.create(),
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
    geometry.uvSphere(24, 64),
    uniforms,
    `#version 300 es

      in vec4 vertices;
      out highp vec4 vertex;

      uniform mat4 modelMatrix;
      uniform mat4 projectionMatrix;

      uniform mat3 textureMatrix;

      void main(void) {
        gl_Position = projectionMatrix * modelMatrix * vertices;
        vertex = vertices;
      }
    `,
    `#version 300 es

      uniform sampler2D tex;

      in highp vec4 vertex;
      out lowp vec4 color;

      void main(void) {
        highp float theta = asin(vertex.z);
        highp float lambda = atan(vertex.y, vertex.x);
        highp vec2 uv = vec2(.5 * lambda / ${Math.PI} + 0.5, theta / ${Math.PI} + 0.5);

        color = texture(tex, uv);
        //color = vec4(uv, 1., 1.);
      }
    `);


cameraControls(renderer.canvas);
requestAnimationFrame(draw);

function draw() {
    renderer.resize();
    renderer.clear(0, 0, 0.2, 1);

    { // rotate the object
        let m = mat4.create();
        mat4.rotate(m, m, params.sphere.phi, [1, 0, 0]);
        mat4.rotate(m, m, params.sphere.lambda, [0, 1, 0]);
        uniforms.modelMatrix = m;
    }

    //TODO: reuse existing matrices rather than recreate them
    const aspect = renderer.canvas.clientWidth / renderer.canvas.clientHeight;
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
