console.log("This is the index page");


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

    projectPoint(point, fromRect) {
        return new Point(((point.x - fromRect.left) / fromRect.width) * this.width + this.left, ((point.y - fromRect.top) / fromRect.height) * this.height + this.top);
    }
}

var mandelRect;

function getCanvas() {
    return document.getElementById("mandelcanvas");
}

function getCanvasDimensions(canvas) {
    return { width: canvas.width, height: canvas.height };
}

function drawPixel(canvasData, canvasWidth, x, y, r, g, b, a) {
    var index = (x + y * canvasWidth) * 4;

    canvasData.data[index + 0] = r;
    canvasData.data[index + 1] = g;
    canvasData.data[index + 2] = b;
    canvasData.data[index + 3] = a;
}

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

    var canvasRect = new Rectangle(0, 0, width, height);
    var col1 = { r: 100, g: 100, b: 100, a: 100 };
    var col2 = { r: 255, g: 0, b: 100, a: 100 };
    var black = { r: 255, g: 255, b: 255, a: 255 };
    var white = { r: 0, g: 0, b: 0, a: 255 };

    const maxIterations = 100;
    var colours = [col1, col2];
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var mandelPoint = mandelRect.projectPoint(new Point(x, y), canvasRect);
            var numIterations = isInSet(mandelPoint.x, mandelPoint.y, maxIterations);
            if (numIterations === 0) {
                drawPixel(canvasData, width, x, y, black.r, black.g, black.b, black.a);
            } else if (numIterations >= maxIterations) {
                drawPixel(canvasData, width, x, y, white.r, white.g, white.b, white.a);
            } else {
                var pixelShade = Math.round((maxIterations - numIterations) / maxIterations * 255);
                drawPixel(canvasData, width, x, y, pixelShade, pixelShade, pixelShade, 255);
            }
        }
    }
    updateCanvas(ctx, canvasData);
}



function isInSet(a, b, maxIterations) {
    var currDistSq, aSq = 0.0, bSq = 0.0;
    var originalA = a, originalB = b;
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

    canvas.onclick = function (e) {
        if (element !== null) {
            zoom(new Rectangle(parseInt(element.style.left), parseInt(element.style.top), parseInt(element.style.width), parseInt(element.style.height)));
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