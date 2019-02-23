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
import DotGui from './DotGui.js';
import PlanetViewer from './planetviewer.js';

/* globals URLSearchParams: true */
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

    planet = new PlanetViewer(
        planetConfigurations[planetTextures.planet],
        renderer, () => { requestAnimationFrame(draw); });

    if (oldplanet.params.element.parentNode) {
        document.body.replaceChild(planet.params.element, oldplanet.params.element);
    }
});
planetTextures.enum("planet", "earth", Object.keys(planetConfigurations));

let planet = new DotGui(Object.keys(planetConfigurations), renderer,
    () => { requestAnimationFrame(draw); });

if (!searchParams.has("devMode") || searchParams.get("devMode") == "true") {
    searchParams.set('devMode','true');
    renderer.element.style.width = '800px';
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


const update_interval = 1/60; // 60 Hz
setInterval(update, update_interval);

function update() {
    planet.update(update_interval);
}

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
