const magnifier = document.getElementById('magnifier');
const magnifierCanvas = document.createElement('canvas');
const magnifierCtx = magnifierCanvas.getContext('2d');
magnifier.appendChild(magnifierCanvas);

let magnifierVisible = false;

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

    const [r, g, b] = imageData;

    magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
    magnifierCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
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
    const r = imageData[0];
    const g = imageData[1];
    const b = imageData[2];

    updateColorValues(r, g, b);
    addToPalette([r, g, b]);
}

function updateColorValues(r, g, b) {
    const [h, s, l] = rgbToHsl(r, g, b);

    // Update HSL values in the corresponding textboxes
    document.getElementById('colorResult').value = Math.round(h * 512 / 360);
    document.getElementById('intensityResult').value = Math.round(s * 512 / 100);
    document.getElementById('brightnessResult').value = Math.round(l * 512 / 100);
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
    const [r, g, b] = color;

    const colorBox = document.createElement('div');
    colorBox.classList.add('colorBox');
    colorBox.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    colorBox.title = `R: ${r}, G: ${g}, B: ${b}`;
    colorBox.addEventListener('click', () => selectColor(color));

    const colorPalette = document.getElementById('colorPalette');
    colorPalette.appendChild(colorBox);
}

function selectColor(color) {
    const [r, g, b] = color;
    updateColorValues(r, g, b);
}
