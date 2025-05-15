// 选择 DOM 元素
const imageUpload = document.getElementById("imageUpload");
const uploadButton = document.getElementById("uploadButton");
const preview = document.getElementById("preview");
const resultSection = document.getElementById("resultSection");
const resultText = document.getElementById("resultText");

// 预览上传的图片
imageUpload.addEventListener("change", () => {
  const file = imageUpload.files[0];
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  }
});

// 上传图片并发送到后端
uploadButton.addEventListener("click", async () => {
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

    if (!response.ok) {
      throw new Error("预测失败！");
    }

    const predictions = await response.json();
    displayResults(predictions);
  } catch (error) {
    console.error(error);
    alert("识别失败，请重试！");
  }
});

// 显示识别结果
function displayResults(predictions) {
  resultSection.style.display = "block";
  if (predictions.length === 0) {
    resultText.innerText = "未检测到任何目标！";
    return;
  }

  const result = predictions
    .map(
      (pred) =>
        `${pred.class}（置信度：${(pred.confidence * 100).toFixed(2)}%）`
    )
    .join("\n");

  resultText.innerText = result;
}