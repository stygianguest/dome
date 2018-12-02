'use strict';

//import cubetexture from './images/cubetexture.png';
import cubetexture from './images/death_star.png';
import {mat4, mat3, vec2} from 'gl-matrix';

let rotationSensitivity = 40.0; // number of pixels to move one radian
var viewRotationX = 0.0;
var viewRotationY = 0.0;

var textureOffset = vec2.fromValues(0.5 * (1.0 - 480. / 640.), 0.0);
var textureScale = vec2.fromValues(480. / 640., 1.0);

const canvas = document.querySelector('#glcanvas');
let mesh = uvSphere(24, 48);
cameraControls(canvas);
main(canvas);

function uvSphere(numLatitudes, numLongitudes) { // actually hemisphere

    var vertices = [];

    for (let j = 0; j < numLatitudes; ++j) {
        let latitude = j * 0.5*Math.PI/numLatitudes;
        let sinLatitude = Math.sin(latitude);
        let cosLatitude = Math.cos(latitude);

        for (let i = 0; i < numLongitudes; ++i) {
            let longitude = i * 2.0*Math.PI/numLongitudes;

            vertices = vertices.concat([
                cosLatitude * Math.cos(longitude),
                cosLatitude * Math.sin(longitude),
                sinLatitude]);
        }
    }

    // add pole
    vertices = vertices.concat([0., 0., 1.]);

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

    return { vertices: vertices, indices: indices };
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
            viewRotationX += (e.clientX - lastPosition.x) / rotationSensitivity;
            viewRotationX %= Math.PI * 2;
            viewRotationY += (e.clientY - lastPosition.y) / rotationSensitivity;
            viewRotationY %= Math.PI * 2;
        }
        lastPosition = { x: e.clientX, y: e.clientY };
    }, false);
    canvas.addEventListener("mouseup", function(){
        mouseIsDown = false;
    }, false);
}

//
// Start here
//
function main(canvas) {
  const gl = canvas.getContext('webgl');

  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  // Vertex shader program

  const vsSource = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 uv;
    uniform mat3 uTextureMatrix;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      uv = 0.5 + 0.5*aVertexPosition.xy;
      uv = vec2(uTextureMatrix * vec3(uv, 1.));
    }
  `;

  // Fragment shader program

  const fsSource = `
    varying highp vec2 uv;
    uniform sampler2D uSampler;

    void main(void) {
      //gl_FragColor = vec4(0., uv.y, 0., 1.);
      gl_FragColor = texture2D(uSampler, uv);
    }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attributes our shader program is using
  // for aVertexPosition, aVevrtexColor and also
  // look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      //vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
      textureMatrix: gl.getUniformLocation(shaderProgram, 'uTextureMatrix'),
    },
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);

  const texture = loadTexture(gl, cubetexture);

  var then = 0;

  // Draw the scene repeatedly
  function render(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    drawScene(gl, programInfo, buffers, texture, deltaTime);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}


//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple three-dimensional cube.
//
function initBuffers(gl) {

  // Create a buffer for the cube's vertex positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the cube.

  //const positions = [
  //  // Front face
  //  -1.0, -1.0,  1.0,
  //   1.0, -1.0,  1.0,
  //   1.0,  1.0,  1.0,
  //  -1.0,  1.0,  1.0,

  //  // Back face
  //  -1.0, -1.0, -1.0,
  //  -1.0,  1.0, -1.0,
  //   1.0,  1.0, -1.0,
  //   1.0, -1.0, -1.0,

  //  // Top face
  //  -1.0,  1.0, -1.0,
  //  -1.0,  1.0,  1.0,
  //   1.0,  1.0,  1.0,
  //   1.0,  1.0, -1.0,

  //  // Bottom face
  //  -1.0, -1.0, -1.0,
  //   1.0, -1.0, -1.0,
  //   1.0, -1.0,  1.0,
  //  -1.0, -1.0,  1.0,

  //  // Right face
  //   1.0, -1.0, -1.0,
  //   1.0,  1.0, -1.0,
  //   1.0,  1.0,  1.0,
  //   1.0, -1.0,  1.0,

  //  // Left face
  //  -1.0, -1.0, -1.0,
  //  -1.0, -1.0,  1.0,
  //  -1.0,  1.0,  1.0,
  //  -1.0,  1.0, -1.0,
  //];

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);

  // Now set up the colors for the faces. We'll use solid colors
  // for each face.

  const faceColors = [
    [1.0,  1.0,  1.0,  1.0],    // Front face: white
    [1.0,  0.0,  0.0,  1.0],    // Back face: red
    [0.0,  1.0,  0.0,  1.0],    // Top face: green
    [0.0,  0.0,  1.0,  1.0],    // Bottom face: blue
    [1.0,  1.0,  0.0,  1.0],    // Right face: yellow
    [1.0,  0.0,  1.0,  1.0],    // Left face: purple
  ];

  // Convert the array of colors into a table for all the vertices.

  var colors = [];

  for (var j = 0; j < faceColors.length; ++j) {
    const c = faceColors[j];

    // Repeat each color four times for the four vertices of the face
    colors = colors.concat(c, c, c, c);
  }

  //const colorBuffer = gl.createBuffer();
  //gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  //gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex arrays for each face's vertices.

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  //const indices = [
  //  0,  1,  2,      0,  2,  3,    // front
  //  4,  5,  6,      4,  6,  7,    // back
  //  8,  9,  10,     8,  10, 11,   // top
  //  12, 13, 14,     12, 14, 15,   // bottom
  //  16, 17, 18,     16, 18, 19,   // right
  //  20, 21, 22,     20, 22, 23,   // left
  //];

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(mesh.indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    //color: colorBuffer,
    indices: indexBuffer,
  };
}

//
// Draw the scene.
//
function drawScene(gl, programInfo, buffers, texture, deltaTime) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix,
                   fieldOfView,
                   aspect,
                   zNear,
                   zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.translate(modelViewMatrix,     // destination matrix
                 modelViewMatrix,     // matrix to translate
                 [-0.0, 0.0, -3.0]);  // amount to translate
  mat4.rotate(modelViewMatrix,  // destination matrix
              modelViewMatrix,  // matrix to rotate
              viewRotationY,     // amount to rotate in radians
              [1, 0, 0]);       // axis to rotate around (Y)
  mat4.rotate(modelViewMatrix,  // destination matrix
              modelViewMatrix,  // matrix to rotate
              viewRotationX * .7,// amount to rotate in radians
              [0, 1, 0]);       // axis to rotate around (X)

  const textureMatrix = mat3.create();
  mat3.translate(textureMatrix, textureMatrix, textureOffset);
  mat3.scale(textureMatrix, textureMatrix, textureScale);


  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL how to pull out the colors from the color buffer
  // into the vertexColor attribute.
  //{
  //  const numComponents = 4;
  //  const type = gl.FLOAT;
  //  const normalize = false;
  //  const stride = 0;
  //  const offset = 0;
  //  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  //  gl.vertexAttribPointer(
  //      programInfo.attribLocations.vertexColor,
  //      numComponents,
  //      type,
  //      normalize,
  //      stride,
  //      offset);
  //  gl.enableVertexAttribArray(
  //      programInfo.attribLocations.vertexColor);
  //}

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);


  // Tell WebGL we want to affect texture unit 0
  gl.activeTexture(gl.TEXTURE0);

  // Bind the texture to texture unit 0
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Tell the shader we bound the texture to texture unit 0
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);


  // Tell WebGL to use our program when drawing

  gl.useProgram(programInfo.program);

  // Set the shader uniforms

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);

  gl.uniformMatrix3fv(
      programInfo.uniformLocations.textureMatrix,
      false,
      textureMatrix);

  {
    const vertexCount = mesh.indices.length;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  // Update the rotation for the next draw

  //viewRotationX += deltaTime;
  //viewRotationY += deltaTime;
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  const image = new Image();
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    //if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
    //   // Yes, it's a power of 2. Generate mips.
    //   gl.generateMipmap(gl.TEXTURE_2D);
    //} else {
    //   // No, it's not a power of 2. Turn of mips and set
    //   // wrapping to clamp to edge
    //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //}

       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  };
  image.src = url;

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}
