/* eslint-disable */
/* eslint-disable no-debugger */
/* eslint-disable no-undef */
const R = require("ramda");

const mapIndexed = R.addIndex(R.map);

const getMandelShade = R.curry((maxIterations, b, a) => {
    var currDistSq, aSq = 0.0, bSq = 0.0;
    const originalA = a, originalB = b;
    var numIterations = 0;

    while (numIterations++ < maxIterations) {
        aSq = a * a;
        bSq = b * b;
        currDistSq = aSq + bSq;
        if (currDistSq > 4)
            return numIterations;
        b = 2 * a * b + originalB;
        a = (aSq - bSq) + originalA;
    }
    return maxIterations;
});

const mandelShadeToColour = R.curry((maxIterations, numIterations) => {
    if (numIterations === 0) {
        return { r: 255, g: 255, b: 255 }; // For this complex number the function immediately escapes to infinity = white.
    } else if (numIterations >= maxIterations) {
        return { r: 0, g: 0, b: 0 }; // The function (probably) never escapes to infinity = black.
    } else {
        var pixelShade = Math.round((maxIterations - numIterations) / maxIterations * 255);
        return { r: pixelShade, g: pixelShade, b: pixelShade }; // The longer it takes to escape, the darker the pixel.
    }
});

const getMandelRowWithIndex = R.curry((maxIterations, mandelXs, canvasY, mandelY) => {
    const rowColours = mandelXs.map(R.pipe(getMandelShade(maxIterations, mandelY), mandelShadeToColour(maxIterations)));
    return R.pair(canvasY, rowColours);
});

const getChunkOfMandelRows = (maxIterations, mandelGridXpoints, mandelGridYPoints) => {

    return mapIndexed((mandelGridY, canvasY) => getMandelRowWithIndex(maxIterations, mandelGridXpoints, canvasY, mandelGridY))(mandelGridYPoints);
};

self.addEventListener("message", (event) => {

    var params = event.data;
    const mandelYpoints = params.array;

    const result = getChunkOfMandelRows(params.maxIterations, params.gridPoints.mandelGridXpoints, mandelYpoints);

    self.postMessage(result);
});
