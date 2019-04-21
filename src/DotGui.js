import { mat4, vec3, quat } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import geometry from './geometry.js';

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

            let q = quat.create();
            quat.rotateX(q, q, lambda);
            quat.rotateY(q, q, phi);
            this.locations[item] = q;
        }

        this.origin = quat.create();
        this.pos = quat.create(); //TODO: rename to view
        this.dest = quat.create();

        this.params = new Parameters("guiParams", (change) => {
            onUpdate();

            if (this.currentSelection != this.params.selection) {
                // selection changed, make current position origin
                // set new destination and reset animation
                //TODO: updatng parameter values like this triggers superfluous recursive calls
                //      it is essential we first change currentSelection
                this.currentSelection = this.params.selection;
                quat.copy(this.origin, this.pos);
                quat.copy(this.dest, this.locations[this.currentSelection]);
                this.params.anim.t = 0.;
            }
        });

        this.currentSelection = menu[0];
        this.params.enum("selection", this.currentSelection, menu);
        this.params.section("anim");
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

    update(dtime) {
        if (this.params.anim.t < 1) {
            // we're still animating, update the current position
            this.params.anim.t += dtime / this.params.anim.duration;
            this.params.anim.t = Math.min(1., this.params.anim.t);
            quat.slerp(this.pos, this.origin, this.dest, easeInOutCubic(this.params.anim.t));
        } else {
            // animation is done
            //FIXME: does it make sense to copy every time? can we skip this?
            quat.copy(this.origin, this.dest);
            quat.copy(this.pos, this.dest);
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

            let m = mat4.create();
            mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
            mat4.translate(m, m, [0., 0., -distance]);
            mat4.rotate(m, m, Math.PI, [1, 0, 0]);

            { // rotate
                let q = quat.create();
                quat.copy(q, this.pos);
                quat.invert(q, q);
                let r = mat4.create();
                mat4.fromQuat(r, q);
                mat4.multiply(m, m, r);
            }

           this.uniforms.projectionMatrix = m;
        }

        for (let item in this.locations) {
            //TODO: these do not change, we shouldn't upload a matrix every time
            // rotate the object
            let pos = this.locations[item];
            let m = mat4.create();
            { // rotate
                let r = mat4.create();
                mat4.fromQuat(r, pos);
                mat4.multiply(m, m, r);
            }

            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);
            this.uniforms.modelMatrix = m;

            this.dot.draw();
        }

    }
}

export default DotGui;
