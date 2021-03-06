// ......................................................................................................
//
//  a class of forte design, primarily data/parameters for topology optimization 
//  
//  by xiangchen@acm.org, v1.0. 10/2017
//
// ......................................................................................................

FORTE.Design = function (width, height) {
    this.width = width;
    this.height = height;
    this.designPoints = [];
    this.loadPoints = [];
    this.loadValues = [];
    this.boundaryPoints = [];

    this.maxStress = 0;
};

FORTE.Design.prototype = {
    constructor: FORTE.Design
}

//
//  extrapolate (or interpolate) based on the most recent two updated bitmaps
//  (treating the most recent one as in the far future and extrapolate to it)
//  -   step: parameter to control the extrapolation
//
FORTE.Design.prototype.extrapolateBitmaps = function (step) {
    if (this.bitmaps.length < 2) return;
    var bmp0 = this.bitmaps.lastBut(1);
    var bmp1 = this.bitmaps.pop();

    if (bmp0.length > 0 && bmp1.length > 0) {
        var height = bmp1.length;
        var width = bmp1[0].length;
        var bmp = XAC.initMDArray([height, width], 0);
        for (var j = 0; j < height; j++) {
            // handling exception
            if (bmp0[j] == undefined || bmp1[j] == undefined ||
                bmp0[j].length <= 0 || bmp1[j].length <= 0) {
                // this.bitmaps.push(bmp1);
                this.bitmaps.push(bmp1);
                return;
            }
            for (var i = 0; i < width; i++) {
                bmp[j][i] = bmp0[j][i] * step + bmp1[j][i] * (1 - step);
            }
        }
        this.bitmaps.push(bmp);
    }
    this.bitmaps.push(bmp1);
}

//
//  get data for running matlab optimization
//
FORTE.Design.prototype.getData = function () {
    if (this.loadPoints.length <= 0 || this.boundaryPoints.length <= 0) return;

    // find bounding box
    var bbox = {
        xmin: this.width,
        xmax: 0,
        ymin: this.height,
        ymax: 0
    };

    // update a bounding box to include a point
    var __updateBbox = function (p, bbox) {
        bbox.xmin = Math.min(p[0], bbox.xmin);
        bbox.xmax = Math.max(p[0], bbox.xmax);
        bbox.ymin = Math.min(p[1], bbox.ymin);
        bbox.ymax = Math.max(p[1], bbox.ymax);
    }

    // clip a point to be inside a bounding box, given an origin (x0, y0)
    var __updatePoint = function (p, bbox, x0, y0) {
        p[0] -= bbox.xmin;
        p[0] = x0 + Math.min(Math.max(0, p[0]), bbox.xmax - bbox.xmin - 1);
        p[1] -= bbox.ymin;
        p[1] = y0 + Math.min(Math.max(0, p[1]), bbox.ymax - bbox.ymin - 1);
        return p;
    }

    for (p of this.designPoints) __updateBbox(p, bbox);
    for (lps of this.loadPoints)
        for (p of lps) __updateBbox(p, bbox);
    for (p of this.boundaryPoints) __updateBbox(p, bbox);

    // add margin to avoid effects on the edges
    var margin = ((this.width + this.height) * 0.025) | 0;
    var xminNew = Math.max(bbox.xmin - margin, 0);
    var xmaxNew = Math.min(bbox.xmax + margin, this.width);
    var yminNew = Math.max(bbox.ymin - margin, 0);
    var ymaxNew = Math.min(bbox.ymax + margin, this.height);

    this._margin = margin;

    var leftMargin = bbox.xmin - xminNew;
    var topMargin = bbox.ymin - yminNew;

    var width = xmaxNew - xminNew;
    var height = ymaxNew - yminNew;

    //  packaging all points (sketch, load, boundary, etc.)
    var designPoints = [];
    for (p of this.designPoints) designPoints.push(__updatePoint(p.clone(), bbox, leftMargin, topMargin));
    var emptyPoints = [];
    for (p of this.emptyPoints) emptyPoints.push(__updatePoint(p.clone(), bbox, leftMargin, topMargin));
    var loadPoints = [];
    for (lps of this.loadPoints)
        for (p of lps) loadPoints.push(__updatePoint(p.clone(), bbox, leftMargin, topMargin));
    var loadValues = [];
    for (lvs of this.loadValues)
        for (v of lvs) loadValues.push(v);
    var boundaryPoints = [];
    for (p of this.boundaryPoints) boundaryPoints.push(__updatePoint(p.clone(), bbox, leftMargin, topMargin));

    //  [one time only] points to add to the design
    var favPoints = [];
    if (this.favPoints != undefined) {
        for (p of this.favPoints) favPoints.push(__updatePoint(p.clone(), bbox, leftMargin, topMargin));
        this.favPoints = [];
    }

    //  [one time only] points to slim the design
    var slimPoints = [];
    if (this.slimPoints != undefined) {
        for (p of this.slimPoints) slimPoints.push(__updatePoint(p.clone(), bbox, leftMargin, topMargin));
        this.slimPoints = [];
    }

    // [one time only] previous result
    var lastOutputFile = this.lastOutputFile;
    this.lastOutputFile = undefined;

    // [debug] do NOT remove
    // var arr = XAC.initMDArray([height, width], ' ');
    // for (p of designPoints) arr[p[1]][p[0]] = 'O'
    // for (p of emptyPoints) arr[p[1]][p[0]] = 'X'
    // for (p of loadPoints) arr[p[1]][p[0]] = '*';
    // for (p of boundaryPoints) arr[p[1]][p[0]] = '#'
    //     for (p of lessPoints) arr[p[1]][p[0]] = '$'
    // var str = ''
    // for (row of arr)
    //     str += row.toString() + '\n'
    // for(elm of row)
    //     str += elm;
    // str += '\n'
    // log(str)

    this.bbox = bbox;

    return {
        resolution: [width, height],
        design: designPoints,
        emptiness: emptyPoints,
        loadpoints: loadPoints,
        loadvalues: loadValues,
        boundaries: boundaryPoints,
        slimpoints: slimPoints,
        favpoints: favPoints,
        lastoutput: lastOutputFile
    };
}