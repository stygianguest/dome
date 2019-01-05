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

params.enum("projection", 'stereographic', ['view', 'stereographic', 'orthographic', 'equiarea', 'equidistant']);

var textureOffset = vec2.fromValues(0.0, 0.0);
var textureScale = vec2.fromValues(1.0, 1.0);

let renderer = new Renderer("view", 640, 480);

document.body.appendChild(renderer.element);
document.body.appendChild(params.element);

let uniforms = {
    projectionMatrix: mat4.create(),
    modelMatrix: mat4.create(),
    textureMatrix: mat3.create(),
    aspectRatio: renderer.canvas.clientHeight / renderer.canvas.clientWidth, //FIXME: is width/height the typical way?
    tex: renderer.createTexture(cubetexture, () => {
        requestAnimationFrame(draw)
    })
};

{
    // set texture transformation
    mat3.translate(uniforms.textureMatrix, uniforms.textureMatrix, textureOffset);
    mat3.scale(uniforms.textureMatrix, uniforms.textureMatrix, textureScale);
}

function createHemisphere(projection) {

    return renderer.createObject(
        geometry.uvHemisphere(24, 64),
        uniforms,
        `#version 300 es

          in vec4 vertices;
          in vec2 uvs;

          uniform mat4 modelMatrix;

          ${projection}

          out highp vec2 uv;
          uniform mat3 textureMatrix;

          void main(void) {
            gl_Position = projection(modelMatrix * vertices);
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

}

let hemisphereMatrixProjection = createHemisphere(`
    uniform mat4 projectionMatrix;

    vec4 projection(vec4 v) { return projectionMatrix * v; }
`);

//TODO: reuse buffers, programs?
let hemisphereEquidistant = createHemisphere(`
    uniform float aspectRatio;

    vec4 projection(vec4 v) {
        float r = atan(sqrt(v.x*v.x + v.y*v.y), v.z) / ${Math.PI};
        float theta = atan(v.y, v.x);

        float x = 2.0 * r * cos(theta);
        float y = 2.0 * r * sin(theta);

        return vec4(x * aspectRatio, y, 0., 1.); //TODO: what about depth?
    }
`);

let hemisphereEquiarea = createHemisphere(`
    uniform float aspectRatio;

    //FIXME: just return a vec3?
    vec4 projection(vec4 v) {
        float theta = asin(v.z);
        float lambda = atan(v.y, v.x);

        float r = cos(theta);

        float x = r * cos(lambda);
        float y = r * sin(lambda);

        return vec4(x * aspectRatio, y, 0., 1.);
    }
`);

let disk = geometry.disk(24);

let dot = renderer.createObject(
    disk,
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

cameraControls(renderer.canvas);
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
    if (params.projection === "stereographic") {
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
        hemisphereMatrixProjection.draw();
    } else if (params.projection === "orthographic") {
        const aspect = 1.0 / uniforms.aspectRatio;
        const left = -1 * aspect;
        const right = 1 * aspect;
        const bottom = -1;
        const top = 1;
        const zNear = 0.0;
        const zFar = 100.0;
        const phi = 0;
        const lambda = 0;
        const distance = 1;

        let m = mat4.create();
        mat4.ortho(m, left, right, bottom, top, zNear, zFar);
        mat4.translate(m, m, [0., 0., -distance]);
        mat4.rotate(m, m, phi, [1, 0, 0]);
        mat4.rotate(m, m, lambda, [0, 1, 0]);

        uniforms.projectionMatrix = m;
        hemisphereMatrixProjection.draw();
    } else if (params.projection === "equidistant") {
        hemisphereEquidistant.draw();
    } else if (params.projection === "equiarea") {
        hemisphereEquiarea.draw();
    } else /*if (params.projection === "view")*/ {
        uniforms.projectionMatrix =
            createCameraMatrix(params.view.distance, 0.0, 0.0);//params.sphere.phi, params.sphere.lambda);
        hemisphereMatrixProjection.draw();
    }

    //dot.draw();
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
