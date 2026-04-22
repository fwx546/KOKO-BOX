from PIL import Image
import os

source_path = r"D:\ENT208\software\picture\1.jpg"
output_path = r"D:\ENT208\software\KOKO-BOX\static\pet\home-pet-cutout.png"

# 读取原始图片
img = Image.open(source_path)
print(f"原始图片大小: {img.size}")

# 调整大小到合理的尺寸（宽度最多 400px）
img_resized = img.resize((400, 404), Image.Resampling.LANCZOS)
print(f"调整后大小: {img_resized.size}")

# 转换为RGBA（如果不是）
if img_resized.mode != 'RGBA':
    img_resized = img_resized.convert('RGBA')

# 用高质量压缩保存
img_resized.save(output_path, 'PNG', optimize=True)

# 检查新文件大小
file_size = os.path.getsize(output_path)
print(f"保存后文件大小: {file_size} 字节 ({file_size/1024:.1f} KB)")
