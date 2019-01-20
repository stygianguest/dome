'use strict';

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

let params = new Parameters("params", (update) => {
    requestAnimationFrame(draw);
});

params.bool("devModeCamera", false);
params.float("rotationSensitivity", 40, 1, 0, 1000, "number of pixels one must move to rotate by one radian");
params.bool("rotateDevCamera", false);

params.section("sphere")
params.sphere.float("phi", 0.2, 0.1, -2 * Math.PI, 2 * Math.PI);
params.sphere.float("lambda", 0.2, 0.1, -2 * Math.PI, 2 * Math.PI);

params.section("camera");
params.camera.float("distance", 3.0, 0.1, 0.0);
params.camera.float("phi", -0.7, 0.1, -2 * Math.PI, 2 * Math.PI);
params.camera.float("lambda", 0.07, 0.1, -2 * Math.PI, 2 * Math.PI);

let planet = new Parameters("planet", () => {
    uniforms.albedo = renderer.createTexture(planet.albedo, () => { requestAnimationFrame(draw) })
    uniforms.emission = renderer.createTexture(planet.emission, () => { requestAnimationFrame(draw) })
    uniforms.clouds = renderer.createTexture(planet.clouds, () => { requestAnimationFrame(draw) })
    requestAnimationFrame(draw);
});
planet.string("albedo", "earth/earth_daymap.jpg");
planet.string("emission", "earth/earth_nightmap.jpg");
planet.string("clouds", "earth/earth_clouds.jpg");
planet.section("sun");

let renderer = new Renderer("textures");

if (searchParams.has("devMode") && searchParams.get("devMode") == "true") {
    document.body.appendChild(renderer.element);
    document.body.appendChild(params.element);
    document.body.appendChild(planet.element);
    params.devModeCamera = true;
    params.rotateDevCamera = true;
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
    albedo: renderer.createTexture(planet.albedo, () => {
        requestAnimationFrame(draw)
    }),
    emission: renderer.createTexture(planet.emission, () => {
        requestAnimationFrame(draw)
    }),
    clouds: renderer.createTexture(planet.clouds, () => {
        requestAnimationFrame(draw)
    })
};

let sphere = renderer.createObject(
    geometry.uvSphere(24, 64),
    uniforms,
    `#version 300 es

      in vec4 vertices;
      out highp vec4 vertex;
      out highp vec3 normal;

      uniform mat4 modelMatrix;
      uniform mat4 projectionMatrix;

      void main(void) {
        gl_Position = projectionMatrix * modelMatrix * vertices;
        vertex = vertices;

        // use the rotated vertex as normal, this works because
        // - the model is a unit-sphere (radius of 1.0)
        // - modelMatrix will only rotate
        normal = (modelMatrix * vertex).xyz;
      }
    `,
    `#version 300 es

      uniform sampler2D albedo;
      uniform sampler2D emission;
      uniform sampler2D clouds;

      in highp vec4 vertex;
      in highp vec3 normal;
      out lowp vec4 color;

      void main(void) {
        highp float theta = asin(vertex.z);
        highp float lambda = atan(vertex.y, vertex.x);
        highp vec2 uv = vec2(.5 * lambda / ${Math.PI} + 0.5, theta / ${Math.PI} + 0.5);

        highp vec3 lightIntensity = vec3(${Math.PI});

        // because the sun is very far away, we can assume a constant direction for it
        highp vec3 light = vec3(1., 0., 0.);

        highp float cosine = dot(normal, light);

        color = vec4(lightIntensity * texture(albedo,uv).xyz * max(0., cosine) / ${Math.PI}, 1.);
        color += (-cosine + 1.) / 2. * vec4(texture(emission,uv).xyz, 0.);

        highp float cloudAlpha = dot(texture(clouds,uv).xyz, vec3(1. / 3.));
        color *= vec4(vec3(1.0 - cloudAlpha), 1.);
        color += vec4(lightIntensity * texture(clouds,uv).xyz * max(0., cosine) / ${Math.PI}, 0.);
      }
    `);


cameraControls(renderer.canvas);
requestAnimationFrame(draw);

function draw() {
    renderer.resize();
    renderer.clear(0, 0, 0.2, 1);

    //TODO: reuse existing matrices rather than recreate them
    { // rotate the object
        let m = mat4.create();
        mat4.rotate(m, m, params.sphere.phi, [1, 0, 0]);
        mat4.rotate(m, m, params.sphere.lambda, [0, 1, 0]);
        uniforms.modelMatrix = m;
    }

    // set the camera matrix
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
            if(params.rotateDevCamera) {
                params.camera.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
                params.camera.lambda %= Math.PI * 2;
                params.camera.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
                params.camera.phi %= Math.PI * 2;
            } else {
                params.sphere.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
                params.sphere.lambda %= Math.PI * 2;
                params.sphere.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
                params.sphere.phi %= Math.PI * 2;
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
