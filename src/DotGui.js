'use strict';

import { mat4, mat3, vec2 } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import Renderer from './Renderer.js';
import geometry from './geometry.js';

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

            this.dot.draw();
        }
    }
}

export default DotGui;
