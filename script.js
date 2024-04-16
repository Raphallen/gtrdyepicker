const magnifier = document.getElementById('magnifier');
const magnifierCanvas = document.createElement('canvas');
const magnifierCtx = magnifierCanvas.getContext('2d');
magnifier.appendChild(magnifierCanvas);

let magnifierVisible = false;
const colorPalette = document.getElementById('colorPalette');

document.getElementById('imageInput').addEventListener('change', handleImage);

function handleImage(event) {
    const file = event.target.files[0];
    if (file) {
        loadImage(file);
    }
}

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            setupCanvas(img);
        };
        img.src = e.target.result;
    };
    reader.onerror = function () {
        console.error('Error loading image.');
    };
    reader.readAsDataURL(file);
}

function setupCanvas(img) {
    const canvas = document.getElementById('colorCanvas');
    const ctx = canvas.getContext('2d');

    const maxWidth = window.innerWidth * 0.6;
    const maxHeight = window.innerHeight * 0.6;

    let scaleFactor = 1;
    if (img.width > maxWidth || img.height > maxHeight) {
        scaleFactor = Math.min(maxWidth / img.width, maxHeight / img.height);
    }

    const scaledWidth = img.width * scaleFactor;
    const scaledHeight = img.height * scaleFactor;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

    initializeMagnifier(img);
}

function initializeMagnifier(img) {
    const canvas = document.getElementById('colorCanvas');
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', hideMagnifier);

    magnifierCanvas.width = 70;
    magnifierCanvas.height = 70;

    document.addEventListener('mousemove', event => {
        if (magnifierVisible) {
            showMagnifier(event.clientX, event.clientY, img);
        }
    });

    canvas.addEventListener('click', handleCanvasClick);
}

function handleCanvasMouseMove(event) {
    const canvas = document.getElementById('colorCanvas');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const imageData = ctx.getImageData(x, y, 1, 1).data;
    showMagnifier(event.clientX, event.clientY, imageData);
}

function showMagnifier(mouseX, mouseY, imageData) {
    const magnifierSize = 70;
    const magnifierRadius = magnifierSize / 2;
    const magnifierPixelSize = 6;

    magnifier.style.left = (mouseX + 20) + 'px';
    magnifier.style.top = (mouseY + 20) + 'px';
    magnifier.style.display = 'block';

    magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
    magnifierCtx.fillStyle = `rgba(${imageData[0]}, ${imageData[1]}, ${imageData[2]}, 1)`;
    magnifierCtx.fillRect(0, 0, magnifierSize, magnifierSize);

    magnifierCtx.strokeStyle = 'black';
    magnifierCtx.lineWidth = 1;
    magnifierCtx.beginPath();
    magnifierCtx.arc(magnifierRadius, magnifierRadius, magnifierRadius - 1, 0, 2 * Math.PI);
    magnifierCtx.stroke();
}

function hideMagnifier() {
    magnifier.style.display = 'none';
    magnifierVisible = false;
}

function handleCanvasClick(event) {
    const canvas = document.getElementById('colorCanvas');
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const imageData = ctx.getImageData(x, y, 1, 1).data;
    const r = imageData[0] / 255;
    const g = imageData[1] / 255;
    const b = imageData[2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    let saturation = 0;
    let value = max;

    if (delta !== 0) {
        saturation = delta / max;

        if (max === r) {
            hue = ((g - b) / delta) % 6;
        } else if (max === g) {
            hue = ((b - r) / delta) + 2;
        } else {
            hue = ((r - g) / delta) + 4;
        }

        hue = Math.round(hue * 60);
        if (hue < 0) {
            hue += 360;
        }
    }

    let color = Math.round(hue / 360 * 512);
    let intensity = Math.round(saturation * 512);
    let brightness = Math.round(value * 512);

    if (color > 512) {
        color = Math.min(color, 999);
    }
    if (intensity > 512) {
        intensity = Math.min(intensity, 999);
    }
    if (brightness > 512) {
        brightness = Math.min(brightness, 999);
    }

    updateColorValues(color, intensity, brightness);
}

function updateColorValues(color, intensity, brightness) {
    document.getElementById('colorResult').value = color;
    document.getElementById('intensityResult').value = intensity;
    document.getElementById('brightnessResult').value = brightness;
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s * 100, l * 100];
}

function addToPalette(color) {
    const colorBox = document.createElement('div');
    colorBox.classList.add('colorBox');
    colorBox.style.backgroundColor = `hsl(${color[0]}, ${color[1]}%, ${color[2]}%)`;
    colorBox.title = `H: ${Math.round(color[0])}, S: ${Math.round(color[1])}%, L: ${Math.round(color[2])}%`;
    colorBox.addEventListener('click', () => selectColor(color));

    const colorPalette = document.getElementById('colorPalette'); // Get the color palette element
    colorPalette.appendChild(colorBox); // Append the color box to the palette
}

function selectColor(color) {
    document.getElementById('colorResult').value = Math.round(color[0] * 512 / 360);
    document.getElementById('intensityResult').value = Math.round(color[1] * 512 / 100);
    document.getElementById('brightnessResult').value = Math.round(color[2] * 512 / 100);
}
