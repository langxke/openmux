# Electron nativeImage.createFromBuffer 颜色通道序错误

## 症状

使用 `nativeImage.createFromBuffer(buf, { width, height })` 逐像素生成应用图标时，颜色显示不正确。例如设置蓝色 `#007aff`（R=0, G=122, B=255），实际渲染为红色或红橙色。

## 根因

`nativeImage.createFromBuffer` 在 Windows 平台上期望 **BGRA** 字节序（Blue-Green-Red-Alpha），而非更常见的 RGBA（Red-Green-Blue-Alpha）。直接按 RGBA 写入 buffer 会导致红蓝通道互换：

```
期望（RGBA）: buf[i]=0, buf[i+1]=122, buf[i+2]=255, buf[i+3]=255  → 蓝色
实际（BGRA）: buf[i]=0(B), buf[i+1]=122(G), buf[i+2]=255(R), buf[i+3]=255(A) → 红色
```

正确的 BGRA 写入：`buf[i]=255(B), buf[i+1]=122(G), buf[i+2]=0(R), buf[i+3]=255(A)` → 蓝色。

## 诊断方法

1. 生成一个纯色（如纯蓝 `#0000FF`）的 1x1 像素图片
2. 将 buffer 设为 `[0, 0, 255, 255]`（RGBA）
3. 调用 `nativeImage.createFromBuffer` 创建图标
4. 截图或用取色器检查实际颜色
5. 如果显示为红色而非蓝色，确认是 BGRA 序

## 修复步骤

将像素写入顺序改为 BGRA：

```ts
// 错误：RGBA 序
buf[i] = r;
buf[i+1] = g;
buf[i+2] = b;
buf[i+3] = a;

// 正确：BGRA 序（Windows）
buf[i] = b;       // Blue
buf[i+1] = g;     // Green
buf[i+2] = r;     // Red
buf[i+3] = a;     // Alpha
```

完整的图标生成示例（深蓝底 + 白色图形）：

```ts
const size = 64;
const buf = Buffer.alloc(size * size * 4, 0);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    // 深蓝背景 #0046b4 → BGRA: B=180, G=70, R=0
    buf[i] = 180;     // Blue
    buf[i+1] = 70;    // Green
    buf[i+2] = 0;     // Red
    buf[i+3] = 255;   // Alpha
  }
}

const icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
fs.writeFileSync("icon.png", icon.toPNG());
```

## 失败尝试

- **使用 SVG Data URL + `nativeImage.createFromDataURL`**：Windows 上 `createFromDataURL` 对 SVG 的支持不稳定，生成的图标为空或渲染异常
- **使用 `mainWindow.setIcon(bufferIcon)`**：即使图标生成正确，运行时设置不如在 `BrowserWindow` 构造时通过 `icon` 属性指定文件路径可靠

## 关键约束

- BGRA 序仅适用于 Windows。macOS/Linux 可能有不同的原生字节序，`nativeImage.createFromBuffer` 文档注明 "The buffer is expected to be in BGRA format on most platforms"
- 生成 PNG 文件后通过 `BrowserWindow({ icon: path })` 设置比运行时 `mainWindow.setIcon()` 更可靠
- PNG 文件本身的 RGBA/BGRA 序与 `nativeImage` 的 buffer 格式是两回事：`toPNG()` 输出的 PNG 始终是标准 RGBA 序

## 原理

Windows GDI/GDI+ 底层使用 BGRA 作为原生像素格式（与 `BITMAPINFOHEADER` 的字节序一致）。Electron 的 `nativeImage` 封装了平台原生图像 API，缓冲区直接映射到 Windows 的像素格式，因此需要 BGRA 序。
