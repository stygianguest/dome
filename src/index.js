'use strict';

//import cubetexture from './images/cubetexture.png';
import cubetexture from './images/fisheye_grid.gif';
import {mat4, mat3, vec2} from 'gl-matrix';
import Parameters from './Parameters.js';
import Renderer from './Renderer.js';

let params = new Parameters();
document.body.appendChild(params.element);

params.float("rotationSensitivity", 40, 1, 0, 1000, "number of pixels one must move to rotate by one radian");
params.float("viewRotationX", 0.0, 0.1, 0.0, 2*Math.PI);
params.float("viewRotationY", 0.0, 0.1, 0.0, 2*Math.PI);

//var textureOffset = vec2.fromValues(0.5 * (1.0 - 480. / 640.), 0.0);
//var textureScale = vec2.fromValues(480. / 640., 1.0);
var textureOffset = vec2.fromValues(0.0, 0.0);
var textureScale = vec2.fromValues(1.0, 1.0);

let mesh = uvSphere(24, 64);

let renderer = new Renderer();

document.body.appendChild(renderer.element);
document.body.appendChild(params.element);

let attributes = {
    vertices: { 
        buffer: renderer.createArrayBuffer(new Float32Array(mesh.vertices)),
        numComponents: 3,
        type: renderer.gl.FLOAT //FIXME: can we get rid of this param?
    },
    uvs: {
        buffer: renderer.createArrayBuffer(new Float32Array(mesh.uvs)),
        numComponents: 2,
        type: renderer.gl.FLOAT
    }
}
let indices = renderer.createArrayBuffer(new Uint16Array(mesh.indices), true);
let program = renderer.createProgram(
  `#version 300 es

    in vec4 vertices;
    in vec2 uvs;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    out highp vec2 uv;
    uniform mat3 textureMatrix;

    float pi = 3.1415927410125732421875;

    void main(void) {
      gl_Position = projectionMatrix * modelViewMatrix * vertices;
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
let uniforms = {
    projectionMatrix: mat4.create(),
    modelViewMatrix: mat4.create(),
    textureMatrix: mat3.create(),
    tex: renderer.createTexture(cubetexture, () => {requestAnimationFrame(draw)})
};

{ // set static camera
  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = renderer.element.clientWidth / renderer.element.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(uniforms.projectionMatrix,
                   fieldOfView,
                   aspect,
                   zNear,
                   zFar);
}

function draw() {

  mat4.translate(uniforms.modelViewMatrix,     // destination matrix
                 mat4.create(),       // matrix to translate
                 [-0.0, 0.0, -3.0]);  // amount to translate
  mat4.rotate(uniforms.modelViewMatrix,  // destination matrix
              uniforms.modelViewMatrix,  // matrix to rotate
              params.viewRotationY,     // amount to rotate in radians
              [1, 0, 0]);       // axis to rotate around (Y)
  mat4.rotate(uniforms.modelViewMatrix,  // destination matrix
              uniforms.modelViewMatrix,  // matrix to rotate
              params.viewRotationX * .7,// amount to rotate in radians
              [0, 1, 0]);       // axis to rotate around (X)

  mat3.translate(uniforms.textureMatrix, uniforms.textureMatrix, textureOffset);
  mat3.scale(uniforms.textureMatrix, uniforms.textureMatrix, textureScale);

  renderer.draw(mesh.indices.length, attributes, indices, program, uniforms);
}

requestAnimationFrame(draw);

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
            params.viewRotationX += (e.clientX - lastPosition.x) / params.rotationSensitivity;
            params.viewRotationX %= Math.PI * 2;
            params.viewRotationY += (e.clientY - lastPosition.y) / params.rotationSensitivity;
            params.viewRotationY %= Math.PI * 2;

            requestAnimationFrame(draw);
        }
        lastPosition = { x: e.clientX, y: e.clientY };

    }, false);
    canvas.addEventListener("mouseup", function(){
        mouseIsDown = false;
    }, false);
}

cameraControls(renderer.element);


//const canvas = document.querySelector('#glcanvas');
//cameraControls(canvas);
//main(canvas);
//
function uvSphere(numLatitudes, numLongitudes) {
    //TODO: actually hemisphere, rename!
    //TODO: we probably should generate an icosphere

    let maxLatitude = 0.5 * Math.PI;

    var vertices = [];
    var uvs = [];

    for (let j = 0; j < numLatitudes; ++j) {
        let latitude = j * maxLatitude/numLatitudes + (0.5*Math.PI - maxLatitude);
        let sinLatitude = Math.sin(latitude);
        let cosLatitude = Math.cos(latitude);

        for (let i = 0; i < numLongitudes; ++i) {
            let longitude = i * 2.0*Math.PI/numLongitudes;
            let cosLongitude = Math.cos(longitude);
            let sinLongitude = Math.sin(longitude);

            let x = cosLatitude * cosLongitude;
            let y = cosLatitude * sinLongitude;
            let z = sinLatitude;

            vertices = vertices.concat([x,y,z]);

            // fisheye uv projection
            let r = Math.atan2(Math.sqrt(x*x + y*y), z) / Math.PI;
            let phi = longitude;//Math.atan2(y, x);

            let u = 0.5 + r * Math.cos(phi);
            let v = 0.5 + r * Math.sin(phi);

            uvs = uvs.concat([u,v]);
        }
    }

    // add pole
    vertices = vertices.concat([0., 0., 1.]);
    uvs = uvs.concat([0.5, 0.5]);

    function triangulateQuadIndices(bl, br, tl, tr) {
        return [bl, br, tl,
                tl, br, tr];
    }

    var indices = [];

    for (let j = 0; j < numLatitudes-1; ++j) {
        for (let i = 0; i < numLongitudes-1; ++i) {
            indices = indices.concat(triangulateQuadIndices(
                i   +    j  * numLongitudes,
                i+1 +    j  * numLongitudes,
                i   + (1+j) * numLongitudes,
                i+1 + (1+j) * numLongitudes));
        }

        // wrap around longitudes
        indices = indices.concat(triangulateQuadIndices(
            numLongitudes-1 +    j  * numLongitudes,
            0               +    j  * numLongitudes,
            numLongitudes-1 + (1+j) * numLongitudes,
            0               + (1+j) * numLongitudes));
    }

    // add triangles at the pole
    for (let i = 0; i < numLongitudes-1; ++i) {
        indices = indices.concat([
            i   + (numLatitudes-1) * numLongitudes,
            i+1 + (numLatitudes-1) * numLongitudes,
            vertices.length/3 - 1 /* pole */]);
    }
    indices = indices.concat([
        numLongitudes-1 + (numLatitudes-1) * numLongitudes,
        0               + (numLatitudes-1) * numLongitudes,
        vertices.length/3 - 1 /* pole */]);

    return { vertices: vertices, uvs: uvs, indices: indices };
}

