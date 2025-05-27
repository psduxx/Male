from flask import Flask, request, jsonify, render_template
from ultralytics import YOLO
from PIL import Image
import io
import os
import requests
from flask_cors import CORS
import base64
import cv2
import numpy as np

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
    接收图片并返回带框图片和预测结果
    """
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        image = Image.open(io.BytesIO(file.read()))

        # 使用 YOLO 模型进行预测
        results = model(image, conf=0.5, iou=0.5)
        predictions = []
        for result in results:
            for box in result.boxes:
                predictions.append({
                    "class": result.names[int(box.cls)],
                    "confidence": float(box.conf),
                    "bbox": box.xyxy.tolist()
                })

        # 获取原图
        img_with_boxes = np.array(image.convert("RGB"))
        img_with_boxes = cv2.cvtColor(img_with_boxes, cv2.COLOR_RGB2BGR)

        # 绘制检测框和类别名
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy.tolist()[0])
                class_name = result.names[int(box.cls)]
                # 画框
                cv2.rectangle(img_with_boxes, (x1, y1), (x2, y2), (0, 255, 0), 2)
                # 只显示类别名
                cv2.putText(
                    img_with_boxes,
                    class_name,
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    (0, 255, 0),
                    2,
                    cv2.LINE_AA,
                )
        # 编码为base64
        _, buffer = cv2.imencode('.jpg', img_with_boxes)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        print("返回图片base64长度：", len(img_base64))

        # 返回带框图片和预测信息
        return jsonify({
            "image": img_base64,
            "predictions": [
                {
                    "class": pred["class"],
                    "confidence": pred["confidence"],
                    "bbox": [int(coord) for coord in pred["bbox"][0]]  # 只取第一组坐标
                }
                for pred in predictions
            ]
        })

    except Exception as e:
        print(f"Error during prediction: {e}")
        return jsonify({"error": "Prediction failed", "details": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)