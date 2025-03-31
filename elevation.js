

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
let filename = "output";

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
	
	filename = file.name.substring(0, file.name.length-4); // this assumes the name ends in .xyz or .asc
	
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
		document.getElementById("info-height").innerHTML = heightmap.rows*heightmap.cellSize + " m";
		document.getElementById("info-width").innerHTML = heightmap.cols*heightmap.cellSize + " m";
		document.getElementById("info-cellSize").innerHTML = heightmap.cellSize/heightmap.step + " m";
		document.getElementById("info-xCorner").innerHTML = heightmap.xCorner;
		document.getElementById("info-yCorner").innerHTML = heightmap.yCorner;
		document.getElementById("info-nodataValue").innerHTML = heightmap.nodataValue;
		document.getElementById("info-min").innerHTML = Math.round(heightmap.min*100)/100 + " m";
		document.getElementById("info-max").innerHTML = Math.round(heightmap.max*100)/100 + " m";
		document.getElementById("info-spread").innerHTML = Math.round(heightmap.spread*100)/100 + " m";
		
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
	
	lines[0] = lines[0].toLowerCase().trim().replace(/\s+/, " ").replace('\r', "");
	
	console.log(lines[0]);
	
	if(lines[0] == "x y z"){
		console.log("XYZ detected");
		return generateHeightmapFromXYZ(lines, step, startX, startY, width, height);
	} else {
		return generateHeightmapFromASC(lines, step, startX, startY, width, height);
	}
}

function generateHeightmapFromXYZ(lines, step, startX, startY, width, height){
	
	let rows = 0;
	let cols = 0;
	let xCorner = 0;
	let yCorner = 0;
	let cellSize = 0;
	let nodataValue = 0;
	
	let xData = new Float32Array(lines.length-2);
	let yData = new Float32Array(lines.length-2);
	let zData = new Float32Array(lines.length-2);
	
	for(let i = 0; i < lines.length-1; i++){
		let line = lines[i+1].replace('\r', "").split(" ");
		xData[i] = parseFloat(line[0]);
		yData[i] = parseFloat(line[1]);
		zData[i] = parseFloat(line[2]);
		
		if(xData[i] == 0){
				console.log("x is 0 at "+i);
		}
		if(yData[i] == 0){
				console.log("y is 0 at "+i);
		}
	}
	
	xCorner = xData.reduce((a, b) => Math.min(a, b), Infinity);
	yCorner = yData.reduce((a, b) => Math.min(a, b), Infinity);
	cellSize = xData[2] - xData[1]; //assuming a regular grid with square cells
	rows = (xData.reduce((a, b) => Math.max(a, b), -Infinity)-xCorner)/cellSize;
	cols = (yData.reduce((a, b) => Math.max(a, b), -Infinity)-yCorner)/cellSize;
	
	console.log(xCorner, yCorner, cellSize, rows, cols);
	
	let dataLines = [];
	for(let i = 0; i <= rows; i++){
		dataLines[i] = [];
	}
	
	
	let x = 0;
	let y = 0;
	let z = 0;
	for(let i = 0; i < xData.length; i++){ // this is the easy, but slow way, I might do it better if I can be bothered at some point
		x = xData[i];
		y = yData[i];
		z = zData[i];
		x = (x-xCorner)/cellSize;
		y = (y-yCorner)/cellSize;
		dataLines[y][x] = z;
	}
	
	const outputRows = width ? Math.ceil((width/cellSize)/step) : Math.ceil(rows/step);
	const outputCols = height ? Math.ceil((height/cellSize)/step) : Math.ceil(cols/step);
	
	let heightmapData = new Float32Array(outputRows*outputCols);
	
	startX = ~~(startX/cellSize);
	startY = ~~(startY/cellSize);
	
	const endY = width ? startY+(width/cellSize) : dataLines.length;
	
	//console.log("Y ", startY, endY);
	
	for(let y = startY; y < endY; y += step){
		const row = dataLines[y];
		const endX = height ? startX+(height/cellSize) : row.length;
		for(let x = startX; x < endX; x += step){
			heightmapData[~~(((y-startY)/step-1)+1)*outputCols+~~((x-startX)/step)] = row[x];
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

function generateHeightmapFromASC(lines, step, startX, startY, width, height){
	let rows = 0;
	let cols = 0;
	let xCorner = 0;
	let yCorner = 0;
	let cellSize = 0;
	let nodataValue = 0;
	
	let params = {};
	for(let i = 0; i < 6; i++){
		let line = lines[i].toLowerCase().trim().replace(/\s+/, " ").replace('\r', "").split(" ");
		console.log(line);
		params[line[0].toLowerCase()] = line[1]*1;
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
		if(dataLines[y]){
			const row = dataLines[y].trim().replace(/\s+/, " ").replace('\r', "").split(" ");
			const endX = height ? startX+(height/cellSize) : row.length;
			for(let x = startX; x < endX; x += step){
				if(row[x]){
					heightmapData[~~((outputRows-(y-startY)/step-1))*outputCols+~~((x-startX)/step)] = row[x];
				} else {
					console.warn("No data at y="+y+", x="+x);
				}
			}
		} else {
			console.warn("No datalines at y="+y);
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
	
	console.log("byteOffset: "+byteOffset);
	console.log("calculated: "+numTriangles+" Triangles, "+sizeBytes);
	
	//console.log(view);
	//console.log(view.buffer);
	
	var blob = new Blob([view.buffer], {type: "model/stl"});
    var objectUrl = URL.createObjectURL(blob);
	
	const downloadLink = document.getElementById("downloadLink");
	downloadLink.href = objectUrl;
	downloadLink.download = filename + ".stl";
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
		
		// Update info
		
		const infoElement = document.getElementById("stlInfo");
		
		const rows = Math.ceil((width/(currentHeightmap.cellSize/currentHeightmap.step))/step);
		const cols = Math.ceil((height/(currentHeightmap.cellSize/currentHeightmap.step))/step);
		const numTriangles = (cols-1)*(rows-1)*2;
		const sizeBytes = 84+(numTriangles*50);
		
		console.log("display: "+sizeBytes);
		
		const k = 1024;
		const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
		const decimal = 0;
		const i = Math.floor(Math.log(sizeBytes) / Math.log(k));
		const fileSize = parseFloat((sizeBytes / Math.pow(k, i)).toFixed(decimal))+" "+sizes[i];
		
		infoElement.innerHTML = numTriangles+" Triangles, "+fileSize;
	}
}

document.getElementById("setting-startX").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-startY").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-width").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-height").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-step").addEventListener("input", updateSelectionCanvas);
document.getElementById("setting-scale").addEventListener("input", updateSelectionCanvas);
































