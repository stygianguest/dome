import { mat4, quat } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import geometry from './geometry.js';

function easeInOutCubic(t) {
    t *= 2.;
    if (t < 1) return 0.5*t*t*t;

    t -= 2.;
    return 0.5*(t*t*t + 2);
}

function toRadian(angleDegrees) {
    return angleDegrees * (Math.PI / 180.0);
}

class Pong {
    constructor(renderer, onUpdate = () => {}) {
        this.renderer = renderer;

        this.puckPosition = { lambda: 0.0, phi: 0.8 };
        this.puckVelocity = { lambda: 0.0, phi: 0.0 };

        this.params = new Parameters("Pong", (change) => {
            onUpdate();
        });
        this.params.float("puck_weight", 0., 0.0001, 0., 1.);
        this.params.float("gravity", 0.0001, 0.0001, 0., 1.);
        this.params.touch("pos", { x: 10, y: 5}, {x:0, y:0}, {x:360, y:90});

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
        this.puckVelocity.phi -= this.params.gravity * Math.sin(this.puckPosition.phi);

        this.puckPosition.phi += this.puckVelocity.phi * dtime;
        this.puckPosition.phi %= Math.PI * 2; //FIXME: shouldn't Math.PI be sufficient?
    }

    draw(framebuffer) {
        { // set the projection matrix
            //TODO: can we make this reusable?
            //TODO: this doesn't change!
            const aspect = framebuffer.width / framebuffer.height;
            const distance = 2.3;
            const fieldOfView = Math.atan2(1.0, distance) * 2.0;
            const zNear = distance;
            const zFar = 100.0;

            let m = this.uniforms.projectionMatrix;
            mat4.identity(m);
            mat4.perspective(m, fieldOfView, aspect, zNear, zFar);
            mat4.translate(m, m, [0., 0., -distance]);

            mat4.rotate(m, m, Math.PI, [0, 1, 0]);
        }

        // draw the puck

        { // rotate the puck

            let m = this.uniforms.modelMatrix;
            mat4.identity(m);
            mat4.rotate(m, m, this.puckPosition.lambda, [1, 0, 0]);
            mat4.rotate(m, m, this.puckPosition.phi, [0, 1, 0]);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);
        }

        this.dot.draw();

        // draw the cursor

        { // rotate the puck
            const pos = this.params.pos;
            //console.log(toRadian(pos.x));

            let m = this.uniforms.modelMatrix;
            mat4.identity(m);
            mat4.rotate(m, m, toRadian(pos.x), [0, 0, 1]);
            mat4.rotate(m, m, toRadian(pos.y), [0, 1, 0]);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);
        }

        this.dot.draw();
    }
}

export default Pong;
