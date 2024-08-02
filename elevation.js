

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
	
	reader.onload = function(){
		
		loadingContent.innerHTML += "<br>File uploaded, processing...";
		loadingBar.style.width = "40%";
		
		const text = reader.result;
		const lines = text.split('\n');
		
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
		
		loadingContent.innerHTML += "<br>Lines of text: "+lines.length;
		loadingBar.style.width = "45%";
		
		const skip = 4;
		const previewRows = Math.ceil(rows/skip);
		const previewCols = Math.ceil(cols/skip);
		
		let heightmapData = new Float32Array(previewRows*previewCols);
		
		const dataLines = lines.slice(7);
		
		for(let y = 0; y < dataLines.length; y += skip){
			const row = dataLines[y].replace('\r', "").split(" ");
			for(let x = 0; x < row.length; x += skip){
				heightmapData[~~((rows-y-1)/skip)*previewCols+~~(x/skip)] = row[x];
			}
		}
		
		loadingContent.innerHTML += "<br>Loaded preview array";
		loadingBar.style.width = "70%";
		
		let min = Infinity;
		let max = -Infinity;
		
		for(let i in heightmapData){
			if(heightmapData[i] != nodataValue){
				min = Math.min(min, heightmapData[i]);
				max = Math.max(max, heightmapData[i]);
			}
		}
		
		const spread = max-min;
		
		loadingContent.innerHTML += "<br>Calculated maximums";
		loadingBar.style.width = "80%";
		
		console.log("min: "+min+", max: "+max+", spread: "+spread);
		
		const heightmap = {
			 rows: previewRows
			,cols: previewCols
			,cellSize: cellSize*skip
			,xCorner: xCorner
			,yCorner: yCorner
			,nodataValue: nodataValue
			,min: min
			,max: max
			,spread: spread
			,data: heightmapData
		}
		
		document.getElementById("fileInfo").style.display = "block";
		
		document.getElementById("info-rows").innerHTML = rows;
		document.getElementById("info-cols").innerHTML = cols;
		document.getElementById("info-cellSize").innerHTML = cellSize;
		document.getElementById("info-xCorner").innerHTML = xCorner;
		document.getElementById("info-yCorner").innerHTML = yCorner;
		document.getElementById("info-nodataValue").innerHTML = nodataValue;
		document.getElementById("info-min").innerHTML = Math.round(heightmap.min*100)/100;
		document.getElementById("info-max").innerHTML = Math.round(heightmap.max*100)/100;
		document.getElementById("info-spread").innerHTML = Math.round(heightmap.spread*100)/100;
		
		document.getElementById("stlControls").style.display = "block";
		document.getElementById("stlControls").onclick = function(){generateStl(heightmap)};
		
		loadingContent.innerHTML += "<br>Rendering...";
		loadingBar.style.width = "95%";
		renderHeightmap(heightmap);
	}
	
	reader.readAsText(file);

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
	
	console.log(newImageData);
	
	context.putImageData(newImageData, 0, 0);
	
	console.log(heightmap);
	
	loadingBar.style.width = "100%";
	loadingContent.innerHTML += "<br>Ready!";
	loadingStatus.className = "fading";

	setTimeout(function(){
		loadingStatus.style.display = "none";
	}, 500);
}

function generateStl(heightmap){
	const numTriangles = (heightmap.cols-1)*(heightmap.rows-1)*2;
	const sizeBytes = 84+(numTriangles*50);
	
	const scale = 1/1000;
	
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
	
	console.log(view);
	console.log(view.buffer);
	
	var blob = new Blob([view.buffer], {type: "model/stl"});
    var objectUrl = URL.createObjectURL(blob);
	
	const downloadLink = document.getElementById("downloadLink");
	downloadLink.href = objectUrl;
	downloadLink.style.display = "block";
	
}



































