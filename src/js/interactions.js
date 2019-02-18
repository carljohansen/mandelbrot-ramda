import { getCanvas, getSelectorOverlay, zoom, Rectangle } from "./mandel.js";

function initSelectorOverlay(canvas, selectorOverlay) {

    selectorOverlay.style.left = canvas.offsetLeft + "px";
    selectorOverlay.style.top = canvas.offsetTop + "px";
    selectorOverlay.style.width = canvas.width + "px";
    selectorOverlay.style.height = canvas.height + "px";
}

function initDraw(canvas, selectorOverlay) {

    initSelectorOverlay(canvas, selectorOverlay);

    function setMousePosition(e) {
        var ev = e || window.event; //Moz || IE
        if (ev.pageX) { //Moz
            mouse.x = ev.offsetX;
            mouse.y = ev.offsetY;
        }
    }

    var mouse = {
        x: 0,
        y: 0,
        startX: 0,
        startY: 0
    };

    var element = null;

    selectorOverlay.onmousemove = function (e) {
        setMousePosition(e);
        if (element !== null) {
            const rawWidth = Math.abs(mouse.x - mouse.startX);
            const rawHeight = Math.abs(mouse.y - mouse.startY);
            const squareSize = Math.min(rawWidth, rawHeight);
            element.style.width = squareSize + "px";
            element.style.height = squareSize + "px";
            element.style.left = Math.min(mouse.x, mouse.startX) + "px";
            element.style.top = Math.min(mouse.y, mouse.startY) + "px";
        }
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

    selectorOverlay.onmousedown = function () {
        mouse.startX = mouse.x;
        mouse.startY = mouse.y;
        element = document.createElement("div");
        element.className = "rectangle";
        element.style.left = mouse.x + "px";
        element.style.top = mouse.y + "px";
        selectorOverlay.appendChild(element);
    };

    selectorOverlay.onmouseup = function () {
        const rawSelectionRect = new Rectangle(parseInt(element.style.left), parseInt(element.style.top), parseInt(element.style.width), parseInt(element.style.height));
        const canvasRelativeSelectionRect = fixCanvasRegionAspectRatio(rawSelectionRect);
        if (canvasRelativeSelectionRect.width > 10) {
            zoom(canvasRelativeSelectionRect);
        }
        selectorOverlay.removeChild(element);
        element = null;
    };
}

initDraw(getCanvas(), getSelectorOverlay());
