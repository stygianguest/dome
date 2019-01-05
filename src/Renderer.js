'use strict';

export default class {

    constructor(id, width, height) {
        this.element = document.createElement("div");
        this.element.classList.add('window');
        this.element.style.resize = 'none';

        { // 'window' decoration
        
            // add title
            let titleElement = document.createElement("div");
            titleElement.classList.add('windowTitle');
            titleElement.innerText = id;
            this.element.appendChild(titleElement);

            let fullscreen = document.createElement("a");
            fullscreen.innerText = "[fullscreen]";
            fullscreen.style.float = 'right';
            fullscreen.href = '#';
            fullscreen.onclick = () => {
                this.toggleFullscreen();
            };
            fullscreen.classList.add("icon");
            //document.addEventListener("keypress", handleKeypress, false);
            titleElement.appendChild(fullscreen);

            //let detach = document.createElement("a");
            //detach.style.float = 'right';
            //detach.innerText = "⇱";
            //detach.href = '#';
            //detach.onclick = () => { this.detach(); };

            //titleElement.appendChild(detach);

        }

        this.canvas = document.createElement("canvas");
        this.canvas.id = id;
        this.canvas.width = width;
        this.canvas.height = height;
        this.element.appendChild(this.canvas);

        this.canvas.fullscreenElement = this.canvas.fullscreenElement 
            || this.canvas.mozFullscreenElement
            || this.canvas.msFullscreenElement 
            || this.canvas.webkitFullscreenDocument;

        this.canvas.requestFullscreen = this.canvas.requestFullscreen 
            || this.canvas.mozRequestFullScreen
            || this.canvas.msRequestFullscreen
            || this.canvas.webkitRequestFullscreen;

        this.gl = this.canvas.getContext('webgl2');

        // TODO: nicer error?
        if (!this.gl) {
          alert('Unable to initialize WebGL. Your browser or machine may not support it.');
          return;
        }
    }

    createArrayBuffer(dataArray, isElementArray=false) {
        const buffer = this.gl.createBuffer();
        let target = isElementArray ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
        this.gl.bindBuffer(target, buffer);
        this.gl.bufferData(target, dataArray, this.gl.STATIC_DRAW);
        return buffer;
    }

    createTexture(url, onload=() => {}) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Because images have to be download over the internet
        // they might take a moment until they are ready.
        // Until then put a single pixel in the texture so we can
        // use it immediately. When the image has finished downloading
        // we'll update the texture with the contents of the image.
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = this.gl.RGBA;
        const srcType = this.gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat,
                      width, height, border, srcFormat, srcType,
                      pixel);

        const image = new Image();

        let gl = this.gl;
        image.onload = function() {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                        srcFormat, srcType, image);

          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

          onload();
        };

        image.src = url;

        return texture;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = initShaderProgram(this.gl, vertexShader, fragmentShader);

        let attributes = new Object();
        for (let i = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES) - 1; i >= 0; i--) {
          let info = this.gl.getActiveAttrib(program, i);
          attributes[info.name] = { info: info, location: this.gl.getAttribLocation(program, info.name) };
        }

        let uniforms = new Object();
        for (let i = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) {
          let info = this.gl.getActiveUniform(program, i);
          uniforms[info.name] = { info: info, location: this.gl.getUniformLocation(program, info.name) };
        }

        return {
            program: program,
            attributes: attributes,
            uniforms: uniforms,
        };
    }

    clear(r=0.0, g=0.0, b=0.0, a=1.0) {
        this.gl.clearColor(r,g,b,a);  // Clear to black, fully opaque
        this.gl.clearDepth(1.0);      // Clear everything

        //TODO: doesn't make much sense to do this in clear
        this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
        this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    draw(indices_length, attributes, indices, program, uniforms) {
        
        // bind attributes
        for (let name in program.attributes) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, attributes[name].buffer);
            this.gl.vertexAttribPointer(
                program.attributes[name].location,
                attributes[name].numComponents,
                attributes[name].type,
                false /*normalize*/,
                0 /*stride*/,
                0 /*offset*/);
            this.gl.enableVertexAttribArray(program.attributes[name].location);
        }

        // bind indices
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indices);

        // bind program
        this.gl.useProgram(program.program);

        // bind uniforms
        var texture = 0;
        for (let name in program.uniforms) {
            switch (program.uniforms[name].info.type) {
            case this.gl.FLOAT:
                this.gl.uniform1f(program.uniforms[name].location, uniforms[name]);
                break;
            case this.gl.FLOAT_MAT3:
                this.gl.uniformMatrix3fv(program.uniforms[name].location, false, uniforms[name]);
                break;
            case this.gl.FLOAT_MAT4:
                this.gl.uniformMatrix4fv(program.uniforms[name].location, false, uniforms[name]);
                break;
            case this.gl.SAMPLER_2D:
                activateTexture(this.gl, texture);
                this.gl.bindTexture(this.gl.TEXTURE_2D, uniforms[name]);
                this.gl.uniform1i(program.uniforms[name].location, texture);
                texture += 1;
                break;
            default:
                throw `uniform ${name} of unhandled type ${program.uniforms[name].info.type}`;
            }
        }

        this.gl.drawElements(this.gl.TRIANGLES, indices_length, this.gl.UNSIGNED_SHORT, 0 /*offset*/);
    }

    createObject(mesh, uniforms, vertexShader, fragmentShader) {
        let renderer = this;

        let attributes = {
            vertices: { 
                buffer: renderer.createArrayBuffer(mesh.vertices),
                numComponents: 3,
                type: renderer.gl.FLOAT //FIXME: can we get rid of this param?
            }
        };

        if (mesh.uvs !== undefined) {
            attributes["uvs"] = {
                buffer: renderer.createArrayBuffer(mesh.uvs),
                numComponents: 2,
                type: renderer.gl.FLOAT
            };
        }
        
        let indices = renderer.createArrayBuffer(mesh.indices, true);
        
        let program = renderer.createProgram(vertexShader, fragmentShader);

        let draw = function() {
            renderer.draw(mesh.indices.length, attributes, indices, program, uniforms);
        };

        return { uniforms: uniforms, draw: draw };
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.canvas.requestFullscreen().then({}).catch(err => {
                    alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
        } else {
            document.exitFullscreen();
        }
    }
};

function activateTexture(gl, n) {
    switch (n) {
    case 0: gl.activeTexture(gl.TEXTURE0); break;
    case 1: gl.activeTexture(gl.TEXTURE1); break;
    case 2: gl.activeTexture(gl.TEXTURE2); break;
    case 3: gl.activeTexture(gl.TEXTURE3); break;
    case 4: gl.activeTexture(gl.TEXTURE4); break;
    case 5: gl.activeTexture(gl.TEXTURE5); break;
    case 6: gl.activeTexture(gl.TEXTURE6); break;
    case 7: gl.activeTexture(gl.TEXTURE7); break;
    default:
        throw "no more than 8 textures supported atm";
    }
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
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

