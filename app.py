from flask import Flask, request, jsonify, render_template
from ultralytics import YOLO
from PIL import Image
import io
import os
import requests
from flask_cors import CORS

# 设置 YOLO 配置目录为 /tmp
os.environ["YOLO_CONFIG_DIR"] = "/tmp"

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Google Drive 模型文件 URL
MODEL_URL = "https://drive.google.com/uc?id=15XBbny9sOXg6eH5XUtMIVuHejUK_Uf9w&export=download"
MODEL_PATH = "best.pt"

# 检查模型文件是否存在，如果不存在则从 Google Drive 下载
if not os.path.exists(MODEL_PATH):
    print("Downloading model from Google Drive...")
    response = requests.get(MODEL_URL, stream=True)
    if response.status_code == 200:
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)
        print("Model downloaded successfully!")
    else:
        print("Failed to download model. Please check the URL.")

# 加载 YOLO 模型
model = YOLO(MODEL_PATH)

@app.route("/")
def index():
    """
    渲染主页
    """
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    """
    接收图片并返回预测结果
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    # 读取上传的图片
    file = request.files["image"]
    image = Image.open(io.BytesIO(file.read()))

    # 使用 YOLO 模型进行预测
    results = model(image)
    predictions = []
    for result in results:
        for box in result.boxes:
            predictions.append({
                "class": result.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": box.xyxy.tolist()
            })

    return jsonify(predictions)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)