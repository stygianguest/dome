import { mat4, quat } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import geometry from './geometry.js';

function easeInOutCubic(t) {
    t *= 2.;
    if (t < 1) return 0.5*t*t*t;

    t -= 2.;
    return 0.5*(t*t*t + 2);
}

class Pong {
    constructor(renderer, onUpdate = () => {}) {
        this.renderer = renderer;
        this.locations = {}; //TODO: merge into dots
        this.puck = quat.create();

        // { // for testing: start with random position
        //     let phi = Math.random() * Math.PI - 0.5*Math.PI;
        //     let lambda = Math.random() * Math.PI * 2 - Math.PI;
        //     quat.rotateX(this.puck, this.puck, lambda);
        //     quat.rotateY(this.puck, this.puck, phi);
        // }

        this.params = new Parameters("Pong", (change) => {
            onUpdate();
        });
        this.params.float("puck_weight", 0., 0.0001, 0., 1.);
        this.params.float("gravity", 0., 0.0001, 0., 1.);

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

    update(dtime) {}

    draw(framebuffer) {
        { // set the projection matrix
            //TODO: can we make this reusable?
            const aspect = framebuffer.width / framebuffer.height;
            const distance = 2.3;
            const fieldOfView = Math.atan2(1.0, distance) * 2.0;
            const zNear = distance;
            const zFar = 100.0;

            let m = this.uniforms.projectionMatrix;
            mat4.identity(m);
            mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
            mat4.translate(m, m, [0., 0., -distance]);
            mat4.rotate(m, m, Math.PI, [1, 0, 0]);
        }

        {
            // rotate the object
            let m = this.uniforms.modelMatrix;
            mat4.fromQuat(m, this.puck);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);

            this.dot.draw();
        }

    }
}

export default Pong;
