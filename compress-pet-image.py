from collections import deque
from PIL import Image, ImageFilter
import os

source_path = r"D:\ENT208\software\picture\1.jpg"
output_path = r"D:\ENT208\software\KOKO-BOX\static\pet\home-pet-cutout.png"


def color_distance(pixel_a, pixel_b):
    return sum(abs(int(pixel_a[i]) - int(pixel_b[i])) for i in range(3))


def remove_background(image):
    rgba = image.convert('RGBA')
    width, height = rgba.size
    pixels = rgba.load()

    corners = [pixels[0, 0], pixels[width - 1, 0], pixels[0, height - 1], pixels[width - 1, height - 1]]
    background = tuple(sum(int(corner[i]) for corner in corners) // len(corners) for i in range(4))

    visited = [[False] * width for _ in range(height)]
    queue = deque()

    def enqueue(x, y):
        if 0 <= x < width and 0 <= y < height and not visited[y][x]:
            visited[y][x] = True
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    threshold = 95
    background_mask = [[False] * width for _ in range(height)]
    while queue:
        x, y = queue.popleft()
        if color_distance(pixels[x, y], background) <= threshold:
            background_mask[y][x] = True
            enqueue(x + 1, y)
            enqueue(x - 1, y)
            enqueue(x, y + 1)
            enqueue(x, y - 1)

    alpha = Image.new('L', (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if background_mask[y][x]:
                alpha_pixels[x, y] = 0

    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
    rgba.putalpha(alpha)

    return rgba


def main():
    img = Image.open(source_path)
    print(f"原始图片大小: {img.size}")

    # 保持宠物主体比例，控制到适合首页展示的宽度。
    target_width = 400
    scale = target_width / img.width
    target_size = (target_width, int(round(img.height * scale)))
    resized = img.resize(target_size, Image.Resampling.LANCZOS)
    print(f"调整后大小: {resized.size}")

    cutout = remove_background(resized)
    cutout.save(output_path, 'PNG', optimize=True)

    file_size = os.path.getsize(output_path)
    print(f"保存后文件大小: {file_size} 字节 ({file_size/1024:.1f} KB)")


if __name__ == '__main__':
    main()
