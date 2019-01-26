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

params.section("camera");
params.camera.float("distance", 3.0, 0.1, 0.0);
params.camera.float("phi", -0.7, 0.1, -2 * Math.PI, 2 * Math.PI);
params.camera.float("lambda", 0.07, 0.1, -2 * Math.PI, 2 * Math.PI);

const planetVertexShader =
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
    `;

const planetFragmentShader =
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
    `;

class Planet {
    constructor(textures, renderer, onUpdate = () => {}) {
        this.renderer = renderer;

        this.params = new Parameters("planetParams", (change) => {
            onUpdate();
        });

        this.params.float("phi", 0.2, 0.1, -2 * Math.PI, 2 * Math.PI);
        this.params.float("lambda", 0.2, 0.1, -2 * Math.PI, 2 * Math.PI);

        //TODO: can we join this.params and this.uniforms? would need 'texture' parameter
        this.uniforms = {
            projectionMatrix: mat4.create(),
            modelMatrix: mat4.create(),
            albedo: renderer.createTexture(textures.albedo, onUpdate),
            emission: renderer.createTexture(textures.emission, onUpdate),
            clouds: renderer.createTexture(textures.clouds, onUpdate)
        };

        this.sphere = renderer.createObject(
            geometry.uvSphere(24, 64),
            this.uniforms,
            planetVertexShader,
            planetFragmentShader);
    }

    draw(framebuffer) {
        //TODO: reuse existing matrices rather than recreate them
        { // rotate the object
            let m = mat4.create();
            mat4.rotate(m, m, this.params.phi, [1, 0, 0]);
            mat4.rotate(m, m, this.params.lambda, [0, 1, 0]);
            this.uniforms.modelMatrix = m;
        }

        {
            const aspect = framebuffer.width / framebuffer.height;
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
            this.uniforms.projectionMatrix = m;

            this.sphere.draw();
        }
    }
}

class DotGui {
    constructor(textures, renderer, onUpdate = () => {}) {
        this.params = new Parameters("guiParams", (change) => {
            onUpdate();
        });
        this.params.float("phi", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);
        this.params.float("lambda", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);

        this.uniforms = {
            projectionMatrix: mat4.create(),
            modelMatrix: mat4.create()
        };

        this.dot = renderer.createObject(
            geometry.disk(24),
            this.uniforms,
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
    }

    draw(framebuffer) {
        { // rotate the object
            let m = mat4.create();
            mat4.rotate(m, m, this.params.phi, [1, 0, 0]);
            mat4.rotate(m, m, this.params.lambda, [0, 1, 0]);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.3, 0.3, 0.3]);
            this.uniforms.modelMatrix = m;
        }
        { // draw the dot
            //TODO: reuse existing matrices rather than recreate them
            //TODO: can we make this reusable?
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
            this.uniforms.projectionMatrix = m;

            this.dot.draw();
        }
    }
}

let renderer = new Renderer("textures");
let framebuffer = renderer.createFrameBuffer(480, 480);

let planetConfigurations = {
    earth: {
        albedo: "planets/earth_daymap.jpg",
        emission: "planets/earth_nightmap.jpg",
        clouds: "planets/earth_clouds.jpg"
    },
    jupiter: { 
        albedo: "planets/jupiter.jpg"
    },
    mars: { 
        albedo: "planets/mars.jpg"
    },
    mercury: { 
        albedo: "planets/mercury.jpg"
    },
    moon: { 
        albedo: "planets/moon.jpg"
    },
    neptune:  { 
        albedo: "planets/neptune.jpg"
    },
    saturn:  { 
        albedo: "planets/saturn.jpg"
    },
    uranus:  { 
        albedo: "planets/uranus.jpg"
    },
    venus: {
        albedo: "planets/venus_surface.jpg",
        clouds: "planets/venus_atmosphere.jpg"
    }
};

let planetTextures = new Parameters("planet", () => {
    let oldplanet = planet;

    planet = new Planet(
        planetConfigurations[planetTextures.planet],
        renderer, () => { requestAnimationFrame(draw); });

    if (oldplanet.params.element.parentNode) {
        document.body.replaceChild(planet.params.element, oldplanet.params.element);
    }
});
planetTextures.enum("planet", "earth", Object.keys(planetConfigurations));

//let planet = new Planet(planetConfigurations[planetTextures.planet],
//        renderer, () => { requestAnimationFrame(draw); });
let planet = new DotGui(planetConfigurations[planetTextures.planet],
        renderer, () => { requestAnimationFrame(draw); });

if (!searchParams.has("devMode") || searchParams.get("devMode") == "true") {
    searchParams.set('devMode','true');
    renderer.element.style.width = '800px'
    renderer.element.style.height = '800px';
    document.body.appendChild(renderer.element);
    document.body.appendChild(params.element);
    document.body.appendChild(planet.params.element);
    document.body.appendChild(planetTextures.element);
    params.devModeCamera = true;
    params.rotateDevCamera = true;
} else {
    renderer.canvas.style.display = 'block';
    renderer.canvas.style.width = '100vw';
    renderer.canvas.style.height = '100vh';
    document.body.style.margin = '0px';
    document.body.appendChild(renderer.canvas);
}

let hemisphereUniforms = {
    projectionMatrix: mat4.create(),
    modelMatrix: mat4.create(),
    tex: framebuffer.texture
};

let hemisphere = renderer.createObject(
    geometry.uvHemisphere(24, 64),
    hemisphereUniforms,
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

function draw() {
    //TODO: reuse existing matrices rather than recreate them

    {
        let fb = {};
        if (params.devModeCamera) {
            // render to texture
            renderer.gl.bindFramebuffer(renderer.gl.FRAMEBUFFER, framebuffer.framebuffer);
            renderer.gl.viewport(0, 0, framebuffer.width, framebuffer.height);
            fb = framebuffer;
        } else {
            // render to screen
            renderer.gl.bindFramebuffer(renderer.gl.FRAMEBUFFER, null);
            renderer.resize();
            fb =
                { width: renderer.canvas.clientWidth
                , height:renderer.canvas.clientHeight
                };
        }

        renderer.clear(0, 0, 0, 1);

        planet.draw(fb);
    }

    if (params.devModeCamera) {

        renderer.gl.bindFramebuffer(renderer.gl.FRAMEBUFFER, null);
        renderer.resize();
        renderer.clear(0, 0, 0.2, 1);

        const aspect = renderer.canvas.clientWidth / renderer.canvas.clientHeight;
        const fieldOfView = 45 * Math.PI / 180; // in radians
        const zNear = 0.1;
        const zFar = 100.0;

        let m = mat4.create();
        mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
        mat4.translate(m, m, [0., 0., -params.camera.distance]);
        mat4.rotate(m, m, params.camera.phi, [1, 0, 0]);
        mat4.rotate(m, m, params.camera.lambda, [0, 1, 0]);
        hemisphereUniforms.projectionMatrix = m;
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
                planet.params.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
                planet.params.lambda %= Math.PI * 2;
                planet.params.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
                planet.params.phi %= Math.PI * 2;
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
