import { vec3, mat4, quat } from 'gl-matrix';
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

function sqr(a) { return a*a; }

//TODO: move to matrixgl lib
function getTwist(out, axis, a) {
  let w = vec3.fromValues(a[0], a[1], a[2]);
  let cosine = vec3.dot(axis, w);

  if (Math.abs(cosine) < 0.00001) {
    // close to zero: no twist around given axis, return identity
    return quat.identity(out);
  }

  w = vec3.scale(w, axis, cosine);

  out[0] = w[0];
  out[1] = w[1];
  out[2] = w[2];
  out[3] = a[3];

  return quat.normalize(out, out)
}

function getGeodesicAxisAngle(axis, a, b) {
    let up = vec3.fromValues(0,0,1);
    let normalA = vec3.transformQuat(vec3.create(), up, a);
    let normalB = vec3.transformQuat(vec3.create(), up, b);

    let cosine = vec3.dot(normalA, normalB);

    //TODO:
    //if (Math.abs(cosine)-0.5*Math.PI < 0.0001) {
    //    // without rotation, any axis will do
    //    vec3.set(axis, 0, 0, 1);
    //    console.log("zero angle");
    //    return 0;
    //}

    vec3.cross(axis, normalA, normalB);

    // clamping to avoid NaNs from acos
    cosine = Math.min(1, cosine);
    cosine = Math.max(-1, cosine);

    let angle = Math.acos(cosine);

    return angle;
}

class Pong {
    constructor(renderer, onUpdate = () => {}) {
        this.renderer = renderer;

        this.puckPosition = quat.create();
        this.puckVelocity = quat.create();

        // let's start at some position
        quat.fromEuler(this.puckPosition, 45, 45, 90);

        this.gravityDirection = quat.create(); //FIXME: as vector?
        this.mallet = quat.create();

        this.params = new Parameters("Pong", (change) => {
            onUpdate();
        });
        this.params.float("gravity", 0.1, 0.0001, 0., 1.);
        this.params.touch("gravityDirection", { x: 0, y: 0}, {x:0, y:0}, {x:360, y:90});
        this.params.touch("mallet", { x: 45, y: 10}, {x:0, y:0}, {x:360, y:90});

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
        { // update from inputs
            const mallet = this.params.mallet;
            quat.fromEuler(this.mallet, mallet.y, 0, mallet.x);

            const gravityDirection = this.params.gravityDirection;
            quat.fromEuler(this.gravityDirection, gravityDirection.y, 0, gravityDirection.x);
        }

        let axisPuckPosition = vec3.create();
        let anglePuckPosition = getGeodesicAxisAngle(axisPuckPosition, this.gravityDirection, this.puckPosition);

        let deltaAngle = -this.params.gravity * Math.sin(anglePuckPosition) * dtime;
        let deltaV = quat.setAxisAngle(quat.create(), axisPuckPosition, deltaAngle);

        quat.multiply(this.puckVelocity, deltaV, this.puckVelocity);

        let displacement = quat.pow(quat.create(), this.puckVelocity, dtime);

        let newPosition = quat.multiply(quat.create(), displacement, this.puckPosition);

        { // collision detection with horizon
            let horizonNormal = vec3.fromValues(0,0,1);
            let newPositionVector = vec3.transformQuat(vec3.create(), horizonNormal, newPosition);

            let cosine = vec3.dot(horizonNormal, newPositionVector);

            //TODO: use puck size for distance
            if (Math.abs(cosine) < 0.2) {
                console.log("collision with horizon");
                // did we move away? FIXME: can this be done more elegantly?
                //if (dist > sqr(quat.dot(this.mallet, newPosition))) {
                //    //TODO: reorient with mallet position
                //    let twist = getTwist(quat.create(), [0,0,1], this.puckVelocity);
                //    twist = quat.conjugate(twist, twist);
                //    quat.multiply(this.puckVelocity, this.puckVelocity, twist);
                //    quat.multiply(this.puckVelocity, this.puckVelocity, twist);
                //}
            }
        }

        { // collision detection with mallet
            let up = vec3.fromValues(0,0,1); // arbitrary
            let malletVector = vec3.transformQuat(vec3.create(), up, this.mallet);
            let newPositionVector = vec3.transformQuat(vec3.create(), up, newPosition);

            let newCosine = vec3.dot(malletVector, newPositionVector);

            //TODO: use puck and mallet sizes for distance
            if (Math.abs(newCosine) >= 0.97) {
                // might have a collision, did we move away?
                //FIXME: can this be done more elegantly?
                let positionVector = vec3.transformQuat(vec3.create(), up, this.puckPosition);
                let cosine = vec3.dot(malletVector, positionVector);
                if (newCosine > cosine) {
                    //TODO: reorient with mallet position
                    console.log("collision with puck");
                    //let twist = getTwist(quat.create(), [0,0,1], this.puckVelocity);
                    //twist = quat.conjugate(twist, twist);
                    //quat.multiply(this.puckVelocity, this.puckVelocity, twist);
                    //quat.multiply(this.puckVelocity, this.puckVelocity, twist);
                }
            }
        }

        // renormalize (error will build up otherwise)
        quat.normalize(this.puckVelocity, this.puckVelocity);
        quat.normalize(this.puckPosition, newPosition);
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
            mat4.fromQuat(m, this.puckPosition);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);
            
            this.dot.draw();
        }

        // draw the mallet

        { // rotate the mallet
            let m = this.uniforms.modelMatrix;
            mat4.fromQuat(m, this.mallet);
            mat4.translate(m, m, [0., 0., 1]);
            mat4.scale(m, m, [0.1, 0.1, 0.1]);
            
            this.dot.draw();
        }

    }
}

export default Pong;
