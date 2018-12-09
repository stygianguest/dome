'use strict';

export default { uvHemisphere };

//TODO: we probably should generate an icosphere
function uvHemisphere(numLatitudes, numLongitudes) {

    let maxLatitude = 0.5 * Math.PI;

    var vertices = [];
    var uvs = [];

    for (let j = 0; j < numLatitudes; ++j) {
        let latitude = j * maxLatitude/numLatitudes + (0.5*Math.PI - maxLatitude);
        let sinLatitude = Math.sin(latitude);
        let cosLatitude = Math.cos(latitude);

        for (let i = 0; i < numLongitudes; ++i) {
            let longitude = i * 2.0*Math.PI/numLongitudes;
            let cosLongitude = Math.cos(longitude);
            let sinLongitude = Math.sin(longitude);

            let x = cosLatitude * cosLongitude;
            let y = cosLatitude * sinLongitude;
            let z = sinLatitude;

            vertices = vertices.concat([x,y,z]);

            // fisheye uv projection
            let r = Math.atan2(Math.sqrt(x*x + y*y), z) / Math.PI;
            let phi = longitude;//Math.atan2(y, x);

            let u = 0.5 + r * Math.cos(phi);
            let v = 0.5 + r * Math.sin(phi);

            uvs = uvs.concat([u,v]);
        }
    }

    // add pole
    vertices = vertices.concat([0., 0., 1.]);
    uvs = uvs.concat([0.5, 0.5]);

    function triangulateQuadIndices(bl, br, tl, tr) {
        return [bl, br, tl,
                tl, br, tr];
    }

    var indices = [];

    for (let j = 0; j < numLatitudes-1; ++j) {
        for (let i = 0; i < numLongitudes-1; ++i) {
            indices = indices.concat(triangulateQuadIndices(
                i   +    j  * numLongitudes,
                i+1 +    j  * numLongitudes,
                i   + (1+j) * numLongitudes,
                i+1 + (1+j) * numLongitudes));
        }

        // wrap around longitudes
        indices = indices.concat(triangulateQuadIndices(
            numLongitudes-1 +    j  * numLongitudes,
            0               +    j  * numLongitudes,
            numLongitudes-1 + (1+j) * numLongitudes,
            0               + (1+j) * numLongitudes));
    }

    // add triangles at the pole
    for (let i = 0; i < numLongitudes-1; ++i) {
        indices = indices.concat([
            i   + (numLatitudes-1) * numLongitudes,
            i+1 + (numLatitudes-1) * numLongitudes,
            vertices.length/3 - 1 /* pole */]);
    }
    indices = indices.concat([
        numLongitudes-1 + (numLatitudes-1) * numLongitudes,
        0               + (numLatitudes-1) * numLongitudes,
        vertices.length/3 - 1 /* pole */]);

    return { vertices: vertices, uvs: uvs, indices: indices };
}
