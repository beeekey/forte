// ......................................................................................................
//
//  a grid-like canvas for drawing topology optimization compatible design
//
//  by xiangchen@acm.org, v1.0, 10/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.GridCanvas = function (parent, width, height, strokeColor) {
    this._id = (100 + Math.random() * 900 | 0).toString();
    this._parent = parent;

    this._strokeRadius = 1;
    this._strokeColor = strokeColor == undefined ? '#000000' : strokeColor;

    // canvas
    this._canvas = $('<canvas id="canvas"></canvas>');
    var parentOffset = this._parent.offset();
    this._canvas.css('position', 'absolute');
    this._canvas.css('left', parentOffset.left);
    this._canvas.css('top', parentOffset.top);
    this._canvas[0].width = this._parent.width();
    this.setResolution(width, height);
    this._defaultAlpha = 1;
    this._canvas.css('opacity', this._defaultAlpha);

    this._canvas.mousedown(this.drawDown.bind(this));
    this._canvas.mousemove(this.drawMove.bind(this));
    this._canvas.mouseup(this.drawUp.bind(this));

    this._parent.append(this._canvas);

    this._context = this._canvas[0].getContext('2d');
    this._context.fillStyle = this._strokeColor;

    this._enabled = true;

    // this._inputEvents = [];

    // this._smoothRadius = Math.sqrt(width * width + height * height) / 2;
};

// max canvas height to stay within a normal screen
// FORTE.GridCanvas.MAXCANVASHEIGHT = 640;

FORTE.GridCanvas.prototype = {
    constructor: FORTE.GridCanvas
};

//
//  enable the canvas and set opacity to 1
//
FORTE.GridCanvas.prototype.enable = function () {
    this._enabled = true;
    this._canvas.css('opacity', this._defaultAlpha);
}

//
//  disable the canvas and set opacity to the given value
//
FORTE.GridCanvas.prototype.disable = function (opacity) {
    this._enabled = false;
    this._canvas.css('opacity', opacity);
}

//
// set the resolution of the grid
//
FORTE.GridCanvas.prototype.setResolution = function (w, h) {
    this._canvas[0].width = this._parent.width();
    this._canvas[0].height = this._canvas[0].width * h / w;
    this._cellSize = this._canvas[0].width / w;
    this._bitmap = XAC.initMDArray([h, w], 0);
    this._gridWidth = w;
    this._gridHeight = h;
    this._parent.css('height', this._canvas[0].height + 'px');
    this._context = this._canvas[0].getContext('2d');
    this._context.fillStyle = this._strokeColor;
};

//
//  mousedown for drawing
//
FORTE.GridCanvas.prototype.drawDown = function (e) {
    if (!this._enabled || e.button == XAC.RIGHTMOUSE) return;
    this._isDown = true;

    this._strokePoints = [];
    this._mousePoints = [new THREE.Vector3(e.clientX, e.clientY, 0)];

    this._doDraw(e, this._toErase);
    if (this._toErase) this._strokeRadius *= 2;
};

//
//  mousemove for drawing
//
FORTE.GridCanvas.prototype.drawMove = function (e) {
    if (!this._enabled || !this._isDown || e.button == XAC.RIGHTMOUSE) return;

    this._mousePoints.push(new THREE.Vector3(e.clientX, e.clientY, 0));
    this._doDraw(e, this._toErase);
};

//
//  mouseup for drawing
//
FORTE.GridCanvas.prototype.drawUp = function (e) {
    if (!this._enabled) return;
    this._isDown = false;
    if (this._toErase) this._strokeRadius /= 2;
};

//
//  actually perform the drawing based on a mouse event
//
FORTE.GridCanvas.prototype._doDraw = function (e, toErase) {
    if (this._min == undefined) {
        this._min = this._min || {
            x: this._canvas[0].width,
            y: this._canvas[0].height
        };
        this._max = this._max || {
            x: 0,
            y: 0
        };
    }

    var canvasOffset = this._canvas.offset();
    var xcenter = ((e.clientX - canvasOffset.left) / this._cellSize) | 0;
    var ycenter = ((e.clientY - canvasOffset.top) / this._cellSize) | 0;

    // how alpha value descreases as further from a given drawn point
    var alphaDescent = 0.5 / this._strokeRadius;

    // draw in the neighborhood of the mouse cursor
    for (var dx = -this._strokeRadius; dx <= this._strokeRadius; dx += 1) {
        var alphas = [];
        for (var dy = -this._strokeRadius; dy <= this._strokeRadius; dy += 1) {
            var x = Math.max(0, Math.min(this._gridWidth - 1, xcenter + dx));
            var y = Math.max(0, Math.min(this._gridHeight - 1, ycenter + dy));

            x = Math.floor(x + 0.5);
            y = Math.floor(y + 0.5);

            this._context.globalAlpha = 1 - (Math.abs(dx) + Math.abs(dy)) * alphaDescent;
            this._context.beginPath();
            if (toErase) {
                if (x * this._cellSize - this._strokeRadius * 2 * this._cellSize < this._min.x) this._min.x = x * this._cellSize;
                if (x * this._cellSize + this._strokeRadius * 2 * this._cellSize > this._max.x) this._max.x = x * this._cellSize;
                if (y * this._cellSize - this._strokeRadius * 2 * this._cellSize < this._min.y) this._min.y = y * this._cellSize;
                if (y * this._cellSize + this._strokeRadius * 2 * this._cellSize > this._max.y) this._max.y = y * this._cellSize;

                this._context.clearRect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._bitmap[y][x] = 0;
            } else {
                this._min.x = Math.min(this._min.x, x * this._cellSize);
                this._min.y = Math.min(this._min.y, y * this._cellSize);
                this._max.x = Math.max(this._max.x, x * this._cellSize);
                this._max.y = Math.max(this._max.y, y * this._cellSize);

                this._context.rect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._context.fill();
                this._bitmap[y][x] = 1;
            }
            this._strokePoints.push({
                x: x,
                y: y
            });
            this._context.closePath();
        }
    }
    this._context.globalAlpha = 1;
}

//
//  clear the canvas
//
FORTE.GridCanvas.prototype.clear = function () {
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    this._bitmap = XAC.initMDArray([this._gridHeight, this._gridWidth], 0);
}

//
//  draw on the canvas from an input bitmap, using (x0, y0) as the origin
//
FORTE.GridCanvas.prototype.drawFromBitmap = function (bitmap, x0, y0) {
    var h = bitmap.length;
    var w = h > 0 ? bitmap[0].length : 0;
    if (h <= 0 || w <= 0) return;
    // var originalStyle = this._context.fillStyle;
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    for (var j = 0; j < h; j++) {
        for (var i = 0; i < w; i++) {
            var x = x0 + i,
                y = y0 + j;
            this._context.globalAlpha = Math.min(1, bitmap[j][i] / FORTE.PSEUDOMAXALPHA);
            this._context.beginPath();
            this._context.rect((x * this._cellSize) | 0, (y * this._cellSize) | 0,
                (this._cellSize + 1) | 0, (this._cellSize + 1) | 0);
            this._context.fill();
            this._context.closePath();
            this._bitmap[y][x] = bitmap[j][i];
        }
    }
    this._context.globalAlpha = 1;
    // this._context.fillStyle = originalStyle;
}

//
//  force to redraw everything
//
FORTE.GridCanvas.prototype.forceRedraw = function (colorMap, cutOff) {
    var originalStyle = this._context.fillStyle;
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    for (var j = 0; j < this._gridHeight; j++) {
        for (var i = 0; i < this._gridWidth; i++) {
            if (cutOff != undefined && this._bitmap[j][i] < cutOff) continue;
            this._context.globalAlpha = Math.min(1, this._bitmap[j][i] / FORTE.PSEUDOMAXALPHA);
            this._context.beginPath();
            this._context.rect((i * this._cellSize) | 0, (j * this._cellSize) | 0,
                (this._cellSize + 1) | 0, (this._cellSize + 1) | 0);
            if (colorMap != undefined && colorMap[j][i] != undefined)
                this._context.fillStyle = colorMap[j][i];
            this._context.fill();
            this._context.closePath();
        }
    }
    this._context.globalAlpha = 1;
    this._context.fillStyle = originalStyle;
    this._needsUpdate = false;
}

//
//  pacakge the drawn bitmap sparsely into an array
//
FORTE.GridCanvas.prototype.package = function () {
    var points = [];
    for (var j = 0; j < this._gridHeight; j++) {
        for (var i = 0; i < this._gridWidth; i++) {
            if (this._bitmap[j][i] > FORTE.THRESDENSITY) {
                points.push([i, j]);
            }
        }
    }
    return points;
}

//
//  load svg from file path
//
FORTE.GridCanvas.prototype.loadSVG = function (path) {
    var img = new Image;
    img.onload = function () {
        this._context.drawImage(img, 0, 0);
        var imgData = this._context.getImageData(0, 0, this._canvas[0].width, this._canvas[0].height);
        for (var idx = 0; idx < imgData.data.length; idx += 4) {
            if (imgData.data[idx + 3] > 0) {
                var x = (idx / 4) % this._canvas[0].width;
                var y = (idx / 4 - x) / this._canvas[0].width;
                var i = (x / this._cellSize) | 0;
                var j = (y / this._cellSize) | 0;
                this._bitmap[j][i] = 1;
            }
        }
        this._srcPath = path;
    }.bind(this);
    img.src = path;
}

//
//  convert bitmap data to an image displayed on the web page for downloading
//
FORTE.GridCanvas.prototype.showImage = function () {
    if (FORTE.toShowStress) {
        this.updateHeatmap(FORTE.yieldStress / FORTE.safety);
        this.forceRedraw(this._heatmap);
    } else {
        this.forceRedraw(undefined, 0.1);
    }
    var imgURL = this._canvas[0].toDataURL('image/png');
    $('#imgToSave').attr('src', imgURL);
}

//
//  update a canvas' heatmap based on udpated maximum stress across a set of designs
//
FORTE.GridCanvas.prototype.updateHeatmap = function (maxStress, map) {
    if (this._stressInfo == undefined) return;

    var defaultColor = XAC.getHeatmapColor(0, maxStress);
    this._heatmap = XAC.initMDArray([this._gridHeight, this._gridWidth], defaultColor);
    for (var j = 0; j < this._stressInfo.height; j++) {
        for (var i = 0; i < this._stressInfo.width; i++) {
            if (this._stressInfo.stresses[j] == undefined) return;
            var stress = FORTE.mapToUnits(this._stressInfo.stresses[j][i]);
            this._heatmap[j + this._stressInfo.y0][i + this._stressInfo.x0] =
                XAC.getHeatmapColor(stress, maxStress);
        }
    }
    return this._heatmap;
}