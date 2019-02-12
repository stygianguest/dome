'use strict';

import { mat4, mat3, vec2 } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import Renderer from './Renderer.js';
import geometry from './geometry.js';

function lerp(a, b, t) {
    return a + t * (b-a);
}

function easeInOutCubic(t) {
    t *= 2.;
    if (t < 1) return 0.5*t*t*t;

    t -= 2.;
    return 0.5*(t*t*t + 2);
}

class DotGui {
    constructor(menu, renderer, onUpdate = () => {}) {
        this.locations = {};
        for (let item of menu) {
            let phi = Math.random() * Math.PI - 0.5*Math.PI;
            let lambda = Math.random() * Math.PI * 2 - Math.PI;

            this.locations[item] = { phi, lambda };
        }

        this.params = new Parameters("guiParams", (change) => {
            onUpdate();

            if (this.currentSelection != this.params.selection) {
                // selection changed, make current position origin
                // set new destination and reset animation
                //TODO: updatng parameter values like this triggers superfluous recursive calls
                //      it is essential we first change currentSelection
                this.currentSelection = this.params.selection;
                let pos = this.currentPosition();
                this.params.origin.phi = pos.phi;
                this.params.origin.lambda = pos.lambda;
                this.params.dest.phi = this.locations[this.currentSelection].phi;
                this.params.dest.lambda = this.locations[this.currentSelection].lambda;
                this.params.anim.t = 0.;
            }
        });

        this.currentSelection = menu[0];
        this.params.enum("selection", this.currentSelection, menu);
        this.params.section("origin")
        this.params.origin.float("phi", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);
        this.params.origin.float("lambda", 0.0, 0.1, -2 * Math.PI, 2 * Math.PI);
        this.params.section("dest")
        this.params.dest.float("phi", -1., 0.1, -2 * Math.PI, 2 * Math.PI);
        this.params.dest.float("lambda", -1., 0.1, -2 * Math.PI, 2 * Math.PI);
        this.params.section("anim")
        this.params.anim.float("t", 0., 0.0001, 0., 1.);
        this.params.anim.float("duration", 1.0, 0.1);

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

    currentPosition() {
        let t = easeInOutCubic(this.params.anim.t)

        let phi =     lerp(this.params.origin.phi,     this.params.dest.phi,     t);
        let lambda =  lerp(this.params.origin.lambda,  this.params.dest.lambda,  t);

        return { phi, lambda };
    }

    update(dtime) {
        if (this.params.anim.t < 1) {
            this.params.anim.t += dtime / this.params.anim.duration;
            this.params.anim.t = Math.min(1., this.params.anim.t);
        } else {
            this.params.origin.phi = this.params.dest.phi;
            this.params.origin.lambda = this.params.dest.lambda;
        }
    }

    draw(framebuffer) {
        { // set the projection matrix
            //TODO: reuse existing matrices rather than recreate them
            //TODO: can we make this reusable?
            const aspect = framebuffer.width / framebuffer.height;
            const distance = 2.3;
            const fieldOfView = Math.atan2(1.0, distance) * 2.0;
            const zNear = distance;
            const zFar = 100.0;
            let pos = this.currentPosition();

            let m = mat4.create();
            mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
            mat4.translate(m, m, [0., 0., -distance]);
            mat4.rotate(m, m, Math.PI, [1, 0, 0]);

            mat4.rotate(m, m, -pos.lambda, [0, 1, 0]);
            mat4.rotate(m, m, -pos.phi, [1, 0, 0]);
            //mat4.rotate(m, m, pos.phi, [1, 0, 0]);
            //mat4.rotate(m, m, pos.phi, [1, 0, 0]);
            //mat4.rotate(m, m, pos.lambda, [0, 1, 0]);
            //mat4.rotate(m, m, 0.9, [0, 1, 0]);
            //mat4.rotate(m, m, Math.PI*0.5, [1, 0, 0]);
            this.uniforms.projectionMatrix = m;
        }

        for (let item in this.locations) {
            //TODO: these do not change, we shouldn't upload a matrix every time
            // rotate the object
            let pos = this.locations[item];
            let m = mat4.create();
            mat4.rotate(m, m, pos.phi, [1, 0, 0]);
            mat4.rotate(m, m, pos.lambda, [0, 1, 0]);
            //mat4.rotate(m, m, 0.3, [1, 0, 0]);
            //mat4.rotate(m, m, 0.9, [0, 1, 0]);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);
            this.uniforms.modelMatrix = m;

            this.dot.draw();
        }

    }
}

export default DotGui;
