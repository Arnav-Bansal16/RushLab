/** Download a labeled, opaque PNG of the map. No layout data is uploaded. */
export async function downloadLayoutImage(
  mapDataUrl: string,
  name: string,
  widthMeters: number,
  heightMeters: number,
): Promise<void> {
  const image = new Image();
  image.src = mapDataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  const padding = 40,
    header = 112,
    footer = 56;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight + header + footer;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Image export is not available in this browser.");
  context.fillStyle = "#f6f7f4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#20342e";
  context.font = "600 30px Arial, sans-serif";
  context.fillText(
    name || "Event plan",
    padding,
    46,
    canvas.width - padding * 2,
  );
  context.fillStyle = "#60745c";
  context.font = "18px Arial, sans-serif";
  context.fillText(
    `${widthMeters} × ${heightMeters} meters · Grid: 10 m`,
    padding,
    80,
  );
  context.drawImage(image, 0, header);
  context.font = "16px Arial, sans-serif";
  context.fillText("RushLab · Event layout plan", padding, canvas.height - 22);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Could not create PNG image.")),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    name
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "event"
  }-layout.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
