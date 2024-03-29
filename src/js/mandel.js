/* eslint-disable */
/* eslint-disable no-debugger */
/* eslint-disable no-undef */
const R = require("ramda");

var mandelRect;

const mapIndexed = R.addIndex(R.map);

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

export class Rectangle {
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
    return R.range(0, numPoints).map(n => n * increment + start);
}

const getMandelGridPoints = R.curry((canvasRect, mandelRect) => {
    return {
        mandelGridXpoints: getSteps(mandelRect.left, mandelRect.width, canvasRect.width),
        mandelGridYpoints: getSteps(mandelRect.top, -mandelRect.height, canvasRect.height)
    };
});

export function getCanvas() {
    return document.getElementById("mandelcanvas");
}

export function getSelectorOverlay() {
    return document.getElementById("selectorOverlay");
}

function getCanvasDimensions(canvas) {
    return { width: canvas.width, height: canvas.height };
}

const drawRow = R.curry((canvasData, canvasY, colours) => {

    const canvasWidth = colours.length;

    const rowIndex = canvasY * canvasWidth * 4;
    const getIndex = x => rowIndex + x * 4;  // int -> int

    // int -> colour -> void
    const drawPixel = R.curry((index, colour) => {
        canvasData.data[index + 0] = colour.r;
        canvasData.data[index + 1] = colour.g;
        canvasData.data[index + 2] = colour.b;
        canvasData.data[index + 3] = 255;
    });

    const setCanvasPixelColour = R.pipe(getIndex, drawPixel); // int -> colour -> void
    const setCanvasRowPixels = mapIndexed((colour, canvasX) => setCanvasPixelColour(canvasX)(colour)); // colour[] -> void
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

export function zoom(canvasSelectionRect) {

    const newMandelRect = projectMandelSelectionRect(canvasSelectionRect, mandelRect);
    mandelRect = newMandelRect;
    window.goDrawDots();
}

function resetMandelRect() {
    mandelRect = new Rectangle(-2, 1.5, 3, 3);
}

function updateCanvas(canvasContext, canvasData) {
    canvasContext.putImageData(canvasData, 0, 0);
    getSelectorOverlay().style.cursor = "crosshair";
}

function drawDots(mandelRect) {

    const maxIterations = 5000;
    const maxThreads = 4;

    const c = getCanvas();
    var width, height;
    ({ width, height } = getCanvasDimensions(c));
    const ctx = c.getContext("2d", {willReadFrequently: true});
    const canvasData = ctx.getImageData(0, 0, width, height);
    const canvasRect = new Rectangle(0, 0, width, height);

    const startCalcWorker = (mandelJob) => {
        let w = new Worker(new URL('./calcmandel.worker.js', import.meta.url));
        w.postMessage(mandelJob);
        w.onmessage = (event) => {

            const mandelChunk = event.data;
            drawChunk(mandelChunk, mandelJob.firstRowIndex, maxThreads);
        };
    };

    const drawChunk = (mandelChunk, firstRowIndex, rowSeparation) => {

        const indexMandelRow = mapIndexed((row, canvasY) => { return { rowIndex: firstRowIndex + (rowSeparation * canvasY), colours: row[1] }; });
        const drawRowToCanvasData = rowColours => drawRow(canvasData, rowColours.rowIndex, rowColours.colours);

        R.pipe(indexMandelRow,
            R.forEach(drawRowToCanvasData))(mandelChunk);

        updateCanvas(ctx, canvasData);
    };

    R.pipe(getMandelGridPoints(canvasRect),
        getJobs(maxThreads, maxIterations),
        R.forEach(startCalcWorker))(mandelRect);
}

function drawDotsWithHourglass(mandelRect) {
    getSelectorOverlay().style.cursor = "wait";
    drawDots(mandelRect);
}

const filterIndexed = R.addIndex(R.filter);

const getJobs = R.curry((numWorkers, maxIterations, gridPoints) => {

    const everyNthElement = (n, first) => filterIndexed((_, idx) => idx % n === first); // (int[], int) -> int[] -> int[]
    const getWorkerRows = workerId => everyNthElement(numWorkers, workerId); // int -> int[] -> int[]

    return R.pipe(R.map(workerId => getWorkerRows(workerId)(gridPoints.mandelGridYpoints)),
        mapIndexed((rowChunk, firstRowIndex) => {
            return {
                firstRowIndex: firstRowIndex,
                array: rowChunk,
                gridPoints: gridPoints,
                maxIterations: maxIterations
            };
        }))(R.range(0, numWorkers));
});

window.goDrawDots = function goDrawDots() {
    drawDotsWithHourglass(mandelRect);
};

window.reset = function () {
    resetMandelRect();
    window.goDrawDots();
};

window.reset();
