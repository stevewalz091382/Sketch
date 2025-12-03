document.addEventListener("DOMContentLoaded", function() {
  'use strict';

  /* ------------------ CANVAS SETUP ------------------ */
  var wrap = document.getElementById("sketch-wrapper");
  var imageCanvas = document.getElementById("imageLayer");
  var floatingCanvas = document.getElementById("floatingLayer");
  var gridCanvas = document.getElementById("gridLayer");
  var bufferCanvas = document.getElementById("bufferLayer");
  var drawCanvas = document.getElementById("drawingLayer");

  var imageCtx = imageCanvas.getContext("2d");
  var floatingCtx = floatingCanvas.getContext("2d");
  var gridCtx = gridCanvas.getContext("2d");
  var bufferCtx = bufferCanvas.getContext("2d");
  var drawCtx = drawCanvas.getContext("2d");

  function resize(w,h){
    wrap.style.width = w + "px";
    wrap.style.height = h + "px";
    imageCanvas.width = w;
    imageCanvas.height = h;
    floatingCanvas.width = w;
    floatingCanvas.height = h;
    gridCanvas.width = w;
    gridCanvas.height = h;
    bufferCanvas.width = w;
    bufferCanvas.height = h;
    drawCanvas.width = w;
    drawCanvas.height = h;
  }
  resize(900,600);

  /* ------------------ STATE ------------------ */
  var currentTool = "pencil";
  var currentColor = "#000000";
  var currentThickness = 2;
  var drawing = false;
  var startX = 0;
  var startY = 0;
  var bgImage = null;
  var charcoalOpacity = 0.3;
  var charcoalPath = []; // Store charcoal path points

  var history = [];
  var redoStack = [];

  function saveState(){
    history.push(bufferCanvas.toDataURL());
    redoStack = [];
  }

  function restoreState(){
    bufferCtx.clearRect(0,0,bufferCanvas.width,bufferCanvas.height);
    drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    if(history.length === 0) return;
    var img = new Image();
    img.onload = function() {
      bufferCtx.clearRect(0,0,bufferCanvas.width,bufferCanvas.height);
      bufferCtx.drawImage(img,0,0);
    };
    img.src = history[history.length - 1];
  }

  /* ------------------ FLOATING IMAGES ------------------ */
  var floatingImages = [];
  var selectedFloating = null;

  function addFloatingImage(imgElement){
    var canvasW = floatingCanvas.width;
    var canvasH = floatingCanvas.height;
    var maxDim = Math.min(canvasW, canvasH) * 0.3;
    
    var w = imgElement.width;
    var h = imgElement.height;
    var scale = Math.min(maxDim / w, maxDim / h);
    w *= scale;
    h *= scale;

    floatingImages.push({
      img: imgElement,
      x: canvasW / 2,
      y: canvasH / 2,
      width: w,
      height: h,
      rotation: 0,
      scale: 1
    });
    
    updateFloatingSelect();
    renderFloatingImages();
  }

  function updateFloatingSelect(){
    var select = document.getElementById("floatingSelect");
    select.innerHTML = '<option value="">Select Image...</option>';
    
    for(var i = 0; i < floatingImages.length; i++){
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = "Image " + (i + 1);
      select.appendChild(opt);
    }
    
    if(floatingImages.length > 0){
      select.style.display = "block";
    } else {
      select.style.display = "none";
      document.getElementById("floatingControls").classList.remove("active");
    }
  }

  function renderFloatingImages(){
    floatingCtx.clearRect(0, 0, floatingCanvas.width, floatingCanvas.height);
    
    for(var i = 0; i < floatingImages.length; i++){
      var fi = floatingImages[i];
      floatingCtx.save();
      floatingCtx.translate(fi.x, fi.y);
      floatingCtx.rotate(fi.rotation);
      floatingCtx.scale(fi.scale, fi.scale);
      floatingCtx.drawImage(fi.img, -fi.width/2, -fi.height/2, fi.width, fi.height);
      floatingCtx.restore();

      if(selectedFloating === i){
        var hw = fi.width * fi.scale / 2;
        var hh = fi.height * fi.scale / 2;
        floatingCtx.save();
        floatingCtx.translate(fi.x, fi.y);
        floatingCtx.rotate(fi.rotation);
        floatingCtx.strokeStyle = "#0a84ff";
        floatingCtx.lineWidth = 3;
        floatingCtx.strokeRect(-hw, -hh, hw*2, hh*2);
        floatingCtx.restore();
      }
    }
  }

  /* ------------------ GRID + VP ------------------ */
  var gridMode = "none";
  var vp1 = {x:400,y:300};
  var vp2 = {x:700,y:300};
  var vp3 = {x:500,y:80};
  var draggingVP = null;
  var ox = 0;
  var oy = 0;

  function drawVPs(){
    var existingDots = document.querySelectorAll(".vp-dot");
    for(var i = 0; i < existingDots.length; i++){
      existingDots[i].remove();
    }
    
    var list = [];
    if(gridMode === "1p") list = [vp1];
    if(gridMode === "2p") list = [vp1, vp2];
    if(gridMode === "3p") list = [vp1, vp2, vp3];
    
    for(var i = 0; i < list.length; i++){
      var v = list[i];
      var d = document.createElement("div");
      d.className = "vp-dot";
      d.style.left = (v.x - 6) + "px";
      d.style.top  = (v.y - 6) + "px";
      wrap.appendChild(d);

      (function(vp){
        function startDrag(e) {
          if (e.type.indexOf("touch") === 0) e.preventDefault();
          var clientX = e.clientX || e.touches[0].clientX;
          var clientY = e.clientY || e.touches[0].clientY;
          draggingVP = vp;
          var r = wrap.getBoundingClientRect();
          ox = clientX - (r.left + vp.x);
          oy = clientY - (r.top + vp.y);
          e.stopPropagation();
        }
        d.addEventListener("mousedown", startDrag);
        d.addEventListener("touchstart", startDrag);
      })(v);
    }
  }

  function drawGrid(){
    gridCtx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
    if(gridMode === "none"){ drawVPs(); return; }
    gridCtx.strokeStyle = "#00aaff";
    gridCtx.lineWidth = 1;
    if(gridMode === "1p"){
      for(var i=0;i<360;i+=10){
        var a = i * Math.PI/180;
        gridCtx.beginPath();
        gridCtx.moveTo(vp1.x, vp1.y);
        gridCtx.lineTo(vp1.x + 2000*Math.cos(a), vp1.y + 2000*Math.sin(a));
        gridCtx.stroke();
      }
    }
    drawVPs();
  }

  document.addEventListener("mousemove", function(e){
    if(!draggingVP) return;
    var clientX = e.clientX;
    var clientY = e.clientY;
    var r = wrap.getBoundingClientRect();
    draggingVP.x = clientX - r.left - ox;
    draggingVP.y = clientY - r.top - oy;
    drawGrid();
  });

  document.addEventListener("mouseup", function(){ draggingVP = null; });

  /* ------------------ INIT ------------------ */
  saveState();
  drawGrid();

});
