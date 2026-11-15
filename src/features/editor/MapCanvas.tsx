"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Line,
  Group,
  Text,
  Circle,
  Ellipse,
} from "react-konva";
import type Konva from "konva";
import type { Festival, Point } from "@/domain";
import type { EditorElement } from "./layout";
import {
  clampVendorPosition,
  pathFootprint,
  fitViewport,
  metersToPixels,
  pixelsToMeters,
} from "./geometry";

interface Props {
  festival: Festival;
  onImageExportReady?: (exporter: (() => string) | null) => void;
  annotations?: EditorElement[];
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onMove?: (id: string, point: Point) => void;
}
export default function MapCanvas({
  festival,
  onImageExportReady,
  annotations = [],
  labels = {},
  colors = {},
  selectedId = "",
  onSelect = () => {},
  onMove = () => {},
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  useEffect(() => {
    onImageExportReady?.(() => {
      const stage = stageRef.current;
      if (!stage) throw new Error("The map is still loading.");
      return stage.toDataURL({
        pixelRatio: Math.max(2, Math.min(6, 1800 / stage.width())),
        mimeType: "image/png",
      });
    });
    return () => onImageExportReady?.(null);
  }, [onImageExportReady]);
  const [viewport, setViewport] = useState({ width: 800, height: 560 });
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const transform = fitViewport(festival.boundsMeters, viewport, 16);
  const s = transform.scale;
  const origin = transform.offset;
  const point = (p: Point) => metersToPixels(p, transform);
  return (
    <div
      className="map-canvas"
      style={{
        aspectRatio: `${festival.boundsMeters.width} / ${festival.boundsMeters.height}`,
      }}
      ref={host}
      role="img"
      aria-label="Event layout map. Select and move components using the inspector, or drag them on the map."
    >
      <Stage ref={stageRef} width={viewport.width} height={viewport.height}>
        <Layer listening={false}>
          <Rect
            width={viewport.width}
            height={viewport.height}
            fill="#f2f4ee"
          />
          <Rect
            {...origin}
            width={festival.boundsMeters.width * s}
            height={festival.boundsMeters.height * s}
            fill="#eaf0e5"
            stroke="#bdcdb5"
            cornerRadius={4}
          />
          {Array.from(
            { length: Math.floor(festival.boundsMeters.width / 10) + 1 },
            (_, i) => (
              <Line
                key={`x${i}`}
                points={[
                  point({ x: i * 10, y: 0 }).x,
                  origin.y,
                  point({ x: i * 10, y: 0 }).x,
                  point({ x: 0, y: festival.boundsMeters.height }).y,
                ]}
                stroke="#d6dfd0"
                strokeWidth={1}
              />
            ),
          )}
          {Array.from(
            { length: Math.floor(festival.boundsMeters.height / 10) + 1 },
            (_, i) => (
              <Line
                key={`y${i}`}
                points={[
                  origin.x,
                  point({ x: 0, y: i * 10 }).y,
                  point({ x: festival.boundsMeters.width, y: 0 }).x,
                  point({ x: 0, y: i * 10 }).y,
                ]}
                stroke="#d6dfd0"
                strokeWidth={1}
              />
            ),
          )}
        </Layer>
        <Layer>
          {festival.paths.map((path) => {
            const { position: anchor, size } = pathFootprint(path);
            return (
              <Group
                key={path.id}
                {...point(anchor)}
                draggable
                onClick={() => onSelect(path.id)}
                onTap={() => onSelect(path.id)}
                onDragStart={() => onSelect(path.id)}
                dragBoundFunc={(pixel) =>
                  point(
                    clampVendorPosition(
                      pixelsToMeters(pixel, transform),
                      size,
                      festival.boundsMeters,
                    ),
                  )
                }
                onDragEnd={(e) =>
                  onMove(
                    path.id,
                    pixelsToMeters(e.target.position(), transform),
                  )
                }
              >
                <Line
                  points={path.points.flatMap((p) => [
                    (p.x - anchor.x) * s,
                    (p.y - anchor.y) * s,
                  ])}
                  stroke={colors[path.id] ?? "#fffaf0"}
                  strokeWidth={path.widthMeters * s}
                  lineCap="butt"
                  lineJoin="round"
                />
                {
                  <>
                    <Rect
                      width={size.width * s}
                      height={size.height * s}
                      stroke={selectedId === path.id ? "#e79142" : undefined}
                      strokeWidth={2}
                    />
                    <Text
                      text={labels[path.id] ?? "Walkway"}
                      y={-16}
                      fontSize={11}
                      fill="#66704f"
                    />
                  </>
                }
              </Group>
            );
          })}
          {festival.obstacles.map((obstacle) => {
            const anchor = {
              x: Math.min(...obstacle.points.map((p) => p.x)),
              y: Math.min(...obstacle.points.map((p) => p.y)),
            };
            const size = {
              width: Math.max(...obstacle.points.map((p) => p.x)) - anchor.x,
              height: Math.max(...obstacle.points.map((p) => p.y)) - anchor.y,
            };
            return (
              <Group
                key={obstacle.id}
                {...point(anchor)}
                draggable
                onClick={() => onSelect(obstacle.id)}
                onTap={() => onSelect(obstacle.id)}
                onDragStart={() => onSelect(obstacle.id)}
                dragBoundFunc={(pixel) =>
                  point(
                    clampVendorPosition(
                      pixelsToMeters(pixel, transform),
                      size,
                      festival.boundsMeters,
                    ),
                  )
                }
                onDragEnd={(e) =>
                  onMove(
                    obstacle.id,
                    pixelsToMeters(e.target.position(), transform),
                  )
                }
              >
                <Line
                  points={obstacle.points.flatMap((p) => [
                    (p.x - anchor.x) * s,
                    (p.y - anchor.y) * s,
                  ])}
                  closed
                  fill={colors[obstacle.id] ?? "#91a38b"}
                  stroke={selectedId === obstacle.id ? "#e79142" : "#6d8268"}
                  strokeWidth={2}
                />
                {
                  <Text
                    text={labels[obstacle.id] ?? "Obstacle"}
                    y={-16}
                    fontSize={11}
                    fill="#66704f"
                  />
                }
              </Group>
            );
          })}
          {[
            ...annotations,
            ...(festival.amenities ?? []).map((item) => ({
              ...item,
              kind: item.type,
              color: "#79a5be",
              shape: "rectangle" as const,
            })),
          ].map((element) => (
            <Group
              key={element.id}
              {...point(element.position)}
              draggable
              onClick={() => onSelect(element.id)}
              onTap={() => onSelect(element.id)}
              onDragStart={() => onSelect(element.id)}
              dragBoundFunc={(pixel) =>
                point(
                  clampVendorPosition(
                    pixelsToMeters(pixel, transform),
                    element.size,
                    festival.boundsMeters,
                  ),
                )
              }
              onDragEnd={(e) =>
                onMove(
                  element.id,
                  pixelsToMeters(e.target.position(), transform),
                )
              }
            >
              {element.shape === "circle" ? (
                <Ellipse
                  x={(element.size.width * s) / 2}
                  y={(element.size.height * s) / 2}
                  radiusX={(element.size.width * s) / 2}
                  radiusY={(element.size.height * s) / 2}
                  fill={colors[element.id] ?? element.color}
                  opacity={0.65}
                  stroke={selectedId === element.id ? "#e79142" : element.color}
                  strokeWidth={2}
                />
              ) : (
                <Rect
                  width={element.size.width * s}
                  height={element.size.height * s}
                  fill={colors[element.id] ?? element.color}
                  opacity={0.65}
                  stroke={selectedId === element.id ? "#e79142" : element.color}
                  strokeWidth={2}
                  cornerRadius={3}
                />
              )}
              <Text
                text={labels[element.id] ?? element.name}
                y={-18}
                x={-25}
                width={element.size.width * s + 50}
                align="center"
                fontSize={11}
                fill="#344737"
              />
            </Group>
          ))}
        </Layer>
        <Layer>
          {festival.stages.map((stage) => (
            <Group
              key={stage.id}
              {...point(stage.position)}
              draggable
              onClick={() => onSelect(stage.id)}
              onTap={() => onSelect(stage.id)}
              onDragStart={() => onSelect(stage.id)}
              dragBoundFunc={(pixel) =>
                point(
                  clampVendorPosition(
                    pixelsToMeters(pixel, transform),
                    stage.size,
                    festival.boundsMeters,
                  ),
                )
              }
              onDragEnd={(event) =>
                onMove(
                  stage.id,
                  pixelsToMeters(event.target.position(), transform),
                )
              }
            >
              <Rect
                width={stage.size.width * s}
                height={stage.size.height * s}
                fill={colors[stage.id] ?? "#293f3b"}
                stroke={selectedId === stage.id ? "#e79142" : "#293f3b"}
                strokeWidth={2}
                cornerRadius={4}
              />
              <Text
                text={labels[stage.id] ?? stage.name}
                width={stage.size.width * s}
                y={(stage.size.height * s) / 2 - 12}
                align="center"
                fill="white"
                fontSize={12}
                padding={4}
              />
            </Group>
          ))}
          {festival.entrances.map((entrance) => (
            <Group
              key={entrance.id}
              {...point(entrance.position)}
              draggable
              onClick={() => onSelect(entrance.id)}
              onTap={() => onSelect(entrance.id)}
              onDragStart={() => onSelect(entrance.id)}
              dragBoundFunc={(pixel) =>
                point(
                  clampVendorPosition(
                    pixelsToMeters(pixel, transform),
                    { width: 0, height: 0 },
                    festival.boundsMeters,
                  ),
                )
              }
              onDragEnd={(event) =>
                onMove(
                  entrance.id,
                  pixelsToMeters(event.target.position(), transform),
                )
              }
            >
              <Circle
                radius={7}
                fill={colors[entrance.id] ?? "#247963"}
                stroke={selectedId === entrance.id ? "#e79142" : "white"}
                strokeWidth={3}
              />
              <Text
                text={labels[entrance.id] ?? entrance.name}
                x={-28}
                y={15}
                fill="#275146"
                fontSize={12}
              />
            </Group>
          ))}
        </Layer>
        <Layer>
          {festival.vendors.map((vendor) => (
            <Group
              key={vendor.id}
              {...point(vendor.position)}
              draggable
              onClick={() => onSelect(vendor.id)}
              onTap={() => onSelect(vendor.id)}
              onDragStart={() => onSelect(vendor.id)}
              dragBoundFunc={(pixel) =>
                point(
                  clampVendorPosition(
                    pixelsToMeters(pixel, transform),
                    vendor.size,
                    festival.boundsMeters,
                  ),
                )
              }
              onDragEnd={(event) =>
                onMove(
                  vendor.id,
                  pixelsToMeters(event.target.position(), transform),
                )
              }
            >
              <Rect
                width={vendor.size.width * s}
                height={vendor.size.height * s}
                fill={
                  colors[vendor.id] ??
                  (selectedId === vendor.id ? "#e79142" : "#dfaa70")
                }
                stroke={selectedId === vendor.id ? "#833e12" : "#b47e45"}
                strokeWidth={selectedId === vendor.id ? 2 : 1}
                cornerRadius={3}
              />
              <Text
                text={`${labels[vendor.id] ?? vendor.name}\nAvg. price: ${vendor.averagePrice} currency units`}
                y={-34}
                x={-32}
                width={vendor.size.width * s + 64}
                align="center"
                fontSize={12}
                fill="#573415"
              />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
