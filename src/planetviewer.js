'use strict';

import { mat4, mat3, vec2 } from 'gl-matrix';
import { Parameters } from './Parameters.js';
import Renderer from './Renderer.js';
import geometry from './geometry.js';

const planetVertexShader =
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

const planetFragmentShader =
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

        highp vec3 lightIntensity = vec3(${Math.PI});

        // because the sun is very far away, we can assume a constant direction for it
        highp vec3 light = vec3(1., 0., 0.);

        highp float cosine = dot(normal, light);

        color = vec4(lightIntensity * texture(albedo,uv).xyz * max(0., cosine) / ${Math.PI}, 1.);
        color += (-cosine + 1.) / 2. * vec4(texture(emission,uv).xyz, 0.);

        highp float cloudAlpha = dot(texture(clouds,uv).xyz, vec3(1. / 3.));
        color *= vec4(vec3(1.0 - cloudAlpha), 1.);
        color += vec4(lightIntensity * texture(clouds,uv).xyz * max(0., cosine) / ${Math.PI}, 0.);
      }
    `;

class PlanetViewer {
    constructor(textures, renderer, onUpdate = () => {}) {
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
            albedo: renderer.createTexture(textures.albedo, onUpdate),
            emission: renderer.createTexture(textures.emission, onUpdate),
            clouds: renderer.createTexture(textures.clouds, onUpdate)
        };

        this.sphere = renderer.createObject(
            geometry.uvSphere(24, 64),
            this.uniforms,
            planetVertexShader,
            planetFragmentShader);
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

export default PlanetViewer;
