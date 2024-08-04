

const form = document.getElementById("fileUploadForm");
const fileInput = document.getElementById("fileUpload");

const viridisImage = document.getElementById("viridis");

const colorTransfer = new Uint8ClampedArray(255*3);

function generateTransferTable(){
	const colorCanvas = document.createElement("canvas");
	colorCanvas.height = viridisImage.height;
	colorCanvas.width = viridisImage.width;
	const colorContext = colorCanvas.getContext("2d");
	colorContext.drawImage(viridisImage, 0, 0);
	const colorData = colorContext.getImageData(0, 0, viridisImage.width, viridisImage.height).data;

	for(let i = 0; i < 256; i++){
		colorTransfer[i*3  ] = colorData[i*4  ];
		colorTransfer[i*3+1] = colorData[i*4+1];
		colorTransfer[i*3+2] = colorData[i*4+2];
	}
}

viridisImage.onload = generateTransferTable;
viridisImage.src = "./viridis.png";

let loadedString;
let currentHeightmap;

document.getElementById("generateStlButton").onclick = function(){
	
	const startX = document.getElementById("setting-startX").value*1;
	const startY = document.getElementById("setting-startY").value*1;
	const width = document.getElementById("setting-width").value*1;
	const height = document.getElementById("setting-height").value*1;
	const step = document.getElementById("setting-step").value*1;
	const scale = document.getElementById("setting-scale").value*1;
	
	console.log(step, startX, startY, width, height);
	
	heightmap = generateHeightmapFromString(loadedString, step, startX, startY, width, height);
	generateStl(heightmap, scale);
};

fileInput.onchange = function(e){
	e.preventDefault();
	
	const loadingStatus = document.getElementById("loadingStatus");
	const loadingContent = document.getElementById("loadingContent");
	const loadingBar = document.getElementById("loadingBar");
	
	loadingStatus.className = "";
	loadingBar.style.width = "0%";
	loadingStatus.style.display = "block";
	loadingContent.innerHTML = "Loading...<br>";

	/*var imagePercentage = document.createElement("span");
	imagePercentage.innerHTML = "0";
	loadingContent.appendChild(imagePercentage);*/
	
	const file = fileInput.files[0];
	
	const reader = new FileReader();
	
	reader.addEventListener("progress", function(e){
		let progress = ~~((e.loaded/e.total)*60);
		
		loadingBar.style.width = progress+"%";
	});
	
	reader.onload = function(){
		
		loadingContent.innerHTML += "<br>File uploaded, processing...";
		loadingBar.style.width = "60%";
		
		loadedString = reader.result;
		
		heightmap = generateHeightmapFromString(loadedString, 4, 0, 0);
		//heightmap = generateHeightmapFromString(loadedString, 1, 0, 0, 100, 100);
		
		document.getElementById("fileInfo").style.display = "block";
		
		document.getElementById("info-rows").innerHTML = heightmap.rows*heightmap.step;
		document.getElementById("info-cols").innerHTML = heightmap.cols*heightmap.step;
		document.getElementById("info-cellSize").innerHTML = heightmap.cellSize/heightmap.step;
		document.getElementById("info-xCorner").innerHTML = heightmap.xCorner;
		document.getElementById("info-yCorner").innerHTML = heightmap.yCorner;
		document.getElementById("info-nodataValue").innerHTML = heightmap.nodataValue;
		document.getElementById("info-min").innerHTML = Math.round(heightmap.min*100)/100;
		document.getElementById("info-max").innerHTML = Math.round(heightmap.max*100)/100;
		document.getElementById("info-spread").innerHTML = Math.round(heightmap.spread*100)/100;
		
		document.getElementById("stlControls").style.display = "block";
		
		loadingContent.innerHTML += "<br>Rendering...";
		loadingBar.style.width = "95%";
		
		currentHeightmap = heightmap;
		
		updateSelectionCanvas();
		
		setTimeout(function(){renderHeightmap(heightmap);}, 100);
	}
	
	setTimeout(function(){reader.readAsText(file);}, 100);

}

function generateHeightmapFromString(string, step, startX, startY, width, height){
	
	const lines = string.split('\n');
	
	let rows = 0;
	let cols = 0;
	let xCorner = 0;
	let yCorner = 0;
	let cellSize = 0;
	let nodataValue = 0;
	
	let params = {};
	for(let i = 0; i < 6; i++){
		let line = lines[i].replace('\r', "").split(" ");
		params[line[0]] = line[1]*1;
	}
	
	rows = params["nrows"];
	cols = params["ncols"];
	xCorner = params["xllcorner"];
	yCorner = params["yllcorner"];
	cellSize = params["cellsize"];
	nodataValue = params["nodata_value"];
	
	const outputRows = width ? Math.ceil((width/cellSize)/step) : Math.ceil(rows/step);
	const outputCols = height ? Math.ceil((height/cellSize)/step) : Math.ceil(cols/step);
	
	let heightmapData = new Float32Array(outputRows*outputCols);
	
	const dataLines = lines.slice(7);
	
	startX = ~~(startX/cellSize);
	startY = ~~(startY/cellSize);
	
	const endY = width ? startY+(width/cellSize) : dataLines.length;
	
	//console.log("Y ", startY, endY);
	
	for(let y = startY; y < endY; y += step){
		const row = dataLines[y].replace('\r', "").split(" ");
		const endX = height ? startX+(height/cellSize) : row.length;
		for(let x = startX; x < endX; x += step){
			heightmapData[~~((outputRows-(y-startY)/step-1))*outputCols+~~((x-startX)/step)] = row[x];
			/*if(width){
				console.log(~~((outputRows-(y-startY)/step-1))*outputCols, ~~((x-startX)/step));
			}*/
		}
	}
	
	let min = Infinity;
	let max = -Infinity;
	
	for(let i in heightmapData){
		if(heightmapData[i] != nodataValue){
			min = Math.min(min, heightmapData[i]);
			max = Math.max(max, heightmapData[i]);
		}
	}
	
	const spread = max-min;
	
	const heightmap = {
		 rows: outputRows
		,cols: outputCols
		,cellSize: cellSize*step
		,xCorner: xCorner
		,yCorner: yCorner
		,nodataValue: nodataValue
		,min: min
		,max: max
		,spread: spread
		,step: step
		,data: heightmapData
	}
	
	return heightmap;
}

function renderHeightmap(heightmap){
	
	const canvas = document.getElementById("heightmapCanvas");
	const context = canvas.getContext("2d");
	
	canvas.width = heightmap.cols;
	canvas.height = heightmap.rows;
	
	//let imageData = context.getImageData(0, 0, width, height);
	
	let newImageData = context.createImageData(canvas.width, canvas.height)//new Uint8ClampedArray(4*canvas.width*canvas.height);
	
	for(var i in heightmap.data){
		//let x = i%heightmap.cols;
		//let y = ~~(i/heightmap.cols);
		
		let value = ~~(((heightmap.data[i]-heightmap.min)/heightmap.spread)*256);
		
		let hillShade = heightmap.data[i] - (heightmap.data[i-heightmap.cols]+heightmap.data[i-heightmap.cols-1])/2;
		hillShade = hillShade * 2;
		
		
		newImageData.data[i*4+0] = colorTransfer[value*3+0]+hillShade;
		newImageData.data[i*4+1] = colorTransfer[value*3+1]+hillShade;
		newImageData.data[i*4+2] = colorTransfer[value*3+2]+hillShade;
		newImageData.data[i*4+3] = 255;
		
		if(heightmap.data[i] == heightmap.nodataValue){
			newImageData.data[i*4+0] = 255;
			newImageData.data[i*4+1] = 0;
			newImageData.data[i*4+2] = 0;
			newImageData.data[i*4+3] = 255;
		}
	}
	
	
	context.putImageData(newImageData, 0, 0);
	
	loadingBar.style.width = "100%";
	loadingContent.innerHTML += "<br>Ready!";
	loadingStatus.className = "fading";

	setTimeout(function(){
		loadingStatus.style.display = "none";
	}, 500);
}

function generateStl(heightmap, scale){
	const numTriangles = (heightmap.cols-1)*(heightmap.rows-1)*2;
	const sizeBytes = 84+(numTriangles*50);
	
	//const scale = 1/1000;
	
	const buffer = new ArrayBuffer(sizeBytes);
	const view = new DataView(buffer);
	
	for(let i = 0; i < 80; i++){
		view.setUint8(i, 0);
	}
	view.setUint32(80, numTriangles, true);
	
	let text = "Terrain data wooo";
	let utf8Encode = new TextEncoder();
	let textArray = utf8Encode.encode(text);
	for(let i in textArray){
		view.setUint8(i, textArray[i]);
	}
	
	let byteOffset = 84;
	
	for(let y = 0; y < heightmap.rows-1; y++){
		for(let x = 0; x < heightmap.cols-1; x++){
			
			//console.log(sizeBytes, byteOffset);
			
			/*
			 
			A------B
			|     /|
			|    / |
			|   /  |
			|  /   |
			| /    |
			|/     |
			C------D
			
			*/
			
			/*
			    C-B-A
			*/
			
			// Normal vector
			view.setFloat32(byteOffset+0, 0);
			view.setFloat32(byteOffset+4, 0);
			view.setFloat32(byteOffset+8, 0);
			byteOffset += 12;
			// Point C
			view.setFloat32(byteOffset+0, x*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+4, y*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+8, heightmap.data[y*heightmap.cols+x]*scale, true);
			byteOffset += 12;
			// Point B
			view.setFloat32(byteOffset+0, (x+1)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+4, (y+1)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+8, heightmap.data[(y+1)*heightmap.cols+(x+1)]*scale, true);
			byteOffset += 12;
			// Point A
			view.setFloat32(byteOffset+0, (x+0)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+4, (y+1)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+8, heightmap.data[(y+1)*heightmap.cols+(x+0)]*scale, true);
			byteOffset += 12;
			// Attribute byte count (always 0)
			view.setUint16(byteOffset, 0);
			byteOffset += 2;
			
			/*
			    C-D-B
			*/
			
			// Normal vector
			view.setFloat32(byteOffset+0, 0);
			view.setFloat32(byteOffset+4, 0);
			view.setFloat32(byteOffset+8, 0);
			byteOffset += 12;
			// Point C
			view.setFloat32(byteOffset+0, x*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+4, y*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+8, heightmap.data[y*heightmap.cols+x]*scale, true);
			byteOffset += 12;
			// Point B
			view.setFloat32(byteOffset+0, (x+1)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+4, (y+1)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+8, heightmap.data[(y+1)*heightmap.cols+(x+1)]*scale, true);
			byteOffset += 12;
			// Point A
			view.setFloat32(byteOffset+0, (x+1)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+4, (y+0)*heightmap.cellSize*scale, true);
			view.setFloat32(byteOffset+8, heightmap.data[(y+0)*heightmap.cols+(x+1)]*scale, true);
			byteOffset += 12;
			// Attribute byte count (always 0)
			view.setUint16(byteOffset, 0);
			byteOffset += 2;
			
			

			//console.log(byteOffset, x*heightmap.cellSize*scale, y*heightmap.cellSize*scale, heightmapData[y*heightmap.cols+x]*scale);
		}
	}
	
	//console.log(view);
	//console.log(view.buffer);
	
	var blob = new Blob([view.buffer], {type: "model/stl"});
    var objectUrl = URL.createObjectURL(blob);
	
	const downloadLink = document.getElementById("downloadLink");
	downloadLink.href = objectUrl;
	downloadLink.style.display = "block";
	
}

function updateSelectionCanvas(){
	if(currentHeightmap){
		const startX = document.getElementById("setting-startX").value*1;
		const startY = document.getElementById("setting-startY").value*1;
		const width = document.getElementById("setting-width").value*1;
		const height = document.getElementById("setting-height").value*1;
		const step = document.getElementById("setting-step").value*1;
		const scale = document.getElementById("setting-scale").value*1;
		
		const canvas = document.getElementById("selectionCanvas");
		const context = canvas.getContext("2d");
		
		canvas.width = currentHeightmap.cols;
		canvas.height = currentHeightmap.rows;
		
		context.strokeStyle = "rgba(255, 0, 100, 1.0)";
		context.fillStyle = "rgba(255, 0, 100, 0.2)";
		context.lineWidth = 2;
		context.beginPath();
		context.rect(
			~~((startX/currentHeightmap.step)/(currentHeightmap.cellSize/currentHeightmap.step))+0.5,
			~~((startY/currentHeightmap.step)/(currentHeightmap.cellSize/currentHeightmap.step))+0.5,
			~~((width/currentHeightmap.step)/(currentHeightmap.cellSize/currentHeightmap.step)),
			~~((height/currentHeightmap.step)/(currentHeightmap.cellSize/currentHeightmap.step))
		);
		context.fill();
		context.stroke();
	}
}

document.getElementById("setting-startX").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-startY").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-width").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-height").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-step").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-scale").addEventListener("input", updateSelectionCanvas);
































