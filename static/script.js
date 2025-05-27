// 选择 DOM 元素
const homeSection = document.getElementById("homeSection");
const uploadSection = document.getElementById("uploadSection");
const cameraSection = document.getElementById("cameraSection");
const backBtn = document.getElementById("backBtn");

const goUpload = document.getElementById("goUpload");
const goCamera = document.getElementById("goCamera");

const imageUpload = document.getElementById("imageUpload");
const uploadButton = document.getElementById("uploadButton");
const preview = document.getElementById("preview");
const resultText = document.getElementById("resultText");

const startCameraBtn = document.getElementById("startCamera");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const flashBtn = document.getElementById("flashBtn");
const albumBtn = document.getElementById("albumBtn");
const albumInput = document.getElementById("albumInput");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const cameraResult = document.getElementById("cameraResult");

let streaming = false;
let cameraInterval = null;
let lastPredictions = [];
let disappearCount = 0;
const disappearThreshold = 3; // 允许连续几帧无结果才消失

let currentFacing = "environment";
let currentStream = null;
let currentZoom = 1;

// 页面切换函数
function showSection(section) {
    homeSection.style.display = section === "home" ? "block" : "none";
    uploadSection.style.display = section === "upload" ? "block" : "none";
    cameraSection.style.display = section === "camera" ? "block" : "none";
    backBtn.style.display = section === "home" ? "none" : "block";
    // 停止摄像头
    if (section !== "camera" && streaming) {
        if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
        streaming = false;
        video.srcObject = null;
        if (cameraInterval) clearInterval(cameraInterval);
    }
    // 清空上传区内容
    if (section !== "upload") {
        preview.style.display = "none";
        resultText.textContent = "";
        imageUpload.value = "";
    }
    // 自动打开摄像头并开始识别
    if (section === "camera") {
        startCameraAndDetect();
    }
}

// 自动打开摄像头并循环识别
async function startCameraAndDetect(facing = currentFacing) {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    streaming = false;
    if (cameraInterval) clearInterval(cameraInterval);

    try {
        // 这里改为非 exact
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            setTimeout(() => {
                const w = video.videoWidth || 320;
                const h = video.videoHeight || 240;
                // 只设置canvas宽高
                canvas.width = w;
                canvas.height = h;
                streaming = true;
                cameraInterval = setInterval(captureAndDetect, 700);
            }, 100);
        };
        video.play();
    } catch (e) {
        alert("无法打开摄像头：" + e.name);
    }
}

// 循环抓帧并识别
async function captureAndDetect() {
    if (!streaming) return;
    if (!video.videoWidth || !video.videoHeight) return; // 宽高为0时跳过

    // 用临时canvas抓帧
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    tempCanvas.getContext("2d").drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    tempCanvas.toBlob(async function(blob) {
        const formData = new FormData();
        formData.append("image", blob, "frame.jpg");
        try {
            const response = await fetch("/predict", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            // 只在主canvas上画识别框，不再drawImage
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (Array.isArray(data.predictions) && data.predictions.length > 0) {
                ctx.font = "16px Arial";
                ctx.strokeStyle = "#00FF00";
                ctx.lineWidth = 2;
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                data.predictions.forEach(pred => {
                    const [x1, y1, x2, y2] = pred.bbox;
                    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                    const text = pred.class;
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillRect(x1, y1 - 20, textWidth + 10, 20);
                    ctx.fillStyle = "#fff";
                    ctx.fillText(text, x1 + 5, y1 - 5);
                    ctx.fillStyle = "rgba(0,0,0,0.5)";
                });
            }
        } catch (e) {
            // 错误处理
        }
    }, "image/jpeg");
}

// 初始显示
showSection("home");

// 跳转按钮
goUpload.onclick = () => showSection("upload");
goCamera.onclick = function() {
    showSection("camera");
};

// 上传图片后预览原图
imageUpload.onchange = function () {
    const file = imageUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
};

// 点击识别按钮，上传图片并显示带框结果
uploadButton.onclick = async function () {
    const file = imageUpload.files[0];
    if (!file) {
        alert("请先上传图片！");
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch("/predict", {
            method: "POST",
            body: formData,
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            alert("识别失败请重试（服务器返回格式错误）");
            return;
        }

        if (!response.ok || data.error) {
            alert("识别失败！" + (data.details || data.error || ""));
            preview.style.display = "none";
            resultText.textContent = "";
            return;
        }

        // 显示带框图片
        if (data.image) {
            preview.src = "data:image/jpeg;base64," + data.image;
            preview.style.display = "block";
        }

        // 显示识别文本（可选）
        if (Array.isArray(data.predictions) && data.predictions.length > 0) {
            resultText.innerHTML = data.predictions
                .map(pred => `${pred.class}（置信度：${(pred.confidence * 100).toFixed(2)}%）`)
                .join("<br>");
        } else {
            resultText.textContent = "未检测到目标。";
        }

    } catch (error) {
        alert("识别失败！" + error);
        preview.style.display = "none";
        resultText.textContent = "";
    }
};

// 切换摄像头
switchCameraBtn.onclick = () => {
    currentFacing = currentFacing === "environment" ? "user" : "environment";
    startCameraAndDetect(currentFacing);
};

// 闪光灯
flashBtn.onclick = () => {
  const track = currentStream && currentStream.getVideoTracks()[0];
  if (track && track.getCapabilities().torch) {
    const torchOn = flashBtn.classList.toggle("on");
    track.applyConstraints({ advanced: [{ torch: torchOn }] });
    flashIcon.textContent = torchOn ? "💡" : "🔦";
  } else {
    alert("当前设备不支持闪光灯");
  }
};

// 相册
albumBtn.onclick = () => albumInput.click();
albumInput.onchange = function() {
  const file = albumInput.files[0];
  if (file) {
    // 你的图片识别逻辑
  }
};

// 缩放
zoomInBtn.onclick = () => setZoom(currentZoom + 0.2);
zoomOutBtn.onclick = () => setZoom(currentZoom - 0.2);
function setZoom(zoom) {
    const track = video.srcObject && video.srcObject.getVideoTracks()[0];
    if (track && track.getCapabilities().zoom) {
        currentZoom = Math.max(track.getCapabilities().zoom.min, Math.min(zoom, track.getCapabilities().zoom.max));
        track.applyConstraints({ advanced: [{ zoom: currentZoom }] });
    } else {
        alert("当前设备不支持变焦");
    }
}

// 定位
function getWeatherByCoords(lat, lon, city) {
    fetch(`https://wttr.in/${lat},${lon}?format=%t+%C`)
        .then(res => res.text())
        .then(txt => document.getElementById("weather").textContent = txt)
        .catch(() => document.getElementById("weather").textContent = "天气获取失败");
}

const OPENCAGE_KEY = "5bc6346cf9184bba94d294fc3000017e";
function getCityByLocation(lat, lon) {
    fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_KEY}`)
        .then(res => res.json())
        .then(data => {
            if (data.results && data.results.length > 0) {
                // 优先显示城市名，否则显示最近的行政区
                const components = data.results[0].components;
                const city = components.city || components.town || components.village || components.state || "未知";
                document.getElementById("location").textContent = city;
                getWeatherByCoords(lat, lon, city);
            } else {
                document.getElementById("location").textContent = "定位失败";
                document.getElementById("weather").textContent = "天气获取失败";
            }
        })
        .catch(() => {
            document.getElementById("location").textContent = "定位失败";
            document.getElementById("weather").textContent = "天气获取失败";
        });
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        getCityByLocation(lat, lon);
    }, function() {
        document.getElementById("location").textContent = "定位失败";
        document.getElementById("weather").textContent = "天气获取失败";
    });
} else {
    document.getElementById("location").textContent = "不支持定位";
    document.getElementById("weather").textContent = "天气获取失败";
}

backBtn.onclick = function() {
    showSection("home");
};