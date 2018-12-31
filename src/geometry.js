'use strict';

export default {
    uvHemisphere,
    uvSphere,
    disk
};

//TODO: we probably should generate an icosphere
function uvHemisphere(numLatitudes, numLongitudes) {
    //TODO: optimize, allocate proper float array of right size immediately
    //TODO: parametrize axis of the sphere?
    //TODO: separate out the UV coords, because we could want different ones

    let maxLatitude = 0.5 * Math.PI;

    var vertices = [];
    var uvs = [];

    for (let j = 0; j < numLatitudes; ++j) {
        let latitude = j * maxLatitude / numLatitudes + (0.5 * Math.PI - maxLatitude);
        let sinLatitude = Math.sin(latitude);
        let cosLatitude = Math.cos(latitude);

        for (let i = 0; i < numLongitudes; ++i) {
            let longitude = i * 2.0 * Math.PI / numLongitudes;
            let cosLongitude = Math.cos(longitude);
            let sinLongitude = Math.sin(longitude);

            let x = cosLatitude * cosLongitude;
            let y = cosLatitude * sinLongitude;
            let z = sinLatitude;

            vertices = vertices.concat([x, y, z]);

            // fisheye uv projection
            let r = Math.atan2(Math.sqrt(x * x + y * y), z) / Math.PI;
            let lambda = longitude; //Math.atan2(y, x);

            let u = 0.5 + r * Math.cos(lambda);
            let v = 0.5 + r * Math.sin(lambda);

            uvs = uvs.concat([u, v]);
        }
    }

    // add pole
    vertices = vertices.concat([0., 0., 1.]);
    uvs = uvs.concat([0.5, 0.5]);

    function triangulateQuadIndices(bl, br, tl, tr) {
        return [bl, br, tl,
            tl, br, tr
        ];
    }

    var indices = [];

    for (let j = 0; j < numLatitudes - 1; ++j) {
        for (let i = 0; i < numLongitudes - 1; ++i) {
            indices = indices.concat(triangulateQuadIndices(
                i + j * numLongitudes,
                i + 1 + j * numLongitudes,
                i + (1 + j) * numLongitudes,
                i + 1 + (1 + j) * numLongitudes));
        }

        // wrap around longitudes
        indices = indices.concat(triangulateQuadIndices(
            numLongitudes - 1 + j * numLongitudes,
            0 + j * numLongitudes,
            numLongitudes - 1 + (1 + j) * numLongitudes,
            0 + (1 + j) * numLongitudes));
    }

    // add triangles at the pole
    for (let i = 0; i < numLongitudes - 1; ++i) {
        indices = indices.concat([
            i + (numLatitudes - 1) * numLongitudes,
            i + 1 + (numLatitudes - 1) * numLongitudes,
            vertices.length / 3 - 1 /* pole */
        ]);
    }
    indices = indices.concat([
        numLongitudes - 1 + (numLatitudes - 1) * numLongitudes,
        0 + (numLatitudes - 1) * numLongitudes,
        vertices.length / 3 - 1 /* pole */
    ]);

    return {
        vertices: new Float32Array(vertices),
        uvs: new Float32Array(uvs),
        indices: new Uint16Array(indices)
    };
}
function uvSphere(numLatitudes, numLongitudes) {
    //TODO: optimize, allocate proper float array of right size immediately
    //TODO: parametrize axis of the sphere?
    //TODO: separate out the UV coords, because we could want different ones

    let maxLatitude = Math.PI;

    var vertices = [];

    for (let j = 0; j < numLatitudes; ++j) {
        let latitude = j * maxLatitude / numLatitudes + (0.5 * Math.PI - maxLatitude);
        let sinLatitude = Math.sin(latitude);
        let cosLatitude = Math.cos(latitude);

        for (let i = 0; i < numLongitudes; ++i) {
            let longitude = i * 2.0 * Math.PI / numLongitudes;
            let cosLongitude = Math.cos(longitude);
            let sinLongitude = Math.sin(longitude);

            let x = cosLatitude * cosLongitude;
            let y = cosLatitude * sinLongitude;
            let z = sinLatitude;

            vertices = vertices.concat([x, y, z]);
        }
    }

    // add pole
    vertices = vertices.concat([0., 0., 1.]);
    vertices = vertices.concat([0., 0., -1.]);


    function triangulateQuadIndices(bl, br, tl, tr) {
        return [bl, br, tl,
            tl, br, tr
        ];
    }

    var indices = [];

    for (let j = 0; j < numLatitudes - 1; ++j) {
        for (let i = 0; i < numLongitudes - 1; ++i) {
            indices = indices.concat(triangulateQuadIndices(
                i + j * numLongitudes,
                i + 1 + j * numLongitudes,
                i + (1 + j) * numLongitudes,
                i + 1 + (1 + j) * numLongitudes));
        }

        // wrap around longitudes
        indices = indices.concat(triangulateQuadIndices(
            numLongitudes - 1 + j * numLongitudes,
            0 + j * numLongitudes,
            numLongitudes - 1 + (1 + j) * numLongitudes,
            0 + (1 + j) * numLongitudes));
    }

    // add triangles at the poles
    for (let i = 0; i < numLongitudes - 1; ++i) {
        indices = indices.concat([
            i,
            i + 1,
            vertices.length / 3 - 1 //south pole
        ]);
        indices = indices.concat([
            i + (numLatitudes - 1) * numLongitudes,
            i + 1 + (numLatitudes - 1) * numLongitudes,
            vertices.length / 3 - 2 //north pole
        ]);
    }
    // adding last triangles
    indices = indices.concat([
        numLongitudes - 1,
        0,
        vertices.length / 3 - 1 //south pole
    ]);
    indices = indices.concat([
        numLongitudes - 1 + (numLatitudes - 1) * numLongitudes,
        0 + (numLatitudes - 1) * numLongitudes,
        vertices.length / 3 - 2 //north pole
    ]);

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}

function disk(numSpokes) {
    let vertices = new Float32Array(3 * (numSpokes + 1));

    // the center axis
    vertices[0] = 0.;
    vertices[1] = 0.;
    vertices[2] = 0.;

    // draw a circle with dots
    let aStep = 2 * Math.PI / numSpokes;
    let a = 0;

    for (let i = 3; i < vertices.length; i += 3) {
        a += aStep;
        vertices[i + 0] = Math.sin(a);
        vertices[i + 1] = Math.cos(a);
        vertices[i + 2] = 0;
    }

    let indices = new Uint16Array(numSpokes * 3);
    // connected the dots, with triangles
    for (let i = 0; i < numSpokes; ++i) {
        indices[3 * i + 0] = i + 1;
        indices[3 * i + 1] = (i + 1) % numSpokes + 1;
        indices[3 * i + 2] = 0;
    }

    return {
        vertices: vertices,
        indices: indices
    };
}