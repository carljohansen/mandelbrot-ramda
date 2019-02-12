/* eslint-disable no-debugger */
/* eslint-disable no-undef */
const R = require("ramda");

import Worker from "./calcmandel.worker.js";

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

function getMandelGridPoints(canvasRect, mandelRect) {
    return {
        mandelGridXpoints: getSteps(mandelRect.left, mandelRect.width, canvasRect.width),
        mandelGridYpoints: getSteps(mandelRect.top, -mandelRect.height, canvasRect.height)
    };
}

var mandelRect;

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

function projectMandelSelectionRect(canvasSelectionRect) {
    const c = getCanvas();
    var width, height;
    ({ width, height } = getCanvasDimensions(c));

    const canvasRect = new Rectangle(0, 0, width, height);
    const topLeft = mandelRect.projectPointInvertedVertical(new Point(canvasSelectionRect.left, canvasSelectionRect.top), canvasRect);
    const widthHeight = mandelRect.projectVectorInvertedVertical(new Point(canvasSelectionRect.width, canvasSelectionRect.height), canvasRect);

    return new Rectangle(topLeft.x, topLeft.y, widthHeight.x, widthHeight.y);
}

function zoom(canvasSelectionRect) {

    const newMandelRect = projectMandelSelectionRect(canvasSelectionRect);
    mandelRect = newMandelRect;
}

function resetMandelRect() {
    mandelRect = new Rectangle(-2, 1.5, 3, 3);
}

function updateCanvas(canvasContext, canvasData) {
    canvasContext.putImageData(canvasData, 0, 0);
}

function drawDots(mandelRect) {

    var c = getCanvas();
    var width, height;
    ({ width, height } = getCanvasDimensions(c));
    var ctx = c.getContext("2d");
    var canvasData = ctx.getImageData(0, 0, width, height);

    const canvasRect = new Rectangle(0, 0, width, height);

    const maxIterations = 5000;
    const maxThreads = 4;

    const gridPoints = getMandelGridPoints(canvasRect, mandelRect);

    var jobs = getJobs(gridPoints, maxThreads);

    const rowIndexer = (acc, val) => [acc + val.length, { startRow: acc, array: val }];
    const jobsWithStartRowIndexes = R.mapAccum(rowIndexer, 0, jobs)[1];

    const workerParams = jobsWithStartRowIndexes.map(job => {
        return {
            startRow: job.startRow,
            array: job.array,
            gridPoints: gridPoints,
            maxIterations: maxIterations
        };
    });
    
    R.forEach(p => {
        let w = new Worker();
        w.postMessage(p);
        w.onmessage = (event) => {

            const startRow = event.data[0];
            const mandelRows = event.data[1];
            const indexMandelRow = mapIndexed((row, canvasY) => R.pair(startRow + canvasY, row));
            const drawRowToCanvasData = yAndCols => drawRow(canvasData, yAndCols[0], yAndCols[1][1]);
            R.pipe(indexMandelRow, R.forEach(drawRowToCanvasData))(mandelRows);
            updateCanvas(ctx, canvasData);
        };
    })(workerParams);
}

const getJobs = (gridPoints, numWorkers) => {

    const rowsPerWorker = Math.round(gridPoints.mandelGridYpoints.length / numWorkers) + 1;
    return R.splitEvery(rowsPerWorker, gridPoints.mandelGridYpoints);
};

//---------------------------------------------------------

initDraw(getCanvas());

function initDraw(canvas) {
    function setMousePosition(e) {
        var ev = e || window.event; //Moz || IE
        if (ev.pageX) { //Moz
            mouse.x = ev.offsetX; //ev.pageX + window.pageXOffset;
            mouse.y = ev.offsetY; // ev.pageY + window.pageYOffset;
        } else if (ev.clientX) { //IE
            mouse.x = ev.clientX + document.body.scrollLeft;
            mouse.y = ev.clientY + document.body.scrollTop;
        }
    }

    var mouse = {
        x: 0,
        y: 0,
        startX: 0,
        startY: 0
    };

    var element = null;

    canvas.onmousemove = function (e) {
        setMousePosition(e);
        if (element !== null) {
            element.style.width = Math.abs(mouse.x - mouse.startX) + "px";
            element.style.height = Math.abs(mouse.y - mouse.startY) + "px";
            element.style.left = (mouse.x - mouse.startX < 0) ? mouse.x + "px" : mouse.startX + "px";
            element.style.top = (mouse.y - mouse.startY < 0) ? mouse.y + "px" : mouse.startY + "px";
        }
    };

    const normaliseCanvasRegionRect = (regionRect) => {
        const canvas = getCanvas();
        return regionRect; //regionRect.translate(-canvas.offsetLeft, -canvas.offsetTop);
    };

    const fixCanvasRegionAspectRatio = (regionRect) => {
        const canvas = getCanvas();
        const canvasAspectRatio = canvas.width / canvas.height;
        if (regionRect.width < regionRect.height) {
            return new Rectangle(regionRect.left, regionRect.top, regionRect.width, Math.round(regionRect.width / canvasAspectRatio));
        } else {
            return new Rectangle(regionRect.left, regionRect.top, Math.round(regionRect.height * canvasAspectRatio), regionRect.height);
        }
    };

    canvas.onclick = function (e) {
        if (element !== null) {
            const rawSelectionRect = new Rectangle(parseInt(element.style.left), parseInt(element.style.top), parseInt(element.style.width), parseInt(element.style.height));
            const canvasRelativeSelectionRect = R.pipe(normaliseCanvasRegionRect, fixCanvasRegionAspectRatio)(rawSelectionRect);
            zoom(canvasRelativeSelectionRect);
            drawDots(mandelRect);
            element = null;
            canvas.style.cursor = "default";
        } else {
            mouse.startX = mouse.x;
            mouse.startY = mouse.y;
            element = document.createElement("div");
            element.className = "rectangle";
            element.style.left = mouse.x + "px";
            element.style.top = mouse.y + "px";
            canvas.appendChild(element);
            canvas.style.cursor = "crosshair";
        }
    };
}
//---------------------------------------------------------

window.goDrawDots = function goDrawDots() {
    drawDots(mandelRect);
};

resetMandelRect();
drawDots(mandelRect);
