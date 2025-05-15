from flask import Flask, request, jsonify, render_template
from ultralytics import YOLO
from PIL import Image
import io
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

# 加载 YOLO 模型
model = YOLO("D:/dataset/best.pt")  # 替换为你的 .pt 文件路径

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