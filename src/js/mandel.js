const R = require("ramda");

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

    projectPoint(point, fromRect) {
        return new Point(((point.x - fromRect.left) / fromRect.width) * this.width + this.left, ((point.y - fromRect.top) / fromRect.height) * this.height + this.top);
    }

    projectX(fromRect, x) {
        return ((x - fromRect.left) / fromRect.width) * this.width + this.left;
    }

    projectY(fromRect, y) {
        return ((y - fromRect.top) / fromRect.height) * this.height + this.top;
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
        mandelGridYpoints: getSteps(mandelRect.top, mandelRect.height, canvasRect.height)
    };
}

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
        return { r: 255, g: 255, b: 255, a: 255 }; // At this point the function immediately escapes to infinity = white.
    } else if (numIterations >= maxIterations) {
        return { r: 0, g: 0, b: 0, a: 255 }; // The function (probably) never escapes to infinity = black.
    } else {
        var pixelShade = Math.round((maxIterations - numIterations) / maxIterations * 255);
        return { r: pixelShade, g: pixelShade, b: pixelShade, a: 255 }; // The longer it takes to escpae, the darker the pixel.
    }
});

const getMandelRowWithIndex = R.curry((maxIterations, mandelXs, canvasY, mandelY) => {
    const rowColours = mandelXs.map(R.pipe(getMandelShade(maxIterations, mandelY), mandelShadeToColour(maxIterations)));
    return R.pair(canvasY, rowColours);
});

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

function zoom(canvasSelectionRect) {
    var c = getCanvas();
    var width, height;
    ({ width, height } = getCanvasDimensions(c));
    var canvasRect = new Rectangle(0, 0, width, height);
    var topLeft = mandelRect.projectPoint(new Point(canvasSelectionRect.left, canvasSelectionRect.top), canvasRect);
    var bottomRight = mandelRect.projectPoint(new Point(canvasSelectionRect.left + canvasSelectionRect.width, canvasSelectionRect.top + canvasSelectionRect.height), canvasRect);
    mandelRect.left = topLeft.x;
    mandelRect.top = topLeft.y;
    mandelRect.width = bottomRight.x - topLeft.x;
    mandelRect.height = bottomRight.y - topLeft.y;
}

function resetMandelRect() {
    mandelRect = new Rectangle(-2, -2, 4, 4);
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

    const maxIterations = 500;

    const gridPoints = getMandelGridPoints(canvasRect, mandelRect);

    const getMandelRow = mapIndexed((mandelGridY, canvasY) => getMandelRowWithIndex(maxIterations, gridPoints.mandelGridXpoints, canvasY, mandelGridY));
    const drawRowToCanvasData = yAndCols => drawRow(canvasData, yAndCols[0], yAndCols[1]);

    // TODO: I don't like the way gridYpoints is passed in at the start of the pipe but gridXpoints is closured half way through the pipe.
    R.pipe(getMandelRow, R.forEach(drawRowToCanvasData))(gridPoints.mandelGridYpoints);
    updateCanvas(ctx, canvasData);
}

//---------------------------------------------------------

initDraw(getCanvas());

function initDraw(canvas) {
    function setMousePosition(e) {
        var ev = e || window.event; //Moz || IE
        if (ev.pageX) { //Moz
            mouse.x = ev.pageX + window.pageXOffset;
            mouse.y = ev.pageY + window.pageYOffset;
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
        return regionRect.translate(-canvas.offsetLeft, -canvas.offsetTop);
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
            //console.log("begun.");
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

resetMandelRect();
drawDots(mandelRect);