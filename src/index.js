'use strict';

//import cubetexture from './images/cubetexture.png';
import cubetexture from './images/fisheye_grid.gif';
import {mat4, mat3, vec2} from 'gl-matrix';
import Parameters from './Parameters.js';
import Renderer from './Renderer.js';
import geometry from './geometry.js';

let params = new Parameters("params", "Parameters", (x,v) => { requestAnimationFrame(draw); });
document.body.appendChild(params.element);

params.float("rotationSensitivity", 40, 1, 0, 1000, "number of pixels one must move to rotate by one radian");

params.subsection("view");
params.view.float("phi", -0.35, 0.1, -2*Math.PI, 2*Math.PI);
params.view.float("lambda", 0.0, 0.1, -2*Math.PI, 2*Math.PI);
params.view.float("distance", 3.0, 0.1, 0.0);

params.choice("abc", [ 'a', 'b', 'c' ] , 0);

//var textureOffset = vec2.fromValues(0.5 * (1.0 - 480. / 640.), 0.0);
//var textureScale = vec2.fromValues(480. / 640., 1.0);
var textureOffset = vec2.fromValues(0.0, 0.0);
var textureScale = vec2.fromValues(1.0, 1.0);

let renderer = new Renderer();

document.body.appendChild(renderer.element);
document.body.appendChild(params.element);

let uniforms = {
    projectionMatrix: createCameraMatrix(params.view.distance, params.view.phi, params.view.lambda),
    modelViewMatrix: mat4.create(),
    textureMatrix: mat3.create(),
    tex: renderer.createTexture(cubetexture, () => {requestAnimationFrame(draw)})
};

{
  // set texture transformation
  mat3.translate(uniforms.textureMatrix, uniforms.textureMatrix, textureOffset);
  mat3.scale(uniforms.textureMatrix, uniforms.textureMatrix, textureScale);
}

let hemisphere = renderer.createObject(
    geometry.uvHemisphere(24, 64),
    uniforms,
    `#version 300 es

      in vec4 vertices;
      in vec2 uvs;

      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;

      out highp vec2 uv;
      uniform mat3 textureMatrix;

      void main(void) {
        gl_Position = projectionMatrix * vertices;
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


let disk = geometry.disk(24);

let dot = renderer.createObject(
    disk,
    uniforms,
    `#version 300 es

      in vec4 vertices;

      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;

      void main(void) {
        gl_Position = projectionMatrix * vertices;
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
  const aspect = renderer.element.clientWidth / renderer.element.clientHeight;
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
    uniforms.projectionMatrix = 
        createCameraMatrix(params.view.distance, params.view.phi, params.view.lambda);
           
    renderer.clear();
    //dot.draw();
    hemisphere.draw();

    console.log(params.abc);
}

// drag controls our view of the dome
function cameraControls(canvas) {
    var mouseIsDown = false;
    var lastPosition = { x: 0, y: 0 };
    canvas.addEventListener("mousedown", function(e){
        mouseIsDown = true;
        lastPosition = { x: e.clientX, y: e.clientY };
    }, false);
    canvas.addEventListener("mousemove", function(e){
        if (mouseIsDown) {
            params.view.lambda += (e.clientX - lastPosition.x) / params.rotationSensitivity;
            params.view.lambda %= Math.PI * 2;
            params.view.phi += (e.clientY - lastPosition.y) / params.rotationSensitivity;
            params.view.phi %= Math.PI * 2;
        }
        lastPosition = { x: e.clientX, y: e.clientY };

    }, false);
    canvas.addEventListener("mouseup", function(){
        mouseIsDown = false;
    }, false);
}

