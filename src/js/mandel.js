/* eslint-disable no-debugger */
/* eslint-disable no-undef */
const R = require("ramda");

import Worker from "./calcmandel.worker.js";

var mandelRect;

const mapIndexed = R.addIndex(R.map);

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Rectangle {
    constructor(left, top, width, height) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }

    translate(shiftLeft, shiftTop) {
        return new Rectangle(this.left + shiftLeft, this.top + shiftTop, this.width, this.height);
    }

    projectPointInvertedVertical(point, fromRect) {
        const projectedDistance = this.projectVectorInvertedVertical(point, fromRect);
        return new Point(projectedDistance.x + this.left, this.top - projectedDistance.y);
    }

    projectVectorInvertedVertical(vector, fromRect) {
        return new Point(((vector.x - fromRect.left) / fromRect.width) * this.width, ((vector.y - fromRect.top) / fromRect.height) * this.height);
    }
}

function getSteps(start, distance, numPoints) {

    const increment = distance / (numPoints - 1);
    const stepper = n => (n.step === numPoints) ? false : [n.val, { val: n.val + increment, step: n.step + 1 }];
    return R.unfold(stepper, { val: start, step: 0 });
}

const getMandelGridPoints = R.curry((canvasRect, mandelRect) => {
    return {
        mandelGridXpoints: getSteps(mandelRect.left, mandelRect.width, canvasRect.width),
        mandelGridYpoints: getSteps(mandelRect.top, -mandelRect.height, canvasRect.height)
    };
});

function getCanvas() {
    return document.getElementById("mandelcanvas");
}

function getCanvasDimensions(canvas) {
    return { width: canvas.width, height: canvas.height };
}

const drawRow = R.curry((canvasData, canvasY, colours) => {

    const canvasWidth = colours.length;

    const rowIndex = canvasY * canvasWidth * 4;
    const getIndex = x => rowIndex + x * 4;

    const drawPixel = R.curry((index, colour) => {
        canvasData.data[index + 0] = colour.r;
        canvasData.data[index + 1] = colour.g;
        canvasData.data[index + 2] = colour.b;
        canvasData.data[index + 3] = colour.a;
    });

    const setCanvasPixelColour = R.pipe(getIndex, drawPixel);
    const setCanvasRowPixels = mapIndexed((colour, canvasX) => setCanvasPixelColour(canvasX)(colour));
    setCanvasRowPixels(colours);
});

function projectMandelSelectionRect(canvasSelectionRect, currMandelRect) {
    const c = getCanvas();
    var width, height;
    ({ width, height } = getCanvasDimensions(c));

    const canvasRect = new Rectangle(0, 0, width, height);
    const topLeft = currMandelRect.projectPointInvertedVertical(new Point(canvasSelectionRect.left, canvasSelectionRect.top), canvasRect);
    const widthHeight = currMandelRect.projectVectorInvertedVertical(new Point(canvasSelectionRect.width, canvasSelectionRect.height), canvasRect);

    return new Rectangle(topLeft.x, topLeft.y, widthHeight.x, widthHeight.y);
}

function zoom(canvasSelectionRect) {

    const newMandelRect = projectMandelSelectionRect(canvasSelectionRect, mandelRect);
    mandelRect = newMandelRect;
    window.goDrawDots();
}

function resetMandelRect() {
    mandelRect = new Rectangle(-2, 1.5, 3, 3);
}

function updateCanvas(canvasContext, canvasData) {
    canvasContext.putImageData(canvasData, 0, 0);
}

function augmentJobsWithStartRowIndexes(jobs) {
    const rowIndexer = (acc, val) => [acc + val.array.length, R.mergeLeft(val, { startRow: acc })];
    return R.mapAccum(rowIndexer, 0, jobs)[1];
}

function drawDots(mandelRect) {

    const maxIterations = 5000;
    const maxThreads = 4;

    const c = getCanvas();
    var width, height;
    ({ width, height } = getCanvasDimensions(c));
    const ctx = c.getContext("2d");
    const canvasData = ctx.getImageData(0, 0, width, height);
    const canvasRect = new Rectangle(0, 0, width, height);

    const startCalcWorker = (mandelJob) => {
        let w = new Worker();
        w.postMessage(mandelJob);
        w.onmessage = (event) => {

            const startRowIndex = event.data[0];
            const mandelChunk = event.data[1];
            drawChunk(mandelChunk, startRowIndex);
        };
    };

    const drawChunk = (mandelChunk, startRowIndex) => {

        const indexMandelRow = mapIndexed((row, canvasY) => { return { rowIndex: startRowIndex + canvasY, colours: row[1] }; });
        const drawRowToCanvasData = rowColours => drawRow(canvasData, rowColours.rowIndex, rowColours.colours);

        R.pipe(indexMandelRow,
            R.forEach(drawRowToCanvasData))(mandelChunk);
            
        updateCanvas(ctx, canvasData);
    };

    R.pipe(getMandelGridPoints(canvasRect),
        getJobs(maxThreads, maxIterations),
        augmentJobsWithStartRowIndexes,
        R.forEach(startCalcWorker))(mandelRect);
}

const getJobs = R.curry((numWorkers, maxIterations, gridPoints) => {

    const rowsPerWorker = Math.round(gridPoints.mandelGridYpoints.length / numWorkers) + 1;
    return R.splitEvery(rowsPerWorker, gridPoints.mandelGridYpoints)
        .map(rowChunk => {
            return {
                array: rowChunk,
                gridPoints: gridPoints,
                maxIterations: maxIterations
            };
        });
});

window.goDrawDots = function goDrawDots() {
    drawDots(mandelRect);
};

module.exports = { getCanvas: getCanvas, Rectangle: Rectangle, zoom: zoom };

resetMandelRect();
window.goDrawDots();
