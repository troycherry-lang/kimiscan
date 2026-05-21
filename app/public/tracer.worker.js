/* OpenCV tracer Web Worker — runs all WASM off the main thread */

// ── Load OpenCV at top-level (synchronous, happens once when worker starts) ───

self.postMessage({ type:'log', msg:'[worker] loading opencv.js' });
importScripts('/opencv.js');
self.postMessage({ type:'log', msg:'[worker] opencv.js loaded, cv type=' + typeof cv });

// ── Wait for WASM to finish compiling ─────────────────────────────────────────

var cvReady = false;
var cvReadyCallbacks = [];

(function pollForWasm() {
  var start = Date.now();
  var poll = setInterval(function() {
    try {
      var m = new cv.Mat(1, 1, 0);
      m.delete();
      clearInterval(poll);
      cvReady = true;
      self.postMessage({ type:'log', msg:'[worker] WASM ready in ' + (Date.now()-start) + 'ms' });
      for (var i = 0; i < cvReadyCallbacks.length; i++) {
        try { cvReadyCallbacks[i](); } catch(e) {}
      }
      cvReadyCallbacks = [];
    } catch (_) {}
    if (Date.now() - start > 30000) {
      clearInterval(poll);
      self.postMessage({ type:'error', message: 'OpenCV WASM timeout' });
    }
  }, 100);
})();

function whenCvReady(fn) {
  if (cvReady) { fn(); return; }
  cvReadyCallbacks.push(fn);
}

// ── ID generator ──────────────────────────────────────────────────────────────

var _idCtr = 0;
function generateId() {
  return 'n' + (++_idCtr) + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Unit conversion ───────────────────────────────────────────────────────────

function pxToMm(px, dpi) { return (px / dpi) * 25.4; }

// ── Contour helpers ───────────────────────────────────────────────────────────

function contourToPoints(contour) {
  var data = contour.data32S;
  var pts = [];
  for (var i = 0; i < data.length; i += 2) pts.push({ x: data[i], y: data[i + 1] });
  return pts;
}

function gaussianSmooth(pts, kernelSize, passes) {
  if (passes <= 0 || pts.length < kernelSize) return pts;
  var half = Math.floor(kernelSize / 2);
  var sigma = half / 3;
  var kernel = [], kSum = 0;
  for (var i = -half; i <= half; i++) {
    var v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v); kSum += v;
  }
  for (var i = 0; i < kernel.length; i++) kernel[i] /= kSum;
  var cur = pts.map(function(p) { return { x: p.x, y: p.y }; });
  for (var p = 0; p < passes; p++) {
    var n = cur.length, out = new Array(n);
    for (var i = 0; i < n; i++) {
      var sx = 0, sy = 0;
      for (var k = 0; k < kernel.length; k++) {
        var idx = (i + k - half + n) % n;
        sx += cur[idx].x * kernel[k]; sy += cur[idx].y * kernel[k];
      }
      out[i] = { x: sx, y: sy };
    }
    cur = out;
  }
  return cur;
}

// ── Bezier fitting ────────────────────────────────────────────────────────────

function b0(t) { var m = 1-t; return m*m*m; }
function b1(t) { var m = 1-t; return 3*t*m*m; }
function b2(t) { var m = 1-t; return 3*t*t*m; }
function b3(t) { return t*t*t; }

function bezierPt(p0, p1, p2, p3, t) {
  return {
    x: b0(t)*p0.x + b1(t)*p1.x + b2(t)*p2.x + b3(t)*p3.x,
    y: b0(t)*p0.y + b1(t)*p1.y + b2(t)*p2.y + b3(t)*p3.y
  };
}

function chordParam(pts) {
  var n = pts.length, u = new Array(n).fill(0);
  for (var i = 1; i < n; i++) {
    var dx = pts[i].x-pts[i-1].x, dy = pts[i].y-pts[i-1].y;
    u[i] = u[i-1] + Math.sqrt(dx*dx + dy*dy);
  }
  var tot = u[n-1];
  if (tot > 1e-10) for (var i = 1; i < n; i++) u[i] /= tot;
  return u;
}

function vecNorm(v) {
  var l = Math.sqrt(v.x*v.x + v.y*v.y);
  return l < 1e-10 ? { x:1, y:0 } : { x:v.x/l, y:v.y/l };
}
function vecNeg(v) { return { x:-v.x, y:-v.y }; }
function lTan(pts) { return vecNorm({ x:pts[1].x-pts[0].x, y:pts[1].y-pts[0].y }); }
function rTan(pts) {
  var n = pts.length;
  return vecNorm({ x:pts[n-2].x-pts[n-1].x, y:pts[n-2].y-pts[n-1].y });
}

function generateBezier(pts, u, t1, t2) {
  var n=pts.length, p0=pts[0], p3=pts[n-1];
  var c00=0, c01=0, c11=0, x0=0, x1=0;
  for (var i=0; i<n; i++) {
    var t=u[i], bt1=b1(t), bt2=b2(t), bt0=b0(t), bt3=b3(t);
    var a0x=bt1*t1.x, a0y=bt1*t1.y, a1x=bt2*t2.x, a1y=bt2*t2.y;
    var rx=pts[i].x-(bt0+bt1)*p0.x-(bt2+bt3)*p3.x;
    var ry=pts[i].y-(bt0+bt1)*p0.y-(bt2+bt3)*p3.y;
    c00+=a0x*a0x+a0y*a0y; c01+=a0x*a1x+a0y*a1y; c11+=a1x*a1x+a1y*a1y;
    x0+=rx*a0x+ry*a0y; x1+=rx*a1x+ry*a1y;
  }
  var det=c00*c11-c01*c01;
  var fb=Math.sqrt((p3.x-p0.x)*(p3.x-p0.x)+(p3.y-p0.y)*(p3.y-p0.y))/3;
  var a1=det<1e-10?fb:(x0*c11-x1*c01)/det;
  var a2=det<1e-10?fb:(c00*x1-c01*x0)/det;
  if (a1<1e-6) a1=fb; if (a2<1e-6) a2=fb;
  return {
    c1: {x:p0.x+a1*t1.x, y:p0.y+a1*t1.y},
    c2: {x:p3.x+a2*t2.x, y:p3.y+a2*t2.y}
  };
}

function maxErr(pts, p0, c1, c2, p3, u) {
  var me=0, mi=Math.floor(pts.length/2);
  for (var i=1; i<pts.length-1; i++) {
    var bp=bezierPt(p0,c1,c2,p3,u[i]);
    var dx=pts[i].x-bp.x, dy=pts[i].y-bp.y, e=dx*dx+dy*dy;
    if (e>me) { me=e; mi=i; }
  }
  return { err:Math.sqrt(me), idx:mi };
}

function fitCubic(pts, t1, t2, tol, depth) {
  if (depth === undefined) depth = 0;
  var n=pts.length;
  if (n<2) return [];
  if (n===2) {
    var d=Math.sqrt((pts[1].x-pts[0].x)*(pts[1].x-pts[0].x)+(pts[1].y-pts[0].y)*(pts[1].y-pts[0].y))/3;
    return [{p0:pts[0], c1:{x:pts[0].x+d*t1.x,y:pts[0].y+d*t1.y}, c2:{x:pts[1].x+d*t2.x,y:pts[1].y+d*t2.y}, p3:pts[1]}];
  }
  var u=chordParam(pts), ref=generateBezier(pts,u,t1,t2);
  var c1=ref.c1, c2=ref.c2;
  var errRef=maxErr(pts,pts[0],c1,c2,pts[n-1],u);
  if (errRef.err<=tol||depth>=10) return [{p0:pts[0],c1:c1,c2:c2,p3:pts[n-1]}];
  var si=Math.max(1,Math.min(n-2,errRef.idx));
  var mt=vecNorm({x:pts[Math.min(si+1,n-1)].x-pts[Math.max(si-1,0)].x, y:pts[Math.min(si+1,n-1)].y-pts[Math.max(si-1,0)].y});
  return fitCubic(pts.slice(0,si+1),t1,vecNeg(mt),tol,depth+1).concat(fitCubic(pts.slice(si),mt,t2,tol,depth+1));
}

function detectCorners(pts, threshold) {
  var n=pts.length, stride=Math.max(3,Math.floor(n/80)), corners=[];
  for (var i=0; i<n; i++) {
    var p=pts[(i-stride+n)%n], c=pts[i], q=pts[(i+stride)%n];
    var v1=vecNorm({x:c.x-p.x,y:c.y-p.y}), v2=vecNorm({x:q.x-c.x,y:q.y-c.y});
    var dot=Math.max(-1,Math.min(1,v1.x*v2.x+v1.y*v2.y));
    if (Math.acos(dot)>threshold) corners.push(i);
  }
  if (corners.length>1) {
    var dd=[corners[0]];
    for (var ci=1; ci<corners.length; ci++) {
      var corner=corners[ci], last=dd[dd.length-1];
      if (Math.min(Math.abs(corner-last),n-Math.abs(corner-last))>stride/2) dd.push(corner);
    }
    return dd;
  }
  return corners;
}

function fitBezierContour(pts, tol, corner) {
  if (pts.length<4) return [];
  var splitPts=detectCorners(pts,corner);
  if (splitPts.length===0) splitPts=[0];
  var n=pts.length, allSegs=[], segIsCorner=[];
  for (var s=0; s<splitPts.length; s++) {
    var start=splitPts[s], end=splitPts[(s+1)%splitPts.length];
    var seg=[];
    for (var count=0; count<=n; count++) {
      var idx=(start+count)%n; seg.push(pts[idx]);
      if (idx===end&&seg.length>1) break;
    }
    if (seg.length<2) continue;
    var segs=fitCubic(seg,lTan(seg),rTan(seg),tol);
    for (var i=0; i<segs.length; i++) { allSegs.push(segs[i]); segIsCorner.push(i===0); }
  }
  if (allSegs.length===0) return [];
  return allSegs.map(function(seg, i) {
    var prev=allSegs[(i-1+allSegs.length)%allSegs.length];
    return {
      id: generateId(),
      x: seg.p0.x, y: seg.p0.y,
      type: segIsCorner[i] ? 'corner' : 'smooth',
      handleIn:  { x:prev.c2.x-seg.p0.x, y:prev.c2.y-seg.p0.y },
      handleOut: { x:seg.c1.x-seg.p0.x,  y:seg.c1.y-seg.p0.y  },
    };
  });
}

function circularityFromNodes(nodes) {
  var n=nodes.length; if (n<3) return 0;
  var area=0, perim=0;
  for (var i=0; i<n; i++) {
    var j=(i+1)%n;
    area+=nodes[i].x*nodes[j].y-nodes[j].x*nodes[i].y;
    perim+=Math.sqrt((nodes[j].x-nodes[i].x)*(nodes[j].x-nodes[i].x)+(nodes[j].y-nodes[i].y)*(nodes[j].y-nodes[i].y));
  }
  area=Math.abs(area)/2;
  return perim===0 ? 0 : (4*Math.PI*area)/(perim*perim);
}

// ── Main trace ────────────────────────────────────────────────────────────────

function doTrace(pixels, width, height, options) {
  var detail = options.detail, smoothingPasses = options.smoothingPasses, dpi = options.dpi;
  self.postMessage({ type:'log', msg:'[worker] doTrace: '+width+'x'+height+', detail='+detail+', dpi='+dpi });

  var paths = [], detectedHoles = [], trash = [];
  var contoursFound = 0, minArea = 0;
  function own(m) { trash.push(m); return m; }

  try {
    var imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
    self.postMessage({ type:'log', msg:'[worker] ImageData created' });

    var src = own(cv.matFromImageData(imageData));
    var gray = own(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    self.postMessage({ type:'log', msg:'[worker] grayscale done' });

    var blurred = own(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    var otsu = own(new cv.Mat());
    cv.threshold(blurred, otsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    self.postMessage({ type:'log', msg:'[worker] threshold done' });

    // No MORPH_CLOSE — bridges the gap between pieces even at small kernel sizes.
    // 3×3 OPEN only, to remove salt noise without affecting piece separation.
    var morphed = own(new cv.Mat());
    var kOpen = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
    cv.morphologyEx(otsu, morphed, cv.MORPH_OPEN, kOpen);
    self.postMessage({ type:'log', msg:'[worker] morph done' });

    var contours = own(new cv.MatVector());
    var hierarchy = own(new cv.Mat());
    // RETR_CCOMP: 2-level hierarchy — level 0 = outer pieces, level 1 = holes inside pieces
    cv.findContours(morphed, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_NONE);
    contoursFound = contours.size();
    self.postMessage({ type:'log', msg:'[worker] found '+contoursFound+' contours (RETR_CCOMP)' });

    var W=morphed.cols, H=morphed.rows;
    minArea = W*H*0.005;
    var tolMm=Math.max(0.05, 1.1-(detail/60)*1.0);
    var tolPx=tolMm*(dpi/25.4);
    // Minimum hole area: ~1mm diameter circle at this DPI
    var pxPerMm = dpi / 25.4;
    var minHoleArea = Math.PI * (pxPerMm * 0.5) * (pxPerMm * 0.5); // 1mm dia
    self.postMessage({ type:'log', msg:'[worker] minArea='+minArea.toFixed(0)+', tolPx='+tolPx.toFixed(2)+', minHoleArea='+minHoleArea.toFixed(0) });

    // hierarchy.data32S layout per contour: [next, prev, firstChild, parent]
    var hierData = hierarchy.data32S;
    var ciToPathId = {};

    for (var ci=0; ci<contours.size(); ci++) {
      var parent = hierData[ci * 4 + 3]; // -1 = outer, >=0 = inner (hole)
      var cnt=contours.get(ci);
      var area=cv.contourArea(cnt);

      if (parent === -1) {
        // ── Outer contour → trace as piece path ──────────────────────────────
        if (area < minArea) { cnt.delete(); continue; }

        var rawPts=contourToPoints(cnt);
        cnt.delete();
        if (rawPts.length<4) continue;

        var preSmoothed=gaussianSmooth(rawPts,5,1);
        var extraPasses=Math.max(0,Math.min(5,Math.round(smoothingPasses)));
        var smoothed=extraPasses>0?gaussianSmooth(preSmoothed,21,extraPasses):preSmoothed;

        var nodes=fitBezierContour(smoothed,tolPx,1.0);
        if (nodes.length<3) continue;

        var pathLen=0, nn=nodes.length;
        for (var i=0; i<nn; i++) {
          var a=nodes[i], b=nodes[(i+1)%nn];
          pathLen+=Math.sqrt((b.x-a.x)*(b.x-a.x)+(b.y-a.y)*(b.y-a.y));
        }

        var newPath = {
          id: generateId(),
          name: 'Piece '+(paths.length+1),
          nodes: nodes,
          closed: true,
          layer: 'cut',
          type: 'outer',
          lengthMm: pxToMm(pathLen,dpi),
          areaMm2: pxToMm(Math.sqrt(area),dpi)*pxToMm(Math.sqrt(area),dpi),
          circularity: circularityFromNodes(nodes),
        };
        ciToPathId[ci] = newPath.id;
        paths.push(newPath);
        self.postMessage({ type:'log', msg:'[worker] piece '+paths.length+': '+nodes.length+' nodes, area='+area.toFixed(0) });

      } else {
        // ── Inner contour → measure as hole ──────────────────────────────────
        if (area < minHoleArea) { cnt.delete(); continue; }

        var rect = cv.boundingRect(cnt);
        var perim = cv.arcLength(cnt, true);
        var circ = perim > 0 ? (4 * Math.PI * area) / (perim * perim) : 0;
        // widthMm = shorter axis (diameter or slot width), heightMm = longer axis
        var shortPx = Math.min(rect.width, rect.height);
        var longPx  = Math.max(rect.width, rect.height);
        var wMm = pxToMm(shortPx, dpi);
        var hMm = pxToMm(longPx, dpi);
        var cx  = rect.x + rect.width  / 2;
        var cy  = rect.y + rect.height / 2;

        detectedHoles.push({
          id: generateId(),
          pathId: ciToPathId[parent] || '',
          x: cx,
          y: cy,
          widthMm: wMm,
          heightMm: hMm,
          circularity: circ,
          aspectRatio: hMm / Math.max(wMm, 0.01),
        });
        cnt.delete();
        self.postMessage({ type:'log', msg:'[worker] hole: '+wMm.toFixed(1)+'×'+hMm.toFixed(1)+'mm circ='+circ.toFixed(2)+' parentCi='+parent });
      }
    }
  } catch(e) {
    self.postMessage({ type:'error', message: '[worker] exception: ' + e.message });
    return;
  } finally {
    for (var i=0; i<trash.length; i++) { try { trash[i].delete(); } catch(_) {} }
  }

  self.postMessage({ type:'log', msg:'[worker] DONE: '+paths.length+' paths' });
  self.postMessage({ type:'result', result: {
    paths: paths,
    detectedHoles: detectedHoles,
    _debug: { contoursFound: contoursFound, pathsProduced: paths.length, minArea: minArea }
  }});
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = function(e) {
  var pixels = e.data.pixels;
  var width = e.data.width;
  var height = e.data.height;
  var options = e.data.options;

  self.postMessage({ type:'log', msg:'[worker] message received, queueing trace' });

  whenCvReady(function() {
    self.postMessage({ type:'log', msg:'[worker] cv is ready, starting trace' });
    try {
      doTrace(pixels, width, height, options);
    } catch(e) {
      self.postMessage({ type:'error', message: e && e.message ? e.message : String(e) });
    }
  });
};
