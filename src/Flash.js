'use strict';

import { mat4, mat3, vec2 } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import Renderer from './Renderer.js';
import geometry from './geometry.js';

const vertexShader =
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

const fragmentShader =
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

        highp float alpha = cos(lambda * 10.0) * sin(theta * 20.0);

        alpha = alpha > 0.2 ? 1.0 : 0.0;

        color = vec4(0.5 * vertex.xyz + vec3(0.5), alpha);
      }
    `;

class Flash {
    constructor(renderer, onUpdate = () => {}) {
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
        };

        this.sphere = renderer.createObject(
            geometry.uvSphere(24, 64),
            this.uniforms,
            vertexShader,
            fragmentShader);
    }

    update(dtime) {
        //TODO: adjust to time
        this.params.phi += 0.01;
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

export default Flash;
